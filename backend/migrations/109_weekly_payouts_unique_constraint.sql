-- weekly_payouts had no unique constraint, so ON CONFLICT DO NOTHING in the
-- Monday cron was a no-op — duplicate payouts possible on server restart.
-- A rider gets at most one payout entry per week_start date.
CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_payouts_one_per_rider_week
    ON weekly_payouts(rider_id, week_start);
