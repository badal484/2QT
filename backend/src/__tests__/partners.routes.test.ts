/**
 * HTTP-layer tests for PATCH /admin/partners/applications/:id and
 * PATCH /admin/partners/kitchens/:id.
 *
 * Covers the tenant-consistency fix: approving a partner application creates a kitchen through
 * its own raw INSERT (a route that pre-dates the Phase 3 SaaS tenant model entirely), which
 * previously never created the matching restaurants/outlets/restaurant_users rows — silently
 * leaving every partner-approved restaurant invisible in the Tenants admin view and unbillable.
 * These tests confirm createRestaurantTenantForKitchen and syncTenantMembership are now called
 * on that path, exactly as they already are for the "New Kitchen" button.
 */

import express from 'express';
import request from 'supertest';
import { query } from '../db';
import { authenticate } from '../middleware/auth';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$2b$10$hashedpassword'),
  compare: jest.fn().mockResolvedValue(true),
}));
jest.mock('@imagekit/nodejs', () => jest.fn().mockImplementation(() => ({ upload: jest.fn() })));
jest.mock('multer', () => {
  const m = () => ({ single: () => (_req: any, _res: any, next: any) => next() });
  m.memoryStorage = () => ({});
  return m;
});
jest.mock('razorpay', () => jest.fn().mockImplementation(() => ({ orders: { create: jest.fn() } })));

import adminRouter from '../routes/admin';

const app = express();
app.use(express.json());
app.use('/admin', adminRouter);

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

describe('PATCH /admin/partners/applications/:id — approval creates a full tenant, not just a kitchen', () => {
  const APP_ROW = {
    id: 'app-1', kitchen_id: null, restaurant_name: 'Punjabi Dhaba',
    address: 'HSR Layout', fssai_number: null, phone: '919999999999',
    email: null, upi_id: null, owner_name: 'Ravi',
  };

  it('creates the kitchen, the matching restaurant/outlet tenant, the partner_kitchen user, and syncs their membership — in that order', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });

    mockQuery
      .mockResolvedValueOnce({ rows: [APP_ROW] })                       // 1. SELECT kitchen_applications
      .mockResolvedValueOnce({ rows: [{ id: 'kitchen-new' }] })          // 2. INSERT kitchens
      .mockResolvedValueOnce({ rows: [] })                               // 3. UPDATE kitchen_applications SET kitchen_id
      .mockResolvedValueOnce({ rows: [{ id: 'restaurant-new' }] })       // 4. INSERT restaurants (createRestaurantTenantForKitchen)
      .mockResolvedValueOnce({ rows: [] })                               // 5. UPDATE kitchens SET restaurant_id
      .mockResolvedValueOnce({ rows: [] })                               // 6. INSERT outlets
      .mockResolvedValueOnce({ rows: [{ id: 'user-new' }] })             // 7. INSERT users (partner_kitchen)
      .mockResolvedValueOnce({ rows: [{ restaurant_id: 'restaurant-new' }] }) // 8. syncTenantMembership: SELECT kitchens
      .mockResolvedValueOnce({ rows: [] })                               // 9. syncTenantMembership: UPDATE users
      .mockResolvedValueOnce({ rows: [] })                               // 10. syncTenantMembership: INSERT restaurant_users
      .mockResolvedValueOnce({ rows: [{ id: 'app-1', status: 'approved' }] }); // 11. UPDATE kitchen_applications SET status

    const res = await request(app).patch('/admin/partners/applications/app-1').send({ status: 'approved' });

    expect(res.status).toBe(200);
    expect(res.body.kitchen_id).toBe('kitchen-new');

    const calls = mockQuery.mock.calls;
    expect(calls[1][0]).toContain('INSERT INTO kitchens');
    expect(calls[3][0]).toContain('INSERT INTO restaurants');
    expect(calls[3][1]).toEqual(['Punjabi Dhaba', expect.stringContaining('punjabi-dhaba')]);
    expect(calls[4][0]).toBe('UPDATE kitchens SET restaurant_id = $1 WHERE id = $2');
    expect(calls[4][1]).toEqual(['restaurant-new', 'kitchen-new']);
    expect(calls[5][0]).toContain('INSERT INTO outlets');
    expect(calls[5][1]).toEqual(['restaurant-new', 'Punjabi Dhaba', null, 'kitchen-new']); // no zone yet
    expect(calls[6][0]).toContain('INSERT INTO users');
    expect(calls[7][0]).toBe('SELECT restaurant_id FROM kitchens WHERE id = $1');
    expect(calls[7][1]).toEqual(['kitchen-new']);
    expect(calls[9][1]).toEqual(['restaurant-new', 'user-new', 'partner_kitchen']);
  });

  it('is idempotent — re-approving an application that already has a kitchen_id never re-creates the tenant', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });

    mockQuery
      .mockResolvedValueOnce({ rows: [{ ...APP_ROW, kitchen_id: 'kitchen-existing' }] }) // SELECT — already has a kitchen
      .mockResolvedValueOnce({ rows: [{ id: 'app-1', status: 'approved' }] });            // UPDATE kitchen_applications SET status

    const res = await request(app).patch('/admin/partners/applications/app-1').send({ status: 'approved' });

    expect(res.status).toBe(200);
    expect(res.body.kitchen_id).toBe('kitchen-existing');
    expect(mockQuery).toHaveBeenCalledTimes(2); // no kitchen/restaurant/user creation queries at all
    expect(mockQuery.mock.calls.some((c) => String(c[0]).includes('INSERT INTO restaurants'))).toBe(false);
  });

  it('returns 404 for a nonexistent application without creating anything', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).patch('/admin/partners/applications/nonexistent').send({ status: 'approved' });

    expect(res.status).toBe(404);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('rejecting an application never touches kitchens/restaurants at all', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'app-1', status: 'rejected' }] });

    const res = await request(app).patch('/admin/partners/applications/app-1').send({ status: 'rejected', rejectionReason: 'Incomplete documents' });

    expect(res.status).toBe(200);
    expect(mockQuery).toHaveBeenCalledTimes(1); // just the final UPDATE — approval branch never entered
  });
});

describe('PATCH /admin/partners/kitchens/:id — Setup Drawer keeps the outlet zone in sync', () => {
  it('assigning a zone updates kitchen_zones AND the tenant outlet zone_id together', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });

    const clientCalls: any[] = [];
    const clientMock = {
      query: jest.fn(async (text: string, params?: any[]) => {
        clientCalls.push([text, params]);
        return { rows: [] };
      }),
    };
    const { withTransaction } = require('../db');
    (withTransaction as jest.Mock).mockImplementationOnce(async (cb: any) => cb(clientMock));
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'kitchen-1', name: 'Punjabi Dhaba' }] }); // final SELECT for response

    const res = await request(app).patch('/admin/partners/kitchens/kitchen-1').send({ zoneId: 'zone-1' });

    expect(res.status).toBe(200);
    const outletUpdate = clientCalls.find(([text]) => text.includes('UPDATE outlets SET zone_id'));
    expect(outletUpdate).toBeDefined();
    expect(outletUpdate[1]).toEqual(['zone-1', 'kitchen-1']);
  });

  it('does not touch outlets when no zoneId is supplied (unrelated field update)', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });

    const clientCalls: any[] = [];
    const clientMock = {
      query: jest.fn(async (text: string, params?: any[]) => {
        clientCalls.push([text, params]);
        return { rows: [] };
      }),
    };
    const { withTransaction } = require('../db');
    (withTransaction as jest.Mock).mockImplementationOnce(async (cb: any) => cb(clientMock));
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'kitchen-1', name: 'Punjabi Dhaba' }] });

    const res = await request(app).patch('/admin/partners/kitchens/kitchen-1').send({ commissionRate: 0.15 });

    expect(res.status).toBe(200);
    expect(clientCalls.some(([text]) => text.includes('outlets'))).toBe(false);
  });
});
