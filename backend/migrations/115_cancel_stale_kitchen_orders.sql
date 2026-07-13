-- Migration 115: Cancel orders stuck in kitchen for more than 48 hours
-- These are ghost orders that were never claimed or completed; customers need
-- a refund/cancellation rather than an order frozen mid-pipeline forever.
UPDATE orders
SET
    status          = 'cancelled',
    cancelled_at    = NOW(),
    cancellation_reason = 'Automatically cancelled: order stuck in kitchen queue for more than 48 hours without completion'
WHERE status IN ('confirmed', 'preparing', 'packing', 'ready_for_pickup')
  AND created_at < NOW() - INTERVAL '48 hours';
