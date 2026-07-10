-- Acceptance / completion rate tracking
CREATE TABLE IF NOT EXISTS rider_order_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('claimed', 'skipped', 'unclaimed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_roe_rider_event ON rider_order_events(rider_id, event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_roe_order ON rider_order_events(order_id);

-- Kitchen arrival timestamp on orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS arrived_at_kitchen_at TIMESTAMPTZ;

-- Average prep time per kitchen (minutes), used for ETA on order pool card
ALTER TABLE kitchens ADD COLUMN IF NOT EXISTS avg_prep_time_minutes INTEGER NOT NULL DEFAULT 20;

-- SOS / safety alerts
CREATE TABLE IF NOT EXISTS sos_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    alert_type VARCHAR(20) NOT NULL CHECK (alert_type IN ('emergency', 'share_location', 'silent')),
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
    resolution_note TEXT,
    resolved_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_sos_rider ON sos_alerts(rider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sos_status ON sos_alerts(status, created_at DESC);

-- Streak tracking on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_streak_days INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS longest_streak_days INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_date DATE;
