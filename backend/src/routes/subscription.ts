import { Router } from 'express';
import { query } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { handleSubscriptionRenewal } from '../services/subscription.service';
import { TWO_QT } from '../config/constants';

const router = Router();

router.get('/plans', async (req, res) => {
    res.json({ plans: TWO_QT.SUBSCRIPTION.PLANS });
});

router.get('/me', authenticate, async (req: AuthRequest, res) => {
    const { rows } = await query(
        'SELECT * FROM subscriptions WHERE customer_id = $1 AND is_active = true AND expires_at > NOW() ORDER BY created_at DESC',
        [req.user!.userId]
    );
    res.json({ subscriptions: rows });
});

router.post('/renew', authenticate, async (req: AuthRequest, res) => {
    const { planId } = req.body;
    try {
        // NOTE: this route has no payment verification at all — flagged separately,
        // out of scope for this change. gatewayPaymentId here is a synthetic,
        // always-unique value only to satisfy handleSubscriptionRenewal's new
        // required idempotency key; it preserves this route's exact prior
        // behavior (no dedup) rather than changing it.
        const subId = await handleSubscriptionRenewal(req.user!.userId, planId, `manual:${req.user!.userId}:${Date.now()}`);
        res.json({ success: true, subscriptionId: subId });
    } catch (err: any) {
        res.status(400).json({ error: 'RENEWAL_FAILED', message: err.message });
    }
});

router.post('/:id/pause', authenticate, async (req: AuthRequest, res) => {
    const { id } = req.params;
    await query(
        "UPDATE subscriptions SET is_paused = true, status = 'paused' WHERE id = $1 AND customer_id = $2",
        [id, req.user!.userId]
    );
    res.json({ success: true });
});

router.post('/:id/resume', authenticate, async (req: AuthRequest, res) => {
    const { id } = req.params;
    await query(
        "UPDATE subscriptions SET is_paused = false, status = 'active' WHERE id = $1 AND customer_id = $2",
        [id, req.user!.userId]
    );
    res.json({ success: true });
});

export default router;
