/**
 * HTTP-layer tests for /payment routes.
 */

import express from 'express';
import request from 'supertest';
import { query } from '../db';
import { redis } from '../redis';

// Stub Razorpay so it never makes real HTTP calls
jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => ({
    orders: {
      create: jest.fn().mockResolvedValue({ id: 'rzp_order_test', amount: 10000 }),
    },
    payments: { fetch: jest.fn() },
  }));
});

// Pass-through rate limiter so tests are never blocked
jest.mock('../middleware/rateLimiter', () => ({
  paymentLimiter: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../services/payment.service', () => ({
  calculatePricing: jest.fn().mockResolvedValue({
    subtotalPaise: 15000,
    deliveryFeePaise: 2000,
    gatewayAmountPaise: 17000,
    discountPaise: 0,
    walletUsedPaise: 0,
    loyaltyUsedPaise: 0,
    taxPaise: 0,
    totalPaise: 17000,
  }),
}));

jest.mock('../services/subscription.service', () => ({
  handleSubscriptionRenewal: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../services/order.service', () => ({
  finalizeOrder: jest.fn().mockResolvedValue({ status: 'confirmed' }),
  createPendingOrder: jest.fn().mockResolvedValue({ id: 'order-uuid-1', display_id: 'VELTO-001' }),
  finalizeWalletRecharge: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../utils/googleMaps', () => ({
  getDistanceKm: jest.fn().mockResolvedValue(3.5),
}));

jest.mock('../config/constants', () => ({
  TWO_QT: {
    SUBSCRIPTION: { PLANS: [] },
    MAX_DELIVERY_KM: 10,
  },
}));

import paymentRouter from '../routes/payment';

const app = express();
app.use(express.json());
app.use('/payment', paymentRouter);

const mockQuery = query as jest.Mock;
const mockRedisSet = redis.set as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockRedisSet.mockResolvedValue('OK');
  (redis.get as jest.Mock).mockResolvedValue(null);
});

// ── POST /payment/create-order ────────────────────────────────────────────────

describe('POST /payment/create-order', () => {
  const validBody = {
    items: [{ menuItemId: 'menu-item-1', quantity: 1, pricePaise: 15000 }],
    addressId: 'addr-1',
    promoCode: null,
    useWallet: false,
    useLoyalty: false,
    paymentMethod: 'online',
  };

  it('returns 400 with ORDER_FAILED when address is not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // address lookup returns nothing

    const res = await request(app).post('/payment/create-order').send(validBody);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('ORDER_FAILED');
    expect(res.body.message).toContain('ADDRESS_NOT_FOUND');
  });

  it('returns 429 when idempotency lock is already held (duplicate order)', async () => {
    // Redis set returns null → lock already exists → DUPLICATE_ORDER
    mockRedisSet.mockResolvedValueOnce(null);

    const res = await request(app).post('/payment/create-order').send(validBody);
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('DUPLICATE_ORDER');
  });

  it('does NOT apply idempotency lock on dry-run requests', async () => {
    // Even if Redis set would return null (lock held), dryRun bypasses lock check
    mockRedisSet.mockResolvedValue(null);
    mockQuery
      .mockResolvedValueOnce({ rows: [{ zone_id: 'zone-1', lat: 12.9, lng: 77.6 }] }) // address
      .mockResolvedValueOnce({ rows: [{ zone_id: 'zone-1' }] });                       // item zones

    const res = await request(app)
      .post('/payment/create-order')
      .send({ ...validBody, dryRun: true });

    // Should get past idempotency check and return pricing (not 429)
    expect(res.status).not.toBe(429);
  });

  it('returns 400 with ORDER_FAILED when items span multiple zones', async () => {
    mockRedisSet.mockResolvedValueOnce('OK');
    mockQuery
      .mockResolvedValueOnce({ rows: [{ zone_id: 'zone-1', lat: 12.9, lng: 77.6 }] }) // address
      .mockResolvedValueOnce({ rows: [] })                                               // zone hours (empty = no restriction)
      .mockResolvedValueOnce({ rows: [{ zone_id: 'zone-1' }, { zone_id: 'zone-2' }] }); // two zones

    const res = await request(app).post('/payment/create-order').send(validBody);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('ORDER_FAILED');
    expect(res.body.message).toContain('CART_MULTIPLE_ZONES');
  });
});

// ── POST /payment/wallet/recharge ─────────────────────────────────────────────

describe('POST /payment/wallet/recharge', () => {
  it('returns 400 when amount is below minimum (₹100 = 10000 paise)', async () => {
    const res = await request(app).post('/payment/wallet/recharge').send({ amountPaise: 5000 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_AMOUNT');
  });

  it('returns 400 when amountPaise is missing', async () => {
    const res = await request(app).post('/payment/wallet/recharge').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_AMOUNT');
  });

  it('creates a Razorpay order for valid amount', async () => {
    const res = await request(app).post('/payment/wallet/recharge').send({ amountPaise: 20000 });
    expect(res.status).toBe(200);
    expect(res.body.razorpayOrderId).toBe('rzp_order_test');
    expect(res.body.amount).toBe(10000);
  });
});

// ── POST /payment/subscription/purchase ──────────────────────────────────────

describe('POST /payment/subscription/purchase', () => {
  it('returns 400 for an unknown planId', async () => {
    const res = await request(app).post('/payment/subscription/purchase').send({ planId: 'unknown-plan' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_PLAN');
  });
});
