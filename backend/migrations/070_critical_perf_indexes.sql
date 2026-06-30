-- Critical performance indexes missing from the initial set.
-- Each index targets the most frequent query patterns found in the route audit.

-- orders.customer_id: used by GET /orders/mine and GET /orders/active on EVERY customer page load
CREATE INDEX IF NOT EXISTS idx_orders_customer_id      ON orders(customer_id);

-- Partial index for active orders — much smaller, fits in memory, instant lookup
CREATE INDEX IF NOT EXISTS idx_orders_customer_active  ON orders(customer_id, created_at DESC)
    WHERE status NOT IN ('delivered', 'cancelled');

-- order_items.order_id: every single order detail/history fetch does this join
CREATE INDEX IF NOT EXISTS idx_order_items_order_id    ON order_items(order_id);

-- users.phone: OTP login path — called on every login attempt, no index = full seq scan
CREATE INDEX IF NOT EXISTS idx_users_phone             ON users(phone);

-- loyalty_transactions.order_id + type: cancel flow reverse-loyalty lookup
CREATE INDEX IF NOT EXISTS idx_loyalty_order_id        ON loyalty_transactions(order_id, type);

-- notifications: unread bell fetch ordered by time
CREATE INDEX IF NOT EXISTS idx_notifications_user_time ON notifications(user_id, created_at DESC);

-- refresh_tokens.user_id: logout rotates tokens by user
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id  ON refresh_tokens(user_id);

-- collection_items.collection_id: home feed LEFT JOIN
CREATE INDEX IF NOT EXISTS idx_collection_items_coll   ON collection_items(collection_id, sort_order);

-- promotional_banners: home feed banner load
CREATE INDEX IF NOT EXISTS idx_banners_active_order    ON promotional_banners(is_active, display_order)
    WHERE is_active = true;

-- orders: kitchen dashboard active queue (admin live orders)
CREATE INDEX IF NOT EXISTS idx_orders_kitchen_active   ON orders(kitchen_id, created_at DESC)
    WHERE status NOT IN ('delivered', 'cancelled');

-- orders: rider assignment lookup
CREATE INDEX IF NOT EXISTS idx_orders_rider_active     ON orders(rider_id, status)
    WHERE status NOT IN ('delivered', 'cancelled');
