import { Router, Response } from 'express';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { query } from '../db';
import { redis } from '../redis';
import { emitToAdmin } from '../socket';
import { bustTemplateCache } from '../services/notification.service';
import { sendFCM, isFCMConfigured } from '../services/fcm.service';
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

router.get('/debug-broadcast', async (_req, res: Response) => {
    try {
        const { rows: tmplRows } = await db.query(
            "SELECT * FROM notification_templates WHERE type = 'broadcast_message'"
        );
        const { rows: userRows } = await db.query(
            "SELECT id, name, phone, role, device_token FROM users WHERE device_token IS NOT NULL ORDER BY updated_at DESC LIMIT 10"
        );
        res.json({
            template: tmplRows[0] || 'NOT_FOUND',
            activeUsersWithToken: userRows.length,
            users: userRows.map(u => ({ id: u.id, name: u.name, phone: u.phone, role: u.role, tokenPrefix: u.device_token ? u.device_token.slice(0, 15) : null }))
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/debug-tokens', async (_req, res: Response) => {
    try {
        const { rows } = await db.query(
            `SELECT id, name, phone, role, 
                    CASE WHEN device_token IS NULL THEN false ELSE true END as has_token,
                    SUBSTRING(device_token FROM 1 FOR 15) as token_prefix,
                    updated_at
             FROM users 
             ORDER BY updated_at DESC LIMIT 20`
        );
        res.json({ count: rows.length, users: rows });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/broadcast-test-now', async (_req, res: Response) => {
    try {
        const { rows } = await db.query(
            "SELECT id, name, phone, role, device_token FROM users WHERE device_token IS NOT NULL AND is_active = true"
        );
        const results = [];
        for (const u of rows) {
            const fcmRes = await sendFCM(
                u.device_token,
                '🎉 Special Offer for You!',
                'Get 20% OFF on your next order with code 2QT20',
                { type: 'broadcast_message', title: '🎉 Special Offer for You!', body: 'Get 20% OFF on your next order with code 2QT20' }
            );
            results.push({ id: u.id, name: u.name, phone: u.phone, role: u.role, fcmResult: fcmRes });
        }
        res.json({ count: rows.length, results });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ─── TEMPORARY: full-trace broadcast pipeline debugger (remove after investigation) ──
// Mirrors admin.ts POST /admin/broadcast's exact audience SQL + delivery loop, but
// returns every stage's result in the HTTP response instead of fire-and-forgetting it,
// so we can see precisely which users were selected, which had tokens, and what the
// real Firebase Admin SDK returned for each — no server log access required.
router.get('/debug-broadcast-trace', async (req, res: Response) => {
    const trace: Record<string, any> = { stages: [] };
    try {
        const segment = (req.query.segment as string) || 'all';
        const zoneId = req.query.zoneId as string | undefined;
        trace.stages.push({ stage: 'input', segment, zoneId: zoneId || null, at: new Date().toISOString() });

        // Exact same branch admin.ts uses for segment === 'all' (maps to "All Customers")
        let queryStr = '';
        const params: any[] = [];
        if (segment === 'all') {
            queryStr = `SELECT u.id, u.phone, u.name, u.role, u.is_active, u.device_token FROM users u WHERE u.is_active = true AND u.role IN ('customer', 'admin', 'super_admin')`;
        } else if (segment === 'everyone') {
            queryStr = `SELECT u.id, u.phone, u.name, u.role, u.is_active, u.device_token FROM users u WHERE u.is_active = true`;
        } else if (segment === 'riders') {
            queryStr = `SELECT u.id, u.phone, u.name, u.role, u.is_active, u.device_token FROM users u WHERE u.is_active = true AND u.role IN ('rider', 'rider_captain')`;
        } else {
            return res.status(400).json({ error: 'segment must be all | everyone | riders for this trace' });
        }

        const { rows } = await query(queryStr, params);
        trace.stages.push({
            stage: 'audience_query',
            sql: queryStr,
            rowCount: rows.length,
            matchedUsers: rows.map((r: any) => ({ id: r.id, name: r.name, role: r.role, phone: r.phone, hasToken: !!r.device_token })),
        });

        const withToken = rows.filter((r: any) => !!r.device_token);
        trace.stages.push({ stage: 'token_filter', usersWithToken: withToken.length, usersWithoutToken: rows.length - withToken.length });

        // Replicate deliverNotification's exact preference gate: broadcast_message is in
        // PROMO_TYPES, so `if (PROMO_TYPES.has(type) && !prefs.promotions) return;` would
        // silently skip a user here — before any FCM call — if their prefs row has
        // promotions=false. Check it explicitly per user so a silent skip is visible.
        const prefResults = [];
        for (const u of withToken) {
            const { rows: pRows } = await query('SELECT * FROM notification_preferences WHERE user_id = $1', [u.id]);
            const prefs = pRows[0] ?? { promotions: true, push_enabled: true, _source: 'default (no row)' };
            prefResults.push({
                userId: u.id, name: u.name,
                hasPreferencesRow: !!pRows[0],
                promotions: prefs.promotions,
                push_enabled: prefs.push_enabled,
                wouldBeBlockedByPromotionsGate: prefs.promotions === false,
                wouldBeBlockedByPushEnabledGate: prefs.push_enabled === false,
            });
        }
        trace.stages.push({ stage: 'notification_preferences_check', results: prefResults });

        const fcmConfigured = isFCMConfigured();
        trace.stages.push({ stage: 'fcm_config_check', fcmConfigured });

        const title = (req.query.title as string) || '[TRACE] Broadcast pipeline test';
        const body = (req.query.body as string) || `Trace run at ${new Date().toISOString()}`;

        const sendResults = [];
        for (const u of withToken) {
            const pref = prefResults.find(p => p.userId === u.id)!;
            if (pref.wouldBeBlockedByPromotionsGate || pref.wouldBeBlockedByPushEnabledGate) {
                sendResults.push({
                    userId: u.id, name: u.name, role: u.role, phone: u.phone,
                    firebaseResult: 'SKIPPED_BY_PREFERENCE_GATE_NOT_SENT_TO_FIREBASE',
                    errorDetail: null,
                });
                continue;
            }
            const startedAt = new Date().toISOString();
            let result: string;
            let errorDetail: string | null = null;
            try {
                result = await sendFCM(u.device_token, title, body, { type: 'broadcast_message', title, body });
            } catch (err: any) {
                result = 'threw';
                errorDetail = err.message;
            }
            sendResults.push({
                userId: u.id, name: u.name, role: u.role, phone: u.phone,
                tokenPrefix: (u.device_token as string).slice(0, 15),
                startedAt, completedAt: new Date().toISOString(),
                firebaseResult: result, errorDetail,
            });
        }
        trace.stages.push({ stage: 'fcm_send_per_user', results: sendResults });

        trace.summary = {
            audienceMatched: rows.length,
            hadToken: withToken.length,
            blockedByPreferenceGate: sendResults.filter(r => r.firebaseResult === 'SKIPPED_BY_PREFERENCE_GATE_NOT_SENT_TO_FIREBASE').length,
            sentOk: sendResults.filter(r => r.firebaseResult === 'ok').length,
            invalidToken: sendResults.filter(r => r.firebaseResult === 'invalid_token').length,
            skipped: sendResults.filter(r => r.firebaseResult === 'skipped').length,
            threw: sendResults.filter(r => r.firebaseResult === 'threw').length,
        };
        res.json(trace);
    } catch (err: any) {
        trace.stages.push({ stage: 'FATAL_ERROR', message: err.message, stack: err.stack });
        res.status(500).json(trace);
    }
});

router.get('/test-fcm-direct', async (_req, res: Response) => {
    try {
        const { rows } = await db.query(
            `SELECT id, name, phone, device_token FROM users WHERE device_token IS NOT NULL ORDER BY updated_at DESC LIMIT 1`
        );
        if (rows.length === 0) return res.json({ error: 'NO_ACTIVE_TOKENS' });

        const user = rows[0];
        const result = await sendFCM(
            user.device_token,
            '🔔 Live 2QT Push Test',
            'This is a real FCM push notification sent to your system tray!',
            { type: 'order_confirmed', orderId: '2QT-TEST-999' }
        );
        res.json({ success: true, userId: user.id, name: user.name, phone: user.phone, fcmResult: result });
    } catch (err: any) {
        res.status(500).json({ error: 'FCM_FAILED', message: err.message, stack: err.stack });
    }
});

// ─── FCM device token (mobile) ───────────────────────────────────────────────

router.patch('/device-token', authenticate, async (req: AuthRequest, res: Response) => {
    const { token } = req.body as { token: string };
    console.log(`[DEVICE_TOKEN] PATCH received user=${req.user!.userId} tokenPresent=${!!token} tokenPrefix=${token ? token.slice(0, 15) : 'n/a'}`);
    if (!token) return res.status(400).json({ error: 'token required' });

    // Bind FCM device token strictly to this user account (each role app - buyer, rider, kitchen - has a distinct package name & FCM token)
    await query('UPDATE users SET device_token = $1 WHERE id = $2', [token, req.user!.userId]);
    console.log(`[DEVICE_TOKEN] Saved token for user=${req.user!.userId}`);

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

router.post('/:id/click', authenticate, async (req: AuthRequest, res: Response) => {
    await query(
        'UPDATE notifications SET clicked_at = NOW(), is_read = TRUE WHERE id = $1 AND user_id = $2',
        [req.params.id, req.user!.userId]
    ).catch(() => {});
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
    emitToAdmin('notification_updated', { type: 'template', templateType: type });
    res.json({ success: true, template: rows[0] });
});

// ─── Admin: notification trigger rules ───────────────────────────────────────

router.get('/admin/triggers', authenticate, requireRole('super_admin', 'admin'), async (_req, res: Response) => {
    const { rows } = await query(
        'SELECT * FROM notification_triggers ORDER BY created_at ASC'
    );
    res.json({ triggers: rows });
});

router.post('/admin/triggers', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res: Response) => {
    const {
        name, event_type, delay_minutes = 0,
        template_type, channels = ['push', 'whatsapp'],
        audience_type = 'all', segment, conditions = {},
    } = req.body;

    if (!name || !event_type || !template_type) {
        return res.status(400).json({ error: 'name, event_type, and template_type are required' });
    }

    const { rows } = await query(
        `INSERT INTO notification_triggers
           (name, event_type, delay_minutes, template_type, channels,
            audience_type, segment, conditions, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8, FALSE)
         RETURNING *`,
        [name, event_type, delay_minutes, template_type,
         channels, audience_type, segment ?? null, JSON.stringify(conditions)]
    );
    emitToAdmin('notification_updated', { type: 'trigger', action: 'create', triggerId: rows[0].id });
    res.status(201).json({ trigger: rows[0] });
});

router.patch('/admin/triggers/:id', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const {
        name, delay_minutes, template_type, channels,
        audience_type, segment, conditions, is_active,
    } = req.body;

    const { rows } = await query(
        `UPDATE notification_triggers SET
           name             = COALESCE($1, name),
           delay_minutes    = COALESCE($2, delay_minutes),
           template_type    = COALESCE($3, template_type),
           channels         = COALESCE($4, channels),
           audience_type    = COALESCE($5, audience_type),
           segment          = COALESCE($6, segment),
           conditions       = COALESCE($7, conditions),
           is_active        = COALESCE($8, is_active),
           updated_at       = NOW()
         WHERE id = $9 RETURNING *`,
        [name ?? null, delay_minutes ?? null, template_type ?? null,
         channels ?? null, audience_type ?? null, segment ?? null,
         conditions != null ? JSON.stringify(conditions) : null,
         is_active ?? null, id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Trigger not found' });
    emitToAdmin('notification_updated', { type: 'trigger', action: 'update', triggerId: id });
    res.json({ trigger: rows[0] });
});

router.delete('/admin/triggers/:id', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res: Response) => {
    await query('DELETE FROM notification_triggers WHERE id = $1', [req.params.id]);
    emitToAdmin('notification_updated', { type: 'trigger', action: 'delete', triggerId: req.params.id });
    res.json({ success: true });
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

// ─── Debug: check notification pipeline for current user ─────────────────────

router.get('/debug', authenticate, async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;

    const { rows: userRows } = await query(
        'SELECT id, name, phone, device_token FROM users WHERE id = $1', [userId]
    );
    const user = userRows[0];

    const tmplCheck = await query(
        "SELECT type, is_active FROM notification_templates WHERE type = 'order_confirmed'"
    ).then(r => r.rows[0] ?? 'NOT FOUND').catch(() => 'TABLE MISSING');

    const prefsCheck = await query(
        'SELECT push_enabled FROM notification_preferences WHERE user_id = $1', [userId]
    ).then(r => r.rows[0] ?? 'NO ROW').catch(() => 'TABLE MISSING');

    const redisCheck = await redis.ping().then(() => 'OK').catch((e: any) => `FAIL: ${e.message}`);

    const notifTableCheck = await query(
        "SELECT 1 FROM notifications LIMIT 1"
    ).then(() => 'OK').catch(() => 'TABLE MISSING');

    res.json({
        fcmConfigured: isFCMConfigured(),
        hasDeviceToken: !!user?.device_token,
        deviceTokenPreview: user?.device_token ? (user.device_token as string).slice(0, 20) + '…' : null,
        redis: redisCheck,
        orderConfirmedTemplate: tmplCheck,
        notificationPreferences: prefsCheck,
        notificationsTable: notifTableCheck,
    });
});

// ─── Test: send a real FCM push to the current user ──────────────────────────

router.post('/test-push', authenticate, async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const { rows } = await query('SELECT device_token FROM users WHERE id = $1', [userId]);
    const token = rows[0]?.device_token;

    if (!token) {
        return res.status(400).json({
            error: 'NO_DEVICE_TOKEN',
            message: 'No FCM token saved for this user. Open the app and allow notifications, then try again.',
        });
    }
    if (!isFCMConfigured()) {
        return res.status(500).json({ error: 'FCM_NOT_CONFIGURED', message: 'FIREBASE_SERVICE_ACCOUNT_JSON not set.' });
    }

    try {
        const result = await sendFCM(
            token,
            '🔔 Test Notification',
            'FCM is working! You will now receive order updates.',
            { type: 'broadcast_message' }
        );
        console.log(`[TEST_PUSH] result=${result} userId=${userId} token=${(token as string).slice(0,15)}…`);
        res.json({ result }); // 'ok' | 'invalid_token' | 'skipped'
    } catch (err: any) {
        console.error('[TEST_PUSH] FCM error:', err.message);
        res.status(500).json({ error: 'FCM_SEND_FAILED', message: err.message });
    }
});

export default router;
