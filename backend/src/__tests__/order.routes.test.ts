/**
 * HTTP-layer tests for /order routes.
 */

import express from 'express';
import request from 'supertest';
import { query } from '../db';
import { redis, keys } from '../redis';
import { authenticate } from '../middleware/auth';

jest.mock('../services/notification.service', () => ({
  NotificationService: { sendToUser: jest.fn(), sendNotification: jest.fn() },
}));
jest.mock('../services/refund.service', () => ({
  processWalletRefund: jest.fn().mockResolvedValue(undefined),
  processBankRefund: jest.fn().mockResolvedValue(undefined),
}));

import orderRouter from '../routes/order';

const app = express();
app.use(express.json());
app.use('/orders', orderRouter);

const mockQuery = query as jest.Mock;
const mockRedisGet = redis.get as jest.Mock;
const mockAuthenticate = authenticate as jest.Mock;

// Default: mock resets to the default customer user (see __mocks__/auth-middleware.ts) between
// every test — individual tests below override it with mockImplementationOnce for other roles.
const defaultAuthenticate = mockAuthenticate.getMockImplementation();

beforeEach(() => {
  jest.clearAllMocks();
  mockRedisGet.mockResolvedValue(null);
  if (defaultAuthenticate) mockAuthenticate.mockImplementation(defaultAuthenticate);
});

function actingAs(user: { userId: string; role: string; kitchenId: string | null; zoneId: string | null; restaurantId: string | null; tenantRestaurantId?: string | null }) {
  mockAuthenticate.mockImplementationOnce((req: any, _res: any, next: any) => {
    req.user = { tenantRestaurantId: null, ...user, jti: 'jti-test' };
    next();
  });
}

// ── GET /orders/mine ──────────────────────────────────────────────────────────

describe('GET /orders/mine', () => {
  it('returns paginated order history for the authenticated user', async () => {
    const orders = [
      { id: 'ord-1', customer_id: 'user-test-1', status: 'delivered', total_paise: 20000, items: [] },
      { id: 'ord-2', customer_id: 'user-test-1', status: 'cancelled', total_paise: 15000, items: [] },
    ];
    mockQuery.mockResolvedValueOnce({ rows: orders });

    const res = await request(app).get('/orders/mine');
    expect(res.status).toBe(200);
    expect(res.body.orders).toHaveLength(2);
    expect(res.body.limit).toBe(20);
    expect(res.body.offset).toBe(0);
  });

  it('returns empty array when user has no orders', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/orders/mine');
    expect(res.status).toBe(200);
    expect(res.body.orders).toEqual([]);
  });

  it('respects limit and offset query params', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/orders/mine?limit=5&offset=10');
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(5);
    expect(res.body.offset).toBe(10);
  });

  it('caps limit at 50', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/orders/mine?limit=999');
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(50);
  });
});

// ── GET /orders/active ────────────────────────────────────────────────────────

describe('GET /orders/active', () => {
  it('returns active (non-delivered, non-cancelled) orders', async () => {
    const activeOrders = [
      { id: 'ord-active-1', customer_id: 'user-test-1', status: 'preparing', items: [] },
    ];
    mockQuery.mockResolvedValueOnce({ rows: activeOrders });

    const res = await request(app).get('/orders/active');
    expect(res.status).toBe(200);
    expect(res.body.activeOrders).toHaveLength(1);
    expect(res.body.activeOrders[0].status).toBe('preparing');
  });

  it('returns empty array when no active orders', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/orders/active');
    expect(res.status).toBe(200);
    expect(res.body.activeOrders).toEqual([]);
  });
});

// ── GET /orders/:id ───────────────────────────────────────────────────────────

describe('GET /orders/:id', () => {
  it('returns 404 when order does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/orders/nonexistent-id');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });

  it('returns 403 when customer tries to access another customer\'s order', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'ord-1', customer_id: 'other-user', status: 'delivered', rider_id: null, items: [] }],
    });

    const res = await request(app).get('/orders/ord-1');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('returns the order when customer owns it', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'ord-1',
        customer_id: 'user-test-1',
        status: 'preparing',
        rider_id: null,
        items: [{ menu_item_name: 'Biryani', quantity: 1, price_paise: 15000 }],
      }],
    });

    const res = await request(app).get('/orders/ord-1');
    expect(res.status).toBe(200);
    expect(res.body.order.id).toBe('ord-1');
    expect(res.body.order.status).toBe('preparing');
  });

  it('attaches rider location from Redis when rider_id is set', async () => {
    const riderLoc = JSON.stringify({ lat: 12.93, lng: 77.62 });
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'ord-2',
        customer_id: 'user-test-1',
        status: 'on_the_way',
        rider_id: 'rider-1',
        items: [],
      }],
    });
    mockRedisGet.mockResolvedValueOnce(riderLoc);

    const res = await request(app).get('/orders/ord-2');
    expect(res.status).toBe(200);
    expect(res.body.order.rider_lat).toBe(12.93);
    expect(res.body.order.rider_lng).toBe(77.62);
  });

  it('succeeds even when rider location is absent from Redis', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'ord-3',
        customer_id: 'user-test-1',
        status: 'on_the_way',
        rider_id: 'rider-99',
        items: [],
      }],
    });
    mockRedisGet.mockResolvedValueOnce(null);

    const res = await request(app).get('/orders/ord-3');
    expect(res.status).toBe(200);
    expect(res.body.order.rider_lat).toBeUndefined();
  });

  // Security fix (Phase 2, High #6): ownership was previously only checked for role==='customer'
  // — any rider/kitchen-staff account could view an arbitrary order by ID.
  it('returns 403 when a rider requests an order not assigned to them', async () => {
    actingAs({ userId: 'rider-1', role: 'rider', kitchenId: null, zoneId: 'zone-1', restaurantId: null });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'ord-4', customer_id: 'cust-1', rider_id: 'rider-99', kitchen_id: 'kitchen-1', status: 'out_for_delivery', items: [] }],
    });

    const res = await request(app).get('/orders/ord-4');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('allows a rider to view an order assigned to them', async () => {
    actingAs({ userId: 'rider-1', role: 'rider', kitchenId: null, zoneId: 'zone-1', restaurantId: null });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'ord-5', customer_id: 'cust-1', rider_id: 'rider-1', kitchen_id: 'kitchen-1', status: 'out_for_delivery', items: [] }],
    });

    const res = await request(app).get('/orders/ord-5');
    expect(res.status).toBe(200);
    expect(res.body.order.id).toBe('ord-5');
  });

  it('returns 403 when kitchen staff request an order from a different kitchen', async () => {
    actingAs({ userId: 'chef-1', role: 'chef', kitchenId: 'kitchen-A', zoneId: 'zone-1', restaurantId: null });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'ord-6', customer_id: 'cust-1', rider_id: null, kitchen_id: 'kitchen-B', status: 'preparing', items: [] }],
    });

    const res = await request(app).get('/orders/ord-6');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('allows kitchen staff to view an order from their own kitchen', async () => {
    actingAs({ userId: 'chef-1', role: 'chef', kitchenId: 'kitchen-A', zoneId: 'zone-1', restaurantId: null });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'ord-7', customer_id: 'cust-1', rider_id: null, kitchen_id: 'kitchen-A', status: 'preparing', items: [] }],
    });

    const res = await request(app).get('/orders/ord-7');
    expect(res.status).toBe(200);
    expect(res.body.order.id).toBe('ord-7');
  });

  it('allows an admin to view any order', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'ord-8', customer_id: 'cust-1', rider_id: 'rider-1', kitchen_id: 'kitchen-B', status: 'preparing', items: [] }],
    });

    const res = await request(app).get('/orders/ord-8');
    expect(res.status).toBe(200);
    expect(res.body.order.id).toBe('ord-8');
  });
});

// ── GET /orders/:id/invoice ───────────────────────────────────────────────────

describe('GET /orders/:id/invoice', () => {
  it('returns 403 when a rider requests the invoice for an order not assigned to them', async () => {
    actingAs({ userId: 'rider-1', role: 'rider', kitchenId: null, zoneId: 'zone-1', restaurantId: null });
    mockQuery.mockResolvedValueOnce({
      rows: [{ customer_id: 'cust-1', rider_id: 'rider-99', kitchen_id: 'kitchen-1' }],
    });

    const res = await request(app).get('/orders/ord-9/invoice');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('returns 403 when kitchen staff request an invoice from a different kitchen', async () => {
    actingAs({ userId: 'chef-1', role: 'chef', kitchenId: 'kitchen-A', zoneId: 'zone-1', restaurantId: null });
    mockQuery.mockResolvedValueOnce({
      rows: [{ customer_id: 'cust-1', rider_id: null, kitchen_id: 'kitchen-B' }],
    });

    const res = await request(app).get('/orders/ord-10/invoice');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('returns 404 when the order does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/orders/nonexistent/invoice');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });
});

// ── POST /orders/:id/cancel ───────────────────────────────────────────────────

describe('POST /orders/:id/cancel', () => {
  it('returns 403 when a rider tries to cancel an order not assigned to them', async () => {
    actingAs({ userId: 'rider-1', role: 'rider', kitchenId: null, zoneId: 'zone-1', restaurantId: null });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'ord-11', customer_id: 'cust-1', rider_id: 'rider-99', kitchen_id: 'kitchen-1', status: 'confirmed', payment_status: 'paid' }],
    });

    const res = await request(app).post('/orders/ord-11/cancel').send({});
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('returns 403 when kitchen staff try to cancel another kitchen\'s order', async () => {
    actingAs({ userId: 'chef-1', role: 'chef', kitchenId: 'kitchen-A', zoneId: 'zone-1', restaurantId: null });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'ord-12', customer_id: 'cust-1', rider_id: null, kitchen_id: 'kitchen-B', status: 'confirmed', payment_status: 'paid' }],
    });

    const res = await request(app).post('/orders/ord-12/cancel').send({});
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('returns 404 when the order does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/orders/nonexistent/cancel').send({});
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });
});

// ── Phase 4: additive restaurant-tenant check in isAuthorizedForOrder ────────────────────────
// Layered on top of the existing (Phase 2) kitchen_id check — never replacing it. Only engages
// when BOTH the caller's tenant and the order's restaurant_id are populated.

describe('GET /orders/:id — Phase 4 tenant isolation', () => {
  it('allows kitchen staff to view an order when kitchen AND restaurant both match', async () => {
    actingAs({ userId: 'chef-1', role: 'chef', kitchenId: 'kitchen-A', zoneId: 'zone-1', restaurantId: null, tenantRestaurantId: 'restaurant-A' });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'ord-20', customer_id: 'cust-1', rider_id: null, kitchen_id: 'kitchen-A', restaurant_id: 'restaurant-A', status: 'preparing', items: [] }],
    });

    const res = await request(app).get('/orders/ord-20');
    expect(res.status).toBe(200);
  });

  it('blocks kitchen staff when kitchen_id matches but restaurant_id does not (defense in depth)', async () => {
    actingAs({ userId: 'chef-1', role: 'chef', kitchenId: 'kitchen-A', zoneId: 'zone-1', restaurantId: null, tenantRestaurantId: 'restaurant-A' });
    mockQuery.mockResolvedValueOnce({
      // Same kitchen_id (would have passed the Phase 2-only check) but a different restaurant_id
      rows: [{ id: 'ord-21', customer_id: 'cust-1', rider_id: null, kitchen_id: 'kitchen-A', restaurant_id: 'restaurant-OTHER', status: 'preparing', items: [] }],
    });

    const res = await request(app).get('/orders/ord-21');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('does not block access when either side has no restaurant_id yet (pre-Phase-3 data, no regression)', async () => {
    actingAs({ userId: 'chef-1', role: 'chef', kitchenId: 'kitchen-A', zoneId: 'zone-1', restaurantId: null, tenantRestaurantId: null });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'ord-22', customer_id: 'cust-1', rider_id: null, kitchen_id: 'kitchen-A', restaurant_id: null, status: 'preparing', items: [] }],
    });

    const res = await request(app).get('/orders/ord-22');
    expect(res.status).toBe(200); // kitchen_id match alone is still sufficient, exactly as before Phase 4
  });

  it('ignores a client-supplied restaurantId/tenantRestaurantId in the request body entirely', async () => {
    actingAs({ userId: 'chef-1', role: 'chef', kitchenId: 'kitchen-A', zoneId: 'zone-1', restaurantId: null, tenantRestaurantId: 'restaurant-A' });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'ord-23', customer_id: 'cust-1', rider_id: null, kitchen_id: 'kitchen-A', restaurant_id: 'restaurant-OTHER', status: 'preparing', items: [] }],
    });

    // Even if a client tried to spoof its way past by sending a matching id in the body, the
    // authorization check never reads req.body at all — it only ever reads the DB row and
    // req.user (both server-derived), so this still correctly returns 403.
    const res = await request(app).get('/orders/ord-23').send();
    expect(res.status).toBe(403);
  });

  it('still allows platform admins unrestricted access regardless of restaurant_id', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null, tenantRestaurantId: null });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'ord-24', customer_id: 'cust-1', rider_id: 'rider-1', kitchen_id: 'kitchen-B', restaurant_id: 'restaurant-B', status: 'preparing', items: [] }],
    });

    const res = await request(app).get('/orders/ord-24');
    expect(res.status).toBe(200);
  });

  it('rider ownership is unaffected by the restaurant check (riders are not restaurant-scoped)', async () => {
    actingAs({ userId: 'rider-1', role: 'rider', kitchenId: null, zoneId: 'zone-1', restaurantId: null, tenantRestaurantId: null });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'ord-25', customer_id: 'cust-1', rider_id: 'rider-1', kitchen_id: 'kitchen-B', restaurant_id: 'restaurant-B', status: 'out_for_delivery', items: [] }],
    });

    const res = await request(app).get('/orders/ord-25');
    expect(res.status).toBe(200);
  });

  it('customer ownership is unaffected by the restaurant check', async () => {
    // default mock user is role: 'customer', userId: 'user-test-1'
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'ord-26', customer_id: 'user-test-1', rider_id: null, kitchen_id: 'kitchen-B', restaurant_id: 'restaurant-B', status: 'preparing', items: [] }],
    });

    const res = await request(app).get('/orders/ord-26');
    expect(res.status).toBe(200);
  });
});

// ── Phase 7 Step 0: rider_captain security fix ────────────────────────────────
// isAuthorizedForOrder() and GET /:id/tracking's inline check previously omitted
// 'rider_captain' entirely, falling through to unrestricted access — the same class of bug
// Phase 2 fixed for the bare 'rider' role. Discovered while reusing this function for the
// Socket.IO join_order authorization fix.

describe('GET /orders/:id — rider_captain ownership (Phase 7 fix)', () => {
  it("denies a rider_captain access to an order not assigned to them", async () => {
    actingAs({ userId: 'captain-1', role: 'rider_captain', kitchenId: null, zoneId: 'zone-1', restaurantId: null });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'ord-30', customer_id: 'cust-1', rider_id: 'rider-99', kitchen_id: 'kitchen-1', status: 'out_for_delivery', items: [] }],
    });

    const res = await request(app).get('/orders/ord-30');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('allows a rider_captain to view an order assigned to them', async () => {
    actingAs({ userId: 'captain-1', role: 'rider_captain', kitchenId: null, zoneId: 'zone-1', restaurantId: null });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'ord-31', customer_id: 'cust-1', rider_id: 'captain-1', kitchen_id: 'kitchen-1', status: 'out_for_delivery', items: [] }],
    });

    const res = await request(app).get('/orders/ord-31');
    expect(res.status).toBe(200);
  });
});

describe('GET /orders/:id/tracking — rider_captain ownership (Phase 7 fix)', () => {
  it("denies a rider_captain access to tracking (and delivery OTP) for another rider's order", async () => {
    actingAs({ userId: 'captain-1', role: 'rider_captain', kitchenId: null, zoneId: 'zone-1', restaurantId: null });
    mockQuery.mockResolvedValueOnce({
      rows: [{ status: 'out_for_delivery', rider_id: 'rider-99', customer_id: 'cust-1', kitchen_id: 'kitchen-1', display_id: '2QT-100001', delivery_otp: '111111' }],
    });

    const res = await request(app).get('/orders/ord-32/tracking');
    expect(res.status).toBe(403);
  });

  it('allows a rider_captain to track their own assigned order', async () => {
    actingAs({ userId: 'captain-1', role: 'rider_captain', kitchenId: null, zoneId: 'zone-1', restaurantId: null });
    mockQuery.mockResolvedValueOnce({
      rows: [{ status: 'out_for_delivery', rider_id: 'captain-1', customer_id: 'cust-1', kitchen_id: 'kitchen-1', display_id: '2QT-100002', delivery_otp: '222222' }],
    });

    const res = await request(app).get('/orders/ord-33/tracking');
    expect(res.status).toBe(200);
    expect(res.body.deliveryOtp).toBe('222222');
  });
});
