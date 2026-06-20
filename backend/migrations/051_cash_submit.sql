-- Migration 051: Rider cash submission tracking (per-delivery)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS cash_submit_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cash_submit_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cash_submit_confirmed_by UUID REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_orders_cash_submit ON orders(cash_submit_requested_at)
  WHERE cash_submit_requested_at IS NOT NULL AND cod_cash_collected = FALSE;
