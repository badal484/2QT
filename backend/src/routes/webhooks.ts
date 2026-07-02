import { Router } from 'express';
import crypto from 'crypto';
import { withTransaction, query } from '../db';
import { redis, keys } from '../redis';
import { emitToKitchen, emitToUser, emitToOrder, emitToAll } from '../socket';
import { processReferral } from '../services/referral.service';
import { finalizeOrder } from '../services/order.service';
import { NotificationService } from '../services/notification.service';

const router = Router();

router.post('/razorpay', async (req, res) => {
    const signature = req.headers['x-razorpay-signature'] as string;
    const body = req.body;

    if (process.env.NODE_ENV !== 'development' || (signature && signature !== 'MOCK_SIG')) {
        const rawBody = (req as any).rawBody;
        if (!rawBody) {
            console.error('[WEBHOOK] rawBody missing — check express.json verify callback');
            return res.status(400).send('Invalid Signature');
        }
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || '')
            .update(rawBody)
            .digest('hex');

        if (expectedSignature !== signature) {
            return res.status(400).send('Invalid Signature');
        }
    }

    const { event, payload } = body;

    // ── Order paid (online / UPI / card) ─────────────────────────────────────
    if (event === 'order.paid') {
        const rzpOrderId    = payload.order.entity.id;
        const rzpPaymentId  = payload.payment.entity.id as string;   // pay_xxx — needed for refunds
        const internalOrderId = payload.order.entity.notes?.orderId;
        const paymentMethod = payload.payment.entity.method;

        const result = await finalizeOrder(rzpOrderId, paymentMethod, internalOrderId);

        // Save the Razorpay payment ID so the refund service can reverse it later
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

    // ── COD UPI payment via Razorpay Payment Link ─────────────────────────────
    if (event === 'payment_link.paid') {
        const orderId       = payload.payment_link.entity.reference_id;
        const rzpPaymentId  = payload.payment.entity?.id as string | undefined;
        if (!orderId) return res.json({ status: 'no_reference_id' });

        try {
            await query(
                `UPDATE orders
                 SET payment_status = 'paid',
                     cod_cash_collected = TRUE,
                     cod_collected_at = NOW()
                     ${rzpPaymentId ? ', gateway_payment_id = COALESCE(gateway_payment_id, $2)' : ''}
                 WHERE id = $1 AND payment_method = 'cod' AND payment_status != 'paid'`,
                rzpPaymentId ? [orderId, rzpPaymentId] : [orderId]
            );
            const { rows } = await query('SELECT rider_id FROM orders WHERE id = $1', [orderId]);
            if (rows[0]?.rider_id) {
                emitToUser(rows[0].rider_id, 'cod_payment_confirmed', { orderId });
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

    res.json({ status: 'ignored_event' });
});

router.post('/cashfree', async (req, res) => {
    res.status(501).send('Cashfree webhook deprecated. Use Razorpay.');
});

export default router;
