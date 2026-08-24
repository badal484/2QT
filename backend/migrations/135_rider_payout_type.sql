-- Tag weekly_payouts rows with the reason they were created, so the admin
-- Finance UI can tell a monthly salary payout apart from a daily gig
-- settlement or a rider-initiated withdrawal request.
ALTER TABLE weekly_payouts
  ADD COLUMN IF NOT EXISTS payout_type TEXT NOT NULL DEFAULT 'gig_daily'
  CHECK (payout_type IN ('gig_daily', 'salary_monthly', 'withdrawal_request'));

CREATE INDEX IF NOT EXISTS idx_weekly_payouts_type ON weekly_payouts(payout_type);

-- Best-effort backfill: the monthly salary cron only ever inserts rows on the
-- 1st of the month and always sets complaint_deduction_paise. This is a
-- heuristic, not a guarantee — it will misclassify a salaried rider's row
-- that isn't on the 1st (e.g. a future manual re-run) and any row from a
-- period when the rider's payment_model differed from what it is today,
-- since we only have current state to key off of. Rows that don't match
-- stay at the 'gig_daily' default, which is the safer assumption since gig
-- riders vastly outnumber salaried ones in the historical data.
UPDATE weekly_payouts wp
SET payout_type = 'salary_monthly'
FROM users u
WHERE wp.rider_id = u.id
  AND u.payment_model = 'salary'
  AND EXTRACT(DAY FROM wp.week_start) = 1
  AND wp.complaint_deduction_paise IS NOT NULL;
