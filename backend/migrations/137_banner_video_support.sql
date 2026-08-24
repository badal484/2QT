-- Migration 137: Add video support to promotional_banners table
ALTER TABLE promotional_banners ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE promotional_banners ADD COLUMN IF NOT EXISTS media_type VARCHAR(20) DEFAULT 'IMAGE';
