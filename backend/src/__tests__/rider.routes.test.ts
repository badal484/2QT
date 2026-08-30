/**
 * HTTP-layer tests for /rider routes.
 * Covers: documents, apply, application-status, location ping.
 */

import express from 'express';
import request from 'supertest';
import { query, withTransaction } from '../db';
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
const mockWithTransaction = withTransaction as jest.Mock;
const mockAuthenticate = authenticate as jest.Mock;
const defaultAuthenticate = mockAuthenticate.getMockImplementation();

function actingAs(user: { userId: string; role: string; kitchenId: string | null; zoneId: string | null; restaurantId: string | null; tenantRestaurantId?: string | null }) {
  mockAuthenticate.mockImplementationOnce((req: any, _res: any, next: any) => {
    req.user = { tenantRestaurantId: null, ...user, jti: 'jti-test' };
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

// ── Phase 6: rider order-ownership audit — closing test-coverage gaps ────────────────────────
// Phase 6's audit found every rider order-touching endpoint already correctly scoped by
// rider_id = req.user.userId (server-derived) in its SQL WHERE clause — no new authorization
// code was needed. These tests close a pre-existing gap: none of the endpoints below had any
// test coverage at all before this phase, despite already being correctly written. Locking in
// the current, correct behavior here guards against a future regression re-introducing the
// exact class of IDOR fixed in Phase 2 (PATCH /orders/:id/status).

describe('POST /rider/orders/:id/claim — Phase 6 ownership audit', () => {
  let clientMock: any;
  beforeEach(() => {
    clientMock = { query: jest.fn() };
    mockWithTransaction.mockImplementation(async (cb: any) => cb(clientMock));
  });

  it('allows a verified rider to claim an unassigned order', async () => {
    actingAs({ userId: 'rider-1', role: 'rider', kitchenId: null, zoneId: 'zone-1', restaurantId: null });
    clientMock.query
      .mockResolvedValueOnce({ rows: [] }) // active orders count
      .mockResolvedValueOnce({ rows: [{ is_verified: true }] }) // rider verified
      .mockResolvedValueOnce({ rowCount: 1 }) // UPDATE orders ... rider_id IS NULL
      .mockResolvedValueOnce({ rows: [] }); // legacy current_order_id clear
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // rider_order_events insert
      .mockResolvedValueOnce({ rows: [{ customer_id: 'cust-1', status: 'preparing', rider_name: 'Rider One', rider_phone: '919876543210' }] });

    const res = await request(app).post('/rider/orders/ord-1/claim');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const updateCall = clientMock.query.mock.calls[2];
    expect(updateCall[0]).toContain('rider_id IS NULL');
    expect(updateCall[1]).toEqual(['rider-1', 'ord-1']);
  });

  it("cannot claim an order already assigned to a different rider (rider_id IS NULL guard fails)", async () => {
    actingAs({ userId: 'rider-2', role: 'rider', kitchenId: null, zoneId: 'zone-1', restaurantId: null });
    clientMock.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ is_verified: true }] })
      .mockResolvedValueOnce({ rowCount: 0 }); // already claimed by someone else — 0 rows updated

    const res = await request(app).post('/rider/orders/ord-1/claim');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('CLAIM_FAILED');
  });

  it('ignores client-supplied restaurantId/kitchenId/zoneId — the claim is scoped only by the caller\'s own userId', async () => {
    actingAs({ userId: 'rider-1', role: 'rider', kitchenId: null, zoneId: 'zone-1', restaurantId: null });
    clientMock.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ is_verified: true }] })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rows: [] });
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ customer_id: 'cust-1', status: 'preparing', rider_name: 'Rider One', rider_phone: '919876543210' }] });

    const res = await request(app)
      .post('/rider/orders/ord-1/claim')
      .send({ restaurantId: 'restaurant-B', tenantRestaurantId: 'restaurant-B', kitchenId: 'kitchen-B', zoneId: 'zone-B' })
      .set('x-restaurant-id', 'restaurant-B')
      .set('x-kitchen-id', 'kitchen-B')
      .set('x-zone-id', 'zone-B');

    expect(res.status).toBe(200);
    const updateCall = clientMock.query.mock.calls[2];
    expect(updateCall[1]).toEqual(['rider-1', 'ord-1']); // server-derived userId only, spoofed fields never read
  });
});

describe('POST /rider/orders/:id/unclaim — Phase 6 ownership audit', () => {
  let clientMock: any;
  beforeEach(() => {
    clientMock = { query: jest.fn() };
    mockWithTransaction.mockImplementation(async (cb: any) => cb(clientMock));
  });

  it("cannot unclaim another rider's order (WHERE rider_id = caller finds nothing)", async () => {
    actingAs({ userId: 'rider-2', role: 'rider', kitchenId: null, zoneId: 'zone-1', restaurantId: null });
    clientMock.query.mockResolvedValueOnce({ rows: [] }); // SELECT ... WHERE id=$1 AND rider_id=$2 → no match

    const res = await request(app).post('/rider/orders/ord-1/unclaim');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('UNCLAIM_FAILED');

    const selectCall = clientMock.query.mock.calls[0];
    expect(selectCall[0]).toContain('rider_id = $2');
    expect(selectCall[1]).toEqual(['ord-1', 'rider-2']);
  });

  it('allows a rider to unclaim their own order', async () => {
    actingAs({ userId: 'rider-1', role: 'rider', kitchenId: null, zoneId: 'zone-1', restaurantId: null });
    clientMock.query
      .mockResolvedValueOnce({ rows: [{ kitchen_id: 'kitchen-A', customer_id: 'cust-1' }] })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [] }); // rider_order_events insert

    const res = await request(app).post('/rider/orders/ord-1/unclaim');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe.each([
  ['customer-unreachable', { action: 'retry' }],
  ['report-issue', { issueType: 'traffic' }],
  ['arrived-at-kitchen', undefined],
])('POST /rider/orders/:id/%s — Phase 6 ownership audit', (endpoint, body) => {
  it(`denies access to another rider's order`, async () => {
    actingAs({ userId: 'rider-2', role: 'rider', kitchenId: null, zoneId: 'zone-1', restaurantId: null });
    mockQuery.mockResolvedValueOnce({ rows: [] }); // WHERE ... AND rider_id = $2 → no match for this caller

    const res = await request(app).post(`/rider/orders/ord-1/${endpoint}`).send(body || {});
    expect([400, 404]).toContain(res.status);

    const call = mockQuery.mock.calls[0];
    expect(call[0]).toMatch(/rider_id\s*=\s*\$2/);
    expect(call[1]).toEqual(['ord-1', 'rider-2']);
  });
});

describe('POST /rider/orders/:orderId/upi-payment-link — Phase 6 ownership audit', () => {
  it("denies access to another rider's order", async () => {
    actingAs({ userId: 'rider-2', role: 'rider', kitchenId: null, zoneId: 'zone-1', restaurantId: null });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post('/rider/orders/ord-1/upi-payment-link');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('ORDER_NOT_FOUND');

    const call = mockQuery.mock.calls[0];
    expect(call[0]).toContain('rider_id = $2');
    expect(call[1]).toEqual(['ord-1', 'rider-2']);
  });
});

describe('GET /rider/orders/:id/earnings-breakdown — Phase 6 ownership audit', () => {
  it("denies access to another rider's delivered order", async () => {
    actingAs({ userId: 'rider-2', role: 'rider', kitchenId: null, zoneId: 'zone-1', restaurantId: null });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/rider/orders/ord-1/earnings-breakdown');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('ORDER_NOT_FOUND');

    const call = mockQuery.mock.calls[0];
    expect(call[0]).toContain('o.rider_id = $2');
    expect(call[1]).toEqual(['ord-1', 'rider-2']);
  });
});

describe('rider_captain — Phase 6: functional parity with rider, no elevated capability', () => {
  it('is scoped by the exact same rider_id = callerId rule as rider on order status updates', async () => {
    actingAs({ userId: 'captain-1', role: 'rider_captain', kitchenId: null, zoneId: 'zone-1', restaurantId: null });
    mockQuery.mockResolvedValueOnce({ rows: [] }); // no order matches rider_id = captain-1

    const res = await request(app).patch('/rider/orders/ord-1/status').send({ status: 'out_for_delivery' });
    expect(res.status).toBe(404);

    const call = mockQuery.mock.calls[0];
    // isAdmin resolves false for rider_captain — identical to a plain rider, no special-casing
    expect(call[1]).toEqual(['out_for_delivery', 'ord-1', 'ord-1', 'captain-1', '2QT-ord-1', false]);
  });

  it('cannot access another rider\'s (or another captain\'s) order — no cross-rider visibility power', async () => {
    actingAs({ userId: 'captain-1', role: 'rider_captain', kitchenId: null, zoneId: 'zone-1', restaurantId: null });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post('/rider/orders/ord-1/upi-payment-link');
    expect(res.status).toBe(404);
    expect(mockQuery.mock.calls[0][1]).toEqual(['ord-1', 'captain-1']);
  });
});

describe('Rider identity — Phase 6: no restaurant tenant scoping exists for riders (by design)', () => {
  it('a rider with no tenantRestaurantId (the current, universal state for all riders) is not blocked from normal rider operations', async () => {
    // Confirms the Phase 3 backfill's deliberate exclusion of rider/rider_captain (see
    // migrations/148_backfill_restaurant_tenancy.sql) has no negative effect on rider
    // functionality — tenantRestaurantId simply plays no role anywhere in rider.ts.
    actingAs({ userId: 'rider-1', role: 'rider', kitchenId: null, zoneId: 'zone-1', restaurantId: null, tenantRestaurantId: null });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'ord-9', display_id: '2QT-100009', customer_id: 'cust-1', kitchen_id: 'kitchen-1', status: 'preparing', delivery_otp: '111111' }],
    });

    const res = await request(app).patch('/rider/orders/ord-9/status').send({ status: 'preparing' });
    expect(res.status).toBe(200);
  });
});

describe('GET /rider/shift-summary — SaaS store driver metrics', () => {
  it('returns shift deliveries count, total distance km, and physical cash in hand', async () => {
    actingAs({ userId: 'rider-saas-1', role: 'rider', kitchenId: null, zoneId: 'zone-1', restaurantId: 'rest-123', tenantRestaurantId: 'rest-123' });
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'rider-saas-1', name: 'Alok Driver', phone: '918888888888', restaurant_id: 'rest-123', restaurant_name: 'Royal Spice' }] })
      .mockResolvedValueOnce({ rows: [{ phone: '919999999999' }] }) // store manager phone
      .mockResolvedValueOnce({
        rows: [
          { id: 'o-1', display_id: '2QT-101', status: 'delivered', total_amount_paise: 42000, payment_method: 'cod', updated_at: new Date() },
          { id: 'o-2', display_id: '2QT-102', status: 'delivered', total_amount_paise: 35000, payment_method: 'prepaid', updated_at: new Date() },
        ],
      });

    const res = await request(app).get('/rider/shift-summary');
    expect(res.status).toBe(200);
    expect(res.body.restaurantName).toBe('Royal Spice');
    expect(res.body.deliveriesCount).toBe(2);
    expect(res.body.cashInHandPaise).toBe(42000); // Only COD order collected
    expect(res.body.storePhone).toBe('919999999999');
  });
});

