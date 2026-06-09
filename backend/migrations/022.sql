-- Migration 022: App Settings and Global Flags
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed Initial Settings
INSERT INTO app_settings (key, value, description) VALUES 
('min_app_version', '"1.0.0"', 'Minimum version required to use the app'),
('latest_app_version', '"1.0.0"', 'Latest version available in store'),
('force_update', 'false', 'Set to true to lock users on old versions'),
('maintenance_mode', 'false', 'Set to true to disable the entire app for maintenance'),
('support_contact', '"+919999999999"', 'Customer support phone number')
ON CONFLICT (key) DO NOTHING;

DROP TRIGGER IF EXISTS update_app_settings_updated_at ON app_settings;
CREATE TRIGGER update_app_settings_updated_at BEFORE UPDATE ON app_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
