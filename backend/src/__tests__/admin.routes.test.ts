/**
 * HTTP-layer tests for /admin routes.
 * Covers: dashboard stats, feedback, growth stats, Zod schema validation.
 */

import express from 'express';
import request from 'supertest';
import { query, withTransaction } from '../db';
import { authenticate } from '../middleware/auth';

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
const mockWithTransaction = withTransaction as jest.Mock;
const mockAuthenticate = authenticate as jest.Mock;
const defaultAuthenticate = mockAuthenticate.getMockImplementation();

function parallelQueryMocks(results: any[]) {
  results.forEach(r => mockQuery.mockResolvedValueOnce(r));
}

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

// Phase 5: without this, every menu item created after Phase 3 would have a permanently NULL
// restaurant_id, making the new restaurant dashboard's menu view silently incomplete for any
// restaurant that adds items going forward.
describe('POST /admin/menu — Phase 5 restaurant_id population', () => {
  it("sets restaurant_id on the new item from the zone's assigned kitchen", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ kitchen_id: 'kitchen-A', restaurant_id: 'restaurant-A' }] }) // kitchen_zones JOIN kitchens
      .mockResolvedValueOnce({ rows: [{ id: 'item-1', zone_id: '00000000-0000-0000-0000-000000000001', name: 'Biryani' }] }) // INSERT
      .mockResolvedValueOnce({ rows: [] }); // SELECT id FROM zones (cache-bust loop)

    const res = await request(app).post('/admin/menu').send({
      name: 'Biryani',
      zone_id: '00000000-0000-0000-0000-000000000001',
      price_paise: 15000,
      category: 'Main',
    });

    expect(res.status).toBe(200);
    const insertCall = mockQuery.mock.calls[1];
    expect(insertCall[0]).toContain('restaurant_id');
    expect(insertCall[1][insertCall[1].length - 1]).toBe('restaurant-A');
  });

  it('sets restaurant_id to null (never throws) when the kitchen has no restaurant_id yet', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ kitchen_id: 'kitchen-A', restaurant_id: null }] })
      .mockResolvedValueOnce({ rows: [{ id: 'item-1', zone_id: '00000000-0000-0000-0000-000000000001', name: 'Biryani' }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post('/admin/menu').send({
      name: 'Biryani',
      zone_id: '00000000-0000-0000-0000-000000000001',
      price_paise: 15000,
      category: 'Main',
    });

    expect(res.status).toBe(200);
    const insertCall = mockQuery.mock.calls[1];
    expect(insertCall[1][insertCall[1].length - 1]).toBeNull();
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

// ── POST /admin/orders/complete-all-live ──────────────────────────────────────
// Security fix (Phase 2.1, Critical): previously updated EVERY non-terminal order on the whole
// platform with no ownership check — reachable directly by chef/kitchen_manager/partner_kitchen
// accounts even though the only UI caller (the admin panel button) is admin-only.

describe('POST /admin/orders/complete-all-live', () => {
  it("scopes completion to a chef's own kitchen — no other kitchen's orders are touched", async () => {
    actingAs({ userId: 'chef-1', role: 'chef', kitchenId: 'kitchen-A', zoneId: 'zone-A', restaurantId: null });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'ord-1', display_id: '2QT-100001' }] });

    const res = await request(app).post('/admin/orders/complete-all-live');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);

    const call = mockQuery.mock.calls[0];
    expect(call[0]).toContain('kitchen_id = $1');
    expect(call[0]).toContain("NOT IN ('delivered', 'cancelled')"); // already-delivered/cancelled orders stay untouched
    expect(call[1]).toEqual(['kitchen-A']);
  });

  it('does not let a kitchen_manager complete platform-wide orders — only their own kitchen', async () => {
    actingAs({ userId: 'km-1', role: 'kitchen_manager', kitchenId: 'kitchen-B', zoneId: 'zone-B', restaurantId: null });
    mockQuery.mockResolvedValueOnce({ rows: [] }); // no eligible orders for kitchen-B

    const res = await request(app).post('/admin/orders/complete-all-live');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);

    const call = mockQuery.mock.calls[0];
    expect(call[1]).toEqual(['kitchen-B']);
  });

  it('ignores a client-supplied kitchen scope override attempt for a non-admin role', async () => {
    // requireRole already gates on role, but this proves the handler itself derives scope
    // from req.user, not from anything the client can send in the body.
    actingAs({ userId: 'chef-1', role: 'chef', kitchenId: 'kitchen-A', zoneId: 'zone-A', restaurantId: null });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post('/admin/orders/complete-all-live').send({ kitchenId: 'kitchen-Z', restaurantId: 'restaurant-Z', zoneId: 'zone-Z' });
    expect(res.status).toBe(200);

    const call = mockQuery.mock.calls[0];
    expect(call[1]).toEqual(['kitchen-A']); // server-derived kitchen used, body ignored
  });

  it('returns 400 when a kitchen-role account has no kitchen assigned', async () => {
    actingAs({ userId: 'partner-1', role: 'partner_kitchen', kitchenId: null, zoneId: null, restaurantId: null });

    const res = await request(app).post('/admin/orders/complete-all-live');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('KITCHEN_NOT_ASSIGNED');
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('retains platform-wide completion for super_admin', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'ord-1', display_id: '2QT-100001' }, { id: 'ord-2', display_id: '2QT-100002' }],
    });

    const res = await request(app).post('/admin/orders/complete-all-live');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);

    const call = mockQuery.mock.calls[0];
    expect(call[1]).toEqual([null]); // no kitchen filter — platform-wide, as intended
  });

  it('retains platform-wide completion for admin', async () => {
    actingAs({ userId: 'admin-2', role: 'admin', kitchenId: null, zoneId: null, restaurantId: null });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post('/admin/orders/complete-all-live');
    expect(res.status).toBe(200);

    const call = mockQuery.mock.calls[0];
    expect(call[1]).toEqual([null]);
  });
});

// ── Phase 4: kitchen/staff lifecycle keeps restaurant tenancy in sync ─────────────────────────
// utils/tenant.ts's syncTenantMembership/deactivateTenantMembership, wired into the admin flows
// that create/assign/remove kitchens and staff — without this, anything created after migration
// 148 would silently drift out of the Phase 3 tenant model.

describe('POST /admin/kitchens — Phase 4 tenant sync', () => {
  it('creates a matching restaurant + outlet and links the new kitchen to it', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });

    const clientCalls: any[] = [];
    const clientMock = {
      query: jest.fn(async (text: string, params?: any[]) => {
        clientCalls.push([text, params]);
        if (text.includes('INSERT INTO kitchens')) return { rows: [{ id: 'kitchen-new' }] };
        if (text.includes('INSERT INTO kitchen_zones')) return { rows: [] };
        if (text.includes('INSERT INTO restaurants')) return { rows: [{ id: 'restaurant-new' }] };
        if (text.includes('UPDATE kitchens SET restaurant_id')) return { rows: [] };
        if (text.includes('INSERT INTO outlets')) return { rows: [] };
        return { rows: [] };
      }),
    };
    mockWithTransaction.mockImplementationOnce(async (cb: any) => cb(clientMock));
    // Post-transaction SELECT that builds the response payload
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'kitchen-new', name: 'New Kitchen', zones: [] }] });

    const res = await request(app).post('/admin/kitchens').send({
      name: 'New Kitchen',
      zone_ids: ['00000000-0000-0000-0000-000000000001'],
    });

    expect(res.status).toBe(201);

    const restaurantInsert = clientCalls.find(([text]) => text.includes('INSERT INTO restaurants'));
    expect(restaurantInsert).toBeDefined();
    expect(restaurantInsert[1][0]).toBe('New Kitchen'); // restaurant name mirrors kitchen name
    expect(restaurantInsert[1][1]).toContain('new-kitchen'); // slugified

    const kitchenLink = clientCalls.find(([text]) => text.includes('UPDATE kitchens SET restaurant_id'));
    expect(kitchenLink[1]).toEqual(['restaurant-new', 'kitchen-new']);

    const outletInsert = clientCalls.find(([text]) => text.includes('INSERT INTO outlets'));
    expect(outletInsert[1]).toEqual(['restaurant-new', 'New Kitchen', '00000000-0000-0000-0000-000000000001', 'kitchen-new']);
  });
});

describe('POST /admin/kitchens/:id/staff — Phase 4 tenant sync', () => {
  it("syncs an existing user's restaurant_id and restaurant_users membership", async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'existing-user-1' }] }) // SELECT id FROM users WHERE phone
      .mockResolvedValueOnce({ rows: [] })                          // UPDATE users role/kitchen_id
      .mockResolvedValueOnce({ rows: [{ restaurant_id: 'restaurant-A' }] }) // syncTenantMembership: kitchen lookup
      .mockResolvedValueOnce({ rows: [] })                          // syncTenantMembership: UPDATE users.restaurant_id
      .mockResolvedValueOnce({ rows: [] });                         // syncTenantMembership: UPSERT restaurant_users

    const res = await request(app).post('/admin/kitchens/kitchen-A/staff').send({ phone: '9876543210', role: 'chef' });
    expect(res.status).toBe(200);

    const kitchenLookup = mockQuery.mock.calls[2];
    expect(kitchenLookup[0]).toContain('SELECT restaurant_id FROM kitchens');
    expect(kitchenLookup[1]).toEqual(['kitchen-A']);
    const membershipUpsert = mockQuery.mock.calls[4];
    expect(membershipUpsert[0]).toContain('INSERT INTO restaurant_users');
    expect(membershipUpsert[1]).toEqual(['restaurant-A', 'existing-user-1', 'chef']);
  });

  it('syncs a newly-created staff account the same way', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });
    mockQuery
      .mockResolvedValueOnce({ rows: [] })                          // SELECT id FROM users WHERE phone → none
      .mockResolvedValueOnce({ rows: [{ id: 'new-user-1' }] })       // INSERT INTO users ... RETURNING id
      .mockResolvedValueOnce({ rows: [{ restaurant_id: 'restaurant-A' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post('/admin/kitchens/kitchen-A/staff').send({ phone: '9876543211', name: 'New Chef', role: 'chef' });
    expect(res.status).toBe(200);

    const membershipUpsert = mockQuery.mock.calls[4];
    expect(membershipUpsert[1]).toEqual(['restaurant-A', 'new-user-1', 'chef']);
  });

  it('does not fail the request when the kitchen has no restaurant_id yet', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'existing-user-1' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ restaurant_id: null }] }); // kitchen lookup — no restaurant_id

    const res = await request(app).post('/admin/kitchens/kitchen-A/staff').send({ phone: '9876543210', role: 'chef' });
    expect(res.status).toBe(200);
    expect(mockQuery).toHaveBeenCalledTimes(3); // sync stops after the lookup — no crash, no extra writes
  });
});

describe('DELETE /admin/kitchens/:id/staff/:staffId — Phase 4 tenant sync', () => {
  it("nulls the removed staff member's restaurant_id and deactivates their membership", async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // UPDATE users role/kitchen_id
      .mockResolvedValueOnce({ rows: [] }) // deactivateTenantMembership: UPDATE users.restaurant_id
      .mockResolvedValueOnce({ rows: [] }); // deactivateTenantMembership: UPDATE restaurant_users

    const res = await request(app).delete('/admin/kitchens/kitchen-A/staff/staff-1');
    expect(res.status).toBe(200);

    expect(mockQuery.mock.calls[1]).toEqual(['UPDATE users SET restaurant_id = NULL WHERE id = $1', ['staff-1']]);
    expect(mockQuery.mock.calls[2][0]).toContain("SET status = 'inactive'");
    expect(mockQuery.mock.calls[2][1]).toEqual(['staff-1']);
  });
});

describe('DELETE /admin/kitchens/:id — Phase 4 tenant sync', () => {
  it('deactivates restaurant_users membership for every demoted staff member', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'chef-1' }, { id: 'manager-1' }] }) // demote UPDATE ... RETURNING id
      .mockResolvedValueOnce({ rows: [] }) // deactivate restaurant_users for both
      .mockResolvedValueOnce({ rows: [] }) // DELETE kitchen_zones
      .mockResolvedValueOnce({ rows: [] }); // DELETE kitchens

    const res = await request(app).delete('/admin/kitchens/kitchen-A');
    expect(res.status).toBe(200);

    const deactivateCall = mockQuery.mock.calls[1];
    expect(deactivateCall[0]).toContain("SET status = 'inactive'");
    expect(deactivateCall[1]).toEqual([['chef-1', 'manager-1']]);
  });

  it('does not attempt a membership update when no staff were assigned to the kitchen', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // demote UPDATE ... RETURNING id → no rows
      .mockResolvedValueOnce({ rows: [] }) // DELETE kitchen_zones
      .mockResolvedValueOnce({ rows: [] }); // DELETE kitchens

    const res = await request(app).delete('/admin/kitchens/kitchen-A');
    expect(res.status).toBe(200);
    expect(mockQuery).toHaveBeenCalledTimes(3); // no restaurant_users UPDATE attempted
  });
});

describe('POST /admin/team/users — Phase 4 tenant sync', () => {
  it('syncs tenant membership when creating a chef with a kitchenId', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'user-1', name: 'Chef', phone: '919876543210', role: 'chef', kitchen_id: 'kitchen-A', created_at: new Date() }] })
      .mockResolvedValueOnce({ rows: [{ restaurant_id: 'restaurant-A' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post('/admin/team/users').send({ phone: '9876543210', name: 'Chef', role: 'chef', kitchenId: 'kitchen-A' });
    expect(res.status).toBe(200);

    const membershipUpsert = mockQuery.mock.calls[3];
    expect(membershipUpsert[0]).toContain('INSERT INTO restaurant_users');
    expect(membershipUpsert[1]).toEqual(['restaurant-A', 'user-1', 'chef']);
  });

  it('never syncs tenant membership for a rider, even if a kitchenId is somehow supplied', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'rider-1', name: 'Rider', phone: '919876543211', role: 'rider', kitchen_id: 'kitchen-A', created_at: new Date() }],
    });

    const res = await request(app).post('/admin/team/users').send({ phone: '9876543211', name: 'Rider', role: 'rider', kitchenId: 'kitchen-A' });
    expect(res.status).toBe(200);
    expect(mockQuery).toHaveBeenCalledTimes(1); // only the INSERT — no tenant sync for riders (Phase 8, not now)
  });
});
