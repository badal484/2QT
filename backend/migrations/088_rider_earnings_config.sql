-- Rider earnings rates configurable per zone (was hardcoded in rider.ts)
ALTER TABLE zones
  ADD COLUMN IF NOT EXISTS rider_base_pay_paise  INTEGER       NOT NULL DEFAULT 2000,
  ADD COLUMN IF NOT EXISTS rider_per_km_paise    INTEGER       NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS rider_free_km         NUMERIC(5,2)  NOT NULL DEFAULT 2.00;

-- Store actual road distance on the order (computed async via Google Distance Matrix)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_distance_metres INTEGER;
