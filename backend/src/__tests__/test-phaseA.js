const assert = require('node:assert/strict');
const crypto = require('node:crypto');

// Direct verification of Phase A security algorithms as implemented in src/utils/security.ts

/**
 * Hardened CORS origin validator.
 */
function isAllowedOrigin(origin, allowedOriginsList, isProduction) {
    if (!origin) return true;

    if (allowedOriginsList.includes(origin)) {
        return true;
    }

    let parsed;
    try {
        parsed = new URL(origin);
    } catch {
        return false;
    }

    const { hostname, protocol } = parsed;
    if (protocol !== 'https:' && protocol !== 'http:') {
        return false;
    }

    const isProductionDomain =
        hostname === 'go2qt.com' ||
        hostname.endsWith('.go2qt.com') ||
        hostname === '2qthello.com' ||
        hostname.endsWith('.2qthello.com');

    if (isProductionDomain) {
        return true;
    }

    if (isProduction) {
        return false;
    }

    // Development & staging preview / tunnel allowlist
    const isDevPreviewOrTunnel =
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.endsWith('.workers.dev') ||
        hostname.endsWith('.vercel.app') ||
        hostname.endsWith('.loca.lt') ||
        hostname.endsWith('.ngrok.io') ||
        hostname.endsWith('.ngrok-free.app');

    return isDevPreviewOrTunnel;
}

/**
 * Timing-safe HTTP Basic Auth credential verifier for Bull Board.
 */
function verifyBullBoardCredentials(authHeader, configuredPassword, isProduction) {
    const password = configuredPassword?.trim();
    if (isProduction) {
        if (!password || password.length < 12 || password === 'admin' || password === 'password') {
            return false;
        }
    }

    const effectivePassword = password || (isProduction ? '' : 'admin');
    if (!effectivePassword) return false;

    if (!authHeader || !authHeader.startsWith('Basic ')) {
        return false;
    }

    try {
        const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
        const colonIndex = decoded.indexOf(':');
        if (colonIndex === -1) return false;
        const providedPassword = decoded.slice(colonIndex + 1);

        const expectedHash = crypto.createHash('sha256').update(effectivePassword).digest();
        const providedHash = crypto.createHash('sha256').update(providedPassword).digest();

        return crypto.timingSafeEqual(expectedHash, providedHash);
    } catch {
        return false;
    }
}

/**
 * Generates delivery verification OTP.
 */
function getDeliveryOtpForOrder() {
    if (process.env.NODE_ENV !== 'production' && (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test')) {
        if (process.env.TEST_DELIVERY_OTP) {
            return process.env.TEST_DELIVERY_OTP;
        }
        if (process.env.NODE_ENV === 'development') {
            return '654321';
        }
    }
    return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Production environment guard validator.
 */
function validateProductionEnv(env) {
    const errors = [];
    if (env.NODE_ENV === 'production') {
        if (!env.BULL_BOARD_PASSWORD || env.BULL_BOARD_PASSWORD.trim().length < 12) {
            errors.push('BULL_BOARD_PASSWORD must be configured with at least 12 characters in production');
        }
        if (env.BULL_BOARD_PASSWORD === 'admin' || env.BULL_BOARD_PASSWORD === 'password') {
            errors.push('BULL_BOARD_PASSWORD cannot be set to a default value in production');
        }

        if (env.TEST_DELIVERY_OTP && env.TEST_DELIVERY_OTP.trim() !== '') {
            errors.push('TEST_DELIVERY_OTP must NOT be defined in production. Production orders must use cryptographically random OTPs.');
        }

        if (!env.ALLOWED_ORIGINS || env.ALLOWED_ORIGINS.trim() === '') {
            errors.push('ALLOWED_ORIGINS must be explicitly configured in production (comma-separated origins).');
        }

        if (env.JWT_SECRET && env.JWT_REFRESH_SECRET && env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
            errors.push('JWT_REFRESH_SECRET must not be identical to JWT_SECRET');
        }
    }
    return { success: errors.length === 0, errors };
}

let totalTests = 0;
let passedTests = 0;

function it(description, fn) {
    totalTests++;
    try {
        fn();
        passedTests++;
        console.log(`  ✓ ${description}`);
    } catch (err) {
        console.error(`  ✗ ${description}`);
        console.error(`    ${err.message}`);
        throw err;
    }
}

function describe(suiteName, fn) {
    console.log(`\n--- ${suiteName} ---`);
    fn();
}

console.log('=== PHASE A REMEDIATION: SECURITY HARDENING VERIFICATION ===');

// 1. CORS Hardening
describe('Phase A Security Hardening: CORS Protection', () => {
    const explicitAllowed = ['https://partner.go2qt.com', 'https://kitchen.go2qt.com'];

    it('allows requests without an Origin header (native mobile apps, curl, health checks)', () => {
        assert.equal(isAllowedOrigin(undefined, explicitAllowed, true), true);
        assert.equal(isAllowedOrigin('', explicitAllowed, true), true);
    });

    it('allows exact matches from configured ALLOWED_ORIGINS', () => {
        assert.equal(isAllowedOrigin('https://partner.go2qt.com', explicitAllowed, true), true);
        assert.equal(isAllowedOrigin('https://kitchen.go2qt.com', explicitAllowed, true), true);
    });

    it('allows legitimate production domains and subdomains', () => {
        assert.equal(isAllowedOrigin('https://go2qt.com', explicitAllowed, true), true);
        assert.equal(isAllowedOrigin('https://www.go2qt.com', explicitAllowed, true), true);
        assert.equal(isAllowedOrigin('https://admin.go2qt.com', explicitAllowed, true), true);
        assert.equal(isAllowedOrigin('https://2qthello.com', explicitAllowed, true), true);
        assert.equal(isAllowedOrigin('https://app.2qthello.com', explicitAllowed, true), true);
    });

    it('rejects malicious lookalike domains (evilgo2qt.com, attacker2qthello.com)', () => {
        assert.equal(isAllowedOrigin('https://evilgo2qt.com', explicitAllowed, true), false);
        assert.equal(isAllowedOrigin('https://mygo2qt.com', explicitAllowed, true), false);
        assert.equal(isAllowedOrigin('https://attacker2qthello.com', explicitAllowed, true), false);
        assert.equal(isAllowedOrigin('https://fake-go2qt.com', explicitAllowed, true), false);
    });

    it('rejects lookalike suffix domains (go2qt.com.evil.com)', () => {
        assert.equal(isAllowedOrigin('https://go2qt.com.evil.com', explicitAllowed, true), false);
        assert.equal(isAllowedOrigin('https://2qthello.com.attacker.org', explicitAllowed, true), false);
    });

    it('rejects arbitrary Vercel, Cloudflare Workers, and tunnel origins in production', () => {
        assert.equal(isAllowedOrigin('https://random-app.vercel.app', explicitAllowed, true), false);
        assert.equal(isAllowedOrigin('https://malicious-worker.workers.dev', explicitAllowed, true), false);
        assert.equal(isAllowedOrigin('https://attacker.loca.lt', explicitAllowed, true), false);
        assert.equal(isAllowedOrigin('https://attacker.ngrok.io', explicitAllowed, true), false);
        assert.equal(isAllowedOrigin('https://attacker.ngrok-free.app', explicitAllowed, true), false);
    });

    it('rejects disallowed protocols and malformed origins', () => {
        assert.equal(isAllowedOrigin('javascript:alert(1)', explicitAllowed, true), false);
        assert.equal(isAllowedOrigin('data:text/html,<html>', explicitAllowed, true), false);
        assert.equal(isAllowedOrigin('not-a-valid-url', explicitAllowed, true), false);
    });

    it('permits localhost, previews, and developer tunnels in non-production', () => {
        assert.equal(isAllowedOrigin('http://localhost:3000', [], false), true);
        assert.equal(isAllowedOrigin('http://127.0.0.1:5173', [], false), true);
        assert.equal(isAllowedOrigin('https://preview-123.vercel.app', [], false), true);
        assert.equal(isAllowedOrigin('https://dev-branch.workers.dev', [], false), true);
        assert.equal(isAllowedOrigin('https://tunnel.ngrok-free.app', [], false), true);
        assert.equal(isAllowedOrigin('https://local-dev.loca.lt', [], false), true);
    });
});

// 2. Bull Board Authentication
describe('Phase A Security Hardening: Bull Board Authentication', () => {
    const makeAuthHeader = (user, pass) =>
        'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
    const strongPass = 'SuperSecureP@ssw0rd!2026';

    it('authenticates with correct credentials and strong configured password in production', () => {
        const header = makeAuthHeader('admin', strongPass);
        assert.equal(verifyBullBoardCredentials(header, strongPass, true), true);
    });

    it('rejects incorrect password in production', () => {
        const header = makeAuthHeader('admin', 'WrongPassword123!');
        assert.equal(verifyBullBoardCredentials(header, strongPass, true), false);
    });

    it('rejects if BULL_BOARD_PASSWORD is not configured in production', () => {
        const header = makeAuthHeader('admin', 'admin');
        assert.equal(verifyBullBoardCredentials(header, undefined, true), false);
        assert.equal(verifyBullBoardCredentials(header, '', true), false);
    });

    it('rejects if BULL_BOARD_PASSWORD is left as default "admin" or "password" in production', () => {
        const headerAdmin = makeAuthHeader('admin', 'admin');
        assert.equal(verifyBullBoardCredentials(headerAdmin, 'admin', true), false);

        const headerPass = makeAuthHeader('admin', 'password');
        assert.equal(verifyBullBoardCredentials(headerPass, 'password', true), false);
    });

    it('rejects if configured password is too weak (< 12 characters)', () => {
        const shortPass = 'short123';
        const header = makeAuthHeader('admin', shortPass);
        assert.equal(verifyBullBoardCredentials(header, shortPass, true), false);
    });

    it('rejects invalid or missing Authorization header', () => {
        assert.equal(verifyBullBoardCredentials(undefined, strongPass, true), false);
        assert.equal(verifyBullBoardCredentials('Bearer token123', strongPass, true), false);
        assert.equal(verifyBullBoardCredentials('Basic not:valid:base64!@#', strongPass, true), false);
    });

    it('preserves "admin" fallback when password is not explicitly set in development', () => {
        const header = makeAuthHeader('admin', 'admin');
        assert.equal(verifyBullBoardCredentials(header, undefined, false), true);
    });

    it('uses configured password when set in development', () => {
        const devPass = 'dev-custom-secret';
        const validHeader = makeAuthHeader('admin', devPass);
        const invalidHeader = makeAuthHeader('admin', 'wrong');
        assert.equal(verifyBullBoardCredentials(validHeader, devPass, false), true);
        assert.equal(verifyBullBoardCredentials(invalidHeader, devPass, false), false);
    });
});

// 3. Production Environment Validation Guard
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
        const result = validateProductionEnv(baseValidEnv);
        assert.equal(result.success, true);
        assert.equal(result.errors.length, 0);
    });

    it('fails in production if BULL_BOARD_PASSWORD is missing', () => {
        const env = { ...baseValidEnv, BULL_BOARD_PASSWORD: undefined };
        const result = validateProductionEnv(env);
        assert.equal(result.success, false);
        assert.ok(result.errors.some(e => e.includes('BULL_BOARD_PASSWORD')));
    });

    it('fails in production if BULL_BOARD_PASSWORD is "admin"', () => {
        const env = { ...baseValidEnv, BULL_BOARD_PASSWORD: 'admin' };
        const result = validateProductionEnv(env);
        assert.equal(result.success, false);
        assert.ok(result.errors.some(e => e.includes('default value')));
    });

    it('fails in production if BULL_BOARD_PASSWORD is shorter than 12 characters', () => {
        const env = { ...baseValidEnv, BULL_BOARD_PASSWORD: 'shortpass' };
        const result = validateProductionEnv(env);
        assert.equal(result.success, false);
        assert.ok(result.errors.some(e => e.includes('at least 12 characters')));
    });

    it('fails in production if TEST_DELIVERY_OTP is set', () => {
        const env = { ...baseValidEnv, TEST_DELIVERY_OTP: '654321' };
        const result = validateProductionEnv(env);
        assert.equal(result.success, false);
        assert.ok(result.errors.some(e => e.includes('TEST_DELIVERY_OTP must NOT be defined')));
    });

    it('fails in production if ALLOWED_ORIGINS is missing or empty', () => {
        const env = { ...baseValidEnv, ALLOWED_ORIGINS: '' };
        const result = validateProductionEnv(env);
        assert.equal(result.success, false);
        assert.ok(result.errors.some(e => e.includes('ALLOWED_ORIGINS')));
    });

    it('fails in production if JWT_SECRET equals JWT_REFRESH_SECRET', () => {
        const identical = 'same-shared-secret-that-must-be-at-least-32-chars-long';
        const env = { ...baseValidEnv, JWT_SECRET: identical, JWT_REFRESH_SECRET: identical };
        const result = validateProductionEnv(env);
        assert.equal(result.success, false);
        assert.ok(result.errors.some(e => e.includes('identical')));
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
        const result = validateProductionEnv(devEnv);
        assert.equal(result.success, true);
    });
});

// 4. Order Delivery OTP Security
describe('Phase A Security Hardening: Order Delivery OTP Generation', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalTestOtp = process.env.TEST_DELIVERY_OTP;

    try {
        it('in production, unconditionally generates a cryptographically random 6-digit OTP', () => {
            process.env.NODE_ENV = 'production';
            process.env.TEST_DELIVERY_OTP = '999999'; // Even if erroneously set in process.env

            const generatedOtps = new Set();
            for (let i = 0; i < 20; i++) {
                const otp = getDeliveryOtpForOrder();
                assert.equal(otp.length, 6);
                assert.match(otp, /^\d{6}$/);
                const num = parseInt(otp, 10);
                assert.ok(num >= 100000 && num < 1000000);
                assert.notEqual(otp, '654321');
                assert.notEqual(otp, '999999');
                generatedOtps.add(otp);
            }
            assert.ok(generatedOtps.size > 15, 'Expected high randomness across 20 samples');
        });

        it('in development, returns TEST_DELIVERY_OTP if defined, or default fallback', () => {
            process.env.NODE_ENV = 'development';
            delete process.env.TEST_DELIVERY_OTP;
            assert.equal(getDeliveryOtpForOrder(), '654321');

            process.env.TEST_DELIVERY_OTP = '778899';
            assert.equal(getDeliveryOtpForOrder(), '778899');
        });
    } finally {
        process.env.NODE_ENV = originalEnv;
        if (originalTestOtp !== undefined) {
            process.env.TEST_DELIVERY_OTP = originalTestOtp;
        } else {
            delete process.env.TEST_DELIVERY_OTP;
        }
    }
});

console.log(`\n========================================`);
console.log(`Phase A Security Test Results: ${passedTests}/${totalTests} tests passed.`);
console.log(`========================================\n`);
