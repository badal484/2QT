CREATE TABLE IF NOT EXISTS kitchen_metrics (
    id SERIAL PRIMARY KEY,
    zone_id UUID REFERENCES zones(id) ON DELETE CASCADE UNIQUE,
    fssai_status VARCHAR(255) DEFAULT 'FSSAI Certified',
    fssai_valid_till VARCHAR(255) DEFAULT 'Valid ''27',
    staff_temp_value VARCHAR(255) DEFAULT '98.6°F Staff Temp',
    staff_temp_time VARCHAR(255) DEFAULT '10m ago',
    sanitization_percent VARCHAR(255) DEFAULT '100% Sanitized',
    sanitization_freq VARCHAR(255) DEFAULT 'Hourly',
    pure_veg_status VARCHAR(255) DEFAULT '100% Pure Veg',
    pure_veg_audited VARCHAR(255) DEFAULT 'Audited',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed default metrics for existing zones
INSERT INTO kitchen_metrics (zone_id)
SELECT id FROM zones
ON CONFLICT (zone_id) DO NOTHING;
