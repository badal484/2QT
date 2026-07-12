-- Make customer_id nullable so rider tickets can exist
ALTER TABLE support_tickets ALTER COLUMN customer_id DROP NOT NULL;

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS user_type       TEXT NOT NULL DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS rider_id        UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS ticket_type     TEXT NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS sub_type        TEXT,
  ADD COLUMN IF NOT EXISTS subject         TEXT,
  ADD COLUMN IF NOT EXISTS priority        TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS sla_deadline    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assigned_to     UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS in_progress_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_eligible BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS suggested_refund_paise INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS resolution_type TEXT,
  ADD COLUMN IF NOT EXISTS auto_resolved   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS abuse_flag      BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS linked_order_id UUID REFERENCES orders(id),
  ADD COLUMN IF NOT EXISTS linked_payout_id UUID REFERENCES weekly_payouts(id),
  ADD COLUMN IF NOT EXISTS admin_reply     TEXT;

-- Migrate existing data: copy issue_type → subject
UPDATE support_tickets SET subject = issue_type WHERE subject IS NULL;

CREATE TABLE IF NOT EXISTS ticket_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES users(id),
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user','support','system','admin')),
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Migrate existing resolutions into ticket_messages as system messages
INSERT INTO ticket_messages (ticket_id, sender_id, sender_type, message)
SELECT st.id,
       COALESCE((SELECT id FROM users WHERE role='super_admin' LIMIT 1), st.customer_id),
       'system',
       st.resolution
FROM support_tickets st
WHERE st.resolution IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket    ON ticket_messages(ticket_id, created_at);
CREATE INDEX IF NOT EXISTS idx_support_tickets_rider     ON support_tickets(rider_id) WHERE rider_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_support_tickets_sla       ON support_tickets(sla_deadline, status) WHERE status NOT IN ('resolved','closed');
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned  ON support_tickets(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_support_tickets_type      ON support_tickets(user_type, status, priority);
