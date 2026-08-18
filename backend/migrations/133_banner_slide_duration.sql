-- Migration 133: Per-banner auto-slide duration (admin-configurable)

ALTER TABLE promotional_banners ADD COLUMN IF NOT EXISTS slide_duration_ms INTEGER DEFAULT 3000;
