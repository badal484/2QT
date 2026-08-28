/**
 * HTTP-layer tests for /menu routes.
 * Covers: zones, menu items, validate-cart, kitchen-metrics.
 */

import express from 'express';
import request from 'supertest';
import { query } from '../db';
import { redis, keys } from '../redis';
import { authenticate } from '../middleware/auth';

global.fetch = jest.fn();

import menuRouter from '../routes/menu';

const app = express();
app.use(express.json());
app.use('/menu', menuRouter);

const mockQuery = query as jest.Mock;
const mockRedisGet = redis.get as jest.Mock;
const mockRedisSet = redis.set as jest.Mock;
const mockAuthenticate = authenticate as jest.Mock;
const defaultAuthenticate = mockAuthenticate.getMockImplementation();

function actingAs(user: { userId: string; role: string; kitchenId: string | null; zoneId: string | null; restaurantId: string | null }) {
  mockAuthenticate.mockImplementationOnce((req: any, _res: any, next: any) => {
    req.user = { ...user, jti: 'jti-test' };
    next();
  });
}

const ZONE_ID = 'zone-uuid-1';

function makeMenuQueryMocks() {
  mockRedisGet.mockResolvedValueOnce(null); // cache miss
  mockQuery
    .mockResolvedValueOnce({ rows: [{ id: 'item-1', name: 'Biryani', price_paise: 15000, available: true, zone_id: ZONE_ID }] }) // items
    .mockResolvedValueOnce({ rows: [{ name: 'Zone A', opening_time: '09:00', closing_time: '22:00', surge_enabled: false, surge_fee_paise: 0 }] }) // zone
    .mockResolvedValueOnce({ rows: [{ id: 'k-1', name: 'Kitchen 1', is_paused: false, pause_reason: null, pause_until: null }] }) // kitchen
    .mockResolvedValueOnce({ rows: [] }); // offers
  mockRedisSet.mockResolvedValue('OK');
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRedisGet.mockResolvedValue(null);
  mockRedisSet.mockResolvedValue('OK');
  if (defaultAuthenticate) mockAuthenticate.mockImplementation(defaultAuthenticate);
});

// ── GET /menu/zones ──────────────────────────────────────────────────────────

describe('GET /menu/zones', () => {
  it('returns active zones', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: ZONE_ID, name: 'Zone A', radius_km: 5, kitchen_lat: 12.9, kitchen_lng: 77.6 }] });
    const res = await request(app).get('/menu/zones');
    expect(res.status).toBe(200);
    expect(res.body.zones).toHaveLength(1);
    expect(res.body.zones[0].name).toBe('Zone A');
  });

  it('returns empty array when no zones active', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/menu/zones');
    expect(res.status).toBe(200);
    expect(res.body.zones).toHaveLength(0);
  });
});

// ── GET /menu/kitchen-metrics ─────────────────────────────────────────────────

describe('GET /menu/kitchen-metrics', () => {
  it('returns 400 when zoneId is missing', async () => {
    const res = await request(app).get('/menu/kitchen-metrics');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('MISSING_ZONE');
  });

  it('returns metrics for a zone', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ zone_id: ZONE_ID, avg_prep_minutes: 20 }] });
    const res = await request(app).get(`/menu/kitchen-metrics?zoneId=${ZONE_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.metrics.avg_prep_minutes).toBe(20);
  });

  it('returns { metrics: null } when no data found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get(`/menu/kitchen-metrics?zoneId=${ZONE_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.metrics).toBeNull();
  });
});

// ── GET /menu ─────────────────────────────────────────────────────────────────

describe('GET /menu', () => {
  it('returns 400 when zoneId is missing', async () => {
    const res = await request(app).get('/menu/');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('MISSING_ZONE');
  });

  it('returns menu items from DB when cache is empty', async () => {
    makeMenuQueryMocks();
    const res = await request(app).get(`/menu/?zoneId=${ZONE_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].name).toBe('Biryani');
    expect(res.body.fromCache).toBeFalsy();
  });

  it('returns menu from Redis cache when cache hit', async () => {
    const cached = JSON.stringify({
      items: [{ id: 'item-cached', name: 'Cached Biryani', price_paise: 14000, available: true }],
      zone: { name: 'Zone A' },
      kitchen: null,
      offers: [],
    });
    mockRedisGet.mockResolvedValueOnce(cached);

    const res = await request(app).get(`/menu/?zoneId=${ZONE_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.fromCache).toBe(true);
    expect(res.body.items[0].name).toBe('Cached Biryani');
  });

  it('includes Cache-Control header on fresh DB response', async () => {
    makeMenuQueryMocks();
    const res = await request(app).get(`/menu/?zoneId=${ZONE_ID}`);
    expect(res.headers['cache-control']).toContain('max-age=60');
  });

  it('saves result to Redis after DB fetch', async () => {
    makeMenuQueryMocks();
    await request(app).get(`/menu/?zoneId=${ZONE_ID}`);
    expect(mockRedisSet).toHaveBeenCalledWith(
      keys.menu(ZONE_ID),
      expect.any(String),
      expect.objectContaining({ EX: expect.any(Number) })
    );
  });
});

// ── GET /menu/geocode/search ──────────────────────────────────────────────────

describe('GET /menu/geocode/search', () => {
  it('returns 400 when q is missing', async () => {
    const res = await request(app).get('/menu/geocode/search');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('MISSING_QUERY');
  });

  it('returns 400 when q is too short', async () => {
    const res = await request(app).get('/menu/geocode/search?q=a');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('MISSING_QUERY');
  });

  it('proxies Nominatim response on Google API key absent', async () => {
    delete process.env.GOOGLE_MAPS_API_KEY;
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [{ place_id: 'p1', display_name: 'Bengaluru, Karnataka', lat: '12.97', lon: '77.59' }],
    });

    const res = await request(app).get('/menu/geocode/search?q=Bengaluru');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ── GET /menu/geocode/reverse ─────────────────────────────────────────────────

describe('GET /menu/geocode/reverse', () => {
  it('returns 400 for invalid coordinates', async () => {
    const res = await request(app).get('/menu/geocode/reverse?lat=notanumber&lng=77.59');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_COORDS');
  });

  it('calls Nominatim when no Google key', async () => {
    delete process.env.GOOGLE_MAPS_API_KEY;
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        name: 'Koramangala',
        display_name: 'Koramangala, Bangalore, Karnataka, India',
        address: { suburb: 'Koramangala', state: 'Karnataka' },
      }),
    });

    const res = await request(app).get('/menu/geocode/reverse?lat=12.93&lng=77.62');
    expect(res.status).toBe(200);
    // Returns name and address fields
    expect(res.body).toHaveProperty('name');
  });
});

// ── PATCH /menu/items/:id/toggle ────────────────────────────────────────────
// Security fix (Phase 2, High #5): previously toggled any menu item by raw ID with no
// ownership check — a chef from one zone could disable another zone's menu item.

describe('PATCH /menu/items/:id/toggle', () => {
  it('scopes the update to the chef\'s own zone and blocks cross-zone items', async () => {
    actingAs({ userId: 'chef-1', role: 'chef', kitchenId: 'kitchen-A', zoneId: 'zone-A', restaurantId: null });
    mockQuery
      .mockResolvedValueOnce({ rows: [{ zone_id: 'zone-A' }] }) // this chef's kitchen's zone
      .mockResolvedValueOnce({ rows: [] }); // UPDATE finds no matching row (item is in a different zone)

    const res = await request(app).patch('/menu/items/item-in-zone-B/toggle');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');

    // Confirm the UPDATE was actually scoped by zone_id, not just id
    const updateCall = mockQuery.mock.calls[1];
    expect(updateCall[0]).toContain('AND zone_id = $2');
    expect(updateCall[1]).toEqual(['item-in-zone-B', 'zone-A']);
  });

  it('allows a chef to toggle an item in their own zone', async () => {
    actingAs({ userId: 'chef-1', role: 'chef', kitchenId: 'kitchen-A', zoneId: 'zone-A', restaurantId: null });
    mockQuery
      .mockResolvedValueOnce({ rows: [{ zone_id: 'zone-A' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'item-1', zone_id: 'zone-A', available: false }] });

    const res = await request(app).patch('/menu/items/item-1/toggle');
    expect(res.status).toBe(200);
    expect(res.body.item.id).toBe('item-1');
  });

  it('returns 400 when a chef has no kitchen assigned', async () => {
    actingAs({ userId: 'chef-1', role: 'chef', kitchenId: null, zoneId: null, restaurantId: null });
    mockQuery.mockResolvedValueOnce({ rows: [] }); // no kitchen found for null id

    const res = await request(app).patch('/menu/items/item-1/toggle');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('KITCHEN_NOT_ASSIGNED');
  });

  it('allows super_admin to toggle any item unscoped', async () => {
    actingAs({ userId: 'admin-1', role: 'super_admin', kitchenId: null, zoneId: null, restaurantId: null });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'item-9', zone_id: 'zone-Z', available: true }] });

    const res = await request(app).patch('/menu/items/item-9/toggle');
    expect(res.status).toBe(200);
    expect(res.body.item.id).toBe('item-9');
  });
});
