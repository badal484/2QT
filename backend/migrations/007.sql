-- Migration 007: Orders
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_id TEXT UNIQUE,
    customer_id UUID NOT NULL REFERENCES users(id),
    kitchen_id UUID NOT NULL REFERENCES kitchens(id),
    zone_id UUID NOT NULL REFERENCES zones(id),
    rider_id UUID REFERENCES users(id),
    address_id UUID NOT NULL REFERENCES addresses(id),
    status order_status NOT NULL DEFAULT 'pending_payment',
    claimed_by_chef_id UUID REFERENCES users(id),
    claimed_at TIMESTAMPTZ,
    special_instructions TEXT,
    subtotal_paise INTEGER NOT NULL,
    delivery_fee_paise INTEGER NOT NULL,
    discount_paise INTEGER DEFAULT 0,
    loyalty_discount_paise INTEGER DEFAULT 0,
    wallet_deduction_paise INTEGER DEFAULT 0,
    surge_paise INTEGER DEFAULT 0,
    cgst_paise INTEGER NOT NULL,
    sgst_paise INTEGER NOT NULL,
    total_amount_paise INTEGER NOT NULL,
    gateway_amount_paise INTEGER NOT NULL,
    payment_method TEXT,
    payment_status payment_status DEFAULT 'pending',
    cashfree_order_id TEXT UNIQUE,
    cashfree_payment_id TEXT,
    promo_code_used TEXT,
    subscription_id UUID, -- Will be foreign key to subscriptions later
    is_subscription_order BOOLEAN DEFAULT false,
    is_scheduled BOOLEAN DEFAULT false,
    scheduled_for TIMESTAMPTZ,
    delivery_otp TEXT,
    delivery_otp_expires_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    refund_amount_paise INTEGER DEFAULT 0,
    refund_status refund_status DEFAULT 'none',
    invoice_number TEXT UNIQUE,
    invoice_url TEXT,
    buyer_gstin TEXT,
    buyer_company_name TEXT,
    estimated_delivery_at TIMESTAMPTZ,
    actual_delivery_minutes INTEGER,
    delivery_location_lat DECIMAL,
    delivery_location_lng DECIMAL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- State machine trigger
CREATE OR REPLACE FUNCTION enforce_order_status_machine()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'pending_payment' AND NEW.status NOT IN ('confirmed', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid transition from pending_payment to %', NEW.status;
    ELSIF OLD.status = 'confirmed' AND NEW.status NOT IN ('preparing', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid transition from confirmed to %', NEW.status;
    ELSIF OLD.status = 'preparing' AND NEW.status NOT IN ('ready_for_pickup', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid transition from preparing to %', NEW.status;
    ELSIF OLD.status = 'ready_for_pickup' AND NEW.status NOT IN ('out_for_delivery', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid transition from ready_for_pickup to %', NEW.status;
    ELSIF OLD.status = 'out_for_delivery' AND NEW.status NOT IN ('delivered', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid transition from out_for_delivery to %', NEW.status;
    ELSIF OLD.status IN ('delivered', 'cancelled') THEN
        RAISE EXCEPTION 'Cannot change status from %', OLD.status;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_order_status_machine ON orders;
CREATE TRIGGER trigger_order_status_machine
BEFORE UPDATE OF status ON orders
FOR EACH ROW EXECUTE FUNCTION enforce_order_status_machine();

-- Invoice number and display_id trigger
CREATE OR REPLACE FUNCTION generate_order_ids()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'confirmed' AND OLD.status = 'pending_payment' THEN
        IF NEW.invoice_number IS NULL THEN
            NEW.invoice_number := 'V-' || to_char(NOW(), 'YYYY') || '-' || LPAD(nextval('invoice_number_seq')::text, 4, '0');
        END IF;
    END IF;
    
    IF NEW.display_id IS NULL THEN
        NEW.display_id := 'V-' || to_char(NOW(), 'YYYY') || '-' || LPAD(nextval('invoice_number_seq')::text, 4, '0'); -- Using same seq for display_id for now or another one
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_order_ids ON orders;
CREATE TRIGGER trigger_order_ids
BEFORE INSERT OR UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION generate_order_ids();

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id),
    menu_item_id UUID NOT NULL REFERENCES menu_items(id),
    menu_item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    price_paise INTEGER NOT NULL,
    station TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_order_items_updated_at ON order_items;
CREATE TRIGGER update_order_items_updated_at BEFORE UPDATE ON order_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
