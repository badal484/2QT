-- Migration 032: Performance indexes for frequently queried columns
-- Identified from query analysis of live endpoints

-- weekly_payouts: queried by status='pending' in /admin/payouts/pending
CREATE INDEX IF NOT EXISTS idx_weekly_payouts_status
  ON weekly_payouts(status);

-- weekly_payouts: queried by rider in /riders/payouts
CREATE INDEX IF NOT EXISTS idx_weekly_payouts_rider_id
  ON weekly_payouts(rider_id);

-- kitchen_zones join table: joined on both columns in kitchen queries
CREATE INDEX IF NOT EXISTS idx_kitchen_zones_zone_id
  ON kitchen_zones(zone_id);

CREATE INDEX IF NOT EXISTS idx_kitchen_zones_kitchen_id
  ON kitchen_zones(kitchen_id);

-- support_tickets: filtered by status + ordered by created_at in /admin/support
CREATE INDEX IF NOT EXISTS idx_support_tickets_status_created
  ON support_tickets(status, created_at DESC);

-- support_tickets: looked up by customer_id
CREATE INDEX IF NOT EXISTS idx_support_tickets_customer_id
  ON support_tickets(customer_id);

-- subscriptions: queried by (customer_id, is_active) for /customers/subscriptions/my
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_active
  ON subscriptions(customer_id, is_active);

-- order_feedback: joined on order_id for rider rating aggregation
CREATE INDEX IF NOT EXISTS idx_order_feedback_order_id
  ON order_feedback(order_id);

-- users: filtered by role='rider' and role='customer' frequently
CREATE INDEX IF NOT EXISTS idx_users_role
  ON users(role);

-- users: searched by phone during OTP login
CREATE INDEX IF NOT EXISTS idx_users_phone
  ON users(phone);
