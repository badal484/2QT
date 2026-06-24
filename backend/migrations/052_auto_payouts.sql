-- Migration 052: Auto-payout infrastructure
-- Adds Razorpay fund account IDs, daily auto-pay columns, rider UPI storage

-- ─── Kitchens: Razorpay + auto-payout fields ─────────────────────────────────
ALTER TABLE kitchens
  ADD COLUMN IF NOT EXISTS razorpay_contact_id      TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_fund_account_id TEXT,
  ADD COLUMN IF NOT EXISTS auto_payout_enabled      BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS min_daily_payout_paise   INTEGER DEFAULT 5000; -- ₹50 minimum

-- ─── Users (riders): UPI + Razorpay + pending deductions ─────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS upi_id                   TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_contact_id      TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_fund_account_id TEXT,
  ADD COLUMN IF NOT EXISTS pending_deductions_paise INTEGER DEFAULT 0;

-- ─── kitchen_payouts: auto-pay tracking ──────────────────────────────────────
ALTER TABLE kitchen_payouts
  ADD COLUMN IF NOT EXISTS razorpay_payout_id TEXT,
  ADD COLUMN IF NOT EXISTS payout_mode        TEXT DEFAULT 'manual' CHECK (payout_mode IN ('auto','manual')),
  ADD COLUMN IF NOT EXISTS utr_number         TEXT,
  ADD COLUMN IF NOT EXISTS failure_reason     TEXT;

-- ─── weekly_payouts: auto-pay tracking ───────────────────────────────────────
ALTER TABLE weekly_payouts
  ADD COLUMN IF NOT EXISTS razorpay_payout_id    TEXT,
  ADD COLUMN IF NOT EXISTS payout_mode           TEXT DEFAULT 'manual' CHECK (payout_mode IN ('auto','manual')),
  ADD COLUMN IF NOT EXISTS utr_number            TEXT,
  ADD COLUMN IF NOT EXISTS complaint_deduction_paise INTEGER DEFAULT 0;

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_kitchen_payouts_period ON kitchen_payouts(kitchen_id, period_start);
CREATE INDEX IF NOT EXISTS idx_weekly_payouts_rider_date ON weekly_payouts(rider_id, week_start);
