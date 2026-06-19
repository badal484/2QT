-- Migration 048: Add cod_pending to payment_status enum
-- Fixes COD orders that were incorrectly showing payment_status='paid' immediately

ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'cod_pending';

-- Backfill: any delivered COD orders where cash hasn't been collected yet → cod_pending
-- (only safe to run after migration 047 which added cod_cash_collected column)
UPDATE orders
SET payment_status = 'cod_pending'
WHERE payment_method = 'cod'
  AND payment_status = 'paid'
  AND (cod_cash_collected = FALSE OR cod_cash_collected IS NULL)
  AND status != 'cancelled';
