import { Router, Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { query, withTransaction } from '../db';
import { redis, keys } from '../redis';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { emitToUser, emitToAdmin } from '../socket';
import { notificationsQueue } from '../jobs/queues';
import { logSystemEvent } from '../utils/logger';
import ImageKit from '@imagekit/nodejs';
import multer from 'multer';

const validate = (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', issues: result.error.flatten().fieldErrors });
    }
    req.body = result.data;
    next();
};

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
});

const KitchenSchema = z.object({
    name: z.string().min(1).max(120),
    zone_ids: z.array(z.string().uuid()).min(1, 'At least one zone is required'),
    address: z.string().max(300).optional(),
    fssai_license: z.string().max(20).optional(),
    gstin: z.string().max(20).optional(),
    lat: z.number().optional().default(12.9716),
    lng: z.number().optional().default(77.5946),
    is_active: z.boolean().optional(),
});

const ZoneSchema = z.object({
    name: z.string().min(1).max(80),
    city: z.string().default('Bengaluru'),
    kitchen_lat: z.number(),
    kitchen_lng: z.number(),
    radius_km: z.number().nonnegative().optional().default(4),
    delivery_fee_base_paise: z.number().int().nonnegative().optional().default(2500),
    opening_time: z.string().regex(/^\d{2}:\d{2}$/).optional().default('10:00'),
    closing_time: z.string().regex(/^\d{2}:\d{2}$/).optional().default('22:00'),
    max_orders_per_hour: z.number().int().positive().optional().default(60),
    realistic_delivery_minutes: z.number().int().positive().optional().default(30),
    polygon_points: z.array(z.object({ lat: z.number(), lng: z.number() })).optional().nullable(),
});

const imagekit = new ImageKit({
  // @ts-ignore
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY!,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY!,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT!
});

const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

router.get('/dashboard', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    try {
        const { rows: activeOrders } = await query('SELECT count(*) FROM orders WHERE status NOT IN (\'delivered\', \'cancelled\')');
        const { rows: revenue } = await query('SELECT sum(total_amount_paise) FROM orders WHERE payment_status = \'paid\' AND created_at >= CURRENT_DATE');
        const { rows: ridersOnline } = await query('SELECT count(*) FROM users WHERE role = \'rider\' AND is_online = true');
        const { rows: lowStock } = await query('SELECT count(*) FROM ingredients WHERE current_stock_grams <= reorder_threshold_grams');

        res.json({
            activeOrders: parseInt(activeOrders[0].count),
            todayRevenuePaise: parseInt(revenue[0].sum || '0'),
            ridersOnline: parseInt(ridersOnline[0].count),
            lowStockAlerts: parseInt(lowStock[0].count)
        });
    } catch (err: any) {
        console.error('Dashboard Error:', err);
        res.status(500).json({ error: 'Failed to load dashboard' });
    }
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
    res.json({ success: true });
});

router.post('/broadcast', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { title, message, target, zoneId, segment, imageUrl, scheduledFor } = req.body;
    
    // 1. Fetch target users
    let queryStr = 'SELECT DISTINCT phone FROM users WHERE is_active = true';
    let baseWhere = 'u.is_active = true';
    const params: any[] = [];
    
    // Build Segmentation
    let segmentCondition = '';
    if (segment === 'inactive_30_days') {
        segmentCondition = " AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = u.id AND o.created_at > NOW() - INTERVAL '30 days')";
    } else if (segment === 'high_rollers') {
        segmentCondition = " AND (SELECT COALESCE(SUM(total_amount_paise), 0) FROM orders o WHERE o.customer_id = u.id AND o.status = 'delivered') > 500000";
    }

    if (target === 'riders') {
        queryStr = 'SELECT DISTINCT u.phone FROM users u WHERE u.is_active = true AND u.role = $1';
        params.push('rider');
        if (zoneId) {
            queryStr += ` AND u.zone_id = $${params.push(zoneId)}`;
        }
    } else if (target === 'customers') {
        if (zoneId) {
            queryStr = `SELECT DISTINCT u.phone FROM users u JOIN addresses a ON u.id = a.customer_id WHERE u.is_active = true AND u.role = $1 AND a.zone_id = $2${segmentCondition}`;
            params.push('customer', zoneId);
        } else {
            queryStr = `SELECT DISTINCT u.phone FROM users u WHERE u.is_active = true AND u.role = $1${segmentCondition}`;
            params.push('customer');
        }
    } else {
        // all
        if (zoneId) {
            queryStr = `
                SELECT DISTINCT u.phone FROM users u 
                LEFT JOIN addresses a ON u.id = a.customer_id 
                WHERE u.is_active = true 
                AND (u.zone_id = $1 OR a.zone_id = $1)${segmentCondition}
            `;
            params.push(zoneId);
        } else {
            queryStr = `SELECT DISTINCT u.phone FROM users u WHERE u.is_active = true${segmentCondition}`;
        }
    }

    const { rows } = await query(queryStr, params);

    // Track Campaign in DB
    const status = scheduledFor && new Date(scheduledFor).getTime() > Date.now() ? 'scheduled' : 'completed';
    await query(
        `INSERT INTO marketing_campaigns (title, message, image_url, target_audience, zone_id, segment, scheduled_for, queued_count, status) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [title, message, imageUrl || null, target, zoneId || null, segment || null, scheduledFor || null, rows.length, status]
    );

    // Calculate delay if scheduled
    let delay = 0;
    if (scheduledFor) {
        const ms = new Date(scheduledFor).getTime() - Date.now();
        if (ms > 0) delay = ms;
    }

    // 2. Queue notifications
    for (const user of rows) {
        await notificationsQueue.add('broadcast_message', {
            phone: user.phone,
            message: `${title}\n\n${message}`,
            imageUrl: imageUrl || undefined
        }, { delay });
    }

    console.log(`[ADMIN] Broadcast queued for ${rows.length} users (target: ${target}, segment: ${segment}): ${title}`);
    res.json({ success: true, count: rows.length });
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
        await notificationsQueue.add('rider_verified', {
            phone: rows[0].phone,
            name: rows[0].name
        });
    }

    emitToUser(id, 'user_updated', { is_verified: true, is_active: true });

    res.json({ success: true });
});

router.get('/rider-applications', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { rows } = await query(`
        SELECT a.*, u.name, u.phone 
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
                await client.query('UPDATE users SET role = \'rider\', is_verified = true, is_active = true WHERE id = $1', [userId]);
                emitToUser(userId, 'user_updated', { role: 'rider', is_verified: true, is_active: true });
                
                const { rows: uRows } = await client.query('SELECT phone, name FROM users WHERE id = $1', [userId]);
                if (uRows[0]?.phone) {
                    await notificationsQueue.add('rider_verified', { phone: uRows[0].phone, name: uRows[0].name });
                }
            }
        });

        res.json({ success: true, action });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/riders', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { rows: riders } = await query(`
        SELECT u.id, u.name, u.phone, u.is_online, u.current_order_id, o.display_id as active_order_display_id
        FROM users u
        LEFT JOIN orders o ON u.current_order_id = o.id
        WHERE u.role = 'rider'
    `);

    const locations = await Promise.all(
        riders.map(r => redis.get(keys.riderLocation(r.id)))
    );
    locations.forEach((loc, i) => {
        if (loc) riders[i].location = JSON.parse(loc);
    });

    res.json({ riders });
});

router.post('/orders/:id/assign', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { riderId } = req.body;
    if (!riderId) return res.status(400).json({ error: 'MISSING_RIDER_ID' });
    await query('UPDATE orders SET rider_id = $1, status = \'out_for_delivery\' WHERE id = $2', [riderId, id]);
    res.json({ success: true });
});

router.patch('/orders/:id/status', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = ['confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'INVALID_STATUS' });
    await query('UPDATE orders SET status = $1 WHERE id = $2', [status, id]);
    res.json({ success: true });
});

router.post('/riders/:id/verify', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const id = req.params.id as string;
    await query('UPDATE users SET is_verified = true, is_active = true WHERE id = $1', [id]);
    emitToUser(id, 'user_updated', { is_verified: true, is_active: true });
    res.json({ success: true });
});

router.post('/orders/:id/refund', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { reason, amountPaise } = req.body; // Partial or full
    const adminId = req.user!.userId;

    try {
        await withTransaction(async (client) => {
            // 1. Get order details
            const { rows: orders } = await client.query('SELECT customer_id, total_amount_paise, display_id FROM orders WHERE id = $1', [id]);
            if (orders.length === 0) throw new Error('ORDER_NOT_FOUND');
            const order = orders[0];
            const refundAmount = amountPaise || order.total_amount_paise;

            // 2. Credit Wallet
            await client.query(`
                INSERT INTO customer_wallet (customer_id, balance_paise)
                VALUES ($1, $2)
                ON CONFLICT (customer_id) DO UPDATE SET balance_paise = customer_wallet.balance_paise + $2
            `, [order.customer_id, refundAmount]);

            // 3. Log Transaction
            await client.query(`
                INSERT INTO wallet_transactions (customer_id, amount_paise, type, description, balance_after_paise)
                SELECT $1, $2, 'credit', 'Admin Refund: ' || $3, balance_paise
                FROM customer_wallet WHERE customer_id = $1
            `, [order.customer_id, refundAmount, reason || 'Service Issue']);

            // 4. Update Order
            await client.query("UPDATE orders SET payment_status = 'refunded', cancellation_reason = $1 WHERE id = $2", [reason, id]);

            // 5. SYSTEMATIC INTEGRATION: Audit Logging
            logSystemEvent('ADMIN_REFUND', `Admin ${adminId} refunded ₹${refundAmount/100} for Order #${order.display_id}`, 'info', { orderId: id, adminId, reason });
            
            // 6. Notify User
            emitToUser(order.customer_id, 'wallet_updated', { balancePaise: refundAmount });
            await notificationsQueue.add('broadcast_message', {
                phone: (await query('SELECT phone FROM users WHERE id = $1', [order.customer_id])).rows[0]?.phone,
                message: `2QT: A refund of ₹${refundAmount/100} has been credited to your wallet for Order #${order.display_id}. We apologize for the inconvenience!`
            });
        });

        res.json({ success: true, message: 'Refund processed systematically.' });
    } catch (err: any) {
        res.status(400).json({ error: 'REFUND_FAILED', message: err.message });
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
        const { name, zone_id, description, price_paise, category, station, photo_url, available, is_veg } = req.body;
        
        const cost_price_paise = req.body.cost_price_paise ?? Math.floor(price_paise * 0.7);

        // Fetch kitchen_id associated with the zone
        const { rows: kitchenRows } = await query('SELECT kitchen_id FROM kitchen_zones WHERE zone_id = $1 LIMIT 1', [zone_id]);
        if (kitchenRows.length === 0) {
            return res.status(400).json({ error: 'No kitchen is assigned to this zone.' });
        }
        const kitchen_id = kitchenRows[0].kitchen_id;

        const { rows } = await query(
            'INSERT INTO menu_items (zone_id, kitchen_id, name, description, price_paise, cost_price_paise, category, station, photo_url, available, is_veg) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *',
            [zone_id, kitchen_id, name, description || null, price_paise, cost_price_paise, category, station || 'hot_section', photo_url || null, available ?? true, is_veg ?? false]
        );
        
        // Clear menu cache for all zones
        const { rows: zones } = await query('SELECT id FROM zones');
        for (const zone of zones) {
            await redis.del(keys.menu(zone.id));
        }

        res.json({ item: rows[0] });
    } catch (err: any) {
        console.error('Menu item creation failed:', err);
        res.status(500).json({ error: 'Failed to create menu item', details: err.message });
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
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to delete menu item', details: err.message });
    }
});

router.put('/menu/:id', authenticate, requireRole('super_admin', 'admin'), validate(MenuItemSchema.partial()), async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const { zone_id, name, description, price_paise, category, station, photo_url, available, is_veg } = req.body;
        
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
                is_veg = COALESCE($10, is_veg)
             WHERE id = $11 RETURNING *`,
            [zone_id ?? null, kitchen_id ?? null, name ?? null, description ?? null, price_paise ?? null, category ?? null, station ?? null, photo_url ?? null, available ?? null, is_veg ?? null, id]
        );

        // Clear menu cache for all zones
        const { rows: zones } = await query('SELECT id FROM zones');
        for (const zone of zones) {
            await redis.del(keys.menu(zone.id));
        }

        res.json({ item: rows[0] });
    } catch (err: any) {
        console.error('Menu item update failed:', err);
        res.status(500).json({ error: 'Failed to update menu item', details: err.message });
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
        `SELECT id, name, phone, role, is_active, is_online, onboarding_complete, created_at
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
        res.json({ ingredient: rows[0] });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to add ingredient', details: err.message });
    }
});

router.patch('/inventory/:id', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const idOrName = decodeURIComponent(req.params.id as string);
    const current_stock = parseInt(req.body.current_stock as any, 10);
    try {
        // Try updating by name first (since GET returns name as id)
        const { rowCount } = await query('UPDATE ingredients SET current_stock_grams = $1 WHERE name = $2', [current_stock, idOrName]);
        if (rowCount === 0) {
            // Fallback to id if it's an actual UUID
            await query('UPDATE ingredients SET current_stock_grams = $1 WHERE id = $2', [current_stock, idOrName]);
        }
        res.json({ success: true });
    } catch (e) {
        console.error('PATCH /inventory error:', e);
        res.status(500).json({ error: 'Failed to update stock' });
    }
});

// ─── Zone Management ─────────────────────────────────────────────────────────

router.get('/zones', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { rows } = await query('SELECT * FROM zones ORDER BY name');
    res.json({ zones: rows });
});

router.post('/zones', authenticate, requireRole('super_admin', 'admin'), validate(ZoneSchema), async (req: AuthRequest, res) => {
    const { name, city, kitchen_lat, kitchen_lng, radius_km,
            delivery_fee_base_paise, opening_time, closing_time,
            max_orders_per_hour, realistic_delivery_minutes, polygon_points } = req.body;
    try {
        const { rows } = await query(`
            INSERT INTO zones (name, city, kitchen_lat, kitchen_lng, radius_km,
                delivery_fee_base_paise, opening_time, closing_time,
                max_orders_per_hour, realistic_delivery_minutes, polygon_points)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
        `, [name, city, kitchen_lat, kitchen_lng, radius_km,
            delivery_fee_base_paise, opening_time, closing_time,
            max_orders_per_hour, realistic_delivery_minutes,
            polygon_points ? JSON.stringify(polygon_points) : null]);
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
        realistic_delivery_minutes, surge_enabled, polygon_points
    } = req.body;
    try {
        const { rows } = await query(`
            UPDATE zones SET
                name = COALESCE($1, name),
                radius_km = COALESCE($2, radius_km),
                delivery_fee_base_paise = COALESCE($3, delivery_fee_base_paise),
                surge_fee_paise = COALESCE($4, surge_fee_paise),
                opening_time = COALESCE($5, opening_time),
                closing_time = COALESCE($6, closing_time),
                max_orders_per_hour = COALESCE($7, max_orders_per_hour),
                is_active = COALESCE($8, is_active),
                realistic_delivery_minutes = COALESCE($9, realistic_delivery_minutes),
                surge_enabled = COALESCE($10, surge_enabled),
                polygon_points = COALESCE($11, polygon_points),
                updated_at = NOW()
            WHERE id = $12
            RETURNING *
        `, [name, radius_km, delivery_fee_base_paise, surge_fee_paise,
            opening_time, closing_time, max_orders_per_hour, is_active,
            realistic_delivery_minutes, surge_enabled, 
            polygon_points ? JSON.stringify(polygon_points) : null, id]);
        if (rows.length === 0) return res.status(404).json({ error: 'ZONE_NOT_FOUND' });
        // Clear menu cache for this zone
        await redis.del(keys.menu(id));
        res.json({ zone: rows[0] });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to update zone', details: err.message });
    }
});

router.delete('/zones/:id', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const id = req.params.id as string;
    try {
        await query('DELETE FROM zones WHERE id = $1', [id]);
        await redis.del(keys.menu(id));
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: 'Cannot delete zone. It may be linked to existing orders or users.', details: err.message });
    }
});

// ─── Kitchen Management ───────────────────────────────────────────────────────

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
    res.json({ kitchens: rows });
});

router.post('/kitchens', authenticate, requireRole('super_admin', 'admin'), validate(KitchenSchema), async (req: AuthRequest, res) => {
    const { name, zone_ids, address, fssai_license, gstin, lat = 12.9716, lng = 77.5946 } = req.body;

    const kitchenId = await withTransaction(async (client) => {
        const { rows } = await client.query(`
            INSERT INTO kitchens (name, address, fssai_license, gstin, lat, lng)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        `, [name, address, fssai_license, gstin, lat, lng]);
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

    res.status(201).json({ kitchen: updated[0] });
});

router.patch('/kitchens/:id', authenticate, requireRole('super_admin', 'admin'), validate(KitchenSchema.partial()), async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { name, zone_ids, address, fssai_license, gstin, is_active, lat, lng } = req.body;

    await withTransaction(async (client) => {
        const { rows } = await client.query(`
            UPDATE kitchens SET
                name = COALESCE($1, name),
                address = COALESCE($2, address),
                fssai_license = COALESCE($3, fssai_license),
                gstin = COALESCE($4, gstin),
                is_active = COALESCE($5, is_active),
                lat = COALESCE($7, lat),
                lng = COALESCE($8, lng)
            WHERE id = $6
            RETURNING id
        `, [name, address, fssai_license, gstin, is_active, id, lat, lng]);

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

    res.json({ kitchen: updated[0] });
});

router.delete('/kitchens/:id', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { id } = req.params;
    try {
        await query('DELETE FROM kitchens WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: 'Cannot delete kitchen. It may be linked to orders or chefs.', details: err.message });
    }
});

router.get('/kitchens/:id/staff', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { rows } = await query('SELECT id, name, phone, is_online FROM users WHERE kitchen_id = $1 AND role = $2', [id, 'chef']);
    res.json({ staff: rows });
});

router.post('/kitchens/:id/staff', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { phone, name } = req.body;
    try {
        const { rows: existing } = await query('SELECT id FROM users WHERE phone = $1', [phone]);
        if (existing.length > 0) {
            await query('UPDATE users SET role = $1, kitchen_id = $2, is_active = true WHERE phone = $3', ['chef', id, phone]);
            res.json({ success: true, message: 'Existing user promoted to chef' });
        } else {
            await query(`
                INSERT INTO users (name, phone, role, kitchen_id, is_active, onboarding_complete)
                VALUES ($1, $2, 'chef', $3, true, true)
            `, [name || 'Chef', phone, id]);
            res.json({ success: true, message: 'New chef account created' });
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

export default router;
