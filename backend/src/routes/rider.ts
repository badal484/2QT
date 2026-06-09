// @ts-nocheck
import { Router } from 'express';
import { query, withTransaction } from '../db';
import { redis, keys } from '../redis';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { emitToUser, emitToRiders, emitToAdmin, emitToOrder } from '../socket';
import { notificationsQueue, invoicesQueue } from '../jobs/queues';
import { VELTO } from '../config/constants';

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

    // 1. Individual Location Key (for customer tracking)
    await redis.set(keys.riderLocation(riderId), JSON.stringify({ lat, lng, updatedAt: new Date() }), { EX: 30 });

    // 2. SYSTEMATIC INTEGRATION: Zone Capacity Heartbeat
    if (zoneId) {
        const capacityKey = keys.activeRidersInZone(zoneId);
        const now = Date.now();
        
        // Add/Update rider in the zone's active set
        await redis.zAdd(capacityKey, { score: now, value: riderId });
        
        // Cleanup: Remove any riders who haven't pulsed in the last 60 seconds
        await redis.zRemRangeByScore(capacityKey, '-inf', now - 60000);
        
        if (process.env.NODE_ENV === 'development') {
            const count = await redis.zCard(capacityKey);
            console.log(`--- SYSTEMATIC CAPACITY: Zone ${zoneId} has ${count} active Captains ---`);
        }
    }

    const { rows } = await query('SELECT current_order_id FROM users WHERE id = $1', [riderId]);
    if (rows[0]?.current_order_id) {
        emitToOrder(rows[0].current_order_id, 'rider_location', { lat, lng });
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
    await query('UPDATE users SET is_online = false WHERE id = $1', [req.user!.userId]);
    await redis.del(keys.riderLocation(req.user!.userId));
    res.json({ success: true });
});

router.get('/orders/active', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const { rows } = await query(`
        SELECT o.*, 
               u.name as customer_name, 
               u.phone as customer_phone, 
               a.address_text as delivery_address_text,
               a.lat as customer_lat,
               a.lng as customer_lng,
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
    `, [req.user!.userId]);
    
    if (rows[0]) {
        const { rows: items } = await query('SELECT * FROM order_items WHERE order_id = $1', [rows[0].id]);
        rows[0].items = items;
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
    const { rows: userRows } = await query('SELECT name, phone FROM users WHERE id = $1', [order.customer_id]);
    const { rows: riderRows } = await query('SELECT name FROM users WHERE id = $1', [riderId]);
    const customerPhone = userRows[0]?.phone;
    const riderName = riderRows[0]?.name;

    if (customerPhone) {
        if (status === 'out_for_delivery') {
            await notificationsQueue.add('order_out_for_delivery', {
                phone: customerPhone,
                riderName: riderName,
                otp: order.delivery_otp
            });
        }
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

    const { rows: orders } = await query('SELECT * FROM orders WHERE id = $1 AND rider_id = $2', [orderId, riderId]);
    const order = orders[0];

    if (!order) return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
    const isDevTestOtp = process.env.NODE_ENV === 'development' && otp === DEV_TEST_DELIVERY_OTP;
    if (order.delivery_otp !== otp && !isDevTestOtp) return res.status(400).json({ error: 'INVALID_OTP' });

    console.log("[VERIFY-OTP] Starting transaction...");
    await withTransaction(async (client) => {
        console.log("[VERIFY-OTP] Transaction started. Updating orders...");
        await client.query('UPDATE orders SET status = \'delivered\', delivered_at = NOW() WHERE id = $1', [orderId]);
        await client.query('UPDATE users SET current_order_id = NULL WHERE id = $1', [riderId]);
        
        const isCOD = order.payment_method === 'cod';
        const cashToRecord = isCOD ? order.total_amount_paise : 0;

        // Systematic Financial Split
        const basePay = VELTO.RIDER.BASE_EARNINGS_PER_DELIVERY_PAISE;
        const distanceBonus = 1000; // Rs. 10 (Systematic calculation would go here)
        const platformFee = Math.floor(basePay * 0.1); // 10% Velto Commission
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
    emitToUser(riderId, 'earnings_updated', { earningsPaise: VELTO.RIDER.BASE_EARNINGS_PER_DELIVERY_PAISE + 1000 - Math.floor(VELTO.RIDER.BASE_EARNINGS_PER_DELIVERY_PAISE * 0.1) });

    emitToUser(order.customer_id, 'order_status_update', { orderId, status: 'delivered' });
    emitToOrder(orderId, 'order_status_update', { orderId, status: 'delivered' });
    
    // 3. Queue delivery notification and invoice
    const { rows: userRows } = await query('SELECT phone FROM users WHERE id = $1', [order.customer_id]);
    const customerPhone = userRows[0]?.phone;
    
    if (customerPhone) {
        await notificationsQueue.add('order_delivered', { phone: customerPhone });
    }
    await invoicesQueue.add('generate_invoice', { orderId });

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

router.get('/earnings/today', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const { rows } = await query(
        'SELECT deliveries_count as "deliveriesCount", total_paise as "totalPaise", cash_collected_paise as "cashCollectedPaise" FROM rider_daily_earnings WHERE rider_id = $1 AND date = CURRENT_DATE',
        [req.user!.userId]
    );
    res.json(rows[0] || { deliveriesCount: 0, totalPaise: 0, cashCollectedPaise: 0 });
});

router.get('/payouts', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const riderId = req.user!.userId;
    
    // 1. Get payout history
    const { rows: payouts } = await query(
        'SELECT * FROM weekly_payouts WHERE rider_id = $1 ORDER BY week_start DESC',
        [riderId]
    );

    // 2. Calculate actual pending amount: Total Earnings - Total Paid
    const { rows: earningsRes } = await query(
        'SELECT COALESCE(SUM(total_paise), 0) as total FROM rider_daily_earnings WHERE rider_id = $1',
        [riderId]
    );
    const { rows: paidRes } = await query(
        'SELECT COALESCE(SUM(net_amount_paise), 0) as paid FROM weekly_payouts WHERE rider_id = $1 AND status = \'paid\'',
        [riderId]
    );
    
    const pendingAmountPaise = Math.max(0, parseInt(earningsRes[0].total) - parseInt(paidRes[0].paid));

    res.json({ payouts, pendingAmountPaise });
});

router.get('/orders/pool', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const { rows } = await query(`
        SELECT o.*, u.name as customer_name, u.phone as customer_phone, a.address_text as delivery_address_text, a.lat as customer_lat, a.lng as customer_lng,
               k.name as kitchen_name, k.address as kitchen_address, k.lat as kitchen_lat, k.lng as kitchen_lng
        FROM orders o
        JOIN users u ON o.customer_id = u.id
        LEFT JOIN addresses a ON o.address_id = a.id
        LEFT JOIN kitchens k ON o.kitchen_id = k.id
        WHERE o.status IN ('ready_for_pickup', 'confirmed') AND o.rider_id IS NULL
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
            // 1. Check if rider is verified and already busy
            const { rows: rider } = await client.query('SELECT current_order_id, is_verified FROM users WHERE id = $1', [riderId]);
            // In dev, skip verification check
            if (process.env.NODE_ENV !== 'development' && !rider[0]?.is_verified) throw new Error('RIDER_NOT_VERIFIED');
            if (rider[0]?.current_order_id) throw new Error('RIDER_BUSY');

            // Accept ready_for_pickup, confirmed, and preparing orders
            const { rowCount } = await client.query(
                'UPDATE orders SET rider_id = $1 WHERE id = $2 AND rider_id IS NULL AND status IN (\'ready_for_pickup\', \'confirmed\', \'preparing\')',
                [riderId, id]
            );
            if (rowCount === 0) throw new Error('ORDER_UNAVAILABLE');

            // 3. Update rider
            await client.query('UPDATE users SET current_order_id = $1 WHERE id = $2', [id, riderId]);
        });

        // Notify customer
        const { rows: orderRows } = await query('SELECT customer_id, status FROM orders WHERE id = $1', [id]);
        if (orderRows[0]) {
            emitToUser(orderRows[0].customer_id, 'order_status_update', { orderId: id, status: orderRows[0].status });
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
                'UPDATE orders SET rider_id = NULL WHERE id = $1 AND rider_id = $2 AND status IN (\'ready_for_pickup\', \'confirmed\', \'at_kitchen\')',
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
    const { amountPaise } = req.body;

    if (!amountPaise || amountPaise < 10000) { // Min Rs. 100
        return res.status(400).json({ error: 'INVALID_AMOUNT' });
    }

    // Check balance
    const { rows: earningsRes } = await query('SELECT COALESCE(SUM(total_paise), 0) as total FROM rider_daily_earnings WHERE rider_id = $1', [riderId]);
    const { rows: paidRes } = await query('SELECT COALESCE(SUM(net_amount_paise), 0) as paid FROM weekly_payouts WHERE rider_id = $1 AND status = \'paid\'', [riderId]);
    const { rows: pendingRes } = await query('SELECT COALESCE(SUM(net_amount_paise), 0) as pending FROM weekly_payouts WHERE rider_id = $1 AND status = \'pending\'', [riderId]);
    
    const available = parseInt(earningsRes[0].total) - parseInt(paidRes[0].paid) - parseInt(pendingRes[0].pending);

    if (amountPaise > available) {
        return res.status(400).json({ error: 'INSUFFICIENT_BALANCE' });
    }

    await query(`
        INSERT INTO weekly_payouts (rider_id, week_start, week_end, gross_earnings_paise, net_amount_paise, status)
        VALUES ($1, CURRENT_DATE, CURRENT_DATE, $2, $2, 'pending')
    `, [riderId, amountPaise]);

    emitToUser(riderId, 'earnings_updated', { pendingAmountPaise: amountPaise });
    
    res.json({ success: true });
});

export default router;
