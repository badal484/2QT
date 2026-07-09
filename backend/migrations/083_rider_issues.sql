CREATE TABLE IF NOT EXISTS rider_issues (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    rider_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    issue_type  TEXT NOT NULL,
    notes       TEXT,
    resolved    BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rider_issues_order_id  ON rider_issues(order_id);
CREATE INDEX IF NOT EXISTS idx_rider_issues_rider_id  ON rider_issues(rider_id);
CREATE INDEX IF NOT EXISTS idx_rider_issues_resolved  ON rider_issues(resolved);
