import { Router } from 'express';
import crypto from 'crypto';
import { withTransaction, query } from '../db';
import { redis, keys } from '../redis';
import { notificationsQueue } from '../jobs/queues';
import { emitToKitchen, emitToUser } from '../socket';
import { processReferral } from '../services/referral.service';
import { finalizeOrder } from '../services/order.service';

const router = Router();

// Shared Order Creation Logic
// finalizeOrder logic moved to order.service.ts

router.post('/razorpay', async (req, res) => {
    const signature = req.headers['x-razorpay-signature'] as string;
    const body = req.body;

    if (process.env.NODE_ENV !== 'development' || (signature && signature !== 'MOCK_SIG')) {
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || '')
            .update((req as any).rawBody || JSON.stringify(body))
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

    res.json({ status: 'ignored_event' });
});

router.post('/cashfree', async (req, res) => {
    // Legacy support or migration period
    // For now, let's keep it simple and just focus on Razorpay as requested
    res.status(501).send('Cashfree webhook deprecated. Use Razorpay.');
});

export default router;
