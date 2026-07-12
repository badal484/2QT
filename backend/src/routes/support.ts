import { Router } from 'express';
import { query } from '../db';
import { authenticate, requireRole } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';
import { emitToUser, emitToAdmin, emitToSupport } from '../socket';
import { NotificationService } from '../services/notification.service';

const router = Router();
const supportAccess = authenticate, supportRole = requireRole('support', 'super_admin');

// ─── Priority + SLA map ────────────────────────────────────────────────────────

export const PRIORITY_SLA: Record<string, { priority: string; hours: number }> = {
    not_delivered:         { priority: 'critical', hours: 1 },
    vehicle_breakdown:     { priority: 'critical', hours: 1 },
    safety_concern:        { priority: 'critical', hours: 1 },
    false_complaint:       { priority: 'high',     hours: 4 },
    missing_item:          { priority: 'high',     hours: 4 },
    wrong_item:            { priority: 'high',     hours: 4 },
    payout_delayed:        { priority: 'high',     hours: 4 },
    wrong_batch:           { priority: 'high',     hours: 4 },
    customer_abusive:      { priority: 'high',     hours: 12 },
    cod_deduction_dispute: { priority: 'high',     hours: 12 },
    quality_issue:         { priority: 'normal',   hours: 24 },
    late_delivery:         { priority: 'normal',   hours: 24 },
    surge_not_applied:     { priority: 'normal',   hours: 24 },
    wrong_base_pay:        { priority: 'normal',   hours: 24 },
    rider_behavior:        { priority: 'normal',   hours: 24 },
    kitchen_delay:         { priority: 'normal',   hours: 24 },
    earnings_dispute:      { priority: 'normal',   hours: 24 },
    packaging_damage:      { priority: 'normal',   hours: 24 },
    customer_unreachable:  { priority: 'low',      hours: 48 },
    wrong_address:         { priority: 'low',      hours: 48 },
    app_issue:             { priority: 'low',      hours: 48 },
    account:               { priority: 'low',      hours: 48 },
    general:               { priority: 'low',      hours: 48 },
};

// ─── Shared ticket SELECT ──────────────────────────────────────────────────────

const TICKET_SELECT = `
  SELECT st.*,
    COALESCE(u_c.name, u_r.name) AS user_name,
    COALESCE(u_c.phone, u_r.phone) AS user_phone,
    u_a.name AS assigned_to_name,
    o.display_id AS order_display_id,
    o.total_amount_paise AS order_total_paise,
    o.payment_method AS order_payment_method
  FROM support_tickets st
  LEFT JOIN users u_c ON u_c.id = st.customer_id
  LEFT JOIN users u_r ON u_r.id = st.rider_id
  LEFT JOIN users u_a ON u_a.id = st.assigned_to
  LEFT JOIN orders o ON o.id = st.linked_order_id
`;

// Priority sort order for SQL
const PRIORITY_ORDER = `CASE st.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END`;

// ─── GET /support/tickets ──────────────────────────────────────────────────────

router.get('/tickets', supportAccess, supportRole, async (req: AuthRequest, res) => {
    try {
        const { status, user_type, priority, assigned_to_me, search } = req.query as Record<string, string>;
        const agentId = req.user!.userId;

        const conditions: string[] = [];
        const params: unknown[] = [];
        let idx = 1;

        if (status) { conditions.push(`st.status = $${idx++}`); params.push(status); }
        if (user_type) { conditions.push(`st.user_type = $${idx++}`); params.push(user_type); }
        if (priority) { conditions.push(`st.priority = $${idx++}`); params.push(priority); }
        if (assigned_to_me === 'true') { conditions.push(`st.assigned_to = $${idx++}`); params.push(agentId); }
        if (search) {
            conditions.push(`(st.subject ILIKE $${idx} OR COALESCE(u_c.name, u_r.name) ILIKE $${idx})`);
            params.push(`%${search}%`);
            idx++;
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const { rows } = await query(
            `${TICKET_SELECT} ${where}
             ORDER BY ${PRIORITY_ORDER} ASC, st.sla_deadline ASC NULLS LAST, st.created_at DESC`,
            params
        );

        res.json({ tickets: rows });
    } catch (err) {
        console.error('[support/tickets GET]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

// ─── GET /support/tickets/:id ──────────────────────────────────────────────────

router.get('/tickets/:id', supportAccess, supportRole, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;

        const { rows: tickets } = await query(
            `${TICKET_SELECT} WHERE st.id = $1`,
            [id]
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

// ─── POST /support/tickets/:id/reply ──────────────────────────────────────────

router.post('/tickets/:id/reply', supportAccess, supportRole, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const { message } = req.body as { message: string };
        const agentId = req.user!.userId;

        if (!message?.trim()) return res.status(400).json({ error: 'message required' });

        const { rows: tickets } = await query(
            'SELECT customer_id, rider_id, status FROM support_tickets WHERE id = $1',
            [id]
        );
        if (!tickets[0]) return res.status(404).json({ error: 'TICKET_NOT_FOUND' });
        const ticket = tickets[0];

        // Fetch agent name
        const { rows: agentRows } = await query('SELECT name FROM users WHERE id = $1', [agentId]);
        const agentName = agentRows[0]?.name || 'Support Team';

        // Insert message
        const { rows: msgRows } = await query(
            `INSERT INTO ticket_messages (ticket_id, sender_id, sender_type, message)
             VALUES ($1, $2, 'support', $3) RETURNING *`,
            [id, agentId, message.trim()]
        );

        // If open → set in_progress
        if (ticket.status === 'open') {
            await query(
                `UPDATE support_tickets SET status = 'in_progress', in_progress_at = NOW(), updated_at = NOW() WHERE id = $1`,
                [id]
            );
        } else {
            await query('UPDATE support_tickets SET updated_at = NOW() WHERE id = $1', [id]);
        }

        // Notify all support agents viewing this ticket
        emitToSupport('ticket_message', { ticketId: id });

        // Notify the ticket owner
        const userId = ticket.customer_id || ticket.rider_id;
        const isRider = !!ticket.rider_id;
        if (userId) {
            emitToUser(userId, 'ticket_replied', { ticketId: id, message: message.trim() });
            NotificationService.send('chat_message', {
                userId,
                title: 'Support Team Replied',
                body: message.trim().substring(0, 80),
                screen: isRider ? 'RiderSupportTicketDetail' : 'SupportTicketDetail',
                ticketId: id,
                senderName: agentName,
                message: message.trim(),
                timestamp: msgRows[0]?.created_at?.toISOString() || new Date().toISOString()
            }).catch(() => {});
        }

        res.json({ message: msgRows[0] });
    } catch (err) {
        console.error('[support/tickets/:id/reply]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

// ─── PATCH /support/tickets/:id/assign ────────────────────────────────────────

router.patch('/tickets/:id/assign', supportAccess, supportRole, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const agentId = req.user!.userId;
        const targetAgent = (req.body as { agentId?: string }).agentId || agentId;

        const { rows: tickets } = await query(
            'SELECT status FROM support_tickets WHERE id = $1',
            [id]
        );
        if (!tickets[0]) return res.status(404).json({ error: 'TICKET_NOT_FOUND' });

        const newStatus = tickets[0].status === 'open' ? 'in_progress' : tickets[0].status;
        await query(
            `UPDATE support_tickets SET assigned_to = $1, status = $2, updated_at = NOW()
             WHERE id = $3`,
            [targetAgent, newStatus, id]
        );

        res.json({ success: true });
    } catch (err) {
        console.error('[support/tickets/:id/assign]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

// ─── PATCH /support/tickets/:id/status ────────────────────────────────────────

router.patch('/tickets/:id/status', supportAccess, supportRole, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const { status, resolution, resolution_type } = req.body as {
            status: string;
            resolution?: string;
            resolution_type?: string;
        };
        const agentId = req.user!.userId;

        const validStatuses = ['open', 'in_progress', 'awaiting_user', 'escalated', 'resolved', 'closed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'INVALID_STATUS' });
        }

        const { rows: tickets } = await query(
            'SELECT customer_id, rider_id FROM support_tickets WHERE id = $1',
            [id]
        );
        if (!tickets[0]) return res.status(404).json({ error: 'TICKET_NOT_FOUND' });
        const ticket = tickets[0];

        const isTerminal = status === 'resolved' || status === 'closed';

        await query(
            `UPDATE support_tickets
             SET status = $1,
                 resolution = COALESCE($2, resolution),
                 resolution_type = COALESCE($3, resolution_type),
                 resolved_at = CASE WHEN $4 THEN NOW() ELSE resolved_at END,
                 updated_at = NOW()
             WHERE id = $5`,
            [status, resolution || null, resolution_type || null, isTerminal, id]
        );

        // Insert resolution as system message if provided
        if (resolution?.trim()) {
            await query(
                `INSERT INTO ticket_messages (ticket_id, sender_id, sender_type, message)
                 VALUES ($1, $2, 'system', $3)`,
                [id, agentId, resolution.trim()]
            );
        }

        // Notify user on resolution
        if (isTerminal) {
            const userId = ticket.customer_id || ticket.rider_id;
            if (userId) {
                emitToUser(userId, 'ticket_resolved', { ticketId: id, status });
                NotificationService.send('broadcast_message', {
                    userId,
                    title: 'Ticket Resolved',
                    body: resolution?.trim().substring(0, 80) || 'Your support ticket has been resolved.',
                    screen: 'SupportTicketDetail',
                    ticketId: id,
                }).catch(() => {});
            }
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[support/tickets/:id/status]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

// ─── PATCH /support/tickets/:id/priority ──────────────────────────────────────

router.patch('/tickets/:id/priority', supportAccess, supportRole, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const { priority } = req.body as { priority: string };

        const validPriorities = ['low', 'normal', 'high', 'critical'];
        if (!validPriorities.includes(priority)) {
            return res.status(400).json({ error: 'INVALID_PRIORITY' });
        }

        const { rowCount } = await query(
            'UPDATE support_tickets SET priority = $1, updated_at = NOW() WHERE id = $2',
            [priority, id]
        );
        if (rowCount === 0) return res.status(404).json({ error: 'TICKET_NOT_FOUND' });

        res.json({ success: true });
    } catch (err) {
        console.error('[support/tickets/:id/priority]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

// ─── GET /support/sos-alerts ──────────────────────────────────────────────────

router.get('/sos-alerts', supportAccess, supportRole, async (req: AuthRequest, res) => {
    try {
        const { rows } = await query(`
            SELECT s.*,
                   u.name AS rider_name,
                   u.phone AS rider_phone,
                   o.display_id AS order_display_id
            FROM sos_alerts s
            LEFT JOIN users u ON u.id = s.rider_id
            LEFT JOIN orders o ON o.id = s.order_id
            ORDER BY
                CASE WHEN s.status = 'active' THEN 0 ELSE 1 END ASC,
                s.created_at DESC
        `);
        res.json({ alerts: rows });
    } catch (err) {
        console.error('[support/sos-alerts]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

// ─── PATCH /support/sos-alerts/:id/resolve ────────────────────────────────────

router.patch('/sos-alerts/:id/resolve', supportAccess, supportRole, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const { resolutionNote } = req.body as { resolutionNote?: string };
        const agentId = req.user!.userId;

        await query(
            `UPDATE sos_alerts
             SET status = 'resolved', resolved_at = NOW(), resolved_by = $1, resolution_note = $2
             WHERE id = $3`,
            [agentId, resolutionNote || null, id]
        );

        res.json({ success: true });
    } catch (err) {
        console.error('[support/sos-alerts/:id/resolve]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

// ─── GET /support/stats ───────────────────────────────────────────────────────

router.get('/stats', supportAccess, supportRole, async (req: AuthRequest, res) => {
    try {
        const [statsRes, agentsRes] = await Promise.all([
            query(`
                SELECT
                    COUNT(*) FILTER (WHERE status = 'open')                                            AS open_count,
                    COUNT(*) FILTER (WHERE status = 'in_progress')                                     AS in_progress_count,
                    COUNT(*) FILTER (WHERE status IN ('resolved','closed') AND resolved_at > NOW() - INTERVAL '24h') AS resolved_today,
                    COUNT(*) FILTER (WHERE priority = 'critical' AND status NOT IN ('resolved','closed')) AS critical_open,
                    COUNT(*) FILTER (WHERE sla_deadline < NOW() AND status NOT IN ('resolved','closed')) AS sla_breached,
                    COUNT(*) FILTER (WHERE user_type = 'rider')                                        AS rider_tickets_total,
                    COUNT(*) FILTER (WHERE user_type = 'customer')                                     AS customer_tickets_total,
                    ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) FILTER (
                        WHERE resolved_at IS NOT NULL AND created_at > NOW() - INTERVAL '7 days'
                    ), 1)                                                                              AS avg_resolution_hours
                FROM support_tickets
            `),
            query(`
                SELECT users.id, users.name,
                       COUNT(st.id) FILTER (WHERE st.status NOT IN ('resolved','closed')) AS open_count
                FROM users
                LEFT JOIN support_tickets st ON st.assigned_to = users.id
                WHERE users.role IN ('support','super_admin') AND users.is_active = true
                GROUP BY users.id, users.name
            `),
        ]);

        res.json({ stats: statsRes.rows[0], agents: agentsRes.rows });
    } catch (err) {
        console.error('[support/stats]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

// ─── GET /support/agents ──────────────────────────────────────────────────────

router.get('/agents', supportAccess, supportRole, async (req: AuthRequest, res) => {
    try {
        const { rows } = await query(
            `SELECT id, name, phone FROM users WHERE role IN ('support','super_admin') AND is_active = true`
        );
        res.json({ agents: rows });
    } catch (err) {
        console.error('[support/agents]', err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

export default router;
