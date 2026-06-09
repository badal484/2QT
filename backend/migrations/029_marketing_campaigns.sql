CREATE TABLE IF NOT EXISTS marketing_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    image_url TEXT,
    target_audience TEXT NOT NULL,
    zone_id UUID REFERENCES zones(id) ON DELETE SET NULL,
    segment TEXT,
    scheduled_for TIMESTAMPTZ,
    queued_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'completed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for analytics fetching
CREATE INDEX idx_marketing_campaigns_created_at ON marketing_campaigns(created_at DESC);
