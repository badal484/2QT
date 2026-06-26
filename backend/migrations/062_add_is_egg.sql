-- Migration 062: Add is_egg to menu_items
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_egg BOOLEAN DEFAULT false;
