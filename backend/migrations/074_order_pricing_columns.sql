-- Store menu offer discounts, small order fee, and rider tip directly on the order row
ALTER TABLE orders ADD COLUMN IF NOT EXISTS menu_offer_discount_paise INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS small_order_fee_paise    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rider_tip_paise          INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_orders_menu_offer_discount ON orders(menu_offer_discount_paise) WHERE menu_offer_discount_paise > 0;
