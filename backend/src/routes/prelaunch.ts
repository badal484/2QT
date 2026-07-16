import express from 'express';
import { query } from '../db';
import { z } from 'zod';
import { requireRole } from '../middleware/auth';

const router = express.Router();

const registerSchema = z.object({
  name: z.string().min(2),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  surveyResponses: z.record(z.any()).optional(),
  source: z.string().optional()
});

// POST /api/v1/prelaunch/register
// Public route for users to sign up for the waitlist
router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
  }

  const { name, phone, email, surveyResponses, source } = parsed.data;

  if (!phone && !email) {
    return res.status(400).json({ error: 'Either phone or email is required' });
  }

  try {
    const result = await query(
      `INSERT INTO pre_launch_registrations (name, phone, email, survey_responses, source)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [name, phone, email, surveyResponses, source || 'organic']
    );

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: result.rows[0]
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
