import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { redis, keys } from '../redis';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

export interface AuthRequest extends Request {
    user?: {
        userId: string;
        role: string;
        kitchenId: string | null;
        zoneId: string | null;
        jti: string;
    };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing token' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        
        // Check if token is revoked with 1s safety timeout
        let isRevoked = null;
        try {
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('REDIS_TIMEOUT')), 1000));
            isRevoked = await Promise.race([redis.get(keys.revokedToken(decoded.jti)), timeoutPromise]);
        } catch (e) {
            console.warn('--- AUTH: REVOCATION CHECK TIMED OUT', e);
        }
        
        if (isRevoked) {
            return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Token revoked' });
        }

        // Always verify user status from DB (Redis cache removed — saves 2 Redis cmds/request)
        let userData = null;
        try {
            const { query } = require('../db');
            const { rows } = await query('SELECT role, kitchen_id, zone_id, is_active FROM users WHERE id = $1', [decoded.userId]);
            if (rows[0]) userData = rows[0];
        } catch (e) {
            console.error('--- AUTH: STATUS CHECK FAILURE', e);
        }

        if (!userData || !userData.is_active) {
            console.log(`[AUTH] Rejected userId=${decoded.userId} — userData=${JSON.stringify(userData)}`);
            return res.status(401).json({ error: 'UNAUTHORIZED', message: 'User deactivated or not found' });
        }

        req.user = {
            userId: decoded.userId,
            role: userData.role,
            kitchenId: userData.kitchen_id,
            zoneId: userData.zone_id,
            jti: decoded.jti
        };
        next();
    } catch (err: any) {
        console.log(`[AUTH] Token verify failed: ${err.message}`);
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

