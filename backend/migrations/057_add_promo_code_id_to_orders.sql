-- Add promo_code_id FK column to orders (was manually applied to live DB, never committed as migration)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS promo_code_id UUID REFERENCES promo_codes(id);

-- Drop the old text column that predates the FK (migration 007 added promo_code_used TEXT)
ALTER TABLE orders DROP COLUMN IF EXISTS promo_code_used;
