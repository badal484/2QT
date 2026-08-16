import { Router, Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import bcrypt from 'bcrypt';
import { query, withTransaction } from '../db';
import { ActivityLogService } from '../services/activity.service';
import { redis, keys } from '../redis';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { emitToUser, emitToAdmin, emitToKitchen, emitToAll, emitToRiders } from '../socket';
import { createPendingRefund } from '../services/refund.service';
import { NotificationService, sendNotification } from '../services/notification.service';
import { logSystemEvent } from '../utils/logger';
import ImageKit from '@imagekit/nodejs';
import multer from 'multer';

const validate = (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        const errorStrings = Object.entries(errors).map(([field, msgs]) => `${field}: ${msgs?.join(', ')}`);
        return res.status(400).json({ error: 'VALIDATION_ERROR', details: errorStrings.join(' | ') });
    }
    req.body = result.data;
    next();
};

const CustomizationOptionSchema = z.object({
    name: z.string().min(1).max(100),
    price_paise: z.number().int().nonnegative().default(0),
    photo_url: z.string().url().or(z.literal("")).optional().nullable()
});

const CustomizationGroupSchema = z.object({
    name: z.string().min(1).max(100),
    required: z.boolean().default(false),
    options: z.array(CustomizationOptionSchema).min(1)
});

const MenuItemSchema = z.object({
    name: z.string().min(1).max(120),
    zone_id: z.string().uuid(),
    description: z.string().max(500).optional(),
    price_paise: z.number().int().positive(),
    cost_price_paise: z.number().int().positive().optional(),
    category: z.string().min(1).max(60),
    station: z.string().optional(),
    photo_url: z.string().url().optional().nullable(),
    available: z.boolean().optional().default(true),
    is_veg: z.boolean().optional().default(false),
    is_egg: z.boolean().optional().default(false),
    is_bestseller: z.boolean().optional().default(false),
    is_new: z.boolean().optional().default(false),
    tags: z.array(z.string().max(40)).max(10).optional().default([]),
    customization_groups: z.array(CustomizationGroupSchema).optional().default([]),
});

const KitchenSchema = z.object({
    name: z.string().min(1).max(120),
    zone_ids: z.array(z.string().uuid()).min(1, 'At least one zone is required'),
    address: z.string().max(300).nullish(),
    fssai_license: z.string().max(20).nullish(),
    gstin: z.string().max(20).nullish(),
    lat: z.number().nullish().default(12.9716),
    lng: z.number().nullish().default(77.5946),
    is_paused: z.boolean().nullish(),
    pin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits').nullish(),
});

const ZoneSchema = z.object({
    name: z.string().min(1).max(80),
    city: z.string().default('Bengaluru'),
    kitchen_lat: z.number(),
    kitchen_lng: z.number(),
    radius_km: z.number().nonnegative().optional().default(4),
    delivery_fee_base_paise: z.number().int().nonnegative().optional().default(2500),
    delivery_fee_type: z.enum(['flat', 'per_km']).optional().default('flat'),
    base_delivery_fee_paise: z.number().int().nonnegative().optional().default(2500),
    per_km_fee_paise: z.number().int().nonnegative().optional().default(500),
    base_distance_km: z.number().nonnegative().optional().default(0),
    free_delivery_above_paise: z.number().int().nonnegative().optional().nullable(),
    surge_multiplier: z.number().nonnegative().optional().default(1.0),
    opening_time: z.string().regex(/^\d{2}:\d{2}$/).optional().default('10:00'),
    closing_time: z.string().regex(/^\d{2}:\d{2}$/).optional().default('22:00'),
    max_orders_per_hour: z.number().int().positive().optional().default(60),
    realistic_delivery_minutes: z.number().int().positive().optional().default(30),
    polygon_points: z.array(z.object({ lat: z.number(), lng: z.number() })).optional().nullable(),
    rider_base_pay_paise: z.number().int().nonnegative().optional().default(2000),
    rider_per_km_paise: z.number().int().nonnegative().optional().default(500),
    rider_free_km: z.number().nonnegative().optional().default(2.0),
});

const imagekit = new ImageKit({
  // @ts-ignore
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY!,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY!,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT!
});

const upload = multer({ storage: multer.memoryStorage() });

const router = Router();


router.get('/activity-logs', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    try {
        const { limit, role, action } = req.query;
        const logs = await ActivityLogService.getLogs(Number(limit) || 100, role as string, action as string);
        res.json({ logs });
    } catch (error) {
        console.error('Error fetching activity logs:', error);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

router.get('/dashboard', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    try {
        const [
            { rows: activeOrders },
            { rows: revenue },
            { rows: ridersOnline },
            { rows: lowStock },
            { rows: customers },
            { rows: weeklyRev },
        ] = await Promise.all([
            query("SELECT count(*) FROM orders WHERE status NOT IN ('delivered','cancelled')"),
            query("SELECT sum(total_amount_paise) FROM orders WHERE payment_status='paid' AND created_at >= CURRENT_DATE"),
            query("SELECT count(*) FROM users WHERE role IN ('rider','rider_captain') AND is_online = true"),
            query('SELECT count(*) FROM ingredients WHERE current_stock_grams <= reorder_threshold_grams'),
            query("SELECT count(*) FROM users WHERE role='customer'"),
            query(`
                SELECT d::date AS day,
                       to_char(d::date, 'Dy') AS label,
                       COALESCE(SUM(o.total_amount_paise), 0) AS revenue_paise
                FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day') d
                LEFT JOIN orders o
                       ON DATE(o.created_at AT TIME ZONE 'Asia/Kolkata') = d::date
                      AND o.payment_status = 'paid'
                GROUP BY d::date
                ORDER BY d::date ASC
            `),
        ]);

        res.json({
            activeOrders: parseInt(activeOrders[0].count),
            todayRevenuePaise: parseInt(revenue[0].sum || '0'),
            ridersOnline: parseInt(ridersOnline[0].count),
            lowStockAlerts: parseInt(lowStock[0].count),
            totalCustomers: parseInt(customers[0].count),
            weeklyRevenue: weeklyRev.map(r => ({
                label: r.label,
                revenuePaise: parseInt(r.revenue_paise),
            })),
        });
    } catch (err: any) {
        console.error('Dashboard Error:', err);
        res.status(500).json({ error: 'Failed to load dashboard' });
    }
});

router.get('/feedback', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { rows: avg } = await query(`
        SELECT
            AVG(rating)::numeric(3,1)          as avg_food,
            AVG(delivery_rating)::numeric(3,1) as avg_delivery,
            COUNT(*)                           as total
        FROM order_feedback
    `);
    const { rows: recent } = await query(`
        SELECT f.rating, f.delivery_rating, f.comment, f.created_at,
               o.display_id as order_display_id,
               k.name       as kitchen_name,
               u.name       as customer_name,
               u.phone      as customer_phone
        FROM order_feedback f
        JOIN orders  o ON f.order_id   = o.id
        JOIN kitchens k ON o.kitchen_id = k.id
        JOIN users   u ON f.customer_id = u.id
        ORDER BY f.created_at DESC
        LIMIT 100
    `);
    res.json({
        feedbacks: recent,
        averageRating:         parseFloat(avg[0].avg_food     || '0').toFixed(1),
        averageDeliveryRating: parseFloat(avg[0].avg_delivery || '0').toFixed(1),
        totalCount:            parseInt(avg[0].total),
    });
});

router.get('/stats/growth', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { rows: users } = await query("SELECT count(*) FROM users WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'");
    const { rows: orders } = await query("SELECT count(*) FROM orders WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'");
    const { rows: totalRevenue } = await query("SELECT sum(total_amount_paise) FROM orders WHERE payment_status = 'paid'");
    
    res.json({
        newUsers30d: parseInt(users[0].count),
        newOrders30d: parseInt(orders[0].count),
        lifetimeRevenuePaise: parseInt(totalRevenue[0].sum || '0')
    });
});

router.get('/orders/live', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { rows } = await query(`
        SELECT o.*, u.name as customer_name, r.name as rider_name
        FROM orders o
        JOIN users u ON o.customer_id = u.id
        LEFT JOIN users r ON o.rider_id = r.id
        WHERE o.status NOT IN ('delivered', 'cancelled')
        ORDER BY o.created_at DESC
    `);
    
    for (const order of rows) {
        const { rows: items } = await query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
        order.items = items;
    }

    res.json({ orders: rows });
});

// Dispatch history — all orders with rider assignment, searchable, for dispute resolution
router.get('/orders/dispatch', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
    const offset = (page - 1) * limit;
    const search = (req.query.search as string || '').trim();
    const status = (req.query.status as string || '').trim();
    const riderId = (req.query.riderId as string || '').trim();
    const date = (req.query.date as string || '').trim(); // YYYY-MM-DD

    const conditions: string[] = [];
    const params: any[] = [];
    let p = 1;

    if (search) {
        conditions.push(`(o.display_id ILIKE $${p} OR c.name ILIKE $${p} OR c.phone ILIKE $${p} OR r.name ILIKE $${p} OR r.phone ILIKE $${p})`);
        params.push(`%${search}%`); p++;
    }
    if (status) { conditions.push(`o.status = $${p}`); params.push(status); p++; }
    if (riderId) { conditions.push(`o.rider_id = $${p}`); params.push(riderId); p++; }
    if (date) { conditions.push(`o.created_at::date = $${p}`); params.push(date); p++; }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await query(`
        SELECT
            o.id, o.display_id, o.status,
            o.payment_method, o.payment_status,
            o.total_amount_paise,
            o.created_at, o.delivered_at, o.cod_collected_at,
            c.id  AS customer_id,
            c.name AS customer_name,
            c.phone AS customer_phone,
            r.id   AS rider_id,
            r.name AS rider_name,
            r.phone AS rider_phone,
            (
                SELECT json_agg(json_build_object('name', mi.name, 'qty', oi.quantity))
                FROM order_items oi
                JOIN menu_items mi ON oi.menu_item_id = mi.id
                WHERE oi.order_id = o.id
            ) AS items
        FROM orders o
        JOIN users c ON o.customer_id = c.id
        LEFT JOIN users r ON o.rider_id = r.id
        ${where}
        ORDER BY o.created_at DESC
        LIMIT $${p} OFFSET $${p + 1}
    `, [...params, limit, offset]);

    const { rows: countRows } = await query(
        `SELECT COUNT(*) FROM orders o JOIN users c ON o.customer_id = c.id LEFT JOIN users r ON o.rider_id = r.id ${where}`,
        params
    );

    res.json({ orders: rows, total: parseInt(countRows[0].count), page, limit });
});

router.get('/orders/scheduled', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { rows } = await query(`
        SELECT so.*, u.name as customer_name
        FROM scheduled_orders so
        JOIN users u ON so.customer_id = u.id
        WHERE so.status = 'scheduled'
        ORDER BY so.scheduled_for ASC
    `);
    res.json({ scheduledOrders: rows });
});

router.delete('/scheduled-orders/:id', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { id } = req.params;
    try {
        const { rowCount } = await query(
            "UPDATE scheduled_orders SET status='cancelled' WHERE id=$1 AND status='scheduled'",
            [id]
        );
        if (rowCount === 0) return res.status(404).json({ error: 'NOT_FOUND_OR_ALREADY_CANCELLED' });
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/menu', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { rows } = await query(`
        SELECT m.*, z.name as zone_name
        FROM menu_items m
        JOIN zones z ON m.zone_id = z.id
        ORDER BY m.category, m.name
    `);
    res.json({ items: rows });
});

router.patch('/menu/:id/availability', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { available } = req.body;
    await query('UPDATE menu_items SET available = $1 WHERE id = $2', [available, id]);
    // Clear menu cache for all zones just to be safe or use a more specific key if known
    const { rows: zones } = await query('SELECT id FROM zones');
    for (const zone of zones) {
        await redis.del(keys.menu(zone.id));
    }
    emitToAll('menu_updated', { action: 'availability', id, available });
    res.json({ success: true });
});

router.post('/broadcast', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    try {
        const { title, message, target, zoneId, segment, imageUrl, scheduledFor } = req.body;
        if (!title?.trim() || !message?.trim()) return res.status(400).json({ error: 'title and message required' });

        // Frontend sends segment as audience type ("all","zone","active_last_7")
        // Backend legacy uses target ("customers","riders") + segment (behavioral filter)
        // Normalise: treat segment as audience selector when target is absent
        const audience = target || segment || 'all';
        const params: any[] = [];
        let queryStr = '';

        if (audience === 'active_last_7' || audience === 'active') {
            queryStr = `SELECT u.id, u.phone FROM users u
                        WHERE (u.is_active = true OR u.is_active IS NULL) AND LOWER(u.role::text) IN ('customer', 'buyer')
                        AND EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = u.id AND o.created_at > NOW() - INTERVAL '7 days')`;
        } else if (audience === 'riders') {
            queryStr = `SELECT u.id, u.phone FROM users u WHERE (u.is_active = true OR u.is_active IS NULL) AND LOWER(u.role::text) IN ('rider', 'rider_captain')`;
            if (zoneId) queryStr += ` AND u.zone_id = $${params.push(zoneId)}`;
        } else if (audience === 'kitchens' || audience === 'partners') {
            queryStr = `SELECT u.id, u.phone FROM users u WHERE (u.is_active = true OR u.is_active IS NULL) AND LOWER(u.role::text) IN ('chef', 'kitchen_manager', 'partner_kitchen')`;
            if (zoneId) queryStr += ` AND u.zone_id = $${params.push(zoneId)}`;
        } else if (audience === 'customers' || audience === 'all_customers' || audience === 'buyers' || audience === 'buyer' || audience === 'all') {
            if (zoneId) {
                queryStr = `SELECT u.id, u.phone FROM users u LEFT JOIN addresses a ON u.id = a.customer_id WHERE (u.is_active = true OR u.is_active IS NULL) AND LOWER(u.role::text) IN ('customer', 'buyer') AND (u.zone_id = $1 OR a.zone_id = $1)`;
                params.push(zoneId);
            } else {
                queryStr = `SELECT u.id, u.phone FROM users u WHERE (u.is_active = true OR u.is_active IS NULL) AND LOWER(u.role::text) IN ('customer', 'buyer')`;
            }
        } else if (audience === 'zone') {
            // "By Zone" — everyone (any role) local to a zone, e.g. for an operational
            // announcement. Distinct from "customers" + zoneId, which is customer-only.
            if (!zoneId) return res.status(400).json({ error: 'zoneId required for zone audience' });
            queryStr = `SELECT u.id, u.phone FROM users u LEFT JOIN addresses a ON u.id = a.customer_id WHERE (u.is_active = true OR u.is_active IS NULL) AND (u.zone_id = $1 OR a.zone_id = $1)`;
            params.push(zoneId);
        } else if (audience === 'everyone') {
            queryStr = `SELECT u.id, u.phone FROM users u WHERE (u.is_active = true OR u.is_active IS NULL)`;
        } else {
            // Unrecognized audience value — fail closed instead of silently broadcasting
            // to every role in the database (the previous behavior for any value that
            // didn't match one of the branches above, including typos).
            return res.status(400).json({ error: `Unknown audience: ${audience}` });
        }

        const { rows } = await query(queryStr, params);

        // Track campaign (target_audience NOT NULL — use resolved audience label)
        const status = scheduledFor && new Date(scheduledFor).getTime() > Date.now() ? 'scheduled' : 'completed';
        await query(
            `INSERT INTO marketing_campaigns (title, message, image_url, target_audience, zone_id, segment, scheduled_for, queued_count, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [title, message, imageUrl || null, audience, zoneId || null, segment || null, scheduledFor || null, rows.length, status]
        );

        // Enqueue through BullMQ (same path as campaigns.ts) instead of firing every send
        // concurrently and directly — a large "All Customers"/"Everyone" broadcast could
        // otherwise open thousands of simultaneous DB/Redis calls with no backpressure.
        // The worker (concurrency: 10) drains this with automatic retry/backoff per user.
        //
        // Not awaited before responding — the enqueue itself depends on Redis, and this
        // endpoint must still respond promptly even if Redis is slow/unhealthy (matches
        // the previous fire-and-forget behavior; the old code never awaited sends either).
        const BATCH = 50;
        (async () => {
            for (let i = 0; i < rows.length; i += BATCH) {
                const batch = rows.slice(i, i + BATCH);
                await Promise.allSettled(
                    batch.map(user =>
                        sendNotification('broadcast_message', {
                            userId: user.id,
                            phone: user.phone,
                            title,
                            body: message,
                            imageUrl: imageUrl || undefined,
                            overrideQuietHours: true,
                        })
                    )
                );
            }
            console.log(`[ADMIN] Broadcast queued for ${rows.length} users (audience=${audience} zone=${zoneId}): ${title}`);
        })().catch(err => console.error('[ADMIN] Broadcast background enqueue error:', err.message));

        res.json({ success: true, count: rows.length });
    } catch (err: any) {
        console.error('[ADMIN] Broadcast error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

router.get('/broadcasts', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { rows } = await query(`
        SELECT mc.*, z.name as zone_name 
        FROM marketing_campaigns mc 
        LEFT JOIN zones z ON mc.zone_id = z.id 
        ORDER BY mc.created_at DESC 
        LIMIT 50
    `);
    res.json({ campaigns: rows });
});

router.get('/support/tickets', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { rows } = await query(`
        SELECT t.*, t.issue_type as subject, u.name as customer_name
        FROM support_tickets t
        JOIN users u ON t.customer_id = u.id
        ORDER BY t.created_at DESC
    `);
    res.json({ tickets: rows });
});

router.post('/support/tickets/:id/resolve', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { resolution } = req.body;
    
    await query(
        "UPDATE support_tickets SET status = 'resolved', resolution = $1, resolved_at = NOW() WHERE id = $2",
        [resolution, id]
    );

    res.json({ success: true });
});

router.post('/users/:id/verify', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const id = req.params.id as string;

    await query('UPDATE users SET is_verified = true, is_active = true WHERE id = $1', [id]);

    const { rows } = await query('SELECT phone, name FROM users WHERE id = $1', [id]);
    if (rows[0]?.phone) {
        NotificationService.send('rider_verified', {
            phone: rows[0].phone,
            name: rows[0].name
        });
    }

    emitToUser(id, 'user_updated', { is_verified: true, is_active: true });

    res.json({ success: true });
});

router.get('/rider-applications', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { rows } = await query(`
        SELECT a.*, u.name, u.phone, u.photo_url
        FROM rider_applications a
        JOIN users u ON a.user_id = u.id
        ORDER BY a.created_at DESC
    `);
    res.json({ applications: rows });
});

router.post('/rider-applications/:id/:action', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const id = req.params.id as string;
    const action = req.params.action as string;
    if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ error: 'INVALID_ACTION' });
    }

    try {
        await withTransaction(async (client) => {
            const status = action === 'approve' ? 'approved' : 'rejected';
            const { rows } = await client.query(
                'UPDATE rider_applications SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING user_id',
                [status, id]
            );

            if (rows.length === 0) throw new Error('APPLICATION_NOT_FOUND');

            const userId = rows[0].user_id;

            if (action === 'approve') {
                await client.query('UPDATE users SET role = \'rider\', is_verified = true, is_active = true, onboarding_complete = true WHERE id = $1', [userId]);
                emitToUser(userId, 'user_updated', { role: 'rider', is_verified: true, is_active: true, onboarding_complete: true });
                
                const { rows: uRows } = await client.query('SELECT phone, name FROM users WHERE id = $1', [userId]);
                if (uRows[0]?.phone) {
                    NotificationService.send('rider_verified', { phone: uRows[0].phone, name: uRows[0].name }).catch(() => {});
                }
            }
        });

        res.json({ success: true, action });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Live GPS location of a specific rider from Redis (for SOS context)
router.get('/riders/:id/live-location', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    try {
        const locRaw = await redis.get(keys.riderLocation(req.params.id as string)).catch(() => null);
        if (!locRaw) return res.json({ location: null });
        res.json({ location: JSON.parse(locRaw) });
    } catch (err) {
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

// ─── SOS Alerts ───────────────────────────────────────────────────────────────
router.get('/sos-alerts', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { status = 'active' } = req.query;
    try {
        const { rows } = await query(`
            SELECT s.*, u.name as rider_name, u.phone as rider_phone, o.display_id as order_display_id
            FROM sos_alerts s
            JOIN users u ON s.rider_id = u.id
            LEFT JOIN orders o ON s.order_id = o.id
            WHERE ($1 = 'all' OR s.status = $1)
            ORDER BY s.created_at DESC
            LIMIT 50
        `, [status]);
        res.json({ alerts: rows });
    } catch (err) {
        console.error('[admin/sos-alerts]', err);
        res.json({ alerts: [] });
    }
});

router.patch('/sos-alerts/:id/resolve', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { resolutionNote } = req.body;
    try {
        await query(
            `UPDATE sos_alerts SET status = 'resolved', resolved_at = NOW(), resolved_by = $1, resolution_note = $2 WHERE id = $3`,
            [req.user!.userId, resolutionNote || null, req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[admin/sos-alerts/resolve]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

router.get('/riders', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { rows: riders } = await query(`
        SELECT u.id, u.name, u.phone, u.is_online, u.is_verified,
               (
                   SELECT json_agg(json_build_object(
                       'id', o.id,
                       'display_id', o.display_id,
                       'status', o.status
                   ))
                   FROM orders o
                   WHERE o.rider_id = u.id AND o.status NOT IN ('delivered', 'cancelled')
               ) as active_orders
        FROM users u
        WHERE u.role IN ('rider', 'rider_captain')
    `);

    const locations = await Promise.all(
        riders.map(r => redis.get(keys.riderLocation(r.id)))
    );
    locations.forEach((loc, i) => {
        if (loc) riders[i].location = JSON.parse(loc);
    });

    res.json({ riders });
});

router.post(['/orders/:id/assign', '/orders/:id/assign-rider'], authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { riderId } = req.body;
    if (!riderId) return res.status(400).json({ error: 'MISSING_RIDER_ID' });
    const { rows: oRows } = await query('UPDATE orders SET rider_id = $1, status = \'out_for_delivery\' WHERE id = $2 RETURNING customer_id', [riderId, id]);
    if (oRows[0]) {
        const { rows: rRows } = await query('SELECT name, phone FROM users WHERE id = $1', [riderId]);
        const rider = rRows[0];
        emitToUser(oRows[0].customer_id, 'order_status_update', {
            orderId: id,
            status: 'out_for_delivery',
            riderAssigned: true,
            riderName: rider?.name,
            riderPhone: rider?.phone
        });
        emitToUser(riderId, 'order_auto_assigned', { orderId: id });
    }
    emitToAdmin('order_status_update', { orderId: id, status: 'out_for_delivery' });
    res.json({ success: true });
});

router.post('/orders/:id/alert-riders', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { id } = req.params;
    try {
        const { rows } = await query(
            `SELECT id, zone_id, display_id FROM orders WHERE id = $1 AND status NOT IN ('delivered','cancelled')`,
            [id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Order not found or not alertable' });
        const order = rows[0];
        emitToRiders('dispatcher_order_alert', { orderId: order.id, displayId: order.display_id }, order.zone_id ?? undefined);
        res.json({ ok: true });
    } catch (err) {
        console.error('[admin/alert-riders]', err);
        res.status(500).json({ error: 'Failed to alert riders' });
    }
});

router.patch('/orders/:id/status', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = ['confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'INVALID_STATUS' });

    if (status === 'cancelled') {
        const { rows } = await query('SELECT * FROM orders WHERE id = $1', [id]);
        if (!rows[0]) return res.status(404).json({ error: 'NOT_FOUND' });
        const order = rows[0];

        await withTransaction(async (client) => {
            await client.query(
                "UPDATE orders SET status = 'cancelled', cancelled_at = NOW(), cancellation_reason = 'Admin cancelled' WHERE id = $1",
                [id]
            );

            // Reverse loyalty points
            const { rows: earnedPts } = await client.query(
                "SELECT points FROM loyalty_transactions WHERE order_id = $1 AND type = 'earn' LIMIT 1", [id]
            );
            if (earnedPts[0]?.points > 0) {
                await client.query(
                    "INSERT INTO loyalty_transactions (customer_id, points, type, order_id) VALUES ($1, $2, 'redeem', $3)",
                    [order.customer_id, earnedPts[0].points, id]
                );
            }

            // Reverse promo usage
            if (order.promo_code_id) {
                await client.query('UPDATE promo_codes SET times_used = GREATEST(0, times_used - 1) WHERE id = $1', [order.promo_code_id]);
                await redis.del(keys.activePromos());
            }

            // Restore subscription credit
            if (order.is_subscription_order) {
                await client.query(`
                    UPDATE subscriptions SET remaining_meals = remaining_meals + 1, current_day_credits = current_day_credits + 1
                    WHERE customer_id = $1 AND status = 'active'
                `, [order.customer_id]);
            }
        });

        // Queue refund for finance team — they choose wallet or bank
        if (order.payment_status === 'paid' && order.total_amount_paise > 0) {
            await createPendingRefund({
                orderId: id as string,
                customerId: order.customer_id,
                amountPaise: order.total_amount_paise,
                reason: 'Admin cancelled order',
                initiatedBy: req.user!.userId,
                razorpayPaymentId: order.gateway_payment_id || undefined,
            });
        }

        emitToUser(order.customer_id, 'order_status_update', { orderId: id, status: 'cancelled' });
        emitToKitchen(order.kitchen_id, 'order_cancelled', { orderId: id });
    } else {
        await query('UPDATE orders SET status = $1 WHERE id = $2', [status, id]);
        const { rows } = await query('SELECT customer_id FROM orders WHERE id = $1', [id]);
        if (rows[0]) emitToUser(rows[0].customer_id, 'order_status_update', { orderId: id, status });
    }

    res.json({ success: true });
});

router.post('/orders/complete-all-live', authenticate, requireRole('super_admin', 'admin', 'manager', 'kitchen_manager', 'partner_kitchen', 'chef'), async (req: AuthRequest, res) => {
    try {
        const { rows } = await query(
            `UPDATE orders 
             SET status = 'delivered', delivered_at = COALESCE(delivered_at, NOW()) 
             WHERE status NOT IN ('delivered', 'cancelled') 
             RETURNING id, display_id`
        );
        res.json({ success: true, count: rows.length, completedOrders: rows });
    } catch (err: any) {
        console.error('[orders/complete-all-live]', err);
        res.status(500).json({ error: err?.message || 'Failed to complete live orders' });
    }
});

router.post('/riders/:id/verify', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const id = req.params.id as string;
    await query('UPDATE users SET is_verified = true, is_active = true WHERE id = $1', [id]);
    const { rows } = await query('SELECT phone, name FROM users WHERE id = $1', [id]);
    if (rows[0]?.phone) {
        NotificationService.send('rider_verified', { phone: rows[0].phone, name: rows[0].name }).catch(() => {});
    }
    emitToUser(id, 'user_updated', { is_verified: true, is_active: true });
    res.json({ success: true });
});

// ─── Rider Documents (KYC review) ────────────────────────────────────────────
router.get('/riders/documents', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    try {
        const { rows } = await query(`
            SELECT ra.id as application_id, ra.user_id as rider_id,
                   ra.vehicle_type, ra.license_number, ra.id_photo_url,
                   ra.status, ra.doc_review_status, ra.doc_review_reason,
                   ra.doc_reviewed_at, ra.created_at, ra.updated_at,
                   u.name as rider_name, u.phone as rider_phone,
                   u.photo_url as profile_photo_url,
                   u.is_verified, u.is_suspended
            FROM rider_applications ra
            JOIN users u ON ra.user_id = u.id
            WHERE u.role IN ('rider', 'rider_captain')
            ORDER BY
              CASE ra.doc_review_status WHEN 'pending' THEN 0 WHEN 'rejected' THEN 1 ELSE 2 END,
              ra.updated_at DESC
        `);
        res.json({ documents: rows });
    } catch (err) {
        console.error('[admin/riders/documents]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

router.patch('/riders/:id/documents/review', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const riderId = req.params.id as string;
    const { action, reason } = req.body; // action: 'approve' | 'reject'
    if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'INVALID_ACTION' });
    const adminId = req.user!.userId;
    try {
        const docStatus = action === 'approve' ? 'approved' : 'rejected';
        const { rowCount } = await query(
            `UPDATE rider_applications
             SET doc_review_status = $1, doc_review_reason = $2, doc_reviewed_by = $3, doc_reviewed_at = NOW()
             WHERE user_id = $4`,
            [docStatus, reason || null, adminId, riderId]
        );
        if (!rowCount) return res.status(404).json({ error: 'NOT_FOUND' });
        const { rows } = await query('SELECT name, phone FROM users WHERE id = $1', [riderId]);
        if (rows[0]?.phone) {
            const msg = action === 'approve'
                ? `Hi ${rows[0].name}, your documents have been verified. You can now accept deliveries!`
                : `Hi ${rows[0].name}, your documents were not approved. Reason: ${reason || 'Please re-upload clear photos.'}`;
            NotificationService.send('generic_sms', { phone: rows[0].phone, message: msg }).catch(() => {});
        }
        emitToUser(riderId, 'document_review', { status: docStatus, reason: reason || null });
        res.json({ success: true, docStatus });
    } catch (err) {
        console.error('[admin/riders/documents/review]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

// ─── Rider Detail ────────────────────────────────────────────────────────────
router.get('/riders/:id', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const id = req.params.id as string;
    try {
        const [profileRes, earningsRes, ordersRes, docsRes, payoutsRes] = await Promise.all([
            query(`SELECT u.id, u.name, u.phone, u.is_verified, u.is_online, u.is_active,
                          u.is_suspended, u.suspension_reason, u.suspended_at, u.created_at,
                          u.payment_model, u.monthly_salary_paise, u.fuel_allowance_per_km_paise
                   FROM users u WHERE u.id = $1 AND u.role IN ('rider', 'rider_captain')`, [id]),
            query(`SELECT date, deliveries_count, total_paise, base_earnings_paise, bonus_earnings_paise, cash_collected_paise
                   FROM rider_daily_earnings WHERE rider_id = $1 ORDER BY date DESC LIMIT 30`, [id]),
            query(`SELECT o.id, o.display_id, o.status, o.total_amount_paise, o.payment_method,
                          o.created_at, o.delivered_at, o.pod_photo_url,
                          cu.name as customer_name
                   FROM orders o JOIN users cu ON o.customer_id = cu.id
                   WHERE o.rider_id = $1 ORDER BY o.created_at DESC LIMIT 20`, [id]),
            query(`SELECT vehicle_type, license_number, id_photo_url, status, doc_review_status, doc_review_reason, updated_at
                   FROM rider_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`, [id]),
            query(`SELECT COALESCE(SUM(amount_paise), 0) as total_paid FROM weekly_payouts WHERE rider_id = $1 AND status = 'paid'`, [id]),
        ]);
        if (!profileRes.rows[0]) return res.status(404).json({ error: 'RIDER_NOT_FOUND' });
        const totalEarnings = earningsRes.rows.reduce((s: number, r: any) => s + parseInt(r.total_paise, 10), 0);
        const totalDeliveries = earningsRes.rows.reduce((s: number, r: any) => s + parseInt(r.deliveries_count, 10), 0);
        res.json({
            rider: profileRes.rows[0],
            earnings: earningsRes.rows,
            stats: { totalEarningsPaise: totalEarnings, totalDeliveries, totalPaidPaise: parseInt(payoutsRes.rows[0].total_paid, 10) },
            recentOrders: ordersRes.rows,
            documents: docsRes.rows[0] || null,
        });
    } catch (err) {
        console.error('[admin/riders/:id]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

router.patch('/riders/:id/contract', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const id = req.params.id as string;
    const { payment_model, monthly_salary_paise, fuel_allowance_per_km_paise } = req.body;
    
    if (!['per_order', 'salary'].includes(payment_model)) {
        return res.status(400).json({ error: 'INVALID_PAYMENT_MODEL' });
    }

    try {
        const { rows } = await query(
            `UPDATE users 
             SET payment_model = $1, 
                 monthly_salary_paise = $2, 
                 fuel_allowance_per_km_paise = $3 
             WHERE id = $4 AND role IN ('rider', 'rider_captain')
             RETURNING id`,
            [payment_model, monthly_salary_paise || 0, fuel_allowance_per_km_paise || 0, id]
        );
        
        if (!rows.length) return res.status(404).json({ error: 'RIDER_NOT_FOUND' });
        
        res.json({ success: true });
    } catch (err) {
        console.error('[admin/riders/contract]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

// ─── Rider Suspend / Reactivate ──────────────────────────────────────────────
router.post('/riders/:id/suspend', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const id = req.params.id as string;
    const { reason } = req.body;
    const adminId = req.user!.userId;
    try {
        await query(
            `UPDATE users SET is_suspended = TRUE, is_active = FALSE, suspension_reason = $1,
             suspended_at = NOW(), suspended_by = $2 WHERE id = $3`,
            [reason || 'Suspended by admin', adminId, id]
        );
        emitToUser(id, 'user_updated', { is_suspended: true, is_active: false, suspension_reason: reason || 'Suspended by admin' });
        logSystemEvent('RIDER_SUSPENDED', `Admin ${adminId} suspended rider ${id}. Reason: ${reason}`, 'warning', { riderId: id, adminId, reason });
        const { rows: actorRows } = await query('SELECT name, role FROM users WHERE id = $1', [adminId]);
        ActivityLogService.log({ userId: adminId, userName: actorRows[0]?.name || 'Admin', userRole: actorRows[0]?.role || req.user!.role, actionType: 'RIDER_SUSPENDED', entityType: 'USER', entityId: id, details: { reason: reason || 'Suspended by admin' } });
        res.json({ success: true });
    } catch (err) {
        console.error('[admin/riders/suspend]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

router.post('/riders/:id/reactivate', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const id = req.params.id as string;
    const adminId = req.user!.userId;
    try {
        await query(
            `UPDATE users SET is_suspended = FALSE, is_active = TRUE, suspension_reason = NULL,
             suspended_at = NULL, suspended_by = NULL WHERE id = $1`,
            [id]
        );
        emitToUser(id, 'user_updated', { is_suspended: false, is_active: true });
        logSystemEvent('RIDER_REACTIVATED', `Admin ${adminId} reactivated rider ${id}`, 'info', { riderId: id, adminId });
        const { rows: actorRows } = await query('SELECT name, role FROM users WHERE id = $1', [adminId]);
        ActivityLogService.log({ userId: adminId, userName: actorRows[0]?.name || 'Admin', userRole: actorRows[0]?.role || req.user!.role, actionType: 'RIDER_REACTIVATED', entityType: 'USER', entityId: id, details: {} });
        res.json({ success: true });
    } catch (err) {
        console.error('[admin/riders/reactivate]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

// ─── Rider Issues ─────────────────────────────────────────────────────────────
router.get('/rider-issues', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    try {
        const { rows } = await query(`
            SELECT ri.id, ri.issue_type, ri.notes, ri.resolved, ri.resolved_at, ri.resolved_by,
                   ri.created_at,
                   o.display_id, o.id as order_id,
                   ru.name as rider_name, ru.phone as rider_phone,
                   cu.name as customer_name
            FROM rider_issues ri
            JOIN orders o ON ri.order_id = o.id
            JOIN users ru ON ri.rider_id = ru.id
            LEFT JOIN users cu ON o.customer_id = cu.id
            ORDER BY ri.created_at DESC
            LIMIT 200
        `);
        res.json({ issues: rows });
    } catch (err) {
        console.error('[admin/rider-issues]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

router.patch('/rider-issues/:id/resolve', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { id } = req.params;
    const adminId = req.user!.userId;
    try {
        await query(
            `UPDATE rider_issues SET resolved = true, resolved_at = NOW(), resolved_by = $1 WHERE id = $2`,
            [adminId, id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[admin/rider-issues/resolve]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

// ─── Delivered Orders (for POD review) ───────────────────────────────────────
router.get('/orders/delivered', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    try {
        const { rows } = await query(`
            SELECT o.id, o.display_id, o.total_amount_paise, o.payment_method,
                   o.delivered_at, o.pod_photo_url,
                   cu.name as customer_name,
                   ru.name as rider_name, ru.phone as rider_phone,
                   json_agg(json_build_object('menu_item_name', oi.menu_item_name, 'quantity', oi.quantity)) as items
            FROM orders o
            JOIN users cu ON o.customer_id = cu.id
            LEFT JOIN users ru ON o.rider_id = ru.id
            LEFT JOIN order_items oi ON oi.order_id = o.id
            WHERE o.status = 'delivered'
            GROUP BY o.id, cu.name, ru.name, ru.phone
            ORDER BY o.delivered_at DESC
            LIMIT 100
        `);
        res.json({ orders: rows });
    } catch (err) {
        console.error('[admin/orders/delivered]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

router.post('/orders/:id/refund', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const id = req.params.id as string;
    const { reason, amountPaise } = req.body;
    const adminId = req.user!.userId;
    const isSuperAdmin = req.user!.role === 'super_admin';

    try {
        const { rows: orders } = await query(
            'SELECT customer_id, total_amount_paise, display_id, payment_status, gateway_payment_id, created_at FROM orders WHERE id = $1',
            [id]
        );
        if (!orders[0]) return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
        const order = orders[0];

        if (['refunded', 'refund_pending'].includes(order.payment_status)) {
            return res.status(409).json({ error: 'ALREADY_REFUNDED' });
        }

        // 30-day time limit — super_admin can override
        if (!isSuperAdmin) {
            const ageMs = Date.now() - new Date(order.created_at).getTime();
            const ageDays = ageMs / (1000 * 60 * 60 * 24);
            if (ageDays > 30) {
                return res.status(400).json({ error: 'REFUND_WINDOW_EXPIRED', message: 'Refunds can only be issued within 30 days of order. Contact super_admin to override.' });
            }
        }

        const refundAmount = amountPaise || order.total_amount_paise;

        // Queue for finance team — they choose wallet or bank
        const refundId = await createPendingRefund({
            orderId: id,
            customerId: order.customer_id,
            amountPaise: refundAmount,
            reason: reason || 'Admin issued refund',
            initiatedBy: adminId,
            razorpayPaymentId: order.gateway_payment_id || undefined,
        });

        logSystemEvent('ADMIN_REFUND_QUEUED', `Admin ${adminId} queued refund ₹${refundAmount / 100} for Order #${order.display_id}`, 'info', { orderId: id, adminId, reason, refundId });
        res.json({ success: true, message: 'Refund queued for finance team approval.', refundId });
    } catch (err: any) {
        res.status(500).json({ error: 'REFUND_FAILED', message: err.message });
    }
});

router.get('/payouts/pending', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { rows } = await query(`
        SELECT p.*, u.name as rider_name, u.phone as rider_phone
        FROM weekly_payouts p
        JOIN users u ON p.rider_id = u.id
        WHERE p.status = 'pending'
        ORDER BY p.created_at ASC
    `);
    res.json({ payouts: rows });
});

router.post('/payouts/:id/approve', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { id } = req.params;
    const adminId = req.user!.userId;

    await query(`
        UPDATE weekly_payouts 
        SET status = 'paid', 
            approved_by = $1, 
            approved_at = NOW(),
            paid_at = NOW()
        WHERE id = $2 AND status = 'pending'
    `, [adminId, id]);

    res.json({ success: true });
});

router.post('/menu', authenticate, requireRole('super_admin', 'admin'), validate(MenuItemSchema), async (req: AuthRequest, res) => {
    try {
        const { name, zone_id, description, price_paise, category, station, photo_url, available, is_veg, is_egg, is_bestseller, is_new, tags, customization_groups } = req.body;

        const cost_price_paise = req.body.cost_price_paise ?? Math.floor(price_paise * 0.7);

        // Fetch kitchen_id associated with the zone
        const { rows: kitchenRows } = await query('SELECT kitchen_id FROM kitchen_zones WHERE zone_id = $1 LIMIT 1', [zone_id]);
        if (kitchenRows.length === 0) {
            return res.status(400).json({ error: 'No kitchen is assigned to this zone.' });
        }
        const kitchen_id = kitchenRows[0].kitchen_id;

        const { rows } = await query(
            'INSERT INTO menu_items (zone_id, kitchen_id, name, description, price_paise, cost_price_paise, category, station, photo_url, available, is_veg, is_egg, is_bestseller, is_new, tags, customization_groups) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::TEXT[], $16::jsonb) RETURNING *',
            [zone_id, kitchen_id, name, description || null, price_paise, cost_price_paise, category, station || 'hot_section', photo_url || null, available ?? true, is_veg ?? false, is_egg ?? false, is_bestseller ?? false, is_new ?? false, tags ?? [], JSON.stringify(customization_groups || [])]
        );
        
        // Clear menu cache for all zones
        const { rows: zones } = await query('SELECT id FROM zones');
        for (const zone of zones) {
            await redis.del(keys.menu(zone.id));
        }

        emitToAll('menu_updated', { action: 'create', zoneId: rows[0].zone_id });
        res.json({ item: rows[0] });
    } catch (err: any) {
        console.error('Menu item creation failed:', err);
        if (err.constraint === 'menu_items_zone_name_unique' || err.message.includes('menu_items_zone_name_unique')) {
            return res.status(400).json({ error: 'A menu item with this name already exists in this zone. Please use a different name.' });
        }
        res.status(500).json({ error: 'Failed to create menu item: ' + err.message, details: err.message });
    }
});

router.post('/menu/upload', authenticate, requireRole('super_admin', 'admin'), upload.single('image'), async (req: AuthRequest, res) => {
    console.log('UPLOAD REQUEST RECEIVED:', !!req.file);
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        
        console.log('Sending to ImageKit... Size:', req.file.buffer.length);
try {
const response = await imagekit.files.upload({
            file: req.file.buffer.toString('base64'),
            fileName: req.file.originalname,
            folder: '/menu_items'
        } as any);

        console.log('ImageKit upload success:', (response as any).url);
res.json({ url: (response as any).url });
} catch (ikErr) { console.error('IK ERROR', ikErr); throw ikErr; }
    } catch (err: any) {
        console.error('ImageKit upload error:', err);
        res.status(500).json({ error: 'Upload failed', message: err.message });
    }
});

router.delete('/menu/:id', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        await query('DELETE FROM menu_items WHERE id = $1', [id]);
        const { rows: zones } = await query('SELECT id FROM zones');
        for (const zone of zones) {
            await redis.del(keys.menu(zone.id));
        }
        emitToAll('menu_updated', { action: 'delete', id });
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to delete menu item', details: err.message });
    }
});

router.put('/menu/:id', authenticate, requireRole('super_admin', 'admin'), validate(MenuItemSchema.partial()), async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const { zone_id, name, description, price_paise, category, station, photo_url, available, is_veg, is_egg, is_bestseller, is_new, tags, customization_groups } = req.body;

        let kitchen_id = undefined;
        if (zone_id) {
            const { rows: kitchenRows } = await query('SELECT kitchen_id FROM kitchen_zones WHERE zone_id = $1 LIMIT 1', [zone_id]);
            if (kitchenRows.length > 0) {
                kitchen_id = kitchenRows[0].kitchen_id;
            }
        }

        const { rows } = await query(
            `UPDATE menu_items SET
                zone_id = COALESCE($1, zone_id),
                kitchen_id = COALESCE($2, kitchen_id),
                name = COALESCE($3, name),
                description = COALESCE($4, description),
                price_paise = COALESCE($5, price_paise),
                category = COALESCE($6, category),
                station = COALESCE($7, station),
                photo_url = COALESCE($8, photo_url),
                available = COALESCE($9, available),
                is_veg = COALESCE($10, is_veg),
                is_egg = COALESCE($11, is_egg),
                is_bestseller = COALESCE($13, is_bestseller),
                is_new = COALESCE($14, is_new),
                tags = COALESCE($15, tags),
                customization_groups = COALESCE($16::jsonb, customization_groups)
             WHERE id = $12 RETURNING *`,
            [zone_id ?? null, kitchen_id ?? null, name ?? null, description ?? null, price_paise ?? null, category ?? null, station ?? null, photo_url ?? null, available ?? null, is_veg ?? null, is_egg ?? null, id, is_bestseller ?? null, is_new ?? null, tags ?? null, customization_groups ? (() => { console.log('SAVING CUST GROUPS:', JSON.stringify(customization_groups, null, 2)); return JSON.stringify(customization_groups); })() : null]
        );

        // Clear menu cache for all zones
        const { rows: zones } = await query('SELECT id FROM zones');
        for (const zone of zones) {
            await redis.del(keys.menu(zone.id));
        }

        emitToAll('menu_updated', { action: 'update', zoneId: rows[0]?.zone_id });
        res.json({ item: rows[0] });
    } catch (err: any) {
        console.error('Menu item update failed:', err);
        if (err.constraint === 'menu_items_zone_name_unique' || err.message.includes('menu_items_zone_name_unique')) {
            return res.status(400).json({ error: 'A menu item with this name already exists in this zone. Please use a different name.' });
        }
        res.status(500).json({ error: 'Failed to update menu item: ' + err.message, details: err.message });
    }
});

router.get('/users', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const search = (req.query.search as string || '').trim();
    const role = req.query.role as string | undefined;

    const conditions: string[] = [];
    const params: any[] = [];

    if (search) {
        params.push(`%${search}%`);
        conditions.push(`(name ILIKE $${params.length} OR phone ILIKE $${params.length})`);
    }
    if (role) {
        params.push(role);
        conditions.push(`role = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit, offset);

    const { rows } = await query(
        `SELECT id, name, phone, role, is_active, is_online, onboarding_complete, is_verified, created_at
         FROM users ${where}
         ORDER BY created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
    );

    const { rows: countRows } = await query(
        `SELECT COUNT(*) FROM users ${where}`,
        params.slice(0, params.length - 2)
    );

    res.json({ users: rows, total: parseInt(countRows[0].count), limit, offset });
});

router.patch('/users/:id/status', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { is_active } = req.body;
    await query('UPDATE users SET is_active = $1 WHERE id = $2', [is_active, id]);
    res.json({ success: true });
});

// ── POST /admin/wallet/credit ─────────────────────────────────────────────────
// Credit wallet balance to any customer. Admin-only — for refunds, compensation, testing.
// Body: { phone, amountRupees, note? }
router.post('/wallet/credit', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { phone, amountRupees, note } = req.body;
    if (!phone || !amountRupees) return res.status(400).json({ error: 'phone and amountRupees are required' });
    const amountPaise = Math.round(parseFloat(amountRupees) * 100);
    if (amountPaise <= 0) return res.status(400).json({ error: 'amountRupees must be positive' });

    try {
        const cleanPhone = String(phone).replace(/\D/g, '');
        const { rows: users } = await query('SELECT id FROM users WHERE phone = $1 AND role = $2', [cleanPhone, 'customer']);
        if (!users[0]) return res.status(404).json({ error: 'Customer not found' });
        const customerId = users[0].id;

        await query(`
            INSERT INTO customer_wallet (customer_id, balance_paise) VALUES ($1, $2)
            ON CONFLICT (customer_id) DO UPDATE SET balance_paise = customer_wallet.balance_paise + $2
        `, [customerId, amountPaise]);

        const { rows: wallet } = await query('SELECT balance_paise FROM customer_wallet WHERE customer_id = $1', [customerId]);
        await query(`
            INSERT INTO wallet_transactions (customer_id, amount_paise, type, description, balance_after_paise)
            VALUES ($1, $2, 'credit', $3, $4)
        `, [customerId, amountPaise, note || `Admin credit by ${req.user!.userId}`, wallet[0].balance_paise]);

        res.json({ success: true, amountPaise, newBalancePaise: wallet[0].balance_paise });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/inventory', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    try {
        const { rows } = await query('SELECT name, unit, SUM(current_stock_grams) as current_stock_grams, SUM(reorder_threshold_grams) as reorder_threshold_grams FROM ingredients GROUP BY name, unit ORDER BY name');
        // Map to expected frontend format
        const formatted = rows.map(r => ({ ...r, id: r.name, current_stock: r.current_stock_grams, reorder_threshold: r.reorder_threshold_grams }));
        res.json({ ingredients: formatted });
    } catch {
        const { rows } = await query('SELECT * FROM ingredients ORDER BY name');
        res.json({ ingredients: rows });
    }
});

router.post('/inventory', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    try {
        const { name, unit, current_stock, reorder_threshold } = req.body;
        // Try the standard schema first, fall back to grams-based schema
        let rows: any[];
        try {
            const r = await query(
                'INSERT INTO ingredients (name, unit, current_stock, reorder_threshold) VALUES ($1, $2, $3, $4) RETURNING *',
                [name, unit, current_stock ?? 0, reorder_threshold ?? 10]
            );
            rows = r.rows;
        } catch {
            const kitchensRes = await query('SELECT id FROM kitchens');
            rows = [];
            for (const k of kitchensRes.rows) {
                const r = await query(
                    'INSERT INTO ingredients (kitchen_id, name, unit, current_stock_grams, reorder_threshold_grams) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                    [k.id, name, unit, current_stock ?? 0, reorder_threshold ?? 10]
                );
                rows.push(r.rows[0]);
            }
        }
        emitToAdmin('inventory_updated', { type: 'add', ingredient: rows[0] });
        res.json({ ingredient: rows[0] });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to add ingredient', details: err.message });
    }
});

router.patch('/inventory/:id', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const idOrName = decodeURIComponent(req.params.id as string);
    const current_stock = parseInt(String(req.body.current_stock ?? ''), 10);
    if (isNaN(current_stock)) return res.status(400).json({ error: 'INVALID_STOCK', message: 'current_stock must be a number' });
    try {
        // Try updating by name first (since GET returns name as id)
        const { rowCount } = await query('UPDATE ingredients SET current_stock_grams = $1 WHERE name = $2', [current_stock, idOrName]);
        if (rowCount === 0) {
            // Fallback to id if it's an actual UUID
            await query('UPDATE ingredients SET current_stock_grams = $1 WHERE id = $2', [current_stock, idOrName]);
        }
        emitToAdmin('inventory_updated', { type: 'update', id: idOrName, current_stock });
        res.json({ success: true });
    } catch (e) {
        console.error('PATCH /inventory error:', e);
        res.status(500).json({ error: 'Failed to update stock' });
    }
});

// ─── Zone Management ─────────────────────────────────────────────────────────

// ── Offer target search: items / kitchens / categories ────────────────────────
router.get('/offer-targets', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const type = req.query.type as string;
    const q = ((req.query.q as string) || '').toLowerCase().trim();

    try {
        if (type === 'kitchen') {
            const { rows } = await query(
                `SELECT id, name FROM kitchens
                 WHERE ($1 = '' OR LOWER(name) LIKE '%' || $1 || '%')
                 ORDER BY name LIMIT 20`,
                [q]
            );
            return res.json({ results: rows.map(r => ({ id: r.id, name: r.name })) });
        }
        if (type === 'category') {
            const { rows } = await query(
                `SELECT id, name FROM menu_categories
                 WHERE ($1 = '' OR LOWER(name) LIKE '%' || $1 || '%')
                 ORDER BY name LIMIT 20`,
                [q]
            );
            return res.json({ results: rows.map(r => ({ id: r.id, name: r.name })) });
        }
        if (type === 'item') {
            const { rows } = await query(
                `SELECT id, name, category FROM menu_items
                 WHERE ($1 = '' OR LOWER(name) LIKE '%' || $1 || '%')
                 ORDER BY name LIMIT 20`,
                [q]
            );
            return res.json({ results: rows.map(r => ({ id: r.id, name: r.name, sub: r.category })) });
        }
        return res.status(400).json({ error: 'type must be kitchen | category | item' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Search failed' });
    }
});

router.get('/zones', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { rows } = await query(`
        SELECT z.*,
               (SELECT COUNT(*) FROM menu_items m WHERE m.zone_id = z.id AND m.available = true) AS menu_item_count
        FROM zones z ORDER BY z.name
    `);
    res.json({ zones: rows });
});

router.post('/zones', authenticate, requireRole('super_admin', 'admin'), validate(ZoneSchema), async (req: AuthRequest, res) => {
    const { name, city, kitchen_lat, kitchen_lng, radius_km,
            delivery_fee_base_paise, opening_time, closing_time,
            max_orders_per_hour, realistic_delivery_minutes, polygon_points,
            delivery_fee_type, base_delivery_fee_paise, per_km_fee_paise,
            base_distance_km, free_delivery_above_paise, surge_multiplier,
            rider_base_pay_paise, rider_per_km_paise, rider_free_km } = req.body;
    try {
        const { rows } = await query(`
            INSERT INTO zones (name, city, kitchen_lat, kitchen_lng, radius_km,
                delivery_fee_base_paise, opening_time, closing_time,
                max_orders_per_hour, realistic_delivery_minutes, polygon_points,
                delivery_fee_type, base_delivery_fee_paise, per_km_fee_paise,
                base_distance_km, free_delivery_above_paise, surge_multiplier,
                rider_base_pay_paise, rider_per_km_paise, rider_free_km)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
            RETURNING *
        `, [name, city, kitchen_lat, kitchen_lng, radius_km,
            base_delivery_fee_paise ?? delivery_fee_base_paise ?? 2500, opening_time, closing_time,
            max_orders_per_hour, realistic_delivery_minutes,
            polygon_points ? JSON.stringify(polygon_points) : null,
            delivery_fee_type || 'flat',
            base_delivery_fee_paise ?? delivery_fee_base_paise ?? 2500,
            per_km_fee_paise ?? 500,
            base_distance_km ?? 0,
            free_delivery_above_paise ?? null,
            surge_multiplier ?? 1.0,
            rider_base_pay_paise ?? 2000,
            rider_per_km_paise ?? 500,
            rider_free_km ?? 2.0]);
        emitToAll('zone_updated', { action: 'create', zoneId: rows[0].id });
        res.status(201).json({ zone: rows[0] });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to create zone', details: err.message });
    }
});

router.patch('/zones/:id', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const id = req.params.id as string;
    const {
        name, radius_km, delivery_fee_base_paise, surge_fee_paise,
        opening_time, closing_time, max_orders_per_hour, is_active,
        realistic_delivery_minutes, surge_enabled, polygon_points,
        kitchen_lat, kitchen_lng,
        delivery_fee_type, base_delivery_fee_paise, per_km_fee_paise, base_distance_km,
        free_delivery_above_paise, surge_multiplier, surge_expires_at,
        min_order_paise, small_order_fee_paise,
        rider_base_pay_paise, rider_per_km_paise, rider_free_km,
        max_concurrent_orders
    } = req.body;

    // Auto-compute zone center from polygon centroid when polygon changes
    let computedKitchenLat = kitchen_lat;
    let computedKitchenLng = kitchen_lng;
    if (polygon_points && polygon_points.length > 0 && computedKitchenLat == null) {
        computedKitchenLat = polygon_points.reduce((s: number, p: any) => s + p.lat, 0) / polygon_points.length;
        computedKitchenLng = polygon_points.reduce((s: number, p: any) => s + p.lng, 0) / polygon_points.length;
    }

    try {
        const { rows } = await query(`
            UPDATE zones SET
                name = COALESCE($1, name),
                radius_km = COALESCE($2, radius_km),
                delivery_fee_base_paise = COALESCE($3, COALESCE($16, delivery_fee_base_paise)),
                surge_fee_paise = COALESCE($4, surge_fee_paise),
                opening_time = COALESCE($5, opening_time),
                closing_time = COALESCE($6, closing_time),
                max_orders_per_hour = COALESCE($7, max_orders_per_hour),
                is_active = COALESCE($8, is_active),
                realistic_delivery_minutes = COALESCE($9, realistic_delivery_minutes),
                surge_enabled = COALESCE($10, surge_enabled),
                polygon_points = COALESCE($11::jsonb, polygon_points),
                kitchen_lat = COALESCE($13, kitchen_lat),
                kitchen_lng = COALESCE($14, kitchen_lng),
                delivery_fee_type = COALESCE($15, delivery_fee_type),
                base_delivery_fee_paise = COALESCE($16, base_delivery_fee_paise),
                per_km_fee_paise = COALESCE($17, per_km_fee_paise),
                base_distance_km = COALESCE($18, base_distance_km),
                free_delivery_above_paise = COALESCE($19, free_delivery_above_paise),
                surge_multiplier = COALESCE($20, surge_multiplier),
                surge_expires_at = CASE WHEN $27::timestamptz IS NOT NULL THEN $27::timestamptz ELSE surge_expires_at END,
                min_order_paise = COALESCE($21, min_order_paise),
                small_order_fee_paise = COALESCE($22, small_order_fee_paise),
                rider_base_pay_paise = COALESCE($23, rider_base_pay_paise),
                rider_per_km_paise = COALESCE($24, rider_per_km_paise),
                rider_free_km = COALESCE($25, rider_free_km),
                max_concurrent_orders = COALESCE($26, max_concurrent_orders),
                updated_at = NOW()
            WHERE id = $12
            RETURNING *
        `, [name, radius_km, delivery_fee_base_paise, surge_fee_paise,
            opening_time, closing_time, max_orders_per_hour, is_active,
            realistic_delivery_minutes, surge_enabled,
            polygon_points ? JSON.stringify(polygon_points) : null, id,
            computedKitchenLat ?? null, computedKitchenLng ?? null,
            delivery_fee_type ?? null, base_delivery_fee_paise ?? null, per_km_fee_paise ?? null,
            base_distance_km ?? null, free_delivery_above_paise ?? null, surge_multiplier ?? null,
            min_order_paise ?? null, small_order_fee_paise ?? null,
            rider_base_pay_paise ?? null, rider_per_km_paise ?? null, rider_free_km ?? null,
            max_concurrent_orders ?? null, surge_expires_at ?? null]);
        if (rows.length === 0) return res.status(404).json({ error: 'ZONE_NOT_FOUND' });

        // Sync kitchen lat/lng to the new zone center so maps show the correct spot
        if (computedKitchenLat != null) {
            await query(`
                UPDATE kitchens k SET lat = $1, lng = $2, updated_at = NOW()
                FROM kitchen_zones kz WHERE kz.kitchen_id = k.id AND kz.zone_id = $3
            `, [computedKitchenLat, computedKitchenLng, id]);
        }

        await redis.del(keys.menu(id));
        emitToAll('zone_updated', { action: 'update', zoneId: id });
        res.json({ zone: rows[0] });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to update zone', details: err.message });
    }
});


router.delete('/zones/:id', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const id = req.params.id as string;
    try {
        await query('UPDATE users SET zone_id = NULL WHERE zone_id = $1', [id]);
        await query('UPDATE addresses SET zone_id = NULL WHERE zone_id = $1', [id]);
        await query('UPDATE kitchens SET zone_id = NULL WHERE zone_id = $1', [id]);
        await query('DELETE FROM kitchen_zones WHERE zone_id = $1', [id]);
        await query('DELETE FROM delivery_fee_tiers WHERE zone_id = $1', [id]);
        await query('DELETE FROM zones WHERE id = $1', [id]);
        await redis.del(keys.menu(id));
        emitToAll('zone_updated', { action: 'delete', zoneId: id });
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: 'Cannot delete zone. It may be linked to existing orders.', details: err.message });
    }
});

// ─── Delivery Fee Tiers ───────────────────────────────────────────────────────

router.get('/zones/:id/delivery-tiers', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    try {
        const { rows } = await query(
            'SELECT * FROM delivery_fee_tiers WHERE zone_id = $1 ORDER BY from_paise ASC',
            [req.params.id]
        );
        res.json({ tiers: rows });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to fetch tiers' });
    }
});

router.post('/zones/:id/delivery-tiers', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { from_paise, to_paise, fee_paise } = req.body;
    if (from_paise == null || fee_paise == null) {
        return res.status(400).json({ error: 'from_paise and fee_paise are required' });
    }
    try {
        const { rows } = await query(
            `INSERT INTO delivery_fee_tiers (zone_id, from_paise, to_paise, fee_paise)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [req.params.id, from_paise, to_paise ?? null, fee_paise]
        );
        emitToAll('zone_updated', { action: 'tier_create', zoneId: req.params.id });
        res.status(201).json({ tier: rows[0] });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to create tier', details: err.message });
    }
});

router.delete('/zones/:id/delivery-tiers/:tierId', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    try {
        const { rowCount } = await query(
            'DELETE FROM delivery_fee_tiers WHERE id = $1 AND zone_id = $2',
            [req.params.tierId, req.params.id]
        );
        if (rowCount === 0) return res.status(404).json({ error: 'Tier not found' });
        emitToAll('zone_updated', { action: 'tier_delete', zoneId: req.params.id });
        res.json({ message: 'Tier deleted' });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to delete tier' });
    }
});

// ─── Kitchen Management ───────────────────────────────────────────────────────

router.get('/zones/:id/metrics', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { rows } = await query('SELECT * FROM kitchen_metrics WHERE zone_id = $1', [req.params.id]);
    if (rows.length === 0) return res.json({ metrics: null });
    res.json({ metrics: rows[0] });
});

router.put('/zones/:id/metrics', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const id = req.params.id as string;
    const { 
        fssai_status, fssai_valid_till, 
        staff_temp_value, staff_temp_time, 
        sanitization_percent, sanitization_freq, 
        pure_veg_status, pure_veg_audited 
    } = req.body;

    const { rows } = await query(`
        INSERT INTO kitchen_metrics (zone_id, fssai_status, fssai_valid_till, staff_temp_value, staff_temp_time, sanitization_percent, sanitization_freq, pure_veg_status, pure_veg_audited, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        ON CONFLICT (zone_id) DO UPDATE SET
            fssai_status = EXCLUDED.fssai_status,
            fssai_valid_till = EXCLUDED.fssai_valid_till,
            staff_temp_value = EXCLUDED.staff_temp_value,
            staff_temp_time = EXCLUDED.staff_temp_time,
            sanitization_percent = EXCLUDED.sanitization_percent,
            sanitization_freq = EXCLUDED.sanitization_freq,
            pure_veg_status = EXCLUDED.pure_veg_status,
            pure_veg_audited = EXCLUDED.pure_veg_audited,
            updated_at = NOW()
        RETURNING *
    `, [id, fssai_status, fssai_valid_till, staff_temp_value, staff_temp_time, sanitization_percent, sanitization_freq, pure_veg_status, pure_veg_audited]);

    res.json({ metrics: rows[0] });
});

// ─── Kitchens Table Management ────────────────────────────────────────────────

router.get('/kitchens', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { rows } = await query(`
        SELECT k.*,
               COALESCE(json_agg(json_build_object('id', z.id, 'name', z.name)) FILTER (WHERE z.id IS NOT NULL), '[]') as zones
        FROM kitchens k
        LEFT JOIN kitchen_zones kz ON k.id = kz.kitchen_id
        LEFT JOIN zones z ON kz.zone_id = z.id
        GROUP BY k.id
        ORDER BY k.created_at DESC
    `);
    res.json({ kitchens: rows.map(({ pin_hash, ...k }) => ({ ...k, has_pin: !!pin_hash })) });
});

// Kitchen PIN login (auth.ts /auth/kitchen-pin) bcrypt-compares an entered PIN against
// every kitchen's pin_hash and logs into whichever one matches first — two kitchens
// sharing a PIN makes that lookup ambiguous, so PINs must be unique across kitchens.
async function assertPinAvailable(pin: string, excludeKitchenId?: string) {
    const { rows: others } = await query(
        'SELECT pin_hash FROM kitchens WHERE pin_hash IS NOT NULL' + (excludeKitchenId ? ' AND id != $1' : ''),
        excludeKitchenId ? [excludeKitchenId] : []
    );
    for (const other of others) {
        if (await bcrypt.compare(pin, other.pin_hash)) {
            const err: any = new Error('PIN_ALREADY_IN_USE');
            err.status = 409;
            throw err;
        }
    }
}

router.post('/kitchens', authenticate, requireRole('super_admin', 'admin'), validate(KitchenSchema), async (req: AuthRequest, res) => {
    const { name, zone_ids, address, fssai_license, gstin, lat = 12.9716, lng = 77.5946, pin } = req.body;
    if (pin) await assertPinAvailable(pin);
    const pinHash = pin ? await bcrypt.hash(pin, 10) : null;

    const kitchenId = await withTransaction(async (client) => {
        const { rows } = await client.query(`
            INSERT INTO kitchens (name, address, fssai_license, gstin, lat, lng, pin_hash)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
        `, [name, address, fssai_license, gstin, lat, lng, pinHash]);
        const id = rows[0].id;
        if (zone_ids && Array.isArray(zone_ids)) {
            for (const zId of zone_ids) {
                await client.query(
                    'INSERT INTO kitchen_zones (kitchen_id, zone_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [id, zId]
                );
            }
        }
        return id;
    });

    const { rows: updated } = await query(`
        SELECT k.*,
               COALESCE(json_agg(json_build_object('id', z.id, 'name', z.name)) FILTER (WHERE z.id IS NOT NULL), '[]') as zones
        FROM kitchens k
        LEFT JOIN kitchen_zones kz ON k.id = kz.kitchen_id
        LEFT JOIN zones z ON kz.zone_id = z.id
        WHERE k.id = $1
        GROUP BY k.id
    `, [kitchenId]);

    const { pin_hash, ...kitchenOut } = updated[0];
    emitToAll('kitchen_updated', { action: 'create', kitchenId });
    res.status(201).json({ kitchen: { ...kitchenOut, has_pin: !!pin_hash } });
});

router.patch('/kitchens/:id', authenticate, requireRole('super_admin', 'admin'), validate(KitchenSchema.partial()), async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { name, zone_ids, address, fssai_license, gstin, is_paused, lat, lng, pin } = req.body;
    if (pin) await assertPinAvailable(pin, id as string);
    const pinHash = pin ? await bcrypt.hash(pin, 10) : null;

    await withTransaction(async (client) => {
        const { rows } = await client.query(`
            UPDATE kitchens SET
                name = COALESCE($1, name),
                address = COALESCE($2, address),
                fssai_license = COALESCE($3, fssai_license),
                gstin = COALESCE($4, gstin),
                is_paused = COALESCE($5, is_paused),
                lat = COALESCE($7, lat),
                lng = COALESCE($8, lng),
                pin_hash = COALESCE($9, pin_hash)
            WHERE id = $6
            RETURNING id
        `, [name, address, fssai_license, gstin, is_paused, id, lat, lng, pinHash]);

        if (rows.length === 0) {
            const err: any = new Error('NOT_FOUND');
            err.status = 404;
            throw err;
        }

        if (zone_ids !== undefined && Array.isArray(zone_ids)) {
            await client.query('DELETE FROM kitchen_zones WHERE kitchen_id = $1', [id]);
            for (const zId of zone_ids) {
                await client.query(
                    'INSERT INTO kitchen_zones (kitchen_id, zone_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [id, zId]
                );
            }
        }
    });

    const { rows: updated } = await query(`
        SELECT k.*,
               COALESCE(json_agg(json_build_object('id', z.id, 'name', z.name)) FILTER (WHERE z.id IS NOT NULL), '[]') as zones
        FROM kitchens k
        LEFT JOIN kitchen_zones kz ON k.id = kz.kitchen_id
        LEFT JOIN zones z ON kz.zone_id = z.id
        WHERE k.id = $1
        GROUP BY k.id
    `, [id]);

    const { pin_hash, ...kitchenOut } = updated[0];
    emitToAll('kitchen_updated', { action: 'update', kitchenId: id });
    res.json({ kitchen: { ...kitchenOut, has_pin: !!pin_hash } });
});

router.delete('/kitchens/:id', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { id } = req.params;
    try {
        await query("UPDATE users SET kitchen_id = NULL, role = CASE WHEN role IN ('chef', 'kitchen_manager', 'partner_kitchen', 'packer') THEN 'customer'::user_role ELSE role END WHERE kitchen_id = $1", [id]);
        await query('DELETE FROM kitchen_zones WHERE kitchen_id = $1', [id]);
        await query('DELETE FROM kitchens WHERE id = $1', [id]);
        emitToAll('kitchen_updated', { action: 'delete', kitchenId: id });
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to delete kitchen. It may be linked to existing orders.', details: err.message });
    }
});

router.get('/kitchens/:id/staff', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { rows } = await query(
        `SELECT id, name, phone, role, is_online FROM users WHERE kitchen_id = $1 AND role::text IN ('chef', 'packer', 'kitchen_manager') ORDER BY role, name`,
        [id]
    );
    res.json({ staff: rows });
});

router.post('/kitchens/:id/staff', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { phone: rawPhone, name, role: rawRole } = req.body;
    const role = ['chef', 'packer'].includes(rawRole) ? rawRole : 'chef';
    let phone = (rawPhone || '').replace(/\D/g, '');
    if (phone.length === 10) phone = '91' + phone;
    if (!phone || phone.length !== 12) return res.status(400).json({ error: 'INVALID_PHONE', message: 'Enter a valid 10-digit mobile number.' });
    try {
        const { rows: existing } = await query('SELECT id FROM users WHERE phone = $1', [phone]);
        if (existing.length > 0) {
            await query('UPDATE users SET role = $1, kitchen_id = $2, is_active = true WHERE phone = $3', [role, id, phone]);
            emitToAll('kitchen_updated', { action: 'staff_add', kitchenId: id });
            res.json({ success: true, message: `Existing user set as ${role}` });
        } else {
            await query(
                `INSERT INTO users (name, phone, role, kitchen_id, is_active, onboarding_complete) VALUES ($1, $2, $3, $4, true, true)`,
                [name || (role === 'packer' ? 'Packer' : 'Chef'), phone, role, id]
            );
            emitToAll('kitchen_updated', { action: 'staff_add', kitchenId: id });
            res.json({ success: true, message: `New ${role} account created` });
        }
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to add staff', details: err.message });
    }
});

router.delete('/kitchens/:id/staff/:staffId', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { staffId } = req.params;
    try {
        // Demote chef back to customer or remove kitchen_id
        await query('UPDATE users SET role = $1, kitchen_id = NULL WHERE id = $2', ['customer', staffId]);
        emitToAll('kitchen_updated', { action: 'staff_remove', kitchenId: req.params.id });
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to remove staff', details: err.message });
    }
});

router.get('/settings', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { rows } = await query('SELECT * FROM app_settings ORDER BY key');
    res.json({ settings: rows });
});

router.patch('/settings/:key', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { key } = req.params;
    const { value } = req.body;
    await query('UPDATE app_settings SET value = $1 WHERE key = $2', [value, key]);
    redis.del(`2qt:setting:${key}`).catch(() => {}); // bust cached value immediately
    emitToAll('settings_updated', { key, value });
    res.json({ success: true });
});

// ─── System Jobs ─────────────────────────────────────────────────────────────

router.get('/jobs/status', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { invoicesQueue, notificationsQueue } = require('../jobs/queues');
    res.json({
        invoices: await invoicesQueue.count(),
        notifications: await notificationsQueue.count()
    });
});

router.post('/jobs/clear-failed', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { invoicesQueue, notificationsQueue } = require('../jobs/queues');
    await invoicesQueue.clean(0, 0, 'failed');
    await notificationsQueue.clean(0, 0, 'failed');
    res.json({ success: true });
});

// ─── Team Management ──────────────────────────────────────────────────────────

router.get('/team/users', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    try {
        const { rows } = await query(`
            SELECT id, name, phone, email, role, is_active, created_at
            FROM users
            WHERE role::text IN ('finance', 'super_admin', 'admin', 'chef', 'kitchen_manager', 'rider', 'rider_captain', 'dine_in_staff', 'support')
            ORDER BY created_at DESC
        `);
        res.json({ users: rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch team users' });
    }
});

router.post('/team/users', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { phone, name, role, kitchenId } = req.body as { phone: string; name: string; role: string; kitchenId?: string };
    if (!phone || !name || !role) return res.status(400).json({ error: 'phone, name, role required' });
    if (!['finance', 'admin', 'chef', 'kitchen_manager', 'rider', 'partner', 'dine_in_staff', 'support'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
    if (['chef', 'kitchen_manager'].includes(role) && !kitchenId) return res.status(400).json({ error: 'kitchenId required for chef/kitchen_manager' });

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) return res.status(400).json({ error: 'Invalid phone number' });

    try {
        const { rows } = await query(`
            INSERT INTO users (phone, name, role, kitchen_id, is_active, is_verified, onboarding_complete)
            VALUES ($1, $2, $3, $4, true, true, true)
            ON CONFLICT (phone) DO UPDATE
                SET name = EXCLUDED.name, role = EXCLUDED.role, kitchen_id = EXCLUDED.kitchen_id,
                    is_active = true, is_verified = true
            RETURNING id, name, phone, role, kitchen_id, created_at
        `, [cleanPhone, name.trim(), role, kitchenId || null]);
        emitToAdmin('new_user', { user: rows[0] });
        res.json({ success: true, user: rows[0] });
    } catch (err: any) {
        console.error('[admin/team/users POST]', err);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

router.patch('/team/users/:id/deactivate', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { id } = req.params;
    try {
        await query('UPDATE users SET is_active = false WHERE id = $1 AND role NOT IN (\'super_admin\')', [id]);
        emitToAdmin('user_updated', { userId: id, is_active: false });
        emitToUser(id as string, 'user_updated', { is_active: false });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to deactivate user' });
    }
});

// ─── Partner Applications (admin reviews who joins the platform) ──────────────

router.get('/partners/applications', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { status: statusFilter } = req.query as { status?: string };
    try {
        const { rows } = await query(`
            SELECT id, restaurant_name, owner_name, phone, email, address, city,
                   cuisine_type, fssai_number, expected_daily_orders, upi_id,
                   status, rejection_reason, notes, kitchen_id, created_at
            FROM kitchen_applications
            ${statusFilter ? 'WHERE status = $1' : ''}
            ORDER BY CASE status WHEN 'new' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END, created_at DESC
        `, statusFilter ? [statusFilter] : []);
        res.json({ applications: rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch applications' });
    }
});

router.patch('/partners/applications/:id', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { status, rejectionReason, notes } = req.body;
    try {
        // When approving: auto-create the kitchen record (idempotent)
        let kitchenId: string | null = null;
        if (status === 'approved') {
            const { rows: appRows } = await query(
                `SELECT * FROM kitchen_applications WHERE id = $1`, [id]
            );
            if (!appRows.length) return res.status(404).json({ error: 'Application not found' });
            const app = appRows[0];

            if (app.kitchen_id) {
                kitchenId = app.kitchen_id; // already created
            } else {
                const { rows: kRows } = await query(`
                    INSERT INTO kitchens (name, address, fssai_license, contact_phone, contact_email, upi_id,
                                         commission_rate, is_partner, is_active, lat, lng)
                    VALUES ($1, $2, $3, $4, $5, $6, 0.20, TRUE, FALSE, 0, 0)
                    RETURNING id
                `, [app.restaurant_name, app.address || '', app.fssai_number || null,
                    app.phone || null, app.email || null, app.upi_id || null]);
                kitchenId = kRows[0].id;
                await query(`UPDATE kitchen_applications SET kitchen_id = $1 WHERE id = $2`, [kitchenId, id]);

                // Auto-create partner_kitchen user account so they can log in immediately
                await query(`
                    INSERT INTO users (phone, name, role, kitchen_id, is_active, is_verified, onboarding_complete)
                    VALUES ($1, $2, 'partner_kitchen', $3, TRUE, TRUE, TRUE)
                    ON CONFLICT (phone) DO UPDATE
                        SET role = 'partner_kitchen', kitchen_id = $3, is_active = TRUE
                `, [app.phone, app.owner_name || app.restaurant_name, kitchenId]);
            }
        }

        const { rows } = await query(`
            UPDATE kitchen_applications
            SET status = COALESCE($1, status),
                rejection_reason = COALESCE($2, rejection_reason),
                notes = COALESCE($3, notes),
                updated_at = NOW()
            WHERE id = $4
            RETURNING *
        `, [status ?? null, rejectionReason ?? null, notes ?? null, id]);

        emitToAdmin('partner_updated', { action: 'application', applicationId: id, status });
        res.json({ success: true, application: rows[0], kitchen_id: kitchenId });
    } catch (err) {
        console.error('[admin/partners/applications/patch]', err);
        res.status(500).json({ error: 'Failed to update application' });
    }
});

router.get('/partners/kitchens', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    try {
        const { rows } = await query(`
            SELECT k.id, k.name, k.commission_rate, k.upi_id, k.is_partner, k.is_active,
                   k.partner_status, k.partner_notes, k.contact_phone, k.contact_email,
                   k.opening_time, k.closing_time, k.address,
                   COALESCE(
                     (SELECT json_build_object('id', z.id, 'name', z.name)
                      FROM kitchen_zones kz JOIN zones z ON z.id = kz.zone_id
                      WHERE kz.kitchen_id = k.id LIMIT 1),
                     NULL
                   ) AS zone,
                   COALESCE((SELECT SUM(o.kitchen_payout_paise)
                        FROM orders o WHERE o.kitchen_id = k.id AND o.status = 'delivered'), 0) AS lifetime_payout_paise
            FROM kitchens k
            WHERE k.is_partner = TRUE
            ORDER BY k.is_active DESC, k.name
        `);
        res.json({ kitchens: rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch partner kitchens' });
    }
});
router.patch('/partners/kitchens/:id', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { name, commissionRate, upiId, zoneId,
            contactPhone, contactEmail, isActive, partnerNotes, partnerStatus, openingTime, closingTime } = req.body;
    if (partnerStatus && !['approved', 'suspended', 'none'].includes(partnerStatus)) {
        return res.status(400).json({ error: 'INVALID_PARTNER_STATUS' });
    }
    try {
        await withTransaction(async (client) => {
            await client.query(`
                UPDATE kitchens SET
                    name            = COALESCE($1, name),
                    commission_rate = COALESCE($2, commission_rate),
                    upi_id          = COALESCE($3, upi_id),
                    contact_phone   = COALESCE($4, contact_phone),
                    contact_email   = COALESCE($5, contact_email),
                    is_active       = COALESCE($6, is_active),
                    partner_notes   = COALESCE($7, partner_notes),
                    partner_status  = COALESCE($8, partner_status),
                    opening_time    = COALESCE($9, opening_time),
                    closing_time    = COALESCE($10, closing_time),
                    updated_at      = NOW()
                WHERE id = $11
            `, [name ?? null, commissionRate ?? null, upiId ?? null,
                contactPhone ?? null, contactEmail ?? null,
                isActive ?? null, partnerNotes ?? null, partnerStatus ?? null, 
                openingTime ?? null, closingTime ?? null, id]);

            // Zone assignment — replace with single zone (same kitchen_zones table as regular kitchens)
            if (zoneId) {
                await client.query('DELETE FROM kitchen_zones WHERE kitchen_id = $1', [id]);
                await client.query(
                    'INSERT INTO kitchen_zones (kitchen_id, zone_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [id, zoneId]
                );
                // Sync kitchen lat/lng from zone centre
                await client.query(`
                    UPDATE kitchens k SET lat = z.kitchen_lat, lng = z.kitchen_lng, updated_at = NOW()
                    FROM zones z WHERE z.id = $1 AND k.id = $2
                `, [zoneId, id]);
            }
        });

        const { rows } = await query(`
            SELECT k.id, k.name, k.commission_rate, k.upi_id, k.is_active, k.is_partner,
                   k.partner_status, k.partner_notes, k.contact_phone, k.contact_email, k.address,
                   COALESCE(
                     (SELECT json_build_object('id', z.id, 'name', z.name, 'opening_time', z.opening_time, 'closing_time', z.closing_time)
                      FROM kitchen_zones kz JOIN zones z ON z.id = kz.zone_id
                      WHERE kz.kitchen_id = k.id LIMIT 1), NULL
                   ) AS zone
            FROM kitchens k WHERE k.id = $1
        `, [id]);

        emitToAdmin('partner_updated', { action: 'kitchen', kitchenId: id });
        res.json({ success: true, kitchen: rows[0] });
    } catch (err) {
        console.error('[admin/partners/kitchens/patch]', err);
        res.status(500).json({ error: 'Failed to update kitchen' });
    }
});

// ════════════════════════════════════════════════════════════════════════════
// RESTAURANT (TABLE BOOKING) MANAGEMENT
// ════════════════════════════════════════════════════════════════════════════

// ── GET /admin/restaurants ────────────────────────────────────────────────────
router.get('/restaurants', authenticate, requireRole('super_admin', 'admin', 'finance'), async (_req, res) => {
    try {
        const { rows } = await query(`
            SELECT
                rc.id, rc.name, rc.zone_id, rc.cuisine_type, rc.address,
                rc.is_active, rc.commission_percent, rc.gst_percent,
                rc.slot_duration_minutes, rc.deposit_paise, rc.operating_hours, rc.created_at,
                CASE WHEN rc.partner_id IS NULL THEN 'own' ELSE 'partner' END AS restaurant_type,
                z.name AS zone_name,
                u.name AS partner_name, u.phone AS partner_phone,
                (SELECT COUNT(*) FROM restaurant_tables rt WHERE rt.restaurant_id = rc.id AND rt.is_active = true) AS active_tables,
                (SELECT COUNT(*) FROM table_bookings tb
                 WHERE tb.restaurant_id = rc.id
                   AND tb.status NOT IN ('cancelled','no_show')
                   AND DATE(tb.slot_start AT TIME ZONE 'Asia/Kolkata') = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE
                ) AS bookings_today,
                (SELECT COALESCE(SUM(tb.total_paid_paise),0) FROM table_bookings tb
                 WHERE tb.restaurant_id = rc.id AND tb.status = 'completed'
                   AND tb.completed_at >= NOW() - INTERVAL '30 days'
                ) AS revenue_30d_paise
            FROM restaurant_config rc
            JOIN zones z ON z.id = rc.zone_id
            LEFT JOIN users u ON u.id = rc.partner_id
            ORDER BY rc.created_at DESC
        `);
        res.json({ restaurants: rows });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /admin/restaurants/onboard ───────────────────────────────────────────
// One-shot: create partner user + restaurant + tables in a single transaction.
// Body: { partnerPhone, partnerName, zoneId, restaurantName, cuisineType, address,
//         commissionPercent, depositPaise, gstPercent, slotDurationMinutes,
//         operatingHours, tables: [{tableNumber, capacity}] }
router.post('/restaurants/onboard', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    const {
        partnerPhone, partnerName,
        zoneId, restaurantName, cuisineType, address, lat, lng,
        commissionPercent = 15, depositPaise = 20000, gstPercent = 5,
        slotDurationMinutes = 90, advanceBookingDays = 7,
        cancellationWindowMinutes = 120, maxPartySize = 10,
        operatingHours = {}, upiId,
        tables = [],
    } = req.body;

    if (!partnerPhone || !partnerName || !zoneId || !restaurantName) {
        return res.status(400).json({ error: 'partnerPhone, partnerName, zoneId, restaurantName are required' });
    }
    const cleanPhone = partnerPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) return res.status(400).json({ error: 'Invalid partnerPhone' });

    try {
        const result = await withTransaction(async (client) => {
            // 1. Create / upsert partner user
            const { rows: userRows } = await client.query(`
                INSERT INTO users (phone, name, role, is_active, is_verified, onboarding_complete)
                VALUES ($1, $2, 'partner', true, true, true)
                ON CONFLICT (phone) DO UPDATE
                    SET name = EXCLUDED.name, role = 'partner', is_active = true, is_verified = true
                RETURNING id, name, phone, role
            `, [cleanPhone, partnerName.trim()]);
            const partner = userRows[0];

            // 2. Create restaurant linked to partner
            const { rows: restRows } = await client.query(`
                INSERT INTO restaurant_config
                    (zone_id, name, cuisine_type, address, lat, lng,
                     operating_hours, slot_duration_minutes, advance_booking_days,
                     cancellation_window_minutes, deposit_paise, max_party_size,
                     gst_percent, commission_percent, partner_id, upi_id)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
                RETURNING id, name
            `, [
                zoneId, restaurantName, cuisineType || null, address || null,
                lat || null, lng || null, operatingHours,
                slotDurationMinutes, advanceBookingDays, cancellationWindowMinutes,
                depositPaise, maxPartySize, gstPercent, commissionPercent,
                partner.id, upiId || null,
            ]);
            const restaurant = restRows[0];

            // 3. Add tables if provided
            const addedTables = [];
            for (const t of tables) {
                const { rows: tRows } = await client.query(`
                    INSERT INTO restaurant_tables (restaurant_id, table_number, capacity)
                    VALUES ($1,$2,$3) RETURNING *
                `, [restaurant.id, t.tableNumber, t.capacity]);
                addedTables.push(tRows[0]);
            }

            return { partner, restaurant, tables: addedTables };
        });

        emitToAdmin('restaurant_created', { restaurantId: result.restaurant.id, name: result.restaurant.name });
        res.status(201).json({
            success: true,
            partner: result.partner,
            restaurant: result.restaurant,
            tables: result.tables,
            loginInstruction: `Give the partner their phone number: ${cleanPhone}. They log in via OTP — no password needed.`,
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /admin/restaurants ────────────────────────────────────────────────────
router.post('/restaurants', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    const {
        zoneId, name, description, cuisineType, address, lat, lng, photos,
        operatingHours, slotDurationMinutes, advanceBookingDays,
        cancellationWindowMinutes, depositPaise, maxPartySize,
        gstPercent, commissionPercent, partnerId, upiId,
    } = req.body;

    if (!zoneId || !name) return res.status(400).json({ error: 'zoneId and name are required' });

    try {
        const { rows } = await query(`
            INSERT INTO restaurant_config
                (zone_id, name, description, cuisine_type, address, lat, lng, photos,
                 operating_hours, slot_duration_minutes, advance_booking_days,
                 cancellation_window_minutes, deposit_paise, max_party_size,
                 gst_percent, commission_percent, partner_id, upi_id)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
            RETURNING id, name, created_at
        `, [
            zoneId, name, description || null, cuisineType || null, address || null,
            lat || null, lng || null, photos || [], operatingHours || {},
            slotDurationMinutes || 90, advanceBookingDays || 7,
            cancellationWindowMinutes || 120, depositPaise || 0, maxPartySize || 10,
            gstPercent || 5.00, commissionPercent || 15.00,
            partnerId || null, upiId || null,
        ]);

        emitToAdmin('restaurant_created', { restaurantId: rows[0].id, name: rows[0].name });
        res.status(201).json({ restaurant: rows[0] });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── PUT /admin/restaurants/:id ────────────────────────────────────────────────
router.put('/restaurants/:id', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    const { id } = req.params;
    const {
        zoneId, name, description, cuisineType, address, lat, lng, photos, operatingHours,
        slotDurationMinutes, advanceBookingDays, cancellationWindowMinutes,
        depositPaise, maxPartySize, gstPercent, commissionPercent, upiId, isActive,
    } = req.body;

    // photos column is text[] — serialize each object to a JSON string so it round-trips cleanly
    const photosParam = photos
        ? (photos as any[]).map((p: any) => typeof p === 'string' ? p : JSON.stringify(p))
        : undefined;

    try {
        const { rows } = await query(`
            UPDATE restaurant_config SET
                zone_id                     = COALESCE($2, zone_id),
                name                        = COALESCE($3, name),
                description                 = COALESCE($4, description),
                cuisine_type                = COALESCE($5, cuisine_type),
                address                     = COALESCE($6, address),
                lat                         = COALESCE($7, lat),
                lng                         = COALESCE($8, lng),
                photos                      = COALESCE($9, photos),
                operating_hours             = COALESCE($10, operating_hours),
                slot_duration_minutes       = COALESCE($11, slot_duration_minutes),
                advance_booking_days        = COALESCE($12, advance_booking_days),
                cancellation_window_minutes = COALESCE($13, cancellation_window_minutes),
                deposit_paise               = COALESCE($14, deposit_paise),
                max_party_size              = COALESCE($15, max_party_size),
                gst_percent                 = COALESCE($16, gst_percent),
                commission_percent          = COALESCE($17, commission_percent),
                upi_id                      = COALESCE($18, upi_id),
                is_active                   = COALESCE($19, is_active),
                updated_at                  = NOW()
            WHERE id = $1
            RETURNING id, name, is_active
        `, [id, zoneId, name, description, cuisineType, address, lat, lng, photosParam, operatingHours,
            slotDurationMinutes, advanceBookingDays, cancellationWindowMinutes,
            depositPaise, maxPartySize, gstPercent, commissionPercent, upiId, isActive]);

        if (!rows[0]) return res.status(404).json({ error: 'NOT_FOUND' });
        emitToAdmin('restaurant_updated', { restaurantId: rows[0].id, name: rows[0].name, isActive: rows[0].is_active });
        res.json({ restaurant: rows[0] });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /admin/restaurants/:id ────────────────────────────────────────────────
router.get('/restaurants/:id', authenticate, requireRole('super_admin', 'admin', 'finance'), async (req, res) => {
    try {
        const { rows } = await query(`
            SELECT rc.*, z.name AS zone_name, u.name AS partner_name, u.phone AS partner_phone,
                   CASE WHEN rc.partner_id IS NULL THEN 'own' ELSE 'partner' END AS restaurant_type
            FROM restaurant_config rc
            JOIN zones z ON z.id = rc.zone_id
            LEFT JOIN users u ON u.id = rc.partner_id
            WHERE rc.id = $1
        `, [req.params.id]);
        if (!rows[0]) return res.status(404).json({ error: 'NOT_FOUND' });
        res.json({ restaurant: rows[0] });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /admin/restaurants/:id/tables ─────────────────────────────────────────
router.get('/restaurants/:id/tables', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    try {
        const { rows } = await query(
            'SELECT * FROM restaurant_tables WHERE restaurant_id = $1 ORDER BY table_number',
            [req.params.id]
        );
        res.json({ tables: rows });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /admin/restaurants/:id/tables ────────────────────────────────────────
router.post('/restaurants/:id/tables', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    const { tableNumber, capacity } = req.body;
    if (!tableNumber || !capacity) return res.status(400).json({ error: 'tableNumber and capacity required' });

    try {
        const { rows } = await query(`
            INSERT INTO restaurant_tables (restaurant_id, table_number, capacity)
            VALUES ($1,$2,$3) RETURNING *
        `, [req.params.id, tableNumber, capacity]);
        res.status(201).json({ table: rows[0] });
    } catch (err: any) {
        if (err.code === '23505') return res.status(409).json({ error: 'TABLE_NUMBER_EXISTS' });
        res.status(500).json({ error: err.message });
    }
});

// ── PUT /admin/restaurants/:id/tables/:tableId ────────────────────────────────
router.put('/restaurants/:id/tables/:tableId', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    const { tableId } = req.params;
    const { tableNumber, capacity, isActive } = req.body;
    try {
        const { rows } = await query(`
            UPDATE restaurant_tables SET
                table_number = COALESCE($3, table_number),
                capacity     = COALESCE($4, capacity),
                is_active    = COALESCE($5, is_active)
            WHERE id = $1 AND restaurant_id = $2
            RETURNING *
        `, [tableId, req.params.id, tableNumber, capacity, isActive]);
        if (!rows[0]) return res.status(404).json({ error: 'NOT_FOUND' });
        res.json({ table: rows[0] });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── DELETE /admin/restaurants/:id/tables/:tableId ─────────────────────────────
router.delete('/restaurants/:id/tables/:tableId', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    const { tableId } = req.params;
    try {
        const { rowCount } = await query('DELETE FROM restaurant_tables WHERE id = $1 AND restaurant_id = $2', [tableId, req.params.id]);
        if (rowCount === 0) return res.status(404).json({ error: 'NOT_FOUND' });
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /admin/restaurants/:id/menu ───────────────────────────────────────────
router.get('/restaurants/:id/menu', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    try {
        const { rows } = await query(
            'SELECT * FROM restaurant_menu_items WHERE restaurant_id = $1 ORDER BY category, sort_order, name',
            [req.params.id]
        );
        res.json({ items: rows });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /admin/restaurants/:id/menu ──────────────────────────────────────────
router.post('/restaurants/:id/menu', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    const { name, description, pricePaise, category, imageUrl, isVeg, sortOrder } = req.body;
    if (!name || !pricePaise) return res.status(400).json({ error: 'name and pricePaise required' });
    try {
        const { rows } = await query(`
            INSERT INTO restaurant_menu_items
                (restaurant_id, name, description, price_paise, category, image_url, is_veg, sort_order)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
        `, [req.params.id, name, description || null, pricePaise, category || null, imageUrl || null, isVeg !== false, sortOrder || 0]);
        res.status(201).json({ item: rows[0] });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /admin/restaurants/:id/bookings ───────────────────────────────────────
router.get('/restaurants/:id/bookings', authenticate, requireRole('super_admin', 'admin', 'finance'), async (req, res) => {
    const { date, status } = req.query as { date?: string; status?: string };
    try {
        const params: any[] = [req.params.id];
        let dateFilter = '';
        let statusFilter = '';
        if (date) { params.push(date); dateFilter = `AND DATE(tb.slot_start AT TIME ZONE 'Asia/Kolkata') = $${params.length}`; }
        if (status) { params.push(status); statusFilter = `AND tb.status = $${params.length}`; }

        const { rows } = await query(`
            SELECT tb.id, tb.display_id, tb.status, tb.party_size,
                   tb.slot_start, tb.slot_end, tb.occasion, tb.special_requests,
                   tb.pre_order_amount_paise, tb.post_order_amount_paise,
                   tb.gst_amount_paise, tb.total_paid_paise, tb.final_payment_method,
                   tb.seated_at, tb.completed_at, tb.cancelled_at,
                   u.name AS customer_name, u.phone AS customer_phone,
                   rt.table_number,
                   COALESCE(items.list, '[]') AS items
            FROM table_bookings tb
            JOIN users u ON u.id = tb.customer_id
            LEFT JOIN restaurant_tables rt ON rt.id = tb.table_id
            LEFT JOIN LATERAL (
                SELECT json_agg(json_build_object(
                    'name', tbi.menu_item_name, 'quantity', tbi.quantity,
                    'type', tbi.type, 'status', tbi.status
                ) ORDER BY tbi.ordered_at) AS list
                FROM table_booking_items tbi WHERE tbi.booking_id = tb.id
            ) items ON true
            WHERE tb.restaurant_id = $1 ${dateFilter} ${statusFilter}
            ORDER BY tb.slot_start DESC LIMIT 200
        `, params);
        res.json({ bookings: rows });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /admin/restaurants/:id/staff ─────────────────────────────────────────
// List all dine-in staff assigned to a restaurant.
router.get('/restaurants/:id/staff', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    try {
        const { rows } = await query(`
            SELECT id, name, phone, role, created_at
            FROM users
            WHERE dine_in_restaurant_id = $1 AND role = 'dine_in_staff'
            ORDER BY name ASC
        `, [req.params.id]);
        res.json({ staff: rows });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /admin/restaurants/:id/staff ────────────────────────────────────────
// Add a dine-in staff member by phone number.
// Creates the user if they don't exist, then assigns them to this restaurant.
router.post('/restaurants/:id/staff', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    const { phone, name } = req.body as { phone: string; name: string };
    if (!phone || !/^\d{10}$/.test(phone.replace(/\s/g, ''))) {
        return res.status(400).json({ error: 'Valid 10-digit phone number required' });
    }
    const cleanPhone = phone.replace(/\s/g, '');
    try {
        // Upsert user — create if not found, then assign role + restaurant
        const { rows } = await query(`
            INSERT INTO users (phone, name, role, dine_in_restaurant_id, is_active)
            VALUES ($1, $2, 'dine_in_staff', $3, true)
            ON CONFLICT (phone) DO UPDATE
              SET role = 'dine_in_staff',
                  dine_in_restaurant_id = $3,
                  name = COALESCE(NULLIF($2, ''), users.name),
                  is_active = true
            RETURNING id, name, phone, role
        `, [cleanPhone, name || '', req.params.id]);
        // Invalidate auth cache so the new role takes effect immediately
        const { invalidateUserCache } = require('../middleware/auth');
        invalidateUserCache(rows[0].id);
        res.json({ staff: rows[0] });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── DELETE /admin/restaurants/:id/staff/:userId ───────────────────────────────
// Remove a dine-in staff member from the restaurant (reverts to customer role).
router.delete('/restaurants/:id/staff/:userId', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    try {
        await query(`
            UPDATE users
            SET role = 'customer', dine_in_restaurant_id = NULL
            WHERE id = $1 AND dine_in_restaurant_id = $2 AND role = 'dine_in_staff'
        `, [req.params.userId, req.params.id]);
        const { invalidateUserCache } = require('../middleware/auth');
        invalidateUserCache(req.params.userId);
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
