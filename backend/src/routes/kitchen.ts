// @ts-nocheck
import { Router } from 'express';
import { query } from '../db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { emitToUser, emitToKitchen, emitToRiders, emitToAdmin, emitToOrder, emitToAll } from '../socket';
import { NotificationService } from '../services/notification.service';
import { redis, keys } from '../redis';

async function getKitchenId(req: AuthRequest, res: any): Promise<string | null> {
    if (req.user!.kitchenId) return req.user!.kitchenId;
    if (req.user!.role === 'super_admin') {
        const { rows } = await query('SELECT id FROM kitchens LIMIT 1');
        if (rows.length > 0) return rows[0].id;
    }
    res.status(400).json({ error: 'KITCHEN_NOT_ASSIGNED' });
    return null;
}

const router = Router();

router.get('/menu', authenticate, requireRole('chef', 'super_admin'), async (req: AuthRequest, res) => {
    const kitchenId = await getKitchenId(req, res);
    if (!kitchenId) return;

    const { rows: zoneRows } = await query('SELECT zone_id FROM kitchen_zones WHERE kitchen_id = $1', [kitchenId]);
    if (zoneRows.length === 0) return res.status(400).json({ error: 'KITCHEN_NOT_IN_ZONE' });
    const zoneId = zoneRows[0].zone_id;

    const { rows } = await query('SELECT id, name, description, price_paise, category, station, available, is_veg, is_egg FROM menu_items WHERE zone_id = $1 ORDER BY name', [zoneId]);
    
    const { rows: kitchenInfo } = await query('SELECT is_paused, pause_reason FROM kitchens WHERE id = $1', [kitchenId]);

    res.json({ 
        menu: rows,
        kitchenPaused: kitchenInfo[0]?.is_paused || false,
        pauseReason: kitchenInfo[0]?.pause_reason || null
    });
});

router.patch('/status', authenticate, requireRole('chef', 'super_admin'), async (req: AuthRequest, res) => {
    const kitchenId = await getKitchenId(req, res);
    if (!kitchenId) return;

    const { paused, reason } = req.body;
    await query('UPDATE kitchens SET is_paused = $1, pause_reason = $2 WHERE id = $3', [paused, reason, kitchenId]);
    
    // Clear cache for the zone
    const { rows: zoneRows } = await query('SELECT zone_id FROM kitchen_zones WHERE kitchen_id = $1', [kitchenId]);
    if (zoneRows.length > 0) {
        await redis.del(keys.menu(zoneRows[0].zone_id));
        emitToAll('menu_updated', { zoneId: zoneRows[0].zone_id });
    }

    res.json({ success: true, isPaused: paused });
});

router.patch('/menu/:itemId/availability', authenticate, requireRole('chef', 'super_admin'), async (req: AuthRequest, res) => {
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

router.get('/orders', authenticate, requireRole('chef', 'super_admin'), async (req: AuthRequest, res) => {
    let rows: any[] = [];
    
    if (req.user!.role === 'super_admin') {
        const result = await query(
            `SELECT o.*, u.name as customer_name
             FROM orders o
             JOIN users u ON o.customer_id = u.id
             WHERE o.status IN ('confirmed', 'preparing', 'ready_for_pickup')
             ORDER BY o.created_at ASC`
        );
        rows = result.rows;
    } else {
        const kitchenId = await getKitchenId(req, res);
        if (!kitchenId) return;
        
        const result = await query(
            `SELECT o.*, u.name as customer_name
             FROM orders o
             JOIN users u ON o.customer_id = u.id
             WHERE o.kitchen_id = $1 AND o.status IN ('confirmed', 'preparing', 'ready_for_pickup')
             ORDER BY o.created_at ASC`,
            [kitchenId]
        );
        rows = result.rows;
    }

    for (const order of rows) {
        const { rows: items } = await query(
            'SELECT menu_item_name as name, quantity, price_paise, station FROM order_items WHERE order_id = $1',
            [order.id]
        );
        order.items = items;
    }

    res.json({ orders: rows });
});

router.post('/orders/:id/claim', authenticate, requireRole('chef', 'super_admin'), async (req: AuthRequest, res) => {
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

router.patch('/orders/:id/status', authenticate, requireRole('chef', 'super_admin'), async (req: AuthRequest, res) => {
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
        if (status === 'preparing') notificationType = 'order_preparing';
        if (status === 'ready_for_pickup') {
            notificationType = 'order_ready';
            emitToRiders('new_available_mission', { orderId: id, displayId: order.display_id }, order.zone_id);
        }
        if (notificationType) {
            NotificationService.send(notificationType as any, {
                userId: order.customer_id,
                displayId: order.display_id,
                orderId: id,
            }).catch(() => {});
        }

        res.json({ order });
    } catch (err: any) {
        res.status(400).json({ error: 'INVALID_TRANSITION', message: err.message });
    }
});

router.get('/inventory', authenticate, requireRole('chef', 'super_admin'), async (req: AuthRequest, res) => {
    const kitchenId = await getKitchenId(req, res);
    if (!kitchenId) return;
    const { rows } = await query(
        `SELECT id, kitchen_id, name, unit, current_stock_grams AS current_stock, reorder_threshold_grams AS reorder_threshold, last_restocked_at, created_at
         FROM ingredients WHERE kitchen_id = $1 ORDER BY name`,
        [kitchenId]
    );
    res.json({ inventory: rows });
});

router.patch('/inventory/:id', authenticate, requireRole('chef', 'super_admin'), async (req: AuthRequest, res) => {
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

        const [kitchen, todayRows, weekRows, monthRows, allRows, payoutRows, recentOrders] = await Promise.all([
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
        ]);

        res.json({
            kitchen: kitchen.rows[0],
            today: todayRows.rows[0],
            thisWeek: weekRows.rows[0],
            thisMonth: monthRows.rows[0],
            allTime: allRows.rows[0],
            payouts: payoutRows.rows,
            recentOrders: recentOrders.rows,
        });
    } catch (err) {
        console.error('[kitchen/my-earnings]', err);
        res.status(500).json({ error: 'Failed to fetch earnings' });
    }
});

// ─── Dispatch: live rider list with GPS + order status ───────────────────────
router.get('/riders/live', authenticate, requireRole('chef', 'super_admin'), async (req: AuthRequest, res) => {
    try {
        const { rows: riders } = await query(`
            SELECT u.id, u.name, u.phone, u.current_order_id, u.is_online,
                   o.status      AS order_status,
                   o.display_id  AS order_display_id,
                   a.address_text AS delivery_address
            FROM users u
            LEFT JOIN orders o ON u.current_order_id = o.id
            LEFT JOIN addresses a ON o.address_id = a.id
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

        res.json({ riders: ridersWithLocation });
    } catch (err: any) {
        res.status(500).json({ error: 'FETCH_FAILED', message: err.message });
    }
});

// ─── Dispatch: manually assign a specific rider to a ready order ──────────────
router.post('/orders/:id/assign-rider', authenticate, requireRole('chef', 'super_admin'), async (req: AuthRequest, res) => {
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
        if (!rider) return res.status(404).json({ error: 'RIDER_NOT_FOUND' });
        if (!rider.is_online) return res.status(409).json({ error: 'RIDER_OFFLINE' });
        if (rider.current_order_id) return res.status(409).json({ error: 'RIDER_BUSY' });

        // Assign atomically
        const { rows: orderRows } = await query(
            `UPDATE orders SET rider_id = $1
             WHERE id = $2 AND rider_id IS NULL AND status = 'ready_for_pickup'
             RETURNING id, display_id, customer_id, kitchen_id, zone_id`,
            [riderId, id]
        );
        if (!orderRows[0]) return res.status(409).json({ error: 'ORDER_UNAVAILABLE' });

        await query('UPDATE users SET current_order_id = $1 WHERE id = $2', [id, riderId]);

        const order = orderRows[0];

        // Push to rider — they'll see accept/decline modal
        emitToUser(riderId, 'order_assigned', {
            orderId: id,
            displayId: order.display_id,
            assignedBy: 'kitchen',
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
router.get('/orders/unassigned', authenticate, requireRole('chef', 'super_admin'), async (req: AuthRequest, res) => {
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
            WHERE o.status = 'ready_for_pickup' AND o.rider_id IS NULL
            ORDER BY o.created_at ASC
        `);

        for (const order of rows) {
            const { rows: items } = await query(
                'SELECT menu_item_name, quantity FROM order_items WHERE order_id = $1',
                [order.id]
            );
            order.items = items;
        }

        res.json({ orders: rows });
    } catch (err: any) {
        res.status(500).json({ error: 'FETCH_FAILED', message: err.message });
    }
});

export default router;
