import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { redis, keys } from '../redis';
import { setContextUserId } from '../utils/asyncContext';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is not set — server cannot start safely');

export interface AuthRequest extends Request {
    user?: {
        userId: string;
        role: string;
        kitchenId: string | null;
        zoneId: string | null;
        // Dine-in restaurant (restaurant_config.id, via users.dine_in_restaurant_id) — unrelated
        // to the delivery-business tenant model below. Do not conflate the two.
        restaurantId: string | null;
        // Phase 3 (SaaS migration) tenant foundation: the delivery-business restaurant this user
        // belongs to (restaurants.id, via the new users.restaurant_id). Server-derived only, same
        // as every other field here. NOT YET consumed by any authorization check — infrastructure
        // for Phase 4+. Named distinctly from `restaurantId` above specifically to avoid silently
        // changing what that existing, already-authorization-relevant field means.
        tenantRestaurantId: string | null;
        jti: string;
    };
}

// Cache TTL: 60 seconds. On role-change / deactivation, invalidate via invalidateUserCache().
const USER_CACHE_TTL = 60;
const userCacheKey = (userId: string) => `2qt:user_meta:${userId}`;

export const invalidateUserCache = (userId: string) =>
    redis.del(userCacheKey(userId)).catch(() => {});

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing token' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;

        // Check revocation + user meta in parallel; both have 100ms timeout to never block fast path
        const timeout = <T>(p: Promise<T>): Promise<T | null> =>
            Promise.race([p, new Promise<null>((_, rej) => setTimeout(() => rej(new Error('REDIS_TIMEOUT')), 100))])
                .catch(() => null);

        const [isRevoked, cachedUser] = await Promise.all([
            timeout(redis.get(keys.revokedToken(decoded.jti))),
            timeout(redis.get(userCacheKey(decoded.userId))),
        ]);

        if (isRevoked) {
            return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Token revoked' });
        }

        let userData: { role: string; kitchen_id: string | null; zone_id: string | null; dine_in_restaurant_id: string | null; restaurant_id: string | null; is_active: boolean } | null = null;

        if (cachedUser) {
            userData = JSON.parse(cachedUser);
        } else {
            try {
                const { query } = require('../db');
                const { rows } = await query(
                    'SELECT role, kitchen_id, zone_id, dine_in_restaurant_id, restaurant_id, is_active FROM users WHERE id = $1',
                    [decoded.userId]
                );
                if (rows[0]) {
                    userData = rows[0];
                    // Cache for 60s — invalidated on deactivation or role change
                    redis.setEx(userCacheKey(decoded.userId), USER_CACHE_TTL, JSON.stringify(userData)).catch(() => {});
                }
            } catch (e) {
                console.error('[AUTH] Status check failure:', e);
            }
        }

        if (!userData || !userData.is_active) {
            return res.status(401).json({ error: 'UNAUTHORIZED', message: 'User deactivated or not found' });
        }

        req.user = {
            userId: decoded.userId,
            role: userData.role,
            kitchenId: userData.kitchen_id,
            zoneId: userData.zone_id,
            restaurantId: userData.dine_in_restaurant_id ?? null,
            tenantRestaurantId: userData.restaurant_id ?? null,
            jti: decoded.jti,
        };
        setContextUserId(decoded.userId);
        next();
    } catch (err: any) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid token' });
    }
};

export const requireRole = (...roles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'FORBIDDEN', message: 'Insufficient permissions' });
        }
        next();
    };
};

export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return next();
    }
    return authenticate(req, res, next);
};

