import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import db from '../db';
import { z } from 'zod';

const router = Router();

// POST /service-requests — logged-in user requests service in their area
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const schema = z.object({
            area_name: z.string().min(2).max(255),
            pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
            lat: z.number().optional(),
            lng: z.number().optional(),
            notes: z.string().max(500).optional(),
        });

        const { area_name, pincode, lat, lng, notes } = schema.parse(req.body);
        const userId = req.user!.userId;

        // Upsert — prevent duplicates per user per pincode
        const result = await db.query(
            `INSERT INTO service_requests (user_id, area_name, pincode, lat, lng, notes)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (user_id, pincode) DO UPDATE
             SET area_name = EXCLUDED.area_name, notes = EXCLUDED.notes, created_at = NOW()
             RETURNING id`,
            [userId, area_name, pincode, lat ?? null, lng ?? null, notes ?? null]
        );

        res.json({ success: true, id: result.rows[0].id, message: "We've noted your request! You'll be the first to know when we expand to your area." });
    } catch (err: any) {
        if (err?.name === 'ZodError') {
            return res.status(400).json({ error: 'VALIDATION_ERROR', message: err.errors[0]?.message });
        }
        console.error('Service request error:', err);
        res.status(500).json({ error: 'SERVER_ERROR', message: 'Something went wrong' });
    }
});

// GET /service-requests/count?pincode=560066 — public: how many people want service here
router.get('/count', async (req, res) => {
    const { pincode } = req.query;
    if (!pincode || !/^\d{6}$/.test(String(pincode))) {
        return res.status(400).json({ error: 'Invalid pincode' });
    }
    const { rows } = await db.query(
        'SELECT COUNT(*) as count FROM service_requests WHERE pincode = $1',
        [pincode]
    );
    res.json({ pincode, count: parseInt(rows[0].count) });
});

export default router;
