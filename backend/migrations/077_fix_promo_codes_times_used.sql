-- Migration 077: Ensure times_used column exists on promo_codes table
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS times_used INTEGER DEFAULT 0;
UPDATE promo_codes SET times_used = COALESCE(current_uses, 0) WHERE times_used IS NULL OR times_used = 0;
