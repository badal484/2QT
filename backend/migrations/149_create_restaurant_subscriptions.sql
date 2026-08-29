-- Migration 149: Restaurant SaaS subscription/billing foundation (Phase 8 of the SaaS migration)
--
-- Platform-admin-managed billing records for a restaurant tenant's subscription to the 2QT
-- platform. Deliberately NOT a plan/pricing catalog — amount_paise and the billing period are
-- recorded per subscription record as actually agreed/charged by the admin creating it, never
-- looked up from an invented tier table. Billed via a one-off Razorpay Order per cycle (the
-- existing pattern already used by routes/payment.ts's /subscription/purchase), not Razorpay's
-- separate Subscriptions/Mandates API, which has no precedent anywhere in this codebase.
--
-- Creation/cancellation is platform-admin-only for this phase — no restaurant-side "owner" role
-- exists anywhere in the schema (restaurant_users.role is free-text, and every existing
-- restaurant-dashboard role is treated identically in routes/restaurant.ts) to safely grant
-- self-service billing to yet. See the Phase 8 report for the full reasoning.
--
-- Completely independent of orders/refunds/subscriptions/plus_subscriptions (customer-facing
-- payment tables, migrations 008 and 049) and of restaurant_config/table_bookings (the
-- unrelated dine-in system, migration 078). Hangs off `restaurants` (migration 146), the tenant
-- boundary introduced in Phase 3.
CREATE TABLE restaurant_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'cancelled')),
    amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
    billing_period_start TIMESTAMPTZ NOT NULL,
    billing_period_end TIMESTAMPTZ NOT NULL,
    razorpay_order_id TEXT,
    razorpay_payment_id TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    cancelled_by UUID REFERENCES users(id),
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_restaurant_subscriptions_restaurant_id ON restaurant_subscriptions(restaurant_id);
CREATE INDEX idx_restaurant_subscriptions_razorpay_order_id ON restaurant_subscriptions(razorpay_order_id);

-- One "in force" (pending or active) subscription per restaurant at a time. Additive: does not
-- restrict or block historical (cancelled) records — only current in-force records are unique.
CREATE UNIQUE INDEX idx_restaurant_subscriptions_one_in_force
    ON restaurant_subscriptions(restaurant_id) WHERE status IN ('pending', 'active');

DROP TRIGGER IF EXISTS update_restaurant_subscriptions_updated_at ON restaurant_subscriptions;
CREATE TRIGGER update_restaurant_subscriptions_updated_at BEFORE UPDATE ON restaurant_subscriptions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
