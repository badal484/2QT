-- Service Request table: tracks users who want 2QT in their area
CREATE TABLE IF NOT EXISTS service_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    phone VARCHAR(15),          -- for guests (fallback)
    area_name VARCHAR(255),     -- free-text area the user typed
    pincode VARCHAR(10),        -- 6-digit pincode
    lat NUMERIC(10, 7),
    lng NUMERIC(10, 7),
    notes TEXT,                 -- optional note from user
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_user_service_request UNIQUE (user_id, pincode)
);

CREATE INDEX IF NOT EXISTS idx_service_requests_pincode ON service_requests(pincode);
CREATE INDEX IF NOT EXISTS idx_service_requests_user_id ON service_requests(user_id);
