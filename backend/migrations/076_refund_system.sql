-- Migration 076: Full Refund System
-- Adds a central refunds table, refund_pending payment status, and ensures
-- gateway_payment_id (Razorpay pay_xxx) is indexed for fast refund lookups.

-- 1. New payment_status value: order is awaiting finance team approval to refund
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'refund_pending';

-- 2. Ensure gateway_payment_id column exists (was renamed from cashfree_payment_id in 016)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gateway_payment_id TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_gateway_payment_id ON orders(gateway_payment_id) WHERE gateway_payment_id IS NOT NULL;

-- 3. Central refunds ledger — tracks every refund regardless of path
CREATE TABLE IF NOT EXISTS refunds (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              UUID        NOT NULL REFERENCES orders(id),
  customer_id           UUID        NOT NULL REFERENCES users(id),
  complaint_id          UUID        REFERENCES order_complaints(id),

  amount_paise          INTEGER     NOT NULL CHECK (amount_paise > 0),
  -- wallet = in-app credit (instant), bank = Razorpay reversal (5-7 days)
  refund_type           TEXT        NOT NULL CHECK (refund_type IN ('wallet', 'bank')),
  reason                TEXT,

  -- pending   = waiting for finance approval
  -- processing = Razorpay refund initiated, waiting for webhook confirmation
  -- processed  = money has moved (wallet credited or bank reversed)
  -- failed     = Razorpay rejected the refund
  status                TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'processing', 'processed', 'failed')),

  initiated_by          UUID        REFERENCES users(id),  -- NULL = customer self-cancel
  approved_by           UUID        REFERENCES users(id),

  -- Razorpay fields (only for bank refunds)
  razorpay_payment_id   TEXT,       -- pay_xxx — the original payment to reverse
  razorpay_refund_id    TEXT,       -- rfnd_xxx — returned by Razorpay on initiation
  razorpay_speed        TEXT        DEFAULT 'optimum',  -- 'normal' or 'optimum'
  failure_reason        TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_refunds_order      ON refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_customer   ON refunds(customer_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status     ON refunds(status);
CREATE INDEX IF NOT EXISTS idx_refunds_complaint  ON refunds(complaint_id) WHERE complaint_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_refunds_rzp_refund ON refunds(razorpay_refund_id) WHERE razorpay_refund_id IS NOT NULL;
