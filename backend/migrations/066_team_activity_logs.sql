CREATE TABLE IF NOT EXISTS team_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    user_role VARCHAR(50) NOT NULL,
    action_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(255),
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_activity_logs_user_id ON team_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_team_activity_logs_role ON team_activity_logs(user_role);
CREATE INDEX IF NOT EXISTS idx_team_activity_logs_action ON team_activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_team_activity_logs_created_at ON team_activity_logs(created_at DESC);
