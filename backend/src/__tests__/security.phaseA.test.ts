import { isAllowedOrigin, verifyBullBoardCredentials, getDeliveryOtpForOrder } from '../utils/security';
import { validateApiEnv } from '../config/env';

describe('Phase A Security Hardening: CORS Protection', () => {
    const explicitAllowed = ['https://partner.go2qt.com', 'https://kitchen.go2qt.com'];

    describe('Production Mode (isProduction = true)', () => {
        it('allows requests without an Origin header (native mobile apps, curl, health checks)', () => {
            expect(isAllowedOrigin(undefined, explicitAllowed, true)).toBe(true);
            expect(isAllowedOrigin('', explicitAllowed, true)).toBe(true);
        });

        it('allows exact matches from configured ALLOWED_ORIGINS', () => {
            expect(isAllowedOrigin('https://partner.go2qt.com', explicitAllowed, true)).toBe(true);
            expect(isAllowedOrigin('https://kitchen.go2qt.com', explicitAllowed, true)).toBe(true);
        });

        it('allows legitimate production domains and subdomains', () => {
            expect(isAllowedOrigin('https://go2qt.com', explicitAllowed, true)).toBe(true);
            expect(isAllowedOrigin('https://www.go2qt.com', explicitAllowed, true)).toBe(true);
            expect(isAllowedOrigin('https://admin.go2qt.com', explicitAllowed, true)).toBe(true);
            expect(isAllowedOrigin('https://2qthello.com', explicitAllowed, true)).toBe(true);
            expect(isAllowedOrigin('https://app.2qthello.com', explicitAllowed, true)).toBe(true);
        });

        it('rejects malicious lookalike domains (e.g. evilgo2qt.com, attacker2qthello.com)', () => {
            expect(isAllowedOrigin('https://evilgo2qt.com', explicitAllowed, true)).toBe(false);
            expect(isAllowedOrigin('https://mygo2qt.com', explicitAllowed, true)).toBe(false);
            expect(isAllowedOrigin('https://attacker2qthello.com', explicitAllowed, true)).toBe(false);
            expect(isAllowedOrigin('https://fake-go2qt.com', explicitAllowed, true)).toBe(false);
        });

        it('rejects lookalike suffix domains (e.g. go2qt.com.evil.com)', () => {
            expect(isAllowedOrigin('https://go2qt.com.evil.com', explicitAllowed, true)).toBe(false);
            expect(isAllowedOrigin('https://2qthello.com.attacker.org', explicitAllowed, true)).toBe(false);
        });

        it('rejects arbitrary Vercel, Cloudflare Workers, and tunnel origins in production', () => {
            expect(isAllowedOrigin('https://random-app.vercel.app', explicitAllowed, true)).toBe(false);
            expect(isAllowedOrigin('https://malicious-worker.workers.dev', explicitAllowed, true)).toBe(false);
            expect(isAllowedOrigin('https://attacker.loca.lt', explicitAllowed, true)).toBe(false);
            expect(isAllowedOrigin('https://attacker.ngrok.io', explicitAllowed, true)).toBe(false);
            expect(isAllowedOrigin('https://attacker.ngrok-free.app', explicitAllowed, true)).toBe(false);
        });

        it('rejects disallowed protocols and malformed origins', () => {
            expect(isAllowedOrigin('javascript:alert(1)', explicitAllowed, true)).toBe(false);
            expect(isAllowedOrigin('data:text/html,<html>', explicitAllowed, true)).toBe(false);
            expect(isAllowedOrigin('not-a-valid-url', explicitAllowed, true)).toBe(false);
        });
    });

    describe('Development / Staging Mode (isProduction = false)', () => {
        it('permits localhost, previews, and developer tunnels in non-production', () => {
            expect(isAllowedOrigin('http://localhost:3000', [], false)).toBe(true);
            expect(isAllowedOrigin('http://127.0.0.1:5173', [], false)).toBe(true);
            expect(isAllowedOrigin('https://preview-123.vercel.app', [], false)).toBe(true);
            expect(isAllowedOrigin('https://dev-branch.workers.dev', [], false)).toBe(true);
            expect(isAllowedOrigin('https://tunnel.ngrok-free.app', [], false)).toBe(true);
            expect(isAllowedOrigin('https://local-dev.loca.lt', [], false)).toBe(true);
        });
    });
});

describe('Phase A Security Hardening: Bull Board Authentication', () => {
    const makeAuthHeader = (user: string, pass: string) =>
        'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');

    describe('Production Mode (isProduction = true)', () => {
        const strongPass = 'SuperSecureP@ssw0rd!2026';

        it('authenticates with correct credentials and strong configured password', () => {
            const header = makeAuthHeader('admin', strongPass);
            expect(verifyBullBoardCredentials(header, strongPass, true)).toBe(true);
        });

        it('rejects incorrect password', () => {
            const header = makeAuthHeader('admin', 'WrongPassword123!');
            expect(verifyBullBoardCredentials(header, strongPass, true)).toBe(false);
        });

        it('rejects if BULL_BOARD_PASSWORD is not configured in production', () => {
            const header = makeAuthHeader('admin', 'admin');
            expect(verifyBullBoardCredentials(header, undefined, true)).toBe(false);
            expect(verifyBullBoardCredentials(header, '', true)).toBe(false);
        });

        it('rejects if BULL_BOARD_PASSWORD is left as default "admin" or "password" in production', () => {
            const header = makeAuthHeader('admin', 'admin');
            expect(verifyBullBoardCredentials(header, 'admin', true)).toBe(false);

            const headerPass = makeAuthHeader('admin', 'password');
            expect(verifyBullBoardCredentials(headerPass, 'password', true)).toBe(false);
        });

        it('rejects if configured password is too weak (< 12 characters)', () => {
            const shortPass = 'short123';
            const header = makeAuthHeader('admin', shortPass);
            expect(verifyBullBoardCredentials(header, shortPass, true)).toBe(false);
        });

        it('rejects invalid or missing Authorization header', () => {
            expect(verifyBullBoardCredentials(undefined, strongPass, true)).toBe(false);
            expect(verifyBullBoardCredentials('Bearer token123', strongPass, true)).toBe(false);
            expect(verifyBullBoardCredentials('Basic not:valid:base64!@#', strongPass, true)).toBe(false);
        });
    });

    describe('Development Mode (isProduction = false)', () => {
        it('preserves "admin" fallback when password is not explicitly set in development', () => {
            const header = makeAuthHeader('admin', 'admin');
            expect(verifyBullBoardCredentials(header, undefined, false)).toBe(true);
        });

        it('uses configured password when set in development', () => {
            const devPass = 'dev-custom-secret';
            const validHeader = makeAuthHeader('admin', devPass);
            const invalidHeader = makeAuthHeader('admin', 'wrong');
            expect(verifyBullBoardCredentials(validHeader, devPass, false)).toBe(true);
            expect(verifyBullBoardCredentials(invalidHeader, devPass, false)).toBe(false);
        });
    });
});

describe('Phase A Security Hardening: Production Environment Schema Validation', () => {
    const baseValidEnv = {
        NODE_ENV: 'production',
        PORT: 3000,
        DATABASE_URL: 'postgres://user:pass@prod-db.internal:5432/2qt',
        REDIS_URL: 'rediss://prod-redis.internal:6379',
        JWT_SECRET: 'a-very-long-production-jwt-secret-with-at-least-32-characters',
        JWT_REFRESH_SECRET: 'a-distinct-long-production-refresh-secret-with-at-least-32-chars',
        ENABLE_EMBEDDED_WORKER: 'false',
        RAZORPAY_KEY_ID: 'rzp_live_1234567890',
        RAZORPAY_KEY_SECRET: 'live_secret_key_prod_value',
        RAZORPAY_WEBHOOK_SECRET: 'prod_webhook_secret_value',
        ALLOWED_ORIGINS: 'https://go2qt.com,https://admin.go2qt.com',
        BULL_BOARD_PASSWORD: 'ProdQueueDashboardP@ssw0rd!36',
    };

    it('passes for a fully configured, valid production environment', () => {
        const result = validateApiEnv(baseValidEnv);
        expect(result.success).toBe(true);
    });

    it('fails in production if BULL_BOARD_PASSWORD is missing', () => {
        const env = { ...baseValidEnv, BULL_BOARD_PASSWORD: undefined };
        const result = validateApiEnv(env);
        expect(result.success).toBe(false);
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'));
            expect(paths).toContain('BULL_BOARD_PASSWORD');
        }
    });

    it('fails in production if BULL_BOARD_PASSWORD is "admin"', () => {
        const env = { ...baseValidEnv, BULL_BOARD_PASSWORD: 'admin' };
        const result = validateApiEnv(env);
        expect(result.success).toBe(false);
    });

    it('fails in production if BULL_BOARD_PASSWORD is shorter than 12 characters', () => {
        const env = { ...baseValidEnv, BULL_BOARD_PASSWORD: 'shortpass' };
        const result = validateApiEnv(env);
        expect(result.success).toBe(false);
    });

    it('fails in production if TEST_DELIVERY_OTP is set', () => {
        const env = { ...baseValidEnv, TEST_DELIVERY_OTP: '654321' };
        const result = validateApiEnv(env);
        expect(result.success).toBe(false);
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'));
            expect(paths).toContain('TEST_DELIVERY_OTP');
        }
    });

    it('fails in production if ALLOWED_ORIGINS is missing or empty', () => {
        const env = { ...baseValidEnv, ALLOWED_ORIGINS: '' };
        const result = validateApiEnv(env);
        expect(result.success).toBe(false);
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'));
            expect(paths).toContain('ALLOWED_ORIGINS');
        }
    });

    it('fails in production if JWT_SECRET equals JWT_REFRESH_SECRET', () => {
        const identical = 'same-shared-secret-that-must-be-at-least-32-chars-long';
        const env = { ...baseValidEnv, JWT_SECRET: identical, JWT_REFRESH_SECRET: identical };
        const result = validateApiEnv(env);
        expect(result.success).toBe(false);
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'));
            expect(paths).toContain('JWT_REFRESH_SECRET');
        }
    });

    it('allows TEST_DELIVERY_OTP and omits BULL_BOARD_PASSWORD requirement in development', () => {
        const devEnv = {
            NODE_ENV: 'development',
            DATABASE_URL: 'postgres://user:pass@localhost:5432/2qt',
            REDIS_URL: 'redis://localhost:6379',
            JWT_SECRET: 'dev-jwt-secret-min-32-characters-long!!',
            JWT_REFRESH_SECRET: 'dev-refresh-secret-min-32-characters-long!',
            RAZORPAY_KEY_ID: 'rzp_test_key',
            RAZORPAY_KEY_SECRET: 'rzp_test_secret',
            RAZORPAY_WEBHOOK_SECRET: 'test_webhook_secret',
            TEST_DELIVERY_OTP: '112233',
        };
        const result = validateApiEnv(devEnv);
        expect(result.success).toBe(true);
    });
});

describe('Phase A Security Hardening: Order Delivery OTP Generation', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalTestOtp = process.env.TEST_DELIVERY_OTP;

    afterEach(() => {
        process.env.NODE_ENV = originalEnv;
        if (originalTestOtp !== undefined) {
            process.env.TEST_DELIVERY_OTP = originalTestOtp;
        } else {
            delete process.env.TEST_DELIVERY_OTP;
        }
    });

    it('in production, unconditionally generates a cryptographically random 6-digit OTP', () => {
        process.env.NODE_ENV = 'production';
        process.env.TEST_DELIVERY_OTP = '999999'; // Even if erroneously set in process.env

        const generatedOtps = new Set<string>();
        for (let i = 0; i < 20; i++) {
            const otp = getDeliveryOtpForOrder();
            expect(otp).toHaveLength(6);
            expect(otp).toMatch(/^\d{6}$/);
            const num = parseInt(otp, 10);
            expect(num).toBeGreaterThanOrEqual(100000);
            expect(num).toBeLessThan(1000000);
            expect(otp).not.toBe('654321');
            expect(otp).not.toBe('999999');
            generatedOtps.add(otp);
        }
        // Cryptographic randomness should yield multiple distinct OTPs across 20 samples
        expect(generatedOtps.size).toBeGreaterThan(15);
    });

    it('in development, returns TEST_DELIVERY_OTP if defined, or default fallback', () => {
        process.env.NODE_ENV = 'development';
        delete process.env.TEST_DELIVERY_OTP;
        expect(getDeliveryOtpForOrder()).toBe('654321');

        process.env.TEST_DELIVERY_OTP = '778899';
        expect(getDeliveryOtpForOrder()).toBe('778899');
    });
});
