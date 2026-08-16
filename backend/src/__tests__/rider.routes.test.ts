/**
 * HTTP-layer tests for /rider routes.
 * Covers: documents, apply, application-status, location ping.
 */

import express from 'express';
import request from 'supertest';
import { query } from '../db';
import { redis } from '../redis';

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

beforeEach(() => {
  jest.clearAllMocks();
  (redis.get as jest.Mock).mockResolvedValue(null);
  (redis.set as jest.Mock).mockResolvedValue('OK');
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
