-- Migration 036: Add missing columns detected in codebase audit

-- 1. ingredients: rename current_stock → current_stock_grams, reorder_threshold → reorder_threshold_grams
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ingredients' AND column_name='current_stock') THEN
        ALTER TABLE ingredients RENAME COLUMN current_stock TO current_stock_grams;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ingredients' AND column_name='reorder_threshold') THEN
        ALTER TABLE ingredients RENAME COLUMN reorder_threshold TO reorder_threshold_grams;
    END IF;
END $$;

-- 2. recipe_ingredients: rename quantity → quantity_grams
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recipe_ingredients' AND column_name='quantity') THEN
        ALTER TABLE recipe_ingredients RENAME COLUMN quantity TO quantity_grams;
    END IF;
END $$;

-- 3. loyalty_transactions: add type column, give description a default so inserts without it work
ALTER TABLE loyalty_transactions ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'earn';
ALTER TABLE loyalty_transactions ALTER COLUMN description SET DEFAULT '';

-- 4. users: add fraud-detection columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_ip TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS device_id TEXT;

-- 5. addresses: add soft-delete support
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 6. zones: add operational columns used by admin and menu routes
ALTER TABLE zones ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT 'Bengaluru';
ALTER TABLE zones ADD COLUMN IF NOT EXISTS delivery_fee_base_paise INTEGER NOT NULL DEFAULT 2500;
ALTER TABLE zones ADD COLUMN IF NOT EXISTS max_orders_per_hour INTEGER NOT NULL DEFAULT 60;
ALTER TABLE zones ADD COLUMN IF NOT EXISTS realistic_delivery_minutes INTEGER NOT NULL DEFAULT 30;
ALTER TABLE zones ADD COLUMN IF NOT EXISTS polygon_points JSONB;

-- 7. kitchens: add compliance columns
ALTER TABLE kitchens ADD COLUMN IF NOT EXISTS fssai_license TEXT;
ALTER TABLE kitchens ADD COLUMN IF NOT EXISTS gstin TEXT;

-- 8. promo_codes: add discount_percent, expires_at; rename discount_value → discount_value_paise
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS discount_percent INTEGER;
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promo_codes' AND column_name='discount_value') THEN
        ALTER TABLE promo_codes RENAME COLUMN discount_value TO discount_value_paise;
    END IF;
END $$;
