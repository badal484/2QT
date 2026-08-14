import { Router } from 'express';
import { query } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { TWO_QT } from '../config/constants';
import { emitToAdmin, emitToUser, emitToSupport } from '../socket';
import { scheduleTriggerSend, cancelTriggerJobs } from '../services/trigger.service';
import { redis, keys } from '../redis';
import { processWalletRefund } from '../services/refund.service';
import { NotificationService } from '../services/notification.service';
import { PRIORITY_SLA } from './support';

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

    emitToUser(userId, 'user_updated', { field: 'profile' });
    res.json({ user: rows[0] });
});

router.patch('/me', authenticate, async (req: AuthRequest, res) => {
    const { name, email, photo_url } = req.body;
    const userId = req.user!.userId;

    const { rows } = await query(
        'UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), photo_url = COALESCE($3, photo_url) WHERE id = $4 RETURNING *',
        [name, email, photo_url, userId]
    );

    emitToUser(userId, 'user_updated', { field: 'profile' });
    res.json({ user: rows[0] });
});

router.get('/wallet', authenticate, async (req: AuthRequest, res) => {
    const userId = req.user!.userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const { rows: wallet } = await query('SELECT * FROM customer_wallet WHERE customer_id = $1', [userId]);
    const { rows: transactions } = await query(
        'SELECT * FROM wallet_transactions WHERE customer_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
        [userId, limit, offset]
    );

    res.json({ 
        balancePaise: wallet[0]?.balance_paise || 0,
        transactions: (transactions || []).map((t: any) => ({
            ...t,
            amountPaise: t.amount_paise,
            balanceAfterPaise: t.balance_after_paise,
            createdAt: t.created_at
        })),
        limit,
        offset
    });
});

router.get('/loyalty', authenticate, async (req: AuthRequest, res) => {
    const userId = req.user!.userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;

    const { rows: pointsRes } = await query(`
        SELECT COALESCE(SUM(CASE WHEN type = 'earn' THEN points ELSE -points END), 0) as total_points
        FROM loyalty_transactions
        WHERE customer_id = $1 AND (expires_at IS NULL OR expires_at > NOW())
    `, [userId]);

    const { rows: history } = await query(`
        SELECT * FROM loyalty_transactions 
        WHERE customer_id = $1 
        ORDER BY created_at DESC LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    res.json({
        points: parseInt(pointsRes[0]?.total_points || 0),
        history: (history || []).map((h: any) => ({
            ...h,
            createdAt: h.created_at
        })),
        limit,
        offset
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
    const { subject, message, ticket_type, sub_type, linked_order_id, suggested_refund_paise } = req.body as {
        subject: string;
        message: string;
        ticket_type?: string;
        sub_type?: string;
        linked_order_id?: string;
        suggested_refund_paise?: number;
    };
    const customerId = req.user!.userId;

    try {
        const sla = PRIORITY_SLA[sub_type ?? ''] ?? PRIORITY_SLA['general'];
        const priority = sla.priority;
        const slaDeadline = new Date(Date.now() + sla.hours * 3600 * 1000).toISOString();

        const { rows } = await query(`
            INSERT INTO support_tickets
              (customer_id, user_type, ticket_type, sub_type, subject, description,
               priority, sla_deadline, linked_order_id, suggested_refund_paise,
               refund_eligible, issue_type)
            VALUES ($1, 'customer', $2, $3, $4, $5, $6, $7, $8, $9, $10, $4)
            RETURNING *
        `, [
            customerId,
            ticket_type ?? 'general',
            sub_type ?? null,
            subject,
            message,
            priority,
            slaDeadline,
            linked_order_id ?? null,
            suggested_refund_paise ?? 0,
            (suggested_refund_paise ?? 0) > 0,
        ]);

        const ticket = rows[0];

        // Insert initial message
        await query(
            `INSERT INTO ticket_messages (ticket_id, sender_id, sender_type, message)
             VALUES ($1, $2, 'user', $3)`,
            [ticket.id, customerId, message]
        );

        emitToAdmin('new_ticket', { ticket });

        // Auto-resolve + pattern detection — fire-and-forget
        (async () => {
            try {
                // Auto-resolve: late_delivery + small order → ₹30 wallet credit
                if (sub_type === 'late_delivery' && linked_order_id) {
                    const { rows: orderRows } = await query(
                        'SELECT total_amount_paise FROM orders WHERE id = $1 AND customer_id = $2',
                        [linked_order_id, customerId]
                    );
                    if (orderRows[0] && parseInt(orderRows[0].total_amount_paise) < 30000) {
                        await processWalletRefund({
                            orderId: linked_order_id,
                            customerId,
                            amountPaise: 3000,
                            reason: 'Delay compensation',
                            initiatedBy: 'system',
                        });
                        const resolutionText = 'Auto-resolved: ₹30 delay compensation credited to your wallet.';
                        await query(
                            `UPDATE support_tickets
                             SET status = 'resolved', auto_resolved = true,
                                 resolution = $1, resolved_at = NOW(), updated_at = NOW()
                             WHERE id = $2`,
                            [resolutionText, ticket.id]
                        );
                        await query(
                            `INSERT INTO ticket_messages (ticket_id, sender_id, sender_type, message)
                             VALUES ($1, $2, 'system', $3)`,
                            [ticket.id, customerId, resolutionText]
                        );
                        emitToUser(customerId, 'ticket_auto_resolved', { ticketId: ticket.id });
                        NotificationService.send('broadcast_message', {
                            userId: customerId,
                            title: '₹30 Delay Compensation',
                            body: '₹30 credited as delay compensation for your late delivery.',
                            screen: 'SupportTicketDetail',
                            ticketId: ticket.id,
                        }).catch(() => {});
                    }
                }
            } catch (autoErr) {
                console.error('[support/auto-resolve]', autoErr);
            }

            try {
                // Kitchen quality spike detection
                if (['quality_issue', 'wrong_item', 'missing_item'].includes(sub_type ?? '') && linked_order_id) {
                    const { rows: orderRows } = await query(
                        'SELECT kitchen_id FROM orders WHERE id = $1',
                        [linked_order_id]
                    );
                    if (orderRows[0]?.kitchen_id) {
                        const { rows: spikeRows } = await query(
                            `SELECT COUNT(*) AS cnt FROM support_tickets st
                             JOIN orders o ON o.id = st.linked_order_id
                             WHERE o.kitchen_id = $1
                               AND st.sub_type IN ('quality_issue','wrong_item','missing_item')
                               AND st.created_at > NOW() - INTERVAL '7 days'`,
                            [orderRows[0].kitchen_id]
                        );
                        if (parseInt(spikeRows[0]?.cnt ?? '0') >= 5) {
                            emitToAdmin('kitchen_complaint_spike', {
                                orderId: linked_order_id,
                                kitchenId: orderRows[0].kitchen_id,
                                count: parseInt(spikeRows[0].cnt),
                            });
                        }
                    }
                }
            } catch (spikeErr) {
                console.error('[support/kitchen-spike]', spikeErr);
            }

            try {
                // Customer abuse detection
                const { rows: abuseRows } = await query(
                    `SELECT COUNT(*) AS cnt FROM support_tickets
                     WHERE customer_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
                    [customerId]
                );
                if (parseInt(abuseRows[0]?.cnt ?? '0') >= 8) {
                    await query(
                        'UPDATE support_tickets SET abuse_flag = true WHERE id = $1',
                        [ticket.id]
                    );
                }
            } catch (abuseErr) {
                console.error('[support/abuse-detect]', abuseErr);
            }
        })();

        res.json({ ticket });
    } catch (err) {
        console.error('[support/tickets POST]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

router.get('/support/tickets', authenticate, async (req: AuthRequest, res) => {
    const customerId = req.user!.userId;
    try {
        const { rows } = await query(`
            SELECT st.*,
                   (SELECT tm.message FROM ticket_messages tm
                    WHERE tm.ticket_id = st.id
                    ORDER BY tm.created_at DESC LIMIT 1) AS latest_message,
                   (SELECT tm.created_at FROM ticket_messages tm
                    WHERE tm.ticket_id = st.id
                    ORDER BY tm.created_at DESC LIMIT 1) AS latest_message_at
            FROM support_tickets st
            WHERE st.customer_id = $1
            ORDER BY st.created_at DESC
        `, [customerId]);
        res.json({ tickets: rows });
    } catch (err) {
        console.error('[support/tickets GET]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

router.get('/support/tickets/:id', authenticate, async (req: AuthRequest, res) => {
    const customerId = req.user!.userId;
    const { id } = req.params;
    try {
        const { rows: tickets } = await query(
            'SELECT * FROM support_tickets WHERE id = $1 AND customer_id = $2',
            [id, customerId]
        );
        if (!tickets[0]) return res.status(404).json({ error: 'TICKET_NOT_FOUND' });

        const { rows: messages } = await query(
            `SELECT tm.*, u.name AS sender_name
             FROM ticket_messages tm
             LEFT JOIN users u ON u.id = tm.sender_id
             WHERE tm.ticket_id = $1
             ORDER BY tm.created_at ASC`,
            [id]
        );

        res.json({ ticket: tickets[0], messages });
    } catch (err) {
        console.error('[support/tickets/:id GET]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

router.post('/support/tickets/:id/reply', authenticate, async (req: AuthRequest, res) => {
    const customerId = req.user!.userId;
    const { id } = req.params;
    const { message } = req.body as { message: string };

    if (!message?.trim()) return res.status(400).json({ error: 'message required' });

    try {
        const { rows: tickets } = await query(
            `SELECT status FROM support_tickets WHERE id = $1 AND customer_id = $2`,
            [id, customerId]
        );
        if (!tickets[0]) return res.status(404).json({ error: 'TICKET_NOT_FOUND' });
        if (['resolved', 'closed'].includes(tickets[0].status)) {
            return res.status(400).json({ error: 'TICKET_CLOSED' });
        }

        const { rows: msgRows } = await query(
            `INSERT INTO ticket_messages (ticket_id, sender_id, sender_type, message)
             VALUES ($1, $2, 'user', $3) RETURNING *`,
            [id, customerId, message.trim()]
        );

        // If awaiting_user → set back to open (ball back in support's court)
        if (tickets[0].status === 'awaiting_user') {
            await query(
                `UPDATE support_tickets SET status = 'open', updated_at = NOW() WHERE id = $1`,
                [id]
            );
        } else {
            await query('UPDATE support_tickets SET updated_at = NOW() WHERE id = $1', [id]);
        }

        emitToAdmin('ticket_customer_reply', { ticketId: id });
        emitToSupport('ticket_message', { ticketId: id });

        res.json({ message: msgRows[0] });
    } catch (err) {
        console.error('[support/tickets/:id/reply POST]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
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

    // Approach A: Silent Replace for standard labels
    if (label && label !== 'Other') {
        await query(`
            UPDATE addresses 
            SET deleted_at = NOW() 
            WHERE customer_id = $1 AND label = $2 AND deleted_at IS NULL
        `, [userId, label]);
    }

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
