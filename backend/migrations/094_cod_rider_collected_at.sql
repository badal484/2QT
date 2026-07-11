-- Track when rider collected cash from customer at door (distinct from finance confirming receipt)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS cod_rider_collected_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_cod_rider_collected
  ON orders(cod_rider_collected_at)
  WHERE cod_rider_collected_at IS NOT NULL AND cod_cash_collected = FALSE;
