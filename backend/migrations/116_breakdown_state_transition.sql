-- Migration 116: Allow out_for_delivery → ready_for_pickup transition
-- Needed for bike breakdown mid-delivery: rider reports breakdown, order is
-- reset to ready_for_pickup so dispatcher can assign a new rider.
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
    ELSIF OLD.status = 'out_for_delivery' AND NEW.status NOT IN ('delivered', 'cancelled', 'ready_for_pickup') THEN
        RAISE EXCEPTION 'Invalid transition from out_for_delivery to %', NEW.status;
    ELSIF OLD.status IN ('delivered', 'cancelled') THEN
        RAISE EXCEPTION 'Cannot change status from %', OLD.status;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
