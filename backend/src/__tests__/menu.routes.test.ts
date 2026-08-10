/**
 * HTTP-layer tests for /menu routes.
 * Covers: zones, menu items, validate-cart, kitchen-metrics.
 */

import express from 'express';
import request from 'supertest';
import { query } from '../db';
import { redis, keys } from '../redis';

global.fetch = jest.fn();

import menuRouter from '../routes/menu';

const app = express();
app.use(express.json());
app.use('/menu', menuRouter);

const mockQuery = query as jest.Mock;
const mockRedisGet = redis.get as jest.Mock;
const mockRedisSet = redis.set as jest.Mock;

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
