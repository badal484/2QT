import { Router } from 'express';
import crypto from 'crypto';
import { withTransaction, query } from '../db';
import { redis, keys } from '../redis';
import { emitToKitchen, emitToUser, emitToOrder, emitToAll, emitToAdmin, emitToPartner } from '../socket';
import { processReferral } from '../services/referral.service';
import { finalizeOrder, finalizeWalletRecharge } from '../services/order.service';
import { handleSubscriptionRenewal } from '../services/subscription.service';
import { NotificationService } from '../services/notification.service';

const router = Router();

router.post('/razorpay', async (req, res) => {
    const signature = req.headers['x-razorpay-signature'] as string;
    const body = req.body;

    // Signature verification is ALWAYS enforced — no dev bypass.
    // Use Razorpay's test webhooks in development; never skip this check.
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
        console.error('[WEBHOOK] RAZORPAY_WEBHOOK_SECRET not set — rejecting all webhook requests');
        return res.status(500).send('Webhook secret not configured');
    }
    const rawBody = (req as any).rawBody;
    if (!rawBody) {
        console.error('[WEBHOOK] rawBody missing — check express.json verify callback');
        return res.status(400).send('Invalid Signature');
    }
    const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');
    if (expectedSignature !== signature) {
        console.warn('[WEBHOOK] Signature mismatch — possible spoofed request');
        return res.status(400).send('Invalid Signature');
    }

    const { event, payload } = body;

    // ── Order paid (online / UPI / card) ─────────────────────────────────────
    if (event === 'order.paid') {
        const rzpOrderId    = payload.order.entity.id;
        const rzpPaymentId  = payload.payment.entity.id as string;
        const notes         = payload.order.entity.notes || {};

        // ── Table booking final-settlement payment ────────────────────────────
        if (notes.type === 'table_booking_final') {
            const bookingId = notes.bookingId as string;
            try {
                const { rows } = await query(`
                    UPDATE table_bookings
                    SET gateway_payment_id = COALESCE(gateway_payment_id, $2),
                        final_payment_method = 'app_upi',
                        status = 'completed', completed_at = NOW(), updated_at = NOW(),
                        total_paid_paise = pre_order_amount_paise + post_order_amount_paise + gst_amount_paise
                    WHERE id = $1 AND status = 'seated'
                    RETURNING customer_id,
                              pre_order_amount_paise + post_order_amount_paise + gst_amount_paise AS grand_total_paise
                `, [bookingId, rzpPaymentId]);

                if (rows[0]) {
                    const b = rows[0];
                    await query(`
                        INSERT INTO table_booking_payments
                            (booking_id, amount_paise, payment_method, payment_type, gateway_payment_id)
                        SELECT $1,
                               (pre_order_amount_paise + post_order_amount_paise + gst_amount_paise) - total_paid_paise + (pre_order_amount_paise + post_order_amount_paise + gst_amount_paise),
                               'gateway','final_settlement',$2
                        FROM table_bookings WHERE id=$1
                    `, [bookingId, rzpPaymentId]).catch(() => {});

                    const pts = Math.floor(b.grand_total_paise / 1000);
                    if (pts > 0) {
                        await query(
                            "INSERT INTO loyalty_transactions (customer_id, points, type, expires_at) VALUES ($1,$2,'earn', NOW() + INTERVAL '1 year')",
                            [b.customer_id, pts]
                        ).catch(() => {});
                    }
                    emitToUser(b.customer_id, 'table_booking_updated', { bookingId, status: 'completed' });
                }
            } catch (err) {
                console.error('[webhook table_booking_final]', err);
            }
            return res.json({ status: 'ok' });
        }

        // ── Table booking pre-order payment ───────────────────────────────────
        if (notes.type === 'table_booking') {
            const bookingId = notes.bookingId as string;
            try {
                const { rows } = await query(`
                    UPDATE table_bookings
                    SET status = 'confirmed',
                        gateway_payment_id = COALESCE(gateway_payment_id, $2),
                        total_paid_paise = pre_order_amount_paise + deposit_amount_paise
                    WHERE id = $1 AND status = 'pending_payment'
                    RETURNING customer_id, pre_order_amount_paise, deposit_amount_paise,
                              display_id, slot_start, party_size, occasion, restaurant_id
                `, [bookingId, rzpPaymentId]);

                if (rows[0]) {
                    const b = rows[0];
                    if (b.pre_order_amount_paise > 0) {
                        await query(`
                            INSERT INTO table_booking_payments
                                (booking_id, amount_paise, payment_method, payment_type, gateway_payment_id)
                            VALUES ($1,$2,'gateway','pre_order',$3)
                        `, [bookingId, b.pre_order_amount_paise, rzpPaymentId]).catch(() => {});
                    }
                    emitToUser(b.customer_id, 'table_booking_updated', { bookingId, status: 'confirmed' });
                }
            } catch (err) {
                console.error('[webhook table_booking pre-order]', err);
            }
            return res.json({ status: 'ok' });
        }

        // ── Cash submission paid via native in-app checkout (fallback if mobile confirm fails) ──
        if (notes.type === 'cash_submission') {
            const submissionId = notes.submissionId as string;
            try {
                // Atomic claim: the UPDATE's own row lock makes this safe against concurrent
                // redelivery of the same webhook — only one delivery can ever see a returned row.
                const { rows: [submission] } = await query(
                    `UPDATE cash_submissions
                     SET status = 'confirmed', confirmed_at = NOW(),
                         utr_number = COALESCE(utr_number, $2)
                     WHERE id = $1 AND status != 'confirmed'
                     RETURNING id, rider_id, total_amount_paise, order_count`,
                    [submissionId, rzpPaymentId]
                );

                if (submission) {
                    const { rows: subOrders } = await query(
                        'SELECT order_id FROM cash_submission_orders WHERE submission_id = $1',
                        [submissionId]
                    );
                    if (subOrders.length > 0) {
                        const orderIds = subOrders.map((o: any) => o.order_id);
                        const ph = orderIds.map((_: any, i: number) => `$${i + 1}`).join(',');
                        await query(
                            `UPDATE orders SET cod_cash_collected = TRUE, cod_collected_at = NOW(),
                             payment_status = 'paid', cash_submit_confirmed_at = NOW(),
                             gateway_payment_id = COALESCE(gateway_payment_id, $${orderIds.length + 1})
                             WHERE id IN (${ph}) AND payment_method = 'cod' AND cod_cash_collected = FALSE`,
                            [...orderIds, rzpPaymentId]
                        );
                    }
                    emitToUser(submission.rider_id, 'cash_confirmed', { submissionId, totalPaise: submission.total_amount_paise });
                    emitToAdmin('cash_submitted', { submissionId, riderId: submission.rider_id, method: 'razorpay_link', totalPaise: submission.total_amount_paise, orderCount: submission.order_count, autoConfirmed: true });
                }
            } catch (err) {
                console.error('[webhook cash_submission order.paid fallback]', err);
            }
            return res.json({ status: 'ok' });
        }

        // ── Wallet Recharge ───────────────────────────────────────────────────
        if (notes.type === 'wallet_recharge') {
            const customerId = notes.customerId as string;
            const amountPaise = payload.payment.entity.amount as number;
            try {
                await finalizeWalletRecharge(rzpPaymentId, amountPaise, customerId);
            } catch (err) {
                console.error('[webhook wallet_recharge]', err);
            }
            return res.json({ status: 'ok' });
        }

        // ── Subscription Purchase ─────────────────────────────────────────────
        if (notes.type === 'subscription_purchase') {
            const customerId = notes.customerId as string;
            const planId = notes.planId as string;
            try {
                // Ensure subscription service is called to grant the plan
                await handleSubscriptionRenewal(customerId, planId);
                // We should record the gateway payment id for refund purposes
                // But subscription table schema is handled inside the service.
            } catch (err) {
                console.error('[webhook subscription_purchase]', err);
            }
            return res.json({ status: 'ok' });
        }

        // ── Restaurant SaaS subscription payment (Phase 8, platform-admin-recorded) ──────────
        if (notes.type === 'restaurant_subscription') {
            try {
                // Resolved server-side via the gateway's own order id, which only matches a row
                // WE created (never trust notes.restaurantId beyond this — it is our own
                // metadata round-tripped through Razorpay, not client-suppliable). The `status =
                // 'pending'` guard makes this idempotent against webhook redelivery: a repeat
                // delivery finds no matching row the second time, mirroring the same
                // atomic-claim pattern used above for cash_submissions.
                const { rows } = await query(
                    `UPDATE restaurant_subscriptions
                     SET status = 'active', razorpay_payment_id = COALESCE(razorpay_payment_id, $2)
                     WHERE razorpay_order_id = $1 AND status = 'pending'
                     RETURNING id, restaurant_id`,
                    [rzpOrderId, rzpPaymentId]
                );
                if (rows[0]) {
                    console.log(`[webhook restaurant_subscription] activated sub=${rows[0].id} restaurant=${rows[0].restaurant_id}`);
                }
            } catch (err) {
                console.error('[webhook restaurant_subscription]', err);
            }
            return res.json({ status: 'ok' });
        }

        // ── Standard food delivery order ──────────────────────────────────────
        const internalOrderId = notes.orderId;
        const paymentMethod = payload.payment.entity.method;

        const result = await finalizeOrder(rzpOrderId, paymentMethod, internalOrderId);

        if (rzpPaymentId) {
            const targetId = internalOrderId || null;
            if (targetId) {
                await query(
                    'UPDATE orders SET gateway_payment_id = $1 WHERE id = $2 AND gateway_payment_id IS NULL',
                    [rzpPaymentId, targetId]
                ).catch(e => console.error('[webhook] save gateway_payment_id failed', e.message));
            } else {
                await query(
                    'UPDATE orders SET gateway_payment_id = $1 WHERE gateway_order_id = $2 AND gateway_payment_id IS NULL',
                    [rzpPaymentId, rzpOrderId]
                ).catch(e => console.error('[webhook] save gateway_payment_id failed', e.message));
            }
        }

        return res.json(result);
    }

    // ── Razorpay Payment Link paid ────────────────────────────────────────────
    if (event === 'payment_link.paid') {
        const referenceId  = payload.payment_link.entity.reference_id as string | undefined;
        const rzpPaymentId = payload.payment.entity?.id as string | undefined;
        if (!referenceId) return res.json({ status: 'no_reference_id' });

        // ── Cash submission paid via Payment Link (reference_id = "cash_sub:{id}") ──
        if (referenceId.startsWith('cs:')) {
            const submissionId = referenceId.slice(3); // strip "cs:" prefix
            try {
                // Atomic claim: the UPDATE's own row lock makes this safe against concurrent
                // redelivery of the same webhook — only one delivery can ever see a returned row.
                const { rows: [submission] } = await query(
                    `UPDATE cash_submissions
                     SET status = 'confirmed', confirmed_at = NOW(),
                         utr_number = COALESCE(utr_number, $2)
                     WHERE id = $1 AND status = 'pending'
                     RETURNING id, rider_id, total_amount_paise, order_count`,
                    [submissionId, rzpPaymentId || null]
                );
                if (!submission) return res.json({ status: 'already_processed' });

                const { rows: subOrders } = await query(
                    'SELECT order_id, amount_paise FROM cash_submission_orders WHERE submission_id = $1',
                    [submissionId]
                );

                if (subOrders.length > 0) {
                    const orderIds = subOrders.map((o: any) => o.order_id);
                    const ph = orderIds.map((_: any, i: number) => `$${i + 1}`).join(',');
                    await query(
                        `UPDATE orders
                         SET cod_cash_collected = TRUE, cod_collected_at = NOW(),
                             payment_status = 'paid',
                             cash_submit_confirmed_at = NOW()
                             ${rzpPaymentId ? `, gateway_payment_id = COALESCE(gateway_payment_id, $${orderIds.length + 1})` : ''}
                         WHERE id IN (${ph}) AND payment_method = 'cod' AND cod_cash_collected = FALSE`,
                        rzpPaymentId ? [...orderIds, rzpPaymentId] : orderIds
                    );
                }

                emitToUser(submission.rider_id, 'cash_confirmed', {
                    submissionId,
                    totalPaise: submission.total_amount_paise,
                });
                emitToAdmin('cash_submitted', {
                    submissionId, riderId: submission.rider_id,
                    method: 'razorpay_link', totalPaise: submission.total_amount_paise,
                    orderCount: submission.order_count, autoConfirmed: true,
                });
            } catch (err) {
                console.error('[webhook cash_sub payment_link.paid]', err);
            }
            return res.json({ status: 'ok' });
        }

        // ── Individual COD order paid via Payment Link (legacy) ───────────────
        try {
            await query(
                `UPDATE orders
                 SET payment_status = 'paid',
                     cod_cash_collected = TRUE,
                     cod_collected_at = NOW()
                     ${rzpPaymentId ? ', gateway_payment_id = COALESCE(gateway_payment_id, $2)' : ''}
                 WHERE id = $1 AND payment_method = 'cod' AND payment_status != 'paid'`,
                rzpPaymentId ? [referenceId, rzpPaymentId] : [referenceId]
            );
            const { rows } = await query('SELECT rider_id FROM orders WHERE id = $1', [referenceId]);
            if (rows[0]?.rider_id) {
                emitToUser(rows[0].rider_id, 'cod_payment_confirmed', { orderId: referenceId });
            }
        } catch (err) {
            console.error('[webhook payment_link.paid]', err);
        }
        return res.json({ status: 'ok' });
    }

    // ── Refund processed (bank refund completed) ──────────────────────────────
    if (event === 'refund.processed') {
        const rzpRefundId = payload.refund.entity.id as string;
        try {
            const { rows } = await query(`
                UPDATE refunds
                SET status = 'processed', processed_at = NOW()
                WHERE razorpay_refund_id = $1 AND status = 'processing'
                RETURNING order_id, customer_id, amount_paise
            `, [rzpRefundId]);

            if (rows[0]) {
                const { order_id, customer_id, amount_paise } = rows[0];
                emitToUser(customer_id, 'refund_completed', { orderId: order_id, amountPaise: amount_paise, type: 'bank' });
                emitToAll('refund_updated', { action: 'processed', orderId: order_id });
                NotificationService.send('broadcast_message', {
                    userId: customer_id,
                    title: 'Refund Processed',
                    body: `₹${(amount_paise / 100).toFixed(0)} has been refunded to your bank account.`,
                }).catch(() => {});
            }
        } catch (err) {
            console.error('[webhook refund.processed]', err);
        }
        return res.json({ status: 'ok' });
    }

    // ── Refund failed ─────────────────────────────────────────────────────────
    if (event === 'refund.failed') {
        const rzpRefundId   = payload.refund.entity.id as string;
        const failureReason = (payload.refund.entity.description || 'Razorpay refund failed') as string;
        try {
            const { rows } = await query(`
                UPDATE refunds
                SET status = 'failed', failure_reason = $2
                WHERE razorpay_refund_id = $1 AND status = 'processing'
                RETURNING order_id, customer_id, amount_paise
            `, [rzpRefundId, failureReason]);

            if (rows[0]) {
                const { order_id, customer_id } = rows[0];
                // Revert order back to refund_pending so finance can retry
                await query(
                    "UPDATE orders SET payment_status = 'refund_pending' WHERE id = $1",
                    [order_id]
                );
                emitToAll('refund_updated', { action: 'failed', orderId: order_id });
                console.error(`[webhook refund.failed] rfnd=${rzpRefundId} order=${order_id} reason=${failureReason}`);
            }
        } catch (err) {
            console.error('[webhook refund.failed]', err);
        }
        return res.json({ status: 'ok' });
    }

    // ── RazorpayX payout confirmed by bank ───────────────────────────────────
    if (event === 'payout.processed') {
        const rzpPayoutId = payload.payout.entity.id as string;
        const utr         = payload.payout.entity.utr as string | null;
        try {
            // Update UTR for rider payouts
            await query(
                'UPDATE weekly_payouts  SET utr_number = COALESCE(utr_number, $2) WHERE razorpay_payout_id = $1',
                [rzpPayoutId, utr]
            );
            // Update UTR for kitchen payouts
            await query(
                'UPDATE kitchen_payouts SET utr_number = COALESCE(utr_number, $2) WHERE razorpay_payout_id = $1',
                [rzpPayoutId, utr]
            );
            // Update partner restaurant payout + notify partner
            const { rows: partnerRows } = await query(`
                UPDATE partner_restaurant_payouts
                SET utr_number = COALESCE(utr_number, $2), status = 'paid', paid_at = NOW()
                WHERE razorpay_payout_id = $1 AND status IN ('processing','pending')
                RETURNING partner_id, net_payout_paise
            `, [rzpPayoutId, utr]);
            if (partnerRows[0]) {
                emitToPartner(partnerRows[0].partner_id, 'partner_payout_updated', {
                    status: 'paid', amountPaise: partnerRows[0].net_payout_paise, utr,
                });
            }
        } catch (err) {
            console.error('[webhook payout.processed]', err);
        }
        return res.json({ status: 'ok' });
    }

    // ── RazorpayX payout rejected / bounced ──────────────────────────────────
    if (event === 'payout.failed' || event === 'payout.reversed') {
        const rzpPayoutId   = payload.payout.entity.id as string;
        const failureReason = (payload.payout.entity.error?.description || `Payout ${event}`) as string;
        try {
            // Check rider payout first
            const { rows: riderRows } = await query(`
                UPDATE weekly_payouts
                SET status = 'failed', failure_reason = $2, updated_at = NOW()
                WHERE razorpay_payout_id = $1 AND status IN ('paid','processing')
                RETURNING rider_id, net_amount_paise
            `, [rzpPayoutId, failureReason]);

            if (riderRows[0]) {
                const { rider_id, net_amount_paise } = riderRows[0];
                emitToUser(rider_id, 'payout_failed', { amountPaise: net_amount_paise, reason: failureReason });
                emitToAdmin('payout_failed', {
                    type: 'rider',
                    riderId: rider_id,
                    amountPaise: net_amount_paise,
                    reason: failureReason,
                    rzpPayoutId,
                });
                NotificationService.send('broadcast_message', {
                    userId: rider_id,
                    title: 'Payout Failed',
                    body: `Your ₹${(net_amount_paise / 100).toFixed(0)} payout could not be transferred: ${failureReason}. Finance will retry shortly.`,
                    screen: 'Payouts',
                }).catch(() => {});
                console.error(`[webhook ${event}] rider=${rider_id} pout=${rzpPayoutId} reason=${failureReason}`);
                return res.json({ status: 'ok' });
            }

            // Check kitchen payout
            const { rows: kitchenRows } = await query(`
                UPDATE kitchen_payouts
                SET status = 'failed', failure_reason = $2, updated_at = NOW()
                WHERE razorpay_payout_id = $1 AND status IN ('paid','processing')
                RETURNING kitchen_id, net_payout_paise
            `, [rzpPayoutId, failureReason]);

            if (kitchenRows[0]) {
                const { kitchen_id, net_payout_paise } = kitchenRows[0];
                emitToKitchen(kitchen_id, 'kitchen_payout_updated', {
                    status: 'failed',
                    amountPaise: net_payout_paise,
                    reason: failureReason,
                });
                emitToAdmin('payout_failed', {
                    type: 'kitchen',
                    kitchenId: kitchen_id,
                    amountPaise: net_payout_paise,
                    reason: failureReason,
                    rzpPayoutId,
                });
                // Notify kitchen staff via push
                query(
                    `SELECT id FROM users WHERE kitchen_id = $1 AND role IN ('chef','kitchen_manager','partner_kitchen') AND is_active = TRUE LIMIT 5`,
                    [kitchen_id]
                ).then(({ rows: staff }) => Promise.all(
                    staff.map((s: any) => NotificationService.send('broadcast_message', {
                        userId: s.id,
                        title: 'Payout Failed',
                        body: `Your ₹${(net_payout_paise / 100).toFixed(0)} payout could not be transferred: ${failureReason}. Finance will retry shortly.`,
                        screen: 'Payouts',
                    }))
                )).catch(e => console.error('[webhook kitchen-payout-fail/notify]', e.message));
                console.error(`[webhook ${event}] kitchen=${kitchen_id} pout=${rzpPayoutId} reason=${failureReason}`);
            }
        } catch (err) {
            console.error(`[webhook ${event}]`, err);
        }
        return res.json({ status: 'ok' });
    }

    res.json({ status: 'ignored_event' });
});

router.post('/cashfree', async (req, res) => {
    res.status(501).send('Cashfree webhook deprecated. Use Razorpay.');
});

export default router;
