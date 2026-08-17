-- Migration 078: Per-user usage limits and item caps for menu_offers
ALTER TABLE menu_offers
  ADD COLUMN IF NOT EXISTS per_user_limit INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_items_per_order INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS limit_reset_period VARCHAR(20) DEFAULT 'lifetime';

-- Table to track per-user menu offer redemptions
CREATE TABLE IF NOT EXISTS customer_offer_uses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  offer_id UUID NOT NULL REFERENCES menu_offers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  items_count INTEGER DEFAULT 1,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offer_uses_customer ON customer_offer_uses(customer_id);
CREATE INDEX IF NOT EXISTS idx_offer_uses_offer ON customer_offer_uses(offer_id);
