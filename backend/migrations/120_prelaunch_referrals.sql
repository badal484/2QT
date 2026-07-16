ALTER TABLE pre_launch_registrations
ADD COLUMN IF NOT EXISTS referral_code VARCHAR(10) UNIQUE,
ADD COLUMN IF NOT EXISTS referred_by VARCHAR(10);

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_prelaunch_referral_code ON pre_launch_registrations(referral_code);
