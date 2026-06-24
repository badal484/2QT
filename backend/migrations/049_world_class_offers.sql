-- Migration 049: World-Class Offers & Loyalty System
-- Adds: campaigns, streaks, milestones, tiers, 2QT Plus, enhanced promos, refund fixes

-- 0. Add partially_refunded to payment_status enum (for bug 7 fix)
DO $$ BEGIN
  ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'partially_refunded';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1. Enhanced promo_codes
ALTER TABLE promo_codes
  ADD COLUMN IF NOT EXISTS discount_flat_paise INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_order_only BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS new_user_only BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS per_user_limit INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS kitchen_id UUID REFERENCES kitchens(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description TEXT;

-- 2. Per-user promo usage tracking (prevents abuse + enables per_user_limit)
CREATE TABLE IF NOT EXISTS customer_promo_uses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  promo_code_id UUID NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_promo_uses_customer ON customer_promo_uses(customer_id);
CREATE INDEX IF NOT EXISTS idx_promo_uses_code ON customer_promo_uses(promo_code_id);

-- 3. Campaigns table (all auto-offer types managed from admin)
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'welcome', 'winback', 'birthday', 'flash_sale',
    'happy_hour', 'milestone', 'streak', 'plus_exclusive'
  )),
  is_active BOOLEAN DEFAULT TRUE,
  -- Discount config
  discount_type TEXT DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'flat', 'free_delivery')),
  discount_percent NUMERIC(5,2) DEFAULT 0,
  discount_flat_paise INTEGER DEFAULT 0,
  max_discount_paise INTEGER,
  min_order_paise INTEGER DEFAULT 0,
  -- Win-back config
  winback_days INTEGER DEFAULT 7,
  -- Flash sale timing
  flash_start TIMESTAMPTZ,
  flash_end TIMESTAMPTZ,
  -- Happy hour timing
  happy_hour_start TIME,
  happy_hour_end TIME,
  happy_hour_days TEXT[] DEFAULT ARRAY['mon','tue','wed','thu','fri','sat','sun'],
  -- Streak / milestone config (JSON array of {threshold, reward_type, reward_value})
  config JSONB DEFAULT '{}',
  -- Meta
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default campaigns
INSERT INTO campaigns (name, type, is_active, discount_type, discount_percent, max_discount_paise, min_order_paise, winback_days, config)
VALUES
  ('Welcome Offer', 'welcome', true, 'percentage', 40, 6000, 10000, NULL, '{"code_prefix":"WELCOME"}'),
  ('Win-back Campaign', 'winback', true, 'flat', 0, NULL, 0, 7, '{"discount_flat_paise":3000,"code_prefix":"COMEBACK","expiry_hours":48}'),
  ('Birthday Special', 'birthday', true, 'percentage', 50, 7500, 0, NULL, '{"code_prefix":"BDAY"}'),
  ('Happy Hour', 'happy_hour', false, 'free_delivery', 0, NULL, 10000, NULL, '{"start":"15:00","end":"18:00","days":["mon","tue","wed","thu","fri","sat","sun"]}'),
  ('Order Streaks', 'streak', true, 'free_delivery', 0, NULL, 0, NULL, '{"rewards":[{"days":3,"type":"free_delivery"},{"days":7,"type":"flat","paise":3000}]}'),
  ('Order Milestones', 'milestone', true, 'flat', 0, NULL, 0, NULL, '{"milestones":[{"order":5,"type":"free_delivery"},{"order":25,"type":"flat","paise":5000},{"order":50,"type":"flat","paise":10000},{"order":100,"type":"flat","paise":20000}]}')
ON CONFLICT DO NOTHING;

-- 4. Customer streaks
CREATE TABLE IF NOT EXISTS customer_streaks (
  customer_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_order_date DATE,
  streak_freeze_used BOOLEAN DEFAULT FALSE
);

-- 5. Customer milestones reached
CREATE TABLE IF NOT EXISTS customer_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  milestone_order_number INTEGER NOT NULL,
  order_id UUID REFERENCES orders(id),
  reward_type TEXT NOT NULL,
  reward_paise INTEGER DEFAULT 0,
  reached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(customer_id, milestone_order_number)
);
CREATE INDEX IF NOT EXISTS idx_milestones_customer ON customer_milestones(customer_id);

-- 6. 2QT Plus subscriptions
CREATE TABLE IF NOT EXISTS plus_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled','expired')),
  plan TEXT NOT NULL DEFAULT 'monthly' CHECK (plan IN ('monthly','annual')),
  price_paise INTEGER NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  cancelled_at TIMESTAMPTZ,
  auto_renew BOOLEAN DEFAULT TRUE,
  razorpay_order_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_plus_subs_customer ON plus_subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_plus_subs_status ON plus_subscriptions(status);

-- 7. Loyalty tier + lifetime stats on users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS loyalty_tier TEXT DEFAULT 'bronze' CHECK (loyalty_tier IN ('bronze','silver','gold','platinum')),
  ADD COLUMN IF NOT EXISTS lifetime_orders INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifetime_spend_paise BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS birthday DATE,
  ADD COLUMN IF NOT EXISTS birthday_reward_year INTEGER;

-- Backfill lifetime_orders from existing orders
UPDATE users u
SET lifetime_orders = sub.cnt
FROM (
  SELECT customer_id, COUNT(*) as cnt
  FROM orders
  WHERE status = 'delivered'
  GROUP BY customer_id
) sub
WHERE u.id = sub.customer_id;

-- Backfill lifetime_spend from existing delivered orders
UPDATE users u
SET lifetime_spend_paise = sub.total
FROM (
  SELECT customer_id, SUM(total_amount_paise) as total
  FROM orders
  WHERE status = 'delivered'
  GROUP BY customer_id
) sub
WHERE u.id = sub.customer_id;

-- Backfill loyalty tier based on lifetime orders
UPDATE users SET loyalty_tier = 'platinum' WHERE lifetime_orders >= 50;
UPDATE users SET loyalty_tier = 'gold'     WHERE lifetime_orders >= 25 AND loyalty_tier = 'bronze';
UPDATE users SET loyalty_tier = 'silver'   WHERE lifetime_orders >= 10 AND loyalty_tier = 'bronze';

-- 8. Win-back tracking (don't spam same customer)
CREATE TABLE IF NOT EXISTS winback_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_date DATE NOT NULL DEFAULT CURRENT_DATE,
  promo_code TEXT,
  UNIQUE(customer_id, campaign_id, sent_date)
);

-- 9. Indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_type ON campaigns(type);
CREATE INDEX IF NOT EXISTS idx_campaigns_active ON campaigns(is_active);
CREATE INDEX IF NOT EXISTS idx_plus_subs_expires ON plus_subscriptions(expires_at);
