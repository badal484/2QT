import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { emitToUser, emitToKitchen, emitToAdmin } from '../socket';
import { NotificationService } from '../services/notification.service';
import { redis, keys } from '../redis';
import { processWalletRefund, processBankRefund } from '../services/refund.service';

const router = Router();

router.get('/mine', authenticate, async (req: AuthRequest, res) => {
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    // Single JOIN+aggregation replaces the N+1 correlated subquery per order
    const { rows } = await query(
        `SELECT o.*, a.address_text as delivery_address_text,
                COALESCE(agg.items, '[]'::json) as items
         FROM orders o
         LEFT JOIN addresses a ON o.address_id = a.id
         LEFT JOIN LATERAL (
             SELECT json_agg(json_build_object(
                 'menu_item_name', oi.menu_item_name,
                 'quantity', oi.quantity,
                 'price_paise', oi.price_paise,
                 'menu_item_id', oi.menu_item_id
             )) as items
             FROM order_items oi WHERE oi.order_id = o.id
         ) agg ON true
         WHERE o.customer_id = $1
         ORDER BY o.created_at DESC
         LIMIT $2 OFFSET $3`,
        [req.user!.userId, limit, offset]
    );
    res.json({ orders: rows, limit, offset });
});

router.get('/active', authenticate, async (req: AuthRequest, res) => {
    // Single JOIN+aggregation; partial index idx_orders_customer_active covers this exactly
    const { rows } = await query(
        `SELECT o.*, a.address_text as delivery_address_text,
                COALESCE(agg.items, '[]'::json) as items
         FROM orders o
         LEFT JOIN addresses a ON o.address_id = a.id
         LEFT JOIN LATERAL (
             SELECT json_agg(json_build_object(
                 'menu_item_name', oi.menu_item_name,
                 'quantity', oi.quantity,
                 'price_paise', oi.price_paise,
                 'menu_item_id', oi.menu_item_id
             )) as items
             FROM order_items oi WHERE oi.order_id = o.id
         ) agg ON true
         WHERE o.customer_id = $1 AND o.status NOT IN ('delivered', 'cancelled')`,
        [req.user!.userId]
    );
    res.json({ activeOrders: rows });
});

router.get('/:id', authenticate, async (req: AuthRequest, res) => {
    const orderId = String(req.params.id);
    // Single query: items joined via LATERAL, no second round-trip
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
                k.name as kitchen_name,
                COALESCE(agg.items, '[]'::json) as items
         FROM orders o
         LEFT JOIN users r ON o.rider_id = r.id
         LEFT JOIN addresses a ON o.address_id = a.id
         LEFT JOIN kitchens k ON o.kitchen_id = k.id
         LEFT JOIN LATERAL (
             SELECT json_agg(json_build_object(
                 'menu_item_name', oi.menu_item_name,
                 'quantity', oi.quantity,
                 'price_paise', oi.price_paise,
                 'customizations', oi.customizations
             )) as items
             FROM order_items oi WHERE oi.order_id = o.id
         ) agg ON true
         WHERE o.id = $1`,
        [orderId]
    );

    const order = rows[0];
    if (!order) return res.status(404).json({ error: 'NOT_FOUND' });

    if (req.user!.role === 'customer' && order.customer_id !== req.user!.userId) {
        return res.status(403).json({ error: 'FORBIDDEN' });
    }

    if (order.rider_id) {
        const loc = await redis.get(keys.riderLocation(String(order.rider_id))).catch(() => null);
        if (loc) {
            const riderLocation = JSON.parse(loc);
            order.rider_lat = riderLocation.lat;
            order.rider_lng = riderLocation.lng;
        }
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
    const id = req.params.id as string;
    // refundType: 'wallet' (instant in-app credit) | 'bank' (Razorpay reversal, 5–7 days)
    // Only relevant when order was paid online and has a gateway_payment_id.
    // COD and wallet-only orders always get wallet credit regardless of this param.
    const { refundType = 'wallet' } = req.body as { refundType?: 'wallet' | 'bank' };

    const { rows } = await query('SELECT * FROM orders WHERE id = $1', [id]);
    const order = rows[0];

    if (!order) return res.status(404).json({ error: 'NOT_FOUND' });
    if (req.user!.role === 'customer' && order.customer_id !== req.user!.userId) {
        return res.status(403).json({ error: 'FORBIDDEN' });
    }
    if (!['pending_payment', 'confirmed'].includes(order.status)) {
        return res.status(400).json({ error: 'CANNOT_CANCEL', message: 'Order cannot be cancelled once the kitchen has started preparing' });
    }
    if (['refunded', 'refund_pending'].includes(order.payment_status)) {
        return res.status(400).json({ error: 'ALREADY_REFUNDED' });
    }

    // ── Cancel the order + reverse all side-effects in one transaction ────────
    await withTransaction(async (client) => {
        await client.query(
            "UPDATE orders SET status = 'cancelled', cancelled_at = NOW(), cancellation_reason = 'User cancelled' WHERE id = $1",
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
            await redis.del(keys.activePromos()).catch(() => null);
        }

        // Restore subscription credit
        if (order.is_subscription_order) {
            await client.query(`
                UPDATE subscriptions SET remaining_meals = remaining_meals + 1, current_day_credits = current_day_credits + 1
                WHERE customer_id = $1 AND status = 'active'
            `, [order.customer_id]);
        }
    });

    // ── Refund logic (after cancel transaction completes) ─────────────────────

    // Always refund the wallet portion — even for COD orders where the
    // gateway amount hasn't been paid yet, the wallet deduction already happened.
    const walletPortion = order.wallet_deduction_paise || 0;
    if (walletPortion > 0) {
        await processWalletRefund({
            orderId: id,
            customerId: order.customer_id,
            amountPaise: walletPortion,
            reason: 'User cancelled order',
            initiatedBy: order.customer_id,
        });
    }

    // Refund the gateway (Razorpay) portion if payment was captured
    const gatewayPortion = order.gateway_amount_paise || 0;
    if (order.payment_status === 'paid' && gatewayPortion > 0) {
        const canBankRefund = refundType === 'bank' && !!order.gateway_payment_id;
        if (canBankRefund) {
            try {
                await processBankRefund({
                    orderId: id,
                    customerId: order.customer_id,
                    amountPaise: gatewayPortion,
                    reason: 'User cancelled order',
                    initiatedBy: order.customer_id,
                    razorpayPaymentId: order.gateway_payment_id,
                });
            } catch (rzpErr: any) {
                // Razorpay unavailable — fall back to instant wallet credit
                console.error('[cancel/bank-refund-fallback]', rzpErr.message);
                await processWalletRefund({
                    orderId: id,
                    customerId: order.customer_id,
                    amountPaise: gatewayPortion,
                    reason: 'User cancelled order (bank refund fallback)',
                    initiatedBy: order.customer_id,
                });
            }
        } else {
            await processWalletRefund({
                orderId: id,
                customerId: order.customer_id,
                amountPaise: gatewayPortion,
                reason: 'User cancelled order',
                initiatedBy: order.customer_id,
            });
        }
    }

    // Fix Bug: mixed wallet+gateway or COD+wallet cancel can leave payment_status='partially_refunded'
    // because each refund call compares its own slice to total_amount_paise and sees a partial.
    // A self-cancel is always a full refund of what was actually paid, so override here.
    await query(
        "UPDATE orders SET payment_status = 'refunded' WHERE id = $1 AND payment_status IN ('paid', 'cod_pending', 'partially_refunded', 'refund_pending')",
        [id]
    );

    emitToUser(order.customer_id, 'order_status_update', { orderId: id, status: 'cancelled' });
    emitToKitchen(order.kitchen_id, 'order_cancelled', { orderId: id });

    NotificationService.send('order_cancelled', {
        userId: order.customer_id,
        displayId: order.display_id,
        orderId: id,
        amount: String(order.total_amount_paise / 100),
    }).catch(() => {});

    res.json({ success: true, message: 'Order cancelled' });
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
        const loc = await redis.get(keys.riderLocation(order.rider_id)).catch(() => null);
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
