-- Migration 150: Add optional zone_id targeting to promotional_banners table
--
-- Hybrid model:
--   zone_id IS NULL  -> Global / All Zones (shows to customers in every zone)
--   zone_id = <uuid> -> Zone-Specific (shows only to customers browsing that delivery zone)

ALTER TABLE promotional_banners ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES zones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_promotional_banners_zone_active ON promotional_banners(zone_id, is_active, display_order);
