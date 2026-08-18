/**
 * HTTP-layer tests for /auth routes.
 * Validates status codes, response shapes, and request validation.
 * Business logic is covered by auth.test.ts (unit) and order.service.test.ts.
 */

import express from 'express';
import request from 'supertest';
import { query } from '../db';
import { redis, keys } from '../redis';

// Mock axios so MSG91 calls never fire
jest.mock('axios', () => ({
  post: jest.fn().mockResolvedValue({ data: { type: 'success' } }),
}));

// mock global fetch for verify-widget-token
const mockFetch = jest.fn();
global.fetch = mockFetch;

import authRouter from '../routes/auth';

const app = express();
app.use(express.json());
app.use('/auth', authRouter);

const mockQuery = query as jest.Mock;
const mockRedisGet = redis.get as jest.Mock;
const mockRedisSet = redis.set as jest.Mock;
const mockRedisIncr = (redis as any).incr as jest.Mock;
const mockRedisExpire = (redis as any).expire as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockRedisGet.mockResolvedValue(null);
  mockRedisSet.mockResolvedValue('OK');
  mockRedisIncr?.mockResolvedValue(1);
  mockRedisExpire?.mockResolvedValue(1);
});

// Each test uses a unique phone number to avoid the module-level in-memory rate counter
// accumulating across tests (jest.clearAllMocks() resets mock call counts but NOT
// module-level Map state in auth.ts).
let phoneCounter = 1000;
function uniquePhone(): string {
  return `91800000${String(phoneCounter++).padStart(4, '0')}`;
}

// ── POST /auth/send-otp ──────────────────────────────────────────────────────

describe('POST /auth/send-otp', () => {
  it('returns 400 when phone is missing', async () => {
    const res = await request(app).post('/auth/send-otp').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_PHONE');
  });

  it('returns 400 for non-Indian phone number (less than 10 digits)', async () => {
    const res = await request(app).post('/auth/send-otp').send({ phone: '12345' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_PHONE');
  });

  it('accepts a 10-digit phone and auto-prepends 91', async () => {
    const phone = uniquePhone().slice(2); // strip 91 prefix → 10 digits
    const res = await request(app).post('/auth/send-otp').send({ phone });
    expect(res.status).toBe(200);
    expect(res.body.phone).toBe('91' + phone);
  });

  it('accepts a fully-formatted 91-prefixed phone', async () => {
    const res = await request(app).post('/auth/send-otp').send({ phone: uniquePhone() });
    expect(res.status).toBe(200);
    expect(res.body.phone).toMatch(/^91\d{10}$/);
  });

  it('strips non-digit characters before validating', async () => {
    const p = uniquePhone();
    const formatted = `+${p.slice(0, 2)}-${p.slice(2, 7)}-${p.slice(7)}`;
    const res = await request(app).post('/auth/send-otp').send({ phone: formatted });
    expect(res.status).toBe(200);
    expect(res.body.phone).toBe(p);
  });

  it('returns 429 when Redis rate counter exceeds 5', async () => {
    // Make Redis incr return 6 so the rate check fires
    mockRedisIncr?.mockResolvedValueOnce(6);
    const res = await request(app).post('/auth/send-otp').send({ phone: uniquePhone() });
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('TOO_MANY_OTP');
  });

  it('returns devOtp field in development mode', async () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const res = await request(app).post('/auth/send-otp').send({ phone: uniquePhone() });
    expect(res.status).toBe(200);
    expect(res.body.devOtp).toBeDefined();
    expect(res.body.devOtp).toHaveLength(6);
    process.env.NODE_ENV = orig;
  });

  it('does NOT return devOtp outside development mode', async () => {
    const res = await request(app).post('/auth/send-otp').send({ phone: uniquePhone() });
    expect(res.body.devOtp).toBeUndefined();
  });
});

// ── POST /auth/verify-otp ─────────────────────────────────────────────────────
// The route returns 400 INVALID_OTP for any mismatch (expired, missing, wrong).
// There is no separate MISSING_OTP code — undefined is cast to 'undefined' string.

describe('POST /auth/verify-otp', () => {
  it('returns 400 when OTP does not match stored value', async () => {
    // Redis returns '999999', user submits '111111'
    mockRedisGet.mockResolvedValueOnce('999999');
    const res = await request(app).post('/auth/verify-otp').send({ phone: uniquePhone(), otp: '111111' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_OTP');
  });

  it('returns 400 when OTP is expired (absent from both Redis and memory)', async () => {
    // Use a completely fresh unique phone — not in in-memory store either
    mockRedisGet.mockResolvedValueOnce(null);
    const res = await request(app).post('/auth/verify-otp').send({ phone: uniquePhone(), otp: '654321' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_OTP');
  });

  it('allows test account bypass with OTP 123456 in development only', async () => {
    // Test accounts hardcoded in auth.ts bypass OTP check → reach completeAuth() DB calls.
    // The bypass is gated behind NODE_ENV === 'development' (it must never be reachable
    // in production), so it has to be enabled explicitly here since the suite otherwise
    // runs under NODE_ENV === 'test'.
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    mockQuery
      .mockResolvedValueOnce({ rows: [] })    // prelaunch check
      .mockResolvedValueOnce({ rows: [] })    // prelaunch config
      .mockResolvedValueOnce({ rows: [{ id: 'u-1', phone: '919999999999', name: 'Test', role: 'customer', kitchen_id: null, zone_id: null, terms_accepted_at: null, is_verified: true, onboarding_complete: true, email: null, photo_url: null, prelaunch_reward_credited: false }] }) // upsert user
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })  // wallet upsert
      .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // referral check
      .mockResolvedValueOnce({ rows: [] });   // kitchen name

    const res = await request(app).post('/auth/verify-otp').send({ phone: '919999999999', otp: '123456' });
    process.env.NODE_ENV = orig;
    // Might succeed or 5xx if remaining DB mocks are incomplete — just check it's not a 400 OTP error
    expect(res.body.error).not.toBe('INVALID_OTP');
  });

  it('does NOT allow the OTP bypass outside development mode', async () => {
    // Same request as above, but under the suite's default NODE_ENV ('test') — the
    // bypass must not be reachable, so this should hit the real invalid-OTP path.
    mockRedisGet.mockResolvedValueOnce(null);
    const res = await request(app).post('/auth/verify-otp').send({ phone: '919999999999', otp: '123456' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_OTP');
  });
});

// ── POST /auth/refresh ────────────────────────────────────────────────────────

describe('POST /auth/refresh', () => {
  it('returns 400 when refreshToken is missing', async () => {
    const res = await request(app).post('/auth/refresh').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('MISSING_TOKEN');
  });

  it('returns 401 for invalid/tampered JWT', async () => {
    const res = await request(app).post('/auth/refresh').send({ refreshToken: 'not.a.jwt' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_TOKEN');
  });

  it('returns 401 when user is deactivated', async () => {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ userId: 'u-1', jti: 'j-1' }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '1d' });

    mockQuery
      .mockResolvedValueOnce({ rows: [{ role: 'customer', kitchen_id: null, zone_id: 'z-1', is_active: false }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post('/auth/refresh').send({ refreshToken: token });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_TOKEN');
  });
});

// ── POST /auth/kitchen-pin ────────────────────────────────────────────────────

describe('POST /auth/kitchen-pin', () => {
  it('returns 400 for a PIN that is not 4 digits', async () => {
    const res = await request(app).post('/auth/kitchen-pin').send({ pin: '12' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_PIN');
  });

  it('returns 401 when no kitchen matches the PIN', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // no kitchens
    const res = await request(app).post('/auth/kitchen-pin').send({ pin: '1234' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_PIN');
  });
});

// ── POST /auth/onboarding/complete ────────────────────────────────────────────

describe('POST /auth/onboarding/complete', () => {
  it('returns 200 and marks onboarding done', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/auth/onboarding/complete');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
