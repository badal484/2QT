-- Migration 125: Notification click tracking
-- Adds clicked_at so we can measure open/click rates per notification type

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_notifications_clicked
  ON notifications(type, clicked_at)
  WHERE clicked_at IS NOT NULL;
