import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { emitToUser, emitToKitchen, emitToAdmin } from '../socket';
import { notificationsQueue } from '../jobs/queues';
import { redis, keys } from '../redis';

const router = Router();

router.get('/mine', authenticate, async (req: AuthRequest, res) => {
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    const { rows } = await query(
        `SELECT o.*, a.address_text as delivery_address_text,
                COALESCE(
                    (
                        SELECT json_agg(json_build_object(
                            'menu_item_name', oi.menu_item_name,
                            'quantity', oi.quantity,
                            'price_paise', oi.price_paise,
                            'menu_item_id', oi.menu_item_id
                        ))
                        FROM order_items oi
                        WHERE oi.order_id = o.id
                    ), '[]'::json
                ) as items
         FROM orders o
         LEFT JOIN addresses a ON o.address_id = a.id
         WHERE o.customer_id = $1
         ORDER BY o.created_at DESC
         LIMIT $2 OFFSET $3`,
        [req.user!.userId, limit, offset]
    );
    res.json({ orders: rows, limit, offset });
});

router.get('/active', authenticate, async (req: AuthRequest, res) => {
    const { rows } = await query(
        'SELECT * FROM orders WHERE customer_id = $1 AND status NOT IN (\'delivered\', \'cancelled\')',
        [req.user!.userId]
    );
    res.json({ activeOrders: rows });
});

router.get('/:id', authenticate, async (req: AuthRequest, res) => {
    const { rows } = await query(
        `SELECT o.*,
                r.name as rider_name,
                r.phone as rider_phone,
                a.address_text as delivery_address_text,
                a.label as delivery_address_label,
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
                k.lat as kitchen_lat,
                k.lng as kitchen_lng,
                k.name as kitchen_name
         FROM orders o
         LEFT JOIN users r ON o.rider_id = r.id
         LEFT JOIN addresses a ON o.address_id = a.id
         LEFT JOIN kitchens k ON o.kitchen_id = k.id
         WHERE o.id = $1`,
        [req.params.id]
    );
    const order = rows[0];
    if (!order) return res.status(404).json({ error: 'NOT_FOUND' });

    if (req.user!.role === 'customer' && order.customer_id !== req.user!.userId) {
        console.log('FORBIDDEN MISMATCH:', { orderCustomerId: order.customer_id, reqUserId: req.user!.userId, type1: typeof order.customer_id, type2: typeof req.user!.userId });
        return res.status(403).json({ error: 'FORBIDDEN' });
    }

    const { rows: items } = await query(
        'SELECT menu_item_name, quantity, price_paise FROM order_items WHERE order_id = $1',
        [req.params.id]
    );
    order.items = items;
    
    let riderLocation = null;
    if (order.rider_id) {
        const loc = await redis.get(keys.riderLocation(order.rider_id));
        if (loc) riderLocation = JSON.parse(loc);
    }
    
    if (riderLocation) {
        order.rider_lat = riderLocation.lat;
        order.rider_lng = riderLocation.lng;
    }

    res.json({ order });
});

router.get('/:id/invoice', authenticate, async (req: AuthRequest, res) => {
    const { id } = req.params;
    try {
        const { rows } = await query('SELECT customer_id FROM orders WHERE id = $1', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });
        
        // Authorization check
        if (req.user!.role === 'customer' && rows[0].customer_id !== req.user!.userId) {
            return res.status(403).json({ error: 'FORBIDDEN' });
        }

        const { generateInvoicePDF } = require('../services/invoice.service');
        const invoiceUrl = await generateInvoicePDF(id);
        res.json({ invoiceUrl });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/:id/cancel', authenticate, async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { rows } = await query('SELECT * FROM orders WHERE id = $1', [id]);
    const order = rows[0];

    if (!order) return res.status(404).json({ error: 'NOT_FOUND' });
    if (req.user!.role === 'customer' && order.customer_id !== req.user!.userId) {
        return res.status(403).json({ error: 'FORBIDDEN' });
    }
    if (!['pending_payment', 'confirmed', 'preparing'].includes(order.status)) {
        return res.status(400).json({ error: 'CANNOT_CANCEL', message: `Cannot cancel order in ${order.status} state` });
    }
    // Bug 1 fix: double-refund protection
    if (order.payment_status === 'refunded') {
        return res.status(400).json({ error: 'ALREADY_REFUNDED' });
    }

    let newWalletBalance: number | null = null;

    await withTransaction(async (client) => {
        await client.query(
            "UPDATE orders SET status = 'cancelled', cancelled_at = NOW(), cancellation_reason = $1 WHERE id = $2",
            ['User cancelled', id]
        );

        // Bug 1+3 fix: refund with correct balance emit
        if (order.payment_status === 'paid') {
            const amountPaise = order.total_amount_paise;
            await client.query(`
                INSERT INTO customer_wallet (customer_id, balance_paise) VALUES ($1, $2)
                ON CONFLICT (customer_id) DO UPDATE SET balance_paise = customer_wallet.balance_paise + $2
            `, [order.customer_id, amountPaise]);
            await client.query(`
                INSERT INTO wallet_transactions (customer_id, amount_paise, type, description, balance_after_paise)
                SELECT $1, $2, 'credit', 'Refund for cancelled order #' || $3, balance_paise
                FROM customer_wallet WHERE customer_id = $1
            `, [order.customer_id, amountPaise, order.display_id]);
            await client.query("UPDATE orders SET payment_status = 'refunded' WHERE id = $1", [id]);
            // Read actual new balance to emit (not just the refund amount)
            const { rows: wb } = await client.query('SELECT balance_paise FROM customer_wallet WHERE customer_id = $1', [order.customer_id]);
            newWalletBalance = wb[0]?.balance_paise ?? amountPaise;
        }

        // Bug 4 fix: reverse loyalty points earned on this order
        const { rows: earnedPts } = await client.query(
            "SELECT points FROM loyalty_transactions WHERE order_id = $1 AND type = 'earn' LIMIT 1",
            [id]
        );
        if (earnedPts.length > 0 && earnedPts[0].points > 0) {
            await client.query(`
                INSERT INTO loyalty_transactions (customer_id, points, type, order_id)
                VALUES ($1, $2, 'redeem', $3)
            `, [order.customer_id, earnedPts[0].points, id]);
        }

        // Bug 5 fix: reverse promo usage count
        if (order.promo_code_id) {
            await client.query(
                'UPDATE promo_codes SET times_used = GREATEST(0, times_used - 1) WHERE id = $1',
                [order.promo_code_id]
            );
            await redis.del(keys.activePromos());
        }

        // Bug 8 fix: restore subscription meal credit
        if (order.is_subscription_order) {
            await client.query(`
                UPDATE subscriptions
                SET remaining_meals = remaining_meals + 1,
                    current_day_credits = current_day_credits + 1
                WHERE customer_id = $1 AND status = 'active'
            `, [order.customer_id]);
        }
    });

    // Bug 3 fix: emit correct wallet balance (not refund amount)
    emitToUser(order.customer_id, 'order_status_update', { orderId: id, status: 'cancelled' });
    if (newWalletBalance !== null) {
        emitToUser(order.customer_id, 'wallet_updated', { balancePaise: newWalletBalance });
    }
    emitToKitchen(order.kitchen_id, 'order_cancelled', { orderId: id });

    const { rows: userRows } = await query('SELECT phone FROM users WHERE id = $1', [order.customer_id]);
    const customerPhone = userRows[0]?.phone;
    if (customerPhone) {
        await notificationsQueue.add('order_cancelled', {
            phone: customerPhone,
            displayId: order.display_id,
            amount: order.total_amount_paise / 100
        });
    }

    res.json({ success: true, message: 'Order cancelled and refunded to wallet' });
});

const feedbackSchema = z.object({
    foodRating: z.number().min(1).max(5),
    deliveryRating: z.number().min(1).max(5),
    comment: z.string().max(500).optional(),
    issueTags: z.array(z.string()).optional()
});

router.post('/:id/feedback', authenticate, async (req: AuthRequest, res) => {
    const { id } = req.params;
    
    try {
        const { foodRating, deliveryRating, comment } = feedbackSchema.parse(req.body);
        
        // Check if order belongs to customer and is delivered
        const { rows: order } = await query('SELECT status FROM orders WHERE id = $1 AND customer_id = $2', [id, req.user!.userId]);
        if (!order[0]) return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
        if (order[0].status !== 'delivered') return res.status(400).json({ error: 'ORDER_NOT_DELIVERED' });

        await query(`
            INSERT INTO order_feedback (order_id, customer_id, rating, delivery_rating, comment)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (order_id) DO UPDATE SET
                rating = EXCLUDED.rating,
                delivery_rating = EXCLUDED.delivery_rating,
                comment = EXCLUDED.comment,
                created_at = NOW()
        `, [id, req.user!.userId, foodRating, deliveryRating, comment]);

        // SYSTEMATIC INTEGRATION: Loyalty Reward for leaving feedback
        await query(`
            INSERT INTO loyalty_transactions (customer_id, points, type)
            VALUES ($1, 10, 'earn')
        `, [req.user!.userId]);

        // SYSTEMATIC INTEGRATION: Critical Alert for bad feedback
        if (foodRating <= 2 || deliveryRating <= 2) {
            emitToAdmin('critical_alert', {
                type: 'BAD_FEEDBACK',
                orderId: id,
                rating: Math.min(foodRating, deliveryRating),
                message: `Critical Feedback Received for Order #${id}: ${comment}`
            });
        }

        res.json({ success: true, pointsEarned: 10 });
    } catch (err: any) {
        console.error('--- FEEDBACK_CRASH:', err);
        if (err instanceof z.ZodError) return res.status(400).json({ error: 'VALIDATION_FAILED', details: err.errors });
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

router.get('/:id/tracking', authenticate, async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { rows } = await query(`
        SELECT o.status, o.rider_id, o.display_id, o.delivery_otp,
               k.name as kitchen_name, k.address as kitchen_address, k.lat as kitchen_lat, k.lng as kitchen_lng,
               a.address_text as delivery_address, a.lat as delivery_lat, a.lng as delivery_lng
        FROM orders o
        LEFT JOIN kitchens k ON o.kitchen_id = k.id
        LEFT JOIN addresses a ON o.address_id = a.id
        WHERE o.id = $1
    `, [id]);
    
    if (!rows[0]) return res.status(404).json({ error: 'NOT_FOUND' });
    const order = rows[0];

    let riderLocation = null;
    if (order.rider_id) {
        const loc = await redis.get(keys.riderLocation(order.rider_id));
        if (loc) riderLocation = JSON.parse(loc);
    }

    res.json({
        status: order.status,
        displayId: order.display_id,
        // Only expose OTP when rider is actually on the way
        deliveryOtp: order.status === 'out_for_delivery' ? order.delivery_otp : null,
        kitchen: {
            name: order.kitchen_name,
            address: order.kitchen_address,
            lat: order.kitchen_lat,
            lng: order.kitchen_lng
        },
        delivery: {
            address: order.delivery_address,
            lat: order.delivery_lat,
            lng: order.delivery_lng
        },
        riderLocation
    });
});

export default router;
