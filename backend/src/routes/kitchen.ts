// @ts-nocheck
import { Router } from 'express';
import { query } from '../db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { emitToUser, emitToKitchen, emitToRiders, emitToAdmin, emitToOrder, emitToAll } from '../socket';
import { NotificationService } from '../services/notification.service';
import { haversineMetres } from '../services/distance.service';
import { autoAssignOrder } from '../services/autoAssign';
import { redis, keys } from '../redis';
import { sendFCM } from '../services/fcm.service';

async function getKitchenId(req: AuthRequest, res: any): Promise<string | null> {
    if (req.user!.kitchenId) return req.user!.kitchenId;
    if (req.user!.role === 'super_admin') {
        const { rows } = await query('SELECT id FROM kitchens LIMIT 1');
        if (rows.length > 0) return rows[0].id;
    }
    res.status(400).json({ error: 'KITCHEN_NOT_ASSIGNED' });
    return null;
}

// Returns zone_id for a kitchen — tries kitchen_zones junction first, falls back to kitchens.zone_id
async function getZoneId(kitchenId: string): Promise<string | null> {
    const { rows } = await query(
        `SELECT COALESCE(kz.zone_id, k.zone_id) AS zone_id
         FROM kitchens k
         LEFT JOIN kitchen_zones kz ON kz.kitchen_id = k.id
         WHERE k.id = $1
         LIMIT 1`,
        [kitchenId]
    );
    return rows[0]?.zone_id ?? null;
}

// Auto-resume: if pause_until has passed, clear the pause and notify waiting customers
async function autoResumeIfExpired(kitchenId: string): Promise<void> {
    const { rows } = await query(
        `UPDATE kitchens SET is_paused = false, pause_until = NULL, pause_reason = NULL
         WHERE id = $1 AND is_paused = true AND pause_until IS NOT NULL AND pause_until < NOW()
         RETURNING id`,
        [kitchenId]
    );
    if (rows.length > 0) {
        // Notify waiting customers and clear the list
        await notifyPauseWaiters(kitchenId);
        const zoneId = await getZoneId(kitchenId);
        if (zoneId) {
            await redis.del(keys.menu(zoneId));
            emitToAll('kitchen_resumed', { kitchenId, zoneId });
            emitToAll('menu_updated', { zoneId });
        }
    }
}

// Send FCM push to all registered "notify me" tokens for this kitchen
async function notifyPauseWaiters(kitchenId: string): Promise<void> {
    const redisKey = `pause_notify:${kitchenId}`;
    const tokens = await redis.sMembers(redisKey);
    if (!tokens.length) return;
    await redis.del(redisKey);
    await Promise.allSettled(
        tokens.map(token =>
            sendFCM(token, '🍽️ Kitchen is back open!', 'Place your order now — we\'re ready to cook.', { type: 'kitchen_resumed' })
        )
    );
}

const router = Router();

router.get('/menu', authenticate, requireRole('chef', 'kitchen_manager', 'super_admin'), async (req: AuthRequest, res) => {
    const kitchenId = await getKitchenId(req, res);
    if (!kitchenId) return;

    await autoResumeIfExpired(kitchenId);

    const zoneId = await getZoneId(kitchenId);
    if (!zoneId) return res.status(400).json({ error: 'KITCHEN_NOT_IN_ZONE' });

    const [{ rows: menuRows }, { rows: kitchenInfo }] = await Promise.all([
        query('SELECT id, name, description, price_paise, category, station, available, is_veg, is_egg, customization_groups FROM menu_items WHERE zone_id = $1 ORDER BY name', [zoneId]),
        query('SELECT is_paused, pause_reason, pause_until FROM kitchens WHERE id = $1', [kitchenId]),
    ]);

    const k = kitchenInfo[0];
    res.json({
        menu: menuRows,
        kitchenPaused: k?.is_paused || false,
        pauseReason: k?.pause_reason || null,
        pauseUntil: k?.pause_until || null,
    });
});

router.patch('/status', authenticate, requireRole('chef', 'kitchen_manager', 'super_admin'), async (req: AuthRequest, res) => {
    const kitchenId = await getKitchenId(req, res);
    if (!kitchenId) return;

    const { paused, reason, duration_minutes } = req.body;

    let pauseUntil: Date | null = null;
    if (paused && duration_minutes && duration_minutes > 0) {
        pauseUntil = new Date(Date.now() + duration_minutes * 60 * 1000);
    }

    await query(
        'UPDATE kitchens SET is_paused = $1, pause_reason = $2, pause_until = $3 WHERE id = $4',
        [paused, paused ? (reason || null) : null, paused ? pauseUntil : null, kitchenId]
    );

    // If resuming manually, notify waiting customers
    if (!paused) {
        await notifyPauseWaiters(kitchenId);
    }

    const zoneId = await getZoneId(kitchenId);
    if (zoneId) {
        await redis.del(keys.menu(zoneId));
        if (!paused) {
            emitToAll('kitchen_resumed', { kitchenId, zoneId });
        }
        emitToAll('menu_updated', { zoneId });
    }

    res.json({ success: true, isPaused: paused, pauseUntil });
});

router.patch('/menu/:itemId/availability', authenticate, requireRole('chef', 'kitchen_manager', 'super_admin'), async (req: AuthRequest, res) => {
    const { itemId } = req.params;
    const { available } = req.body;
    
    const { rows } = await query(
        'UPDATE menu_items SET available = $1 WHERE id = $2 RETURNING zone_id',
        [available, itemId]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });

    await redis.del(keys.menu(rows[0].zone_id));
    emitToAll('menu_updated', { zoneId: rows[0].zone_id });

    res.json({ success: true });
});

router.get('/orders', authenticate, requireRole('chef', 'kitchen_manager', 'super_admin', 'packer'), async (req: AuthRequest, res) => {
    let rows: any[] = [];

    if (req.user!.role === 'super_admin') {
        const result = await query(
            `SELECT o.*, u.name as customer_name, k.name as kitchen_name
             FROM orders o
             JOIN users u ON o.customer_id = u.id
             JOIN kitchens k ON o.kitchen_id = k.id
             WHERE o.status IN ('confirmed', 'preparing', 'packing', 'ready_for_pickup')
               AND o.created_at > NOW() - INTERVAL '48 hours'
             ORDER BY o.created_at ASC`
        );
        rows = result.rows;
    } else {
        const kitchenId = await getKitchenId(req, res);
        if (!kitchenId) return;

        const result = await query(
            `SELECT o.*, u.name as customer_name, k.name as kitchen_name
             FROM orders o
             JOIN users u ON o.customer_id = u.id
             JOIN kitchens k ON o.kitchen_id = k.id
             WHERE o.kitchen_id = $1 AND o.status IN ('confirmed', 'preparing', 'packing', 'ready_for_pickup')
               AND o.created_at > NOW() - INTERVAL '48 hours'
             ORDER BY o.created_at ASC`,
            [kitchenId]
        );
        rows = result.rows;
    }

    for (const order of rows) {
        const { rows: items } = await query(
            `SELECT oi.menu_item_name as name, oi.quantity, oi.price_paise, COALESCE(m.category, oi.station) as station, oi.customizations, oi.special_instructions 
             FROM order_items oi
             LEFT JOIN menu_items m ON oi.menu_item_id = m.id
             WHERE oi.order_id = $1`,
            [order.id]
        );
        order.items = items;
    }

    let kitchenName = null;
    if (req.user!.role !== 'super_admin') {
        const kitchenId = await getKitchenId(req, res);
        if (kitchenId) {
            const knRows = await query('SELECT name FROM kitchens WHERE id = $1', [kitchenId]);
            kitchenName = knRows.rows[0]?.name || null;
        }
    }

    res.json({ orders: rows, kitchen_name: kitchenName });
});

router.post('/orders/:id/claim', authenticate, requireRole('chef', 'kitchen_manager', 'partner_kitchen', 'super_admin'), async (req: AuthRequest, res) => {
    const { id } = req.params;
    const chefId = req.user!.userId;

    const { rowCount, rows } = await query(
        'UPDATE orders SET status = \'preparing\', claimed_by_chef_id = $1, claimed_at = NOW() WHERE id = $2 AND status = \'confirmed\' AND claimed_by_chef_id IS NULL RETURNING kitchen_id',
        [chefId, id]
    );

    if (rowCount === 0) return res.status(400).json({ error: 'ORDER_ALREADY_CLAIMED' });

    const kitchenId = rows[0]?.kitchen_id;
    if (kitchenId) {
        emitToKitchen(kitchenId, 'order_updated', { orderId: id, status: 'preparing' });
        emitToAdmin('order_status_update', { orderId: id, status: 'preparing' });
    }
    
    res.json({ success: true });
});

router.patch('/orders/:id/status', authenticate, requireRole('chef', 'kitchen_manager', 'super_admin'), async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { status } = req.body;

    try {
        const { rows } = await query(
            `UPDATE orders SET status = $1 WHERE id = $2 
             RETURNING id, display_id, customer_id, kitchen_id, zone_id, status`,
            [status, id]
        );
        const order = rows[0];

        // 1. WebSocket Updates
        emitToUser(order.customer_id, 'order_status_update', { orderId: id, status });
        emitToOrder(id, 'order_status_update', { orderId: id, status });
        emitToKitchen(order.kitchen_id, 'order_updated', { orderId: id, status });
        emitToAdmin('order_status_update', { orderId: id, status, display_id: order.display_id });

        // 2. Notification Queue
        let notificationType: string | null = null;
        if (status === 'preparing') {
            notificationType = 'order_preparing';
        }
        if (status === 'ready_for_pickup') {
            notificationType = 'order_ready';

            // 3-minute escalation: if still no rider after 3 min, alert kitchen managers
            const { notificationsQueue } = require('../jobs/queues');
            notificationsQueue.add('rider_escalation', {
                orderId: id,
                displayId: order.display_id,
                kitchenId: order.kitchen_id,
                zoneId: order.zone_id,
            }, { delay: 3 * 60 * 1000 }).catch(() => {});

            // Always auto-assign — no pool, no cherry-picking
            autoAssignOrder(id).catch(() => {});
        }
        if (notificationType) {
            NotificationService.send(notificationType as any, {
                userId: order.customer_id,
                vars: {
                    displayId: order.display_id,
                    orderId: id,
                }
            }).catch(() => {});
        }

        res.json({ order });
    } catch (err: any) {
        res.status(400).json({ error: 'INVALID_TRANSITION', message: err.message });
    }
});

// ─── Packer endpoints ─────────────────────────────────────────────────────────

// Orders awaiting packing — packer's primary queue
router.get('/packer/orders', authenticate, requireRole('packer', 'kitchen_manager', 'super_admin'), async (req: AuthRequest, res) => {
    const kitchenId = await getKitchenId(req, res);
    if (!kitchenId) return;
    const { rows } = await query(
        `SELECT o.*, u.name as customer_name
         FROM orders o
         JOIN users u ON o.customer_id = u.id
         WHERE o.kitchen_id = $1 AND o.status = 'packing'
         ORDER BY o.updated_at ASC`,
        [kitchenId]
    );
    for (const order of rows) {
        const { rows: items } = await query(
            `SELECT oi.menu_item_name as name, oi.quantity, oi.special_instructions
             FROM order_items oi WHERE oi.order_id = $1`,
            [order.id]
        );
        order.items = items;
    }
    res.json({ orders: rows });
});

// Packer marks order as packed → triggers rider assignment
router.post('/orders/:id/packed', authenticate, requireRole('packer', 'kitchen_manager', 'super_admin'), async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { rows } = await query(
        `UPDATE orders SET status = 'ready_for_pickup', packed_by_id = $1, packed_at = NOW()
         WHERE id = $2 AND status = 'packing'
         RETURNING id, display_id, customer_id, kitchen_id, zone_id`,
        [req.user!.userId, id]
    );
    if (!rows[0]) return res.status(400).json({ error: 'ORDER_NOT_IN_PACKING' });
    const order = rows[0];

    emitToUser(order.customer_id, 'order_status_update', { orderId: id, status: 'ready_for_pickup' });
    emitToOrder(id, 'order_status_update', { orderId: id, status: 'ready_for_pickup' });
    emitToKitchen(order.kitchen_id, 'order_updated', { orderId: id, status: 'ready_for_pickup' });
    emitToAdmin('order_status_update', { orderId: id, status: 'ready_for_pickup', display_id: order.display_id });

    // Rider escalation safety net
    const { notificationsQueue } = require('../jobs/queues');
    notificationsQueue.add('rider_escalation', {
        orderId: id, displayId: order.display_id,
        kitchenId: order.kitchen_id, zoneId: order.zone_id,
    }, { delay: 3 * 60 * 1000 }).catch(() => {});

    autoAssignOrder(id).catch(() => {});

    NotificationService.send('order_ready', {
        userId: order.customer_id,
        vars: { displayId: order.display_id, orderId: id },
    }).catch(() => {});

    res.json({ success: true });
});

router.get('/inventory', authenticate, requireRole('chef', 'kitchen_manager', 'super_admin'), async (req: AuthRequest, res) => {
    const kitchenId = await getKitchenId(req, res);
    if (!kitchenId) return;
    const { rows } = await query(
        `SELECT id, kitchen_id, name, unit, current_stock_grams AS current_stock, reorder_threshold_grams AS reorder_threshold, last_restocked_at, created_at
         FROM ingredients WHERE kitchen_id = $1 ORDER BY name`,
        [kitchenId]
    );
    res.json({ inventory: rows });
});

router.patch('/inventory/:id', authenticate, requireRole('chef', 'kitchen_manager', 'super_admin'), async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { current_stock } = req.body;
    const kitchenId = await getKitchenId(req, res);
    if (!kitchenId) return;

    const { rowCount } = await query(
        'UPDATE ingredients SET current_stock_grams = $1 WHERE id = $2 AND kitchen_id = $3',
        [current_stock, id, kitchenId]
    );

    if (rowCount === 0) return res.status(404).json({ error: 'INGREDIENT_NOT_FOUND' });
    res.json({ success: true });
});

router.get('/batches', authenticate, requireRole('chef', 'super_admin'), async (req: AuthRequest, res) => {
    const kitchenId = await getKitchenId(req, res);
    if (!kitchenId) return;
    const { rows } = await query('SELECT * FROM production_batches WHERE kitchen_id = $1 AND status != \'completed\'', [kitchenId]);
    res.json({ batches: rows });
});

router.post('/batches', authenticate, requireRole('chef', 'super_admin'), async (req: AuthRequest, res) => {
    const { item_name, target_quantity } = req.body;
    const kitchenId = await getKitchenId(req, res);
    if (!kitchenId) return;
    
    await query(`
        INSERT INTO production_batches (kitchen_id, item_name, target_quantity, current_quantity, status)
        VALUES ($1, $2, $3, 0, 'active')
    `, [kitchenId, item_name, target_quantity]);

    res.json({ success: true });
});

router.post('/batches/:id/complete', authenticate, requireRole('chef', 'super_admin'), async (req: AuthRequest, res) => {
    const { id } = req.params;
    await query('UPDATE production_batches SET status = \'completed\', completed_at = NOW() WHERE id = $1', [id]);
    res.json({ success: true });
});

router.get('/prep-list', authenticate, requireRole('chef', 'super_admin'), async (req: AuthRequest, res) => {
    const kitchenId = await getKitchenId(req, res);
    if (!kitchenId) return;
    const { rows } = await query('SELECT * FROM prep_tasks WHERE kitchen_id = $1 AND date = CURRENT_DATE', [kitchenId]);
    res.json({ tasks: rows });
});

router.post('/prep-list/:id/toggle', authenticate, requireRole('chef', 'super_admin'), async (req: AuthRequest, res) => {
    const { id } = req.params;
    await query('UPDATE prep_tasks SET completed = NOT completed, completed_at = CASE WHEN NOT completed THEN NOW() ELSE NULL END WHERE id = $1', [id]);
    res.json({ success: true });
});

router.post('/prep-list', authenticate, requireRole('chef', 'super_admin'), async (req: AuthRequest, res) => {
    const { title, category } = req.body;
    if (!title) return res.status(400).json({ error: 'TITLE_REQUIRED' });
    const kitchenId = await getKitchenId(req, res);
    if (!kitchenId) return;
    const { rows } = await query(
        'INSERT INTO prep_tasks (kitchen_id, title, category) VALUES ($1, $2, $3) RETURNING *',
        [kitchenId, title, category || 'General']
    );
    res.json({ task: rows[0] });
});

router.get('/feedback', authenticate, requireRole('chef', 'super_admin'), async (req: AuthRequest, res) => {
    const kitchenId = await getKitchenId(req, res);
    if (!kitchenId) return;
    const { rows: feedbacks } = await query(`
        SELECT f.*, o.display_id as order_display_id
        FROM order_feedback f
        JOIN orders o ON f.order_id = o.id
        WHERE o.kitchen_id = $1
        ORDER BY f.created_at DESC
        LIMIT 50
    `, [kitchenId]);

    const { rows: avg } = await query('SELECT AVG(f.rating) as average FROM order_feedback f JOIN orders o ON f.order_id = o.id WHERE o.kitchen_id = $1', [kitchenId]);

    res.json({ feedbacks, averageRating: parseFloat(avg[0].average || '0').toFixed(1) });
});

router.post('/shift-handover', authenticate, requireRole('chef', 'super_admin'), async (req: AuthRequest, res) => {
    const { notes, cleaningStatus, gasStatus } = req.body;
    const kitchenId = await getKitchenId(req, res);
    if (!kitchenId) return;
    await query(`
        INSERT INTO shift_handovers (kitchen_id, chef_id, notes, cleaning_completed, gas_safety_checked)
        VALUES ($1, $2, $3, $4, $5)
    `, [kitchenId, req.user!.userId, notes, cleaningStatus, gasStatus]);
    res.json({ success: true });
});

// ─── Partner Kitchen Earnings (for partner_kitchen role web portal) ────────────

router.get('/my-earnings', authenticate, requireRole('partner_kitchen', 'super_admin'), async (req: AuthRequest, res) => {
    const kitchenId = req.user!.kitchenId;
    if (!kitchenId) return res.status(400).json({ error: 'No kitchen linked to this account' });

    try {
        const now = new Date();
        const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0,0,0,0);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const [kitchen, todayRows, weekRows, monthRows, allRows, payoutRows, recentOrders, trendRows] = await Promise.all([
            query('SELECT id, name, commission_rate, upi_id, partner_status FROM kitchens WHERE id = $1', [kitchenId]),
            query(`SELECT COALESCE(SUM(kitchen_payout_paise),0) net, COALESCE(SUM(commission_paise),0) commission,
                          COALESCE(SUM(total_amount_paise - delivery_fee_paise),0) gross, COUNT(*) orders
                   FROM orders WHERE kitchen_id=$1 AND status='delivered' AND updated_at >= $2`, [kitchenId, todayStart]),
            query(`SELECT COALESCE(SUM(kitchen_payout_paise),0) net, COALESCE(SUM(commission_paise),0) commission,
                          COALESCE(SUM(total_amount_paise - delivery_fee_paise),0) gross, COUNT(*) orders
                   FROM orders WHERE kitchen_id=$1 AND status='delivered' AND updated_at >= $2`, [kitchenId, weekStart]),
            query(`SELECT COALESCE(SUM(kitchen_payout_paise),0) net, COALESCE(SUM(commission_paise),0) commission,
                          COALESCE(SUM(total_amount_paise - delivery_fee_paise),0) gross, COUNT(*) orders
                   FROM orders WHERE kitchen_id=$1 AND status='delivered' AND updated_at >= $2`, [kitchenId, monthStart]),
            query(`SELECT COALESCE(SUM(kitchen_payout_paise),0) net, COALESCE(SUM(commission_paise),0) commission,
                          COALESCE(SUM(total_amount_paise - delivery_fee_paise),0) gross, COUNT(*) orders
                   FROM orders WHERE kitchen_id=$1 AND status='delivered'`, [kitchenId]),
            query(`SELECT id, period_start, period_end, gross_sales_paise, commission_paise, net_payout_paise,
                          status, paid_at, upi_reference
                   FROM kitchen_payouts WHERE kitchen_id=$1 ORDER BY created_at DESC LIMIT 12`, [kitchenId]),
            query(`SELECT o.display_id, o.total_amount_paise, o.kitchen_payout_paise, o.commission_paise,
                          o.status, o.payment_method, o.updated_at
                   FROM orders o WHERE o.kitchen_id=$1 AND o.status='delivered'
                   ORDER BY o.updated_at DESC LIMIT 20`, [kitchenId]),
            query(`SELECT DATE(updated_at AT TIME ZONE 'Asia/Kolkata') as date, 
                          COALESCE(SUM(kitchen_payout_paise), 0) as net 
                   FROM orders 
                   WHERE kitchen_id=$1 AND status='delivered' AND updated_at >= NOW() - INTERVAL '7 days' 
                   GROUP BY DATE(updated_at AT TIME ZONE 'Asia/Kolkata') 
                   ORDER BY date ASC`, [kitchenId]),
        ]);

        // Pad the 7-day trend array so the chart always renders
        const trendData = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(todayStart);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const found = trendRows.rows.find((r: any) => new Date(r.date).toISOString().split('T')[0] === dateStr);
            trendData.push({ date: dateStr, net: found ? parseInt(found.net) : 0 });
        }

        res.json({
            kitchen: kitchen.rows[0],
            today: todayRows.rows[0],
            thisWeek: weekRows.rows[0],
            thisMonth: monthRows.rows[0],
            allTime: allRows.rows[0],
            payouts: payoutRows.rows,
            recentOrders: recentOrders.rows,
            trend: trendData,
        });
    } catch (err) {
        console.error('[kitchen/my-earnings]', err);
        res.status(500).json({ error: 'Failed to fetch earnings' });
    }
});

// ─── Dispatch: live rider list with GPS + order status ───────────────────────
router.get('/riders/live', authenticate, requireRole('kitchen_manager', 'super_admin'), async (req: AuthRequest, res) => {
    const kitchenId = await getKitchenId(req, res);
    if (!kitchenId) return;

    try {
        // Show idle riders (available to all) + riders delivering THIS kitchen's orders
        const { rows: riders } = await query(`
            SELECT u.id, u.name, u.phone, u.is_online,
                   (
                       SELECT json_agg(json_build_object(
                           'id', o.id,
                           'display_id', o.display_id,
                           'status', o.status,
                           'delivery_address', a.address_text
                       ))
                       FROM orders o
                       LEFT JOIN addresses a ON o.address_id = a.id
                       WHERE o.rider_id = u.id AND o.status NOT IN ('delivered', 'cancelled')
                   ) as active_orders
            FROM users u
            WHERE u.role IN ('rider','rider_captain') AND u.is_online = true
            ORDER BY u.name
        `);

        // Attach GPS from Redis (non-blocking — missing is fine)
        const ridersWithLocation = await Promise.all(
            riders.map(async (r: any) => {
                try {
                    const raw = await redis.get(keys.riderLocation(r.id));
                    return { ...r, location: raw ? JSON.parse(raw) : null };
                } catch {
                    return { ...r, location: null };
                }
            })
        );

        // Filter out ghost riders (app killed without toggling offline):
        // Only return them if they have a recent location ping OR they are currently assigned an order
        const trulyOnlineRiders = ridersWithLocation.filter(r => 
            r.location !== null || (r.active_orders && r.active_orders.length > 0)
        );

        res.json({ riders: trulyOnlineRiders });
    } catch (err: any) {
        res.status(500).json({ error: 'FETCH_FAILED', message: err.message });
    }
});

// ─── Dispatch: manually assign a specific rider to a ready order ──────────────
router.post('/orders/:id/assign-rider', authenticate, requireRole('kitchen_manager', 'super_admin'), async (req: AuthRequest, res) => {
    const kitchenId = await getKitchenId(req, res);
    if (!kitchenId) return;

    const { id } = req.params;
    const { riderId } = req.body;
    if (!riderId) return res.status(400).json({ error: 'MISSING_RIDER_ID' });

    try {
        // Verify rider is online and free
        const { rows: riderRows } = await query(
            'SELECT id, name, current_order_id, is_online FROM users WHERE id = $1',
            [riderId]
        );
        const rider = riderRows[0];
        const { rows: activeOrders } = await query(
            "SELECT id FROM orders WHERE rider_id = $1 AND status NOT IN ('delivered', 'cancelled')",
            [riderId]
        );
        if (!rider) return res.status(404).json({ error: 'RIDER_NOT_FOUND' });
        if (!rider.is_online) return res.status(409).json({ error: 'RIDER_OFFLINE' });

        // Assign atomically — also guards that this order belongs to this kitchen
        const { rows: orderRows } = await query(
            `UPDATE orders SET rider_id = $1
             WHERE id = $2 AND kitchen_id = $3 AND rider_id IS NULL AND status = 'ready_for_pickup'
             RETURNING id, display_id, customer_id, kitchen_id, zone_id, address_id`,
            [riderId, id, kitchenId]
        );
        if (!orderRows[0]) return res.status(409).json({ error: 'ORDER_UNAVAILABLE' });

        // Legacy clear (no longer relied upon, but kept null for backwards compatibility)
        await query('UPDATE users SET current_order_id = NULL WHERE id = $1', [riderId]);

        const order = orderRows[0];

        // Fetch delivery address for the rider notification
        const { rows: addrRows } = await query(
            'SELECT address_text FROM addresses WHERE id = $1',
            [order.address_id]
        );

        // Push to rider — they'll see accept/decline modal with full context
        emitToUser(riderId, 'order_assigned', {
            orderId: id,
            displayId: order.display_id,
            assignedBy: 'kitchen',
            deliveryAddress: addrRows[0]?.address_text || null,
        });

        // Notify customer that a rider was assigned
        emitToUser(order.customer_id, 'order_status_update', {
            orderId: id,
            status: order.status,
            riderAssigned: true,
            riderName: rider.name,
        });

        emitToKitchen(order.kitchen_id, 'order_updated', { orderId: id });
        emitToAdmin('order_status_update', { orderId: id, display_id: order.display_id });

        res.json({ success: true, riderId, riderName: rider.name });
    } catch (err: any) {
        res.status(500).json({ error: 'ASSIGN_FAILED', message: err.message });
    }
});

// ─── Dispatch: get unassigned ready orders for dispatch panel ─────────────────
router.get('/orders/unassigned', authenticate, requireRole('kitchen_manager', 'super_admin'), async (req: AuthRequest, res) => {
    const kitchenId = await getKitchenId(req, res);
    if (!kitchenId) return;

    try {
        const { rows } = await query(`
            SELECT o.id, o.display_id, o.status, o.created_at,
                   u.name AS customer_name, u.phone AS customer_phone,
                   a.address_text AS delivery_address, a.lat AS customer_lat, a.lng AS customer_lng,
                   k.name AS kitchen_name
            FROM orders o
            JOIN users u ON o.customer_id = u.id
            LEFT JOIN addresses a ON o.address_id = a.id
            LEFT JOIN kitchens k ON o.kitchen_id = k.id
            WHERE o.status = 'ready_for_pickup' AND o.rider_id IS NULL AND o.kitchen_id = $1
            ORDER BY o.created_at ASC
        `, [kitchenId]);

        for (const order of rows) {
            const { rows: items } = await query(
                'SELECT menu_item_name, quantity FROM order_items WHERE order_id = $1',
                [order.id]
            );
            order.items = items;
        }

        const { rows: settings } = await query("SELECT value FROM app_settings WHERE key = 'max_batch_size'");
        const maxBatchSize = settings.length > 0 ? parseInt(settings[0].value, 10) || 1 : 1;

        const batches: any[] = [];
        
        if (maxBatchSize > 1) {
            for (const order of rows) {
                let placed = false;
                for (const batch of batches) {
                    if (batch.orders.length < maxBatchSize) {
                        const firstOrder = batch.orders[0];
                        const dist = haversineMetres(
                            parseFloat(order.customer_lat), parseFloat(order.customer_lng),
                            parseFloat(firstOrder.customer_lat), parseFloat(firstOrder.customer_lng)
                        );
                        // Group if within 1.5km
                        if (dist <= 1500) {
                            batch.orders.push(order);
                            placed = true;
                            break;
                        }
                    }
                }
                if (!placed) {
                    batches.push({ id: 'batch-' + order.id, orders: [order] });
                }
            }
        } else {
            // No batching
            for (const order of rows) {
                batches.push({ id: 'batch-' + order.id, orders: [order] });
            }
        }

        res.json({ batches });
    } catch (err: any) {
        res.status(500).json({ error: 'FETCH_FAILED', message: err.message });
    }
});

// Customer registers their FCM token to be notified when the kitchen resumes
// Called from the mobile "Notify me when open" button
router.post('/pause-notify', authenticate, requireRole('chef', 'kitchen_manager', 'partner_kitchen', 'packer', 'super_admin'), async (req: AuthRequest, res) => {
    const { kitchenId, fcmToken } = req.body;
    if (!kitchenId || !fcmToken) return res.status(400).json({ error: 'MISSING_FIELDS' });

    // Verify kitchen is actually paused
    const { rows } = await query('SELECT is_paused FROM kitchens WHERE id = $1', [kitchenId]);
    if (!rows[0]?.is_paused) return res.json({ registered: false, reason: 'kitchen_not_paused' });

    await redis.sAdd(`pause_notify:${kitchenId}`, fcmToken);
    res.json({ registered: true });
});

// ─── Kitchen Analytics (kitchen_manager only — own kitchen ops view) ─────────
router.get('/analytics', authenticate, requireRole('kitchen_manager', 'super_admin'), async (req: AuthRequest, res) => {
    const kitchenId = await getKitchenId(req, res);
    if (!kitchenId) return;

    try {
        const now = new Date();
        const todayStart  = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart   = new Date(todayStart); weekStart.setDate(todayStart.getDate() - todayStart.getDay());
        const monthStart  = new Date(now.getFullYear(), now.getMonth(), 1);

        const [todayR, weekR, monthR, allTimeR, topItemsR, peakHoursR, recentR] = await Promise.all([
            query(`SELECT COALESCE(SUM(total_amount_paise),0) gmv, COUNT(*) orders
                   FROM orders WHERE kitchen_id=$1 AND status='delivered' AND updated_at>=$2`,
                [kitchenId, todayStart]),
            query(`SELECT COALESCE(SUM(total_amount_paise),0) gmv, COUNT(*) orders
                   FROM orders WHERE kitchen_id=$1 AND status='delivered' AND updated_at>=$2`,
                [kitchenId, weekStart]),
            query(`SELECT COALESCE(SUM(total_amount_paise),0) gmv, COUNT(*) orders
                   FROM orders WHERE kitchen_id=$1 AND status='delivered' AND updated_at>=$2`,
                [kitchenId, monthStart]),
            query(`SELECT COALESCE(SUM(total_amount_paise),0) gmv, COUNT(*) orders
                   FROM orders WHERE kitchen_id=$1 AND status='delivered'`,
                [kitchenId]),
            query(`SELECT oi.menu_item_name AS name,
                          SUM(oi.quantity)::int AS qty_sold,
                          COALESCE(SUM(oi.quantity * oi.price_paise),0)::int AS revenue_paise
                   FROM order_items oi
                   JOIN orders o ON o.id = oi.order_id
                   WHERE o.kitchen_id=$1 AND o.status='delivered' AND o.updated_at>=$2
                   GROUP BY oi.menu_item_name ORDER BY qty_sold DESC LIMIT 5`,
                [kitchenId, monthStart]),
            query(`SELECT EXTRACT(HOUR FROM updated_at AT TIME ZONE 'Asia/Kolkata')::int AS hour,
                          COUNT(*)::int AS orders
                   FROM orders
                   WHERE kitchen_id=$1 AND status='delivered'
                     AND updated_at >= NOW() - INTERVAL '30 days'
                   GROUP BY hour ORDER BY hour`,
                [kitchenId]),
            query(`SELECT display_id, total_amount_paise, payment_method, updated_at
                   FROM orders WHERE kitchen_id=$1 AND status='delivered'
                   ORDER BY updated_at DESC LIMIT 20`,
                [kitchenId]),
        ]);

        res.json({
            today:     { gmv: parseInt(todayR.rows[0].gmv),    orders: parseInt(todayR.rows[0].orders) },
            thisWeek:  { gmv: parseInt(weekR.rows[0].gmv),     orders: parseInt(weekR.rows[0].orders) },
            thisMonth: { gmv: parseInt(monthR.rows[0].gmv),    orders: parseInt(monthR.rows[0].orders) },
            allTime:   { gmv: parseInt(allTimeR.rows[0].gmv),  orders: parseInt(allTimeR.rows[0].orders) },
            topItems:     topItemsR.rows,
            peakHours:    peakHoursR.rows,
            recentOrders: recentR.rows,
        });
    } catch (err: any) {
        console.error('[kitchen/analytics]', err);
        res.status(500).json({ error: 'ANALYTICS_FAILED' });
    }
});

// ── Dine-in: today's reservations for own restaurant ─────────────────────────
router.get('/dine-in/today', authenticate, requireRole('chef', 'kitchen_manager', 'super_admin', 'dine_in_staff'), async (req: AuthRequest, res) => {
    try {
        let whereClause: string;
        let params: any[];

        if (req.user!.role === 'dine_in_staff') {
            // dine_in_staff sees only their assigned restaurant
            whereClause = 'tb.restaurant_id = $1';
            params = [req.user!.restaurantId];
        } else {
            const kitchenId = await getKitchenId(req, res);
            if (!kitchenId) return;
            const zoneId = await getZoneId(kitchenId);
            whereClause = '($1::uuid IS NULL OR rc.zone_id = $1::uuid)';
            params = [zoneId];
        }

        const { rows } = await query(`
            SELECT tb.id, tb.display_id, tb.status,
                   tb.slot_start, tb.slot_end, tb.party_size,
                   tb.pre_order_amount_paise, tb.post_order_amount_paise,
                   tb.gst_amount_paise, tb.total_paid_paise,
                   tb.occasion,
                   u.name AS customer_name,
                   rt.table_number,
                   COALESCE(pre.items, '[]') AS pre_order_items
            FROM table_bookings tb
            JOIN restaurant_config rc ON rc.id = tb.restaurant_id
            LEFT JOIN users u ON u.id = tb.customer_id
            LEFT JOIN restaurant_tables rt ON rt.id = tb.table_id
            LEFT JOIN LATERAL (
                SELECT json_agg(json_build_object(
                    'name', tbi.menu_item_name,
                    'quantity', tbi.quantity,
                    'status', tbi.status
                ) ORDER BY tbi.ordered_at) AS items
                FROM table_booking_items tbi
                WHERE tbi.booking_id = tb.id AND tbi.type = 'pre_order'
            ) pre ON true
            WHERE ${whereClause}
              AND (tb.slot_start AT TIME ZONE 'Asia/Kolkata')::date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
              AND tb.status NOT IN ('cancelled','no_show')
            ORDER BY tb.slot_start
        `, params);
        res.json(rows);
    } catch (err: any) {
        console.error('[kitchen/dine-in/today]', err);
        res.status(500).json({ error: 'FAILED' });
    }
});

// ── Dine-in: pending tickets (pre-order / post-order items to prepare) ────────
router.get('/dine-in/tickets', authenticate, requireRole('chef', 'kitchen_manager', 'super_admin', 'dine_in_staff'), async (req: AuthRequest, res) => {
    try {
        const type = (req.query.type as string) === 'post' ? 'post_order' : 'pre_order';
        let whereClause: string;
        let params: any[];

        if (req.user!.role === 'dine_in_staff') {
            whereClause = 'tb.restaurant_id = $1';
            params = [req.user!.restaurantId, type];
        } else {
            const kitchenId = await getKitchenId(req, res);
            if (!kitchenId) return;
            const zoneId = await getZoneId(kitchenId);
            whereClause = '($1::uuid IS NULL OR rc.zone_id = $1::uuid)';
            params = [zoneId, type];
        }

        const { rows } = await query(`
            SELECT tb.id AS booking_id, tb.display_id, rt.table_number,
                   json_agg(json_build_object(
                       'id', tbi.id,
                       'name', COALESCE(rmi.name, tbi.menu_item_name),
                       'quantity', tbi.quantity,
                       'status', tbi.status,
                       'special_note', tbi.customizations->>'note'
                   ) ORDER BY tbi.ordered_at) AS items,
                   $2 AS type
            FROM table_booking_items tbi
            JOIN table_bookings tb ON tb.id = tbi.booking_id
            JOIN restaurant_config rc ON rc.id = tb.restaurant_id
            LEFT JOIN restaurant_menu_items rmi ON rmi.id = tbi.menu_item_id
            LEFT JOIN restaurant_tables rt ON rt.id = tb.table_id
            WHERE ${whereClause}
              AND tbi.type = $2
              AND tbi.status != 'served'
              AND tb.status = 'seated'
            GROUP BY tb.id, tb.display_id, rt.table_number
            ORDER BY tb.slot_start
        `, params);
        res.json(rows);
    } catch (err: any) {
        console.error('[kitchen/dine-in/tickets]', err);
        res.status(500).json({ error: 'FAILED' });
    }
});

// ── Dine-in: seated bookings with outstanding balance ─────────────────────────
router.get('/dine-in/bill', authenticate, requireRole('chef', 'kitchen_manager', 'super_admin', 'dine_in_staff'), async (req: AuthRequest, res) => {
    try {
        let whereClause: string;
        let params: any[];

        if (req.user!.role === 'dine_in_staff') {
            whereClause = 'tb.restaurant_id = $1';
            params = [req.user!.restaurantId];
        } else {
            const kitchenId = await getKitchenId(req, res);
            if (!kitchenId) return;
            const zoneId = await getZoneId(kitchenId);
            whereClause = '($1::uuid IS NULL OR rc.zone_id = $1::uuid)';
            params = [zoneId];
        }

        const { rows } = await query(`
            SELECT tb.id, tb.display_id, tb.party_size,
                   tb.pre_order_amount_paise, tb.post_order_amount_paise,
                   COALESCE(tb.gst_amount_paise,
                       ROUND((tb.pre_order_amount_paise + tb.post_order_amount_paise) * rc.gst_percent / 100.0)
                   ) AS gst_amount_paise,
                   tb.total_paid_paise,
                   rt.table_number,
                   u.name AS customer_name
            FROM table_bookings tb
            JOIN restaurant_config rc ON rc.id = tb.restaurant_id
            LEFT JOIN users u ON u.id = tb.customer_id
            LEFT JOIN restaurant_tables rt ON rt.id = tb.table_id
            WHERE ${whereClause}
              AND tb.status = 'seated'
              AND (tb.pre_order_amount_paise + tb.post_order_amount_paise + COALESCE(tb.gst_amount_paise,
                   ROUND((tb.pre_order_amount_paise + tb.post_order_amount_paise) * rc.gst_percent / 100.0))
                  ) > tb.total_paid_paise
            ORDER BY tb.slot_start
        `, params);
        res.json(rows);
    } catch (err: any) {
        console.error('[kitchen/dine-in/bill]', err);
        res.status(500).json({ error: 'FAILED' });
    }
});

export default router;
