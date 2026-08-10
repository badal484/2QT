/**
 * HTTP-layer tests for /customer routes.
 */

import express from 'express';
import request from 'supertest';
import { query } from '../db';
import { redis, keys } from '../redis';

jest.mock('../services/trigger.service', () => ({
  scheduleTriggerSend: jest.fn().mockResolvedValue(undefined),
  cancelTriggerJobs: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../services/refund.service', () => ({
  processWalletRefund: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../services/notification.service', () => ({
  NotificationService: { sendToUser: jest.fn(), sendNotification: jest.fn() },
}));
jest.mock('../routes/support', () => ({
  PRIORITY_SLA: { general: 48, delivery: 4, payment: 8 },
}));

import customerRouter from '../routes/customer';

const app = express();
app.use(express.json());
app.use('/customer', customerRouter);

const mockQuery = query as jest.Mock;
const mockRedisGet = redis.get as jest.Mock;
const mockRedisSet = redis.set as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockRedisGet.mockResolvedValue(null);
  mockRedisSet.mockResolvedValue('OK');
});

// ── GET /customer/me ──────────────────────────────────────────────────────────

describe('GET /customer/me', () => {
  it('returns the authenticated user', async () => {
    const user = { id: 'user-test-1', name: 'Test User', phone: '919999999999', role: 'customer' };
    mockQuery.mockResolvedValueOnce({ rows: [user] });

    const res = await request(app).get('/customer/me');
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: 'user-test-1', name: 'Test User' });
  });

  it('returns undefined user when not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/customer/me');
    expect(res.status).toBe(200);
    expect(res.body.user).toBeUndefined();
  });
});

// ── GET /customer/cart ────────────────────────────────────────────────────────

describe('GET /customer/cart', () => {
  it('returns empty array when Redis has no cart', async () => {
    mockRedisGet.mockResolvedValueOnce(null);

    const res = await request(app).get('/customer/cart');
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it('parses and returns cart items from Redis', async () => {
    const items = [{ id: 'item-1', name: 'Biryani', quantity: 2 }];
    mockRedisGet.mockResolvedValueOnce(JSON.stringify(items));

    const res = await request(app).get('/customer/cart');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].name).toBe('Biryani');
  });
});

// ── POST /customer/cart/sync ──────────────────────────────────────────────────

describe('POST /customer/cart/sync', () => {
  it('saves items to Redis and returns success', async () => {
    const items = [{ id: 'item-1', quantity: 1 }];

    const res = await request(app).post('/customer/cart/sync').send({ items });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockRedisSet).toHaveBeenCalledWith(
      keys.customerCart('user-test-1'),
      JSON.stringify(items)
    );
  });

  it('saves empty array when items is omitted', async () => {
    const res = await request(app).post('/customer/cart/sync').send({});
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockRedisSet).toHaveBeenCalledWith(
      keys.customerCart('user-test-1'),
      JSON.stringify([])
    );
  });
});

// ── PATCH /customer/profile ───────────────────────────────────────────────────

describe('PATCH /customer/profile', () => {
  it('updates and returns the user', async () => {
    const updated = { id: 'user-test-1', name: 'New Name', email: 'new@example.com', photo_url: null };
    mockQuery.mockResolvedValueOnce({ rows: [updated] });

    const res = await request(app).patch('/customer/profile').send({ name: 'New Name', email: 'new@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('New Name');
  });

  it('accepts partial updates (only name)', async () => {
    const updated = { id: 'user-test-1', name: 'Partial', email: null, photo_url: null };
    mockQuery.mockResolvedValueOnce({ rows: [updated] });

    const res = await request(app).patch('/customer/profile').send({ name: 'Partial' });
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Partial');
  });
});

// ── GET /customer/wallet ──────────────────────────────────────────────────────

describe('GET /customer/wallet', () => {
  it('returns zero balance when no wallet row exists', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })           // wallet (no row)
      .mockResolvedValueOnce({ rows: [] });           // transactions

    const res = await request(app).get('/customer/wallet');
    expect(res.status).toBe(200);
    expect(res.body.balancePaise).toBe(0);
    expect(res.body.transactions).toEqual([]);
  });

  it('returns balance and mapped transaction fields', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ balance_paise: 50000 }] })
      .mockResolvedValueOnce({ rows: [{ amount_paise: 10000, balance_after_paise: 40000, created_at: '2024-01-01T00:00:00Z', type: 'debit' }] });

    const res = await request(app).get('/customer/wallet');
    expect(res.status).toBe(200);
    expect(res.body.balancePaise).toBe(50000);
    expect(res.body.transactions[0].amountPaise).toBe(10000);
    expect(res.body.transactions[0].balanceAfterPaise).toBe(40000);
  });

  it('respects limit and offset query params', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/customer/wallet?limit=10&offset=20');
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(10);
    expect(res.body.offset).toBe(20);
  });

  it('caps limit at 100', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/customer/wallet?limit=200');
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(100);
  });
});

// ── GET /customer/loyalty ─────────────────────────────────────────────────────

describe('GET /customer/loyalty', () => {
  it('returns points total and history', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total_points: '150' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'lt-1', points: 50, type: 'earn', created_at: '2024-01-01T00:00:00Z' }] });

    const res = await request(app).get('/customer/loyalty');
    expect(res.status).toBe(200);
    expect(res.body.points).toBe(150);
    expect(res.body.history).toHaveLength(1);
    expect(res.body.history[0].createdAt).toBe('2024-01-01T00:00:00Z');
  });

  it('returns 0 points when no transactions', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total_points: '0' }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/customer/loyalty');
    expect(res.status).toBe(200);
    expect(res.body.points).toBe(0);
    expect(res.body.history).toEqual([]);
  });
});
