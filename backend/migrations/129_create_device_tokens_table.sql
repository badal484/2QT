-- Migration 129: Create standalone device_tokens table for multi-device push notifications

CREATE TABLE IF NOT EXISTS device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id VARCHAR(255) NOT NULL,
    app_type VARCHAR(20) NOT NULL CHECK (app_type IN ('buyer', 'rider', 'kitchen')),
    platform VARCHAR(10) NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
    fcm_token TEXT NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_user_device_app UNIQUE (user_id, device_id, app_type)
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user_app ON device_tokens(user_id, app_type) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_device_tokens_hash ON device_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_device_tokens_active ON device_tokens(is_active);
