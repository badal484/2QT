// @ts-nocheck
import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { query } from '../db';
import { redis, keys } from '../redis';
import { authenticate, AuthRequest } from '../middleware/auth';
import axios from 'axios';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh_secret';

const phoneSchema = z.string().regex(/^91\d{10}$/);

// In-memory OTP fallback — works even when Redis is slow/down on Render free tier
const memOtp = new Map<string, { otp: string; exp: number }>();
const setMemOtp  = (phone: string, otp: string) => memOtp.set(phone, { otp, exp: Date.now() + 600_000 });
const getMemOtp  = (phone: string): string | null => {
    const e = memOtp.get(phone);
    if (!e || e.exp < Date.now()) { memOtp.delete(phone); return null; }
    return e.otp;
};
const delMemOtp  = (phone: string) => memOtp.delete(phone);

router.post('/send-otp', async (req, res) => {
    try {
    console.log('[SEND_OTP] Hit — body:', JSON.stringify(req.body));
    const { phone } = req.body;
    if (!phone) {
        console.log('[SEND_OTP] ERROR: phone missing from body');
        return res.status(400).json({ error: 'INVALID_PHONE', message: 'Phone is required' });
    }
    let normalizedPhone = phone.replace(/\D/g, '');
    if (normalizedPhone.length === 10) normalizedPhone = '91' + normalizedPhone;
    console.log('[SEND_OTP] Normalized phone:', normalizedPhone);

    if (!phoneSchema.safeParse(normalizedPhone).success) {
        console.log('[SEND_OTP] Phone failed schema validation:', normalizedPhone);
        return res.status(400).json({ error: 'INVALID_PHONE', message: 'Phone must be 12 digits starting with 91' });
    }

    // Generate OTP — store in memory FIRST (instant, no network), then try Redis
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    setMemOtp(normalizedPhone, otp);          // always succeeds, no await
    console.log(`[OTP] ${normalizedPhone} → ${otp}`);
    try {
        await Promise.race([
            redis.set(keys.pendingOtp(normalizedPhone), otp, { EX: 600 }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 3000)),
        ]);
    } catch (redisErr: any) {
        console.error('[SEND_OTP] Redis slow/down — OTP stored in memory only:', redisErr.message);
    }

    // Rate limit check (count only, OTP already logged above so you can always find it)
    let attempts = 0;
    try {
        attempts = await Promise.race([
            redis.incr(keys.otpAttempts(normalizedPhone)),
            new Promise<number>((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 3000)),
        ]) as number;
        if (attempts === 1) await redis.expire(keys.otpAttempts(normalizedPhone), 600).catch(() => {});
        console.log('[SEND_OTP] Rate limit count:', attempts);
    } catch (redisErr: any) {
        console.error('[SEND_OTP] Redis error on rate-limit check:', redisErr.message);
    }
    if (attempts > 100) {
        return res.status(429).json({ error: 'TOO_MANY_OTP', message: 'Too many OTP requests, please try again in 10 minutes.' });
    }

    let smsSent = false;
    if (process.env.MSG91_AUTH_KEY) {
        try {
            await axios.post(
                'https://control.msg91.com/api/v5/otp',
                {
                    template_id: process.env.MSG91_TEMPLATE_ID,
                    mobile: normalizedPhone,
                    authkey: process.env.MSG91_AUTH_KEY,
                    otp: otp
                },
                { headers: { 'Content-Type': 'application/json' } }
            );
            smsSent = true;
            console.log('[MSG91] SMS dispatched to', normalizedPhone);
        } catch (error: any) {
            console.error('[MSG91_ERROR]', error?.response?.data || error.message);
        }
    } else {
        console.log('[OTP_FALLBACK] No MSG91 key — returning OTP in response body');
    }

    // Return OTP in response only when SMS delivery is not configured/working
    // so the frontend can auto-fill it during development / testing
    res.json({
        sent: true,
        phone: normalizedPhone,
        ...(!smsSent && { devOtp: otp }),
    });
    } catch (err: any) {
        console.error('[SEND_OTP] Unhandled error:', err.message, err.stack);
        res.status(500).json({ error: 'SERVER_ERROR', message: 'OTP send failed' });
    }
});

router.post('/verify-otp', async (req, res) => {
    try {
        const { phone, otp, referralCode, name, appRole, lat, lng } = req.body;
        let normalizedPhone = phone.replace(/\D/g, '');
        if (normalizedPhone.length === 10) normalizedPhone = '91' + normalizedPhone;
        
        // Check memory first (works even when Redis is down), then Redis
        let storedOtp: string | null = getMemOtp(normalizedPhone);
        if (!storedOtp) {
            try {
                storedOtp = await Promise.race([
                    redis.get(keys.pendingOtp(normalizedPhone)),
                    new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 3000)),
                ]) as string | null;
            } catch { storedOtp = null; }
        }
        if (!storedOtp || storedOtp !== String(otp)) {
            return res.status(400).json({ error: 'INVALID_OTP', message: 'Invalid or expired OTP' });
        }
        delMemOtp(normalizedPhone);
        redis.del(keys.pendingOtp(normalizedPhone)).catch(() => {});

    let roleUpdate = '';
    let insertRole = 'customer';
    let insertVerified = false;

    let detectedZoneId = null;
    let detectedKitchenId = null;
    let zoneInsertKeys = '';
    let zoneInsertVals = '';
    let zoneUpdateKeys = '';

    if (lat && lng && appRole !== 'rider' && appRole !== 'chef' && appRole !== 'admin') {
        const { rows: zones } = await query(`
            SELECT id, radius_km, polygon_points,
            (6371 * acos(cos(radians($1)) * cos(radians(kitchen_lat)) * cos(radians(kitchen_lng) - radians($2)) + sin(radians($1)) * sin(radians(kitchen_lat)))) AS distance
            FROM zones WHERE is_active = true ORDER BY distance ASC
        `, [lat, lng]);

        const isPointInPolygon = (point: {lat: number, lng: number}, polygon: {lat: number, lng: number}[]) => {
            let x = point.lng, y = point.lat, inside = false;
            for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
                let xi = polygon[i].lng, yi = polygon[i].lat, xj = polygon[j].lng, yj = polygon[j].lat;
                let intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
                if (intersect) inside = !inside;
            }
            return inside;
        };

        for (const zone of zones) {
            let isMatch = false;
            if (zone.polygon_points && Array.isArray(zone.polygon_points) && zone.polygon_points.length > 2) {
                isMatch = isPointInPolygon({ lat, lng }, zone.polygon_points);
            } else {
                isMatch = zone.distance <= zone.radius_km;
            }
            
            if (isMatch) {
                detectedZoneId = zone.id;
                const { rows: kInfo } = await query(`SELECT k.id FROM kitchens k JOIN kitchen_zones kz ON k.id = kz.kitchen_id WHERE kz.zone_id = $1 LIMIT 1`, [zone.id]);
                if (kInfo.length > 0) detectedKitchenId = kInfo[0].id;
                break;
            }
        }
    }

    if (detectedZoneId) {
        zoneInsertKeys = ', zone_id';
        zoneInsertVals = `, '${detectedZoneId}'`;
        zoneUpdateKeys += `, zone_id = COALESCE(users.zone_id, '${detectedZoneId}')`;
    }
    if (detectedKitchenId) {
        zoneInsertKeys += ', kitchen_id';
        zoneInsertVals += `, '${detectedKitchenId}'`;
        zoneUpdateKeys += `, kitchen_id = COALESCE(users.kitchen_id, '${detectedKitchenId}')`;
    }

    if (appRole === 'rider') {
        insertRole = 'rider';
        roleUpdate = `, role = 'rider'`;
    }

    if (process.env.NODE_ENV === 'development') {
        if (normalizedPhone === '910000000000') {
            roleUpdate = ", role = 'super_admin', is_verified = true";
            insertRole = 'super_admin';
            insertVerified = true;
        } else if (normalizedPhone === '912222222222') {
            // Dev chef shortcut — assigns to first available kitchen
            roleUpdate = ", role = 'chef', is_verified = true";
            insertRole = 'chef';
            insertVerified = true;
        } else if (normalizedPhone === '913333333333') {
            roleUpdate = ", role = 'rider', is_verified = true";
            insertRole = 'rider';
            insertVerified = true;
        } else if (appRole === 'rider') {
            roleUpdate = ", role = 'rider', is_verified = true";
            insertRole = 'rider';
            insertVerified = true;
        }
    }

    roleUpdate += zoneUpdateKeys;

    const { rows } = await query(
        `INSERT INTO users (phone, name, role, is_verified${zoneInsertKeys}) VALUES ($1, $2, $3, $4${zoneInsertVals}) ON CONFLICT (phone) DO UPDATE SET is_active = true${roleUpdate} RETURNING id, name, phone, role, kitchen_id, zone_id, terms_accepted_at, is_verified`,
        [normalizedPhone, name || '2QT User', insertRole, insertVerified]
    );

    const user = rows[0];

    // Initialize wallet and award Welcome Bonus if new
    const { rowCount: walletCreated } = await query('INSERT INTO customer_wallet (customer_id, balance_paise) VALUES ($1, 0) ON CONFLICT (customer_id) DO NOTHING', [user.id]);
    
    // Systematic Welcome Bonus & Referral Linking
    if (walletCreated > 0) {
        // 1. Initial Loyalty Points
        await query(`
            INSERT INTO loyalty_transactions (customer_id, points, type)
            VALUES ($1, 500, 'earn')
        `, [user.id]);

        // 2. Referral Logic
        if (referralCode) {
            const { rows: referrers } = await query('SELECT id FROM users WHERE referral_code = $1', [referralCode]);
            if (referrers[0]) {
                const referrerId = referrers[0].id;
                
                // Award ₹50 to the NEW user
                await query('UPDATE customer_wallet SET balance_paise = balance_paise + 5000 WHERE customer_id = $1', [user.id]);
                await query(`
                    INSERT INTO wallet_transactions (customer_id, amount_paise, type, description, balance_after_paise)
                    VALUES ($1, 5000, 'credit', 'Referral Welcome Bonus', 5000)
                `, [user.id]);

                // Log the referral link
                await query(`
                    INSERT INTO referrals (referrer_id, referred_id, status)
                    VALUES ($1, $2, 'pending')
                    ON CONFLICT (referred_id) DO NOTHING
                `, [referrerId, user.id]);
                
                console.log(`--- SYSTEMATIC REFERRAL: User ${user.id} rewarded via ${referrerId} ---`);
            }
        }
    }

    const jti = crypto.randomUUID();

    const accessToken = jwt.sign(
        { userId: user.id, role: user.role, kitchenId: user.kitchen_id ?? null, zoneId: user.zone_id ?? null, jti },
        JWT_SECRET,
        { expiresIn: '2h' }
    );

    const refreshToken = jwt.sign(
        { userId: user.id, jti },
        JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
    );

    const tokenHash = await bcrypt.hash(refreshToken, 10);
    await query(
        'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + interval \'7 days\')',
        [user.id, tokenHash]
    );

    res.json({
        user: {
            id: user.id,
            name: user.name,
            phone: user.phone,
            role: user.role,
            kitchenId: user.kitchen_id ?? null,
            zoneId: user.zone_id ?? null,
            termsAccepted: !!user.terms_accepted_at
        },
        accessToken,
        refreshToken
    });
    } catch (err: any) {
        console.error('VERIFY OTP CRASH:', err);
        res.status(500).json({ error: 'SERVER_ERROR', message: 'Something went wrong during login.' });
    }
});

router.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        console.log('[REFRESH] No token in body');
        return res.status(400).json({ error: 'MISSING_TOKEN' });
    }

    try {
        const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;
        console.log(`[REFRESH] JWT valid, userId=${decoded.userId}`);

        const userRes = await query(
            'SELECT role, kitchen_id, zone_id, is_active FROM users WHERE id = $1',
            [decoded.userId]
        );
        const user = userRes.rows[0];
        if (!user) {
            console.log(`[REFRESH] User ${decoded.userId} not found in DB`);
            return res.status(401).json({ error: 'INVALID_TOKEN' });
        }
        if (!user.is_active) {
            console.log(`[REFRESH] User ${decoded.userId} is deactivated`);
            return res.status(401).json({ error: 'INVALID_TOKEN' });
        }

        const jti = crypto.randomUUID();
        const accessToken = jwt.sign(
            { userId: decoded.userId, role: user.role, kitchenId: user.kitchen_id, zoneId: user.zone_id, jti },
            JWT_SECRET,
            { expiresIn: '2h' }
        );
        console.log(`[REFRESH] Success for userId=${decoded.userId}`);
        res.json({ accessToken });
    } catch (err: any) {
        console.log(`[REFRESH] Failed: ${err.message}`);
        res.status(401).json({ error: 'INVALID_TOKEN' });
    }
});

router.delete('/logout', authenticate, async (req: AuthRequest, res) => {
    const user = req.user!;
    
    // Revoke current access token jti in Redis
    await redis.set(keys.revokedToken(user.jti), '1', { EX: 15 * 60 });

    // Revoke all refresh tokens
    await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1', [user.userId]);

    res.json({ success: true });
});

router.post('/kitchen-pin', async (req, res) => {
    const { pin } = req.body;
    if (pin.length !== 4) return res.status(400).json({ error: 'INVALID_PIN' });

    try {
        // 1. Get all kitchens with PINs
        const { rows: kitchens } = await query('SELECT id, name, pin_hash FROM kitchens');
        
        let kitchen = null;
        let valid = false;

        // 2. Find matching kitchen
        if (process.env.NODE_ENV === 'development' && pin === '0000') {
            // In dev, if using 0000, pick the kitchen that has the most recent order
            // This helps testing when multiple kitchens exist
            const { rows: activeKitchens } = await query(`
                SELECT k.id, k.name 
                FROM kitchens k 
                LEFT JOIN orders o ON k.id = o.kitchen_id 
                GROUP BY k.id, k.name 
                ORDER BY MAX(o.created_at) DESC NULLS LAST 
                LIMIT 1
            `);
            kitchen = activeKitchens[0] || kitchens[0];
            valid = true;
        } else {
            for (const k of kitchens) {
                if (k.pin_hash && await bcrypt.compare(pin, k.pin_hash)) {
                    kitchen = k;
                    valid = true;
                    break;
                }
            }
        }

        if (!valid || !kitchen) return res.status(401).json({ error: 'INVALID_PIN' });

        // Ensure a user record exists for this kitchen/chef
        // Generate a deterministic phone number based on kitchen ID for the chef account
        const chefPhone = '91' + kitchen.id.replace(/\D/g, '').slice(0, 10).padEnd(10, '0');
        
        const { rows: users } = await query(
            'INSERT INTO users (phone, name, role, kitchen_id) VALUES ($1, $2, \'chef\', $3) ON CONFLICT (phone) DO UPDATE SET kitchen_id = $3 RETURNING id',
            [chefPhone, kitchen.name + ' Staff', kitchen.id]
        );
        const user = users[0];

        const jti = crypto.randomUUID();
        const accessToken = jwt.sign(
            { userId: user.id, role: 'chef', kitchenId: kitchen.id, zoneId: null, jti },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({ accessToken, kitchen: { id: kitchen.id, name: kitchen.name } });
    } catch (err: any) {
        console.error('KITCHEN_PIN_ERROR:', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

router.post('/update-role', authenticate, async (req: AuthRequest, res) => {
    // In production, this should be super_admin only
    // In development, we allow it for easy testing
    if (process.env.NODE_ENV !== 'development' && req.user!.role !== 'super_admin') {
        return res.status(403).json({ error: 'FORBIDDEN' });
    }

    const { role, userId } = req.body;
    const targetUserId = userId || req.user!.userId;

    await query('UPDATE users SET role = $1, onboarding_complete = false WHERE id = $2', [role, targetUserId]);
    res.json({ success: true, role });
});

router.post('/onboarding/complete', authenticate, async (req: AuthRequest, res) => {
    const userId = req.user!.userId;
    await query('UPDATE users SET onboarding_complete = true WHERE id = $1', [userId]);
    res.json({ success: true });
});

export default router;
