-- 081_booking_improvements.sql
-- Adds reminder tracking, feedback, reschedule support, and performance indexes

ALTER TABLE table_bookings
  ADD COLUMN IF NOT EXISTS reminder_24h_sent_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_2h_sent_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS feedback_rating        SMALLINT CHECK (feedback_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS feedback_comment       TEXT,
  ADD COLUMN IF NOT EXISTS feedback_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rescheduled_from_slot  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reschedule_count       SMALLINT NOT NULL DEFAULT 0;

-- Performance indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_tb_restaurant_slot
  ON table_bookings(restaurant_id, slot_start);

CREATE INDEX IF NOT EXISTS idx_tb_customer_status
  ON table_bookings(customer_id, status);

CREATE INDEX IF NOT EXISTS idx_tb_status_slot
  ON table_bookings(status, slot_start);

CREATE INDEX IF NOT EXISTS idx_tb_reminders
  ON table_bookings(status, slot_start, reminder_24h_sent_at, reminder_2h_sent_at)
  WHERE status = 'confirmed';

CREATE INDEX IF NOT EXISTS idx_tbi_booking_type_status
  ON table_booking_items(booking_id, type, status);
