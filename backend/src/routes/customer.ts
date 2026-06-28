import { Router } from 'express';
import { query } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { TWO_QT } from '../config/constants';
import { emitToAdmin } from '../socket';
import { scheduleTriggerSend, cancelTriggerJobs } from '../services/trigger.service';
import { redis, keys } from '../redis';

const router = Router();

router.get('/me', authenticate, async (req: AuthRequest, res) => {
    const userId = req.user!.userId;
    const { rows } = await query('SELECT * FROM users WHERE id = $1', [userId]);
    res.json({ user: rows[0] });
});

router.get('/cart', authenticate, async (req: AuthRequest, res) => {
    const userId = req.user!.userId;
    const cartStr = await redis.get(keys.customerCart(userId));
    res.json({ items: cartStr ? JSON.parse(cartStr) : [] });
});

router.post('/cart/sync', authenticate, async (req: AuthRequest, res) => {
    const userId = req.user!.userId;
    const { items } = req.body;
    await redis.set(keys.customerCart(userId), JSON.stringify(items || []));
    res.json({ success: true });

    // Schedule cart-abandoned trigger if cart is non-empty; cancel if emptied
    if (Array.isArray(items) && items.length > 0) {
        // Cancel any previous pending job first, then schedule fresh (avoids stacking)
        cancelTriggerJobs('cart_abandoned', userId)
            .then(() => scheduleTriggerSend('cart_abandoned', userId, { itemCount: String(items.length) }))
            .catch(() => {});
    } else {
        cancelTriggerJobs('cart_abandoned', userId).catch(() => {});
    }
});

router.patch('/profile', authenticate, async (req: AuthRequest, res) => {
    const { name, email, photo_url } = req.body;
    const userId = req.user!.userId;

    const { rows } = await query(
        'UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), photo_url = COALESCE($3, photo_url) WHERE id = $4 RETURNING *',
        [name, email, photo_url, userId]
    );

    res.json({ user: rows[0] });
});

router.patch('/me', authenticate, async (req: AuthRequest, res) => {
    const { name, email, photo_url } = req.body;
    const userId = req.user!.userId;

    const { rows } = await query(
        'UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), photo_url = COALESCE($3, photo_url) WHERE id = $4 RETURNING *',
        [name, email, photo_url, userId]
    );

    res.json({ user: rows[0] });
});

router.get('/wallet', authenticate, async (req: AuthRequest, res) => {
    const userId = req.user!.userId;
    const { rows: wallet } = await query('SELECT * FROM customer_wallet WHERE customer_id = $1', [userId]);
    const { rows: transactions } = await query(
        'SELECT * FROM wallet_transactions WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 50',
        [userId]
    );

    res.json({ 
        balancePaise: wallet[0]?.balance_paise || 0,
        transactions: transactions.map((t: any) => ({
            ...t,
            amountPaise: t.amount_paise,
            balanceAfterPaise: t.balance_after_paise,
            createdAt: t.created_at
        }))
    });
});

router.get('/loyalty', authenticate, async (req: AuthRequest, res) => {
    const userId = req.user!.userId;
    const { rows: pointsRes } = await query(`
        SELECT COALESCE(SUM(CASE WHEN type = 'earn' THEN points ELSE -points END), 0) as total_points
        FROM loyalty_transactions
        WHERE customer_id = $1 AND (expires_at IS NULL OR expires_at > NOW())
    `, [userId]);

    const { rows: history } = await query(`
        SELECT * FROM loyalty_transactions 
        WHERE customer_id = $1 
        ORDER BY created_at DESC LIMIT 20
    `, [userId]);

    res.json({
        points: parseInt(pointsRes[0].total_points),
        history: history.map((h: any) => ({
            ...h,
            createdAt: h.created_at
        }))
    });
});

router.get('/subscriptions/my', authenticate, async (req: AuthRequest, res) => {
    const userId = req.user!.userId;
    const { rows } = await query(
        'SELECT * FROM subscriptions WHERE customer_id = $1 AND is_active = true ORDER BY created_at DESC',
        [userId]
    );
    res.json({ subscriptions: rows });
});

router.get('/referrals/stats', authenticate, async (req: AuthRequest, res) => {
    const userId = req.user!.userId;
    const { rows: user } = await query('SELECT referral_code FROM users WHERE id = $1', [userId]);
    const { rows: referrals } = await query('SELECT count(*) FROM referrals WHERE referrer_id = $1 AND status = \'rewarded\'', [userId]);
    
    res.json({
        referralCode: user[0].referral_code,
        totalReferrals: parseInt(referrals[0].count),
        rewardAmountPaise: parseInt(referrals[0].count) * TWO_QT.REFERRAL.REFERRER_REWARD_PAISE
    });
});

router.post('/support/tickets', authenticate, async (req: AuthRequest, res) => {
    const { subject, message, orderId } = req.body;
    const userId = req.user!.userId;

    const { rows } = await query(`
        INSERT INTO support_tickets (customer_id, order_id, issue_type, description)
        VALUES ($1, $2, $3, $4)
        RETURNING *
    `, [userId, orderId, subject, message]);

    emitToAdmin('new_ticket', { ticket: rows[0] });
    res.json({ ticket: rows[0] });
});

router.get('/support/tickets', authenticate, async (req: AuthRequest, res) => {
    const userId = req.user!.userId;
    const { rows } = await query(`
        SELECT id, issue_type as subject, description as message, status, resolution, created_at as "createdAt"
        FROM support_tickets
        WHERE customer_id = $1 
        ORDER BY created_at DESC
    `, [userId]);
    res.json({ tickets: rows });
});

router.delete('/me', authenticate, async (req: AuthRequest, res) => {
    const userId = req.user!.userId;

    await query(`
        UPDATE users SET 
            name = 'Deleted User', 
            phone = 'DELETED_' || id, 
            email = NULL, 
            deleted_at = NOW(), 
            is_active = false 
        WHERE id = $1
    `, [userId]);

    await query('DELETE FROM addresses WHERE customer_id = $1', [userId]);
    await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1', [userId]);

    res.json({ deleted: true });
});

router.get('/addresses', authenticate, async (req: AuthRequest, res) => {
    const userId = req.user!.userId;
    const { rows } = await query(`
        SELECT a.*, z.name as zone_name, 
               CASE WHEN a.zone_id IS NOT NULL AND z.is_active = true THEN true ELSE false END as is_serviceable
        FROM addresses a
        LEFT JOIN zones z ON a.zone_id = z.id
        WHERE a.customer_id = $1 AND a.deleted_at IS NULL
    `, [userId]);
    res.json({ addresses: rows });
});

router.post('/addresses', authenticate, async (req: AuthRequest, res) => {
    const { label, addressText, lat, lng, zoneId, flatNumber, buildingName } = req.body;
    const userId = req.user!.userId;

    const { rows } = await query(`
        INSERT INTO addresses (customer_id, label, address_text, lat, lng, zone_id, flat_number, building_name)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
    `, [userId, label, addressText, lat, lng, zoneId ?? null, flatNumber ?? null, buildingName ?? null]);

    res.json({ address: rows[0] });
});

router.delete('/addresses/:id', authenticate, async (req: AuthRequest, res) => {
    const userId = req.user!.userId;
    await query('UPDATE addresses SET deleted_at = NOW() WHERE id = $1 AND customer_id = $2', [req.params.id, userId]);
    res.json({ success: true });
});

export default router;
