CREATE TABLE IF NOT EXISTS promotional_banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    subtitle VARCHAR(255) NOT NULL,
    tag_text VARCHAR(50) NOT NULL,
    image_url VARCHAR(255) NOT NULL,
    action_type VARCHAR(50) NOT NULL, -- e.g., 'APPLY_COUPON', 'FILTER_CATEGORY', 'NONE'
    action_payload VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_promotional_banners_active_order ON promotional_banners(is_active, display_order);
