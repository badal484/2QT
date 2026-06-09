-- Migration 003: Zones and Kitchens
CREATE TABLE zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    radius_km DECIMAL NOT NULL,
    kitchen_lat DECIMAL NOT NULL,
    kitchen_lng DECIMAL NOT NULL,
    opening_time TIME NOT NULL,
    closing_time TIME NOT NULL,
    surge_enabled BOOLEAN DEFAULT false,
    surge_fee_paise INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_zones_updated_at BEFORE UPDATE ON zones FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE kitchens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id UUID REFERENCES zones(id),
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    lat DECIMAL NOT NULL,
    lng DECIMAL NOT NULL,
    is_paused BOOLEAN DEFAULT false,
    pause_reason TEXT,
    pin_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_kitchens_updated_at BEFORE UPDATE ON kitchens FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed one zone and one kitchen
INSERT INTO zones (name, radius_km, kitchen_lat, kitchen_lng, opening_time, closing_time)
VALUES ('Kundanahalli', 4.0, 12.9667, 77.7111, '10:30', '22:00')
RETURNING id;

-- Kitchen seeding needs to happen after we get the zone_id, but since we are in a script, we can use subquery
INSERT INTO kitchens (zone_id, name, address, lat, lng)
SELECT id, 'VELTO Central Kitchen', 'Kundanahalli, Bengaluru, Karnataka 560037', 12.9667, 77.7111
FROM zones WHERE name = 'Kundanahalli';
