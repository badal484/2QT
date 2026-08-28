/**
 * HTTP-layer tests for /rider routes.
 * Covers: documents, apply, application-status, location ping.
 */

import express from 'express';
import request from 'supertest';
import { query } from '../db';
import { redis } from '../redis';
import { authenticate } from '../middleware/auth';

jest.mock('razorpay', () =>
  jest.fn().mockImplementation(() => ({
    orders: { create: jest.fn().mockResolvedValue({ id: 'rzp_order_test', amount: 10000 }) },
  }))
);
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
jest.mock('../services/notification.service', () => ({
  NotificationService: { send: jest.fn().mockResolvedValue(undefined), sendToUser: jest.fn() },
}));
jest.mock('../services/trigger.service', () => ({
  scheduleTriggerSend: jest.fn().mockResolvedValue(undefined),
  cancelTriggerJobs: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../services/autoAssign', () => ({
  unassignAndReassign: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../utils/appSettings', () => ({
  getAppSetting: jest.fn().mockResolvedValue(null),
  getAppSettingInt: jest.fn().mockResolvedValue(0),
}));
jest.mock('../jobs/queues', () => ({
  invoicesQueue: { add: jest.fn().mockResolvedValue(undefined) },
  notificationQueue: { add: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('../routes/support', () => ({
  PRIORITY_SLA: { general: 48, delivery: 4 },
}));
jest.mock('../config/constants', () => ({
  TWO_QT: { SUBSCRIPTION: { PLANS: [] }, MAX_DELIVERY_KM: 10 },
}));

import riderRouter from '../routes/rider';

const app = express();
app.use(express.json());
app.use('/rider', riderRouter);

const mockQuery = query as jest.Mock;
const mockAuthenticate = authenticate as jest.Mock;
const defaultAuthenticate = mockAuthenticate.getMockImplementation();

function actingAs(user: { userId: string; role: string; kitchenId: string | null; zoneId: string | null; restaurantId: string | null }) {
  mockAuthenticate.mockImplementationOnce((req: any, _res: any, next: any) => {
    req.user = { ...user, jti: 'jti-test' };
    next();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  (redis.get as jest.Mock).mockResolvedValue(null);
  (redis.set as jest.Mock).mockResolvedValue('OK');
  if (defaultAuthenticate) mockAuthenticate.mockImplementation(defaultAuthenticate);
});

// ── GET /rider/documents ──────────────────────────────────────────────────────

describe('GET /rider/documents', () => {
  it('returns null when no application exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/rider/documents');
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it('returns the rider application record', async () => {
    const application = { id: 'app-1', user_id: 'user-test-1', vehicle_type: 'bike', status: 'pending' };
    mockQuery.mockResolvedValueOnce({ rows: [application] });

    const res = await request(app).get('/rider/documents');
    expect(res.status).toBe(200);
    expect(res.body.vehicle_type).toBe('bike');
    expect(res.body.status).toBe('pending');
  });
});

// ── PATCH /rider/documents ────────────────────────────────────────────────────

describe('PATCH /rider/documents', () => {
  it('returns 400 when vehicleType is missing', async () => {
    const res = await request(app).patch('/rider/documents').send({ profilePhotoUrl: 'http://img.example.com/photo.jpg' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('MISSING_FIELDS');
  });

  it('returns 400 when profilePhotoUrl is missing', async () => {
    const res = await request(app).patch('/rider/documents').send({ vehicleType: 'bike' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('MISSING_FIELDS');
  });

  it('upserts application and returns the record', async () => {
    const upserted = { id: 'app-1', user_id: 'user-test-1', vehicle_type: 'bike', status: 'pending' };
    mockQuery
      .mockResolvedValueOnce({ rows: [] })      // UPDATE users photo_url
      .mockResolvedValueOnce({ rows: [upserted] }); // INSERT ON CONFLICT

    const res = await request(app).patch('/rider/documents').send({
      vehicleType: 'bike',
      licenseNumber: 'KA01X1234',
      profilePhotoUrl: 'http://img.example.com/photo.jpg',
    });
    expect(res.status).toBe(200);
    expect(res.body.vehicle_type).toBe('bike');
  });
});

// ── POST /rider/apply ─────────────────────────────────────────────────────────

describe('POST /rider/apply', () => {
  it('returns 400 when already applied', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ status: 'pending' }] }); // existing application

    const res = await request(app).post('/rider/apply').send({ vehicleType: 'bike', licenseNumber: 'KA01X1234' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('ALREADY_APPLIED');
  });

  it('creates application and returns success', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })   // no existing application
      .mockResolvedValueOnce({ rows: [] });  // INSERT

    const res = await request(app).post('/rider/apply').send({ vehicleType: 'bike', licenseNumber: 'KA01X1234' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('pending');
  });
});

// ── GET /rider/application-status ────────────────────────────────────────────

describe('GET /rider/application-status', () => {
  it('returns null application when none exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/rider/application-status');
    expect(res.status).toBe(200);
    expect(res.body.application).toBeNull();
  });

  it('returns application status', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'app-1', status: 'approved' }] });

    const res = await request(app).get('/rider/application-status');
    expect(res.status).toBe(200);
    expect(res.body.application.status).toBe('approved');
  });
});

// ── PATCH /rider/orders/:id/status ────────────────────────────────────────────
// Security fix (Phase 2, Critical #2): previously had no ownership check and silently
// self-assigned any unassigned order via COALESCE(rider_id, riderId) — any rider could alter
// the status of any order platform-wide.

describe('PATCH /rider/orders/:id/status', () => {
  it('returns 404 when the order is not assigned to the calling rider', async () => {
    actingAs({ userId: 'rider-1', role: 'rider', kitchenId: null, zoneId: 'zone-1', restaurantId: null });
    mockQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE ... AND rider_id = $4 matches nothing

    const res = await request(app).patch('/rider/orders/ord-1/status').send({ status: 'out_for_delivery' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('ORDER_NOT_FOUND');

    // Confirm the query is now scoped by rider_id, not just the order id/display_id
    const call = mockQuery.mock.calls[0];
    expect(call[0]).toContain('rider_id = $4');
    expect(call[1]).toEqual(['out_for_delivery', 'ord-1', 'ord-1', 'rider-1', '2QT-ord-1', false]);
  });

  it('updates status when the order is assigned to the calling rider', async () => {
    actingAs({ userId: 'rider-1', role: 'rider', kitchenId: null, zoneId: 'zone-1', restaurantId: null });
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'ord-2', display_id: '2QT-100002', customer_id: 'cust-1', kitchen_id: 'kitchen-1', status: 'out_for_delivery', delivery_otp: '123456' }],
      })
      .mockResolvedValueOnce({ rows: [{ name: 'Rider One' }] }); // rider name lookup for the out_for_delivery notification

    const res = await request(app).patch('/rider/orders/ord-2/status').send({ status: 'out_for_delivery' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('allows super_admin to update any order\'s status unscoped', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'ord-3', display_id: '2QT-100003', customer_id: 'cust-1', kitchen_id: 'kitchen-1', status: 'preparing', delivery_otp: '654321' }],
    });

    const res = await request(app).patch('/rider/orders/ord-3/status').send({ status: 'preparing' });
    expect(res.status).toBe(200);

    const call = mockQuery.mock.calls[0];
    expect(call[1]).toEqual(['preparing', 'ord-3', 'ord-3', 'admin-1', '2QT-ord-3', true]);
  });
});
