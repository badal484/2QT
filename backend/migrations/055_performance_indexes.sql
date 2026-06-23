-- Performance indexes for slow queries

-- zones: serviceability check filters on is_active
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zones_active ON zones(is_active);

-- menu_items: kitchen filter (used in kitchen dashboard + finance product revenue)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_menu_items_kitchen_id ON menu_items(kitchen_id);

-- menu_items: available items by zone (most common menu query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_menu_items_zone_active ON menu_items(zone_id, available) WHERE available = true;

-- orders: finance dashboard date-range scans
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_created_at_status ON orders(created_at DESC, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_kitchen_delivered ON orders(kitchen_id, status) WHERE status = 'delivered';

-- order_items: product revenue join
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_menu_item_id ON order_items(menu_item_id);

-- addresses: active delivery addresses lookup (soft-deleted rows use deleted_at)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_addresses_not_deleted ON addresses(customer_id) WHERE deleted_at IS NULL;

-- rider_daily_earnings: payout cron date range
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rider_daily_earnings_date ON rider_daily_earnings(rider_id, date DESC);

-- weekly_payouts: pending payout lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_weekly_payouts_status ON weekly_payouts(status, rider_id);

-- kitchen_payouts: pending payout lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kitchen_payouts_status ON kitchen_payouts(status, kitchen_id);
