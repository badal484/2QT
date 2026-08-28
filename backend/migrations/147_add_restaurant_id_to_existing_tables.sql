-- Migration 147: Add nullable restaurant_id to existing tenant-owned tables
--
-- Additive only — NULL allowed everywhere, no NOT NULL constraint added (see the Phase 3 report
-- for why: kitchens/orders/menu_items can already have a NULL kitchen_id today, per migration
-- 065's "allow admin hard-delete" ON DELETE SET NULL behavior, so not every row has a
-- deterministic restaurant to backfill). Backfill itself happens in migration 148.

ALTER TABLE kitchens ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_kitchens_restaurant_id ON kitchens(restaurant_id);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON orders(restaurant_id);

ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_id ON menu_items(restaurant_id);

-- users.restaurant_id is the NEW delivery-business tenancy relationship introduced by this
-- phase. This is intentionally a DIFFERENT column from the existing users.dine_in_restaurant_id
-- (added in migration 079_dine_in_staff.sql), which is a separate, unrelated FK into the
-- independent restaurant_config/table-booking system and is NOT touched by this migration.
-- Do not conflate the two — see the Phase 3 report's note on middleware/auth.ts for the same
-- naming-collision consideration applied to req.user.
ALTER TABLE users ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_restaurant_id ON users(restaurant_id);
