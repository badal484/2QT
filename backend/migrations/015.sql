-- Migration 015: Unique constraint for menu_items name
ALTER TABLE menu_items DROP CONSTRAINT IF EXISTS menu_items_name_unique;
ALTER TABLE menu_items ADD CONSTRAINT menu_items_name_unique UNIQUE (name);
