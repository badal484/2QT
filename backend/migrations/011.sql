-- Migration 011: Rider Earnings and Payouts
CREATE TABLE rider_daily_earnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id UUID NOT NULL REFERENCES users(id),
    date DATE NOT NULL,
    deliveries_count INTEGER DEFAULT 0,
    online_minutes INTEGER DEFAULT 0,
    base_earnings_paise INTEGER DEFAULT 0,
    bonus_earnings_paise INTEGER DEFAULT 0,
    guarantee_topup_paise INTEGER DEFAULT 0,
    total_paise INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(rider_id, date)
);

DROP TRIGGER IF EXISTS update_rider_daily_earnings_updated_at ON rider_daily_earnings;
CREATE TRIGGER update_rider_daily_earnings_updated_at BEFORE UPDATE ON rider_daily_earnings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE weekly_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id UUID NOT NULL REFERENCES users(id),
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    gross_earnings_paise INTEGER NOT NULL,
    platform_fee_paise INTEGER DEFAULT 0,
    net_amount_paise INTEGER NOT NULL,
    status payout_status DEFAULT 'pending',
    cashfree_transfer_id TEXT,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_weekly_payouts_updated_at ON weekly_payouts;
CREATE TRIGGER update_weekly_payouts_updated_at BEFORE UPDATE ON weekly_payouts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
