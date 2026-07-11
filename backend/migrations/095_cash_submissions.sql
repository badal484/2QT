-- Groups batch cash submissions from riders
-- One submission = one trip to the finance desk (or one UPI transfer)
CREATE TABLE IF NOT EXISTS cash_submissions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id        UUID        NOT NULL REFERENCES users(id),
  total_amount_paise  INTEGER NOT NULL,
  order_count     INTEGER     NOT NULL,
  method          VARCHAR(20) NOT NULL DEFAULT 'physical'
                              CHECK (method IN ('physical', 'upi_transfer')),
  utr_number      VARCHAR(100),          -- filled for upi_transfer method
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'confirmed', 'rejected')),
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at    TIMESTAMPTZ,
  confirmed_by    UUID        REFERENCES users(id),
  notes           TEXT
);

-- Maps each order to its submission
CREATE TABLE IF NOT EXISTS cash_submission_orders (
  submission_id   UUID    NOT NULL REFERENCES cash_submissions(id) ON DELETE CASCADE,
  order_id        UUID    NOT NULL REFERENCES orders(id),
  amount_paise    INTEGER NOT NULL,
  PRIMARY KEY (submission_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_cash_submissions_rider   ON cash_submissions(rider_id, status);
CREATE INDEX IF NOT EXISTS idx_cash_submissions_status  ON cash_submissions(status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_sub_orders_order    ON cash_submission_orders(order_id);
