-- Prevent duplicate payout rows if the weekly cron fires more than once.
-- ON CONFLICT DO NOTHING only works when a unique constraint exists.
CREATE UNIQUE INDEX IF NOT EXISTS kitchen_payouts_kitchen_period_unique
    ON kitchen_payouts (kitchen_id, period_start, period_end);
