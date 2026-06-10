// @ts-nocheck
import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { query } from '../db';
import { redis, keys } from '../redis';
import { otpLimiter } from '../middleware/rateLimiter';
import { authenticate, AuthRequest } from '../middleware/auth';
import axios from 'axios';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh_secret';

const phoneSchema = z.string().regex(/^91\d{10}$/);

router.post('/send-otp', otpLimiter, async (req, res) => {
    const { phone } = req.body;
    let normalizedPhone = phone.replace(/\D/g, '');
    if (normalizedPhone.length === 10) normalizedPhone = '91' + normalizedPhone;

    if (!phoneSchema.safeParse(normalizedPhone).success) {
        return res.status(400).json({ error: 'INVALID_PHONE', message: 'Phone must be 12 digits starting with 91' });
    }

    // Rate limit: 20 per 10 minutes (generous for testing; tighten when SMS is live)
    const attempts = await redis.incr(keys.otpAttempts(normalizedPhone));
    if (attempts === 1) await redis.expire(keys.otpAttempts(normalizedPhone), 600);
    if (attempts > 20) {
        return res.status(429).json({ error: 'TOO_MANY_OTP', message: 'Too many OTP requests, please try again in 10 minutes.' });
    }

    // Generate random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await redis.set(keys.pendingOtp(normalizedPhone), otp, { EX: 600 });

    // Always visible in Render logs
    console.log(`[OTP] ${normalizedPhone} → ${otp}`);

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
        } catch (error: any) {
            console.error('[MSG91_ERROR]', error?.response?.data || error.message);
        }
    }

    res.json({ sent: true, phone: normalizedPhone });
});

router.post('/verify-otp', async (req, res) => {
    try {
        const { phone, otp, referralCode, name, appRole } = req.body;
        let normalizedPhone = phone.replace(/\D/g, '');
        if (normalizedPhone.length === 10) normalizedPhone = '91' + normalizedPhone;
        
        // Verify OTP against stored value in Redis
        const storedOtp = await redis.get(keys.pendingOtp(normalizedPhone));
        if (!storedOtp || storedOtp !== String(otp)) {
            return res.status(400).json({ error: 'INVALID_OTP', message: 'Invalid or expired OTP' });
        }
        await redis.del(keys.pendingOtp(normalizedPhone));

    let roleUpdate = '';
    let insertRole = 'customer';
    let insertVerified = false;

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

    const { rows } = await query(
        `INSERT INTO users (phone, name, role, is_verified) VALUES ($1, $2, $3, $4) ON CONFLICT (phone) DO UPDATE SET is_active = true${roleUpdate} RETURNING id, name, phone, role, kitchen_id, zone_id, terms_accepted_at, is_verified`,
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
    if (!refreshToken) return res.status(400).json({ error: 'MISSING_TOKEN' });

    try {
        const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;
        
        // Find token hash in DB
        const { rows } = await query(
            'SELECT * FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()',
            [decoded.userId]
        );

        let valid = false;
        for (const row of rows) {
            if (await bcrypt.compare(refreshToken, row.token_hash)) {
                valid = true;
                break;
            }
        }

        if (!valid) return res.status(401).json({ error: 'INVALID_TOKEN' });

        // Get user for role etc.
        const userRes = await query('SELECT role, kitchen_id, zone_id FROM users WHERE id = $1', [decoded.userId]);
        const user = userRes.rows[0];

        const jti = crypto.randomUUID();
        const accessToken = jwt.sign(
            { userId: decoded.userId, role: user.role, kitchenId: user.kitchen_id, zoneId: user.zone_id, jti },
            JWT_SECRET,
            { expiresIn: '2h' }
        );

        res.json({ accessToken });
    } catch (err) {
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
