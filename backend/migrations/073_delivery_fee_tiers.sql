-- Migration 073: Minimum order, small order fee, and delivery fee tiers

-- Add minimum order + small order fee to zones
ALTER TABLE zones
  ADD COLUMN IF NOT EXISTS min_order_paise INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS small_order_fee_paise INTEGER NOT NULL DEFAULT 0;

-- Delivery fee tiers per zone
-- from_paise = subtotal must be >= this to qualify for this tier
-- to_paise   = subtotal must be <  this (NULL = unlimited / last tier)
CREATE TABLE IF NOT EXISTS delivery_fee_tiers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id      UUID NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  from_paise   INTEGER NOT NULL,
  to_paise     INTEGER,
  fee_paise    INTEGER NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_fee_tiers_zone ON delivery_fee_tiers(zone_id);
