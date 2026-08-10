import jwt from 'jsonwebtoken';
import { z } from 'zod';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;

// ── Phone normalization (mirrors auth.ts logic) ──────────────────────────────

function normalizePhone(phone: string): string {
  let normalized = phone.replace(/\D/g, '');
  if (normalized.length === 10) normalized = '91' + normalized;
  return normalized;
}

const phoneSchema = z.string().regex(/^91\d{10}$/);

// ── In-memory OTP store (mirrors auth.ts) ─────────────────────────────────────

const memOtp = new Map<string, { otp: string; exp: number }>();

function setMemOtp(phone: string, otp: string) {
  memOtp.set(phone, { otp, exp: Date.now() + 600_000 });
}
function getMemOtp(phone: string): string | null {
  const e = memOtp.get(phone);
  if (!e || e.exp < Date.now()) { memOtp.delete(phone); return null; }
  return e.otp;
}
function delMemOtp(phone: string) {
  memOtp.delete(phone);
}

// ── OTP rate limit counter (mirrors auth.ts) ──────────────────────────────────

const memOtpCounts = new Map<string, { count: number; resetsAt: number }>();

function memOtpIncr(phone: string): number {
  const now = Date.now();
  const entry = memOtpCounts.get(phone);
  if (!entry || entry.resetsAt < now) {
    memOtpCounts.set(phone, { count: 1, resetsAt: now + 600_000 });
    return 1;
  }
  entry.count++;
  return entry.count;
}

describe('Phone normalization', () => {
  beforeEach(() => memOtp.clear());

  it('prepends 91 to a 10-digit number', () => {
    expect(normalizePhone('9876543210')).toBe('919876543210');
  });

  it('keeps 12-digit number with 91 prefix unchanged', () => {
    expect(normalizePhone('919876543210')).toBe('919876543210');
  });

  it('strips non-digit characters', () => {
    expect(normalizePhone('+91 98765 43210')).toBe('919876543210');
  });

  it('strips dashes and spaces', () => {
    expect(normalizePhone('9876-543-210')).toBe('919876543210');
  });
});

describe('Phone schema validation', () => {
  it('accepts valid 91XXXXXXXXXX number', () => {
    expect(phoneSchema.safeParse('919876543210').success).toBe(true);
  });

  it('rejects 10-digit number without country code', () => {
    expect(phoneSchema.safeParse('9876543210').success).toBe(false);
  });

  it('rejects number starting with +91', () => {
    expect(phoneSchema.safeParse('+919876543210').success).toBe(false);
  });

  it('rejects numbers with wrong country code', () => {
    expect(phoneSchema.safeParse('449876543210').success).toBe(false); // UK
  });

  it('rejects too-short number', () => {
    expect(phoneSchema.safeParse('9191234').success).toBe(false);
  });

  it('rejects too-long number', () => {
    expect(phoneSchema.safeParse('9198765432101').success).toBe(false);
  });

  it('rejects empty string', () => {
    expect(phoneSchema.safeParse('').success).toBe(false);
  });
});

describe('In-memory OTP store', () => {
  beforeEach(() => memOtp.clear());

  it('stores and retrieves an OTP', () => {
    setMemOtp('919876543210', '123456');
    expect(getMemOtp('919876543210')).toBe('123456');
  });

  it('returns null for unknown phone', () => {
    expect(getMemOtp('910000000000')).toBeNull();
  });

  it('deletes OTP after retrieval is called on deleted phone', () => {
    setMemOtp('919876543210', '654321');
    delMemOtp('919876543210');
    expect(getMemOtp('919876543210')).toBeNull();
  });

  it('overwrites existing OTP', () => {
    setMemOtp('919876543210', '111111');
    setMemOtp('919876543210', '222222');
    expect(getMemOtp('919876543210')).toBe('222222');
  });

  it('returns null for expired OTP', () => {
    memOtp.set('919876543210', { otp: '999999', exp: Date.now() - 1 });
    expect(getMemOtp('919876543210')).toBeNull();
  });

  it('cleans up map entry on expiry', () => {
    memOtp.set('919876543210', { otp: '999999', exp: Date.now() - 1 });
    getMemOtp('919876543210');
    expect(memOtp.has('919876543210')).toBe(false);
  });

  it('isolates OTPs across different phones', () => {
    setMemOtp('919876543210', 'aaa111');
    setMemOtp('919999999999', 'bbb222');
    expect(getMemOtp('919876543210')).toBe('aaa111');
    expect(getMemOtp('919999999999')).toBe('bbb222');
  });
});

describe('OTP rate limiter (in-memory)', () => {
  beforeEach(() => memOtpCounts.clear());

  it('returns 1 on first request', () => {
    expect(memOtpIncr('919876543210')).toBe(1);
  });

  it('increments count on repeated requests', () => {
    memOtpIncr('919876543210');
    memOtpIncr('919876543210');
    expect(memOtpIncr('919876543210')).toBe(3);
  });

  it('resets after window expires', () => {
    memOtpCounts.set('919876543210', { count: 5, resetsAt: Date.now() - 1 });
    expect(memOtpIncr('919876543210')).toBe(1); // reset
  });

  it('tracks counts per phone independently', () => {
    memOtpIncr('919876543210');
    memOtpIncr('919876543210');
    expect(memOtpIncr('919999999999')).toBe(1); // different phone → fresh count
  });
});

describe('JWT token generation and verification', () => {
  const PAYLOAD = { userId: 'user-uuid-1', role: 'customer', phone: '919876543210' };

  it('signs and verifies an access token', () => {
    const token = jwt.sign(PAYLOAD, JWT_SECRET, { expiresIn: '15m' });
    const decoded = jwt.verify(token, JWT_SECRET) as typeof PAYLOAD & { exp: number };
    expect(decoded.userId).toBe(PAYLOAD.userId);
    expect(decoded.role).toBe(PAYLOAD.role);
  });

  it('signs and verifies a refresh token', () => {
    const token = jwt.sign({ userId: PAYLOAD.userId }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as any;
    expect(decoded.userId).toBe(PAYLOAD.userId);
  });

  it('rejects a token signed with the wrong secret', () => {
    const token = jwt.sign(PAYLOAD, 'wrong-secret');
    expect(() => jwt.verify(token, JWT_SECRET)).toThrow(jwt.JsonWebTokenError);
  });

  it('rejects an expired token', () => {
    const token = jwt.sign(PAYLOAD, JWT_SECRET, { expiresIn: '-1s' });
    expect(() => jwt.verify(token, JWT_SECRET)).toThrow(jwt.TokenExpiredError);
  });

  it('rejects a tampered token payload', () => {
    const token = jwt.sign(PAYLOAD, JWT_SECRET);
    const [header, , signature] = token.split('.');
    const tamperedPayload = Buffer.from(JSON.stringify({ ...PAYLOAD, role: 'super_admin' })).toString('base64url');
    const tampered = `${header}.${tamperedPayload}.${signature}`;
    expect(() => jwt.verify(tampered, JWT_SECRET)).toThrow(jwt.JsonWebTokenError);
  });

  it('access token should expire before refresh token', () => {
    const access = jwt.sign(PAYLOAD, JWT_SECRET, { expiresIn: '15m' }) as string;
    const refresh = jwt.sign({ userId: PAYLOAD.userId }, JWT_REFRESH_SECRET, { expiresIn: '7d' }) as string;
    const accessDecoded = jwt.decode(access) as any;
    const refreshDecoded = jwt.decode(refresh) as any;
    expect(accessDecoded.exp).toBeLessThan(refreshDecoded.exp);
  });

  it('encodes all required fields in access token', () => {
    const token = jwt.sign(PAYLOAD, JWT_SECRET);
    const decoded = jwt.decode(token) as any;
    expect(decoded.userId).toBeDefined();
    expect(decoded.role).toBeDefined();
    expect(decoded.phone).toBeDefined();
  });
});
