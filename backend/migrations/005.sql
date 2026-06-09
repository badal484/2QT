-- Migration 005: Addresses
CREATE TABLE addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES users(id),
    label TEXT NOT NULL, -- 'Home', 'Work', 'PG', 'Other'
    address_text TEXT NOT NULL,
    building_name TEXT,
    floor_number TEXT,
    flat_number TEXT,
    landmark TEXT,
    gate_access_code TEXT,
    delivery_instructions TEXT,
    lat DECIMAL NOT NULL,
    lng DECIMAL NOT NULL,
    zone_id UUID REFERENCES zones(id),
    is_default BOOLEAN DEFAULT false,
    is_serviceable BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_addresses_updated_at BEFORE UPDATE ON addresses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
