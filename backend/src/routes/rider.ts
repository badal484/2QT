// @ts-nocheck
import { Router } from 'express';
import { query, withTransaction } from '../db';
import { redis, keys } from '../redis';
import { authenticate, requireRole, AuthRequest, invalidateUserCache } from '../middleware/auth';
import { emitToUser, emitToRiders, emitToAdmin, emitToOrder, emitToKitchen } from '../socket';
import { unassignAndReassign } from '../services/autoAssign';
import { invoicesQueue } from '../jobs/queues';
import { NotificationService } from '../services/notification.service';
import { scheduleTriggerSend, cancelTriggerJobs } from '../services/trigger.service';
import { TWO_QT } from '../config/constants';
import { pushService } from '../services/push.service';
import Razorpay from 'razorpay';

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || '',
    key_secret: process.env.RAZORPAY_KEY_SECRET || '',
});

const router = Router();
const DEV_TEST_DELIVERY_OTP = process.env.TEST_DELIVERY_OTP || '654321';

// Update mission progress after a delivery completes
async function updateMissionProgress(riderId: string): Promise<void> {
    const [todayRes, weekRes] = await Promise.all([
        query(`SELECT deliveries_count, total_paise FROM rider_daily_earnings WHERE rider_id = $1 AND date = CURRENT_DATE`, [riderId]),
        query(`SELECT COALESCE(SUM(deliveries_count),0)::int AS w_del, COALESCE(SUM(total_paise),0)::int AS w_paise FROM rider_daily_earnings WHERE rider_id = $1 AND date >= date_trunc('week', CURRENT_DATE)`, [riderId]),
    ]);
    const todayDeliveries = parseInt(todayRes.rows[0]?.deliveries_count || '0');
    const todayPaise      = parseInt(todayRes.rows[0]?.total_paise     || '0');
    const weekDeliveries  = parseInt(weekRes.rows[0]?.w_del   || '0');
    const weekPaise       = parseInt(weekRes.rows[0]?.w_paise || '0');

    const { rows: missions } = await query(`
        SELECT rm.id, rm.tier_reached, rm.bonus_awarded_paise, rm.status,
               mt.type, mt.tiers, mt.window_type, mt.title
        FROM rider_missions rm
        JOIN mission_templates mt ON mt.id = rm.template_id
        WHERE rm.rider_id = $1 AND rm.status = 'active'
          AND ((mt.window_type = 'daily'  AND rm.date = CURRENT_DATE)
           OR  (mt.window_type = 'weekly' AND rm.date = date_trunc('week', CURRENT_DATE)::date))
    `, [riderId]);

    for (const m of missions) {
        const liveProgress = m.type === 'delivery_count'
            ? (m.window_type === 'daily' ? todayDeliveries : weekDeliveries)
            : (m.window_type === 'daily' ? todayPaise      : weekPaise);

        const tiers: Array<{ target: number; reward_paise: number; label: string }> = m.tiers || [];
        let newTierReached = 0;
        let newTotalBonus  = 0;
        for (let i = 0; i < tiers.length; i++) {
            if (liveProgress >= tiers[i].target) { newTierReached = i + 1; newTotalBonus += tiers[i].reward_paise; }
        }

        if (newTierReached > m.tier_reached) {
            const bonusToGive = newTotalBonus - m.bonus_awarded_paise;
            const allDone     = newTierReached === tiers.length;
            await query(`UPDATE rider_missions SET progress=$2, tier_reached=$3, bonus_awarded_paise=$4, status=$5, completed_at=CASE WHEN $5='completed' THEN NOW() ELSE completed_at END, updated_at=NOW() WHERE id=$1`,
                [m.id, liveProgress, newTierReached, newTotalBonus, allDone ? 'completed' : 'active']);
            if (bonusToGive > 0) {
                await query(`INSERT INTO rider_daily_earnings (rider_id,date,deliveries_count,base_earnings_paise,bonus_earnings_paise,total_paise) VALUES ($1,CURRENT_DATE,0,0,$2,$2) ON CONFLICT (rider_id,date) DO UPDATE SET bonus_earnings_paise=COALESCE(rider_daily_earnings.bonus_earnings_paise,0)+$2, total_paise=rider_daily_earnings.total_paise+$2`, [riderId, bonusToGive]);
                const tierLabel = tiers[newTierReached - 1]?.label || '';
                NotificationService.send('broadcast_message', { userId: riderId, title: `🎯 Mission Tier Unlocked — ${tierLabel}`, body: `"${m.title}" ${tierLabel} complete! ₹${(bonusToGive / 100).toFixed(0)} bonus added.`, screen: 'Missions' }).catch(() => {});
            }
        } else {
            await query(`UPDATE rider_missions SET progress=$2, updated_at=NOW() WHERE id=$1`, [m.id, liveProgress]);
        }
    }
}

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
    try {
        const { rows } = await query('SELECT * FROM rider_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId]);
        res.json({ application: rows[0] || null });
    } catch (err) {
        console.error('[application-status]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

router.post('/location', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const { lat, lng } = req.body;
    const riderId = req.user!.userId;
    const zoneId = req.user!.zoneId;

    try {
        // 1. Emit to customer order rooms immediately (non-blocking)
        const { rows } = await query("SELECT id FROM orders WHERE rider_id = $1 AND status NOT IN ('delivered', 'cancelled')", [riderId]);
        for (const row of rows) {
            emitToOrder(row.id, 'rider_location', { lat, lng });
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
    } catch (err) {
        console.error('[location]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

// Haversine distance in km
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Returns all active zones with their primary kitchen — used by unzoned riders to navigate to the nearest hub
router.get('/available-zones', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (_req: AuthRequest, res) => {
    try {
        const { rows } = await query(`
            SELECT DISTINCT ON (z.id)
                   z.id, z.name, z.radius_km, z.kitchen_lat, z.kitchen_lng,
                   k.name as kitchen_name, k.address as kitchen_address
            FROM zones z
            LEFT JOIN kitchens k ON k.zone_id = z.id
            WHERE z.is_active = true OR z.is_active IS NULL
            ORDER BY z.id, z.name ASC
            LIMIT 20
        `);
        res.json({ zones: rows });
    } catch (err) {
        console.error('[available-zones]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

// Auto-assign rider to the nearest zone if they are within its radius (± 1 km buffer)
router.post('/zone/check-in', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const riderId = req.user!.userId;
    if (req.user!.zoneId) return res.json({ success: true, alreadyAssigned: true });

    const { lat, lng } = req.body;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });

    try {
        const { rows: zones } = await query(`
            SELECT z.id, z.name, z.radius_km, z.kitchen_lat, z.kitchen_lng
            FROM zones z
            WHERE z.is_active = true OR z.is_active IS NULL
            ORDER BY z.name ASC
        `);

        const BUFFER_KM = 1;
        let nearest: { id: string; name: string; dist: number } | null = null;

        for (const z of zones) {
            const dist = haversineKm(lat, lng, parseFloat(z.kitchen_lat), parseFloat(z.kitchen_lng));
            if (dist <= parseFloat(z.radius_km) + BUFFER_KM) {
                if (!nearest || dist < nearest.dist) nearest = { id: z.id, name: z.name, dist };
            }
        }

        if (!nearest) {
            return res.status(422).json({ error: 'NOT_IN_RANGE', message: 'You must move into the delivery zone to receive orders.' });
        }

        await query('UPDATE users SET zone_id = $1 WHERE id = $2', [nearest.id, riderId]);
        invalidateUserCache(riderId);
        res.json({ success: true, zoneName: nearest.name });
    } catch (err) {
        console.error('[zone/check-in]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

router.post('/online', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    try {
        const { rows } = await query('SELECT is_verified FROM users WHERE id = $1', [req.user!.userId]);
        if (!rows[0]?.is_verified) {
            return res.status(403).json({ error: 'NOT_VERIFIED', message: 'Your account is pending administrative approval.' });
        }
        await query('UPDATE users SET is_online = true WHERE id = $1', [req.user!.userId]);
        res.json({ success: true });
    } catch (err) {
        console.error('[online]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

router.post('/offline', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    try {
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
        redis.del(keys.riderLocation(req.user!.userId)).catch(() => {});
        res.json({ success: true });
    } catch (err) {
        console.error('[offline]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

// Rider opts out of an auto-assigned order within the 30s window
router.post('/orders/:id/mark-unavailable', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const riderId = req.user!.userId;
    const { id: orderId } = req.params;
    try {
        await unassignAndReassign(orderId, riderId);
        res.json({ ok: true });
    } catch (err) {
        console.error('[mark-unavailable]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

router.post('/orders/:id/skip', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const riderId = req.user!.userId;
    const { id } = req.params;
    // Log skip for acceptance rate tracking — non-blocking
    query(
        'INSERT INTO rider_order_events (rider_id, order_id, event_type) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [riderId, id, 'skipped'],
    ).catch(() => {});
    res.json({ ok: true });
});

router.get('/orders/active', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const riderId = req.user!.userId;
    try {

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
        ORDER BY o.created_at ASC
    `, [riderId]);

    for (const order of rows) {
        const { rows: items } = await query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
        order.items = items;
    }

    res.json({ orders: rows });
    } catch (err) {
        console.error('[orders/active]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
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

    try {
        const { rows } = await query(
            `UPDATE orders SET status = $1 WHERE id = $2 AND rider_id = $3
             RETURNING id, display_id, customer_id, status, delivery_otp`,
            [status, id, riderId]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
        const order = rows[0];

        emitToUser(order.customer_id, 'order_status_update', { orderId: id, status });
        emitToOrder(id, 'order_status_update', { orderId: id, status });

        if (status === 'out_for_delivery') {
            const { rows: riderRows } = await query('SELECT name FROM users WHERE id = $1', [riderId]);
            NotificationService.send('order_out_for_delivery', {
                userId: order.customer_id,
                displayId: order.display_id,
                orderId: id,
                riderName: riderRows[0]?.name ?? 'Your rider',
                otp: String(order.delivery_otp ?? ''),
            }).catch(() => {});
        }

        res.json({ success: true, status });
    } catch (err) {
        console.error('[orders/status]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

// Resend delivery OTP to customer
router.post('/resend-otp', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const { orderId } = req.body;
    const riderId = req.user!.userId;
    try {
        const { rows } = await query(
            `SELECT o.id, o.display_id, o.customer_id, o.delivery_otp, o.status
             FROM orders o WHERE o.id = $1 AND o.rider_id = $2`,
            [orderId, riderId]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
        const order = rows[0];
        if (order.status !== 'out_for_delivery') return res.status(400).json({ error: 'ORDER_NOT_OUT_FOR_DELIVERY' });

        // Re-send OTP notification to customer
        NotificationService.send('order_out_for_delivery', {
            userId: order.customer_id,
            displayId: order.display_id,
            orderId: order.id,
            riderName: 'Your rider',
            otp: String(order.delivery_otp ?? ''),
        }).catch(() => {});

        res.json({ success: true });
    } catch (err) {
        console.error('[resend-otp]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

router.post('/verify-otp', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const { orderId, otp, podPhotoUrl } = req.body;
    const riderId = req.user!.userId;

    // Development bypass for simulated missions
    if (process.env.NODE_ENV === 'development' && orderId.startsWith('MOCK-')) {
        return res.json({ success: true });
    }

    try {

    const { rows: orders } = await query(`
        SELECT o.*,
               k.lat as kitchen_lat, k.lng as kitchen_lng,
               a.lat as address_lat, a.lng as address_lng,
               z.rider_base_pay_paise, z.rider_per_km_paise, z.rider_free_km
        FROM orders o
        JOIN kitchens k ON o.kitchen_id = k.id
        LEFT JOIN addresses a ON o.address_id = a.id
        LEFT JOIN zones z ON o.zone_id = z.id
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
        const updateRes = await client.query(
            'UPDATE orders SET status = \'delivered\', delivered_at = NOW(), pod_photo_url = $2 WHERE id = $1 AND status = \'out_for_delivery\'',
            [orderId, podPhotoUrl || null],
        );
        if (updateRes.rowCount === 0) {
            throw new Error('ALREADY_DELIVERED');
        }
        // Legacy compatibility
        await client.query('UPDATE users SET current_order_id = NULL WHERE id = $1', [riderId]);
        
        const isCOD = order.payment_method === 'cod';
        const cashToRecord = isCOD ? order.total_amount_paise : 0;

        // Systematic Financial Split — use only real Google Maps road distance for earnings
        // If not yet computed (order placed before feature), distance = 0, no km bonus
        const distanceKm = (order.delivery_distance_metres != null && order.delivery_distance_metres > 0)
            ? order.delivery_distance_metres / 1000
            : 0;

        const basePay = order.rider_base_pay_paise ?? TWO_QT.RIDER.BASE_EARNINGS_PER_DELIVERY_PAISE;
        const perKmPaise = order.rider_per_km_paise ?? 500;
        const freeKm = parseFloat(order.rider_free_km ?? '2');
        const distanceBonus = distanceKm > freeKm ? Math.floor((distanceKm - freeKm) * perKmPaise) : 0;
        const tipPaise = parseInt(order.rider_tip_paise || '0', 10);
        const platformFee = Math.floor(basePay * 0.1); // 10% platform commission
        const bonusPaise = distanceBonus + tipPaise;
        const netEarnings = basePay + bonusPaise - platformFee;

        console.log("[VERIFY-OTP] Updating earnings...", { netEarnings, tipPaise, distanceBonus });
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
        `, [riderId, cashToRecord, basePay, bonusPaise, netEarnings]);

        console.log("[VERIFY-OTP] Transaction done.");
    });

    // Update mission progress after delivery (fire-and-forget)
    updateMissionProgress(riderId).catch((e) =>
        console.error('[missions] progress update failed:', e));

    // Update streak: if last_active_date was yesterday → increment, if today → no-op, else reset to 1
    try {
        await query(`
            UPDATE users SET
                last_active_date = CURRENT_DATE,
                current_streak_days = CASE
                    WHEN last_active_date = CURRENT_DATE - INTERVAL '1 day' THEN current_streak_days + 1
                    WHEN last_active_date = CURRENT_DATE                     THEN current_streak_days
                    ELSE 1
                END,
                longest_streak_days = GREATEST(longest_streak_days, CASE
                    WHEN last_active_date = CURRENT_DATE - INTERVAL '1 day' THEN current_streak_days + 1
                    WHEN last_active_date = CURRENT_DATE                     THEN current_streak_days
                    ELSE 1
                END)
            WHERE id = $1
        `, [riderId]);
    } catch (e) {
        console.error('[verify-otp] streak update failed:', e);
    }

    // Notify Rider of net earnings update (app will refetch exact figure)
    const tipForNotif = parseInt(order.rider_tip_paise || '0', 10);
    emitToUser(riderId, 'earnings_updated', { earningsPaise: TWO_QT.RIDER.BASE_EARNINGS_PER_DELIVERY_PAISE, tipPaise: tipForNotif });

    emitToUser(order.customer_id, 'order_status_update', { orderId, status: 'delivered' });
    emitToOrder(orderId, 'order_status_update', { orderId, status: 'delivered' });
    
    // 3. Queue delivery notification and invoice (fire-and-forget — Redis limit must not kill delivery)
    NotificationService.send('order_delivered', { userId: order.customer_id, orderId }).catch(() => {});
    invoicesQueue.add('generate_invoice', { orderId }).catch(e => console.error('[Queue] invoice failed:', e.message));

    // 4. Schedule trigger rules (e.g. rating reminder fires 45 min after delivery)
    scheduleTriggerSend('order_delivered', order.customer_id, { orderId }).catch(() => {});

    res.json({ success: true });
    } catch (err: any) {
        if (err.message === 'ALREADY_DELIVERED') return res.status(400).json({ error: 'ALREADY_DELIVERED' });
        console.error('[verify-otp]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

router.get('/stats', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const riderId = req.user!.userId;
    try {

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

    // Acceptance rate — rolling 30 days
    const { rows: acceptance } = await query(`
        SELECT
            COUNT(*) FILTER (WHERE event_type = 'claimed')   AS claimed,
            COUNT(*) FILTER (WHERE event_type IN ('unclaimed', 'skipped')) AS skipped
        FROM rider_order_events
        WHERE rider_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
    `, [riderId]);
    const claimed = parseInt(acceptance[0].claimed || '0');
    const skipped = parseInt(acceptance[0].skipped || '0');
    const total = claimed + skipped;
    const acceptanceRate = total > 0 ? Math.round((claimed / total) * 100) : 100;

    // Completion rate — delivered vs cancelled after claiming, rolling 30 days
    const { rows: completion } = await query(`
        SELECT
            COUNT(*) FILTER (WHERE o.status = 'delivered')  AS delivered,
            COUNT(*) FILTER (WHERE o.status = 'cancelled')  AS cancelled
        FROM orders o
        JOIN rider_order_events roe ON roe.order_id = o.id AND roe.rider_id = o.rider_id AND roe.event_type = 'claimed'
        WHERE o.rider_id = $1 AND roe.created_at >= NOW() - INTERVAL '30 days'
    `, [riderId]);
    const delivered = parseInt(completion[0].delivered || '0');
    const cancelled = parseInt(completion[0].cancelled || '0');
    const compTotal = delivered + cancelled;
    const completionRate = compTotal > 0 ? Math.round((delivered / compTotal) * 100) : 100;

    // Tier — based on lifetime deliveries
    const totalDel = parseInt(lifetime[0].totalDeliveries);
    const tier = totalDel >= 1000 ? 'platinum' : totalDel >= 500 ? 'gold' : totalDel >= 100 ? 'silver' : 'bronze';
    const nextTierAt = totalDel >= 1000 ? null : totalDel >= 500 ? 1000 : totalDel >= 100 ? 500 : 100;

    // Streak from users table
    const { rows: streakRow } = await query(
        'SELECT current_streak_days, longest_streak_days FROM users WHERE id = $1',
        [riderId]
    );

    res.json({
        totalDeliveries: totalDel,
        totalEarnings: parseInt(lifetime[0].totalEarnings),
        weekEarnings: parseInt(week[0].weekEarnings),
        rating: parseFloat(rating[0].avg_rating || '5.0'),
        acceptanceRate,
        completionRate,
        tier,
        nextTierAt,
        currentStreak: streakRow[0]?.current_streak_days ?? 0,
        longestStreak: streakRow[0]?.longest_streak_days ?? 0,
    });
    } catch (err) {
        console.error('[stats]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

router.get('/earnings/history', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    try {
        const { rows } = await query(
            'SELECT * FROM rider_daily_earnings WHERE rider_id = $1 ORDER BY date DESC LIMIT 30',
            [req.user!.userId]
        );
        res.json({ earnings: rows });
    } catch (err) {
        console.error('[earnings/history]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

router.get('/earnings/today', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    try {
        const { rows } = await query(
            'SELECT deliveries_count as "deliveriesCount", total_paise as "totalPaise", cash_collected_paise as "cashCollectedPaise" FROM rider_daily_earnings WHERE rider_id = $1 AND date = CURRENT_DATE',
            [req.user!.userId]
        );
        res.json(rows[0] || { deliveriesCount: 0, totalPaise: 0, cashCollectedPaise: 0 });
    } catch (err) {
        console.error('[earnings/today]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

router.get('/payouts', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const riderId = req.user!.userId;
    try {
        const [payoutsRes, earningsRes, paidRes, profileRes, todayRes] = await Promise.all([
            query('SELECT * FROM weekly_payouts WHERE rider_id = $1 ORDER BY week_start DESC', [riderId]),
            query('SELECT COALESCE(SUM(total_paise), 0) as total FROM rider_daily_earnings WHERE rider_id = $1', [riderId]),
            query(`SELECT COALESCE(SUM(net_amount_paise), 0) as paid FROM weekly_payouts WHERE rider_id = $1 AND status = 'paid'`, [riderId]),
            query('SELECT upi_id, bank_account_number, bank_ifsc, bank_account_name, payout_method FROM users WHERE id = $1', [riderId]),
            query('SELECT deliveries_count, total_paise FROM rider_daily_earnings WHERE rider_id = $1 AND date = CURRENT_DATE', [riderId]),
        ]);

        const pendingAmountPaise = Math.max(0, parseInt(earningsRes.rows[0].total) - parseInt(paidRes.rows[0].paid));
        const today = todayRes.rows[0] || { deliveries_count: 0, total_paise: 0 };
        const profile = profileRes.rows[0] || {};

        res.json({
            payouts: payoutsRes.rows,
            pendingAmountPaise,
            storedUpiId: profile.upi_id || null,
            bankAccountNumber: profile.bank_account_number || null,
            bankIfsc: profile.bank_ifsc || null,
            bankAccountName: profile.bank_account_name || null,
            payoutMethod: profile.payout_method || 'upi',
            todayDeliveries: parseInt(today.deliveries_count),
            todayEarningsPaise: parseInt(today.total_paise),
        });
    } catch (err) {
        console.error('[payouts]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

router.get('/orders/pool', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const riderId = req.user!.userId;
    const riderZoneId = req.user!.zoneId;
    const role = req.user!.role;

    const { rows: settings } = await query("SELECT value FROM app_settings WHERE key = 'auto_dispatch_enabled'");
    const autoDispatchEnabled = settings[0]?.value === 'true';
    if (autoDispatchEnabled) {
        return res.json({ orders: [] });
    }

    if (role !== 'super_admin') {

        // Look up zone's max_concurrent_orders (default 1 if not set)
        let maxConcurrent = 1;
        if (riderZoneId) {
            const { rows: zoneRows } = await query(
                `SELECT COALESCE(max_concurrent_orders, 1) AS max FROM zones WHERE id = $1`, [riderZoneId]
            );
            maxConcurrent = parseInt(zoneRows[0]?.max || '1');
        }

        // Count rider's current active orders
        const { rows: activeCap } = await query(
            `SELECT COUNT(*) AS cnt, array_agg(kitchen_id) AS kitchen_ids, array_agg(status) AS statuses
             FROM orders WHERE rider_id = $1 AND status NOT IN ('delivered','cancelled')`,
            [riderId]
        );
        const activeCount = parseInt(activeCap[0]?.cnt || '0');

        // Hard cap reached — show nothing
        if (activeCount >= maxConcurrent) return res.json({ orders: [] });

        // Smart stacking (Phase 2): if rider has 1 active order and cap is 2,
        // only show orders from the same kitchen AND rider must not be out_for_delivery
        if (activeCount === 1 && maxConcurrent === 2) {
            const statuses: string[] = activeCap[0]?.statuses || [];
            const kitchenIds: string[] = activeCap[0]?.kitchen_ids || [];
            const isOutForDelivery = statuses.some(s => s === 'out_for_delivery');
            if (isOutForDelivery || !kitchenIds[0]) return res.json({ orders: [] });

            // Only show orders from the exact same kitchen
            const sameKitchenId = kitchenIds[0];
            let stackRows: any[];
            try {
                const r = await query(`
                    SELECT o.*, u.name as customer_name, u.phone as customer_phone,
                           a.address_text as delivery_address_text, a.lat as customer_lat, a.lng as customer_lng,
                           k.name as kitchen_name, k.address as kitchen_address, k.lat as kitchen_lat, k.lng as kitchen_lng,
                           k.avg_prep_time_minutes,
                           (o.created_at + (k.avg_prep_time_minutes || ' minutes')::INTERVAL) AS estimated_ready_at,
                           z.rider_base_pay_paise, z.rider_per_km_paise, z.rider_free_km
                    FROM orders o
                    JOIN users u ON o.customer_id = u.id
                    LEFT JOIN addresses a ON o.address_id = a.id
                    LEFT JOIN kitchens k ON o.kitchen_id = k.id
                    LEFT JOIN zones z ON o.zone_id = z.id
                    WHERE o.status IN ('preparing','ready_for_pickup') AND o.rider_id IS NULL
                      AND o.kitchen_id = $1
                    ORDER BY o.status DESC, o.created_at ASC
                `, [sameKitchenId]);
                stackRows = r.rows;
            } catch {
                stackRows = [];
            }
            for (const order of stackRows) {
                const { rows: items } = await query('SELECT menu_item_name, quantity FROM order_items WHERE order_id = $1', [order.id]);
                order.items = items;
                order._kitchenAssigned = true; // flag: this is a stacked order from same kitchen
            }
            return res.json({ orders: stackRows });
        }
    }

    // Normal pool: show all unclaimed orders in rider's zone
    const zoneFilter = riderZoneId ? 'AND o.zone_id = $1' : '';
    const params = riderZoneId ? [riderZoneId] : [];

    let rows: any[];
    try {
        const result = await query(`
            SELECT o.*, u.name as customer_name, u.phone as customer_phone, a.address_text as delivery_address_text, a.lat as customer_lat, a.lng as customer_lng,
                   k.name as kitchen_name, k.address as kitchen_address, k.lat as kitchen_lat, k.lng as kitchen_lng,
                   k.avg_prep_time_minutes,
                   (o.created_at + (k.avg_prep_time_minutes || ' minutes')::INTERVAL) AS estimated_ready_at,
                   z.rider_base_pay_paise, z.rider_per_km_paise, z.rider_free_km
            FROM orders o
            JOIN users u ON o.customer_id = u.id
            LEFT JOIN addresses a ON o.address_id = a.id
            LEFT JOIN kitchens k ON o.kitchen_id = k.id
            LEFT JOIN zones z ON o.zone_id = z.id
            WHERE o.status IN ('preparing', 'ready_for_pickup') AND o.rider_id IS NULL ${zoneFilter}
            ORDER BY o.status DESC, o.created_at ASC
        `, params);
        rows = result.rows;
    } catch {
        const result = await query(`
            SELECT o.*, u.name as customer_name, u.phone as customer_phone, a.address_text as delivery_address_text, a.lat as customer_lat, a.lng as customer_lng,
                   k.name as kitchen_name, k.address as kitchen_address, k.lat as kitchen_lat, k.lng as kitchen_lng,
                   NULL::INTEGER AS avg_prep_time_minutes, NULL::TIMESTAMPTZ AS estimated_ready_at,
                   z.rider_base_pay_paise, z.rider_per_km_paise, z.rider_free_km
            FROM orders o
            JOIN users u ON o.customer_id = u.id
            LEFT JOIN addresses a ON o.address_id = a.id
            LEFT JOIN kitchens k ON o.kitchen_id = k.id
            LEFT JOIN zones z ON o.zone_id = z.id
            WHERE o.status IN ('preparing', 'ready_for_pickup') AND o.rider_id IS NULL ${zoneFilter}
            ORDER BY o.status DESC, o.created_at ASC
        `, params);
        rows = result.rows;
    }

    for (const order of rows) {
        const { rows: items } = await query('SELECT menu_item_name, quantity FROM order_items WHERE order_id = $1', [order.id]);
        order.items = items;
    }

    res.json({ orders: rows });
});

router.get('/orders/history', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const riderId = req.user!.userId;
    try {
        const { rows } = await query(`
            SELECT o.*,
                   u.name as customer_name,
                   a.address_text as delivery_address_text,
                   a.lat as customer_lat, a.lng as customer_lng,
                   k.lat as kitchen_lat, k.lng as kitchen_lng,
                   z.rider_base_pay_paise, z.rider_per_km_paise, z.rider_free_km
            FROM orders o
            JOIN users u ON o.customer_id = u.id
            LEFT JOIN addresses a ON o.address_id = a.id
            LEFT JOIN kitchens k ON o.kitchen_id = k.id
            LEFT JOIN zones z ON o.zone_id = z.id
            WHERE o.rider_id = $1 AND o.status IN ('delivered', 'cancelled')
            ORDER BY o.delivered_at DESC, o.created_at DESC
            LIMIT 50
        `, [riderId]);

        for (const order of rows) {
            const { rows: items } = await query('SELECT menu_item_name, quantity FROM order_items WHERE order_id = $1', [order.id]);
            order.items = items;

            // Compute per-order earnings and distance for history display (road distance only)
            if (order.status === 'delivered') {
                const distanceKm = (order.delivery_distance_metres != null && order.delivery_distance_metres > 0)
                    ? order.delivery_distance_metres / 1000
                    : 0;
                order.distance_km = Math.round(distanceKm * 10) / 10;

                const basePay = order.rider_base_pay_paise ?? TWO_QT.RIDER.BASE_EARNINGS_PER_DELIVERY_PAISE;
                const perKmPaise = order.rider_per_km_paise ?? 500;
                const freeKm = parseFloat(order.rider_free_km ?? '2');
                const distanceBonus = distanceKm > freeKm ? Math.floor((distanceKm - freeKm) * perKmPaise) : 0;
                const tipPaise = parseInt(order.rider_tip_paise || '0', 10);
                const platformFee = Math.floor(basePay * 0.1);
                order.earnings_paise = basePay + distanceBonus + tipPaise - platformFee;
            }
        }

        res.json({ orders: rows });
    } catch (err) {
        console.error('[orders/history]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

router.post('/orders/:id/claim', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const { id } = req.params;
    const riderId = req.user!.userId;

    try {
        await withTransaction(async (client) => {
            // 1. Check if rider is verified and already busy (with FOR UPDATE lock to prevent claim race conditions)
            const { rows: activeOrders } = await client.query("SELECT id FROM orders WHERE rider_id = $1 AND status NOT IN ('delivered', 'cancelled')", [riderId]);
            const { rows: rider } = await client.query('SELECT is_verified FROM users WHERE id = $1 FOR UPDATE', [riderId]);
            // In dev, skip verification check
            if (process.env.NODE_ENV !== 'development' && !rider[0]?.is_verified) throw new Error('RIDER_NOT_VERIFIED');
            if (activeOrders.length >= 3) throw new Error('RIDER_BUSY');

            const { rowCount } = await client.query(
                "UPDATE orders SET rider_id = $1 WHERE id = $2 AND rider_id IS NULL AND status IN ('preparing', 'ready_for_pickup')",
                [riderId, id]
            );
            if (rowCount === 0) throw new Error('ORDER_UNAVAILABLE');

            // Legacy compatibility
            await client.query('UPDATE users SET current_order_id = NULL WHERE id = $1', [riderId]);
        });

        // Log claim event for acceptance rate tracking (non-fatal — table may not exist on older deployments)
        query('INSERT INTO rider_order_events (rider_id, order_id, event_type) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [riderId, id, 'claimed']).catch(() => {});

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
        let kitchenId: string | null = null;
        let customerId: string | null = null;

        await withTransaction(async (client) => {
            // 1. Grab kitchen + customer before clearing so we can notify them
            const { rows: orderRows } = await client.query(
                'SELECT kitchen_id, customer_id FROM orders WHERE id = $1 AND rider_id = $2',
                [id, riderId]
            );
            if (!orderRows[0]) throw new Error('CANNOT_UNCLAIM');
            kitchenId = orderRows[0].kitchen_id;
            customerId = orderRows[0].customer_id;

            // 2. Clear rider from order
            const { rowCount } = await client.query(
                "UPDATE orders SET rider_id = NULL WHERE id = $1 AND rider_id = $2 AND status IN ('ready_for_pickup', 'confirmed', 'preparing')",
                [id, riderId]
            );
            if (rowCount === 0) throw new Error('CANNOT_UNCLAIM');

            // Legacy compatibility
            await client.query('UPDATE users SET current_order_id = NULL WHERE id = $1', [riderId]);
        });

        // Log skip/unclaim event for acceptance rate tracking (non-fatal)
        query('INSERT INTO rider_order_events (rider_id, order_id, event_type) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [riderId, id, 'unclaimed']).catch(() => {});

        // Notify kitchen dispatch panel immediately so it reappears in unassigned list
        if (kitchenId) emitToKitchen(kitchenId, 'order_updated', { orderId: id, riderDeclined: true });
        // Notify customer that rider assignment was cleared
        if (customerId) emitToUser(customerId, 'order_status_update', { orderId: id, riderAssigned: false });

        res.json({ success: true });
    } catch (err: any) {
        res.status(400).json({ error: 'UNCLAIM_FAILED', message: err.message });
    }
});

router.get('/', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    try {
        const { rows } = await query(
            'SELECT * FROM rider_daily_earnings WHERE rider_id = $1 ORDER BY date DESC LIMIT 30',
            [req.user!.userId]
        );
        res.json({ earnings: rows });
    } catch (err) {
        console.error('[rider/]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
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
// Creates a Razorpay payment link for COD UPI collection.
// Returns short_url used as the QR value — payment is verified via webhook, not rider's word.
router.post('/orders/:orderId/upi-payment-link', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const { orderId } = req.params;
    const riderId = req.user!.userId;
    try {
        const { rows } = await query(
            'SELECT id, display_id, total_amount_paise, payment_method, payment_status FROM orders WHERE id = $1 AND rider_id = $2',
            [orderId, riderId]
        );
        if (!rows.length) return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
        const order = rows[0];
        if (order.payment_method !== 'cod') return res.status(400).json({ error: 'NOT_COD' });

        // If already paid (e.g. customer paid before link was shown), return immediately
        if (order.payment_status === 'paid') return res.json({ alreadyPaid: true });

        // Reuse existing link if created in the last 30 min
        const cacheKey = `cod_plink:${orderId}`;
        const cached = await redis.get(cacheKey).catch(() => null);
        if (cached) {
            const { short_url, amount } = JSON.parse(cached);
            return res.json({ short_url, amount, alreadyPaid: false });
        }

        const link = await razorpay.paymentLink.create({
            amount: order.total_amount_paise,
            currency: 'INR',
            description: `COD payment for order #${order.display_id}`,
            reference_id: orderId,   // used in webhook to find the order
            notify: { sms: false, email: false },
            reminder_enable: false,
        });

        const result = { short_url: link.short_url, amount: order.total_amount_paise };
        redis.set(cacheKey, JSON.stringify(result), { EX: 1800 }).catch(() => {});
        res.json({ ...result, alreadyPaid: false });
    } catch (err: any) {
        console.error('[upi-payment-link]', err);
        res.status(500).json({ error: 'LINK_CREATION_FAILED', message: err.message });
    }
});

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

// ─── Customer Unreachable ─────────────────────────────────────────────────────
router.post('/orders/:id/customer-unreachable', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const { id } = req.params;
    const riderId = req.user!.userId;
    const { action } = req.body as { action: 'retry' | 'leave_at_door' | 'return' };

    try {
        const { rows } = await query(
            `SELECT o.customer_id, o.display_id FROM orders o WHERE o.id = $1 AND o.rider_id = $2 AND o.status = 'out_for_delivery'`,
            [id, riderId]
        );
        if (!rows.length) return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
        const order = rows[0];

        await query(
            `INSERT INTO rider_issues (order_id, rider_id, issue_type, notes, created_at)
             VALUES ($1, $2, 'customer_unreachable', $3, NOW())
             ON CONFLICT DO NOTHING`,
            [id, riderId, `action=${action}`]
        );

        // Notify customer that rider is waiting
        if (action === 'retry') {
            emitToUser(order.customer_id, 'rider_waiting', { orderId: id, displayId: order.display_id });
            NotificationService.send('rider_at_door', { userId: order.customer_id, orderId: id, displayId: order.display_id }).catch(() => {});
        }

        res.json({ success: true, action });
    } catch (err) {
        console.error('[customer-unreachable]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

// ─── Report Issue ─────────────────────────────────────────────────────────────
router.post('/orders/:id/report-issue', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const { id } = req.params;
    const riderId = req.user!.userId;
    const { issueType, notes } = req.body as { issueType: string; notes?: string };

    if (!issueType) return res.status(400).json({ error: 'issueType required' });

    try {
        const { rows } = await query(
            `SELECT id FROM orders WHERE id = $1 AND rider_id = $2`,
            [id, riderId]
        );
        if (!rows.length) return res.status(404).json({ error: 'ORDER_NOT_FOUND' });

        await query(
            `INSERT INTO rider_issues (order_id, rider_id, issue_type, notes, created_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [id, riderId, issueType, notes || null]
        );

        // Alert admin via socket
        emitToAdmin('rider_issue_reported', { orderId: id, riderId, issueType, notes });

        res.json({ success: true });
    } catch (err) {
        console.error('[report-issue]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

// ─── Kitchen Arrival ──────────────────────────────────────────────────────────
router.post('/orders/:id/arrived-at-kitchen', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const { id } = req.params;
    const riderId = req.user!.userId;
    try {
        const { rows } = await query(
            `UPDATE orders SET arrived_at_kitchen_at = NOW()
             WHERE id = $1 AND rider_id = $2 AND arrived_at_kitchen_at IS NULL
             RETURNING kitchen_id, customer_id, display_id`,
            [id, riderId]
        );
        if (!rows[0]) return res.status(400).json({ error: 'Cannot mark arrival for this order' });

        emitToKitchen(rows[0].kitchen_id, 'rider_arrived', { orderId: id, displayId: rows[0].display_id });
        emitToUser(rows[0].customer_id, 'order_status_update', { orderId: id, riderAtKitchen: true });

        res.json({ success: true });
    } catch (err) {
        console.error('[arrived-at-kitchen]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

// ─── SOS / Safety ─────────────────────────────────────────────────────────────
router.post('/sos', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const riderId = req.user!.userId;
    const { alertType = 'emergency', lat, lng, orderId } = req.body;
    try {
        const { rows } = await query(
            `INSERT INTO sos_alerts (rider_id, order_id, alert_type, lat, lng)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [riderId, orderId || null, alertType, lat || null, lng || null]
        );

        const { rows: riderInfo } = await query('SELECT name, phone FROM users WHERE id = $1', [riderId]);

        emitToAdmin('sos_alert', {
            sosId: rows[0].id,
            riderId,
            riderName: riderInfo[0]?.name,
            riderPhone: riderInfo[0]?.phone,
            orderId: orderId || null,
            alertType,
            lat, lng,
            createdAt: new Date().toISOString(),
        });

        res.json({ success: true, sosId: rows[0].id });
    } catch (err) {
        console.error('[sos]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

router.patch('/sos/:sosId/resolve', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const { sosId } = req.params;
    const { resolutionNote } = req.body;
    const resolvedBy = req.user!.userId;
    try {
        await query(
            `UPDATE sos_alerts SET status = 'resolved', resolved_at = NOW(), resolved_by = $1, resolution_note = $2
             WHERE id = $3`,
            [resolvedBy, resolutionNote || null, sosId]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[sos/resolve]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

// ─── Weekly Scorecard ─────────────────────────────────────────────────────────
router.get('/scorecard', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const riderId = req.user!.userId;
    try {

    const { rows: thisWeek } = await query(`
        SELECT
            COALESCE(SUM(deliveries_count), 0)          AS deliveries,
            COALESCE(SUM(total_paise), 0)               AS earnings_paise,
            COALESCE(SUM(bonus_earnings_paise), 0)      AS bonus_paise
        FROM rider_daily_earnings
        WHERE rider_id = $1 AND date >= DATE_TRUNC('week', CURRENT_DATE)
    `, [riderId]);

    const { rows: lastWeek } = await query(`
        SELECT
            COALESCE(SUM(deliveries_count), 0) AS deliveries,
            COALESCE(SUM(total_paise), 0)      AS earnings_paise
        FROM rider_daily_earnings
        WHERE rider_id = $1
          AND date >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '7 days'
          AND date <  DATE_TRUNC('week', CURRENT_DATE)
    `, [riderId]);

    const { rows: ratingRow } = await query(`
        SELECT AVG(f.delivery_rating) AS avg_rating
        FROM order_feedback f
        JOIN orders o ON f.order_id = o.id
        WHERE o.rider_id = $1 AND o.delivered_at >= DATE_TRUNC('week', CURRENT_DATE)
    `, [riderId]);

    const { rows: bestDay } = await query(`
        SELECT date, total_paise, deliveries_count
        FROM rider_daily_earnings
        WHERE rider_id = $1 AND date >= DATE_TRUNC('week', CURRENT_DATE)
        ORDER BY total_paise DESC LIMIT 1
    `, [riderId]);

    const { rows: acc } = await query(`
        SELECT
            COUNT(*) FILTER (WHERE event_type = 'claimed')                  AS claimed,
            COUNT(*) FILTER (WHERE event_type IN ('unclaimed', 'skipped'))  AS skipped
        FROM rider_order_events
        WHERE rider_id = $1 AND created_at >= DATE_TRUNC('week', CURRENT_DATE)
    `, [riderId]);

    const tw = thisWeek[0];
    const lw = lastWeek[0];
    const cl = parseInt(acc[0].claimed || '0');
    const sk = parseInt(acc[0].skipped || '0');
    const tot = cl + sk;

    res.json({
        thisWeek: {
            deliveries:     parseInt(tw.deliveries),
            earningsPaise:  parseInt(tw.earnings_paise),
            bonusPaise:     parseInt(tw.bonus_paise),
            avgRating:      parseFloat(ratingRow[0]?.avg_rating || '5.0'),
            acceptanceRate: tot > 0 ? Math.round((cl / tot) * 100) : 100,
            bestDay:        bestDay[0] || null,
        },
        lastWeek: {
            deliveries:    parseInt(lw.deliveries),
            earningsPaise: parseInt(lw.earnings_paise),
        },
        deliveriesChange: parseInt(lw.deliveries) > 0
            ? Math.round(((parseInt(tw.deliveries) - parseInt(lw.deliveries)) / parseInt(lw.deliveries)) * 100)
            : 0,
        earningsChange: parseInt(lw.earnings_paise) > 0
            ? Math.round(((parseInt(tw.earnings_paise) - parseInt(lw.earnings_paise)) / parseInt(lw.earnings_paise)) * 100)
            : 0,
    });
    } catch (err) {
        console.error('[scorecard]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

// ─── Rider Documents ──────────────────────────────────────────────────────────
router.get('/documents', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const riderId = req.user!.userId;
    try {
        const { rows } = await query(
            `SELECT vehicle_type, license_number, id_photo_url, status, created_at, updated_at
             FROM rider_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
            [riderId]
        );
        res.json(rows[0] || null);
    } catch (err) {
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

router.patch('/documents', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const riderId = req.user!.userId;
    const { vehicleType, licenseNumber, idPhotoUrl } = req.body;

    try {
        const { rows: existing } = await query(
            'SELECT id FROM rider_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
            [riderId]
        );

        if (existing.length === 0) {
            await query(
                `INSERT INTO rider_applications (user_id, vehicle_type, license_number, id_photo_url, status)
                 VALUES ($1, $2, $3, $4, 'pending')`,
                [riderId, vehicleType || null, licenseNumber || null, idPhotoUrl || null]
            );
        } else {
            const updates: string[] = [];
            const vals: any[] = [];
            let idx = 1;
            if (vehicleType !== undefined) { updates.push(`vehicle_type = $${idx++}`); vals.push(vehicleType); }
            if (licenseNumber !== undefined) { updates.push(`license_number = $${idx++}`); vals.push(licenseNumber); }
            if (idPhotoUrl !== undefined) { updates.push(`id_photo_url = $${idx++}`); vals.push(idPhotoUrl); }
            if (updates.length === 0) return res.json({ success: true });
            // Always reset to pending so admin reviews the updated submission
            updates.push(`status = 'pending'`);
            updates.push(`updated_at = NOW()`);
            vals.push(riderId);
            await query(
                `UPDATE rider_applications SET ${updates.join(', ')} WHERE user_id = $${idx}`,
                vals
            );
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[patch-documents]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

// ─── Daily Missions ───────────────────────────────────────────────────────────
router.get('/missions/daily', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const riderId = req.user!.userId;
    try {
        const { rows: today } = await query(
            `SELECT deliveries_count, total_paise, bonus_earnings_paise
             FROM rider_daily_earnings WHERE rider_id = $1 AND date = CURRENT_DATE`,
            [riderId]
        );
        const { rows: week } = await query(
            `SELECT COALESCE(SUM(deliveries_count), 0) as week_deliveries,
                    COALESCE(SUM(total_paise), 0) as week_paise
             FROM rider_daily_earnings WHERE rider_id = $1 AND date >= CURRENT_DATE - INTERVAL '6 days'`,
            [riderId]
        );

        const todayCount = parseInt(today[0]?.deliveries_count || '0');
        const todayPaise = parseInt(today[0]?.total_paise || '0');
        const weekCount = parseInt(week[0]?.week_deliveries || '0');
        const weekPaise = parseInt(week[0]?.week_paise || '0');

        const missions = [
            {
                id: 'daily_5',
                title: '5 Deliveries Today',
                description: 'Complete 5 deliveries today and earn ₹50 bonus',
                bonusPaise: 5000,
                target: 5,
                progress: Math.min(todayCount, 5),
                completed: todayCount >= 5,
                type: 'daily',
            },
            {
                id: 'daily_10',
                title: '10 Deliveries Today',
                description: 'Complete 10 deliveries and earn ₹120 bonus',
                bonusPaise: 12000,
                target: 10,
                progress: Math.min(todayCount, 10),
                completed: todayCount >= 10,
                type: 'daily',
            },
            {
                id: 'daily_earn_500',
                title: 'Earn ₹500 Today',
                description: 'Reach ₹500 in earnings today',
                bonusPaise: 3000,
                target: 50000,
                progress: Math.min(todayPaise, 50000),
                completed: todayPaise >= 50000,
                type: 'daily',
            },
            {
                id: 'weekly_30',
                title: '30 Deliveries This Week',
                description: 'Complete 30 deliveries this week and earn ₹300 bonus',
                bonusPaise: 30000,
                target: 30,
                progress: Math.min(weekCount, 30),
                completed: weekCount >= 30,
                type: 'weekly',
            },
            {
                id: 'weekly_earn_3000',
                title: 'Earn ₹3000 This Week',
                description: 'Reach ₹3000 in weekly earnings for a ₹200 bonus',
                bonusPaise: 20000,
                target: 300000,
                progress: Math.min(weekPaise, 300000),
                completed: weekPaise >= 300000,
                type: 'weekly',
            },
        ];

        res.json({
            missions,
            todayDeliveries: todayCount,
            todayEarningsPaise: todayPaise,
            weekDeliveries: weekCount,
            weekEarningsPaise: weekPaise,
        });
    } catch (err) {
        console.error('[missions/daily]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

// Rider saves their UPI ID for weekly auto-payout
router.patch('/upi', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const { upiId } = req.body as { upiId: string };
    if (!upiId?.trim()) return res.status(400).json({ error: 'upiId required' });
    const riderId = req.user!.userId;
    try {
        await query(
            `UPDATE users SET upi_id = $1, payout_method = 'upi', razorpay_fund_account_id = NULL WHERE id = $2`,
            [upiId.trim(), riderId]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save UPI' });
    }
});

// Rider saves bank account for weekly auto-payout
router.patch('/bank-account', authenticate, requireRole('rider', 'rider_captain', 'super_admin'), async (req: AuthRequest, res) => {
    const { accountNumber, ifsc, accountName } = req.body as { accountNumber: string; ifsc: string; accountName: string };
    if (!accountNumber?.trim() || !ifsc?.trim() || !accountName?.trim()) {
        return res.status(400).json({ error: 'accountNumber, ifsc and accountName are required' });
    }
    const riderId = req.user!.userId;
    try {
        await query(
            `UPDATE users SET bank_account_number = $1, bank_ifsc = $2, bank_account_name = $3, payout_method = 'bank', razorpay_fund_account_id = NULL WHERE id = $4`,
            [accountNumber.trim(), ifsc.trim().toUpperCase(), accountName.trim(), riderId]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save bank account' });
    }
});

export default router;
