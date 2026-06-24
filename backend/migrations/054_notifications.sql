-- Migration 054: World-class notification system
-- Adds: notifications log, device tokens, preferences, editable templates

-- FCM device token on every user (replaces old fcm_token column if exists)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS device_token TEXT;

-- In-app notification center + delivery log
CREATE TABLE IF NOT EXISTS notifications (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            TEXT        NOT NULL,
  title           TEXT        NOT NULL,
  body            TEXT        NOT NULL,
  data            JSONB       DEFAULT '{}',
  is_read         BOOLEAN     DEFAULT FALSE,
  channel         TEXT        DEFAULT 'push',   -- push | whatsapp | sms | in_app
  delivery_status TEXT        DEFAULT 'sent',   -- sent | failed | skipped
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user     ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_created  ON notifications(created_at DESC);

-- Per-user notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id           UUID    PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  order_updates     BOOLEAN DEFAULT TRUE,
  promotions        BOOLEAN DEFAULT TRUE,
  payouts           BOOLEAN DEFAULT TRUE,
  push_enabled      BOOLEAN DEFAULT TRUE,
  whatsapp_enabled  BOOLEAN DEFAULT TRUE,
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Admin-editable notification templates
CREATE TABLE IF NOT EXISTS notification_templates (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type              TEXT        UNIQUE NOT NULL,
  label             TEXT        NOT NULL,
  title_template    TEXT        NOT NULL,
  body_template     TEXT        NOT NULL,
  whatsapp_template TEXT,
  channels          TEXT[]      DEFAULT ARRAY['push','whatsapp'],
  is_active         BOOLEAN     DEFAULT TRUE,
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO notification_templates (type, label, title_template, body_template, whatsapp_template, channels) VALUES
  ('order_confirmed',       'Order Confirmed',
   'Order Confirmed! 🎉',
   'Your order #{{displayId}} is confirmed. Chefs start in a moment — ~{{minutes}} mins.',
   '2QT: Your order #{{displayId}} is confirmed! ETA ~{{minutes}} mins.',
   ARRAY['push','whatsapp']),

  ('order_preparing',       'Order Preparing',
   'Chefs are cooking! 👨‍🍳',
   'Your meal is being freshly prepared right now.',
   '2QT: Your meal is being freshly prepared right now!',
   ARRAY['push','whatsapp']),

  ('order_ready',           'Order Ready for Pickup',
   'Order Ready! 🛵',
   'Your order is packed and a rider is on the way.',
   '2QT: Your order is packed — a rider is picking it up now!',
   ARRAY['push','whatsapp']),

  ('order_out_for_delivery','Out for Delivery',
   '{{riderName}} is heading to you! 🛵',
   'Your rider is on the way. OTP: {{otp}} — share only at door.',
   '2QT: {{riderName}} is on the way! Delivery OTP: {{otp}}.',
   ARRAY['push','whatsapp']),

  ('order_delivered',       'Order Delivered',
   'Delivered! Hope you enjoy 🎉',
   'Your order has been delivered. Rate your experience!',
   '2QT: Your order is delivered! Rate us in the app — we read every review.',
   ARRAY['push','whatsapp']),

  ('order_cancelled',       'Order Cancelled',
   'Order Cancelled',
   'Order #{{displayId}} cancelled. ₹{{amount}} refunded to your wallet.',
   '2QT: Your order #{{displayId}} was cancelled. ₹{{amount}} refunded to wallet.',
   ARRAY['push','whatsapp']),

  ('rider_payout',          'Rider Daily Payout',
   'Payment Sent! 💰',
   '₹{{amount}} sent to {{upiId}} — great work today!',
   '2QT: Your daily payout of ₹{{amount}} has been sent to {{upiId}}. Great work!',
   ARRAY['push','whatsapp']),

  ('kitchen_payout',        'Kitchen Daily Settlement',
   'Settlement Done! 💰',
   '₹{{amount}} transferred to {{upiId}} for today''s orders.',
   '2QT: Today''s settlement of ₹{{amount}} has been transferred to {{upiId}}.',
   ARRAY['push','whatsapp']),

  ('low_subscription_meals','Low Meal Balance',
   'Low Meal Balance ⚠️',
   'Only {{count}} meals left in your plan. Renew soon!',
   '2QT: You only have {{count}} meals left. Renew now to keep eating!',
   ARRAY['push','whatsapp']),

  ('rider_verified',        'Rider Account Approved',
   'You''re Approved! 🏍️',
   'Your rider account is live. Go online and start earning!',
   '2QT: Your rider account is approved! Go online and start earning.',
   ARRAY['push','whatsapp']),

  ('cash_submitted',        'Cash Handover Alert',
   'Cash Submission — Finance Action Required',
   'Rider {{riderName}} submitted ₹{{amount}} cash for Order #{{displayId}}.',
   NULL,
   ARRAY['push']),

  ('broadcast_message',     'Broadcast / Marketing',
   '{{title}}',
   '{{body}}',
   '{{body}}',
   ARRAY['push','whatsapp'])
ON CONFLICT (type) DO NOTHING;
