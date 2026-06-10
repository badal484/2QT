-- Migration 023: Systematic Audit Logging
DO $$ BEGIN
    CREATE TYPE log_severity AS ENUM ('info', 'warning', 'error', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS system_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    severity log_severity NOT NULL DEFAULT 'info',
    component TEXT NOT NULL,
    event_type TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB,
    source_ip TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_severity ON system_audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_logs_component ON system_audit_logs(component);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON system_audit_logs(created_at DESC);

CREATE OR REPLACE FUNCTION log_system_event(
    p_severity log_severity,
    p_component TEXT,
    p_event_type TEXT,
    p_message TEXT,
    p_metadata JSONB DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO system_audit_logs (severity, component, event_type, message, metadata)
    VALUES (p_severity, p_component, p_event_type, p_message, p_metadata);
END;
$$ LANGUAGE plpgsql;
