-- Migration 117: Add missing indexes for hot-path queries
-- Identified by audit of GET /kitchen/orders, rider order pool, auto-assign

-- Rider order pool: WHERE rider_id = $1 AND status NOT IN (...)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_rider_active
    ON orders(rider_id, status)
    WHERE rider_id IS NOT NULL;

-- Customer tracking: WHERE customer_id = $1 AND status IN (...)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_customer_status
    ON orders(customer_id, status);

-- Auto-assign + dispatch: zone_id + status + rider_id IS NULL
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_zone_dispatch
    ON orders(zone_id, status, rider_id)
    WHERE status IN ('ready_for_pickup', 'confirmed');

-- Rider eligibility for auto-assign
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_zone_online
    ON users(zone_id, is_online)
    WHERE role IN ('rider', 'rider_captain');

-- order_items lookup by order (FK index, may already exist — IF NOT EXISTS guards it)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_id
    ON order_items(order_id);
