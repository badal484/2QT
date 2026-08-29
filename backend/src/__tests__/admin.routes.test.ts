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
// Stub Razorpay so Phase 8's subscription-billing routes never make real HTTP calls.
const mockRazorpayOrdersCreate = jest.fn().mockResolvedValue({ id: 'order_rsub_test', amount: 500000 });
jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => ({
    orders: { create: mockRazorpayOrdersCreate },
  }));
});
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

  it('lets the restaurant display name differ from the kitchen name when restaurant_name is supplied', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });

    const clientCalls: any[] = [];
    const clientMock = {
      query: jest.fn(async (text: string, params?: any[]) => {
        clientCalls.push([text, params]);
        if (text.includes('INSERT INTO kitchens')) return { rows: [{ id: 'kitchen-new' }] };
        if (text.includes('INSERT INTO kitchen_zones')) return { rows: [] };
        if (text.includes('INSERT INTO restaurants')) return { rows: [{ id: 'restaurant-new' }] };
        return { rows: [] };
      }),
    };
    mockWithTransaction.mockImplementationOnce(async (cb: any) => cb(clientMock));
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'kitchen-new', name: 'Punjabi Dhaba HSR', zones: [] }] });

    const res = await request(app).post('/admin/kitchens').send({
      name: 'Punjabi Dhaba HSR',
      restaurant_name: 'Punjabi Dhaba',
      zone_ids: ['00000000-0000-0000-0000-000000000001'],
    });

    expect(res.status).toBe(201);
    const restaurantInsert = clientCalls.find(([text]) => text.includes('INSERT INTO restaurants'));
    expect(restaurantInsert[1][0]).toBe('Punjabi Dhaba'); // restaurant name — independent of kitchen name
    const outletInsert = clientCalls.find(([text]) => text.includes('INSERT INTO outlets'));
    expect(outletInsert[1][1]).toBe('Punjabi Dhaba'); // outlet name follows the restaurant name too
  });
});

describe('GET /admin/kitchens/:id/staff — lists every restaurant-dashboard role, not just chef/packer', () => {
  it('queries using the full RESTAURANT_DASHBOARD_ROLES set, including kitchen_manager and partner_kitchen', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'staff-1', name: 'Badal', phone: '916204646300', role: 'partner_kitchen', is_online: false }],
    });

    const res = await request(app).get('/admin/kitchens/kitchen-A/staff');

    expect(res.status).toBe(200);
    expect(res.body.staff).toHaveLength(1);
    expect(res.body.staff[0].role).toBe('partner_kitchen');

    const call = mockQuery.mock.calls[0];
    expect(call[0]).toContain('role::text = ANY($2)');
    expect(call[1][1]).toEqual(expect.arrayContaining(['chef', 'kitchen_manager', 'packer', 'partner_kitchen']));
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

  it.each(['kitchen_manager', 'partner_kitchen', 'packer'])(
    'accepts %s — not silently downgraded to chef like before this fix',
    async (role) => {
      actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'new-user-1' }] })
        .mockResolvedValueOnce({ rows: [{ restaurant_id: 'restaurant-A' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app).post('/admin/kitchens/kitchen-A/staff').send({ phone: '9876543212', name: 'Staff', role });
      expect(res.status).toBe(200);

      const insertCall = mockQuery.mock.calls[1];
      expect(insertCall[1]).toEqual(['Staff', '919876543212', role, 'kitchen-A']);
      const membershipUpsert = mockQuery.mock.calls[4];
      expect(membershipUpsert[1]).toEqual(['restaurant-A', 'new-user-1', role]);
    }
  );

  it('still falls back to chef for a role outside the restaurant-dashboard set (e.g. attempting to grant rider/admin via this endpoint)', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'new-user-1' }] })
      .mockResolvedValueOnce({ rows: [{ restaurant_id: 'restaurant-A' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post('/admin/kitchens/kitchen-A/staff').send({ phone: '9876543213', role: 'super_admin' });
    expect(res.status).toBe(200);

    const insertCall = mockQuery.mock.calls[1];
    expect(insertCall[1][2]).toBe('chef'); // rejected role silently falls back, never grants platform privilege
  });
});

describe('PATCH /admin/kitchens/:id/staff/:staffId — edit a staff member', () => {
  it('updates name and phone, normalizing a 10-digit phone to the stored 12-digit format', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'staff-1', name: 'New Name', phone: '919876543210' }] });

    const res = await request(app).patch('/admin/kitchens/kitchen-A/staff/staff-1').send({ name: 'New Name', phone: '9876543210' });

    expect(res.status).toBe(200);
    expect(res.body.staff).toEqual({ id: 'staff-1', name: 'New Name', phone: '919876543210' });
    expect(mockQuery.mock.calls[0][1]).toEqual(['New Name', '919876543210', 'staff-1']);
  });

  it('updates only the field supplied — omitting phone leaves it unchanged via COALESCE', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'staff-1', name: 'New Name', phone: '919999999999' }] });

    const res = await request(app).patch('/admin/kitchens/kitchen-A/staff/staff-1').send({ name: 'New Name' });

    expect(res.status).toBe(200);
    expect(mockQuery.mock.calls[0][1]).toEqual(['New Name', null, 'staff-1']);
  });

  it('rejects a malformed phone number', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });
    const res = await request(app).patch('/admin/kitchens/kitchen-A/staff/staff-1').send({ phone: '123' });
    expect(res.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('returns 404 for a nonexistent staff member', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).patch('/admin/kitchens/kitchen-A/staff/nonexistent').send({ name: 'X' });
    expect(res.status).toBe(404);
  });

  it('returns 409 when the new phone is already used by another account', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });
    const conflict: any = new Error('duplicate key');
    conflict.code = '23505';
    mockQuery.mockRejectedValueOnce(conflict);

    const res = await request(app).patch('/admin/kitchens/kitchen-A/staff/staff-1').send({ phone: '9876543210' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('PHONE_IN_USE');
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

describe('POST /admin/kitchens/:id/tenant — attach a tenant to an existing untenanted kitchen', () => {
  it('creates the tenant using the kitchen\'s existing zone when none is supplied', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'kitchen-orphan', name: 'Bachra Kitchen', restaurant_id: null }] }) // kitchen lookup
      .mockResolvedValueOnce({ rows: [{ zone_id: 'zone-existing' }] }) // existing kitchen_zones lookup
      .mockResolvedValueOnce({ rows: [{ id: 'restaurant-new' }] }) // INSERT restaurants
      .mockResolvedValueOnce({ rows: [] }) // UPDATE kitchens SET restaurant_id
      .mockResolvedValueOnce({ rows: [] }); // INSERT outlets

    const res = await request(app).post('/admin/kitchens/kitchen-orphan/tenant').send({ restaurant_name: 'Bachra Kitchen' });

    expect(res.status).toBe(201);
    expect(res.body.restaurant_id).toBe('restaurant-new');
    const outletInsert = mockQuery.mock.calls[4];
    expect(outletInsert[1]).toEqual(['restaurant-new', 'Bachra Kitchen', 'zone-existing', 'kitchen-orphan']);
  });

  it('links a single supplied zone into kitchen_zones when the kitchen has none yet', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'kitchen-orphan', name: 'Bachra Kitchen', restaurant_id: null }] })
      .mockResolvedValueOnce({ rows: [] }) // INSERT kitchen_zones
      .mockResolvedValueOnce({ rows: [{ id: 'restaurant-new' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post('/admin/kitchens/kitchen-orphan/tenant').send({ restaurant_name: 'Bachra Kitchen', zone_ids: ['00000000-0000-0000-0000-000000000009'] });

    expect(res.status).toBe(201);
    expect(mockQuery.mock.calls[1]).toEqual(['INSERT INTO kitchen_zones (kitchen_id, zone_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', ['kitchen-orphan', '00000000-0000-0000-0000-000000000009']]);
    const outletInsert = mockQuery.mock.calls[4];
    expect(outletInsert[1]).toEqual(['restaurant-new', 'Bachra Kitchen', '00000000-0000-0000-0000-000000000009', 'kitchen-orphan']);
  });

  it('links every supplied zone into kitchen_zones, but the outlet only gets the first as its primary zone', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'kitchen-orphan', name: 'Bachra Kitchen', restaurant_id: null }] })
      .mockResolvedValueOnce({ rows: [] }) // INSERT kitchen_zones (zone A)
      .mockResolvedValueOnce({ rows: [] }) // INSERT kitchen_zones (zone B)
      .mockResolvedValueOnce({ rows: [{ id: 'restaurant-new' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const zoneA = '00000000-0000-0000-0000-00000000000a';
    const zoneB = '00000000-0000-0000-0000-00000000000b';
    const res = await request(app).post('/admin/kitchens/kitchen-orphan/tenant').send({
      restaurant_name: 'Bachra Kitchen',
      zone_ids: [zoneA, zoneB],
    });

    expect(res.status).toBe(201);
    expect(mockQuery.mock.calls[1][1]).toEqual(['kitchen-orphan', zoneA]);
    expect(mockQuery.mock.calls[2][1]).toEqual(['kitchen-orphan', zoneB]);
    const outletInsert = mockQuery.mock.calls[5];
    expect(outletInsert[1]).toEqual(['restaurant-new', 'Bachra Kitchen', zoneA, 'kitchen-orphan']); // primary = first selected
  });

  it('returns 404 for a nonexistent kitchen', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post('/admin/kitchens/nonexistent/tenant').send({ restaurant_name: 'X' });
    expect(res.status).toBe(404);
  });

  it('returns 409 when the kitchen already has a tenant — refuses to overwrite an existing restaurant link', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'kitchen-1', name: 'Existing', restaurant_id: 'restaurant-already' }] });

    const res = await request(app).post('/admin/kitchens/kitchen-1/tenant').send({ restaurant_name: 'X' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('ALREADY_HAS_TENANT');
    expect(mockQuery).toHaveBeenCalledTimes(1); // never attempted any write
  });

  it('rejects a missing restaurant_name via Zod validation', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });
    const res = await request(app).post('/admin/kitchens/kitchen-1/tenant').send({});
    expect(res.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
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

// ── Phase 7: platform-admin restaurant tenant view ────────────────────────────────────────────
// Mounted at /admin/tenant-restaurants specifically to avoid colliding with the existing
// /admin/restaurants dine-in admin API (see the route definitions in admin.ts for the full
// explanation). Role authorization itself (requireRole('super_admin','admin')) is a no-op in
// this test file's mocked middleware — as with every other admin.ts endpoint in this suite —
// and is verified by direct code inspection instead; these tests focus on what the mock cannot
// verify: that changing the :id selector changes ONLY the data returned, with every query
// correctly parameterized by it and no cross-restaurant bleed.

describe('GET /admin/tenant-restaurants', () => {
  it('returns every restaurant with outlet/kitchen counts, platform-wide', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'restaurant-A', name: 'Royal Spice', slug: 'royal-spice', status: 'active', outlet_count: 1, kitchen_count: 1 },
        { id: 'restaurant-B', name: 'Spice Villa', slug: 'spice-villa', status: 'active', outlet_count: 2, kitchen_count: 2 },
      ],
    });

    const res = await request(app).get('/admin/tenant-restaurants');
    expect(res.status).toBe(200);
    expect(res.body.restaurants).toHaveLength(2);

    const call = mockQuery.mock.calls[0];
    expect(call[0]).toContain('FROM restaurants r');
    expect(call[0]).not.toMatch(/WHERE\s+r\.id/); // no id filter — genuinely platform-wide
  });
});

describe('GET /admin/tenant-restaurants/:id', () => {
  it('returns 404 for a nonexistent restaurant', async () => {
    // All 8 queries fire in parallel via Promise.all regardless of whether the restaurant
    // exists, so every one needs a (possibly empty) resolved value.
    parallelQueryMocks([
      { rows: [] }, // restaurant lookup — empty
      { rows: [] }, { rows: [] }, { rows: [] },
      { rows: [{ total: 0, active: 0 }] },
      { rows: [] },
      { rows: [{ count: 0 }] },
      { rows: [] }, // subscriptions (Phase 8)
    ]);

    const res = await request(app).get('/admin/tenant-restaurants/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });

  it("scopes every sub-query to the selected :id, and never includes rider data", async () => {
    parallelQueryMocks([
      { rows: [{ id: 'restaurant-A', name: 'Royal Spice', slug: 'royal-spice', status: 'active', settings: {} }] },
      { rows: [{ id: 'outlet-1', name: 'Main', zone_id: 'zone-1', kitchen_id: 'kitchen-A', status: 'active' }] },
      { rows: [{ id: 'kitchen-A', name: 'Kitchen A', address: 'Addr', is_active: true, is_paused: false }] },
      { rows: [{ id: 'chef-1', name: 'Chef One', phone: '919876543210', membership_role: 'chef', membership_status: 'active' }] },
      { rows: [{ total: 5, active: 2 }] },
      { rows: [{ id: 'ord-1', display_id: '2QT-100001', status: 'preparing', kitchen_id: 'kitchen-A', total_amount_paise: 20000, created_at: new Date() }] },
      { rows: [{ count: 3 }] },
      { rows: [{ id: 'sub-1', status: 'active', amount_paise: 500000, billing_period_start: new Date(), billing_period_end: new Date(), razorpay_order_id: 'order_x', razorpay_payment_id: 'pay_x', created_at: new Date(), cancelled_at: null, created_by_name: 'Admin One', cancelled_by_name: null }] },
    ]);

    const res = await request(app).get('/admin/tenant-restaurants/restaurant-A');
    expect(res.status).toBe(200);
    expect(res.body.restaurant.id).toBe('restaurant-A');
    expect(res.body.outlets).toHaveLength(1);
    expect(res.body.kitchens).toHaveLength(1);
    expect(res.body.staff).toHaveLength(1);
    expect(res.body.orders.total).toBe(5);
    expect(res.body.orders.recent).toHaveLength(1);
    expect(res.body.menu.itemCount).toBe(3);
    expect(res.body.subscriptions).toHaveLength(1);
    expect(res.body.subscriptions[0].status).toBe('active');
    expect(res.body).not.toHaveProperty('riders'); // riders stay platform-owned — never surfaced here

    // Every one of the 8 queries must be parameterized by the same selected id
    for (const call of mockQuery.mock.calls) {
      expect(call[1]).toEqual(['restaurant-A']);
    }
  });

  it("selecting a different restaurant id queries only that restaurant's data — no cross-tenant bleed", async () => {
    parallelQueryMocks([
      { rows: [{ id: 'restaurant-B', name: 'Spice Villa', slug: 'spice-villa', status: 'active', settings: {} }] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [{ total: 0, active: 0 }] },
      { rows: [] },
      { rows: [{ count: 0 }] },
      { rows: [] },
    ]);

    const res = await request(app).get('/admin/tenant-restaurants/restaurant-B');
    expect(res.status).toBe(200);
    expect(res.body.restaurant.id).toBe('restaurant-B');

    for (const call of mockQuery.mock.calls) {
      expect(call[1]).toEqual(['restaurant-B']); // never restaurant-A, never both
    }
  });
});

// ── POST /admin/tenant-restaurants/:id/subscription (Phase 8) ─────────────────────────────────
// Platform-admin-only: no restaurant-side "owner" role exists in the schema to safely delegate
// billing to (see migration 149's comment and the Phase 8 report). Gated by
// requireRole('super_admin', 'admin') — the same, already-proven-correct middleware every other
// admin.ts endpoint uses (see middleware/auth.ts:100). As with every other admin.ts route in this
// suite (see the Phase 7 tenant-restaurants comment above), requireRole is a no-op in this file's
// mocked middleware, so role rejection itself is verified by direct code inspection rather than
// an HTTP-level 403 test — the tests below instead cover what the mock cannot: request/response
// shape, the Razorpay call, tenant scoping, and the one-in-force-subscription conflict path.

describe('POST /admin/tenant-restaurants/:id/subscription', () => {
  const validBody = {
    amountPaise: 500000,
    billingPeriodStart: '2026-01-01T00:00:00.000Z',
    billingPeriodEnd: '2026-01-31T00:00:00.000Z',
  };

  it('super_admin can create a subscription — Razorpay order created, row inserted with correct fields', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });
    parallelQueryMocks([
      { rows: [{ id: 'restaurant-A', name: 'Royal Spice' }] }, // restaurant lookup
      {
        rows: [{
          id: 'sub-1', status: 'pending', amount_paise: 500000,
          billing_period_start: validBody.billingPeriodStart, billing_period_end: validBody.billingPeriodEnd,
          razorpay_order_id: 'order_rsub_test', created_at: new Date(),
        }],
      }, // insert
    ]);

    const res = await request(app).post('/admin/tenant-restaurants/restaurant-A/subscription').send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.subscription.status).toBe('pending');
    expect(res.body.razorpayOrderId).toBe('order_rsub_test');

    expect(mockRazorpayOrdersCreate).toHaveBeenCalledWith(expect.objectContaining({
      amount: 500000,
      currency: 'INR',
      notes: expect.objectContaining({ type: 'restaurant_subscription', restaurantId: 'restaurant-A' }),
    }));

    const insertCall = mockQuery.mock.calls[1];
    expect(insertCall[0]).toContain('INSERT INTO restaurant_subscriptions');
    expect(insertCall[1]).toEqual(['restaurant-A', 500000, validBody.billingPeriodStart, validBody.billingPeriodEnd, 'order_rsub_test', 'admin-1']);
  });

  it('admin (not just super_admin) can also create a subscription', async () => {
    actingAs({ userId: 'admin-2', role: 'admin', kitchenId: null, zoneId: null, restaurantId: null });
    parallelQueryMocks([
      { rows: [{ id: 'restaurant-A', name: 'Royal Spice' }] },
      { rows: [{ id: 'sub-2', status: 'pending', amount_paise: 500000 }] },
    ]);
    const res = await request(app).post('/admin/tenant-restaurants/restaurant-A/subscription').send(validBody);
    expect(res.status).toBe(201);
  });

  it('returns 404 for a nonexistent restaurant, without creating a Razorpay order', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/admin/tenant-restaurants/nonexistent/subscription').send(validBody);
    expect(res.status).toBe(404);
    expect(mockRazorpayOrdersCreate).not.toHaveBeenCalled();
  });

  it('rejects a billing period where end is not after start', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });
    const res = await request(app).post('/admin/tenant-restaurants/restaurant-A/subscription').send({
      ...validBody, billingPeriodEnd: validBody.billingPeriodStart,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_PERIOD');
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('rejects malformed period dates', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });
    const res = await request(app).post('/admin/tenant-restaurants/restaurant-A/subscription').send({
      ...validBody, billingPeriodStart: 'not-a-date',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_PERIOD');
  });

  it('rejects a missing/non-positive amountPaise via Zod validation', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });
    const res = await request(app).post('/admin/tenant-restaurants/restaurant-A/subscription').send({
      ...validBody, amountPaise: -100,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(mockRazorpayOrdersCreate).not.toHaveBeenCalled();
  });

  it('rejects a client-supplied amountPaise of zero (never invent/accept a free plan)', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });
    const res = await request(app).post('/admin/tenant-restaurants/restaurant-A/subscription').send({
      ...validBody, amountPaise: 0,
    });
    expect(res.status).toBe(400);
  });

  it('returns 409 SUBSCRIPTION_ALREADY_IN_FORCE when the partial unique index rejects a second pending/active row', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'restaurant-A', name: 'Royal Spice' }] });
    const uniqueViolation: any = new Error('duplicate key value violates unique constraint');
    uniqueViolation.code = '23505';
    mockQuery.mockRejectedValueOnce(uniqueViolation);

    const res = await request(app).post('/admin/tenant-restaurants/restaurant-A/subscription').send(validBody);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('SUBSCRIPTION_ALREADY_IN_FORCE');
  });

  it('rejects an unauthenticated request', async () => {
    mockAuthenticate.mockImplementationOnce((_req: any, res: any) => res.status(401).json({ error: 'UNAUTHENTICATED' }));
    const res = await request(app).post('/admin/tenant-restaurants/restaurant-A/subscription').send(validBody);
    expect(res.status).toBe(401);
  });
});

// ── POST /admin/tenant-restaurants/:id/subscription/cancel (Phase 8) ──────────────────────────

describe('POST /admin/tenant-restaurants/:id/subscription/cancel', () => {
  it('super_admin can cancel an in-force subscription', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'sub-1', status: 'cancelled', cancelled_at: new Date() }] });

    const res = await request(app).post('/admin/tenant-restaurants/restaurant-A/subscription/cancel').send({});
    expect(res.status).toBe(200);
    expect(res.body.subscription.status).toBe('cancelled');

    const call = mockQuery.mock.calls[0];
    expect(call[0]).toContain('UPDATE restaurant_subscriptions');
    expect(call[1]).toEqual(['restaurant-A', 'admin-1']);
  });

  it('returns 404 NO_IN_FORCE_SUBSCRIPTION when there is nothing pending/active to cancel', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post('/admin/tenant-restaurants/restaurant-A/subscription/cancel').send({});
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NO_IN_FORCE_SUBSCRIPTION');
  });

  it('records which admin cancelled it (cancelled_by is the acting admin, never client-suppliable)', async () => {
    actingAs({ userId: 'admin-specific', role: 'admin', kitchenId: null, zoneId: null, restaurantId: null });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'sub-1', status: 'cancelled' }] });

    // Even if the client tries to smuggle a different cancelledBy in the body, the route never
    // reads it — the SQL param list is hardcoded to req.user!.userId.
    await request(app).post('/admin/tenant-restaurants/restaurant-A/subscription/cancel').send({ cancelledBy: 'someone-else' });

    const call = mockQuery.mock.calls[0];
    expect(call[1]).toEqual(['restaurant-A', 'admin-specific']);
  });
});

// ── DELETE /admin/users/:id ──────────────────────────────────────────────────

describe('DELETE /admin/users/:id', () => {
  it('allows super_admin or admin to delete a user', async () => {
    actingAs({ userId: 'admin-1', role: 'admin', kitchenId: null, zoneId: null, restaurantId: null });
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'user-to-del', name: 'John Doe', phone: '9999999999', role: 'customer' }] }) // SELECT user
      .mockResolvedValue({ rows: [] }); // transaction queries + DELETE

    const res = await request(app).delete('/admin/users/user-to-del');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('John Doe deleted');
  });

  it('prevents an admin from deleting their own account while logged in', async () => {
    actingAs({ userId: 'admin-1', role: 'admin', kitchenId: null, zoneId: null, restaurantId: null });

    const res = await request(app).delete('/admin/users/admin-1');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('cannot delete your own account');
  });

  it('returns 404 if user does not exist', async () => {
    actingAs({ userId: 'admin-1', role: 'admin', kitchenId: null, zoneId: null, restaurantId: null });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).delete('/admin/users/non-existent');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('User not found');
  });
});

