import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import pool, { query } from '../db';
import { authenticate, requireRole } from '../middleware/auth';
import { firebaseAdminAuth } from '../config/firebaseAdmin';

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

// Register via Firebase ID token (used by PhoneAuth.tsx on the landing page)
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

    try {
        // Verify Firebase ID token to extract phone number
        let decodedToken: any;
        try {
            decodedToken = await firebaseAdminAuth.verifyIdToken(idToken);
        } catch (err: any) {
            return res.status(401).json({ error: 'INVALID_TOKEN', message: err.message });
        }

        const rawPhone = decodedToken.phone_number;
        if (!rawPhone) return res.status(400).json({ error: 'NO_PHONE' });

        let phone = String(rawPhone).replace(/\D/g, '');
        if (phone.length === 10) phone = '91' + phone;
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
                `UPDATE pre_launch_registrations SET referral_code=$1, referred_by=$2 WHERE id=$3`,
                [referralCode, referredBy ?? null, regRows[0].id]
            );
        } catch { /* migration 120 not yet applied */ }
        try {
            await query(`UPDATE pre_launch_registrations SET user_id=$1 WHERE id=$2`, [user.id, regRows[0].id]);
        } catch { /* migration 121 not yet applied */ }

        // Expose referral_code in response (may come from existing row or was just set)
        regRows[0].referral_code = regRows[0].referral_code ?? referralCode;

        // Issue short-lived JWT so the user can also use the main app
        const jti = crypto.randomUUID();
        const accessToken = jwt.sign({ userId: user.id, role: user.role, jti }, JWT_SECRET, { expiresIn: '2h' });
        const refreshToken = jwt.sign({ userId: user.id, jti }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
        const tokenHash = await bcrypt.hash(refreshToken, 10);
        await query(
            `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1,$2,NOW()+INTERVAL '7 days')`,
            [user.id, tokenHash]
        );

        res.status(201).json({
            success: true,
            data: regRows[0],
            user: { id: user.id, name: user.name, phone: user.phone, role: user.role },
            accessToken,
            refreshToken,
        });
    } catch (err: any) {
        console.error('[PRELAUNCH REGISTER]', err.message);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

// Check if a Firebase-authenticated user already has a pre-launch registration.
// Used by the frontend to skip the survey for returning visitors.
router.post('/me', async (req, res) => {
    const { idToken } = req.body;
    if (!idToken) return res.json({ registered: false });
    try {
        const decoded = await firebaseAdminAuth.verifyIdToken(idToken);
        const rawPhone = decoded.phone_number;
        if (!rawPhone) return res.json({ registered: false });
        let phone = String(rawPhone).replace(/\D/g, '');
        if (phone.length === 10) phone = '91' + phone;
        const { rows } = await query(
            `SELECT referral_code FROM pre_launch_registrations WHERE phone = $1 OR phone = $2`,
            [phone, '+' + phone]
        );
        if (rows[0]) return res.json({ registered: true, referral_code: rows[0].referral_code });
        res.json({ registered: false });
    } catch {
        res.json({ registered: false });
    }
});

// ── Admin ───────────────────────────────────────────────────────────────────

router.get('/registrations', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    const page   = parseInt(String(req.query.page  || '1'));
    const limit  = parseInt(String(req.query.limit || '50'));
    const offset = (page - 1) * limit;
    const search = req.query.search ? `%${req.query.search}%` : null;

    try {
        const where  = search ? `WHERE r.phone ILIKE $3 OR r.name ILIKE $3` : '';
        const params: any[] = [limit, offset, ...(search ? [search] : [])];

        const baseSelect = `SELECT r.id, r.phone, r.name, r.source, r.survey_responses,
                   r.referral_code, r.referred_by, r.created_at`;
        const orderLimit = `ORDER BY r.created_at DESC LIMIT $1 OFFSET $2`;

        let rows: any[];
        try {
            const result = await query(`
                ${baseSelect}, r.reward_credited, r.reward_credited_at, r.reward_expires_at, r.reward_redeemed
                FROM pre_launch_registrations r ${where} ${orderLimit}
            `, params);
            rows = result.rows;
        } catch {
            const result = await query(`${baseSelect} FROM pre_launch_registrations r ${where} ${orderLimit}`, params);
            rows = result.rows.map((r: any) => ({ ...r, reward_credited: false, reward_credited_at: null, reward_expires_at: null, reward_redeemed: false }));
        }

        const { rows: cntRows } = await query(
            `SELECT COUNT(*) FROM pre_launch_registrations r ${where}`,
            search ? [search] : [],
        );
        res.json({ success: true, data: rows, total: parseInt(cntRows[0].count), page, limit });
    } catch (err: any) {
        console.error('[PRELAUNCH LIST]', err.message);
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

        let spendRows: any[] = [], mealRows: any[] = [], institutionRows: any[] = [], dailyRows: any[] = [], freqRows: any[] = [];
        try {
            const [spendRes, mealRes, instRes, dailyRes, freqRes] = await Promise.all([
                // new key (spendPerOrder) with fallback to old key (budget)
                query(`SELECT COALESCE(survey_responses->>'spendPerOrder', survey_responses->>'budget') AS label, COUNT(*) AS count FROM pre_launch_registrations WHERE COALESCE(survey_responses->>'spendPerOrder', survey_responses->>'budget') IS NOT NULL GROUP BY label ORDER BY count DESC`),
                // new key (mealPreference) with fallback to old key (mealTime)
                query(`SELECT COALESCE(survey_responses->>'mealPreference', survey_responses->>'mealTime') AS label, COUNT(*) AS count FROM pre_launch_registrations WHERE COALESCE(survey_responses->>'mealPreference', survey_responses->>'mealTime') IS NOT NULL GROUP BY label ORDER BY count DESC`),
                // new key (institution) with fallback to old key (college)
                query(`SELECT COALESCE(survey_responses->>'institution', survey_responses->>'college') AS name, COUNT(*) AS count FROM pre_launch_registrations WHERE COALESCE(survey_responses->>'institution', survey_responses->>'college') IS NOT NULL GROUP BY name ORDER BY count DESC LIMIT 10`),
                query(`SELECT TO_CHAR(DATE(created_at), 'Mon DD') AS day, COUNT(*) AS count FROM pre_launch_registrations WHERE created_at > NOW() - INTERVAL '30 days' GROUP BY DATE(created_at), TO_CHAR(DATE(created_at), 'Mon DD') ORDER BY DATE(created_at)`),
                // new key (orderFrequency) with fallback to old key (frequency)
                query(`SELECT COALESCE(survey_responses->>'orderFrequency', survey_responses->>'frequency') AS label, COUNT(*) AS count FROM pre_launch_registrations WHERE COALESCE(survey_responses->>'orderFrequency', survey_responses->>'frequency') IS NOT NULL GROUP BY label ORDER BY count DESC`),
            ]);
            spendRows        = spendRes.rows;
            mealRows         = mealRes.rows;
            institutionRows  = instRes.rows;
            dailyRows        = dailyRes.rows;
            freqRows         = freqRes.rows;
        } catch (chartErr: any) {
            console.error('[PRELAUNCH STATS CHARTS]', chartErr.message);
        }

        res.json({
            total:            totals.total,
            credited:         totals.credited,
            redeemed:         totals.redeemed,
            spendPerOrder:    spendRows,
            mealPreference:   mealRows,
            topInstitutions:  institutionRows,
            daily:            dailyRows,
            orderFrequency:   freqRows,
        });
    } catch (err: any) {
        console.error('[PRELAUNCH STATS]', err.message);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

router.get('/export', authenticate, requireRole('super_admin', 'admin'), async (_req, res) => {
    try {
        const baseExportSelect = `
            SELECT r.phone, r.name,
                   r.survey_responses->>'college'      AS college,
                   r.survey_responses->>'year'         AS year,
                   r.survey_responses->>'preference'   AS food_preference,
                   r.survey_responses->>'cuisine'      AS favourite_cuisine,
                   r.survey_responses->>'mostOrdered'  AS most_ordered,
                   r.survey_responses->>'budget'       AS budget,
                   r.survey_responses->>'frequency'    AS order_frequency,
                   r.survey_responses->>'mealTime'     AS meal_time,
                   r.survey_responses->>'biggestPain'  AS biggest_pain,
                   r.survey_responses->>'tryNewBrand'  AS try_new_brand,
                   r.survey_responses->>'referFriends' AS refer_friends,
                   r.survey_responses->>'anythingElse' AS anything_else,
                   r.source, r.referral_code, r.referred_by, r.created_at`;

        let rows: any[];
        try {
            const result = await query(`${baseExportSelect}, r.reward_credited, r.reward_credited_at, r.reward_redeemed FROM pre_launch_registrations r ORDER BY r.created_at DESC`);
            rows = result.rows;
        } catch {
            const result = await query(`${baseExportSelect} FROM pre_launch_registrations r ORDER BY r.created_at DESC`);
            rows = result.rows;
        }

        if (!rows.length) {
            res.setHeader('Content-Type', 'text/csv');
            return res.send('No registrations yet.\n');
        }

        const header  = Object.keys(rows[0]).join(',');
        const csvRows = rows.map((r: any) =>
            Object.values(r).map((v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
        );
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
    try {
        const { rows: regRows } = await query(
            `SELECT r.user_id, r.phone, r.reward_credited FROM pre_launch_registrations r WHERE r.id = $1`,
            [id]
        );
        if (!regRows[0]) return res.status(404).json({ error: 'NOT_FOUND' });
        if (regRows[0].reward_credited) return res.status(409).json({ error: 'ALREADY_CREDITED' });

        // Resolve user_id — may be null if user hasn't installed app yet
        let userId = regRows[0].user_id;
        if (!userId) {
            const { rows: uRows } = await query(`SELECT id, prelaunch_reward_credited FROM users WHERE phone = $1`, [regRows[0].phone]);
            if (!uRows[0]) return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User has not signed up to the app yet' });
            if (uRows[0].prelaunch_reward_credited) return res.status(409).json({ error: 'ALREADY_CREDITED' });
            userId = uRows[0].id;
        } else {
            const { rows: uRows } = await query(`SELECT prelaunch_reward_credited FROM users WHERE id = $1`, [userId]);
            if (uRows[0]?.prelaunch_reward_credited) return res.status(409).json({ error: 'ALREADY_CREDITED' });
        }

        const { rows: cfgRows } = await query(
            `SELECT key, value FROM app_config WHERE key IN ('prelaunch_reward_paise','prelaunch_reward_validity_days')`
        );
        const cfg: Record<string, any> = {};
        cfgRows.forEach((r: any) => { cfg[r.key] = r.value; });
        const paise     = typeof cfg.prelaunch_reward_paise === 'number' ? cfg.prelaunch_reward_paise : parseInt(cfg.prelaunch_reward_paise || '10000', 10);
        const validDays = typeof cfg.prelaunch_reward_validity_days === 'number' ? cfg.prelaunch_reward_validity_days : parseInt(cfg.prelaunch_reward_validity_days || '7', 10);

        await query(`INSERT INTO customer_wallet (customer_id, balance_paise) VALUES ($1,0) ON CONFLICT DO NOTHING`, [userId]);
        await query(`UPDATE customer_wallet SET balance_paise = balance_paise + $1 WHERE customer_id = $2`, [paise, userId]);
        const { rows: wRows } = await query(`SELECT balance_paise FROM customer_wallet WHERE customer_id = $1`, [userId]);

        await query(`
            INSERT INTO wallet_transactions (customer_id, amount_paise, type, description, balance_after_paise)
            VALUES ($1,$2,'credit','Pre-Launch Exclusive Reward',$3)
        `, [userId, paise, wRows[0]?.balance_paise ?? paise]);

        await query(`UPDATE users SET prelaunch_reward_credited = true WHERE id = $1`, [userId]);

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + validDays);
        await query(`
            UPDATE pre_launch_registrations
            SET reward_credited = true, reward_credited_at = NOW(), reward_expires_at = $1, user_id = $2
            WHERE id = $3
        `, [expiresAt.toISOString(), userId, id]);

        res.json({ success: true, credited: paise });
    } catch (err: any) {
        console.error('[PRELAUNCH MANUAL CREDIT]', err.message);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

// Admin config get/set
router.post('/config', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    const ALLOWED = new Set(['IS_PRELAUNCH_MODE', 'prelaunch_reward_active', 'prelaunch_launch_date', 'prelaunch_reward_paise', 'prelaunch_reward_validity_days']);

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
