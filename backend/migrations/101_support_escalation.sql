-- Migration 101: Support escalation to finance
-- Tracks which team a support ticket was escalated to,
-- and links refund records back to the originating support ticket.

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS escalated_to TEXT;

ALTER TABLE refunds
  ADD COLUMN IF NOT EXISTS ticket_id UUID REFERENCES support_tickets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_support_tickets_escalated ON support_tickets(escalated_to) WHERE escalated_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_refunds_ticket ON refunds(ticket_id) WHERE ticket_id IS NOT NULL;
