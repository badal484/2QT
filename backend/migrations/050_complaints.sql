-- Migration 050: Order Complaints & Post-Delivery Refund System

CREATE TABLE IF NOT EXISTS order_complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rider_id UUID REFERENCES users(id),               -- for COD cash deduction tracking
  type TEXT NOT NULL CHECK (type IN (
    'wrong_item', 'missing_item', 'quality_issue',
    'late_delivery', 'rude_rider', 'other'
  )),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'rejected')),
  -- Refund decision
  refund_amount_paise INTEGER DEFAULT 0,
  refund_scope TEXT CHECK (refund_scope IN ('full', 'partial', 'none')),
  -- COD cash recovery tracking
  is_cod_cash_order BOOLEAN DEFAULT FALSE,
  cod_cash_deduction_pending BOOLEAN DEFAULT FALSE,  -- true = cash to recover from rider
  cod_cash_recovered BOOLEAN DEFAULT FALSE,
  -- Admin
  admin_note TEXT,
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_complaints_customer ON order_complaints(customer_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON order_complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_order ON order_complaints(order_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_complaints_one_per_order ON order_complaints(order_id); -- one complaint per order

-- Add deductions column to weekly_payouts for COD cash recovery
ALTER TABLE weekly_payouts
  ADD COLUMN IF NOT EXISTS cod_deductions_paise INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deduction_notes TEXT;
