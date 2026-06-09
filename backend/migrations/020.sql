-- Migration 020: Rider Verification and Loyalty Config
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
UPDATE users SET is_verified = true WHERE role IN ('chef', 'partner_kitchen', 'super_admin');
UPDATE users SET is_verified = true WHERE role = 'rider' AND onboarding_complete = true; -- Retroactive for existing active riders

CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO system_config (key, value) VALUES 
('loyalty_rules', '{"points_per_100_paise": 5, "min_redeem_points": 100, "point_value_paise": 100}'),
('delivery_rules', '{"base_fee_paise": 2500, "per_km_fee_paise": 1000, "free_delivery_threshold_paise": 50000}')
ON CONFLICT (key) DO NOTHING;
