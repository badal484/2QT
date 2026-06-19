-- Migration 047: Complete Finance System
-- Adds: finance role, commission fields, COD collections, kitchen payouts, partner fields

-- 1. Add finance role to enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'finance';

-- 2. Add commission + partner fields to kitchens
ALTER TABLE kitchens
  ADD COLUMN IF NOT EXISTS is_partner BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS partner_status TEXT DEFAULT 'none' CHECK (partner_status IN ('none','pending','approved','suspended')),
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,4) DEFAULT 0.20,
  ADD COLUMN IF NOT EXISTS upi_id TEXT,
  ADD COLUMN IF NOT EXISTS bank_account TEXT,
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS ifsc TEXT,
  ADD COLUMN IF NOT EXISTS contact_name TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS partner_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS partner_notes TEXT;

-- 3. Add commission breakdown to orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_paise INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS kitchen_payout_paise INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_delivery_paise INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cod_cash_collected BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cod_collected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cod_collected_by UUID REFERENCES users(id);

-- 4. COD Collections log (who collected cash from which rider, when)
CREATE TABLE IF NOT EXISTS cod_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID NOT NULL REFERENCES users(id),
  order_id UUID REFERENCES orders(id),
  amount_paise INTEGER NOT NULL,
  collected_by UUID REFERENCES users(id), -- finance/admin user
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Kitchen payouts (parallel to weekly_payouts for riders)
CREATE TABLE IF NOT EXISTS kitchen_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kitchen_id UUID NOT NULL REFERENCES kitchens(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  gross_sales_paise BIGINT NOT NULL DEFAULT 0,
  commission_paise BIGINT NOT NULL DEFAULT 0,
  net_payout_paise BIGINT NOT NULL DEFAULT 0,
  orders_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','paid','failed')),
  upi_reference TEXT,
  bank_reference TEXT,
  paid_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Kitchen partner applications (from "Partner with us" on website)
CREATE TABLE IF NOT EXISTS kitchen_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  cuisine_type TEXT,
  fssai_number TEXT,
  expected_daily_orders INTEGER,
  upi_id TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewing','approved','rejected')),
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Weekly_payouts: add upi_id column if missing (for rider UPI reference)
ALTER TABLE weekly_payouts
  ADD COLUMN IF NOT EXISTS upi_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- 8. Indexes
CREATE INDEX IF NOT EXISTS idx_cod_collections_rider ON cod_collections(rider_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_payouts_kitchen ON kitchen_payouts(kitchen_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_payouts_status ON kitchen_payouts(status);
CREATE INDEX IF NOT EXISTS idx_kitchen_applications_status ON kitchen_applications(status);
CREATE INDEX IF NOT EXISTS idx_orders_cod_collected ON orders(cod_cash_collected) WHERE payment_method = 'cod';
