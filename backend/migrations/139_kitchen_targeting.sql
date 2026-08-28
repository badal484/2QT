-- Migration 139: Kitchen targeting for offers and promo codes
-- NULL kitchen_id & NULL zone_id = applies to ALL Platform (Global)
-- zone_id set & NULL kitchen_id = applies to Specific Zone
-- kitchen_id set = applies to Specific Kitchen

ALTER TABLE menu_offers
  ADD COLUMN IF NOT EXISTS kitchen_id UUID REFERENCES kitchens(id) ON DELETE SET NULL;

ALTER TABLE promo_codes
  ADD COLUMN IF NOT EXISTS kitchen_id UUID REFERENCES kitchens(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_menu_offers_kitchen ON menu_offers(kitchen_id);
CREATE INDEX IF NOT EXISTS idx_promo_codes_kitchen ON promo_codes(kitchen_id);
