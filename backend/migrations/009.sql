-- Migration 009: Scheduled and Recurring Orders
CREATE TABLE scheduled_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES users(id),
    address_id UUID NOT NULL REFERENCES addresses(id),
    zone_id UUID NOT NULL REFERENCES zones(id),
    scheduled_for TIMESTAMPTZ NOT NULL,
    items JSONB NOT NULL, -- array of {menuItemId, quantity}
    subtotal_paise INTEGER NOT NULL,
    delivery_fee_paise INTEGER NOT NULL,
    total_paise INTEGER NOT NULL,
    payment_method TEXT NOT NULL,
    payment_status payment_status DEFAULT 'pending',
    status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled, confirmed, cancelled, failed
    actual_order_id UUID, -- Links to orders table when created
    cancellation_reason TEXT,
    cancellation_refund_percent INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_scheduled_orders_updated_at ON scheduled_orders;
CREATE TRIGGER update_scheduled_orders_updated_at BEFORE UPDATE ON scheduled_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE recurring_meal_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES users(id),
    address_id UUID NOT NULL REFERENCES addresses(id),
    name TEXT NOT NULL,
    starts_on DATE NOT NULL,
    ends_on DATE,
    status TEXT NOT NULL DEFAULT 'active', -- active, paused, cancelled
    payment_method TEXT NOT NULL,
    paused_until DATE,
    pause_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_recurring_meal_plans_updated_at ON recurring_meal_plans;
CREATE TRIGGER update_recurring_meal_plans_updated_at BEFORE UPDATE ON recurring_meal_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE recurring_plan_day_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES recurring_meal_plans(id),
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    delivery_time TIME NOT NULL,
    items JSONB NOT NULL, -- array of {menuItemId, quantity}
    special_instructions TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_recurring_plan_day_configs_updated_at ON recurring_plan_day_configs;
CREATE TRIGGER update_recurring_plan_day_configs_updated_at BEFORE UPDATE ON recurring_plan_day_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE recurring_plan_exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES recurring_meal_plans(id),
    exception_date DATE NOT NULL,
    exception_type exception_type NOT NULL, -- skip, modify
    modified_items JSONB,
    modified_time TIME,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(plan_id, exception_date)
);

DROP TRIGGER IF EXISTS update_recurring_plan_exceptions_updated_at ON recurring_plan_exceptions;
CREATE TRIGGER update_recurring_plan_exceptions_updated_at BEFORE UPDATE ON recurring_plan_exceptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
