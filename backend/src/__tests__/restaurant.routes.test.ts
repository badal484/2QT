/**
 * HTTP-layer tests for /restaurant (singular) — the Phase 5 tenant-facing restaurant dashboard.
 *
 * Every test proves isolation at the query level (asserting on the actual SQL/params sent to the
 * mocked `query`), not just on the HTTP response — per the Phase 5 instruction not to claim a
 * security property the backend doesn't actually enforce.
 */

import express from 'express';
import request from 'supertest';
import { query } from '../db';
import { authenticate } from '../middleware/auth';

jest.mock('../modules/notifications/broadcast/broadcast.service', () => ({
  BroadcastService: {
    createCampaign: jest.fn().mockResolvedValue({ id: 'camp-tenant-1', status: 'PROCESSING' }),
  },
}));

import restaurantRouter from '../routes/restaurant';

const app = express();
app.use(express.json());
app.use('/restaurant', restaurantRouter);

const mockQuery = query as jest.Mock;
const mockAuthenticate = authenticate as jest.Mock;
const defaultAuthenticate = mockAuthenticate.getMockImplementation();

function actingAs(user: {
  userId: string; role: string; kitchenId: string | null; zoneId: string | null;
  restaurantId: string | null; tenantRestaurantId: string | null;
}) {
  mockAuthenticate.mockImplementationOnce((req: any, _res: any, next: any) => {
    req.user = { ...user, jti: 'jti-test' };
    next();
  });
}

// Convenience: an authenticated chef of restaurant-A with an active membership.
function actingAsChefOfA() {
  actingAs({ userId: 'chef-1', role: 'chef', kitchenId: 'kitchen-A', zoneId: 'zone-1', restaurantId: null, tenantRestaurantId: 'restaurant-A' });
}

function mockActiveMembership() {
  mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] }); // isActiveRestaurantMember → true
}

function mockNoMembership() {
  mockQuery.mockResolvedValueOnce({ rows: [] }); // isActiveRestaurantMember → false
}

beforeEach(() => {
  jest.clearAllMocks();
  if (defaultAuthenticate) mockAuthenticate.mockImplementation(defaultAuthenticate);
});

// ── Cross-cutting authorization (requireActiveRestaurantMembership) ──────────────────────────

describe('Restaurant dashboard — access control', () => {
  it('allows a chef with an active membership', async () => {
    actingAsChefOfA();
    mockActiveMembership();
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'restaurant-A', name: 'Royal Spice', slug: 'royal-spice', status: 'active', settings: {} }] });

    const res = await request(app).get('/restaurant/me');
    expect(res.status).toBe(200);
    expect(res.body.restaurant.id).toBe('restaurant-A');
  });

  it("denies access when membership is inactive (deactivated by admin)", async () => {
    actingAsChefOfA();
    mockNoMembership(); // status != 'active', so the query in isActiveRestaurantMember returns no rows

    const res = await request(app).get('/restaurant/me');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
    // The route's own SELECT must never run once membership fails
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('denies access when the user has no tenantRestaurantId at all', async () => {
    actingAs({ userId: 'chef-2', role: 'chef', kitchenId: null, zoneId: null, restaurantId: null, tenantRestaurantId: null });

    const res = await request(app).get('/restaurant/me');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('NO_RESTAURANT_ASSIGNED');
    expect(mockQuery).not.toHaveBeenCalled(); // fails closed before any query — not even the membership check
  });

  it('denies riders entirely, regardless of tenantRestaurantId', async () => {
    actingAs({ userId: 'rider-1', role: 'rider', kitchenId: null, zoneId: 'zone-1', restaurantId: null, tenantRestaurantId: 'restaurant-A' });

    const res = await request(app).get('/restaurant/me');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('denies customers entirely', async () => {
    actingAs({ userId: 'cust-1', role: 'customer', kitchenId: null, zoneId: null, restaurantId: null, tenantRestaurantId: null });

    const res = await request(app).get('/restaurant/me');
    expect(res.status).toBe(403);
  });

  it('denies finance and support roles', async () => {
    for (const role of ['finance', 'support']) {
      actingAs({ userId: `${role}-1`, role, kitchenId: null, zoneId: null, restaurantId: null, tenantRestaurantId: null });
      const res = await request(app).get('/restaurant/me');
      expect(res.status).toBe(403);
    }
  });

  it('does NOT grant platform admins dashboard access without an explicit tenant-selection mechanism (none exists)', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null, tenantRestaurantId: null });

    const res = await request(app).get('/restaurant/me');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN'); // rejected at the role check, before tenant is even considered
  });

  it('cannot be escaped using the unrelated dine-in req.user.restaurantId', async () => {
    // A dine_in_staff account has a real, non-null req.user.restaurantId (the dine-in relationship)
    // but no tenantRestaurantId (the SaaS relationship) — must still be denied. dine_in_staff
    // isn't in RESTAURANT_DASHBOARD_ROLES at all, so this is rejected at the role check itself,
    // even before the tenant-id is considered — the dine-in restaurantId is never read anywhere
    // in this file (only req.user.tenantRestaurantId ever is), so it has no path to matter here.
    actingAs({ userId: 'dinein-1', role: 'dine_in_staff', kitchenId: null, zoneId: null, restaurantId: 'dine-in-restaurant-1', tenantRestaurantId: null });

    const res = await request(app).get('/restaurant/me');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('ignores a client-supplied tenant id and only ever queries the server-derived one', async () => {
    actingAsChefOfA();
    mockActiveMembership();
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'restaurant-A', name: 'Royal Spice', slug: 'royal-spice', status: 'active', settings: {} }] });

    const res = await request(app)
      .get('/restaurant/me')
      .query({ restaurantId: 'restaurant-B', tenantRestaurantId: 'restaurant-B' })
      .set('x-restaurant-id', 'restaurant-B');

    expect(res.status).toBe(200);
    // Both the membership check and the actual SELECT were called with restaurant-A only
    expect(mockQuery.mock.calls[0][1]).toEqual(['chef-1', 'restaurant-A']);
    expect(mockQuery.mock.calls[1][1]).toEqual(['restaurant-A']);
  });
});

// ── GET /restaurant/me ────────────────────────────────────────────────────────

describe('GET /restaurant/me', () => {
  it("returns only this tenant's own restaurant row", async () => {
    actingAsChefOfA();
    mockActiveMembership();
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'restaurant-A', name: 'Royal Spice', slug: 'royal-spice', status: 'active', settings: {} }] });

    const res = await request(app).get('/restaurant/me');
    expect(res.status).toBe(200);
    const selectCall = mockQuery.mock.calls[1];
    expect(selectCall[0]).toContain('FROM restaurants WHERE id = $1');
    expect(selectCall[1]).toEqual(['restaurant-A']);
  });
});

// ── GET /restaurant/outlets ───────────────────────────────────────────────────

describe('GET /restaurant/outlets', () => {
  it("scopes outlets strictly to this tenant's restaurant_id", async () => {
    actingAsChefOfA();
    mockActiveMembership();
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'outlet-1', name: 'Main', zone_id: 'zone-1', kitchen_id: 'kitchen-A', status: 'active' }] });

    const res = await request(app).get('/restaurant/outlets');
    expect(res.status).toBe(200);
    expect(res.body.outlets).toHaveLength(1);
    const selectCall = mockQuery.mock.calls[1];
    expect(selectCall[0]).toContain('FROM outlets WHERE restaurant_id = $1');
    expect(selectCall[1]).toEqual(['restaurant-A']);
  });
});

// ── GET /restaurant/kitchens ──────────────────────────────────────────────────

describe('GET /restaurant/kitchens', () => {
  it("scopes kitchens strictly to this tenant's restaurant_id", async () => {
    actingAsChefOfA();
    mockActiveMembership();
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'kitchen-A', name: 'Kitchen A' }] });

    const res = await request(app).get('/restaurant/kitchens');
    expect(res.status).toBe(200);
    const selectCall = mockQuery.mock.calls[1];
    expect(selectCall[0]).toContain('FROM kitchens WHERE restaurant_id = $1');
    expect(selectCall[1]).toEqual(['restaurant-A']);
  });
});

// ── GET /restaurant/staff ─────────────────────────────────────────────────────

describe('GET /restaurant/staff', () => {
  it("scopes staff strictly to this tenant via restaurant_users, and never exposes secrets", async () => {
    actingAsChefOfA();
    mockActiveMembership();
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'chef-1', name: 'Chef One', phone: '919876543210', kitchen_id: 'kitchen-A', is_online: true, is_active: true, membership_role: 'chef', membership_status: 'active' }],
    });

    const res = await request(app).get('/restaurant/staff');
    expect(res.status).toBe(200);
    const selectCall = mockQuery.mock.calls[1];
    expect(selectCall[0]).toContain('FROM restaurant_users ru');
    expect(selectCall[0]).toContain('WHERE ru.restaurant_id = $1');
    expect(selectCall[0]).not.toMatch(/pin_hash|password|token|otp/i);
    expect(selectCall[1]).toEqual(['restaurant-A']);
    expect(res.body.staff[0]).not.toHaveProperty('pin_hash');
  });
});

// ── GET /restaurant/orders ────────────────────────────────────────────────────

describe('GET /restaurant/orders', () => {
  it('applies the tenant predicate first, with optional filters ANDed onto it (never OR)', async () => {
    actingAsChefOfA();
    mockActiveMembership();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'ord-1', display_id: '2QT-100001', status: 'preparing' }] })
      .mockResolvedValueOnce({ rows: [{ count: 1 }] });

    const res = await request(app).get('/restaurant/orders').query({ status: 'preparing' });
    expect(res.status).toBe(200);

    const selectCall = mockQuery.mock.calls[1];
    expect(selectCall[0]).toContain('o.restaurant_id = $1');
    expect(selectCall[0]).toMatch(/o\.restaurant_id = \$1 AND o\.status = \$2/);
    expect(selectCall[1][0]).toBe('restaurant-A');
    expect(selectCall[1][1]).toBe('preparing');
  });

  it('paginates and defaults to a bounded limit (never returns unbounded history)', async () => {
    actingAsChefOfA();
    mockActiveMembership();
    mockQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ count: 0 }] });

    const res = await request(app).get('/restaurant/orders');
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(25);
    expect(res.body.offset).toBe(0);
  });

  it('caps an oversized limit request at 100', async () => {
    actingAsChefOfA();
    mockActiveMembership();
    mockQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ count: 0 }] });

    const res = await request(app).get('/restaurant/orders').query({ limit: '9999' });
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(100);
  });

  it("a kitchenId filter belonging to another restaurant returns nothing, never another tenant's orders", async () => {
    actingAsChefOfA();
    mockActiveMembership();
    // Even though the filter targets kitchen-B (restaurant B's kitchen), the WHERE clause still
    // ANDs restaurant_id = restaurant-A, so the (mocked) DB would correctly return zero rows —
    // this test proves the query is built that way, not that it merely "looks scoped".
    mockQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ count: 0 }] });

    const res = await request(app).get('/restaurant/orders').query({ kitchenId: 'kitchen-B' });
    expect(res.status).toBe(200);
    const selectCall = mockQuery.mock.calls[1];
    expect(selectCall[0]).toContain('o.restaurant_id = $1 AND o.kitchen_id = $2');
    expect(selectCall[1].slice(0, 2)).toEqual(['restaurant-A', 'kitchen-B']);
  });
});

// ── GET /restaurant/menu ──────────────────────────────────────────────────────

describe('GET /restaurant/menu', () => {
  it('scopes menu items by restaurant_id, not zone_id (read-only)', async () => {
    actingAsChefOfA();
    mockActiveMembership();
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'item-1', name: 'Biryani', zone_id: 'zone-1', kitchen_id: 'kitchen-A' }] });

    const res = await request(app).get('/restaurant/menu');
    expect(res.status).toBe(200);
    const selectCall = mockQuery.mock.calls[1];
    expect(selectCall[0]).toContain('FROM menu_items WHERE restaurant_id = $1');
    expect(selectCall[1]).toEqual(['restaurant-A']);
  });

  it('exposes no mutation routes — POST/PATCH/DELETE on /restaurant/menu do not exist', async () => {
    actingAsChefOfA();
    mockActiveMembership();
    const res = await request(app).post('/restaurant/menu').send({ name: 'Hack Item' });
    expect(res.status).toBe(404);
  });
});

// ── GET /restaurant/stats ─────────────────────────────────────────────────────

describe('GET /restaurant/stats', () => {
  it('computes every statistic scoped to restaurant_id, never a global platform query', async () => {
    actingAsChefOfA();
    mockActiveMembership();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total_orders: 5, pending: 1, preparing: 2, out_for_delivery: 1, delivered_today: 1 }] })
      .mockResolvedValueOnce({ rows: [{ count: 1 }] })
      .mockResolvedValueOnce({ rows: [{ count: 3 }] });

    const res = await request(app).get('/restaurant/stats');
    expect(res.status).toBe(200);
    expect(res.body.orders.total_orders).toBe(5);
    expect(res.body.activeKitchens).toBe(1);
    expect(res.body.activeStaff).toBe(3);

    const [orderStatsCall, kitchenCountCall, staffCountCall] = mockQuery.mock.calls.slice(1);
    expect(orderStatsCall[0]).toContain('FROM orders WHERE restaurant_id = $1');
    expect(orderStatsCall[1]).toEqual(['restaurant-A']);
    expect(kitchenCountCall[0]).toContain('FROM kitchens WHERE restaurant_id = $1');
    expect(staffCountCall[0]).toContain('FROM restaurant_users WHERE restaurant_id = $1');
  });
});

describe('GET /restaurant/sales — no commission math, restaurant keeps 100% of order revenue', () => {
  it('computes sales as total_amount_paise minus delivery_fee_paise, scoped to restaurant_id', async () => {
    actingAsChefOfA();
    mockActiveMembership();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ sales: '5000', orders: 2 }] })   // today
      .mockResolvedValueOnce({ rows: [{ sales: '15000', orders: 5 }] })  // thisWeek
      .mockResolvedValueOnce({ rows: [{ sales: '40000', orders: 12 }] }) // thisMonth
      .mockResolvedValueOnce({ rows: [{ sales: '100000', orders: 30 }] }) // allTime
      .mockResolvedValueOnce({ rows: [] }); // trend (empty — padded client-side to 7 days)

    const res = await request(app).get('/restaurant/sales');

    expect(res.status).toBe(200);
    expect(res.body.today.sales).toBe('5000');
    expect(res.body.allTime.orders).toBe(30);
    expect(res.body.trend).toHaveLength(7); // always padded to a full week, even with no rows

    const calls = mockQuery.mock.calls.slice(1); // skip the membership check
    for (const call of calls) {
      expect(call[0]).toContain("FROM orders WHERE restaurant_id = $1 AND status = 'delivered'");
      expect(call[0]).toContain('total_amount_paise - delivery_fee_paise');
      expect(call[0]).not.toContain('commission'); // the defining difference from kitchen.ts's /my-earnings
      expect(call[1][0]).toBe('restaurant-A');
    }
  });

  it('returns 403 for a restaurant role with no active membership, never computing sales', async () => {
    actingAsChefOfA();
    mockNoMembership();

    const res = await request(app).get('/restaurant/sales');
    expect(res.status).toBe(403);
    expect(mockQuery).toHaveBeenCalledTimes(1); // only the membership check ran
  });
});

// ── Restaurant B isolation, end to end ────────────────────────────────────────

describe('Cross-tenant isolation — Restaurant B staff can never see Restaurant A data', () => {
  it("Restaurant B's own /me call only ever touches restaurant-B, never restaurant-A", async () => {
    actingAs({ userId: 'chef-b', role: 'chef', kitchenId: 'kitchen-B', zoneId: 'zone-2', restaurantId: null, tenantRestaurantId: 'restaurant-B' });
    mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] }); // active member of B
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'restaurant-B', name: 'Spice Villa', slug: 'spice-villa', status: 'active', settings: {} }] });

    const res = await request(app).get('/restaurant/me');
    expect(res.status).toBe(200);
    expect(res.body.restaurant.id).toBe('restaurant-B');
    expect(mockQuery.mock.calls[0][1]).toEqual(['chef-b', 'restaurant-B']);
    expect(mockQuery.mock.calls[1][1]).toEqual(['restaurant-B']);
  });
});

// ── Self-Serve Marketing Broadcast ────────────────────────────────────────────

describe('Self-Serve Broadcast — /restaurant/broadcast', () => {
  it('GET /restaurant/broadcast/status returns allow_broadcast flag and weekly quota metrics', async () => {
    actingAsChefOfA();
    mockActiveMembership();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ allow_broadcast: true, name: 'Royal Spice' }] })
      .mockResolvedValueOnce({ rows: [{ used: 1 }] })
      .mockResolvedValueOnce({ rows: [{ count: 42 }] });

    const res = await request(app).get('/restaurant/broadcast/status');
    expect(res.status).toBe(200);
    expect(res.body.allowBroadcast).toBe(true);
    expect(res.body.weeklyUsed).toBe(1);
    expect(res.body.weeklyMax).toBe(2);
    expect(res.body.audienceCount).toBe(42);
  });

  it('POST /restaurant/broadcast blocks with 403 when allow_broadcast is false', async () => {
    actingAsChefOfA();
    mockActiveMembership();
    mockQuery.mockResolvedValueOnce({ rows: [{ allow_broadcast: false, name: 'Royal Spice' }] });

    const res = await request(app)
      .post('/restaurant/broadcast')
      .send({ title: 'Weekend Sale', body: '50% off today!' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('BROADCAST_NOT_ENABLED');
  });

  it('POST /restaurant/broadcast blocks with 429 when weekly quota (2) is exceeded', async () => {
    actingAsChefOfA();
    mockActiveMembership();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ allow_broadcast: true, name: 'Royal Spice' }] })
      .mockResolvedValueOnce({ rows: [{ used: 2 }] });

    const res = await request(app)
      .post('/restaurant/broadcast')
      .send({ title: 'Weekend Sale', body: '50% off today!' });

    expect(res.status).toBe(429);
    expect(res.body.error).toBe('WEEKLY_QUOTA_EXCEEDED');
  });
});

