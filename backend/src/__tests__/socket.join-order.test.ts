/**
 * Unit tests for canJoinOrderRoom() (utils/orderAuth.ts) — the Phase 7 Step 0 security fix for
 * Socket.IO's join_order handler.
 *
 * This function is deliberately NOT defined inside socket/index.ts, precisely so it can be
 * tested without loading socket.io/@socket.io/redis-adapter/@socket.io/redis-emitter/
 * jsonwebtoken — none of which are mocked by this project's jest config, and which (confirmed
 * empirically: reproduced against the pre-Phase-7 baseline, which showed zero such flakiness
 * across 10 repeated runs, then reproduced again after this file alone was added) caused
 * intermittent cross-test-file interference when loaded for real in a test process. Importing
 * this small, single-purpose module instead avoids that import chain entirely.
 *
 * '../utils/orderAuth' is not covered by jest.config.js's moduleNameMapper (only db/redis/
 * socket/middleware-auth/firebaseAdmin are), so this is a normal, unmocked import of the real
 * module — no bypass technique needed. It does still transitively import the real
 * routes/order.ts (for isAuthorizedForOrder), which needs these two service mocks exactly as
 * every other test file that touches order.ts already provides (order.routes.test.ts,
 * rider.routes.test.ts).
 */

jest.mock('../services/notification.service', () => ({
  NotificationService: { send: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('../services/refund.service', () => ({
  processWalletRefund: jest.fn().mockResolvedValue(undefined),
  processBankRefund: jest.fn().mockResolvedValue(undefined),
}));

import { canJoinOrderRoom } from '../utils/orderAuth';

const CUSTOMER_ORDER = { customer_id: 'cust-1', rider_id: 'rider-1', kitchen_id: 'kitchen-A', restaurant_id: 'restaurant-A' };

describe('canJoinOrderRoom — customer', () => {
  it('1. customer can join their own order', () => {
    const user = { userId: 'cust-1', role: 'customer' };
    expect(canJoinOrderRoom(user, CUSTOMER_ORDER)).toBe(true);
  });

  it("2. customer cannot join another customer's order", () => {
    const user = { userId: 'cust-2', role: 'customer' };
    expect(canJoinOrderRoom(user, CUSTOMER_ORDER)).toBe(false);
  });
});

describe('canJoinOrderRoom — rider / rider_captain', () => {
  it('3. rider can join an order assigned to them', () => {
    const user = { userId: 'rider-1', role: 'rider' };
    expect(canJoinOrderRoom(user, CUSTOMER_ORDER)).toBe(true);
  });

  it("4. rider cannot join another rider's order", () => {
    const user = { userId: 'rider-2', role: 'rider' };
    expect(canJoinOrderRoom(user, CUSTOMER_ORDER)).toBe(false);
  });

  it('rider_captain follows the identical rule as rider (Phase 7 fix — was previously unrestricted)', () => {
    const own = { userId: 'captain-1', role: 'rider_captain' };
    const other = { userId: 'captain-2', role: 'rider_captain' };
    expect(canJoinOrderRoom(own, { ...CUSTOMER_ORDER, rider_id: 'captain-1' })).toBe(true);
    expect(canJoinOrderRoom(other, { ...CUSTOMER_ORDER, rider_id: 'captain-1' })).toBe(false);
  });
});

describe('canJoinOrderRoom — kitchen staff', () => {
  it('5. kitchen staff can join an order from their own kitchen', () => {
    const user = { userId: 'chef-1', role: 'chef', kitchenId: 'kitchen-A' };
    expect(canJoinOrderRoom(user, CUSTOMER_ORDER)).toBe(true);
  });

  it("6. cross-kitchen access is denied", () => {
    const user = { userId: 'chef-2', role: 'chef', kitchenId: 'kitchen-B' };
    expect(canJoinOrderRoom(user, CUSTOMER_ORDER)).toBe(false);
  });

  it('7. cross-restaurant access is denied even when kitchen_id happens to match (defense in depth, Phase 4 tenant check)', () => {
    // Same kitchen_id as the order (would pass a kitchen-only check) but a different tenant.
    const user = { userId: 'chef-3', role: 'chef', kitchenId: 'kitchen-A', tenantRestaurantId: 'restaurant-OTHER' };
    expect(canJoinOrderRoom(user, CUSTOMER_ORDER)).toBe(false);
  });

  it('kitchen staff with no restaurant tenant assigned yet still works via the kitchen_id check alone (no regression)', () => {
    const user = { userId: 'chef-1', role: 'chef', kitchenId: 'kitchen-A', tenantRestaurantId: null };
    expect(canJoinOrderRoom(user, CUSTOMER_ORDER)).toBe(true);
  });
});

describe('canJoinOrderRoom — platform admin', () => {
  it('8. platform admin (super_admin/admin) retains unrestricted access', () => {
    expect(canJoinOrderRoom({ userId: 'admin-1', role: 'super_admin' }, CUSTOMER_ORDER)).toBe(true);
    expect(canJoinOrderRoom({ userId: 'admin-2', role: 'admin' }, CUSTOMER_ORDER)).toBe(true);
  });

  it('finance/support (trusted platform-staff fallthrough) also retain access, unchanged from existing behavior', () => {
    expect(canJoinOrderRoom({ userId: 'fin-1', role: 'finance' }, CUSTOMER_ORDER)).toBe(true);
    expect(canJoinOrderRoom({ userId: 'sup-1', role: 'support' }, CUSTOMER_ORDER)).toBe(true);
  });
});

describe('canJoinOrderRoom — client spoofing and malformed identity', () => {
  it('9. no client-supplied field can substitute for server-derived identity — the function has no such parameter', () => {
    // canJoinOrderRoom's only inputs are the server-populated socket "user" object (set by the
    // io.use() JWT+DB-lookup middleware) and the real order row fetched by kitchen/restaurant_id
    // from the database. There is no orderId-adjacent "claimed restaurantId" field anywhere in
    // this signature for a client to spoof — proven here by attempting exactly that and
    // confirming it has zero effect: only the real order.kitchen_id is what's compared against.
    const spoofedLookingUser: any = {
      userId: 'rider-2', role: 'rider',
      restaurantId: 'restaurant-A', tenantRestaurantId: 'restaurant-A', kitchenId: 'kitchen-A', zoneId: 'zone-A',
    };
    // Despite every tenant-shaped field matching the order, rider-2 is still not order rider-1's
    // assigned rider — the only field that actually governs a rider's access (rider_id) doesn't
    // match, so access is still denied.
    expect(canJoinOrderRoom(spoofedLookingUser, CUSTOMER_ORDER)).toBe(false);
  });

  it('unauthenticated ("guest") sockets are always denied, regardless of role fallthrough', () => {
    expect(canJoinOrderRoom({ userId: 'guest', role: 'guest' }, CUSTOMER_ORDER)).toBe(false);
  });

  it('a missing/malformed user object is denied, not treated as a trusted-staff fallthrough', () => {
    expect(canJoinOrderRoom(null, CUSTOMER_ORDER)).toBe(false);
    expect(canJoinOrderRoom(undefined, CUSTOMER_ORDER)).toBe(false);
    expect(canJoinOrderRoom({}, CUSTOMER_ORDER)).toBe(false);
    expect(canJoinOrderRoom({ role: 'customer' }, CUSTOMER_ORDER)).toBe(false); // no userId
  });
});

describe('canJoinOrderRoom — unknown order', () => {
  it('10. a nonexistent order (null row) is rejected safely for every role, including admin', () => {
    expect(canJoinOrderRoom({ userId: 'cust-1', role: 'customer' }, null)).toBe(false);
    expect(canJoinOrderRoom({ userId: 'admin-1', role: 'super_admin' }, undefined)).toBe(false);
  });
});
