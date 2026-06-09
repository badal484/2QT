import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import db from '../db';
import { z } from 'zod';

const router = Router();

router.post('/subscribe', requireAuth('customer'), async (req, res) => {
    try {
        const schema = z.object({
            subscription: z.object({
                endpoint: z.string(),
                keys: z.object({
                    p256dh: z.string(),
                    auth: z.string()
                })
            })
        });

        const { subscription } = schema.parse(req.body);

        await db.query(
            `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (endpoint) DO UPDATE 
             SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, updated_at = NOW()`,
            [req.user!.userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]
        );

        res.json({ success: true });
    } catch (err: any) {
        console.error('Push subscribe error:', err);
        res.status(400).json({ error: 'Invalid subscription data' });
    }
});

export default router;
