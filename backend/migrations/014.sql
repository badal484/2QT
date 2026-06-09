-- Migration 014: Kitchen Ops and Fleet Improvements

-- Production Batches for bulk cooking
CREATE TABLE production_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kitchen_id UUID NOT NULL REFERENCES kitchens(id),
    item_name TEXT NOT NULL,
    target_quantity INTEGER NOT NULL,
    current_quantity INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'in_progress', -- in_progress, completed, cancelled
    batch_start_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_production_batches_updated_at BEFORE UPDATE ON production_batches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Daily Prep Tasks
CREATE TABLE prep_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kitchen_id UUID NOT NULL REFERENCES kitchens(id),
    title TEXT NOT NULL,
    category TEXT NOT NULL, -- e.g. Vegetables, Sauces, Meat
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_prep_tasks_updated_at BEFORE UPDATE ON prep_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Shift Handovers
CREATE TABLE shift_handovers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kitchen_id UUID NOT NULL REFERENCES kitchens(id),
    chef_id UUID NOT NULL REFERENCES users(id),
    notes TEXT,
    cleaning_completed BOOLEAN DEFAULT false,
    gas_safety_checked BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rider Payouts (Aliasing weekly_payouts or adding a specific table if needed)
-- Let's use rider_payouts as a more generic term used in the app
CREATE TABLE rider_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id UUID NOT NULL REFERENCES users(id),
    amount_paise INTEGER NOT NULL,
    status payout_status DEFAULT 'pending',
    reference_id TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_rider_payouts_updated_at BEFORE UPDATE ON rider_payouts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Standardize Feedback (Renaming or Aliasing)
-- The routes used 'order_feedback', let's create a view or just rename the table.
-- Actually, let's keep 'ratings' and add 'order_feedback' as an alias or new table.
-- Let's just create a new one for structured feedback.
CREATE TABLE order_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id),
    customer_id UUID NOT NULL REFERENCES users(id),
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
