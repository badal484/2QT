/**
 * Unit tests for utils/tenant.ts — the Phase 4 tenant-consumption helpers.
 */

import { query } from '../db';
import {
  isPlatformAdmin,
  getTenantRestaurantId,
  isActiveRestaurantMember,
  syncTenantMembership,
  deactivateTenantMembership,
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
