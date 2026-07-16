-- Adds reward-tracking columns and wallet-credit config to the pre-launch system
-- (pre_launch_registrations and app_config tables created by migrations 119/120)

-- phone must be unique so ON CONFLICT (phone) in prelaunch registration works
CREATE UNIQUE INDEX IF NOT EXISTS uq_prelaunch_phone ON pre_launch_registrations(phone);

-- user reference so admin can look up wallet by registration
ALTER TABLE pre_launch_registrations ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- wallet-credit tracking
ALTER TABLE pre_launch_registrations ADD COLUMN IF NOT EXISTS reward_credited     BOOLEAN   DEFAULT FALSE;
ALTER TABLE pre_launch_registrations ADD COLUMN IF NOT EXISTS reward_credited_at  TIMESTAMPTZ;
ALTER TABLE pre_launch_registrations ADD COLUMN IF NOT EXISTS reward_expires_at   TIMESTAMPTZ;
ALTER TABLE pre_launch_registrations ADD COLUMN IF NOT EXISTS reward_redeemed     BOOLEAN   DEFAULT FALSE;
ALTER TABLE pre_launch_registrations ADD COLUMN IF NOT EXISTS redeemed_at         TIMESTAMPTZ;

-- prevent double-crediting per user
ALTER TABLE users ADD COLUMN IF NOT EXISTS prelaunch_reward_credited BOOLEAN DEFAULT FALSE;

-- app_config audit trail (migration 119 only has key/value/description/updated_at)
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- dynamic reward config (app_config.value is JSONB per migration 119)
INSERT INTO app_config (key, value, description) VALUES
  ('prelaunch_reward_active',        'true'::jsonb,        'Credit ₹100 wallet reward to registered users on launch'),
  ('prelaunch_reward_paise',         '10000'::jsonb,       'Launch reward amount in paise (10000 = ₹100)'),
  ('prelaunch_reward_validity_days', '7'::jsonb,           'Days the reward is valid after launch date'),
  ('prelaunch_launch_date',          '"2026-08-01"'::jsonb,'ISO date of app launch — used for reward expiry')
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_prelaunch_user_id ON pre_launch_registrations(user_id);
