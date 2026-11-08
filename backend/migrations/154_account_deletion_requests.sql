-- Migration 154: Create account_deletion_requests table
--
-- Records public web-initiated account and data deletion requests submitted
-- per Google Play Developer Policies and Indian data protection regulations.

CREATE TABLE IF NOT EXISTS account_deletion_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(20) NOT NULL,
    reason TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_phone ON account_deletion_requests (phone);
CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_status ON account_deletion_requests (status);
CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_created_at ON account_deletion_requests (created_at DESC);
