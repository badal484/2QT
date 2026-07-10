-- Rider bank account for weekly payouts
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
  ADD COLUMN IF NOT EXISTS bank_ifsc           TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_name   TEXT,
  ADD COLUMN IF NOT EXISTS payout_method       TEXT NOT NULL DEFAULT 'upi'; -- 'upi' | 'bank'

-- Track payout method used per payout row
ALTER TABLE weekly_payouts
  ADD COLUMN IF NOT EXISTS payout_method TEXT NOT NULL DEFAULT 'upi';
