import crypto from 'crypto';

/**
 * Hardened CORS origin validator.
 * - Missing Origin is permitted for non-browser clients (native mobile apps, health checks, curl),
 *   but is NEVER treated as authentication.
 * - Direct matches with configured ALLOWED_ORIGINS are accepted.
 * - In production: strictly permits verified domains go2qt.com, 2qthello.com, and their subdomains.
 *   Arbitrary .vercel.app, .workers.dev, and tunnel services (loca.lt, ngrok) are rejected.
 * - In non-production (development/test): localhost, previews, and tunnels are allowed.
 */
export function isAllowedOrigin(origin: string | undefined, allowedOriginsList: string[], isProduction: boolean): boolean {
    if (!origin) return true;

    if (allowedOriginsList.includes(origin)) {
        return true;
    }

    let parsed: URL;
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
 * - In production, BULL_BOARD_PASSWORD must be configured, >= 12 chars, and not 'admin' or 'password'.
 * - Uses SHA-256 digest comparison with crypto.timingSafeEqual to prevent timing attacks.
 * - Preserves 'admin' fallback only in local development / test environments.
 */
export function verifyBullBoardCredentials(
    authHeader: string | undefined,
    configuredPassword: string | undefined,
    isProduction: boolean
): boolean {
    const password = configuredPassword?.trim();
    if (isProduction) {
        if (!password || password.length < 12 || password === 'admin' || password === 'password') {
            console.error('[SECURITY] Bull Board authentication rejected: Strong BULL_BOARD_PASSWORD required in production.');
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
 * In production: unconditionally generates a cryptographically secure 6-digit random integer (100000-999999).
 * Test/development overrides are strictly prevented when NODE_ENV === 'production'.
 */
export const getDeliveryOtpForOrder = (): string => {
    if (process.env.NODE_ENV !== 'production' && (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test')) {
        if (process.env.TEST_DELIVERY_OTP) {
            return process.env.TEST_DELIVERY_OTP;
        }
        if (process.env.NODE_ENV === 'development') {
            return '654321';
        }
    }
    return crypto.randomInt(100000, 1000000).toString();
};
