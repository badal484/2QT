-- Migration 079: Dine-In Staff Management
-- Adds dine_in_restaurant_id to link dine_in_staff users to their restaurant.

ALTER TABLE users ADD COLUMN IF NOT EXISTS dine_in_restaurant_id UUID REFERENCES restaurant_config(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_dine_in_restaurant ON users(dine_in_restaurant_id) WHERE dine_in_restaurant_id IS NOT NULL;
