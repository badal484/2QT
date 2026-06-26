// @ts-nocheck
import { Router } from 'express';
import { query, withTransaction } from '../db';
import { redis, keys } from '../redis';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { emitToUser, emitToRiders, emitToAdmin, emitToOrder } from '../socket';
import { notificationsQueue, invoicesQueue } from '../jobs/queues';
import { TWO_QT } from '../config/constants';
import { pushService } from '../services/push.service';

const router = Router();
const DEV_TEST_DELIVERY_OTP = process.env.TEST_DELIVERY_OTP || '654321';

router.post('/apply', authenticate, async (req: AuthRequest, res) => {
    const { vehicleType, licenseNumber, idPhotoUrl } = req.body;
    const userId = req.user!.userId;

    try {
        // Check if already applied
        const { rows: existing } = await query('SELECT status FROM rider_applications WHERE user_id = $1', [userId]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'ALREADY_APPLIED', message: 'You have already submitted an application.' });
        }

        await query(
            'INSERT INTO rider_applications (user_id, vehicle_type, license_number, id_photo_url, status) VALUES ($1, $2, $3, $4, $5)',
            [userId, vehicleType, licenseNumber, idPhotoUrl || null, 'pending']
        );

        res.json({ success: true, status: 'pending' });
    } catch (err: any) {
        console.error('APPLY_ERROR', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

router.get('/application-status', authenticate, async (req: AuthRequest, res) => {
    const userId = req.user!.userId;
    const { rows } = await query('SELECT * FROM rider_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId]);
    res.json({ application: rows[0] || null });
});

router.post('/location', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const { lat, lng } = req.body;
    const riderId = req.user!.userId;
    const zoneId = req.user!.zoneId;

    // 1. Emit to customer order room immediately (non-blocking)
    const { rows } = await query('SELECT current_order_id FROM users WHERE id = $1', [riderId]);
    if (rows[0]?.current_order_id) {
        emitToOrder(rows[0].current_order_id, 'rider_location', { lat, lng });
    }

    // 2. Persist location to Redis (fire-and-forget, 5 min TTL)
    redis.set(keys.riderLocation(riderId), JSON.stringify({ lat, lng, updatedAt: new Date() }), { EX: 300 })
        .catch(() => {});

    // 3. Zone Capacity Heartbeat (fire-and-forget)
    if (zoneId) {
        const capacityKey = keys.activeRidersInZone(zoneId);
        const now = Date.now();
        redis.zAdd(capacityKey, { score: now, value: riderId })
            .then(() => redis.zRemRangeByScore(capacityKey, '-inf', now - 60000))
            .catch(() => {});
    }

    res.json({ success: true });
});

router.post('/online', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const { rows } = await query('SELECT is_verified FROM users WHERE id = $1', [req.user!.userId]);
    if (!rows[0]?.is_verified) {
        return res.status(403).json({ error: 'NOT_VERIFIED', message: 'Your account is pending administrative approval.' });
    }
    await query('UPDATE users SET is_online = true WHERE id = $1', [req.user!.userId]);
    res.json({ success: true });
});

router.post('/offline', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    // Hard block: cannot go offline while actively delivering an order
    const { rows: active } = await query(
        "SELECT id FROM orders WHERE rider_id = $1 AND status = 'out_for_delivery' LIMIT 1",
        [req.user!.userId]
    );
    if (active.length > 0) {
        return res.status(409).json({
            error: 'ACTIVE_DELIVERY',
            message: 'Complete your current delivery before going offline.',
        });
    }
    await query('UPDATE users SET is_online = false WHERE id = $1', [req.user!.userId]);
    await redis.del(keys.riderLocation(req.user!.userId));
    res.json({ success: true });
});

router.get('/orders/active', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const riderId = req.user!.userId;

    const { rows } = await query(`
        SELECT o.*,
               u.name as customer_name,
               u.phone as customer_phone,
               a.address_text as delivery_address_text,
               CASE
                 WHEN o.delivery_location_lat IS NOT NULL
                      AND (k.lat IS NULL OR ABS(o.delivery_location_lat::numeric - k.lat::numeric) > 0.00001)
                 THEN o.delivery_location_lat
                 WHEN a.lat IS NOT NULL
                      AND (k.lat IS NULL OR ABS(a.lat::numeric - k.lat::numeric) > 0.00001)
                 THEN a.lat
                 ELSE NULL
               END as customer_lat,
               CASE
                 WHEN o.delivery_location_lng IS NOT NULL
                      AND (k.lng IS NULL OR ABS(o.delivery_location_lng::numeric - k.lng::numeric) > 0.00001)
                 THEN o.delivery_location_lng
                 WHEN a.lng IS NOT NULL
                      AND (k.lng IS NULL OR ABS(a.lng::numeric - k.lng::numeric) > 0.00001)
                 THEN a.lng
                 ELSE NULL
               END as customer_lng,
               k.name as kitchen_name,
               k.address as kitchen_address,
               k.lat as kitchen_lat,
               k.lng as kitchen_lng
        FROM orders o
        JOIN users u ON o.customer_id = u.id
        LEFT JOIN addresses a ON o.address_id = a.id
        LEFT JOIN kitchens k ON o.kitchen_id = k.id
        WHERE o.rider_id = $1 AND o.status NOT IN ('delivered', 'cancelled')
        LIMIT 1
    `, [riderId]);

    if (rows[0]) {
        const { rows: items } = await query('SELECT * FROM order_items WHERE order_id = $1', [rows[0].id]);
        rows[0].items = items;
        // Keep current_order_id in sync
        await query('UPDATE users SET current_order_id = $1 WHERE id = $2 AND (current_order_id IS DISTINCT FROM $1)', [rows[0].id, riderId]);
    } else {
        // Auto-recover: no active order found — clear any stale current_order_id
        await query('UPDATE users SET current_order_id = NULL WHERE id = $1 AND current_order_id IS NOT NULL', [riderId]);
    }

    res.json({ order: rows[0] || null });
});

router.patch('/orders/:id/status', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const riderId = req.user!.userId;

    // Development bypass for simulated missions
    if (process.env.NODE_ENV === 'development' && typeof id === 'string' && id.startsWith('MOCK-')) {
        return res.json({ 
            success: true, 
            status, 
            order: { id, display_id: 'VLT-999', status } 
        });
    }

    const { rows } = await query(
        `UPDATE orders SET status = $1 WHERE id = $2 AND rider_id = $3 
         RETURNING id, display_id, customer_id, status, delivery_otp`, 
        [status, id, riderId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
    const order = rows[0];

    // 1. WebSocket Update
    emitToUser(order.customer_id, 'order_status_update', { orderId: id, status });
    emitToOrder(id, 'order_status_update', { orderId: id, status });

    // 2. Notification Queue
    if (status === 'out_for_delivery') {
        const { rows: riderRows } = await query('SELECT name FROM users WHERE id = $1', [riderId]);
        notificationsQueue.add('order_out_for_delivery', {
            userId: order.customer_id,
            riderName: riderRows[0]?.name ?? 'Your rider',
            otp: String(order.delivery_otp ?? ''),
        }).catch(e => console.error('[Queue] out_for_delivery notif failed:', e.message));
    }

    res.json({ success: true, status });
});

router.post('/verify-otp', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const { orderId, otp } = req.body;
    const riderId = req.user!.userId;

    // Development bypass for simulated missions
    if (process.env.NODE_ENV === 'development' && orderId.startsWith('MOCK-')) {
        return res.json({ success: true });
    }

    const { rows: orders } = await query(`
        SELECT o.*, 
               k.lat as kitchen_lat, k.lng as kitchen_lng, 
               a.lat as address_lat, a.lng as address_lng
        FROM orders o
        JOIN kitchens k ON o.kitchen_id = k.id
        LEFT JOIN addresses a ON o.address_id = a.id
        WHERE o.id = $1 AND o.rider_id = $2
    `, [orderId, riderId]);
    const order = orders[0];

    if (!order) return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
    if (order.status === 'delivered') {
        return res.status(400).json({ error: 'ALREADY_DELIVERED', message: 'Order has already been delivered.' });
    }
    const isDevTestOtp = process.env.NODE_ENV === 'development' && otp === DEV_TEST_DELIVERY_OTP;
    if (order.delivery_otp !== otp && !isDevTestOtp) return res.status(400).json({ error: 'INVALID_OTP' });

    console.log("[VERIFY-OTP] Starting transaction...");
    await withTransaction(async (client) => {
        console.log("[VERIFY-OTP] Transaction started. Updating orders...");
        const updateRes = await client.query('UPDATE orders SET status = \'delivered\', delivered_at = NOW() WHERE id = $1 AND status = \'out_for_delivery\'', [orderId]);
        if (updateRes.rowCount === 0) {
            throw new Error('ALREADY_DELIVERED');
        }
        await client.query('UPDATE users SET current_order_id = NULL WHERE id = $1', [riderId]);
        
        const isCOD = order.payment_method === 'cod';
        const cashToRecord = isCOD ? order.total_amount_paise : 0;

        // Systematic Financial Split
        const kLat = parseFloat(order.kitchen_lat);
        const kLng = parseFloat(order.kitchen_lng);
        const cLat = parseFloat(order.delivery_location_lat || order.address_lat);
        const cLng = parseFloat(order.delivery_location_lng || order.address_lng);

        let distanceKm = 0;
        if (!isNaN(kLat) && !isNaN(kLng) && !isNaN(cLat) && !isNaN(cLng)) {
            const R = 6371;
            const dLat = (cLat - kLat) * (Math.PI / 180);
            const dLng = (cLng - kLng) * (Math.PI / 180);
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                      Math.cos(kLat * (Math.PI / 180)) * Math.cos(cLat * (Math.PI / 180)) *
                      Math.sin(dLng / 2) * Math.sin(dLng / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            distanceKm = R * c;
        }

        const basePay = TWO_QT.RIDER.BASE_EARNINGS_PER_DELIVERY_PAISE;
        const distanceBonus = distanceKm > 2 ? Math.floor((distanceKm - 2) * 500) : 0; // Rs. 5 per extra km
        const platformFee = Math.floor(basePay * 0.1); // 10% 2QT Commission
        const netEarnings = basePay + distanceBonus - platformFee;

        console.log("[VERIFY-OTP] Updating earnings...", netEarnings);
        await client.query(`
            INSERT INTO rider_daily_earnings (
                rider_id, date, deliveries_count, 
                base_earnings_paise, bonus_earnings_paise, total_paise, cash_collected_paise
            )
            VALUES ($1, CURRENT_DATE, 1, $3, $4, $5, $2)
            ON CONFLICT (rider_id, date) DO UPDATE SET
                deliveries_count = rider_daily_earnings.deliveries_count + 1,
                base_earnings_paise = rider_daily_earnings.base_earnings_paise + $3,
                bonus_earnings_paise = COALESCE(rider_daily_earnings.bonus_earnings_paise, 0) + $4,
                total_paise = rider_daily_earnings.total_paise + $5,
                cash_collected_paise = COALESCE(rider_daily_earnings.cash_collected_paise, 0) + $2
        `, [riderId, cashToRecord, basePay, distanceBonus, netEarnings]);
        
        // Record in rider wallet/ledger (No wallet_balance_paise in users table, rider payments handled via payouts)
        console.log("[VERIFY-OTP] Transaction done.");
    });

    // Notify Rider of net earnings update
    emitToUser(riderId, 'earnings_updated', { earningsPaise: TWO_QT.RIDER.BASE_EARNINGS_PER_DELIVERY_PAISE });

    emitToUser(order.customer_id, 'order_status_update', { orderId, status: 'delivered' });
    emitToOrder(orderId, 'order_status_update', { orderId, status: 'delivered' });
    
    // 3. Queue delivery notification and invoice (fire-and-forget — Redis limit must not kill delivery)
    notificationsQueue.add('order_delivered', { userId: order.customer_id }).catch(e => console.error('[Queue] delivered notif failed:', e.message));
    invoicesQueue.add('generate_invoice', { orderId }).catch(e => console.error('[Queue] invoice failed:', e.message));

    res.json({ success: true });
});

router.get('/stats', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const riderId = req.user!.userId;

    const { rows: lifetime } = await query(`
        SELECT COALESCE(SUM(deliveries_count), 0) as "totalDeliveries",
               COALESCE(SUM(total_paise), 0) as "totalEarnings"
        FROM rider_daily_earnings
        WHERE rider_id = $1
    `, [riderId]);

    const { rows: week } = await query(`
        SELECT COALESCE(SUM(total_paise), 0) as "weekEarnings"
        FROM rider_daily_earnings
        WHERE rider_id = $1 AND date >= CURRENT_DATE - INTERVAL '7 days'
    `, [riderId]);

    const { rows: rating } = await query(`
        SELECT AVG(f.delivery_rating) as avg_rating
        FROM order_feedback f
        JOIN orders o ON f.order_id = o.id
        WHERE o.rider_id = $1
    `, [riderId]);

    res.json({
        totalDeliveries: parseInt(lifetime[0].totalDeliveries),
        totalEarnings: parseInt(lifetime[0].totalEarnings),
        weekEarnings: parseInt(week[0].weekEarnings),
        rating: parseFloat(rating[0].avg_rating || '5.0')
    });
});

router.get('/earnings/history', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const { rows } = await query(
        'SELECT * FROM rider_daily_earnings WHERE rider_id = $1 ORDER BY date DESC LIMIT 30',
        [req.user!.userId]
    );
    res.json({ earnings: rows });
});

router.get('/earnings/today', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const { rows } = await query(
        'SELECT deliveries_count as "deliveriesCount", total_paise as "totalPaise", cash_collected_paise as "cashCollectedPaise" FROM rider_daily_earnings WHERE rider_id = $1 AND date = CURRENT_DATE',
        [req.user!.userId]
    );
    res.json(rows[0] || { deliveriesCount: 0, totalPaise: 0, cashCollectedPaise: 0 });
});

router.get('/payouts', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const riderId = req.user!.userId;

    const [payoutsRes, earningsRes, paidRes, profileRes, todayRes] = await Promise.all([
        query('SELECT * FROM weekly_payouts WHERE rider_id = $1 ORDER BY week_start DESC', [riderId]),
        query('SELECT COALESCE(SUM(total_paise), 0) as total FROM rider_daily_earnings WHERE rider_id = $1', [riderId]),
        query(`SELECT COALESCE(SUM(net_amount_paise), 0) as paid FROM weekly_payouts WHERE rider_id = $1 AND status = 'paid'`, [riderId]),
        query('SELECT upi_id FROM users WHERE id = $1', [riderId]),
        query('SELECT deliveries_count, total_paise FROM rider_daily_earnings WHERE rider_id = $1 AND date = CURRENT_DATE', [riderId]),
    ]);

    const pendingAmountPaise = Math.max(0, parseInt(earningsRes.rows[0].total) - parseInt(paidRes.rows[0].paid));
    const today = todayRes.rows[0] || { deliveries_count: 0, total_paise: 0 };

    res.json({
        payouts: payoutsRes.rows,
        pendingAmountPaise,
        storedUpiId: profileRes.rows[0]?.upi_id || null,
        todayDeliveries: parseInt(today.deliveries_count),
        todayEarningsPaise: parseInt(today.total_paise),
    });
});

router.get('/orders/pool', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const { rows } = await query(`
        SELECT o.*, u.name as customer_name, u.phone as customer_phone, a.address_text as delivery_address_text, a.lat as customer_lat, a.lng as customer_lng,
               k.name as kitchen_name, k.address as kitchen_address, k.lat as kitchen_lat, k.lng as kitchen_lng
        FROM orders o
        JOIN users u ON o.customer_id = u.id
        LEFT JOIN addresses a ON o.address_id = a.id
        LEFT JOIN kitchens k ON o.kitchen_id = k.id
        WHERE o.status = 'ready_for_pickup' AND o.rider_id IS NULL
        ORDER BY o.created_at ASC
    `);
    
    for (const order of rows) {
        const { rows: items } = await query('SELECT menu_item_name, quantity FROM order_items WHERE order_id = $1', [order.id]);
        order.items = items;
    }

    res.json({ orders: rows });
});

router.get('/orders/history', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const riderId = req.user!.userId;
    const { rows } = await query(`
        SELECT o.*, u.name as customer_name, a.address_text as delivery_address_text, a.lat as customer_lat, a.lng as customer_lng
        FROM orders o
        JOIN users u ON o.customer_id = u.id
        LEFT JOIN addresses a ON o.address_id = a.id
        WHERE o.rider_id = $1 AND o.status IN ('delivered', 'cancelled')
        ORDER BY o.delivered_at DESC, o.created_at DESC
        LIMIT 50
    `, [riderId]);

    for (const order of rows) {
        const { rows: items } = await query('SELECT menu_item_name, quantity FROM order_items WHERE order_id = $1', [order.id]);
        order.items = items;
    }

    res.json({ orders: rows });
});

router.post('/orders/:id/claim', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const { id } = req.params;
    const riderId = req.user!.userId;

    try {
        await withTransaction(async (client) => {
            // 1. Check if rider is verified and already busy (with FOR UPDATE lock to prevent claim race conditions)
            const { rows: rider } = await client.query('SELECT current_order_id, is_verified FROM users WHERE id = $1 FOR UPDATE', [riderId]);
            // In dev, skip verification check
            if (process.env.NODE_ENV !== 'development' && !rider[0]?.is_verified) throw new Error('RIDER_NOT_VERIFIED');
            if (rider[0]?.current_order_id) throw new Error('RIDER_BUSY');

            const { rowCount } = await client.query(
                "UPDATE orders SET rider_id = $1 WHERE id = $2 AND rider_id IS NULL AND status = 'ready_for_pickup'",
                [riderId, id]
            );
            if (rowCount === 0) throw new Error('ORDER_UNAVAILABLE');

            // 3. Update rider
            await client.query('UPDATE users SET current_order_id = $1 WHERE id = $2', [id, riderId]);
        });

        // Notify customer — include rider info so buyer app updates immediately without waiting for next poll
        const { rows: orderRows } = await query(
            `SELECT o.customer_id, o.status, u.name as rider_name, u.phone as rider_phone
             FROM orders o JOIN users u ON u.id = $2 WHERE o.id = $1`,
            [id, riderId]
        );
        if (orderRows[0]) {
            emitToUser(orderRows[0].customer_id, 'order_status_update', {
                orderId: id,
                status: orderRows[0].status,
                riderAssigned: true,
                riderName: orderRows[0].rider_name,
                riderPhone: orderRows[0].rider_phone,
            });
        }

        res.json({ success: true });
    } catch (err: any) {
        res.status(400).json({ error: 'CLAIM_FAILED', message: err.message });
    }
});

router.post('/orders/:id/unclaim', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const { id } = req.params;
    const riderId = req.user!.userId;

    try {
        await withTransaction(async (client) => {
            // 1. Verify rider actually owns this order
            const { rowCount } = await client.query(
                "UPDATE orders SET rider_id = NULL WHERE id = $1 AND rider_id = $2 AND status IN ('ready_for_pickup', 'confirmed', 'preparing')",
                [id, riderId]
            );
            
            if (rowCount === 0) throw new Error('CANNOT_UNCLAIM');

            // 2. Update rider state
            await client.query('UPDATE users SET current_order_id = NULL WHERE id = $1', [riderId]);
        });

        res.json({ success: true });
    } catch (err: any) {
        res.status(400).json({ error: 'UNCLAIM_FAILED', message: err.message });
    }
});

router.get('/', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const { rows } = await query(
        'SELECT * FROM rider_daily_earnings WHERE rider_id = $1 ORDER BY date DESC LIMIT 30',
        [req.user!.userId]
    );
    res.json({ earnings: rows });
});

router.post('/payouts/request', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const riderId = req.user!.userId;
    const { amountPaise, upiId } = req.body;

    if (!amountPaise || amountPaise < 10000) { // Min Rs. 100
        return res.status(400).json({ error: 'INVALID_AMOUNT' });
    }

    try {
        await withTransaction(async (client) => {
            // Lock the rider user row to prevent race conditions (double withdrawal requests)
            await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [riderId]);

            // Check balance using the transaction client
            const { rows: earningsRes } = await client.query('SELECT COALESCE(SUM(total_paise), 0) as total FROM rider_daily_earnings WHERE rider_id = $1', [riderId]);
            const { rows: paidRes } = await client.query('SELECT COALESCE(SUM(net_amount_paise), 0) as paid FROM weekly_payouts WHERE rider_id = $1 AND status = \'paid\'', [riderId]);
            const { rows: pendingRes } = await client.query('SELECT COALESCE(SUM(net_amount_paise), 0) as pending FROM weekly_payouts WHERE rider_id = $1 AND status = \'pending\'', [riderId]);
            
            const available = parseInt(earningsRes[0].total) - parseInt(paidRes[0].paid) - parseInt(pendingRes[0].pending);

            if (amountPaise > available) {
                throw new Error('INSUFFICIENT_BALANCE');
            }

            await client.query(`
                INSERT INTO weekly_payouts (rider_id, week_start, week_end, net_amount_paise, status, upi_id)
                VALUES ($1, CURRENT_DATE, CURRENT_DATE, $2, 'pending', $3)
            `, [riderId, amountPaise, upiId || null]);
        });

        emitToUser(riderId, 'earnings_updated', { pendingAmountPaise: amountPaise });
        res.json({ success: true });
    } catch (err: any) {
        let errorType = 'SERVER_ERROR';
        let errorMessage = err.message;
        if (err.message === 'INSUFFICIENT_BALANCE') {
            errorType = 'INSUFFICIENT_BALANCE';
        } else if (err.code === '23505') {
            errorType = 'ALREADY_REQUESTED_TODAY';
            errorMessage = 'You can only request one instant settlement per day.';
        }
        res.status(400).json({ error: errorType, message: errorMessage });
    }
});

// ─── Confirm Door Payment (UPI at door or Cash) ───────────────────────────────
// Called just before OTP. Records how the customer paid at the door.
// UPI → payment_status='paid', cod_cash_collected=TRUE (no cash with rider)
// Cash → keep payment_status='cod_pending' (finance collects cash from rider later)
router.post('/confirm-door-payment', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const { orderId, method } = req.body as { orderId: string; method: 'upi' | 'cash' };
    if (!orderId || !method || !['upi', 'cash'].includes(method)) {
        return res.status(400).json({ error: 'orderId and method (upi|cash) required' });
    }
    const riderId = req.user!.userId;

    try {
        const { rows } = await query(
            `SELECT id, payment_method, status FROM orders WHERE id = $1 AND rider_id = $2`,
            [orderId, riderId]
        );
        if (!rows.length) return res.status(404).json({ error: 'Order not found' });
        const order = rows[0];

        if (order.payment_method !== 'cod') {
            return res.status(400).json({ error: 'Order is not a COD order' });
        }
        if (order.status !== 'out_for_delivery') {
            return res.status(400).json({ error: 'Order is not out for delivery' });
        }

        if (method === 'upi') {
            await query(
                `UPDATE orders
                 SET payment_status = 'paid',
                     cod_cash_collected = TRUE,
                     cod_collected_at = NOW()
                 WHERE id = $1`,
                [orderId]
            );
        }
        // For 'cash': no update needed — already cod_pending from order placement

        res.json({ success: true, method });
    } catch (err) {
        console.error('[rider/confirm-door-payment]', err);
        res.status(500).json({ error: 'Failed to confirm payment' });
    }
});

// POST /riders/submit-cash-to-finance
// Rider physically hands cash to finance person at kitchen and taps this button.
// Creates a real-time signal in the finance COD dashboard.
router.post('/submit-cash-to-finance', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const { orderId } = req.body;
    const riderId = req.user!.userId;

    if (!orderId) return res.status(400).json({ error: 'orderId required' });

    try {
        const { rows } = await query(
            `SELECT id, payment_method, status, cod_cash_collected, total_amount_paise, display_id
             FROM orders WHERE id = $1 AND rider_id = $2`,
            [orderId, riderId]
        );
        if (!rows.length) return res.status(404).json({ error: 'Order not found' });
        const order = rows[0];

        if (order.payment_method !== 'cod') return res.status(400).json({ error: 'Not a COD order' });
        if (order.status !== 'delivered') return res.status(400).json({ error: 'Order not yet delivered' });
        if (order.cod_cash_collected) return res.status(409).json({ error: 'Cash already confirmed by finance' });

        await query(
            'UPDATE orders SET cash_submit_requested_at = NOW() WHERE id = $1',
            [orderId]
        );

        res.json({
            success: true,
            message: 'Finance has been notified. Hand over the cash and wait for confirmation.',
            amountPaise: order.total_amount_paise,
            displayId: order.display_id,
        });
    } catch (err) {
        console.error('[rider/submit-cash-to-finance]', err);
        res.status(500).json({ error: 'Failed to submit' });
    }
});

// Rider saves their UPI ID for daily auto-payout
router.patch('/upi', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const { upiId } = req.body as { upiId: string };
    if (!upiId?.trim()) return res.status(400).json({ error: 'upiId required' });
    const riderId = req.user!.userId;
    try {
        // Clear stored fund account so it gets recreated with new UPI
        await query(
            `UPDATE users SET upi_id = $1, razorpay_fund_account_id = NULL WHERE id = $2`,
            [upiId.trim(), riderId]
        );
        res.json({ success: true, message: 'UPI saved — daily auto-payout enabled' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save UPI' });
    }
});

export default router;
