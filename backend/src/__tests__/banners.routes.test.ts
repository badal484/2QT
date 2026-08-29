/**
 * HTTP-layer tests for /banners routes.
 * Covers: public active banners with optional zone-wise filtering,
 * admin banner management with zone assignment and updates.
 */

import express from 'express';
import request from 'supertest';
import { query } from '../db';
import { authenticate } from '../middleware/auth';

import bannersRouter from '../routes/banners';

const app = express();
app.use(express.json());
app.use('/banners', bannersRouter);

const mockQuery = query as jest.Mock;
const mockAuthenticate = authenticate as jest.Mock;
const defaultAuthenticate = mockAuthenticate.getMockImplementation();

function actingAsAdmin() {
  mockAuthenticate.mockImplementationOnce((req: any, _res: any, next: any) => {
    req.user = { userId: 'admin-1', role: 'admin', kitchenId: null, zoneId: null, restaurantId: null, jti: 'jti-test' };
    next();
  });
}

const ZONE_1 = 'a1111111-1111-1111-1111-111111111111';
const ZONE_2 = 'b2222222-2222-2222-2222-222222222222';

beforeEach(() => {
  jest.clearAllMocks();
  if (defaultAuthenticate) mockAuthenticate.mockImplementation(defaultAuthenticate);
});

describe('GET /banners (Public)', () => {
  it('fetches all active banners without zone filter', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'b-1', title: 'Global Promo', zone_id: null, is_active: true, display_order: 0 },
        { id: 'b-2', title: 'Zone 1 Special', zone_id: ZONE_1, is_active: true, display_order: 1 },
      ],
    });

    const res = await request(app).get('/banners');
    expect(res.status).toBe(200);
    expect(res.body.banners).toHaveLength(2);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('WHERE pb.is_active = true'),
      [null]
    );
  });

  it('filters banners by zoneId to return global + zone-specific banners', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'b-1', title: 'Global Promo', zone_id: null, is_active: true, display_order: 0 },
        { id: 'b-2', title: 'Zone 1 Special', zone_id: ZONE_1, is_active: true, display_order: 1 },
      ],
    });

    const res = await request(app).get(`/banners?zoneId=${ZONE_1}`);
    expect(res.status).toBe(200);
    expect(res.body.banners).toHaveLength(2);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('WHERE pb.is_active = true'),
      [ZONE_1]
    );
  });
});

describe('GET /banners/admin', () => {
  it('returns all banners with zone details for admin', async () => {
    actingAsAdmin();
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'b-1', title: 'Global Promo', zone_id: null, zone_name: null, is_active: true },
        { id: 'b-2', title: 'Zone 1 Special', zone_id: ZONE_1, zone_name: 'Hazaribagh', is_active: true },
      ],
    });

    const res = await request(app).get('/banners/admin');
    expect(res.status).toBe(200);
    expect(res.body.banners).toHaveLength(2);
    expect(res.body.banners[1].zone_name).toBe('Hazaribagh');
  });
});

describe('POST /banners/admin', () => {
  it('creates a new zone-targeted banner', async () => {
    actingAsAdmin();
    const newBanner = {
      title: 'Zone 1 Flash Sale',
      subtitle: 'Flat 50% off',
      tag_text: '50% OFF',
      image_url: 'https://img.com/banner1.jpg',
      zone_id: ZONE_1,
      banner_type: 'MAIN',
    };

    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'b-new', ...newBanner, is_active: true }] }) // INSERT
      .mockResolvedValueOnce({ rows: [{ id: 'b-new', ...newBanner, zone_name: 'Hazaribagh', is_active: true }] }); // SELECT full

    const res = await request(app).post('/banners/admin').send(newBanner);
    expect(res.status).toBe(201);
    expect(res.body.banner.zone_id).toBe(ZONE_1);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO promotional_banners'),
      expect.arrayContaining([ZONE_1])
    );
  });

  it('creates a global banner when zone_id is null or omitted', async () => {
    actingAsAdmin();
    const newBanner = {
      title: 'App Wide Promo',
      subtitle: 'Free delivery',
      tag_text: 'FREE',
      image_url: 'https://img.com/global.jpg',
    };

    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'b-global', ...newBanner, zone_id: null, is_active: true }] })
      .mockResolvedValueOnce({ rows: [{ id: 'b-global', ...newBanner, zone_id: null, zone_name: null, is_active: true }] });

    const res = await request(app).post('/banners/admin').send(newBanner);
    expect(res.status).toBe(201);
    expect(res.body.banner.zone_id).toBeNull();
  });
});

describe('PATCH /banners/admin/:id', () => {
  it('updates banner zone_id and status', async () => {
    actingAsAdmin();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'b-1', zone_id: ZONE_2, is_active: false }] }) // UPDATE
      .mockResolvedValueOnce({ rows: [{ id: 'b-1', zone_id: ZONE_2, zone_name: 'Barkagaon', is_active: false }] }); // SELECT full

    const res = await request(app)
      .patch('/banners/admin/b-1')
      .send({ zone_id: ZONE_2, is_active: false });

    expect(res.status).toBe(200);
    expect(res.body.banner.zone_id).toBe(ZONE_2);
  });
});

describe('DELETE /banners/admin/:id', () => {
  it('deletes a banner successfully', async () => {
    actingAsAdmin();
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });

    const res = await request(app).delete('/banners/admin/b-1');
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('deleted');
  });
});
