import { Router, Response } from 'express';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { query } from '../db';
import { redis } from '../redis';
import { bustTemplateCache } from '../services/notification.service';
import { z } from 'zod';
import db from '../db';

const router = Router();

// ─── Web-push VAPID subscribe (browser) ──────────────────────────────────────

router.post('/subscribe', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { subscription } = z.object({
            subscription: z.object({
                endpoint: z.string(),
                keys: z.object({ p256dh: z.string(), auth: z.string() }),
            }),
        }).parse(req.body);

        await db.query(
            `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (endpoint) DO UPDATE
             SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh,
                 auth = EXCLUDED.auth, updated_at = NOW()`,
            [req.user!.userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]
        );
        res.json({ success: true });
    } catch (err: any) {
        res.status(400).json({ error: 'Invalid subscription data' });
    }
});

// ─── FCM device token (mobile) ───────────────────────────────────────────────

router.patch('/device-token', authenticate, async (req: AuthRequest, res: Response) => {
    const { token } = req.body as { token: string };
    if (!token) return res.status(400).json({ error: 'token required' });
    await query('UPDATE users SET device_token = $1 WHERE id = $2', [token, req.user!.userId]);
    res.json({ success: true });
});

// ─── In-app notification bell ─────────────────────────────────────────────────

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
    const { rows } = await query(
        `SELECT id, type, title, body, data, is_read, channel, created_at
         FROM notifications WHERE user_id = $1
         ORDER BY created_at DESC LIMIT 50`,
        [req.user!.userId]
    );
    const unreadCount = rows.filter(n => !n.is_read).length;
    res.json({ notifications: rows, unreadCount });
});

router.patch('/:id/read', authenticate, async (req: AuthRequest, res: Response) => {
    await query(
        'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2',
        [req.params.id, req.user!.userId]
    );
    res.json({ success: true });
});

router.post('/read-all', authenticate, async (req: AuthRequest, res: Response) => {
    await query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1', [req.user!.userId]);
    res.json({ success: true });
});

// ─── Notification preferences ─────────────────────────────────────────────────

router.get('/preferences', authenticate, async (req: AuthRequest, res: Response) => {
    const { rows } = await query(
        'SELECT * FROM notification_preferences WHERE user_id = $1',
        [req.user!.userId]
    );
    res.json({
        preferences: rows[0] ?? {
            order_updates: true, promotions: true, payouts: true,
            push_enabled: true, whatsapp_enabled: true,
        },
    });
});

router.patch('/preferences', authenticate, async (req: AuthRequest, res: Response) => {
    const { order_updates, promotions, payouts, push_enabled, whatsapp_enabled } = req.body;
    await query(
        `INSERT INTO notification_preferences
           (user_id, order_updates, promotions, payouts, push_enabled, whatsapp_enabled)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id) DO UPDATE SET
           order_updates    = COALESCE($2, notification_preferences.order_updates),
           promotions       = COALESCE($3, notification_preferences.promotions),
           payouts          = COALESCE($4, notification_preferences.payouts),
           push_enabled     = COALESCE($5, notification_preferences.push_enabled),
           whatsapp_enabled = COALESCE($6, notification_preferences.whatsapp_enabled),
           updated_at       = NOW()`,
        [req.user!.userId, order_updates ?? null, promotions ?? null,
         payouts ?? null, push_enabled ?? null, whatsapp_enabled ?? null]
    );
    res.json({ success: true });
});

// ─── Admin: notification templates ───────────────────────────────────────────

router.get('/admin/templates', authenticate, requireRole('super_admin', 'admin'), async (_req, res: Response) => {
    const { rows } = await query('SELECT * FROM notification_templates ORDER BY label');
    res.json({ templates: rows });
});

router.patch('/admin/templates/:type', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res: Response) => {
    const { type } = req.params;
    const { title_template, body_template, whatsapp_template, is_active } = req.body;
    const channels: string[] | null = Array.isArray(req.body.channels) ? req.body.channels : null;
    const { rows } = await query(
        `UPDATE notification_templates SET
           title_template    = COALESCE($1, title_template),
           body_template     = COALESCE($2, body_template),
           whatsapp_template = COALESCE($3, whatsapp_template),
           channels          = COALESCE($4, channels),
           is_active         = COALESCE($5, is_active),
           updated_at        = NOW()
         WHERE type = $6 RETURNING *`,
        [title_template ?? null, body_template ?? null, whatsapp_template ?? null,
         channels, is_active ?? null, type]
    );
    if (!rows.length) return res.status(404).json({ error: 'Template not found' });
    await bustTemplateCache(String(type));
    res.json({ success: true, template: rows[0] });
});

// ─── Admin: notification log ──────────────────────────────────────────────────

router.get('/admin/log', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res: Response) => {
    const { type, status, limit = '100' } = req.query as Record<string, string>;
    const conditions: string[] = [];
    const params: any[] = [];
    if (type) { conditions.push(`n.type = $${params.length + 1}`); params.push(type); }
    if (status) { conditions.push(`n.delivery_status = $${params.length + 1}`); params.push(status); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(Math.min(parseInt(limit), 500));

    const { rows } = await query(
        `SELECT n.id, n.type, n.title, n.body, n.channel, n.delivery_status,
                n.is_read, n.created_at,
                u.name AS user_name, u.phone AS user_phone
         FROM notifications n
         JOIN users u ON n.user_id = u.id
         ${where}
         ORDER BY n.created_at DESC
         LIMIT $${params.length}`,
        params
    );
    res.json({ notifications: rows });
});

export default router;
