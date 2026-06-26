import { Router } from 'express';
import crypto from 'crypto';
import { withTransaction, query } from '../db';
import { redis, keys } from '../redis';
import { emitToKitchen, emitToUser, emitToOrder } from '../socket';
import { processReferral } from '../services/referral.service';
import { finalizeOrder } from '../services/order.service';

const router = Router();

// Shared Order Creation Logic
// finalizeOrder logic moved to order.service.ts

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

    if (event === 'order.paid') {
        const rzpOrderId = payload.order.entity.id;
        const internalOrderId = payload.order.entity.notes?.orderId;
        const paymentMethod = payload.payment.entity.method;
        const result = await finalizeOrder(rzpOrderId, paymentMethod, internalOrderId);
        return res.json(result);
    }

    // COD UPI payment via Razorpay Payment Link — auto-confirms without rider tapping anything
    if (event === 'payment_link.paid') {
        const orderId = payload.payment_link.entity.reference_id;
        if (!orderId) return res.json({ status: 'no_reference_id' });

        try {
            await query(
                `UPDATE orders
                 SET payment_status = 'paid',
                     cod_cash_collected = TRUE,
                     cod_collected_at = NOW()
                 WHERE id = $1 AND payment_method = 'cod' AND payment_status != 'paid'`,
                [orderId]
            );
            // Notify rider app that payment came through
            const { rows } = await query('SELECT rider_id FROM orders WHERE id = $1', [orderId]);
            if (rows[0]?.rider_id) {
                emitToUser(rows[0].rider_id, 'cod_payment_confirmed', { orderId });
            }
        } catch (err) {
            console.error('[webhook payment_link.paid]', err);
        }
        return res.json({ status: 'ok' });
    }

    res.json({ status: 'ignored_event' });
});

router.post('/cashfree', async (req, res) => {
    // Legacy support or migration period
    // For now, let's keep it simple and just focus on Razorpay as requested
    res.status(501).send('Cashfree webhook deprecated. Use Razorpay.');
});

export default router;
