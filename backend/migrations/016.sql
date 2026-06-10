-- Migration 016: Indices and ID Sequence separation
CREATE SEQUENCE IF NOT EXISTS display_id_seq START 1;

CREATE OR REPLACE FUNCTION generate_order_ids()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'confirmed' AND (OLD IS NULL OR OLD.status = 'pending_payment') THEN
        IF NEW.invoice_number IS NULL THEN
            NEW.invoice_number := 'V-INV-' || to_char(NOW(), 'YYYY') || '-' || LPAD(nextval('invoice_number_seq')::text, 6, '0');
        END IF;
    END IF;
    IF NEW.display_id IS NULL THEN
        NEW.display_id := 'V-' || to_char(NOW(), 'YY') || '-' || LPAD(nextval('display_id_seq')::text, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Rename columns only if old name still exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='cashfree_order_id') THEN
        ALTER TABLE orders RENAME COLUMN cashfree_order_id TO gateway_order_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='cashfree_payment_id') THEN
        ALTER TABLE orders RENAME COLUMN cashfree_payment_id TO gateway_payment_id;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_kitchen_id ON orders(kitchen_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_customer_id ON wallet_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_customer_id ON loyalty_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_addresses_customer_id ON addresses(customer_id);
