CREATE TABLE IF NOT EXISTS promo_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    discount_type VARCHAR(20) DEFAULT 'percentage', -- 'percentage' or 'flat'
    discount_percent DECIMAL(5,2) DEFAULT 0,
    max_discount_paise INTEGER DEFAULT 0,
    min_order_paise INTEGER DEFAULT 0,
    max_uses INTEGER,
    times_used INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON promo_codes(is_active);
