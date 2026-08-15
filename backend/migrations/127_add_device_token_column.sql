-- Migration 127: Add device_token column to users table if missing and sync fcm_token
ALTER TABLE users ADD COLUMN IF NOT EXISTS device_token text;
UPDATE users SET device_token = fcm_token WHERE device_token IS NULL AND fcm_token IS NOT NULL;
UPDATE users SET fcm_token = device_token WHERE fcm_token IS NULL AND device_token IS NOT NULL;
