-- Migration 037: Create daily_financial_log table used by midnight audit cron
CREATE TABLE IF NOT EXISTS daily_financial_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL UNIQUE,
    total_revenue_paise BIGINT NOT NULL DEFAULT 0,
    total_expenses_paise BIGINT NOT NULL DEFAULT 0,
    net_profit_paise BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
