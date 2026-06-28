-- ─── Notification Trigger Rules ──────────────────────────────────────────────
-- Admin-configurable automated notification rules (cart abandoned, re-engagement, etc.)

CREATE TABLE IF NOT EXISTS notification_triggers (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    event_type    TEXT NOT NULL CHECK (event_type IN (
                      'order_delivered',        -- fires X min after delivery (rating reminder)
                      'cart_abandoned',         -- fires X min after last cart add with no order
                      'no_order_days',          -- daily cron: users inactive for N days
                      'wallet_low',             -- fires when wallet drops below threshold
                      'subscription_expiring',  -- daily cron: subscription expiring in N days
                      'birthday_tomorrow',      -- daily cron: user birthday is tomorrow
                      'happy_hour_starting'     -- fires X min before happy hour campaign starts
                  )),
    delay_minutes INTEGER NOT NULL DEFAULT 0,
    template_type TEXT NOT NULL,               -- references notification_templates.type
    channels      TEXT[] DEFAULT ARRAY['push', 'whatsapp'],
    -- Audience
    audience_type TEXT NOT NULL DEFAULT 'all' CHECK (audience_type IN ('all', 'segment', 'custom')),
    segment       TEXT,                        -- 'new_users','active','at_risk','churned','loyal','subscribers'
    conditions    JSONB NOT NULL DEFAULT '{}', -- {"inactive_days":7} | {"max_balance_paise":10000} | {"expiry_days":3}
    -- Metadata
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    fired_count   INTEGER NOT NULL DEFAULT 0,
    last_fired_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tracks pending scheduled sends (so we can cancel if condition no longer valid)
CREATE TABLE IF NOT EXISTS notification_trigger_jobs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trigger_id    UUID NOT NULL REFERENCES notification_triggers(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fire_at       TIMESTAMPTZ NOT NULL,
    status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled')),
    context       JSONB NOT NULL DEFAULT '{}', -- {orderId, amount, etc.} passed as template vars
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(trigger_id, user_id, fire_at)       -- prevent duplicate scheduling
);

CREATE INDEX IF NOT EXISTS idx_trigger_jobs_fire_at   ON notification_trigger_jobs(fire_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_trigger_jobs_user       ON notification_trigger_jobs(user_id);

-- ─── Campaign audience + scheduling fields ────────────────────────────────────

ALTER TABLE campaigns
    ADD COLUMN IF NOT EXISTS audience_type       TEXT DEFAULT 'all',
    ADD COLUMN IF NOT EXISTS audience_segment    TEXT,
    ADD COLUMN IF NOT EXISTS audience_conditions JSONB DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS schedule_start      TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS schedule_end        TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS notif_template_type TEXT,    -- send this notification when campaign goes live
    ADD COLUMN IF NOT EXISTS notif_sent_at       TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reach_count         INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS conversion_count    INTEGER DEFAULT 0;

-- ─── Feature flags + business rules in app_settings ─────────────────────────

INSERT INTO app_settings (key, value, description) VALUES
    -- Feature flags (boolean)
    ('feature_online_payments',    'true',  'Accept online payments (Razorpay)'),
    ('feature_cod',                'true',  'Accept Cash on Delivery orders'),
    ('feature_wallet',             'true',  'Enable customer wallet'),
    ('feature_subscriptions',      'true',  'Enable meal subscription plans'),
    ('feature_referrals',          'true',  'Enable referral program'),
    ('feature_scheduling',         'true',  'Allow customers to schedule orders'),
    ('feature_live_kitchen',       'true',  'Show live kitchen feed to customers'),
    -- Business rules (numeric/string)
    ('min_order_paise',            '10000', 'Minimum order value in paise (₹100 = 10000)'),
    ('platform_fee_percent',       '5',     'Platform fee percentage charged per order'),
    ('max_delivery_radius_km',     '8',     'Maximum delivery radius in kilometres'),
    ('surge_order_threshold',      '3',     'Active orders count that triggers surge pricing'),
    ('wallet_cashback_cap_paise',  '20000', 'Maximum wallet cashback per order in paise (₹200 = 20000)'),
    ('kitchen_auto_close_time',    '23:30', 'Kitchen auto-close time (HH:MM, IST)')
ON CONFLICT (key) DO NOTHING;

-- ─── Seed default trigger rules ──────────────────────────────────────────────

INSERT INTO notification_triggers (name, event_type, delay_minutes, template_type, channels, conditions, is_active)
VALUES
    ('Rating Reminder',      'order_delivered',      45, 'order_delivered',         ARRAY['push','whatsapp'], '{}',                          FALSE),
    ('Cart Recovery',        'cart_abandoned',        30, 'broadcast_message',       ARRAY['push'],            '{}',                          FALSE),
    ('Win Back — 7 Days',    'no_order_days',          0, 'broadcast_message',       ARRAY['push','whatsapp'], '{"inactive_days": 7}',        FALSE),
    ('Win Back — 30 Days',   'no_order_days',          0, 'broadcast_message',       ARRAY['push','whatsapp'], '{"inactive_days": 30}',       FALSE),
    ('Low Wallet Alert',     'wallet_low',             0, 'broadcast_message',       ARRAY['push'],            '{"max_balance_paise": 10000}', FALSE),
    ('Subscription Expiry',  'subscription_expiring',  0, 'renewal_reminder',        ARRAY['push','whatsapp'], '{"expiry_days": 3}',          FALSE),
    ('Birthday Tomorrow',    'birthday_tomorrow',      0, 'broadcast_message',       ARRAY['push','whatsapp'], '{}',                          FALSE)
ON CONFLICT DO NOTHING;
