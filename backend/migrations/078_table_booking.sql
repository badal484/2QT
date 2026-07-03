-- Migration 078: Table Booking System
-- Supports own restaurants (partner_id IS NULL) and partner restaurants (partner_id = user_id).
-- VELTO only earns commission on platform-sourced bookings — walk-ins are outside this system.

-- ── User role for restaurant partners ────────────────────────────────────────
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'partner';

-- ── Display ID sequence ───────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS table_booking_seq START 1;

-- ── Restaurant configuration (one per zone, own or partner) ──────────────────
CREATE TABLE IF NOT EXISTS restaurant_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id UUID NOT NULL REFERENCES zones(id),
    name TEXT NOT NULL,
    description TEXT,
    cuisine_type TEXT,
    address TEXT,
    lat NUMERIC(10, 7),
    lng NUMERIC(10, 7),
    photos TEXT[] DEFAULT '{}',
    -- {"mon": {"open": "11:00", "close": "23:00", "closed": false}, ...}
    operating_hours JSONB NOT NULL DEFAULT '{}',
    slot_duration_minutes INTEGER NOT NULL DEFAULT 90,
    advance_booking_days INTEGER NOT NULL DEFAULT 7,
    -- minutes before slot_start within which cancellation is free
    cancellation_window_minutes INTEGER NOT NULL DEFAULT 120,
    -- 0 = no deposit required
    deposit_paise INTEGER NOT NULL DEFAULT 0,
    max_party_size INTEGER NOT NULL DEFAULT 10,
    gst_percent NUMERIC(4, 2) NOT NULL DEFAULT 5.00,
    -- VELTO commission on platform bookings (irrelevant for own restaurant)
    commission_percent NUMERIC(5, 2) NOT NULL DEFAULT 15.00,
    -- NULL = VELTO owns this restaurant; non-null = partner's user ID
    partner_id UUID REFERENCES users(id),
    -- RazorpayX details for partner payouts
    upi_id TEXT,
    razorpay_contact_id TEXT,
    razorpay_fund_account_id TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Physical tables inside the restaurant ────────────────────────────────────
CREATE TABLE IF NOT EXISTS restaurant_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurant_config(id) ON DELETE CASCADE,
    table_number TEXT NOT NULL,
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    UNIQUE (restaurant_id, table_number)
);

-- ── Dine-in menu (separate from the delivery kitchen menu) ───────────────────
CREATE TABLE IF NOT EXISTS restaurant_menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurant_config(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price_paise INTEGER NOT NULL CHECK (price_paise > 0),
    category TEXT,
    image_url TEXT,
    is_veg BOOLEAN NOT NULL DEFAULT true,
    is_available BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Main reservation records ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS table_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_id TEXT UNIQUE NOT NULL DEFAULT
        'TB-' || LPAD(nextval('table_booking_seq')::TEXT, 4, '0'),
    restaurant_id UUID NOT NULL REFERENCES restaurant_config(id),
    customer_id UUID NOT NULL REFERENCES users(id),
    -- assigned at booking time via availability check
    table_id UUID REFERENCES restaurant_tables(id),
    party_size INTEGER NOT NULL CHECK (party_size > 0),
    slot_start TIMESTAMPTZ NOT NULL,
    slot_end TIMESTAMPTZ NOT NULL,
    occasion TEXT CHECK (occasion IN ('birthday', 'anniversary', 'business', 'date', 'other')),
    special_requests TEXT,
    status TEXT NOT NULL DEFAULT 'confirmed'
        CHECK (status IN ('pending_payment', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show')),

    -- ── Financial tracking ────────────────────────────────────────────────────
    pre_order_amount_paise INTEGER NOT NULL DEFAULT 0,   -- paid at booking time
    post_order_amount_paise INTEGER NOT NULL DEFAULT 0,  -- added during dining
    gst_amount_paise INTEGER NOT NULL DEFAULT 0,         -- computed at checkout
    deposit_amount_paise INTEGER NOT NULL DEFAULT 0,     -- held deposit
    total_paid_paise INTEGER NOT NULL DEFAULT 0,         -- all payments received

    -- Payment for the pre-order (if done via Razorpay gateway)
    gateway_order_id TEXT,
    gateway_payment_id TEXT,

    -- ── Settlement ────────────────────────────────────────────────────────────
    final_payment_method TEXT
        CHECK (final_payment_method IN ('app_wallet', 'app_upi', 'cash', 'card_pos')),

    -- ── Timestamps ────────────────────────────────────────────────────────────
    seated_at TIMESTAMPTZ,
    bill_generated_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    no_show_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Items: pre-order (booked in advance) + post-order (at the table) ─────────
CREATE TABLE IF NOT EXISTS table_booking_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES table_bookings(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES restaurant_menu_items(id),
    menu_item_name TEXT NOT NULL,
    price_paise INTEGER NOT NULL CHECK (price_paise > 0),
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    customizations JSONB,
    type TEXT NOT NULL DEFAULT 'pre_order'
        CHECK (type IN ('pre_order', 'post_order')),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'preparing', 'served')),
    added_by UUID REFERENCES users(id),  -- customer or staff
    ordered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Payment records: one per payment event (pre-order, final, refund) ────────
CREATE TABLE IF NOT EXISTS table_booking_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES table_bookings(id) ON DELETE CASCADE,
    amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
    payment_method TEXT NOT NULL
        CHECK (payment_method IN ('wallet', 'upi', 'cash', 'card_pos', 'gateway')),
    payment_type TEXT NOT NULL
        CHECK (payment_type IN ('pre_order', 'deposit', 'final_settlement', 'refund')),
    gateway_payment_id TEXT,
    gateway_order_id TEXT,
    collected_by UUID REFERENCES users(id),  -- staff who collected cash/card
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Waitlist for fully-booked slots ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS table_booking_waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurant_config(id),
    customer_id UUID NOT NULL REFERENCES users(id),
    slot_date DATE NOT NULL,
    preferred_time TEXT,
    party_size INTEGER NOT NULL CHECK (party_size > 0),
    notified_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'waiting'
        CHECK (status IN ('waiting', 'notified', 'booked', 'expired')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Partner payout records (weekly, per restaurant) ───────────────────────────
-- Only applicable when restaurant_config.partner_id IS NOT NULL.
-- net_payout = gross_revenue - commission - cash_collected_by_partner
CREATE TABLE IF NOT EXISTS partner_restaurant_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES users(id),
    restaurant_id UUID NOT NULL REFERENCES restaurant_config(id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    gross_revenue_paise INTEGER NOT NULL DEFAULT 0,       -- all bookings this period
    app_payments_paise INTEGER NOT NULL DEFAULT 0,        -- via VELTO gateway/wallet
    cash_collected_paise INTEGER NOT NULL DEFAULT 0,      -- partner collected directly
    commission_paise INTEGER NOT NULL DEFAULT 0,          -- VELTO keeps this
    net_payout_paise INTEGER NOT NULL DEFAULT 0,          -- transferred to partner

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
    razorpay_payout_id TEXT,
    utr_number TEXT,
    failure_reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMPTZ,

    UNIQUE (restaurant_id, period_start, period_end)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Overlap check: fastest path for availability queries
CREATE INDEX IF NOT EXISTS idx_table_bookings_slot
    ON table_bookings(table_id, slot_start, slot_end)
    WHERE status NOT IN ('cancelled', 'no_show');

-- Customer "My Bookings" list
CREATE INDEX IF NOT EXISTS idx_table_bookings_customer
    ON table_bookings(customer_id, slot_start DESC);

-- Restaurant dashboard: today/week view
CREATE INDEX IF NOT EXISTS idx_table_bookings_restaurant
    ON table_bookings(restaurant_id, slot_start)
    WHERE status NOT IN ('cancelled', 'no_show');

-- Finance / admin status filter
CREATE INDEX IF NOT EXISTS idx_table_bookings_status
    ON table_bookings(status, slot_start);

-- Menu browsing
CREATE INDEX IF NOT EXISTS idx_restaurant_menu_items_restaurant
    ON restaurant_menu_items(restaurant_id, is_available, sort_order);

-- Home-screen card: find active restaurant for a zone
CREATE INDEX IF NOT EXISTS idx_restaurant_config_zone
    ON restaurant_config(zone_id)
    WHERE is_active = true;

-- Partner payout queue
CREATE INDEX IF NOT EXISTS idx_partner_payouts_status
    ON partner_restaurant_payouts(status, created_at);

CREATE INDEX IF NOT EXISTS idx_partner_payouts_rzp
    ON partner_restaurant_payouts(razorpay_payout_id)
    WHERE razorpay_payout_id IS NOT NULL;
