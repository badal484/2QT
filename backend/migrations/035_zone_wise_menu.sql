-- Migration 035: Zone-Wise Menu Uniqueness
ALTER TABLE menu_items DROP CONSTRAINT IF EXISTS menu_items_name_unique;
ALTER TABLE menu_items ADD CONSTRAINT menu_items_zone_name_unique UNIQUE (zone_id, name);
