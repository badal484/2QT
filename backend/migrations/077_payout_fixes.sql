-- Migration 077: Payout system fixes
-- 1. Add failure_reason to weekly_payouts (was only on kitchen_payouts)
ALTER TABLE weekly_payouts
  ADD COLUMN IF NOT EXISTS failure_reason TEXT;

-- 2. Index to look up payouts by Razorpay payout ID (needed for payout.failed webhook)
CREATE INDEX IF NOT EXISTS idx_weekly_payouts_rzp_payout
  ON weekly_payouts(razorpay_payout_id)
  WHERE razorpay_payout_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kitchen_payouts_rzp_payout
  ON kitchen_payouts(razorpay_payout_id)
  WHERE razorpay_payout_id IS NOT NULL;
