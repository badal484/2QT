import express from 'express';
import { query } from '../db';
import { z } from 'zod';
import { requireRole } from '../middleware/auth';

import { firebaseAdminAuth } from '../config/firebaseAdmin';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const router = express.Router();

const registerSchema = z.object({
  name: z.string().min(2),
  idToken: z.string(),
  surveyResponses: z.record(z.any()).optional(),
  source: z.string().optional(),
  referredBy: z.string().optional()
});

const phoneSchema = z.string().regex(/^91\d{10}$/);

function generateReferralCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// POST /api/v1/prelaunch/register
// Public route for users to sign up for the waitlist
router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
  }

  const { name, idToken, surveyResponses, source, referredBy } = parsed.data;

  try {
    let decodedToken;
    try {
      decodedToken = await firebaseAdminAuth.verifyIdToken(idToken);
    } catch (err: any) {
      console.error('--- PRELAUNCH FIREBASE VERIFY ERROR:', err.message);
      return res.status(401).json({ error: 'INVALID_TOKEN', message: 'Failed to verify Firebase ID Token: ' + err.message });
    }

    const phone = decodedToken.phone_number;
    if (!phone) {
      return res.status(400).json({ error: 'NO_PHONE_IN_TOKEN', message: 'Phone number not found in Firebase token' });
    }

    let normalizedPhone = String(phone).replace(/\D/g, '');
    if (normalizedPhone.length === 10) normalizedPhone = '91' + normalizedPhone;

    if (!phoneSchema.safeParse(normalizedPhone).success) {
      return res.status(400).json({ error: 'INVALID_PHONE', message: 'Phone must be 12 digits starting with 91' });
    }

    // Upsert into users table
    const { rows: userRows } = await query(
        `INSERT INTO users (phone, name, role, is_verified) 
         VALUES ($1, $2, 'customer', true) 
         ON CONFLICT (phone) DO UPDATE SET is_active = true, is_verified = true 
         RETURNING id, name, phone, role, referral_code`,
        [normalizedPhone, name || '2QT User']
    );

    const user = userRows[0];
    const referralCode = user.referral_code || generateReferralCode();

    if (!user.referral_code) {
        await query('UPDATE users SET referral_code = $1 WHERE id = $2', [referralCode, user.id]);
    }

    // Initialize wallet and award Pre-launch Bonus if new
    const { rowCount: walletCreated } = await query('INSERT INTO customer_wallet (customer_id, balance_paise) VALUES ($1, 0) ON CONFLICT (customer_id) DO NOTHING', [user.id]);
    
    if ((walletCreated ?? 0) > 0) {
        await query(`
            INSERT INTO loyalty_transactions (customer_id, points, type, expires_at)
            VALUES ($1, 1000, 'earn', NOW() + INTERVAL '1 year')
        `, [user.id]);

        if (referredBy) {
            const { rows: referrers } = await query('SELECT id FROM users WHERE referral_code = $1', [referredBy]);
            if (referrers[0]) {
                const referrerId = referrers[0].id;
                await query('UPDATE customer_wallet SET balance_paise = balance_paise + 5000 WHERE customer_id = $1', [user.id]);
                await query(`
                    INSERT INTO wallet_transactions (customer_id, amount_paise, type, description, balance_after_paise)
                    VALUES ($1, 5000, 'credit', 'Referral Welcome Bonus', 5000)
                `, [user.id]);

                await query(`
                    INSERT INTO referrals (referrer_id, referred_id, status)
                    VALUES ($1, $2, 'pending')
                    ON CONFLICT (referred_id) DO NOTHING
                `, [referrerId, user.id]);
            }
        }
    }

    // Insert into pre_launch_registrations
    const result = await query(
      `INSERT INTO pre_launch_registrations (user_id, name, phone, survey_responses, source, referral_code, referred_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, created_at, referral_code`,
      [user.id, name, normalizedPhone, surveyResponses, source || 'organic', referralCode, referredBy]
    );

    const JWT_SECRET = process.env.JWT_SECRET!;
    const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
    const jti = crypto.randomUUID();

    const accessToken = jwt.sign(
        { userId: user.id, role: user.role, jti },
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

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: result.rows[0],
      user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          role: user.role,
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Pre-launch registration error:', error);
    res.status(500).json({ error: 'Failed to register' });
  }
});

// GET /api/v1/prelaunch/registrations
// Admin route to view waitlist
router.get('/registrations', requireRole('super_admin', 'admin'), async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM pre_launch_registrations ORDER BY created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Failed to fetch registrations:', error);
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
});

// GET /api/v1/prelaunch/stats
// Public route to get waitlist count
router.get('/stats', async (req, res) => {
  try {
    const result = await query(`SELECT COUNT(*) as count FROM pre_launch_registrations`);
    res.json({ success: true, count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/v1/prelaunch/config
// Public route to check if pre-launch mode is active
router.get('/config', async (req, res) => {
  try {
    const result = await query(
      `SELECT value FROM app_config WHERE key = 'IS_PRELAUNCH_MODE'`
    );
    const isPrelaunch = result.rows[0]?.value === 'true' || result.rows[0]?.value === true;
    res.json({ success: true, isPrelaunch });
  } catch (error) {
    console.error('Failed to fetch config:', error);
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

// POST /api/v1/prelaunch/config
// Admin route to toggle pre-launch mode
router.post('/config', requireRole('super_admin', 'admin'), async (req, res) => {
  const { isPrelaunch } = req.body;
  if (typeof isPrelaunch !== 'boolean') {
    return res.status(400).json({ error: 'isPrelaunch must be a boolean' });
  }

  try {
    await query(
      `INSERT INTO app_config (key, value)
       VALUES ('IS_PRELAUNCH_MODE', $1::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = $1::jsonb, updated_at = CURRENT_TIMESTAMP`,
      [JSON.stringify(isPrelaunch)]
    );
    res.json({ success: true, isPrelaunch });
  } catch (error) {
    console.error('Failed to update config:', error);
    res.status(500).json({ error: 'Failed to update config' });
  }
});

export default router;
