import { query } from '../db';
import { calculatePricing } from '../services/payment.service';
import { TWO_QT } from '../config/constants';

const mockQuery = query as jest.Mock;

const BASE_ITEM = {
  id: 'item-1',
  price_paise: 10000, // ₹100
  available: true,
  daily_limit: 100,
  today_sold_count: 0,
  customization_groups: null,
  kitchen_id: 'kitchen-1',
  category: 'main',
};

const BASE_ZONE = {
  delivery_fee_type: 'flat',
  base_delivery_fee_paise: 2500,
  per_km_fee_paise: 0,
  base_distance_km: 0,
  free_delivery_above_paise: null,
  surge_multiplier: null,
  surge_enabled: false,
  surge_expires_at: null,
  min_order_paise: 0,
  small_order_fee_paise: 0,
};

// Actual DB call order in calculatePricing:
// 1. menu_items
// 2. menu_offers
// [3. per-offer audience queries — skipped when offers=[]]
// 4. zones
// [5. subscription check — only if isSubscriptionOrder]
// [6. promo_codes + checks — only if promoCode provided]
// 7. campaigns
// [8. per-campaign winback queries — skipped when campaigns=[]]
// [9. loyalty_transactions — only if useLoyalty]
// [10. delivery_fee_tiers — only if !isSubscriptionOrder]
// 11. wallet

function setupBasicMocks(overrides: Partial<{
  items: any[];
  offers: any[];
  zone: any;
  campaigns: any[];
  tiers: any[];
  walletBalance: number;
}> = {}) {
  mockQuery.mockReset();
  mockQuery
    .mockResolvedValueOnce({ rows: overrides.items ?? [BASE_ITEM] })          // 1. menu_items
    .mockResolvedValueOnce({ rows: overrides.offers ?? [] })                   // 2. menu_offers
    .mockResolvedValueOnce({ rows: [overrides.zone ?? BASE_ZONE] })           // 3. zones
    .mockResolvedValueOnce({ rows: overrides.campaigns ?? [] })               // 4. campaigns
    .mockResolvedValueOnce({ rows: overrides.tiers ?? [] })                   // 5. delivery_fee_tiers
    .mockResolvedValueOnce({ rows: [{ balance_paise: overrides.walletBalance ?? 0 }] }); // 6. wallet
}

const CUSTOMER_ID = 'customer-1';
const ZONE_ID = 'zone-1';
const CART = [{ menuItemId: 'item-1', quantity: 1 }];

describe('calculatePricing', () => {
  beforeEach(() => mockQuery.mockReset());

  // ── Basic calculation ──────────────────────────────────────────────────────

  it('calculates basic order: subtotal + flat delivery + 5% GST', async () => {
    setupBasicMocks();
    const result = await calculatePricing({ cartItems: CART, customerId: CUSTOMER_ID, zoneId: ZONE_ID, distanceKm: 2 });

    expect(result.subtotalPaise).toBe(10000);
    expect(result.deliveryFeePaise).toBe(2500);
    const expectedGst = Math.round(10000 * 0.05); // 500
    expect(result.cgstPaise + result.sgstPaise).toBe(expectedGst);
    expect(result.totalAmountPaise).toBe(10000 + 2500 + expectedGst);
    expect(result.gatewayAmountPaise).toBe(result.totalAmountPaise);
    expect(result.walletDeductionPaise).toBe(0);
  });

  it('splits GST evenly into CGST and SGST', async () => {
    setupBasicMocks();
    const result = await calculatePricing({ cartItems: CART, customerId: CUSTOMER_ID, zoneId: ZONE_ID, distanceKm: 2 });
    expect(result.cgstPaise).toBe(250);
    expect(result.sgstPaise).toBe(250);
    expect(result.cgstPaise + result.sgstPaise).toBe(500);
  });

  it('multiplies correctly for quantity > 1', async () => {
    setupBasicMocks();
    const result = await calculatePricing({
      cartItems: [{ menuItemId: 'item-1', quantity: 3 }],
      customerId: CUSTOMER_ID, zoneId: ZONE_ID, distanceKm: 2,
    });
    expect(result.subtotalPaise).toBe(30000);
  });

  it('sums multiple cart items', async () => {
    setupBasicMocks({
      items: [
        { ...BASE_ITEM, id: 'item-1', price_paise: 10000 },
        { ...BASE_ITEM, id: 'item-2', price_paise: 5000 },
      ],
    });
    const result = await calculatePricing({
      cartItems: [{ menuItemId: 'item-1', quantity: 1 }, { menuItemId: 'item-2', quantity: 2 }],
      customerId: CUSTOMER_ID, zoneId: ZONE_ID, distanceKm: 2,
    });
    expect(result.subtotalPaise).toBe(20000);
  });

  it('total = taxable + delivery + surge + smallOrderFee + gst + tip', async () => {
    setupBasicMocks();
    const r = await calculatePricing({ cartItems: CART, customerId: CUSTOMER_ID, zoneId: ZONE_ID, distanceKm: 2 });
    const totalDiscount = r.menuOfferDiscountPaise + r.subscriptionDiscountPaise + r.discountPaise + r.loyaltyDiscountPaise + r.campaignDiscountPaise;
    const taxable = Math.max(0, r.subtotalPaise - totalDiscount);
    const gst = r.cgstPaise + r.sgstPaise;
    expect(r.totalAmountPaise).toBe(taxable + r.deliveryFeePaise + r.surgePaise + r.smallOrderFeePaise + gst + r.riderTipPaise);
  });

  it('gateway = total - wallet deduction', async () => {
    setupBasicMocks({ walletBalance: 3000 });
    const r = await calculatePricing({ cartItems: CART, customerId: CUSTOMER_ID, zoneId: ZONE_ID, distanceKm: 2, walletAmountPaise: 99999 });
    expect(r.gatewayAmountPaise).toBe(r.totalAmountPaise - r.walletDeductionPaise);
  });

  // ── Item availability ──────────────────────────────────────────────────────

  it('throws ITEM_UNAVAILABLE when item is not available', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ ...BASE_ITEM, available: false }] }) // menu_items
      .mockResolvedValueOnce({ rows: [] });                                    // menu_offers

    await expect(calculatePricing({ cartItems: CART, customerId: CUSTOMER_ID, zoneId: ZONE_ID, distanceKm: 2 }))
      .rejects.toThrow('ITEM_UNAVAILABLE_item-1');
  });

  it('throws ITEM_UNAVAILABLE when daily limit is exhausted', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ ...BASE_ITEM, today_sold_count: 100, daily_limit: 100 }] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(calculatePricing({
      cartItems: [{ menuItemId: 'item-1', quantity: 1 }],
      customerId: CUSTOMER_ID, zoneId: ZONE_ID, distanceKm: 2,
    })).rejects.toThrow('ITEM_UNAVAILABLE_item-1');
  });

  // ── Minimum order ──────────────────────────────────────────────────────────

  it('throws MIN_ORDER_NOT_MET when subtotal is below zone minimum', async () => {
    setupBasicMocks({ zone: { ...BASE_ZONE, min_order_paise: 20000 } });
    await expect(calculatePricing({ cartItems: CART, customerId: CUSTOMER_ID, zoneId: ZONE_ID, distanceKm: 2 }))
      .rejects.toThrow('MIN_ORDER_NOT_MET:20000');
  });

  it('does NOT enforce min order for subscription orders', async () => {
    // Subscription order flow: items → offers → zone → subscription → campaigns → wallet (no tiers)
    mockQuery
      .mockResolvedValueOnce({ rows: [BASE_ITEM] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...BASE_ZONE, min_order_paise: 20000 }] })
      .mockResolvedValueOnce({ rows: [{ id: 'sub-1' }] })  // subscription exists
      .mockResolvedValueOnce({ rows: [] })                   // campaigns
      .mockResolvedValueOnce({ rows: [{ balance_paise: 0 }] }); // wallet

    const result = await calculatePricing({
      cartItems: CART, customerId: CUSTOMER_ID, zoneId: ZONE_ID, distanceKm: 2,
      isSubscriptionOrder: true,
    });
    expect(result.subscriptionDiscountPaise).toBe(10000);
    expect(result.deliveryFeePaise).toBe(0); // subscriber: free delivery
  });

  it('throws NO_ACTIVE_SUBSCRIPTION_OR_CREDITS when subscription is exhausted', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [BASE_ITEM] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [BASE_ZONE] })
      .mockResolvedValueOnce({ rows: [] }) // no active subscription
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ balance_paise: 0 }] });

    await expect(calculatePricing({
      cartItems: CART, customerId: CUSTOMER_ID, zoneId: ZONE_ID, distanceKm: 2, isSubscriptionOrder: true,
    })).rejects.toThrow('NO_ACTIVE_SUBSCRIPTION_OR_CREDITS');
  });

  // ── Promo codes ───────────────────────────────────────────────────────────

  it('applies flat promo discount and adjusts GST', async () => {
    // With promo: items → offers → zone → promo_codes → campaigns → tiers → wallet
    const promo = { id: 'p1', discount_type: 'flat', discount_value_paise: 2000, discount_flat_paise: 2000, discount_percent: null, max_discount_paise: null, min_order_paise: 0, first_order_only: false, new_user_only: false, per_user_limit: null };
    mockQuery
      .mockResolvedValueOnce({ rows: [BASE_ITEM] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [BASE_ZONE] })
      .mockResolvedValueOnce({ rows: [promo] })            // promo_codes
      .mockResolvedValueOnce({ rows: [] })                  // campaigns
      .mockResolvedValueOnce({ rows: [] })                  // tiers
      .mockResolvedValueOnce({ rows: [{ balance_paise: 0 }] });

    const result = await calculatePricing({ cartItems: CART, customerId: CUSTOMER_ID, zoneId: ZONE_ID, distanceKm: 2, promoCode: 'FLAT20' });

    expect(result.discountPaise).toBe(2000);
    const taxable = 10000 - 2000;
    expect(result.cgstPaise + result.sgstPaise).toBe(Math.round(taxable * 0.05));
  });

  it('applies percentage promo discount', async () => {
    const promo = { id: 'p1', discount_type: 'percent', discount_percent: 10, discount_value_paise: null, discount_flat_paise: null, max_discount_paise: null, min_order_paise: 0, first_order_only: false, new_user_only: false, per_user_limit: null };
    mockQuery
      .mockResolvedValueOnce({ rows: [BASE_ITEM] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [BASE_ZONE] })
      .mockResolvedValueOnce({ rows: [promo] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ balance_paise: 0 }] });

    const result = await calculatePricing({ cartItems: CART, customerId: CUSTOMER_ID, zoneId: ZONE_ID, distanceKm: 2, promoCode: 'SAVE10' });
    expect(result.discountPaise).toBe(1000);
  });

  it('caps percentage promo at max_discount_paise', async () => {
    const promo = { id: 'p1', discount_type: 'percent', discount_percent: 50, discount_value_paise: null, discount_flat_paise: null, max_discount_paise: 3000, min_order_paise: 0, first_order_only: false, new_user_only: false, per_user_limit: null };
    mockQuery
      .mockResolvedValueOnce({ rows: [BASE_ITEM] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [BASE_ZONE] })
      .mockResolvedValueOnce({ rows: [promo] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ balance_paise: 0 }] });

    const result = await calculatePricing({ cartItems: CART, customerId: CUSTOMER_ID, zoneId: ZONE_ID, distanceKm: 2, promoCode: 'BIG50' });
    expect(result.discountPaise).toBe(3000); // capped at ₹30
  });

  it('throws PROMO_INVALID_OR_EXPIRED when promo not found', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [BASE_ITEM] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [BASE_ZONE] })
      .mockResolvedValueOnce({ rows: [] })  // no promo
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ balance_paise: 0 }] });

    await expect(calculatePricing({ cartItems: CART, customerId: CUSTOMER_ID, zoneId: ZONE_ID, distanceKm: 2, promoCode: 'INVALID' }))
      .rejects.toThrow('PROMO_INVALID_OR_EXPIRED');
  });

  it('throws PROMO_FIRST_ORDER_ONLY when customer has prior delivered orders', async () => {
    const promo = { id: 'p1', discount_type: 'flat', discount_flat_paise: 1000, discount_percent: null, discount_value_paise: null, max_discount_paise: null, min_order_paise: 0, first_order_only: true, new_user_only: false, per_user_limit: null };
    mockQuery
      .mockResolvedValueOnce({ rows: [BASE_ITEM] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [BASE_ZONE] })
      .mockResolvedValueOnce({ rows: [promo] })
      .mockResolvedValueOnce({ rows: [{ id: 'old-order' }] }) // has prior order
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ balance_paise: 0 }] });

    await expect(calculatePricing({ cartItems: CART, customerId: CUSTOMER_ID, zoneId: ZONE_ID, distanceKm: 2, promoCode: 'FIRST' }))
      .rejects.toThrow('PROMO_FIRST_ORDER_ONLY');
  });

  it('throws PROMO_USAGE_LIMIT_REACHED when per_user_limit exceeded', async () => {
    const promo = { id: 'p1', discount_type: 'flat', discount_flat_paise: 1000, discount_percent: null, discount_value_paise: null, max_discount_paise: null, min_order_paise: 0, first_order_only: false, new_user_only: false, per_user_limit: 1 };
    mockQuery
      .mockResolvedValueOnce({ rows: [BASE_ITEM] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [BASE_ZONE] })
      .mockResolvedValueOnce({ rows: [promo] })
      .mockResolvedValueOnce({ rows: [{ cnt: '1' }] }) // already used once
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ balance_paise: 0 }] });

    await expect(calculatePricing({ cartItems: CART, customerId: CUSTOMER_ID, zoneId: ZONE_ID, distanceKm: 2, promoCode: 'CODE' }))
      .rejects.toThrow('PROMO_USAGE_LIMIT_REACHED');
  });

  it('throws PROMO_MIN_ORDER when order below promo minimum', async () => {
    const promo = { id: 'p1', discount_type: 'flat', discount_flat_paise: 1000, discount_percent: null, discount_value_paise: null, max_discount_paise: null, min_order_paise: 50000, first_order_only: false, new_user_only: false, per_user_limit: null };
    mockQuery
      .mockResolvedValueOnce({ rows: [BASE_ITEM] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [BASE_ZONE] })
      .mockResolvedValueOnce({ rows: [promo] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ balance_paise: 0 }] });

    await expect(calculatePricing({ cartItems: CART, customerId: CUSTOMER_ID, zoneId: ZONE_ID, distanceKm: 2, promoCode: 'BIGORDER' }))
      .rejects.toThrow('PROMO_MIN_ORDER:50000');
  });

  // ── Wallet ─────────────────────────────────────────────────────────────────

  it('deducts wallet balance from gateway amount', async () => {
    setupBasicMocks({ walletBalance: 5000 });
    const result = await calculatePricing({ cartItems: CART, customerId: CUSTOMER_ID, zoneId: ZONE_ID, distanceKm: 2, walletAmountPaise: 99999 });
    expect(result.walletDeductionPaise).toBe(5000);
    expect(result.gatewayAmountPaise).toBe(result.totalAmountPaise - 5000);
  });

  it('caps wallet deduction at total amount (full wallet payment → gateway=0)', async () => {
    setupBasicMocks({ walletBalance: 100000 });
    const result = await calculatePricing({ cartItems: CART, customerId: CUSTOMER_ID, zoneId: ZONE_ID, distanceKm: 2, walletAmountPaise: 99999 });
    expect(result.walletDeductionPaise).toBe(result.totalAmountPaise);
    expect(result.gatewayAmountPaise).toBe(0);
  });

  it('does not use wallet when walletAmountPaise is 0', async () => {
    setupBasicMocks({ walletBalance: 100000 });
    const result = await calculatePricing({ cartItems: CART, customerId: CUSTOMER_ID, zoneId: ZONE_ID, distanceKm: 2, walletAmountPaise: 0 });
    expect(result.walletDeductionPaise).toBe(0);
  });

  // ── Delivery fee ───────────────────────────────────────────────────────────

  it('applies free delivery when order meets the threshold', async () => {
    setupBasicMocks({ zone: { ...BASE_ZONE, free_delivery_above_paise: 5000 } }); // free above ₹50, order ₹100
    const result = await calculatePricing({ cartItems: CART, customerId: CUSTOMER_ID, zoneId: ZONE_ID, distanceKm: 2 });
    expect(result.deliveryFeePaise).toBe(0);
  });

  it('charges delivery when below free-delivery threshold', async () => {
    setupBasicMocks({ zone: { ...BASE_ZONE, free_delivery_above_paise: 20000, base_delivery_fee_paise: 2500 } });
    const result = await calculatePricing({ cartItems: CART, customerId: CUSTOMER_ID, zoneId: ZONE_ID, distanceKm: 2 });
    expect(result.deliveryFeePaise).toBe(2500);
  });

  it('calculates per-km delivery fee correctly', async () => {
    setupBasicMocks({
      zone: { ...BASE_ZONE, delivery_fee_type: 'per_km', base_delivery_fee_paise: 1500, per_km_fee_paise: 500, base_distance_km: 2, free_delivery_above_paise: null },
    });
    // 4km total, 2km base, 2km extra × ₹5 = ₹10 extra, total = ₹15 + ₹10 = ₹25
    const result = await calculatePricing({ cartItems: CART, customerId: CUSTOMER_ID, zoneId: ZONE_ID, distanceKm: 4 });
    expect(result.deliveryFeePaise).toBeCloseTo(2500, 0);
  });

  it('applies surge on top of base delivery fee', async () => {
    setupBasicMocks({
      zone: { ...BASE_ZONE, base_delivery_fee_paise: 2500, surge_enabled: true, surge_multiplier: '1.5', surge_expires_at: new Date(Date.now() + 3600000).toISOString() },
    });
    const result = await calculatePricing({ cartItems: CART, customerId: CUSTOMER_ID, zoneId: ZONE_ID, distanceKm: 2 });
    // surge: floor(2500 × 1.5) - 2500 = 1250
    expect(result.surgePaise).toBe(1250);
    expect(result.deliveryFeePaise).toBe(2500); // base unchanged
  });

  it('does not apply surge when it has expired', async () => {
    setupBasicMocks({
      zone: { ...BASE_ZONE, surge_enabled: true, surge_multiplier: '2.0', surge_expires_at: new Date(Date.now() - 1000).toISOString() },
    });
    const result = await calculatePricing({ cartItems: CART, customerId: CUSTOMER_ID, zoneId: ZONE_ID, distanceKm: 2 });
    expect(result.surgePaise).toBe(0);
  });

  it('uses delivery fee tier when one matches', async () => {
    setupBasicMocks({ tiers: [{ fee_paise: 1000 }] }); // tier: ₹10 delivery
    const result = await calculatePricing({ cartItems: CART, customerId: CUSTOMER_ID, zoneId: ZONE_ID, distanceKm: 2 });
    expect(result.deliveryFeePaise).toBe(1000);
  });

  it('applies free delivery for subscription orders regardless of zone config', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [BASE_ITEM] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [BASE_ZONE] })
      .mockResolvedValueOnce({ rows: [{ id: 'sub-1' }] }) // subscription
      .mockResolvedValueOnce({ rows: [] })                  // campaigns
      .mockResolvedValueOnce({ rows: [{ balance_paise: 0 }] }); // NO tiers for subscriptions

    const result = await calculatePricing({ cartItems: CART, customerId: CUSTOMER_ID, zoneId: ZONE_ID, distanceKm: 2, isSubscriptionOrder: true });
    expect(result.deliveryFeePaise).toBe(TWO_QT.DELIVERY.SUBSCRIBER_FEE_PAISE); // 0
  });

  // ── Loyalty points ─────────────────────────────────────────────────────────

  it('applies loyalty discount (100 points = ₹1)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [BASE_ITEM] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [BASE_ZONE] })
      .mockResolvedValueOnce({ rows: [] })                          // campaigns
      .mockResolvedValueOnce({ rows: [{ total_points: '500' }] })  // 500 pts = ₹5
      .mockResolvedValueOnce({ rows: [] })                          // tiers
      .mockResolvedValueOnce({ rows: [{ balance_paise: 0 }] });

    const result = await calculatePricing({ cartItems: CART, customerId: CUSTOMER_ID, zoneId: ZONE_ID, distanceKm: 2, useLoyalty: true });
    expect(result.loyaltyDiscountPaise).toBe(500);
  });

  it('caps loyalty discount at 20% of effective order value', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [BASE_ITEM] }) // ₹100
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [BASE_ZONE] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total_points: '100000' }] }) // 100k pts = ₹1000 discount
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ balance_paise: 0 }] });

    const result = await calculatePricing({ cartItems: CART, customerId: CUSTOMER_ID, zoneId: ZONE_ID, distanceKm: 2, useLoyalty: true });
    // 20% of ₹100 = ₹20 = 2000 paise
    expect(result.loyaltyDiscountPaise).toBeLessThanOrEqual(2000);
  });

  it('ignores loyalty when useLoyalty is false', async () => {
    setupBasicMocks();
    const result = await calculatePricing({ cartItems: CART, customerId: CUSTOMER_ID, zoneId: ZONE_ID, distanceKm: 2, useLoyalty: false });
    expect(result.loyaltyDiscountPaise).toBe(0);
  });

  // ── Campaign discounts ─────────────────────────────────────────────────────

  it('applies campaign flat discount', async () => {
    const campaign = { id: 'c1', type: 'flash_sale', discount_type: 'flat', discount_flat_paise: 3000, discount_percent: null, max_discount_paise: null, min_order_paise: 0, winback_days: null, audience_type: null };
    setupBasicMocks({ campaigns: [campaign] });
    const result = await calculatePricing({ cartItems: CART, customerId: CUSTOMER_ID, zoneId: ZONE_ID, distanceKm: 2 });
    expect(result.campaignDiscountPaise).toBe(3000);
  });

  it('applies free_delivery campaign', async () => {
    const campaign = { id: 'c1', type: 'flash_sale', discount_type: 'free_delivery', discount_flat_paise: null, discount_percent: null, max_discount_paise: null, min_order_paise: 0, winback_days: null, audience_type: null };
    setupBasicMocks({ campaigns: [campaign] });
    const result = await calculatePricing({ cartItems: CART, customerId: CUSTOMER_ID, zoneId: ZONE_ID, distanceKm: 2 });
    expect(result.deliveryFeePaise).toBe(0);
  });

  it('skips campaign when order is below campaign min_order', async () => {
    const campaign = { id: 'c1', type: 'flash_sale', discount_type: 'flat', discount_flat_paise: 3000, discount_percent: null, max_discount_paise: null, min_order_paise: 50000, winback_days: null, audience_type: null };
    setupBasicMocks({ campaigns: [campaign] }); // order ₹100, campaign min ₹500
    const result = await calculatePricing({ cartItems: CART, customerId: CUSTOMER_ID, zoneId: ZONE_ID, distanceKm: 2 });
    expect(result.campaignDiscountPaise).toBe(0);
  });

  // ── Rider tip ─────────────────────────────────────────────────────────────

  it('adds rider tip to total without affecting taxable base', async () => {
    setupBasicMocks();
    const result = await calculatePricing({ cartItems: CART, customerId: CUSTOMER_ID, zoneId: ZONE_ID, distanceKm: 2, riderTipPaise: 2000 });
    expect(result.riderTipPaise).toBe(2000);
    // Tip should be in total but NOT in taxable amount → GST stays same as without tip
    const gstWithoutTip = Math.round(10000 * 0.05);
    expect(result.cgstPaise + result.sgstPaise).toBe(gstWithoutTip);
    expect(result.totalAmountPaise).toContain !== undefined; // just a runtime check
    expect(result.totalAmountPaise).toBe(
      result.subtotalPaise + result.deliveryFeePaise + result.cgstPaise + result.sgstPaise + 2000
    );
  });

  // ── Customizations ────────────────────────────────────────────────────────

  it('adds customization price to item base price', async () => {
    const itemWithCustom = {
      ...BASE_ITEM,
      customization_groups: [{ name: 'Size', options: [{ name: 'Large', price_paise: 2000 }] }],
    };
    mockQuery
      .mockResolvedValueOnce({ rows: [itemWithCustom] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [BASE_ZONE] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ balance_paise: 0 }] });

    const result = await calculatePricing({
      cartItems: [{ menuItemId: 'item-1', quantity: 1, customizations: [{ group: 'Size', option: 'Large' }] }],
      customerId: CUSTOMER_ID, zoneId: ZONE_ID, distanceKm: 2,
    });
    expect(result.subtotalPaise).toBe(12000); // ₹100 + ₹20 extra
  });
});
