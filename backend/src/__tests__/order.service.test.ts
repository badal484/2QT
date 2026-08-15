import { query, withTransaction } from '../db';
import { redis, keys } from '../redis';
import { finalizeOrder, createPendingOrder, finalizeWalletRecharge } from '../services/order.service';

jest.mock('../services/notification.service', () => ({
  NotificationService: { send: jest.fn().mockResolvedValue(undefined) },
  notifyKitchenStaff: jest.fn().mockResolvedValue(undefined),
  notifyRidersInZone: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../services/referral.service', () => ({ processReferral: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../services/trigger.service', () => ({
  cancelTriggerJobs: jest.fn().mockResolvedValue(undefined),
  checkWalletLowTrigger: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../services/distance.service', () => ({
  computeAndStoreRoadDistance: jest.fn().mockResolvedValue(undefined),
}));

const mockQuery = query as jest.Mock;
const mockRedisGet = redis.get as jest.Mock;
const mockRedisSet = redis.set as jest.Mock;
const mockRedisDel = redis.del as jest.Mock;

const GATEWAY_ORDER_ID = 'rzp_order_123';
const ORDER_ID = 'order-uuid-1';
const CUSTOMER_ID = 'customer-uuid-1';
const KITCHEN_ID = 'kitchen-uuid-1';

function makeOrder(overrides = {}) {
  return {
    id: ORDER_ID,
    display_id: '2QT-000001',
    customer_id: CUSTOMER_ID,
    kitchen_id: KITCHEN_ID,
    zone_id: 'zone-1',
    address_id: 'address-1',
    status: 'pending_payment',
    total_amount_paise: 13000,
    gateway_amount_paise: 13000,
    wallet_deduction_paise: 0,
    subtotal_paise: 10000,
    delivery_fee_paise: 2500,
    is_subscription_order: false,
    promo_code_id: null,
    ...overrides,
  };
}

describe('finalizeOrder', () => {
  let clientMock: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisGet.mockResolvedValue(null); // not processed yet

    // withTransaction mock — captures the client calls
    clientMock = { query: jest.fn() };
    (withTransaction as jest.Mock).mockImplementation(async (cb) => cb(clientMock));
  });

  it('returns already_processed when webhook was previously handled', async () => {
    mockRedisGet.mockResolvedValueOnce('1'); // already in Redis
    const result = await finalizeOrder(GATEWAY_ORDER_ID, 'online');
    expect(result).toEqual({ status: 'already_processed' });
  });

  it('throws ORDER_NOT_FOUND when order does not exist', async () => {
    clientMock.query
      .mockResolvedValueOnce({ rows: [] }); // order not found

    await expect(finalizeOrder(GATEWAY_ORDER_ID, 'online')).rejects.toThrow('ORDER_NOT_FOUND');
  });

  it('returns already_finalized when order is not in pending_payment state', async () => {
    clientMock.query
      .mockResolvedValueOnce({ rows: [makeOrder({ status: 'confirmed' })] }); // already confirmed

    const result = await finalizeOrder(GATEWAY_ORDER_ID, 'online');
    expect(result).toEqual({ status: 'already_finalized', orderId: ORDER_ID });
  });

  it('throws INSUFFICIENT_WALLET_BALANCE_AT_FINALIZATION when wallet is too low', async () => {
    const order = makeOrder({ wallet_deduction_paise: 5000 });
    clientMock.query
      .mockResolvedValueOnce({ rows: [order] })              // order found
      .mockResolvedValueOnce({ rows: [{ balance_paise: 2000 }] }); // wallet too low

    await expect(finalizeOrder(GATEWAY_ORDER_ID, 'online')).rejects.toThrow('INSUFFICIENT_WALLET_BALANCE_AT_FINALIZATION');
  });

  it('deducts wallet and logs wallet transaction on success', async () => {
    const order = makeOrder({ wallet_deduction_paise: 3000 });
    const finalizedOrder = { ...order, status: 'confirmed' };

    clientMock.query
      .mockResolvedValueOnce({ rows: [order] })                              // order found
      .mockResolvedValueOnce({ rows: [{ balance_paise: 5000 }] })           // wallet check
      .mockResolvedValueOnce({ rows: [finalizedOrder] })                     // update order
      .mockResolvedValueOnce({ rows: [{ is_partner: false }] })             // kitchen
      .mockResolvedValueOnce({ rows: [] })                                   // order_items
      .mockResolvedValueOnce({ rows: [{ balance_paise: 2000 }] })           // wallet update
      .mockResolvedValueOnce({ rows: [] })                                   // wallet_transactions
      .mockResolvedValueOnce({ rows: [] })                                   // loyalty INSERT
      .mockResolvedValueOnce({ rows: [{ total: '130' }] });                 // loyalty balance fetch

    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '2' }] })                   // order count
      .mockResolvedValueOnce({ rows: [{ value: 'false' }] });               // auto_dispatch setting

    const result = await finalizeOrder(GATEWAY_ORDER_ID, 'online');
    expect(result).toMatchObject({ status: 'order_created', orderId: ORDER_ID });

    // Wallet deduction query ran
    const walletUpdateCall = clientMock.query.mock.calls.find((c: any[]) =>
      c[0]?.includes('balance_paise - $1')
    );
    expect(walletUpdateCall).toBeDefined();
  });

  it('throws NO_ACTIVE_SUBSCRIPTION_OR_CREDITS when subscription depleted', async () => {
    const order = makeOrder({ is_subscription_order: true });
    clientMock.query
      .mockResolvedValueOnce({ rows: [order] })
      .mockResolvedValueOnce({ rows: [{ ...order, status: 'confirmed', customer_id: CUSTOMER_ID, kitchen_id: KITCHEN_ID, zone_id: 'zone-1', display_id: '2QT-000001' }] }) // update order
      .mockResolvedValueOnce({ rows: [{ is_partner: false }] })             // kitchen
      .mockResolvedValueOnce({ rows: [] })                                   // items
      .mockResolvedValueOnce({ rows: [] });                                  // subscription depleted → 0 rows

    await expect(finalizeOrder(GATEWAY_ORDER_ID, 'online')).rejects.toThrow('NO_ACTIVE_SUBSCRIPTION_OR_CREDITS');
  });

  it('marks webhook as processed in Redis to prevent duplicate processing', async () => {
    const order = makeOrder();
    const finalizedOrder = { ...order, status: 'confirmed', customer_id: CUSTOMER_ID, kitchen_id: KITCHEN_ID, zone_id: 'zone-1', display_id: '2QT-000001' };

    clientMock.query
      .mockResolvedValueOnce({ rows: [order] })
      .mockResolvedValueOnce({ rows: [finalizedOrder] })
      .mockResolvedValueOnce({ rows: [{ is_partner: false }] })
      .mockResolvedValueOnce({ rows: [] })                       // order_items
      .mockResolvedValueOnce({ rows: [] })                       // loyalty INSERT
      .mockResolvedValueOnce({ rows: [{ total: '130' }] });     // loyalty balance

    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: [{ value: 'false' }] });

    await finalizeOrder(GATEWAY_ORDER_ID, 'online');
    expect(mockRedisSet).toHaveBeenCalledWith(
      keys.processedWebhook(GATEWAY_ORDER_ID),
      '1',
      expect.objectContaining({ EX: expect.any(Number) })
    );
  });

  it('calculates commission for partner kitchens', async () => {
    const order = makeOrder({ subtotal_paise: 10000, delivery_fee_paise: 2500 });
    const finalizedOrder = { ...order, status: 'confirmed', customer_id: CUSTOMER_ID, kitchen_id: KITCHEN_ID, zone_id: 'zone-1', display_id: '2QT-000001' };

    clientMock.query
      .mockResolvedValueOnce({ rows: [order] })
      .mockResolvedValueOnce({ rows: [finalizedOrder] })
      .mockResolvedValueOnce({ rows: [{ is_partner: true, commission_rate: '0.15' }] }) // 15% commission
      .mockResolvedValueOnce({ rows: [] })                       // commission UPDATE
      .mockResolvedValueOnce({ rows: [] })                       // order_items
      .mockResolvedValueOnce({ rows: [] })                       // loyalty INSERT
      .mockResolvedValueOnce({ rows: [{ total: '130' }] });     // loyalty balance

    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: [{ value: 'false' }] });

    await finalizeOrder(GATEWAY_ORDER_ID, 'online');

    const commissionCall = clientMock.query.mock.calls.find((c: any[]) =>
      c[0]?.includes('UPDATE orders SET') && c[0]?.includes('commission_paise')
    );
    expect(commissionCall).toBeDefined();
    // params: [commissionRate, commissionPaise, kitchenPayoutPaise, platformDeliveryPaise, orderId]
    // commission = 15% of 10000 = 1500
    expect(commissionCall[1][1]).toBe(1500); // commissionPaise
  });

  it('awards loyalty points equal to total amount / 100', async () => {
    const order = makeOrder({ total_amount_paise: 13000 });
    const finalizedOrder = { ...order, status: 'confirmed', customer_id: CUSTOMER_ID, kitchen_id: KITCHEN_ID, zone_id: 'zone-1', display_id: '2QT-000001', total_amount_paise: 13000 };

    clientMock.query
      .mockResolvedValueOnce({ rows: [order] })
      .mockResolvedValueOnce({ rows: [finalizedOrder] })
      .mockResolvedValueOnce({ rows: [{ is_partner: false }] })
      .mockResolvedValueOnce({ rows: [] })  // items
      .mockResolvedValueOnce({ rows: [] })  // loyalty insert
      .mockResolvedValueOnce({ rows: [{ total: '130' }] }); // loyalty sum

    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: [{ value: 'false' }] });

    await finalizeOrder(GATEWAY_ORDER_ID, 'online');

    const loyaltyCall = clientMock.query.mock.calls.find((c: any[]) =>
      c[0]?.includes('loyalty_transactions') && c[0]?.includes('INSERT')
    );
    expect(loyaltyCall).toBeDefined();
    expect(loyaltyCall[1][1]).toBe(130); // 13000 / 100 = 130 points
  });
});

describe('createPendingOrder', () => {
  let clientMock: any;

  beforeEach(() => {
    clientMock = { query: jest.fn() };
    (withTransaction as jest.Mock).mockImplementation(async (cb) => cb(clientMock));
  });

  it('throws KITCHEN_INACTIVE when kitchen is not active', async () => {
    clientMock.query.mockResolvedValueOnce({ rows: [{ is_active: false, is_partner: false, partner_status: null, is_paused: false }] });

    await expect(createPendingOrder({
      customerId: CUSTOMER_ID,
      kitchenId: KITCHEN_ID,
      zoneId: 'zone-1',
      addressId: 'address-1',
      items: [{ menuItemId: 'item-1', quantity: 1 }],
      pricing: { subtotalPaise: 10000, deliveryFeePaise: 2500, discountPaise: 0, loyaltyDiscountPaise: 0, walletDeductionPaise: 0, surgePaise: 0, cgstPaise: 250, sgstPaise: 250, totalAmountPaise: 13000, gatewayAmountPaise: 13000, promoCodeId: null, menuOfferDiscountPaise: 0, smallOrderFeePaise: 0, riderTipPaise: 0 },
      paymentMethod: 'online',
    })).rejects.toMatchObject({ code: 'KITCHEN_INACTIVE' });
  });

  it('throws KITCHEN_INACTIVE when kitchen is paused', async () => {
    clientMock.query.mockResolvedValueOnce({ rows: [{ is_active: true, is_partner: false, partner_status: null, is_paused: true }] });

    await expect(createPendingOrder({
      customerId: CUSTOMER_ID, kitchenId: KITCHEN_ID, zoneId: 'zone-1', addressId: 'address-1',
      items: [], pricing: { subtotalPaise: 0, deliveryFeePaise: 0, discountPaise: 0, loyaltyDiscountPaise: 0, walletDeductionPaise: 0, surgePaise: 0, cgstPaise: 0, sgstPaise: 0, totalAmountPaise: 0, gatewayAmountPaise: 0, promoCodeId: null, menuOfferDiscountPaise: 0, smallOrderFeePaise: 0, riderTipPaise: 0 },
      paymentMethod: 'online',
    })).rejects.toMatchObject({ code: 'KITCHEN_INACTIVE' });
  });

  it('creates order and inserts order_items', async () => {
    const orderRecord = { id: ORDER_ID, display_id: '2QT-000001' };
    clientMock.query
      .mockResolvedValueOnce({ rows: [{ is_active: true, is_partner: false, partner_status: null, is_paused: false }] }) // kitchen check
      .mockResolvedValueOnce({ rows: [{ lat: 12.9, lng: 77.6 }] })   // address coords
      .mockResolvedValueOnce({ rows: [orderRecord] })                  // INSERT order
      .mockResolvedValueOnce({ rows: [] });                            // INSERT order_item

    const result = await createPendingOrder({
      customerId: CUSTOMER_ID, kitchenId: KITCHEN_ID, zoneId: 'zone-1', addressId: 'address-1',
      items: [{ menuItemId: 'item-1', quantity: 2, pricePaise: 10000 }],
      pricing: { subtotalPaise: 20000, deliveryFeePaise: 2500, discountPaise: 0, loyaltyDiscountPaise: 0, walletDeductionPaise: 0, surgePaise: 0, cgstPaise: 500, sgstPaise: 500, totalAmountPaise: 23500, gatewayAmountPaise: 23500, promoCodeId: null, menuOfferDiscountPaise: 0, smallOrderFeePaise: 0, riderTipPaise: 0 },
      paymentMethod: 'online',
    });

    expect(result).toEqual(orderRecord);
    // order_items INSERT was called
    const itemInsert = clientMock.query.mock.calls.find((c: any[]) => c[0]?.includes('order_items'));
    expect(itemInsert).toBeDefined();
  });
});

describe('finalizeWalletRecharge', () => {
  let clientMock: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisGet.mockResolvedValue(null);
    clientMock = { query: jest.fn() };
    (withTransaction as jest.Mock).mockImplementation(async (cb) => cb(clientMock));
  });

  it('returns already_processed when payment was previously handled', async () => {
    mockRedisGet.mockResolvedValueOnce('1');
    const result = await finalizeWalletRecharge('pay_123', 10000, CUSTOMER_ID);
    expect(result).toEqual({ status: 'already_processed' });
  });

  it('credits wallet and logs transaction', async () => {
    clientMock.query
      .mockResolvedValueOnce({ rows: [] }) // upsert wallet
      .mockResolvedValueOnce({ rows: [] }); // wallet_transaction

    mockQuery
      .mockResolvedValueOnce({ rows: [{ balance_paise: 10000 }] }) // new balance
      .mockResolvedValueOnce({ rows: [{ phone: '919999999999' }] }); // user phone

    const result = await finalizeWalletRecharge('pay_123', 10000, CUSTOMER_ID);
    expect(result).toEqual({ success: true });

    const upsertCall = clientMock.query.mock.calls[0];
    expect(upsertCall[0]).toContain('customer_wallet');
    expect(upsertCall[1]).toContain(10000);
  });
});
