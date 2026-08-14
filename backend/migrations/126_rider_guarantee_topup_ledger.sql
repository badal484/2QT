-- The 11:30pm rider-guarantee-topup cron applies an ADDITIVE update
-- (guarantee_topup_paise = guarantee_topup_paise + $1) with no idempotency guard.
-- If the cron ever runs more than once for the same rider on the same day (a stray
-- duplicate init, or two worker instances briefly overlapping during a deploy), the
-- rider is topped up twice. This ledger table gives the cron a unique-constraint-backed
-- claim to make before applying the top-up, mirroring the pattern already used for
-- kitchen_payouts (migration 112) and weekly_payouts (migration 109).
CREATE TABLE IF NOT EXISTS rider_guarantee_topups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id UUID NOT NULL REFERENCES users(id),
    date DATE NOT NULL,
    amount_paise BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rider_guarantee_topups_one_per_rider_day
    ON rider_guarantee_topups(rider_id, date);
