/**
 * Unit tests for the REAL authenticate() middleware in middleware/auth.ts.
 *
 * Every other test file imports '../middleware/auth' through the global moduleNameMapper mock
 * (see jest.config.js / __mocks__/auth-middleware.ts) so route tests don't need a real JWT. That
 * mapper rewrites the module specifier itself, so jest.requireActual — which only bypasses
 * Jest's mock *registry*, not moduleNameMapper redirection — still resolves to the mock here
 * (verified empirically). Requiring the file via an absolute path sidesteps the string-pattern
 * match entirely and loads the genuine implementation, which is what this file needs to prove
 * the Phase 3 addition (req.user.tenantRestaurantId) is actually derived server-side from the
 * database, never from client-supplied input, and doesn't disturb the existing (unrelated)
 * req.user.restaurantId dine-in field.
 */

import jwt from 'jsonwebtoken';
import path from 'path';
import { query } from '../db';
import { redis } from '../redis';

const { authenticate } = require(path.resolve(__dirname, '../middleware/auth'));

const mockQuery = query as jest.Mock;
const mockRedisGet = redis.get as jest.Mock;

function makeReq(overrides: { body?: any; query?: any; headers?: Record<string, string> } = {}) {
  const token = jwt.sign({ userId: 'user-1', jti: 'jti-1' }, process.env.JWT_SECRET!);
  return {
    headers: { authorization: `Bearer ${token}`, ...(overrides.headers || {}) },
    body: overrides.body || {},
    query: overrides.query || {},
  } as any;
}

function makeRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRedisGet.mockResolvedValue(null); // cache miss, token not revoked
});

describe('authenticate() — req.user.tenantRestaurantId (Phase 3 tenant foundation)', () => {
  it('derives tenantRestaurantId from users.restaurant_id, server-side', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        role: 'chef', kitchen_id: 'kitchen-1', zone_id: 'zone-1',
        dine_in_restaurant_id: null, restaurant_id: 'restaurant-1', is_active: true,
      }],
    });

    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user.tenantRestaurantId).toBe('restaurant-1');
  });

  it('keeps the existing dine-in restaurantId and the new tenantRestaurantId fully independent', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        role: 'dine_in_staff', kitchen_id: null, zone_id: null,
        dine_in_restaurant_id: 'dine-in-restaurant-1', restaurant_id: null, is_active: true,
      }],
    });

    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(req.user.restaurantId).toBe('dine-in-restaurant-1'); // unaffected, unrelated field
    expect(req.user.tenantRestaurantId).toBeNull();
  });

  it('never reads restaurant scope from client-supplied body, query, or headers', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        role: 'chef', kitchen_id: 'kitchen-1', zone_id: 'zone-1',
        dine_in_restaurant_id: null, restaurant_id: 'restaurant-real', is_active: true,
      }],
    });

    const req = makeReq({
      body: { tenantRestaurantId: 'restaurant-fake', restaurantId: 'restaurant-fake', restaurant_id: 'restaurant-fake' },
      query: { restaurant_id: 'restaurant-fake', restaurantId: 'restaurant-fake' },
      headers: { 'x-restaurant-id': 'restaurant-fake' },
    });
    const res = makeRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(req.user.tenantRestaurantId).toBe('restaurant-real');
    // The DB lookup is keyed only on the JWT's decoded userId — nothing from body/query/headers
    // is ever passed into the query, confirming there is no code path for a client override.
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('restaurant_id'), ['user-1']);
  });

  it('returns tenantRestaurantId = null for a user with no restaurant relationship yet, without failing auth', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        role: 'customer', kitchen_id: null, zone_id: null,
        dine_in_restaurant_id: null, restaurant_id: null, is_active: true,
      }],
    });

    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1); // existing users aren't rejected for lacking a restaurant
    expect(res.status).not.toHaveBeenCalled();
    expect(req.user.tenantRestaurantId).toBeNull();
  });

  it('populates tenantRestaurantId from the 60s Redis cache, not just on a fresh DB read', async () => {
    // authenticate() checks two Redis keys in parallel (revoked-token, then cached-user) via
    // Promise.all — the array is built in that order, so the first queued value answers the
    // revoked-token check and the second answers the cached-user lookup.
    mockRedisGet
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(JSON.stringify({
        role: 'chef', kitchen_id: 'kitchen-1', zone_id: 'zone-1',
        dine_in_restaurant_id: null, restaurant_id: 'restaurant-cached', is_active: true,
      }));

    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(mockQuery).not.toHaveBeenCalled(); // served entirely from cache
    expect(req.user.tenantRestaurantId).toBe('restaurant-cached');
  });
});
