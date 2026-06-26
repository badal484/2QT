-- Migration 059: Add menu_categories table for zone-specific image categories

CREATE TABLE IF NOT EXISTS menu_categories (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id      UUID NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    slug         TEXT NOT NULL,           -- Must match menu_items.category (case-insensitive)
    image_url    TEXT NOT NULL DEFAULT '',
    sort_order   INT NOT NULL DEFAULT 0,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(zone_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_menu_categories_zone ON menu_categories(zone_id, is_active, sort_order);
