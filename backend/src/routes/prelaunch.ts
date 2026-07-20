import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import pool, { query } from '../db';
import { authenticate, requireRole } from '../middleware/auth';
import { firebaseAdminAuth } from '../config/firebaseAdmin';
import { redis } from '../redis';

const router = Router();

const JWT_SECRET        = process.env.JWT_SECRET!;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;

function genReferralCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ── Public ──────────────────────────────────────────────────────────────────

// Live registration counter shown on landing page
router.get('/stats', async (_req, res) => {
    try {
        const { rows } = await query(`SELECT COUNT(*) AS count FROM pre_launch_registrations`);
        res.json({ success: true, count: parseInt(rows[0].count, 10) });
    } catch {
        res.json({ success: false, count: 0 });
    }
});

// Check pre-launch gate status (called by Next.js middleware / page)
router.get('/config', async (_req, res) => {
    try {
        const { rows } = await query(`SELECT key, value FROM app_config WHERE key LIKE 'prelaunch_%' OR key = 'IS_PRELAUNCH_MODE'`);
        const cfg: Record<string, any> = {};
        rows.forEach((r: any) => { cfg[r.key] = r.value; });
        const isPrelaunch = cfg['IS_PRELAUNCH_MODE'] === true || cfg['IS_PRELAUNCH_MODE'] === 'true';
        res.json({ success: true, isPrelaunch, config: cfg });
    } catch {
        res.json({ success: false, isPrelaunch: false, config: {} });
    }
});

// ── OTP (MSG91 REST API — no widget, no reCAPTCHA) ──────────────────────────

function normPhone(raw: any): string | null {
    let p = String(raw || '').replace(/\D/g, '');
    if (p.length === 10) p = '91' + p;
    return /^91\d{10}$/.test(p) ? p : null;
}

const plOtpStore = new Map<string, { otp: string; exp: number }>();

router.post('/send-otp', async (req, res) => {
    try {
        const phone = normPhone(req.body.phone);
        if (!phone) return res.status(400).json({ error: 'INVALID_PHONE' });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        plOtpStore.set(phone, { otp, exp: Date.now() + 600_000 });
        await redis.setEx(`prelaunch_otp:${phone}`, 600, otp).catch(() => {});
        console.log(`[PRELAUNCH OTP] ${phone} → ${otp}`);

        const authKey    = process.env.MSG91_AUTH_KEY    || '524621TvewiLzS6a5add22P1';
        const templateId = process.env.MSG91_TEMPLATE_ID || '6a5ae4478f489f578300d262';

        let msg91Data: any = null;
        if (authKey && templateId) {
            try {
                // MSG91 /otp endpoint
                const msg91Res = await fetch('https://control.msg91.com/api/v5/otp', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'authkey': authKey
                    },
                    body: JSON.stringify({ 
                        template_id: templateId, 
                        mobile: phone,
                        otp: otp
                    })
                });
                msg91Data = await msg91Res.json().catch(() => ({}));
                console.log('[PRELAUNCH OTP] MSG91 response:', JSON.stringify(msg91Data));

                if (msg91Data.type === 'success') {
                    console.log('[PRELAUNCH OTP] SMS sent successfully via MSG91');
                } else {
                    console.error('[PRELAUNCH OTP] MSG91 rejected:', msg91Data.message || msg91Data);
                }
            } catch (e: any) {
                console.error('[PRELAUNCH OTP] MSG91 fetch error:', e.message);
                msg91Data = { error: e.message };
            }
        } else {
            console.warn('[PRELAUNCH OTP] MSG91 credentials missing — SMS not sent');
        }

        res.json({ sent: true });
    } catch (err: any) {
        console.error('[PRELAUNCH SEND_OTP]', err.message);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

router.post('/verify-otp', async (req, res) => {
    try {
        const phone = normPhone(req.body.phone);
        if (!phone) return res.status(400).json({ error: 'INVALID_PHONE' });

        const { otp } = req.body;
        if (!otp) return res.status(400).json({ error: 'OTP_REQUIRED' });

        const stored =
            (await redis.get(`prelaunch_otp:${phone}`).catch(() => null)) ??
            (plOtpStore.get(phone)?.exp! > Date.now() ? plOtpStore.get(phone)?.otp : undefined);

        if (!stored || stored !== String(otp))
            return res.status(400).json({ error: 'INVALID_OTP', message: 'Incorrect OTP. Please try again.' });

        await redis.del(`prelaunch_otp:${phone}`).catch(() => {});
        plOtpStore.delete(phone);

        // Short-lived token for /register
        const phoneToken = jwt.sign({ phone, sub: 'prelaunch' }, JWT_SECRET, { expiresIn: '10m' });

        // Check registration status (same query as /me)
        const { rows: totalRows } = await query(`SELECT COUNT(*) as count FROM pre_launch_registrations`);
        const total = parseInt(totalRows[0].count, 10);
        const { rows } = await query(
            `WITH RC AS (SELECT referred_by, COUNT(*) as ref_count FROM pre_launch_registrations WHERE referred_by IS NOT NULL AND survey_responses IS NOT NULL AND survey_responses != '{}'::jsonb GROUP BY referred_by)
             SELECT r.*, COALESCE(rc.ref_count, 0) as ref_count,
                    RANK() OVER (ORDER BY COALESCE(rc.ref_count, 0) DESC, r.created_at ASC) as rank
             FROM pre_launch_registrations r
             LEFT JOIN RC rc ON r.referral_code = rc.referred_by
             WHERE r.phone = $1 OR r.phone = $2`,
            [phone, '+' + phone]
        );

        if (rows[0]) {
            const sessionToken = jwt.sign({ phone, sub: 'prelaunch' }, JWT_SECRET, { expiresIn: '30d' });
            return res.json({
                verified: true, 
                phoneToken,
                sessionToken,
                registered: true,
                name: rows[0].name,
                referral_code: rows[0].referral_code,
                rank: parseInt(rows[0].rank, 10),
                referrals: parseInt(rows[0].ref_count, 10),
                total,
                survey_completed: Object.keys(rows[0].survey_responses || {}).length > 0,
            });
        }
        res.json({ verified: true, phoneToken, registered: false });
    } catch (err: any) {
        console.error('[PRELAUNCH VERIFY_OTP]', err.message);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

// ── Register via Firebase ID token (used by PhoneAuth.tsx on the landing page)
router.post('/register', async (req, res) => {
    const parsed = z.object({
        name: z.string().min(2),
        idToken: z.string(),
        surveyResponses: z.record(z.any()).optional(),
        source: z.string().optional(),
        referredBy: z.string().optional(),
    }).safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({ error: 'INVALID_INPUT', details: parsed.error.issues });
    }

    const { name, idToken, surveyResponses, source, referredBy } = parsed.data;

    // Validate survey if non-empty — prevents anyone bypassing the free meal with {x:1}
    if (surveyResponses && Object.keys(surveyResponses).length > 0) {
        const dishes  = surveyResponses.mostOrderedDishes;
        const cuisines = surveyResponses.cuisines;
        if (!Array.isArray(dishes) || dishes.length < 5)
            return res.status(400).json({ error: 'INVALID_SURVEY', message: 'Select at least 5 dishes.' });
        if (!Array.isArray(cuisines) || cuisines.length < 3)
            return res.status(400).json({ error: 'INVALID_SURVEY', message: 'Select exactly 3 cuisines.' });
        const required = ['personType', 'institution', 'orderFrequency', 'spendPerOrder', 'biggestProblems', 'orderTime', 'waitTime', 'priorities', 'likelyToTry'];
        for (const field of required) {
            const v = surveyResponses[field];
            if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0))
                return res.status(400).json({ error: 'INVALID_SURVEY', message: `Missing required field: ${field}` });
        }
    }

    try {
        // Verify Token — try Firebase first, then internal JWT, then MSG91
        let phone: string;
        try {
            // 1. Firebase ID token (used by prelaunch web with Firebase Phone Auth)
            try {
                const decoded = await firebaseAdminAuth.verifyIdToken(idToken);
                const rawPhone = decoded.phone_number;
                if (rawPhone) {
                    phone = rawPhone.replace(/\D/g, '');
                    if (phone.length === 10) phone = '91' + phone;
                }
            } catch { /* not a Firebase token */ }

            // 2. Internal JWT
            if (!phone!) {
                try {
                    const decoded = jwt.verify(idToken, JWT_SECRET) as any;
                    if (decoded && decoded.userId) {
                        const { rows } = await query('SELECT phone FROM users WHERE id = $1', [decoded.userId]);
                        if (rows[0]?.phone) phone = rows[0].phone;
                    }
                } catch { /* not an internal JWT */ }
            }

            // 3. Prelaunch phone JWT (issued by /prelaunch/verify-otp or /register sessionToken)
            if (!phone!) {
                try {
                    const decoded = jwt.verify(idToken, JWT_SECRET) as any;
                    if (decoded?.phone && decoded?.sub === 'prelaunch') {
                        phone = decoded.phone;
                    }
                } catch { /* not a prelaunch phone JWT */ }
            }

            // 4. MSG91 Widget Token — check Redis cache first (token is single-use;
            //    /me may have already consumed it and cached the phone)
            if (!phone!) {
                const cacheKey = `msg91_phone:${crypto.createHash('sha256').update(idToken).digest('hex')}`;
                const cached = await redis.get(cacheKey).catch(() => null);
                if (cached) {
                    phone = cached;
                } else {
                    const verifyRes = await fetch('https://api.msg91.com/api/v5/widget/verifyAccessToken', {
                        method: 'POST',
                        headers: { 'authkey': process.env.MSG91_AUTH_KEY || '', 'content-type': 'application/json' },
                        body: JSON.stringify({ 'access-token': idToken })
                    });
                    const verifyData = await verifyRes.json();
                    if (verifyData.type !== 'success')
                        return res.status(401).json({ error: 'INVALID_TOKEN', message: verifyData.message });
                    const rawPhone = verifyData.message || verifyData.mobile || verifyData.messageData?.mobile;
                    if (!rawPhone) return res.status(400).json({ error: 'NO_PHONE' });
                    phone = String(rawPhone).replace(/\D/g, '');
                    if (phone.length === 10) phone = '91' + phone;
                    await redis.setEx(cacheKey, 600, phone).catch(() => {});
                }
            }

            if (!phone!) return res.status(401).json({ error: 'INVALID_TOKEN' });
        } catch (err: any) {
            return res.status(401).json({ error: 'INVALID_TOKEN', message: err.message });
        }

        if (!/^91\d{10}$/.test(phone)) return res.status(400).json({ error: 'INVALID_PHONE' });

        // Database Transaction for User, Referral, Wallet, and Loyalty creation
        const client = await pool.connect();
        let user;
        try {
            await client.query('BEGIN');

            // Upsert user
            const { rows: uRows } = await client.query(
                `INSERT INTO users (phone, name, role, is_verified)
                 VALUES ($1, $2, 'customer', true)
                 ON CONFLICT (phone) DO UPDATE SET is_active = true, is_verified = true
                 RETURNING id, name, phone, role, referral_code`,
                [phone, name]
            );
            user = uRows[0];

            // Ensure referral code
            if (!user.referral_code) {
                const code = genReferralCode();
                await client.query(`UPDATE users SET referral_code = $1 WHERE id = $2`, [code, user.id]);
                user.referral_code = code;
            }

            // Wallet + loyalty for brand-new users
            const { rowCount: walletCreated } = await client.query(
                `INSERT INTO customer_wallet (customer_id, balance_paise) VALUES ($1, 0) ON CONFLICT DO NOTHING`,
                [user.id]
            );
            
            if ((walletCreated ?? 0) > 0) {
                await client.query(
                    `INSERT INTO loyalty_transactions (customer_id, points, type, expires_at)
                     VALUES ($1, 1000, 'earn', NOW() + INTERVAL '1 year')`,
                    [user.id]
                );

                if (referredBy) {
                    const { rows: refRows } = await client.query(`SELECT id FROM users WHERE referral_code = $1`, [referredBy]);
                    if (refRows[0]) {
                        await client.query(`INSERT INTO referrals (referrer_id, referred_id, status) VALUES ($1,$2,'pending') ON CONFLICT DO NOTHING`, [refRows[0].id, user.id]);
                    }
                }
            }
            
            await client.query('COMMIT');
        } catch (dbErr) {
            await client.query('ROLLBACK');
            throw dbErr; // Let the outer catch handle the response
        } finally {
            client.release();
        }

        // Upsert pre-launch registration (schema-safe: works with or without migration 121)
        const referralCode = user.referral_code || genReferralCode();
        // Search by both normalised form (91XXXXXXXXXX) and legacy +91 form so
        // old test records stored with a leading '+' are still matched.
        const { rows: existingReg } = await query(
            `SELECT id, referral_code, created_at FROM pre_launch_registrations
             WHERE phone = $1 OR phone = $2`,
            [phone, '+' + phone]
        );

        let regRows: any[];
        if (existingReg[0]) {
            // Also normalise the stored phone to the canonical format while updating
            await query(
                `UPDATE pre_launch_registrations SET name=$1, survey_responses=$2, phone=$3 WHERE id=$4`,
                [name, surveyResponses ?? {}, phone, existingReg[0].id]
            );
            regRows = [existingReg[0]];
        } else {
            const { rows: ins } = await query(
                `INSERT INTO pre_launch_registrations (name, phone, survey_responses, source)
                 VALUES ($1,$2,$3,$4) RETURNING id, created_at`,
                [name, phone, surveyResponses ?? {}, source ?? 'waitlist_v2']
            );
            regRows = ins;
        }

        // Set extended columns added by later migrations (non-fatal if columns don't exist yet)
        try {
            await query(
                `UPDATE pre_launch_registrations SET referral_code=$1, referred_by=COALESCE(referred_by, $2) WHERE id=$3`,
                [referralCode, referredBy ?? null, regRows[0].id]
            );
        } catch { /* migration 120 not yet applied */ }
        try {
            await query(`UPDATE pre_launch_registrations SET user_id=$1 WHERE id=$2`, [user.id, regRows[0].id]);
        } catch { /* migration 121 not yet applied */ }

        // Expose referral_code in response (may come from existing row or was just set)
        regRows[0].referral_code = regRows[0].referral_code ?? referralCode;

        // Issue short-lived JWT so the user can also use the main app (non-fatal if refresh_tokens insert fails)
        let accessToken = '';
        let refreshToken = '';
        try {
            const jti = crypto.randomUUID();
            accessToken = jwt.sign({ userId: user.id, role: user.role, jti }, JWT_SECRET, { expiresIn: '2h' });
            refreshToken = jwt.sign({ userId: user.id, jti }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
            const tokenHash = await bcrypt.hash(refreshToken, 10);
            await query(
                `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1,$2,NOW()+INTERVAL '7 days')`,
                [user.id, tokenHash]
            );
        } catch (tokenErr: any) {
            console.error('[PRELAUNCH REGISTER] refresh_token insert failed (non-fatal):', tokenErr.message);
        }

        // Fetch rank after registration
        const { rows: rankRows } = await query(
            `WITH ReferralCounts AS (
                SELECT referred_by, COUNT(*) as ref_count
                FROM pre_launch_registrations
                WHERE referred_by IS NOT NULL AND survey_responses IS NOT NULL AND survey_responses != '{}'::jsonb
                GROUP BY referred_by
            ),
            RankedRegistrations AS (
                SELECT 
                    r.id,
                    COALESCE(rc.ref_count, 0) as ref_count,
                    RANK() OVER (ORDER BY COALESCE(rc.ref_count, 0) DESC, r.created_at ASC) as rank
                FROM pre_launch_registrations r
                LEFT JOIN ReferralCounts rc ON r.referral_code = rc.referred_by
            )
            SELECT rank, ref_count FROM RankedRegistrations WHERE id = $1`,
            [regRows[0].id]
        );
        const { rows: totalRows } = await query(`SELECT COUNT(*) as count FROM pre_launch_registrations`);
        
        const surveyCompleted = Object.keys(surveyResponses ?? {}).length > 0;
        const sessionToken = jwt.sign({ phone, sub: 'prelaunch' }, JWT_SECRET, { expiresIn: '30d' });
        res.status(201).json({
            success: true,
            sessionToken,
            data: {
                ...regRows[0],
                rank: parseInt(rankRows[0]?.rank || '0', 10),
                referrals: parseInt(rankRows[0]?.ref_count || '0', 10),
                total: parseInt(totalRows[0].count, 10),
                survey_completed: surveyCompleted,
            },
            user: { id: user.id, name: user.name, phone: user.phone, role: user.role },
            accessToken,
            refreshToken,
        });
    } catch (err: any) {
        console.error('[PRELAUNCH REGISTER]', err.message, err.stack);
        res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
});

// Check if an authenticated user already has a pre-launch registration.
router.post('/me', async (req, res) => {
    const idToken = req.body.idToken || req.body.msg91Token;
    if (!idToken) return res.json({ registered: false });
    try {
        let phone: string | null = null;

        // 1. Firebase ID token
        try {
            const decoded = await firebaseAdminAuth.verifyIdToken(idToken);
            const rawPhone = decoded.phone_number;
            if (rawPhone) {
                phone = rawPhone.replace(/\D/g, '');
                if (phone.length === 10) phone = '91' + phone;
            }
        } catch { /* not a Firebase token */ }

        // 2. Internal JWT
        if (!phone) {
            try {
                const decoded = jwt.verify(idToken, JWT_SECRET) as any;
                if (decoded && decoded.userId) {
                    const { rows } = await query('SELECT phone FROM users WHERE id = $1', [decoded.userId]);
                    if (rows[0]?.phone) phone = rows[0].phone;
                }
            } catch { /* not an internal JWT */ }
        }

        // 3. Prelaunch phone JWT (issued by /prelaunch/verify-otp or sessionToken)
        if (!phone) {
            try {
                const decoded = jwt.verify(idToken, JWT_SECRET) as any;
                if (decoded?.phone && decoded?.sub === 'prelaunch') {
                    phone = decoded.phone;
                }
            } catch { /* not a prelaunch phone JWT */ }
        }

        // 4. MSG91 Widget Token — check Redis cache first (token is single-use;
        //    /me may have already consumed it, so cache the phone for 10 min)
        if (!phone) {
            const cacheKey = `msg91_phone:${crypto.createHash('sha256').update(idToken).digest('hex')}`;
            const cached = await redis.get(cacheKey).catch(() => null);
            if (cached) {
                phone = cached;
            } else {
                const verifyRes = await fetch('https://api.msg91.com/api/v5/widget/verifyAccessToken', {
                    method: 'POST',
                    headers: { 'authkey': process.env.MSG91_AUTH_KEY || '', 'content-type': 'application/json' },
                    body: JSON.stringify({ 'access-token': idToken })
                });
                const verifyData = await verifyRes.json();
                if (verifyData.type !== 'success') return res.json({ registered: false });
                const rawPhone = verifyData.message || verifyData.mobile || verifyData.messageData?.mobile;
                if (!rawPhone) return res.json({ registered: false });
                phone = String(rawPhone).replace(/\D/g, '');
                if (phone.length === 10) phone = '91' + phone;
                await redis.setEx(cacheKey, 600, phone).catch(() => {});
            }
        }

        const { rows: totalRows } = await query(`SELECT COUNT(*) as count FROM pre_launch_registrations`);
        const total = parseInt(totalRows[0].count, 10);

        const { rows } = await query(
            `WITH ReferralCounts AS (
                SELECT referred_by, COUNT(*) as ref_count
                FROM pre_launch_registrations
                WHERE referred_by IS NOT NULL AND survey_responses IS NOT NULL AND survey_responses != '{}'::jsonb
                GROUP BY referred_by
            ),
            RankedRegistrations AS (
                SELECT
                    r.id, r.phone, r.referral_code, r.name, r.survey_responses,
                    COALESCE(rc.ref_count, 0) as ref_count,
                    RANK() OVER (ORDER BY COALESCE(rc.ref_count, 0) DESC, r.created_at ASC) as rank
                FROM pre_launch_registrations r
                LEFT JOIN ReferralCounts rc ON r.referral_code = rc.referred_by
            )
            SELECT * FROM RankedRegistrations WHERE phone = $1 OR phone = $2`,
            [phone, '+' + phone]
        );

        // Always issue a short-lived phoneToken so /register can use it
        // instead of the already-consumed MSG91 single-use token
        const phoneToken = jwt.sign({ phone, sub: 'prelaunch' }, JWT_SECRET, { expiresIn: '10m' });

        if (rows[0]) {
            const surveyCompleted = Object.keys(rows[0].survey_responses || {}).length > 0;
            const sessionToken = jwt.sign({ phone, sub: 'prelaunch' }, JWT_SECRET, { expiresIn: '30d' });
            return res.json({
                registered: true,
                phoneToken,
                sessionToken,
                referral_code: rows[0].referral_code,
                name: rows[0].name,
                rank: parseInt(rows[0].rank, 10),
                referrals: parseInt(rows[0].ref_count, 10),
                total,
                survey_completed: surveyCompleted,
            });
        }
        res.json({ registered: false, phoneToken });
    } catch (err: any) {
        res.json({ registered: false, error: err.message });
    }
});

// ── Admin ───────────────────────────────────────────────────────────────────

router.get('/registrations', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    const page   = parseInt(String(req.query.page  || '1'));
    const limit  = parseInt(String(req.query.limit || '50'));
    const offset = (page - 1) * limit;
    const search = req.query.search ? `%${req.query.search}%` : null;

    try {
        const where  = search ? `WHERE r.phone ILIKE $3::text OR r.name ILIKE $3::text` : '';
        const params: any[] = [limit, offset, ...(search ? [search] : [])];

        const baseSelect = `WITH ReferralCounts AS (
                SELECT referred_by, COUNT(*) as ref_count
                FROM pre_launch_registrations
                WHERE referred_by IS NOT NULL
                GROUP BY referred_by
            )
            SELECT r.id, r.phone, r.name, r.source, r.survey_responses,
                   r.referral_code, r.referred_by, r.created_at,
                   COALESCE(rc.ref_count, 0) as referral_count`;
        const fromJoin = `FROM pre_launch_registrations r LEFT JOIN ReferralCounts rc ON r.referral_code = rc.referred_by`;
        const orderLimit = `${where} ORDER BY r.created_at DESC LIMIT $1::int OFFSET $2::int`;

        let rows: any[];
        try {
            const result = await query(`
                ${baseSelect}, r.reward_credited, r.reward_credited_at, r.reward_expires_at, r.reward_redeemed
                ${fromJoin} ${orderLimit}
            `, params);
            rows = result.rows;
        } catch {
            const result = await query(`${baseSelect} ${fromJoin} ${orderLimit}`, params);
            rows = result.rows.map((r: any) => ({ ...r, reward_credited: false, reward_credited_at: null, reward_expires_at: null, reward_redeemed: false }));
        }

        const countWhere = search ? `WHERE r.phone ILIKE $1::text OR r.name ILIKE $1::text` : '';
        const { rows: cntRows } = await query(
            `SELECT COUNT(*) FROM pre_launch_registrations r ${countWhere}`,
            search ? [search] : [],
        );
        const data = rows.map((r: any) => ({ ...r, referral_count: parseInt(r.referral_count || '0', 10) }));
        res.json({ success: true, data, total: parseInt(cntRows[0].count), page, limit });
    } catch (err: any) {
        console.error('[PRELAUNCH LIST]', err.message);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

router.delete('/registrations/:id', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await query('SELECT name, phone FROM pre_launch_registrations WHERE id = $1', [id]);
        if (!rows[0]) return res.status(404).json({ error: 'NOT_FOUND' });

        await query('DELETE FROM pre_launch_registrations WHERE id = $1', [id]);
        console.log(`[PRELAUNCH DELETE] Removed registration ${id} (${rows[0].name} / ${rows[0].phone})`);
        res.json({ success: true, message: `Registration for ${rows[0].name} deleted` });
    } catch (err: any) {
        console.error('[PRELAUNCH DELETE]', err.message);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

router.get('/admin/stats', authenticate, requireRole('super_admin', 'admin'), async (_req, res) => {
    try {
        // Totals: try with reward columns (migration 121); fall back to count-only
        let totals = { total: 0, credited: 0, redeemed: 0 };
        try {
            const { rows } = await query(`SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN reward_credited THEN 1 ELSE 0 END) AS credited,
                SUM(CASE WHEN reward_redeemed THEN 1 ELSE 0 END) AS redeemed
            FROM pre_launch_registrations`);
            totals = { total: parseInt(rows[0].total), credited: parseInt(rows[0].credited || '0'), redeemed: parseInt(rows[0].redeemed || '0') };
        } catch {
            const { rows } = await query(`SELECT COUNT(*) AS total FROM pre_launch_registrations`);
            totals.total = parseInt(rows[0].total);
        }

        let spendRows: any[] = [], likelyRows: any[] = [], institutionRows: any[] = [], dailyRows: any[] = [], freqRows: any[] = [];
        try {
            const [spendRes, likelyRes, instRes, dailyRes, freqRes] = await Promise.all([
                query(`SELECT survey_responses->>'spendPerOrder' AS label, COUNT(*) AS count FROM pre_launch_registrations WHERE survey_responses->>'spendPerOrder' IS NOT NULL GROUP BY label ORDER BY count DESC`),
                query(`SELECT survey_responses->>'likelyToTry' AS label, COUNT(*) AS count FROM pre_launch_registrations WHERE survey_responses->>'likelyToTry' IS NOT NULL GROUP BY label ORDER BY CASE survey_responses->>'likelyToTry' WHEN 'Definitely' THEN 1 WHEN 'Probably' THEN 2 WHEN 'Maybe' THEN 3 WHEN 'Unlikely' THEN 4 WHEN 'No' THEN 5 ELSE 6 END`),
                query(`SELECT survey_responses->>'personType' AS name, COUNT(*) AS count FROM pre_launch_registrations WHERE survey_responses->>'personType' IS NOT NULL GROUP BY name ORDER BY count DESC LIMIT 10`),
                query(`SELECT TO_CHAR(DATE(created_at), 'Mon DD') AS day, COUNT(*) AS count FROM pre_launch_registrations WHERE created_at > NOW() - INTERVAL '30 days' GROUP BY DATE(created_at), TO_CHAR(DATE(created_at), 'Mon DD') ORDER BY DATE(created_at)`),
                query(`SELECT survey_responses->>'orderFrequency' AS label, COUNT(*) AS count FROM pre_launch_registrations WHERE survey_responses->>'orderFrequency' IS NOT NULL GROUP BY label ORDER BY count DESC`),
            ]);
            spendRows       = spendRes.rows;
            likelyRows      = likelyRes.rows;
            institutionRows = instRes.rows;
            dailyRows       = dailyRes.rows;
            freqRows        = freqRes.rows;
        } catch (chartErr: any) {
            console.error('[PRELAUNCH STATS CHARTS]', chartErr.message);
        }

        res.json({
            total:           totals.total,
            credited:        totals.credited,
            redeemed:        totals.redeemed,
            spendPerOrder:   spendRows,
            likelyToTry:     likelyRows,
            topInstitutions: institutionRows,
            daily:           dailyRows,
            orderFrequency:  freqRows,
        });
    } catch (err: any) {
        console.error('[PRELAUNCH STATS]', err.message);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

router.get('/export', authenticate, requireRole('super_admin', 'admin'), async (_req, res) => {
    try {
        const { rows } = await query(`
            WITH ReferralCounts AS (
                SELECT referred_by, COUNT(*) as ref_count
                FROM pre_launch_registrations
                WHERE referred_by IS NOT NULL
                GROUP BY referred_by
            )
            SELECT
                r.created_at                                                         AS registered_at,
                r.name,
                r.phone,
                r.source,
                r.referral_code,
                r.referred_by,
                COALESCE(rc.ref_count, 0)                                            AS referral_count,
                -- new survey fields (with old-key fallback)
                COALESCE(r.survey_responses->>'personType',      r.survey_responses->>'college')    AS person_type,
                COALESCE(r.survey_responses->>'institution',     r.survey_responses->>'college')    AS institution,
                r.survey_responses->>'stayType'                                      AS stay_type,
                COALESCE(r.survey_responses->>'orderFrequency',  r.survey_responses->>'frequency')  AS order_frequency,
                r.survey_responses->>'deliveryApps'                                  AS delivery_apps,
                r.survey_responses->>'biggestProblems'                               AS biggest_problems,
                COALESCE(r.survey_responses->>'spendPerOrder',   r.survey_responses->>'budget')     AS spend_per_order,
                r.survey_responses->>'cuisines'                                      AS cuisines,
                r.survey_responses->>'mostOrderedDishes'                             AS most_ordered_dishes,
                COALESCE(r.survey_responses->>'mealPreference',  r.survey_responses->>'mealTime')   AS meal_preference,
                r.survey_responses->>'orderTime'                                     AS order_time,
                r.survey_responses->>'waitTime'                                      AS wait_time,
                r.survey_responses->>'priorities'                                    AS priorities,
                r.survey_responses->>'wantedFeatures'                                AS wanted_features,
                r.survey_responses->>'convincingOffer'                               AS convincing_offer,
                r.survey_responses->>'chooseOver'                                    AS choose_over,
                r.survey_responses->>'wishFeature'                                   AS wish_feature,
                r.survey_responses->>'earlyAccess'                                   AS early_access,
                COALESCE(r.reward_credited::text, 'false')                           AS reward_credited,
                COALESCE(r.reward_credited_at::text, '')                             AS reward_credited_at,
                COALESCE(r.reward_redeemed::text,  'false')                          AS reward_redeemed
            FROM pre_launch_registrations r
            LEFT JOIN ReferralCounts rc ON r.referral_code = rc.referred_by
            ORDER BY r.created_at DESC
        `);

        if (!rows.length) {
            res.setHeader('Content-Type', 'text/csv');
            return res.send('registered_at,name,phone\nNo registrations yet.\n');
        }

        const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const header  = Object.keys(rows[0]).join(',');
        const csvRows = rows.map((r: any) => Object.values(r).map(escape).join(','));
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="prelaunch-${Date.now()}.csv"`);
        res.send([header, ...csvRows].join('\n'));
    } catch (err: any) {
        console.error('[PRELAUNCH EXPORT]', err.message);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

// Manual credit for a specific registration id
router.post('/admin/credit/:id', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Lock the row so concurrent admin clicks can't double-credit
        const { rows: regRows } = await client.query(
            `SELECT user_id, phone, reward_credited FROM pre_launch_registrations WHERE id = $1 FOR UPDATE`,
            [id]
        );
        if (!regRows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'NOT_FOUND' }); }
        if (regRows[0].reward_credited) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'ALREADY_CREDITED' }); }

        // Resolve user_id — may be null if user hasn't installed app yet
        let userId = regRows[0].user_id;
        if (!userId) {
            const { rows: uRows } = await client.query(
                `SELECT id, prelaunch_reward_credited FROM users WHERE phone = $1 FOR UPDATE`,
                [regRows[0].phone]
            );
            if (!uRows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User has not signed up to the app yet' }); }
            if (uRows[0].prelaunch_reward_credited) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'ALREADY_CREDITED' }); }
            userId = uRows[0].id;
        } else {
            const { rows: uRows } = await client.query(`SELECT prelaunch_reward_credited FROM users WHERE id = $1 FOR UPDATE`, [userId]);
            if (uRows[0]?.prelaunch_reward_credited) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'ALREADY_CREDITED' }); }
        }

        const { rows: cfgRows } = await client.query(
            `SELECT key, value FROM app_config WHERE key IN ('prelaunch_reward_paise','prelaunch_reward_validity_days')`
        );
        const cfg: Record<string, any> = {};
        cfgRows.forEach((r: any) => { cfg[r.key] = r.value; });
        const paise     = typeof cfg.prelaunch_reward_paise === 'number' ? cfg.prelaunch_reward_paise : parseInt(cfg.prelaunch_reward_paise || '10000', 10);
        const validDays = typeof cfg.prelaunch_reward_validity_days === 'number' ? cfg.prelaunch_reward_validity_days : parseInt(cfg.prelaunch_reward_validity_days || '7', 10);

        await client.query(`INSERT INTO customer_wallet (customer_id, balance_paise) VALUES ($1,0) ON CONFLICT DO NOTHING`, [userId]);
        await client.query(`UPDATE customer_wallet SET balance_paise = balance_paise + $1 WHERE customer_id = $2`, [paise, userId]);
        const { rows: wRows } = await client.query(`SELECT balance_paise FROM customer_wallet WHERE customer_id = $1`, [userId]);

        await client.query(`
            INSERT INTO wallet_transactions (customer_id, amount_paise, type, description, balance_after_paise)
            VALUES ($1,$2,'credit','Pre-Launch Exclusive Reward',$3)
        `, [userId, paise, wRows[0]?.balance_paise ?? paise]);

        await client.query(`UPDATE users SET prelaunch_reward_credited = true WHERE id = $1`, [userId]);

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + validDays);
        await client.query(`
            UPDATE pre_launch_registrations
            SET reward_credited = true, reward_credited_at = NOW(), reward_expires_at = $1, user_id = $2
            WHERE id = $3
        `, [expiresAt.toISOString(), userId, id]);

        await client.query('COMMIT');
        res.json({ success: true, credited: paise });
    } catch (err: any) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('[PRELAUNCH MANUAL CREDIT]', err.message);
        res.status(500).json({ error: 'SERVER_ERROR' });
    } finally {
        client.release();
    }
});

// Admin config get/set
router.post('/config', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    const ALLOWED = new Set(['IS_PRELAUNCH_MODE', 'prelaunch_reward_active', 'prelaunch_launch_date', 'prelaunch_reward_paise', 'prelaunch_reward_validity_days', 'prelaunch_target', 'prelaunch_bg_video_url']);

    // Support legacy single-field toggle
    if (typeof req.body.isPrelaunch === 'boolean' && !req.body.key) {
        try {
            await query(
                `INSERT INTO app_config (key, value, description) VALUES ('IS_PRELAUNCH_MODE',$1::jsonb,'Gate toggle')
                 ON CONFLICT (key) DO UPDATE SET value=$1::jsonb, updated_at=NOW()`,
                [JSON.stringify(req.body.isPrelaunch)]
            );
            return res.json({ success: true, isPrelaunch: req.body.isPrelaunch });
        } catch (err: any) {
            return res.status(500).json({ error: 'SERVER_ERROR' });
        }
    }

    try {
        for (const [key, value] of Object.entries(req.body)) {
            if (!ALLOWED.has(key)) continue;
            await query(
                `INSERT INTO app_config (key, value, updated_at)
                 VALUES ($1,$2::jsonb,NOW())
                 ON CONFLICT (key) DO UPDATE SET value=$2::jsonb, updated_at=NOW()`,
                [key, JSON.stringify(value)]
            );
        }
        res.json({ success: true });
    } catch (err: any) {
        console.error('[PRELAUNCH CONFIG]', err.message);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

export default router;
