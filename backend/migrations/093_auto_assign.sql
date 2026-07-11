-- Add dispatch mode per zone (manual = pool broadcast, auto = best-rider assignment)
ALTER TABLE zones
    ADD COLUMN IF NOT EXISTS dispatch_mode TEXT NOT NULL DEFAULT 'manual'
    CHECK (dispatch_mode IN ('manual', 'auto'));

-- Track whether an order was auto-assigned (for analytics and UI hints)
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS auto_assigned BOOLEAN NOT NULL DEFAULT false;
