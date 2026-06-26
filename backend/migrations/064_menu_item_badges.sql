-- Migration 064: Add bestseller, new, and tags badges to menu_items
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_bestseller BOOLEAN DEFAULT false;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_new BOOLEAN DEFAULT false;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
