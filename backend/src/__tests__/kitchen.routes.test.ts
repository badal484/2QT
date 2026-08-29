/**
 * HTTP-layer tests for /kitchen routes.
 * Covers the Phase 2 security fixes: getKitchenId() no longer honors a client-supplied
 * override for kitchen-scoped roles, and every mutation that was previously reachable by raw
 * ID (claim, packed, availability toggle, batch complete, prep-list toggle) is now scoped to
 * the caller's own kitchen/zone. Platform-admin roles (super_admin) remain unrestricted.
 */

import express from 'express';
import request from 'supertest';
import { query } from '../db';
import { authenticate } from '../middleware/auth';

jest.mock('../services/notification.service', () => ({
  NotificationService: { send: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('../services/autoAssign', () => ({
  autoAssignOrder: jest.fn().mockResolvedValue(undefined),
  unassignAndReassign: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../jobs/queues', () => ({
  notificationsQueue: { add: jest.fn().mockResolvedValue(undefined) },
  invoicesQueue: { add: jest.fn().mockResolvedValue(undefined) },
}));

import kitchenRouter from '../routes/kitchen';

const app = express();
app.use(express.json());
app.use('/kitchen', kitchenRouter);

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
  if (defaultAuthenticate) mockAuthenticate.mockImplementation(defaultAuthenticate);
});

// ── GET /kitchen/debug-dispatch ───────────────────────────────────────────────
// Security fix (Phase 2, Critical #4): this endpoint had no auth at all and leaked order +
// rider PII to anonymous callers. It has been removed entirely.

describe('GET /kitchen/debug-dispatch', () => {
  it('no longer exists', async () => {
    const res = await request(app).get('/kitchen/debug-dispatch');
    expect(res.status).toBe(404);
  });
});

// ── getKitchenId() override protection (exercised via PATCH /kitchen/status) ──
// Security fix (Phase 2, Critical #3).

describe('PATCH /kitchen/status — kitchen scoping', () => {
  it('ignores a client-supplied kitchen_id override for a chef', async () => {
    actingAs({ userId: 'chef-1', role: 'chef', kitchenId: 'kitchen-A', zoneId: 'zone-A', restaurantId: null });
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // UPDATE kitchens
      .mockResolvedValueOnce({ rows: [{ zone_id: 'zone-A' }] }); // getZoneId

    const res = await request(app).patch('/kitchen/status?kitchen_id=kitchen-B').send({ paused: true, reason: 'test' });
    expect(res.status).toBe(200);

    const updateCall = mockQuery.mock.calls[0];
    expect(updateCall[1]).toEqual([true, 'test', null, 'kitchen-A']);
  });

  it('honors the kitchen_id override for a platform admin', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ zone_id: 'zone-X' }] });

    const res = await request(app).patch('/kitchen/status?kitchen_id=kitchen-X').send({ paused: false });
    expect(res.status).toBe(200);

    const updateCall = mockQuery.mock.calls[0];
    expect(updateCall[1]).toEqual([false, null, null, 'kitchen-X']);
  });

  it('also honors the x-kitchen-id header for a platform admin', async () => {
    actingAs({ userId: 'admin-1', role: 'admin', kitchenId: null, zoneId: null, restaurantId: null });
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ zone_id: 'zone-Y' }] });

    const res = await request(app).patch('/kitchen/status').set('x-kitchen-id', 'kitchen-Y').send({ paused: false });
    expect(res.status).toBe(200);

    const updateCall = mockQuery.mock.calls[0];
    expect(updateCall[1]).toEqual([false, null, null, 'kitchen-Y']);
  });
});

// ── POST /kitchen/orders/:id/claim ────────────────────────────────────────────
// Security fix (Phase 2, High #5).

describe('POST /kitchen/orders/:id/claim', () => {
  it("blocks claiming an order that belongs to a different kitchen", async () => {
    actingAs({ userId: 'chef-1', role: 'chef', kitchenId: 'kitchen-A', zoneId: 'zone-A', restaurantId: null });
    mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const res = await request(app).post('/kitchen/orders/ord-1/claim');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('ORDER_ALREADY_CLAIMED');

    const call = mockQuery.mock.calls[0];
    expect(call[0]).toContain('kitchen_id = $3');
    expect(call[1]).toEqual(['chef-1', 'ord-1', 'kitchen-A']);
  });

  it('allows a chef to claim an order in their own kitchen', async () => {
    actingAs({ userId: 'chef-1', role: 'chef', kitchenId: 'kitchen-A', zoneId: 'zone-A', restaurantId: null });
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ kitchen_id: 'kitchen-A', customer_id: 'cust-1', display_id: '2QT-100001' }],
    });

    const res = await request(app).post('/kitchen/orders/ord-1/claim');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('allows super_admin to claim any order unscoped', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ kitchen_id: 'kitchen-Z', customer_id: 'cust-1', display_id: '2QT-100002' }],
    });

    const res = await request(app).post('/kitchen/orders/ord-2/claim');
    expect(res.status).toBe(200);

    const call = mockQuery.mock.calls[0];
    expect(call[1]).toEqual(['admin-1', 'ord-2', null]);
  });
});

// ── POST /kitchen/orders/:id/packed ───────────────────────────────────────────
// Security fix (Phase 2, High #5).

describe('POST /kitchen/orders/:id/packed', () => {
  it("blocks marking another kitchen's order as packed", async () => {
    actingAs({ userId: 'packer-1', role: 'packer', kitchenId: 'kitchen-A', zoneId: 'zone-A', restaurantId: null });
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // primary UPDATE scoped to kitchen-A finds nothing
      .mockResolvedValueOnce({ rows: [] }); // fallback SELECT, also scoped, finds nothing

    const res = await request(app).post('/kitchen/orders/ord-1/packed');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('ORDER_NOT_FOUND');

    const updateCall = mockQuery.mock.calls[0];
    expect(updateCall[0]).toContain('kitchen_id = $3');
    expect(updateCall[1]).toEqual(['packer-1', 'ord-1', 'kitchen-A']);
  });

  it("allows a packer to mark their own kitchen's order as packed", async () => {
    actingAs({ userId: 'packer-1', role: 'packer', kitchenId: 'kitchen-A', zoneId: 'zone-A', restaurantId: null });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'ord-2', display_id: '2QT-100002', customer_id: 'cust-1', kitchen_id: 'kitchen-A', zone_id: 'zone-A' }],
    });

    const res = await request(app).post('/kitchen/orders/ord-2/packed');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ── PATCH /kitchen/menu/:itemId/availability ──────────────────────────────────
// Security fix (Phase 2, High #5).

describe('PATCH /kitchen/menu/:itemId/availability', () => {
  it("blocks toggling an item outside the chef's own zone", async () => {
    actingAs({ userId: 'chef-1', role: 'chef', kitchenId: 'kitchen-A', zoneId: 'zone-A', restaurantId: null });
    mockQuery
      .mockResolvedValueOnce({ rows: [{ zone_id: 'zone-A' }] }) // getZoneId
      .mockResolvedValueOnce({ rows: [] }); // UPDATE ... AND zone_id = $3 finds nothing

    const res = await request(app).patch('/kitchen/menu/item-1/availability').send({ available: false });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });

  it("allows a chef to toggle an item in their own zone", async () => {
    actingAs({ userId: 'chef-1', role: 'chef', kitchenId: 'kitchen-A', zoneId: 'zone-A', restaurantId: null });
    mockQuery
      .mockResolvedValueOnce({ rows: [{ zone_id: 'zone-A' }] })
      .mockResolvedValueOnce({ rows: [{ zone_id: 'zone-A' }] });

    const res = await request(app).patch('/kitchen/menu/item-1/availability').send({ available: false });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ── POST /kitchen/batches/:id/complete ────────────────────────────────────────
// Security fix (Phase 2, High #5).

describe('POST /kitchen/batches/:id/complete', () => {
  it("blocks completing another kitchen's batch", async () => {
    actingAs({ userId: 'chef-1', role: 'chef', kitchenId: 'kitchen-A', zoneId: 'zone-A', restaurantId: null });
    mockQuery.mockResolvedValueOnce({ rowCount: 0 });

    const res = await request(app).post('/kitchen/batches/batch-1/complete');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');

    const call = mockQuery.mock.calls[0];
    expect(call[0]).toContain('AND kitchen_id = $2');
    expect(call[1]).toEqual(['batch-1', 'kitchen-A']);
  });
});

// ── POST /kitchen/prep-list/:id/toggle ────────────────────────────────────────
// Security fix (Phase 2, High #5).

describe('POST /kitchen/prep-list/:id/toggle', () => {
  it("blocks toggling another kitchen's prep task", async () => {
    actingAs({ userId: 'chef-1', role: 'chef', kitchenId: 'kitchen-A', zoneId: 'zone-A', restaurantId: null });
    mockQuery.mockResolvedValueOnce({ rowCount: 0 });

    const res = await request(app).post('/kitchen/prep-list/task-1/toggle');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');

    const call = mockQuery.mock.calls[0];
    expect(call[0]).toContain('AND kitchen_id = $2');
    expect(call[1]).toEqual(['task-1', 'kitchen-A']);
  });
});

// ── GET /kitchen/riders/live ──────────────────────────────────────────────────
// Security fix (Phase 2, High #7): previously returned every online rider on the platform.

describe('GET /kitchen/riders/live', () => {
  it("scopes visible riders to the chef's own zone", async () => {
    actingAs({ userId: 'chef-1', role: 'chef', kitchenId: 'kitchen-A', zoneId: 'zone-A', restaurantId: null });
    mockQuery
      .mockResolvedValueOnce({ rows: [{ zone_id: 'zone-A' }] }) // getZoneId
      .mockResolvedValueOnce({ rows: [] }); // riders query

    const res = await request(app).get('/kitchen/riders/live');
    expect(res.status).toBe(200);

    const ridersCall = mockQuery.mock.calls[1];
    expect(ridersCall[1]).toEqual(['kitchen-A', false, 'zone-A']);
  });

  it('does not scope riders for a platform admin', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });
    mockQuery.mockResolvedValueOnce({ rows: [] }); // riders query only — no getZoneId call for admins

    const res = await request(app).get('/kitchen/riders/live?kitchen_id=kitchen-X');
    expect(res.status).toBe(200);

    const ridersCall = mockQuery.mock.calls[0];
    expect(ridersCall[1]).toEqual(['kitchen-X', true, null]);
  });
});

// ── POST /kitchen/orders/complete-all-live ────────────────────────────────────
// Security fix (Phase 2.1, Critical): previously updated EVERY non-terminal order on the whole
// platform with no ownership check — the duplicate of /admin/orders/complete-all-live mounted
// under /kitchen, reachable by chef/kitchen_manager/partner_kitchen with full platform-wide
// power despite having zero legitimate frontend/mobile callers.

describe('POST /kitchen/orders/complete-all-live', () => {
  it("scopes completion to a chef's own kitchen", async () => {
    actingAs({ userId: 'chef-1', role: 'chef', kitchenId: 'kitchen-A', zoneId: 'zone-A', restaurantId: null });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'ord-1', display_id: '2QT-100001' }] });

    const res = await request(app).post('/kitchen/orders/complete-all-live');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);

    const call = mockQuery.mock.calls[0];
    expect(call[0]).toContain('kitchen_id = $1');
    expect(call[0]).toContain("NOT IN ('delivered', 'cancelled')"); // already-delivered/cancelled orders stay untouched
    expect(call[1]).toEqual(['kitchen-A']);
  });

  it('does not complete another kitchen\'s orders for a kitchen_manager', async () => {
    actingAs({ userId: 'km-1', role: 'kitchen_manager', kitchenId: 'kitchen-B', zoneId: 'zone-B', restaurantId: null });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post('/kitchen/orders/complete-all-live');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
    expect(mockQuery.mock.calls[0][1]).toEqual(['kitchen-B']);
  });

  it('ignores a client-supplied kitchen_id override for a non-admin role', async () => {
    actingAs({ userId: 'partner-1', role: 'partner_kitchen', kitchenId: 'kitchen-A', zoneId: 'zone-A', restaurantId: null });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post('/kitchen/orders/complete-all-live?kitchen_id=kitchen-Z');
    expect(res.status).toBe(200);
    expect(mockQuery.mock.calls[0][1]).toEqual(['kitchen-A']); // override ignored, own kitchen used
  });

  it('returns 400 when a kitchen-role account has no kitchen assigned', async () => {
    actingAs({ userId: 'chef-1', role: 'chef', kitchenId: null, zoneId: null, restaurantId: null });

    const res = await request(app).post('/kitchen/orders/complete-all-live');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('KITCHEN_NOT_ASSIGNED');
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('retains platform-wide completion for super_admin', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'ord-1', display_id: '2QT-100001' }, { id: 'ord-2', display_id: '2QT-100002' }],
    });

    const res = await request(app).post('/kitchen/orders/complete-all-live');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(mockQuery.mock.calls[0][1]).toEqual([null]);
  });
});

// ── GET /kitchen/orders/unassigned ────────────────────────────────────────────
// Security fix (Phase 2, High #7): previously returned every unassigned order on the platform,
// including customer name/phone/GPS, to any kitchen-role account.

describe('GET /kitchen/orders/unassigned', () => {
  it("scopes results to the chef's own kitchen", async () => {
    actingAs({ userId: 'chef-1', role: 'chef', kitchenId: 'kitchen-A', zoneId: 'zone-A', restaurantId: null });
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // orders query
      .mockResolvedValueOnce({ rows: [] }); // max_batch_size setting lookup

    const res = await request(app).get('/kitchen/orders/unassigned');
    expect(res.status).toBe(200);

    const call = mockQuery.mock.calls[0];
    expect(call[1]).toEqual([false, 'kitchen-A']);
  });

  it('does not scope results for a platform admin', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/kitchen/orders/unassigned');
    expect(res.status).toBe(200);

    const call = mockQuery.mock.calls[0];
    expect(call[1]).toEqual([true, null]);
  });
});

// is_partner distinguishes the commission-based Partners program from a SaaS-onboarded kitchen
// that merely happens to also use the partner_kitchen staff role — kitchen-portal (the frontend)
// uses this field to decide whether to show the commission dashboard at all.
describe('GET /kitchen/my-earnings — includes is_partner so the frontend can tell SaaS kitchens apart', () => {
  it("returns the kitchen's is_partner flag alongside the earnings figures", async () => {
    actingAs({ userId: 'partner-1', role: 'partner_kitchen', kitchenId: 'kitchen-A', zoneId: null, restaurantId: null });
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'kitchen-A', name: 'iiii', commission_rate: '0.20', upi_id: null, partner_status: 'none', is_partner: false }] })
      .mockResolvedValueOnce({ rows: [{ net: 0, commission: 0, gross: 0, orders: 0 }] })
      .mockResolvedValueOnce({ rows: [{ net: 0, commission: 0, gross: 0, orders: 0 }] })
      .mockResolvedValueOnce({ rows: [{ net: 0, commission: 0, gross: 0, orders: 0 }] })
      .mockResolvedValueOnce({ rows: [{ net: 0, commission: 0, gross: 0, orders: 0 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/kitchen/my-earnings');

    expect(res.status).toBe(200);
    expect(res.body.kitchen.is_partner).toBe(false);
    expect(mockQuery.mock.calls[0][0]).toContain('is_partner');
  });
});
