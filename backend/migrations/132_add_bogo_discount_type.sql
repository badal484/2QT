-- Migration 132: Allow 'bogo' discount type in menu_offers and promo_codes
DO $$ BEGIN
  ALTER TABLE menu_offers DROP CONSTRAINT IF EXISTS menu_offers_discount_type_check;
  ALTER TABLE menu_offers ADD CONSTRAINT menu_offers_discount_type_check
    CHECK (discount_type IN ('percentage', 'flat', 'bogo'));
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE promo_codes DROP CONSTRAINT IF EXISTS promo_codes_discount_type_check;
  ALTER TABLE promo_codes ADD CONSTRAINT promo_codes_discount_type_check
    CHECK (discount_type IN ('percentage', 'flat', 'bogo'));
EXCEPTION WHEN OTHERS THEN NULL; END $$;
