-- Migration 121 failed on production because CREATE UNIQUE INDEX rolled back
-- the entire transaction when duplicate phone numbers were present.
-- This migration re-applies everything migration 121 should have done.

-- 1. Deduplicate phones (keep most recent row per phone)
DELETE FROM pre_launch_registrations
WHERE id NOT IN (
    SELECT DISTINCT ON (phone) id
    FROM pre_launch_registrations
    WHERE phone IS NOT NULL
    ORDER BY phone, created_at DESC
);

-- 2. Unique index (idempotent — IF NOT EXISTS handles already-created case)
CREATE UNIQUE INDEX IF NOT EXISTS uq_prelaunch_phone ON pre_launch_registrations(phone);

-- 3. Columns that migration 121's transaction rolled back
ALTER TABLE pre_launch_registrations ADD COLUMN IF NOT EXISTS user_id           UUID        REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE pre_launch_registrations ADD COLUMN IF NOT EXISTS reward_credited   BOOLEAN     DEFAULT FALSE;
ALTER TABLE pre_launch_registrations ADD COLUMN IF NOT EXISTS reward_credited_at TIMESTAMPTZ;
ALTER TABLE pre_launch_registrations ADD COLUMN IF NOT EXISTS reward_expires_at  TIMESTAMPTZ;
ALTER TABLE pre_launch_registrations ADD COLUMN IF NOT EXISTS reward_redeemed   BOOLEAN     DEFAULT FALSE;
ALTER TABLE pre_launch_registrations ADD COLUMN IF NOT EXISTS redeemed_at       TIMESTAMPTZ;

ALTER TABLE users ADD COLUMN IF NOT EXISTS prelaunch_reward_credited BOOLEAN DEFAULT FALSE;

ALTER TABLE app_config ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- 4. Seed reward config (ON CONFLICT = already seeded by earlier run, skip)
INSERT INTO app_config (key, value, description) VALUES
  ('prelaunch_reward_active',        'true'::jsonb,         'Credit wallet reward to registered users on launch'),
  ('prelaunch_reward_paise',         '10000'::jsonb,        'Launch reward amount in paise (10000 = ₹100)'),
  ('prelaunch_reward_validity_days', '7'::jsonb,            'Days the reward is valid after launch date'),
  ('prelaunch_launch_date',          '"2026-08-01"'::jsonb, 'ISO date of app launch')
ON CONFLICT (key) DO NOTHING;

-- 5. Index for user_id lookups
CREATE INDEX IF NOT EXISTS idx_prelaunch_user_id ON pre_launch_registrations(user_id);
