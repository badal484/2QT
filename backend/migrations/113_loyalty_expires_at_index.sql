-- Partial index covers only rows that have an expiry date set.
-- Used by the daily expiry-warning cron and all balance queries filtered by expires_at.
CREATE INDEX IF NOT EXISTS idx_loyalty_expires_at
    ON loyalty_transactions (expires_at)
    WHERE expires_at IS NOT NULL;
