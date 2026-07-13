-- Packing station: track who packed each order and when
ALTER TABLE orders ADD COLUMN IF NOT EXISTS packed_by_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS packed_at TIMESTAMPTZ;

-- Index for packer queue queries (status = 'packing' per kitchen)
CREATE INDEX IF NOT EXISTS idx_orders_packing ON orders(kitchen_id, status) WHERE status = 'packing';
