import express from 'express';
import { query, withTransaction } from '../db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { emitToUser } from '../socket';
import { NotificationService } from '../services/notification.service';
import { logSystemEvent } from '../utils/logger';
import { createPendingRefund } from '../services/refund.service';

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
    const id = req.params.id as string;
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
        let complaintData: any = null;
        let refundPaise = 0;

        await withTransaction(async (client) => {
            const { rows: complaints } = await client.query(
                `SELECT c.*, o.total_amount_paise, o.customer_id, o.display_id,
                        o.payment_method, o.cod_cash_collected, o.rider_id, o.gateway_payment_id
                 FROM order_complaints c
                 JOIN orders o ON o.id = c.order_id
                 WHERE c.id = $1 FOR UPDATE`,
                [id]
            );
            if (!complaints[0]) throw new Error('COMPLAINT_NOT_FOUND');
            const complaint = complaints[0];
            if (complaint.status !== 'open') throw new Error('COMPLAINT_ALREADY_RESOLVED');
            complaintData = complaint;

            refundPaise = refund_scope === 'full'
                ? complaint.total_amount_paise
                : refund_scope === 'partial' ? refund_amount_paise : 0;

            // COD cash recovery: deduct from rider's next payout regardless of refund path
            if (refundPaise > 0 && complaint.is_cod_cash_order && complaint.rider_id) {
                await client.query(
                    'UPDATE order_complaints SET cod_cash_deduction_pending = true WHERE id = $1', [id]
                );
                await client.query(`
                    UPDATE weekly_payouts
                    SET cod_deductions_paise = cod_deductions_paise + $1,
                        net_amount_paise     = net_amount_paise - $1,
                        deduction_notes      = COALESCE(deduction_notes, '') || 'Complaint refund ₹' || ($1/100) || ' for order #' || $2 || '; '
                    WHERE id = (
                        SELECT id FROM weekly_payouts
                        WHERE rider_id = $3 AND status = 'pending'
                        ORDER BY created_at DESC LIMIT 1
                    )
                `, [refundPaise, complaint.display_id, complaint.rider_id]);
            }

            // Resolve complaint record
            await client.query(
                `UPDATE order_complaints
                 SET status = 'resolved', refund_scope = $1, refund_amount_paise = $2,
                     admin_note = $3, resolved_by = $4, resolved_at = NOW()
                 WHERE id = $5`,
                [refund_scope, refundPaise, admin_note || null, adminId, id]
            );

            logSystemEvent('COMPLAINT_RESOLVED',
                `Admin resolved complaint ${id}: ${refund_scope} refund ₹${refundPaise / 100}`,
                'info', { complaintId: id, adminId, refundPaise }
            );
        });

        // Queue refund for finance team to process (wallet or bank)
        if (refundPaise > 0 && complaintData) {
            await createPendingRefund({
                orderId: complaintData.order_id,
                customerId: complaintData.customer_id,
                amountPaise: refundPaise,
                reason: `Complaint resolved: ${admin_note || refund_scope}`,
                initiatedBy: adminId,
                complaintId: id,
                razorpayPaymentId: complaintData.gateway_payment_id || undefined,
            });

            NotificationService.send('broadcast_message', {
                userId: complaintData.customer_id,
                title: 'Complaint Resolved',
                body: `Your complaint for Order #${complaintData.display_id} has been resolved. ₹${refundPaise / 100} refund is being processed by our finance team.`,
            }).catch(() => {});
        }

        res.json({ success: true, message: 'Complaint resolved. Refund queued for finance approval.' });
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
