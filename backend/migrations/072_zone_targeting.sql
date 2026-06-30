-- Migration 072: Zone targeting for offers, promo codes, and campaigns
-- NULL zone_id = applies to ALL zones
-- A specific UUID = applies to that zone only

ALTER TABLE menu_offers
  ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES zones(id) ON DELETE SET NULL;

ALTER TABLE promo_codes
  ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES zones(id) ON DELETE SET NULL;

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES zones(id) ON DELETE SET NULL;

-- Indexes for zone-filtered queries
CREATE INDEX IF NOT EXISTS idx_menu_offers_zone ON menu_offers(zone_id);
CREATE INDEX IF NOT EXISTS idx_promo_codes_zone ON promo_codes(zone_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_zone ON campaigns(zone_id);
