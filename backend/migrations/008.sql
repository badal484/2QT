-- Migration 008: Subscriptions
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES users(id),
    plan_type TEXT NOT NULL, -- '20_lunch', '30_lunch', '20_dinner', '30_dinner'
    meals_total INTEGER NOT NULL,
    meals_remaining INTEGER NOT NULL,
    price_paid_paise INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    upi_mandate_id TEXT,
    carry_forward_meals INTEGER DEFAULT 0,
    renewed_early BOOLEAN DEFAULT false,
    renewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add foreign key back to orders
ALTER TABLE orders ADD CONSTRAINT fk_orders_subscription FOREIGN KEY (subscription_id) REFERENCES subscriptions(id);
