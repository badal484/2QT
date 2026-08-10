-- Add composite indexes for common API queries

-- 1. Optimize GET /orders/mine
CREATE INDEX IF NOT EXISTS idx_orders_customer_created_at ON orders(customer_id, created_at DESC);

-- 2. Optimize GET /orders/active
CREATE INDEX IF NOT EXISTS idx_orders_customer_status ON orders(customer_id, status);

-- 3. Optimize GET /orders/:id queries
-- The primary key handles finding the order, but order_items lacks a composite index to the order. 
-- Wait, idx_order_items_order_id exists.

-- 4. Optimize GET /customer/loyalty where we filter by customer_id and expires_at > NOW()
CREATE INDEX IF NOT EXISTS idx_loyalty_customer_expires ON loyalty_transactions(customer_id, expires_at);
