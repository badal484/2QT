-- Packing station: track who packed each order and when
ALTER TABLE orders ADD COLUMN IF NOT EXISTS packed_by_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS packed_at TIMESTAMPTZ;

-- Add 'packing' to the order_status enum
-- Cannot run inside a transaction block on some PG versions, so we guard with IF NOT EXISTS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumtypid = 'order_status'::regtype
          AND enumlabel = 'packing'
    ) THEN
        ALTER TYPE order_status ADD VALUE 'packing' BEFORE 'ready_for_pickup';
    END IF;
END$$;

-- Update the state machine trigger to allow the new packing transitions:
--   preparing → packing (chef hands off to packing station)
--   packing   → ready_for_pickup (packer confirms bag sealed)
CREATE OR REPLACE FUNCTION enforce_order_status_machine()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'pending_payment' AND NEW.status NOT IN ('confirmed', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid transition from pending_payment to %', NEW.status;
    ELSIF OLD.status = 'confirmed' AND NEW.status NOT IN ('preparing', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid transition from confirmed to %', NEW.status;
    ELSIF OLD.status = 'preparing' AND NEW.status NOT IN ('packing', 'ready_for_pickup', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid transition from preparing to %', NEW.status;
    ELSIF OLD.status = 'packing' AND NEW.status NOT IN ('ready_for_pickup', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid transition from packing to %', NEW.status;
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

-- Index for packer queue queries (status = 'packing' per kitchen)
CREATE INDEX IF NOT EXISTS idx_orders_packing ON orders(kitchen_id, status) WHERE status = 'packing';
