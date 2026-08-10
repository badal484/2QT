/**
 * HTTP-layer tests for /admin routes.
 * Covers: dashboard stats, feedback, growth stats, Zod schema validation.
 */

import express from 'express';
import request from 'supertest';
import { query } from '../db';

jest.mock('@imagekit/nodejs', () =>
  jest.fn().mockImplementation(() => ({
    upload: jest.fn().mockResolvedValue({ url: 'https://ik.imagekit.io/test/img.jpg' }),
  }))
);
jest.mock('multer', () => {
  const m = () => ({
    array: () => (_req: any, _res: any, next: any) => next(),
    single: () => (_req: any, _res: any, next: any) => next(),
    none: () => (_req: any, _res: any, next: any) => next(),
  });
  m.memoryStorage = () => ({});
  return m;
});
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$2b$10$hashedpassword'),
  compare: jest.fn().mockResolvedValue(true),
}));
jest.mock('../services/activity.service', () => ({
  ActivityLogService: { getLogs: jest.fn().mockResolvedValue([]) },
}));
jest.mock('../services/notification.service', () => ({
  NotificationService: { send: jest.fn().mockResolvedValue(undefined), sendToUser: jest.fn() },
}));
jest.mock('../services/refund.service', () => ({
  createPendingRefund: jest.fn().mockResolvedValue(undefined),
  processWalletRefund: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../utils/logger', () => ({
  logSystemEvent: jest.fn().mockResolvedValue(undefined),
}));

import adminRouter from '../routes/admin';

const app = express();
app.use(express.json());
app.use('/admin', adminRouter);

const mockQuery = query as jest.Mock;

function parallelQueryMocks(results: any[]) {
  results.forEach(r => mockQuery.mockResolvedValueOnce(r));
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── GET /admin/activity-logs ──────────────────────────────────────────────────

describe('GET /admin/activity-logs', () => {
  it('returns empty logs array', async () => {
    const res = await request(app).get('/admin/activity-logs');
    expect(res.status).toBe(200);
    expect(res.body.logs).toEqual([]);
  });
});

// ── GET /admin/dashboard ──────────────────────────────────────────────────────

describe('GET /admin/dashboard', () => {
  it('returns dashboard stats', async () => {
    parallelQueryMocks([
      { rows: [{ count: '5' }] },             // active orders
      { rows: [{ sum: '150000' }] },           // today revenue
      { rows: [{ count: '3' }] },              // riders online
      { rows: [{ count: '2' }] },              // low stock
      { rows: [{ count: '1200' }] },           // total customers
      { rows: [{ day: '2024-01-01', label: 'Mon', revenue_paise: '50000' }] }, // weekly rev
    ]);

    const res = await request(app).get('/admin/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.activeOrders).toBe(5);
    expect(res.body.todayRevenuePaise).toBe(150000);
    expect(res.body.ridersOnline).toBe(3);
    expect(res.body.totalCustomers).toBe(1200);
    expect(res.body.weeklyRevenue).toHaveLength(1);
    expect(res.body.weeklyRevenue[0].label).toBe('Mon');
  });

  it('handles missing revenue as 0', async () => {
    parallelQueryMocks([
      { rows: [{ count: '0' }] },
      { rows: [{ sum: null }] },
      { rows: [{ count: '0' }] },
      { rows: [{ count: '0' }] },
      { rows: [{ count: '0' }] },
      { rows: [] },
    ]);

    const res = await request(app).get('/admin/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.todayRevenuePaise).toBe(0);
  });
});

// ── GET /admin/feedback ───────────────────────────────────────────────────────

describe('GET /admin/feedback', () => {
  it('returns aggregate feedback stats and recent entries', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ avg_food: '4.5', avg_delivery: '4.2', total: '100' }] })
      .mockResolvedValueOnce({ rows: [{ rating: 5, delivery_rating: 4, comment: 'Great!', created_at: '2024-01-01' }] });

    const res = await request(app).get('/admin/feedback');
    expect(res.status).toBe(200);
    expect(res.body.averageRating).toBe('4.5');
    expect(res.body.averageDeliveryRating).toBe('4.2');
    expect(res.body.totalCount).toBe(100);
    expect(res.body.feedbacks).toHaveLength(1);
  });

  it('returns 0.0 ratings when no feedback exists', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ avg_food: null, avg_delivery: null, total: '0' }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/admin/feedback');
    expect(res.status).toBe(200);
    expect(res.body.averageRating).toBe('0.0');
    expect(res.body.feedbacks).toEqual([]);
  });
});

// ── GET /admin/stats/growth ───────────────────────────────────────────────────

describe('GET /admin/stats/growth', () => {
  it('returns 30-day growth stats', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '42' }] })
      .mockResolvedValueOnce({ rows: [{ count: '150' }] })
      .mockResolvedValueOnce({ rows: [{ sum: '500000' }] });

    const res = await request(app).get('/admin/stats/growth');
    expect(res.status).toBe(200);
    expect(res.body.newUsers30d).toBe(42);
    expect(res.body.newOrders30d).toBe(150);
    expect(res.body.lifetimeRevenuePaise).toBe(500000);
  });
});

// ── GET /admin/orders/live ────────────────────────────────────────────────────

describe('GET /admin/orders/live', () => {
  it('returns live orders', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'ord-1', status: 'preparing', customer_name: 'Alice', rider_name: null }] }) // orders
      .mockResolvedValueOnce({ rows: [] }); // items for ord-1

    const res = await request(app).get('/admin/orders/live');
    expect(res.status).toBe(200);
    expect(res.body.orders).toHaveLength(1);
    expect(res.body.orders[0].status).toBe('preparing');
  });
});

// ── Zod schema validation ─────────────────────────────────────────────────────

describe('Admin Zod validation — menu items (POST /admin/menu)', () => {
  it('returns 400 VALIDATION_ERROR when name is missing', async () => {
    const body = {
      zone_id: '00000000-0000-0000-0000-000000000001',
      price_paise: 15000,
      category: 'Main',
    };
    const res = await request(app).post('/admin/menu').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when price_paise is zero or negative', async () => {
    const body = {
      name: 'Biryani',
      zone_id: '00000000-0000-0000-0000-000000000001',
      price_paise: -100,
      category: 'Main',
    };
    const res = await request(app).post('/admin/menu').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when zone_id is not a UUID', async () => {
    const body = {
      name: 'Biryani',
      zone_id: 'not-a-uuid',
      price_paise: 15000,
      category: 'Main',
    };
    const res = await request(app).post('/admin/menu').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });
});

describe('Admin Zod validation — kitchens', () => {
  it('returns 400 VALIDATION_ERROR when name is empty', async () => {
    const body = {
      name: '',
      zone_ids: ['00000000-0000-0000-0000-000000000001'],
    };
    const res = await request(app).post('/admin/kitchens').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when zone_ids is empty', async () => {
    const body = {
      name: 'Test Kitchen',
      zone_ids: [],
    };
    const res = await request(app).post('/admin/kitchens').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when pin is not 4 digits', async () => {
    const body = {
      name: 'Test Kitchen',
      zone_ids: ['00000000-0000-0000-0000-000000000001'],
      pin: '12',
    };
    const res = await request(app).post('/admin/kitchens').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });
});
