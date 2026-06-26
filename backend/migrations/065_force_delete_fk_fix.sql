-- Allow admin to hard-delete menu items, zones, kitchens, and categories
-- at any time without FK constraint violations.
--
-- Strategy:
--   - order_items.menu_item_id → SET NULL  (preserve order line history, just lose the live item link)
--   - recipes.menu_item_id     → CASCADE   (recipes are meaningless without their item)
--   - orders.zone_id           → SET NULL  (preserve order history)
--   - orders.kitchen_id        → SET NULL  (preserve order history)
--   - menu_items.zone_id       → CASCADE   (zone deleted → its items deleted)
--   - menu_items.kitchen_id    → SET NULL  (item stays, kitchen link nulled)
--   - ingredients.kitchen_id   → CASCADE   (ingredients belong to kitchen)
--   - production_batches.kitchen_id  → SET NULL
--   - prep_tasks.kitchen_id          → SET NULL
--   - shift_handovers.kitchen_id     → SET NULL
--   - scheduled_orders.zone_id       → SET NULL

-- 1. order_items.menu_item_id: NOT NULL → nullable, then SET NULL on delete
ALTER TABLE order_items ALTER COLUMN menu_item_id DROP NOT NULL;
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_menu_item_id_fkey;
ALTER TABLE order_items
  ADD CONSTRAINT order_items_menu_item_id_fkey
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL;

-- 2. recipes.menu_item_id: cascade delete recipes when item deleted
ALTER TABLE recipes DROP CONSTRAINT IF EXISTS recipes_menu_item_id_fkey;
ALTER TABLE recipes
  ADD CONSTRAINT recipes_menu_item_id_fkey
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE;

-- 3. orders.zone_id → SET NULL
ALTER TABLE orders ALTER COLUMN zone_id DROP NOT NULL;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_zone_id_fkey;
ALTER TABLE orders
  ADD CONSTRAINT orders_zone_id_fkey
  FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE SET NULL;

-- 4. orders.kitchen_id → SET NULL
ALTER TABLE orders ALTER COLUMN kitchen_id DROP NOT NULL;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_kitchen_id_fkey;
ALTER TABLE orders
  ADD CONSTRAINT orders_kitchen_id_fkey
  FOREIGN KEY (kitchen_id) REFERENCES kitchens(id) ON DELETE SET NULL;

-- 5. menu_items.zone_id → CASCADE (deleting a zone wipes its items)
ALTER TABLE menu_items DROP CONSTRAINT IF EXISTS menu_items_zone_id_fkey;
ALTER TABLE menu_items
  ADD CONSTRAINT menu_items_zone_id_fkey
  FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE CASCADE;

-- 6. menu_items.kitchen_id → SET NULL (item outlives kitchen)
ALTER TABLE menu_items ALTER COLUMN kitchen_id DROP NOT NULL;
ALTER TABLE menu_items DROP CONSTRAINT IF EXISTS menu_items_kitchen_id_fkey;
ALTER TABLE menu_items
  ADD CONSTRAINT menu_items_kitchen_id_fkey
  FOREIGN KEY (kitchen_id) REFERENCES kitchens(id) ON DELETE SET NULL;

-- 7. ingredients.kitchen_id → CASCADE
ALTER TABLE ingredients DROP CONSTRAINT IF EXISTS ingredients_kitchen_id_fkey;
ALTER TABLE ingredients
  ADD CONSTRAINT ingredients_kitchen_id_fkey
  FOREIGN KEY (kitchen_id) REFERENCES kitchens(id) ON DELETE CASCADE;

-- 8. production_batches.kitchen_id → SET NULL
ALTER TABLE production_batches ALTER COLUMN kitchen_id DROP NOT NULL;
ALTER TABLE production_batches DROP CONSTRAINT IF EXISTS production_batches_kitchen_id_fkey;
ALTER TABLE production_batches
  ADD CONSTRAINT production_batches_kitchen_id_fkey
  FOREIGN KEY (kitchen_id) REFERENCES kitchens(id) ON DELETE SET NULL;

-- 9. prep_tasks.kitchen_id → SET NULL
ALTER TABLE prep_tasks ALTER COLUMN kitchen_id DROP NOT NULL;
ALTER TABLE prep_tasks DROP CONSTRAINT IF EXISTS prep_tasks_kitchen_id_fkey;
ALTER TABLE prep_tasks
  ADD CONSTRAINT prep_tasks_kitchen_id_fkey
  FOREIGN KEY (kitchen_id) REFERENCES kitchens(id) ON DELETE SET NULL;

-- 10. shift_handovers.kitchen_id → SET NULL
ALTER TABLE shift_handovers ALTER COLUMN kitchen_id DROP NOT NULL;
ALTER TABLE shift_handovers DROP CONSTRAINT IF EXISTS shift_handovers_kitchen_id_fkey;
ALTER TABLE shift_handovers
  ADD CONSTRAINT shift_handovers_kitchen_id_fkey
  FOREIGN KEY (kitchen_id) REFERENCES kitchens(id) ON DELETE SET NULL;

-- 11. scheduled_orders.zone_id → SET NULL
ALTER TABLE scheduled_orders ALTER COLUMN zone_id DROP NOT NULL;
ALTER TABLE scheduled_orders DROP CONSTRAINT IF EXISTS scheduled_orders_zone_id_fkey;
ALTER TABLE scheduled_orders
  ADD CONSTRAINT scheduled_orders_zone_id_fkey
  FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE SET NULL;
