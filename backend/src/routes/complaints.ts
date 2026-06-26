import express from 'express';
import { query, withTransaction } from '../db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { emitToUser } from '../socket';
import { NotificationService } from '../services/notification.service';
import { logSystemEvent } from '../utils/logger';

const router = express.Router();

const COMPLAINT_WINDOW_HOURS = 24; // customer can raise complaint within 24h of delivery

// ─── CUSTOMER ──────────────────────────────────────────────────────────────

// POST /complaints — raise a complaint on a delivered order
router.post('/', authenticate, async (req: AuthRequest, res) => {
    const { order_id, type, description } = req.body;
    const customerId = req.user!.userId;

    if (!order_id || !type || !description?.trim()) {
        return res.status(400).json({ error: 'order_id, type, and description are required' });
    }

    try {
        // Verify order belongs to customer and is delivered
        const { rows: orderRows } = await query(
            `SELECT o.*, u.phone as rider_phone
             FROM orders o
             LEFT JOIN users u ON u.id = o.rider_id
             WHERE o.id = $1 AND o.customer_id = $2`,
            [order_id, customerId]
        );
        const order = orderRows[0];
        if (!order) return res.status(404).json({ error: 'Order not found' });
        if (order.status !== 'delivered') {
            return res.status(400).json({ error: 'Complaints can only be raised on delivered orders' });
        }

        // Check 24-hour window
        const deliveredAt = new Date(order.delivered_at || order.updated_at);
        const hoursSinceDelivery = (Date.now() - deliveredAt.getTime()) / 3600000;
        if (hoursSinceDelivery > COMPLAINT_WINDOW_HOURS) {
            return res.status(400).json({ error: 'Complaint window has expired (24 hours after delivery)' });
        }

        const isCodCash = order.payment_method === 'cod' && order.cod_cash_collected === true;

        const { rows } = await query(
            `INSERT INTO order_complaints
             (order_id, customer_id, rider_id, type, description, is_cod_cash_order)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [order_id, customerId, order.rider_id || null, type, description.trim(), isCodCash]
        );

        res.status(201).json({ complaint: rows[0], message: 'Complaint raised. We will review and respond within 2 hours.' });
    } catch (err: any) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'A complaint has already been raised for this order' });
        }
        console.error(err);
        res.status(500).json({ error: 'Failed to raise complaint' });
    }
});

// GET /complaints/mine — customer sees their complaints
router.get('/mine', authenticate, async (req: AuthRequest, res) => {
    const customerId = req.user!.userId;
    try {
        const { rows } = await query(
            `SELECT c.*, o.display_id, o.total_amount_paise
             FROM order_complaints c
             JOIN orders o ON o.id = c.order_id
             WHERE c.customer_id = $1
             ORDER BY c.created_at DESC`,
            [customerId]
        );
        res.json({ complaints: rows });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch complaints' });
    }
});

// ─── ADMIN ─────────────────────────────────────────────────────────────────

// GET /complaints/admin — all complaints for admin review
router.get('/admin', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
    const { status } = req.query;
    try {
        const { rows } = await query(
            `SELECT c.*,
                    o.display_id, o.total_amount_paise, o.payment_method,
                    o.cod_cash_collected,
                    cu.name as customer_name, cu.phone as customer_phone,
                    r.name as rider_name
             FROM order_complaints c
             JOIN orders o ON o.id = c.order_id
             JOIN users cu ON cu.id = c.customer_id
             LEFT JOIN users r ON r.id = c.rider_id
             WHERE ($1::text IS NULL OR c.status = $1)
             ORDER BY c.created_at DESC`,
            [status || null]
        );
        res.json({ complaints: rows });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch complaints' });
    }
});

// POST /complaints/:id/resolve — admin approves refund (full or partial)
router.post('/:id/resolve', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { refund_scope, refund_amount_paise, admin_note } = req.body;
    const adminId = req.user!.userId;

    // refund_scope: 'full' | 'partial' | 'none'
    if (!['full', 'partial', 'none'].includes(refund_scope)) {
        return res.status(400).json({ error: 'refund_scope must be full, partial, or none' });
    }
    if (refund_scope === 'partial' && !refund_amount_paise) {
        return res.status(400).json({ error: 'refund_amount_paise required for partial refund' });
    }

    try {
        let finalWalletBalance = 0;

        await withTransaction(async (client) => {
            const { rows: complaints } = await client.query(
                `SELECT c.*, o.total_amount_paise, o.customer_id, o.display_id,
                        o.payment_method, o.cod_cash_collected, o.rider_id
                 FROM order_complaints c
                 JOIN orders o ON o.id = c.order_id
                 WHERE c.id = $1 FOR UPDATE`,
                [id]
            );
            if (!complaints[0]) throw new Error('COMPLAINT_NOT_FOUND');
            const complaint = complaints[0];
            if (complaint.status !== 'open') throw new Error('COMPLAINT_ALREADY_RESOLVED');

            const refundPaise = refund_scope === 'full'
                ? complaint.total_amount_paise
                : refund_scope === 'partial'
                    ? refund_amount_paise
                    : 0;

            // Credit wallet if refunding
            if (refundPaise > 0) {
                await client.query(`
                    INSERT INTO customer_wallet (customer_id, balance_paise) VALUES ($1, $2)
                    ON CONFLICT (customer_id) DO UPDATE SET balance_paise = customer_wallet.balance_paise + $2
                `, [complaint.customer_id, refundPaise]);

                await client.query(`
                    INSERT INTO wallet_transactions (customer_id, amount_paise, type, description, balance_after_paise)
                    SELECT $1, $2, 'credit', 'Complaint refund for order #' || $3, balance_paise
                    FROM customer_wallet WHERE customer_id = $1
                `, [complaint.customer_id, refundPaise, complaint.display_id]);

                // Read actual new balance for socket emit
                const { rows: wb } = await client.query(
                    'SELECT balance_paise FROM customer_wallet WHERE customer_id = $1',
                    [complaint.customer_id]
                );
                finalWalletBalance = wb[0]?.balance_paise ?? refundPaise;

                // Update order payment_status
                const newPayStatus = refundPaise >= complaint.total_amount_paise ? 'refunded' : 'partially_refunded';
                await client.query(
                    'UPDATE orders SET payment_status = $1 WHERE id = $2',
                    [newPayStatus, complaint.order_id]
                );

                // COD cash recovery: flag for rider deduction at next payout
                // Cash is physically with the rider — need to deduct from their next payout
                if (complaint.is_cod_cash_order && complaint.rider_id) {
                    await client.query(`
                        UPDATE order_complaints
                        SET cod_cash_deduction_pending = true
                        WHERE id = $1
                    `, [id]);

                    // Add to rider's pending deduction in their upcoming payout
                    await client.query(`
                        UPDATE weekly_payouts
                        SET cod_deductions_paise = cod_deductions_paise + $1,
                            net_amount_paise = net_amount_paise - $1,
                            deduction_notes = COALESCE(deduction_notes, '') || 'Complaint refund ₹' || ($1/100) || ' for order #' || $2 || '; '
                        WHERE id = (
                            SELECT id FROM weekly_payouts
                            WHERE rider_id = $3 AND status = 'pending'
                            ORDER BY created_at DESC LIMIT 1
                        )
                    `, [refundPaise, complaint.display_id, complaint.rider_id]);
                }
            }

            // Resolve complaint
            await client.query(
                `UPDATE order_complaints
                 SET status = 'resolved', refund_scope = $1, refund_amount_paise = $2,
                     admin_note = $3, resolved_by = $4, resolved_at = NOW(),
                     cod_cash_deduction_pending = CASE WHEN $5 AND $2 > 0 THEN true ELSE cod_cash_deduction_pending END
                 WHERE id = $6`,
                [refund_scope, refundPaise, admin_note || null, adminId, complaint.is_cod_cash_order, id]
            );

            logSystemEvent('COMPLAINT_RESOLVED',
                `Admin resolved complaint ${id}: ${refund_scope} refund ₹${refundPaise/100}`,
                'info', { complaintId: id, adminId, refundPaise }
            );

            // Notify customer
            const { rows: userRows } = await client.query('SELECT phone FROM users WHERE id = $1', [complaint.customer_id]);
            if (userRows[0]?.phone && refundPaise > 0) {
                NotificationService.send('broadcast_message', {
                    phone: userRows[0].phone,
                    title: 'Complaint Resolved',
                    body: `2QT: Your complaint for Order #${complaint.display_id} has been resolved. ₹${refundPaise/100} refunded to your wallet. Sorry for the trouble!`,
                }).catch(() => {});
            }
        });

        // Emit new wallet balance
        const { rows: co } = await query('SELECT customer_id FROM order_complaints WHERE id = $1', [id]);
        if (co[0] && finalWalletBalance > 0) {
            emitToUser(co[0].customer_id, 'wallet_updated', { balancePaise: finalWalletBalance });
        }

        res.json({ success: true, message: 'Complaint resolved' });
    } catch (err: any) {
        const code = err.message === 'COMPLAINT_NOT_FOUND' ? 404 : err.message === 'COMPLAINT_ALREADY_RESOLVED' ? 409 : 500;
        res.status(code).json({ error: err.message });
    }
});

// POST /complaints/:id/reject — admin rejects complaint
router.post('/:id/reject', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { admin_note } = req.body;
    const adminId = req.user!.userId;

    try {
        const { rows } = await query(
            `UPDATE order_complaints
             SET status = 'rejected', admin_note = $1, resolved_by = $2, resolved_at = NOW()
             WHERE id = $3 AND status = 'open'
             RETURNING customer_id, order_id`,
            [admin_note || null, adminId, id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Complaint not found or already resolved' });

        const { rows: orderRows } = await query('SELECT display_id FROM orders WHERE id = $1', [rows[0].order_id]);
        const { rows: userRows } = await query('SELECT phone FROM users WHERE id = $1', [rows[0].customer_id]);
        if (userRows[0]?.phone) {
            NotificationService.send('broadcast_message', {
                phone: userRows[0].phone,
                title: 'Complaint Update',
                body: `2QT: We reviewed your complaint for Order #${orderRows[0]?.display_id}. Unfortunately we could not process a refund. ${admin_note ? 'Reason: ' + admin_note : 'Contact support for more details.'}`,
            }).catch(() => {});
        }

        res.json({ success: true });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: 'Failed to reject complaint' });
    }
});

export default router;
