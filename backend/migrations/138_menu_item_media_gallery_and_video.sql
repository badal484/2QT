-- Migration 138: Multi-image gallery and video support for menu items
ALTER TABLE menu_items 
ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS video_url TEXT DEFAULT NULL;
