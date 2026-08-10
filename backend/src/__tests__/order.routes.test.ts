/**
 * HTTP-layer tests for /order routes.
 */

import express from 'express';
import request from 'supertest';
import { query } from '../db';
import { redis, keys } from '../redis';

jest.mock('../services/notification.service', () => ({
  NotificationService: { sendToUser: jest.fn(), sendNotification: jest.fn() },
}));
jest.mock('../services/refund.service', () => ({
  processWalletRefund: jest.fn().mockResolvedValue(undefined),
  processBankRefund: jest.fn().mockResolvedValue(undefined),
}));

import orderRouter from '../routes/order';

const app = express();
app.use(express.json());
app.use('/orders', orderRouter);

const mockQuery = query as jest.Mock;
const mockRedisGet = redis.get as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockRedisGet.mockResolvedValue(null);
});

// ── GET /orders/mine ──────────────────────────────────────────────────────────

describe('GET /orders/mine', () => {
  it('returns paginated order history for the authenticated user', async () => {
    const orders = [
      { id: 'ord-1', customer_id: 'user-test-1', status: 'delivered', total_paise: 20000, items: [] },
      { id: 'ord-2', customer_id: 'user-test-1', status: 'cancelled', total_paise: 15000, items: [] },
    ];
    mockQuery.mockResolvedValueOnce({ rows: orders });

    const res = await request(app).get('/orders/mine');
    expect(res.status).toBe(200);
    expect(res.body.orders).toHaveLength(2);
    expect(res.body.limit).toBe(20);
    expect(res.body.offset).toBe(0);
  });

  it('returns empty array when user has no orders', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/orders/mine');
    expect(res.status).toBe(200);
    expect(res.body.orders).toEqual([]);
  });

  it('respects limit and offset query params', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/orders/mine?limit=5&offset=10');
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(5);
    expect(res.body.offset).toBe(10);
  });

  it('caps limit at 50', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/orders/mine?limit=999');
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(50);
  });
});

// ── GET /orders/active ────────────────────────────────────────────────────────

describe('GET /orders/active', () => {
  it('returns active (non-delivered, non-cancelled) orders', async () => {
    const activeOrders = [
      { id: 'ord-active-1', customer_id: 'user-test-1', status: 'preparing', items: [] },
    ];
    mockQuery.mockResolvedValueOnce({ rows: activeOrders });

    const res = await request(app).get('/orders/active');
    expect(res.status).toBe(200);
    expect(res.body.activeOrders).toHaveLength(1);
    expect(res.body.activeOrders[0].status).toBe('preparing');
  });

  it('returns empty array when no active orders', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/orders/active');
    expect(res.status).toBe(200);
    expect(res.body.activeOrders).toEqual([]);
  });
});

// ── GET /orders/:id ───────────────────────────────────────────────────────────

describe('GET /orders/:id', () => {
  it('returns 404 when order does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/orders/nonexistent-id');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });

  it('returns 403 when customer tries to access another customer\'s order', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'ord-1', customer_id: 'other-user', status: 'delivered', rider_id: null, items: [] }],
    });

    const res = await request(app).get('/orders/ord-1');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('returns the order when customer owns it', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'ord-1',
        customer_id: 'user-test-1',
        status: 'preparing',
        rider_id: null,
        items: [{ menu_item_name: 'Biryani', quantity: 1, price_paise: 15000 }],
      }],
    });

    const res = await request(app).get('/orders/ord-1');
    expect(res.status).toBe(200);
    expect(res.body.order.id).toBe('ord-1');
    expect(res.body.order.status).toBe('preparing');
  });

  it('attaches rider location from Redis when rider_id is set', async () => {
    const riderLoc = JSON.stringify({ lat: 12.93, lng: 77.62 });
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'ord-2',
        customer_id: 'user-test-1',
        status: 'on_the_way',
        rider_id: 'rider-1',
        items: [],
      }],
    });
    mockRedisGet.mockResolvedValueOnce(riderLoc);

    const res = await request(app).get('/orders/ord-2');
    expect(res.status).toBe(200);
    expect(res.body.order.rider_lat).toBe(12.93);
    expect(res.body.order.rider_lng).toBe(77.62);
  });

  it('succeeds even when rider location is absent from Redis', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'ord-3',
        customer_id: 'user-test-1',
        status: 'on_the_way',
        rider_id: 'rider-99',
        items: [],
      }],
    });
    mockRedisGet.mockResolvedValueOnce(null);

    const res = await request(app).get('/orders/ord-3');
    expect(res.status).toBe(200);
    expect(res.body.order.rider_lat).toBeUndefined();
  });
});
