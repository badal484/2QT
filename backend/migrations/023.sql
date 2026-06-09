-- Migration 023: Systematic Audit Logging
CREATE TYPE log_severity AS ENUM ('info', 'warning', 'error', 'critical');

CREATE TABLE system_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    severity log_severity NOT NULL DEFAULT 'info',
    component TEXT NOT NULL, -- e.g., 'WORKER', 'API', 'PAYMENT', 'LOGISTICS'
    event_type TEXT NOT NULL, -- e.g., 'ORDER_FAILED', 'INVOICE_GENERATED', 'REFERRAL_REWARDED'
    message TEXT NOT NULL,
    metadata JSONB, -- Contextual data: { orderId, userId, stackTrace, jobId }
    source_ip TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_logs_severity ON system_audit_logs(severity);
CREATE INDEX idx_logs_component ON system_audit_logs(component);
CREATE INDEX idx_logs_created_at ON system_audit_logs(created_at DESC);

-- Helper function for systematic logging from other PG functions
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
