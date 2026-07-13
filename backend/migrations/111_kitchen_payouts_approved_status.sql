-- kitchen_payouts.status is a TEXT CHECK constraint (not the payout_status enum),
-- so migration 110's ALTER TYPE did nothing for it.
-- Add 'approved' to the constraint and add the approved_at timestamp column.
ALTER TABLE kitchen_payouts DROP CONSTRAINT IF EXISTS kitchen_payouts_status_check;
ALTER TABLE kitchen_payouts ADD CONSTRAINT kitchen_payouts_status_check
  CHECK (status IN ('pending', 'processing', 'approved', 'paid', 'failed'));
ALTER TABLE kitchen_payouts ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
