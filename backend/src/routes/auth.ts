import { Router, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { query } from '../db';
import { redis, keys } from '../redis';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import axios from 'axios';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is not set');
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
if (!JWT_REFRESH_SECRET) throw new Error('JWT_REFRESH_SECRET environment variable is not set');

const phoneSchema = z.string().regex(/^91\d{10}$/);

// Non-customer roles that are exempt from the prelaunch gate — determined by each phone's
// ALREADY-established role in the DB, never trusted from client-supplied input.
const STAFF_ROLES = ['chef', 'rider', 'rider_captain', 'partner_kitchen', 'partner', 'super_admin', 'admin', 'finance', 'kitchen_manager', 'dine_in_staff', 'support', 'packer'];

// In-memory OTP fallback — works even when Redis is slow/down on Render free tier
const memOtp = new Map<string, { otp: string; exp: number }>();
const setMemOtp  = (phone: string, otp: string) => memOtp.set(phone, { otp, exp: Date.now() + 600_000 });
const getMemOtp  = (phone: string): string | null => {
    const e = memOtp.get(phone);
    if (!e || e.exp < Date.now()) { memOtp.delete(phone); return null; }
    return e.otp;
};
const delMemOtp  = (phone: string) => memOtp.delete(phone);

// In-memory OTP rate limit — fallback when Redis is down so the limit always applies
const memOtpCounts = new Map<string, { count: number; resetsAt: number }>();
const memOtpIncr = (phone: string): number => {
    const now = Date.now();
    const entry = memOtpCounts.get(phone);
    if (!entry || entry.resetsAt < now) {
        memOtpCounts.set(phone, { count: 1, resetsAt: now + 600_000 });
        return 1;
    }
    entry.count++;
    return entry.count;
};

const otpIpLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Limit each IP to 10 OTP requests per windowMs
    message: { error: 'TOO_MANY_OTP_IP', message: 'Too many OTP requests from this IP. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

router.post('/send-otp', otpIpLimiter, async (req, res) => {
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

    // Rate limit check — always enforced; Redis is primary, in-memory map is fallback
    let attempts = 0;
    try {
        attempts = await Promise.race([
            redis.incr(keys.otpAttempts(normalizedPhone)),
            new Promise<number>((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 3000)),
        ]) as number;
        if (attempts === 1) await redis.expire(keys.otpAttempts(normalizedPhone), 600).catch(() => {});
        console.log('[SEND_OTP] Rate limit count (Redis):', attempts);
    } catch (redisErr: any) {
        // Redis unavailable — use in-memory counter so the limit still applies
        attempts = memOtpIncr(normalizedPhone);
        console.error('[SEND_OTP] Redis down — using in-memory rate limit, count:', attempts);
    }
    if (attempts > 5) {
        return res.status(429).json({ error: 'TOO_MANY_OTP', message: 'Too many OTP requests. Please wait 10 minutes.' });
    }

    let smsSent = false;
    const msg91AuthKey = process.env.MSG91_AUTH_KEY;
    const msg91TemplateId = process.env.MSG91_TEMPLATE_ID || '6a5ae4478f489f578300d262';

    if (msg91AuthKey) {
        try {
            const msg91Res = await axios.post(
                'https://control.msg91.com/api/v5/otp',
                {
                    template_id: msg91TemplateId,
                    mobile: normalizedPhone,
                    otp: otp
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'authkey': msg91AuthKey
                    }
                }
            );
            // MSG91 can respond HTTP 200 with an error payload (bad key, no balance, etc.) --
            // axios only throws on non-2xx, so a 200 alone doesn't mean the SMS was accepted.
            console.log('[MSG91] Response for', normalizedPhone, ':', JSON.stringify(msg91Res.data));
            smsSent = msg91Res.data?.type === 'success';
            if (!smsSent) {
                console.error('[MSG91_REJECTED]', normalizedPhone, JSON.stringify(msg91Res.data));
            }
        } catch (error: any) {
            console.error('[MSG91_ERROR]', error?.response?.data || error.message);
        }
    } else {
        console.log('[OTP_FALLBACK] No MSG91 key configured');
    }

    res.json({
        sent: smsSent,
        phone: normalizedPhone,
        ...(process.env.NODE_ENV === 'development' ? { devOtp: otp } : {})
    });
    } catch (err: any) {
        console.error('[SEND_OTP] Unhandled error:', err.message, err.stack);
        res.status(500).json({ error: 'SERVER_ERROR', message: 'OTP send failed' });
    }
});


// Shared by every login path (SMS OTP, MSG91 widget token, ...) once the phone number has
// been verified by whatever mechanism that path uses. Keeping this in one place means a fix
// here (role checks, prelaunch gating, referral/wallet logic) can't drift between paths the
// way /verify-otp and the old /firebase-login independently did before.
async function completeAuth(
    normalizedPhone: string,
    opts: { referralCode?: string; name?: string; appRole?: string; lat?: number; lng?: number; platform?: string },
    res: Response
): Promise<void> {
    const { referralCode, name, appRole, lat, lng, platform } = opts;

    // Pre-launch mode check — gated on this phone's ALREADY-established role in the DB,
    // never the client-supplied appRole (which anyone could set to bypass the gate otherwise).
    // The mobile apps are exempt entirely (platform: 'app') -- prelaunch only gates the website.
    const { rows: existingRoleRows } = await query('SELECT role FROM users WHERE phone = $1', [normalizedPhone]);
    const existingRole = existingRoleRows[0]?.role;
    if (platform !== 'app' && (!existingRole || !STAFF_ROLES.includes(existingRole))) {
        const { rows: configRows } = await query(`SELECT value FROM app_config WHERE key = 'IS_PRELAUNCH_MODE'`);
        const isPrelaunch = configRows[0]?.value === 'true' || configRows[0]?.value === true;
        if (isPrelaunch) {
            res.status(403).json({ error: 'PRELAUNCH_ACTIVE', message: 'We are currently in pre-launch mode. Please join the waitlist!' });
            return;
        }
    }

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
        // Riders only ever get promoted via the apply → admin-approval flow (admin.ts, on
        // rider_applications approval). Never auto-promote an arbitrary phone number here —
        // just leave insertRole/roleUpdate at their defaults if they're not already a rider.
        const { rows: riderRows } = await query(
            `SELECT id FROM users WHERE phone = $1 AND role::text IN ('rider', 'rider_captain')`,
            [normalizedPhone]
        );
        if (riderRows.length === 0) {
            res.status(403).json({ error: 'NOT_RIDER', message: 'This number is not registered as a rider. Please apply first.' });
            return;
        }
    }
    if (appRole === 'chef') {
        // Kitchen app: only pre-authorized accounts (role='chef' set by admin) can log in.
        // Never auto-promote an arbitrary phone number to chef.
        // Cast role::text so the IN list never throws "invalid enum value" if new roles
        // are added in code before the corresponding enum migration is deployed.
        const { rows: chefRows } = await query(
            `SELECT id FROM users WHERE phone = $1 AND role::text IN ('chef', 'kitchen_manager', 'partner_kitchen', 'dine_in_staff', 'packer')`,
            [normalizedPhone]
        );
        if (chefRows.length === 0) {
            res.status(403).json({ error: 'NOT_KITCHEN_STAFF', message: 'This number is not registered as kitchen staff. Contact your manager.' });
            return;
        }
        // Leave insertRole / roleUpdate at their defaults — don't change the existing role.
    }

    if (process.env.NODE_ENV === 'development') {
        if (normalizedPhone === '917892493486') {
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
        `INSERT INTO users (phone, name, role, is_verified${zoneInsertKeys}) VALUES ($1, $2, $3, $4${zoneInsertVals}) ON CONFLICT (phone) DO UPDATE SET is_active = true${roleUpdate} RETURNING id, name, phone, role, kitchen_id, zone_id, terms_accepted_at, is_verified, onboarding_complete, email, photo_url, prelaunch_reward_credited`,
        [normalizedPhone, name || '2QT User', insertRole, insertVerified]
    );

    const user = rows[0];

    // If new user, create wallet & add sign-up bonus
    const { rowCount: walletCreated } = await query(
        'INSERT INTO customer_wallet (customer_id, balance_paise) VALUES ($1, 0) ON CONFLICT (customer_id) DO NOTHING',
        [user.id]
    );
    if ((walletCreated ?? 0) > 0) {
        // Loyalty Bonus
        await query(`
            INSERT INTO loyalty_transactions (customer_id, points, type, expires_at)
            VALUES ($1, 500, 'earn', NOW() + INTERVAL '1 year')
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

    // Pre-launch wallet reward — credit ₹100 to users who registered on the waitlist
    // Runs on every login but only fires once (guarded by prelaunch_reward_credited flag).
    if (user.role === 'customer' && !user.prelaunch_reward_credited) {
        try {
            const { rows: plRows } = await query(
                `SELECT id FROM pre_launch_registrations WHERE phone = $1 AND reward_credited = false`,
                [user.phone]
            );
            if (plRows.length > 0) {
                const { rows: cfgRows } = await query(
                    `SELECT key, value FROM app_config WHERE key IN ('prelaunch_reward_active','prelaunch_reward_paise','prelaunch_reward_validity_days')`
                );
                const cfg: Record<string, any> = {};
                cfgRows.forEach((r: any) => { cfg[r.key] = r.value; });
                const rewardActive = cfg.prelaunch_reward_active === true || cfg.prelaunch_reward_active === 'true';
                if (rewardActive) {
                    const paise     = typeof cfg.prelaunch_reward_paise === 'number' ? cfg.prelaunch_reward_paise : parseInt(cfg.prelaunch_reward_paise || '10000', 10);
                    const validDays = typeof cfg.prelaunch_reward_validity_days === 'number' ? cfg.prelaunch_reward_validity_days : parseInt(cfg.prelaunch_reward_validity_days || '7', 10);

                    await query(`INSERT INTO customer_wallet (customer_id, balance_paise) VALUES ($1,0) ON CONFLICT DO NOTHING`, [user.id]);
                    await query(`UPDATE customer_wallet SET balance_paise = balance_paise + $1 WHERE customer_id = $2`, [paise, user.id]);
                    const { rows: wRows } = await query(`SELECT balance_paise FROM customer_wallet WHERE customer_id = $1`, [user.id]);

                    await query(`
                        INSERT INTO wallet_transactions (customer_id, amount_paise, type, description, balance_after_paise)
                        VALUES ($1,$2,'credit','Pre-Launch Exclusive Reward — Welcome to 2QT!',$3)
                    `, [user.id, paise, wRows[0]?.balance_paise ?? paise]);

                    await query(`UPDATE users SET prelaunch_reward_credited = true WHERE id = $1`, [user.id]);

                    const expiresAt = new Date();
                    expiresAt.setDate(expiresAt.getDate() + validDays);
                    await query(`
                        UPDATE pre_launch_registrations
                        SET reward_credited = true, reward_credited_at = NOW(), reward_expires_at = $1, user_id = $2
                        WHERE phone = $3
                    `, [expiresAt.toISOString(), user.id, user.phone]);

                    console.log(`--- PRELAUNCH REWARD: ₹${paise/100} credited to ${user.id} ---`);
                }
            }
        } catch (plErr: any) {
            // Non-fatal — never block login for reward failure
            console.error('[PRELAUNCH REWARD SKIP]', plErr.message);
        }
    }

    const jti = crypto.randomUUID();

    const accessToken = jwt.sign(
        { userId: user.id, role: user.role, kitchenId: user.kitchen_id ?? null, zoneId: user.zone_id ?? null, jti },
        JWT_SECRET!,
        { expiresIn: '2h' }
    );

    const refreshToken = jwt.sign(
        { userId: user.id, jti },
        JWT_REFRESH_SECRET!,
        { expiresIn: '7d' }
    );

    const tokenHash = await bcrypt.hash(refreshToken, 10);
    await query(
        'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + interval \'7 days\')',
        [user.id, tokenHash]
    );

    let kitchenName: string | null = null;
    if (user.kitchen_id) {
        const { rows: kRows } = await query('SELECT name FROM kitchens WHERE id = $1', [user.kitchen_id]);
        if (kRows[0]) kitchenName = kRows[0].name;
    }

    res.json({
        user: {
            id: user.id,
            name: user.name,
            phone: user.phone,
            role: user.role,
            kitchenId: user.kitchen_id ?? null,
            kitchenName: kitchenName,
            zoneId: user.zone_id ?? null,
            termsAccepted: !!user.terms_accepted_at,
            onboarding_complete: user.onboarding_complete,
            is_verified: user.is_verified
        },
        accessToken,
        refreshToken
    });
}

router.post('/verify-otp', async (req, res) => {
    try {
        const { phone, otp, referralCode, name, appRole, lat, lng, platform } = req.body;
        let normalizedPhone = String(phone).replace(/\D/g, '');
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

        const TEST_ACCOUNTS = ["919999999999", "917892493486", "912222222222", "913333333333"];
        if (TEST_ACCOUNTS.includes(normalizedPhone) && String(otp) === '123456') {
            storedOtp = '123456'; // Allow test account bypass
        }

        if (!storedOtp || storedOtp !== String(otp)) {
            return res.status(400).json({ error: 'INVALID_OTP', message: 'Invalid or expired OTP' });
        }
        delMemOtp(normalizedPhone);
        redis.del(keys.pendingOtp(normalizedPhone)).catch(() => {});

        await completeAuth(normalizedPhone, { referralCode, name, appRole, lat, lng, platform }, res);
    } catch (err: any) {
        console.error('VERIFY OTP CRASH:', err);
        res.status(500).json({ error: 'SERVER_ERROR', message: 'Something went wrong during login.' });
    }
});

// MSG91 Widget (React Native SDK) login — the widget handles phone entry + OTP send + OTP
// verify entirely on-device and hands back an access-token, which we verify server-side
// (same pattern already proven working in prelaunch.ts) to get the real phone number, then
// run it through the exact same completeAuth logic as the SMS-OTP path above.
router.post('/verify-widget-token', async (req, res) => {
    try {
        const { accessToken, referralCode, name, appRole, lat, lng, platform } = req.body;
        if (!accessToken) return res.status(400).json({ error: 'MISSING_TOKEN', message: 'accessToken is required' });

        const verifyRes = await fetch('https://api.msg91.com/api/v5/widget/verifyAccessToken', {
            method: 'POST',
            headers: { 'authkey': process.env.MSG91_AUTH_KEY || '', 'content-type': 'application/json' },
            body: JSON.stringify({ 'access-token': accessToken })
        });
        const verifyData: any = await verifyRes.json();
        if (verifyData.type !== 'success') {
            return res.status(401).json({ error: 'INVALID_TOKEN', message: verifyData.message || 'Widget token verification failed' });
        }

        const rawPhone = verifyData.message || verifyData.mobile || verifyData.messageData?.mobile;
        if (!rawPhone) return res.status(400).json({ error: 'NO_PHONE' });
        let normalizedPhone = String(rawPhone).replace(/\D/g, '');
        if (normalizedPhone.length === 10) normalizedPhone = '91' + normalizedPhone;
        if (!phoneSchema.safeParse(normalizedPhone).success) {
            return res.status(400).json({ error: 'INVALID_PHONE', message: 'Phone must be 12 digits starting with 91' });
        }

        await completeAuth(normalizedPhone, { referralCode, name, appRole, lat, lng, platform }, res);
    } catch (err: any) {
        console.error('VERIFY WIDGET TOKEN CRASH:', err);
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
        if (!user || !user.is_active) {
            console.log(`[REFRESH] User ${decoded.userId} not found or deactivated`);
            return res.status(401).json({ error: 'INVALID_TOKEN' });
        }

        // Fetch and verify refresh token hashes from DB
        const { rows: dbTokens } = await query(
            'SELECT token_hash, revoked_at FROM refresh_tokens WHERE user_id = $1 AND expires_at > NOW()',
            [decoded.userId]
        );
        
        const validTokens = dbTokens.filter((t: any) => t.revoked_at === null);
        const matches = await Promise.all(validTokens.map((t: any) => bcrypt.compare(refreshToken, t.token_hash)));
        const tokenMatch = matches.includes(true);

        if (!tokenMatch) {
            console.log(`[REFRESH] Token hash not matched or revoked for user ${decoded.userId}`);
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
    
    // Revoke current access token jti in Redis — TTL must cover the token's full
    // lifetime (2h, matching the accessToken expiresIn), otherwise a captured token
    // would work again once this revocation entry expires but the token itself hasn't.
    await redis.set(keys.revokedToken(user.jti), '1', { EX: 2 * 60 * 60 });

    // Revoke all refresh tokens
    await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1', [user.userId]);

    res.json({ success: true });
});

router.post('/kitchen-pin', async (req, res) => {
    const { pin } = req.body;
    if (String(pin).length !== 4) return res.status(400).json({ error: 'INVALID_PIN' });

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
        const chefPhone = '91' + String(kitchen.id).replace(/\D/g, '').slice(0, 10).padEnd(10, '0');
        
        const { rows: users } = await query(
            'INSERT INTO users (phone, name, role, kitchen_id) VALUES ($1, $2, \'chef\', $3) ON CONFLICT (phone) DO UPDATE SET kitchen_id = $3 RETURNING id',
            [chefPhone, kitchen.name + ' Staff', kitchen.id]
        );
        const user = users[0];

        const jti = crypto.randomUUID();
        const accessToken = jwt.sign(
            { userId: user.id, role: 'chef', kitchenId: kitchen.id, zoneId: null, jti },
            JWT_SECRET,
            { expiresIn: '2h' }
        );

        const refreshToken = jwt.sign(
            { userId: user.id, jti },
            JWT_REFRESH_SECRET,
            { expiresIn: '30d' }
        );

        const tokenHash = await bcrypt.hash(refreshToken, 10);
        await query(
            'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + interval \'30 days\')',
            [user.id, tokenHash]
        );

        res.json({ accessToken, refreshToken, kitchen: { id: kitchen.id, name: kitchen.name } });
    } catch (err: any) {
        console.error('KITCHEN_PIN_ERROR:', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

router.post('/update-role', authenticate, requireRole('super_admin'), async (req: AuthRequest, res) => {
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

