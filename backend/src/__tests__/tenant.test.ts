/**
 * Unit tests for utils/tenant.ts — the Phase 4/5 tenant-consumption helpers.
 */

import { query } from '../db';
import {
  isPlatformAdmin,
  getTenantRestaurantId,
  isActiveRestaurantMember,
  syncTenantMembership,
  deactivateTenantMembership,
  requireActiveRestaurantMembership,
  createRestaurantTenantForKitchen,
  RESTAURANT_DASHBOARD_ROLES,
} from '../utils/tenant';

const mockQuery = query as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('isPlatformAdmin', () => {
  it('returns true for super_admin and admin', () => {
    expect(isPlatformAdmin('super_admin')).toBe(true);
    expect(isPlatformAdmin('admin')).toBe(true);
  });

  it('returns false for every restaurant-scoped or platform-non-admin role', () => {
    for (const role of ['chef', 'kitchen_manager', 'packer', 'partner_kitchen', 'rider', 'rider_captain', 'customer', 'finance', 'support', 'dine_in_staff', 'partner']) {
      expect(isPlatformAdmin(role)).toBe(false);
    }
  });
});

describe('getTenantRestaurantId', () => {
  it('returns req.user.tenantRestaurantId when set', () => {
    const req: any = { user: { tenantRestaurantId: 'restaurant-1' } };
    expect(getTenantRestaurantId(req)).toBe('restaurant-1');
  });

  it('returns null when tenantRestaurantId is null', () => {
    const req: any = { user: { tenantRestaurantId: null } };
    expect(getTenantRestaurantId(req)).toBeNull();
  });

  it('returns null when req.user is undefined (never throws)', () => {
    const req: any = {};
    expect(getTenantRestaurantId(req)).toBeNull();
  });

  it('never reads a client-supplied field — only req.user, ignoring body/query/headers entirely', () => {
    const req: any = {
      user: { tenantRestaurantId: 'restaurant-real' },
      body: { tenantRestaurantId: 'restaurant-fake', restaurantId: 'restaurant-fake' },
      query: { restaurant_id: 'restaurant-fake' },
      headers: { 'x-restaurant-id': 'restaurant-fake' },
    };
    expect(getTenantRestaurantId(req)).toBe('restaurant-real');
  });
});

describe('isActiveRestaurantMember', () => {
  it('returns true when an active membership row exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    const result = await isActiveRestaurantMember('user-1', 'restaurant-1');
    expect(result).toBe(true);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("status = 'active'"), ['user-1', 'restaurant-1']);
  });

  it('returns false when no active membership row exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const result = await isActiveRestaurantMember('user-1', 'restaurant-1');
    expect(result).toBe(false);
  });
});

describe('syncTenantMembership', () => {
  it("sets users.restaurant_id and upserts an active restaurant_users row from the kitchen's restaurant_id", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ restaurant_id: 'restaurant-1' }] }) // kitchen lookup
      .mockResolvedValueOnce({ rows: [] }) // UPDATE users
      .mockResolvedValueOnce({ rows: [] }); // UPSERT restaurant_users

    await syncTenantMembership(mockQuery, 'user-1', 'kitchen-1', 'chef');

    expect(mockQuery).toHaveBeenNthCalledWith(1, 'SELECT restaurant_id FROM kitchens WHERE id = $1', ['kitchen-1']);
    expect(mockQuery).toHaveBeenNthCalledWith(2, expect.stringContaining('UPDATE users SET restaurant_id'), ['restaurant-1', 'user-1']);
    expect(mockQuery).toHaveBeenNthCalledWith(3, expect.stringContaining('INSERT INTO restaurant_users'), ['restaurant-1', 'user-1', 'chef']);
  });

  it('is a safe no-op when the kitchen has no restaurant_id yet', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ restaurant_id: null }] });

    await syncTenantMembership(mockQuery, 'user-1', 'kitchen-1', 'chef');

    expect(mockQuery).toHaveBeenCalledTimes(1); // only the lookup — no UPDATE/INSERT attempted
  });

  it('is a safe no-op when the kitchen does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await syncTenantMembership(mockQuery, 'user-1', 'nonexistent-kitchen', 'chef');

    expect(mockQuery).toHaveBeenCalledTimes(1);
  });
});

describe('deactivateTenantMembership', () => {
  it("nulls users.restaurant_id and deactivates (not deletes) the user's restaurant_users row", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });

    await deactivateTenantMembership(mockQuery, 'user-1');

    expect(mockQuery).toHaveBeenNthCalledWith(1, 'UPDATE users SET restaurant_id = NULL WHERE id = $1', ['user-1']);
    expect(mockQuery).toHaveBeenNthCalledWith(2, expect.stringContaining("SET status = 'inactive'"), ['user-1']);
    // Never a DELETE — membership history must be preserved
    expect(mockQuery.mock.calls.some((c) => String(c[0]).toUpperCase().startsWith('DELETE'))).toBe(false);
  });
});

describe('createRestaurantTenantForKitchen', () => {
  it('creates the restaurant, links it to the kitchen, and creates a matching outlet — using the kitchen name when no restaurant name is given', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'restaurant-new' }] }) // INSERT restaurants
      .mockResolvedValueOnce({ rows: [] }) // UPDATE kitchens
      .mockResolvedValueOnce({ rows: [] }); // INSERT outlets

    const restaurantId = await createRestaurantTenantForKitchen(mockQuery, 'kitchen-1', 'Punjabi Dhaba', 'zone-1');

    expect(restaurantId).toBe('restaurant-new');
    expect(mockQuery).toHaveBeenNthCalledWith(1, expect.stringContaining('INSERT INTO restaurants'), ['Punjabi Dhaba', expect.stringContaining('punjabi-dhaba-kitchen-')]);
    expect(mockQuery).toHaveBeenNthCalledWith(2, 'UPDATE kitchens SET restaurant_id = $1 WHERE id = $2', ['restaurant-new', 'kitchen-1']);
    expect(mockQuery).toHaveBeenNthCalledWith(3, expect.stringContaining('INSERT INTO outlets'), ['restaurant-new', 'Punjabi Dhaba', 'zone-1', 'kitchen-1']);
  });

  it('uses an independently-supplied restaurant name instead of the kitchen name when given', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'restaurant-new' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await createRestaurantTenantForKitchen(mockQuery, 'kitchen-1', 'Punjabi Dhaba HSR', 'zone-1', 'Punjabi Dhaba');

    expect(mockQuery).toHaveBeenNthCalledWith(1, expect.any(String), ['Punjabi Dhaba', expect.any(String)]);
    expect(mockQuery).toHaveBeenNthCalledWith(3, expect.any(String), ['restaurant-new', 'Punjabi Dhaba', 'zone-1', 'kitchen-1']);
  });

  it('accepts a null zoneId (partner kitchens have no zone yet at approval time)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'restaurant-new' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await createRestaurantTenantForKitchen(mockQuery, 'kitchen-1', 'New Partner Kitchen', null);

    expect(mockQuery).toHaveBeenNthCalledWith(3, expect.any(String), ['restaurant-new', 'New Partner Kitchen', null, 'kitchen-1']);
  });

  it('falls back to a generic slug base when the name has no alphanumeric characters', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'restaurant-new' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await createRestaurantTenantForKitchen(mockQuery, 'kitchen-1', '★★★', 'zone-1');

    const [, slug] = mockQuery.mock.calls[0][1];
    expect(slug).toBe(`restaurant-${'kitchen-1'.slice(0, 8)}`);
  });
});

// Phase 5: the restaurant-dashboard access gate. See restaurant.routes.test.ts for full
// HTTP-level coverage; these are direct unit tests of the middleware function in isolation.
describe('requireActiveRestaurantMembership', () => {
  function makeReqRes(user: any) {
    const req: any = { user };
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    const next = jest.fn();
    return { req, res, next };
  }

  it('lists exactly the four restaurant-scoped roles', () => {
    expect(RESTAURANT_DASHBOARD_ROLES.sort()).toEqual(['chef', 'kitchen_manager', 'packer', 'partner_kitchen'].sort());
  });

  it('calls next() for an active member', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    const { req, res, next } = makeReqRes({ userId: 'chef-1', role: 'chef', tenantRestaurantId: 'restaurant-A' });

    await requireActiveRestaurantMembership(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects a disallowed role before ever querying the database', async () => {
    const { req, res, next } = makeReqRes({ userId: 'rider-1', role: 'rider', tenantRestaurantId: 'restaurant-A' });

    await requireActiveRestaurantMembership(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('rejects a null tenantRestaurantId before querying the database', async () => {
    const { req, res, next } = makeReqRes({ userId: 'chef-1', role: 'chef', tenantRestaurantId: null });

    await requireActiveRestaurantMembership(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('rejects when no active membership row exists (wrong restaurant or deactivated membership)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const { req, res, next } = makeReqRes({ userId: 'chef-1', role: 'chef', tenantRestaurantId: 'restaurant-A' });

    await requireActiveRestaurantMembership(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
