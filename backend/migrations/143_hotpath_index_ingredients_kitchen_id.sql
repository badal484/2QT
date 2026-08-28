-- Restoration of a deleted-migration-131 index (4/6). See 140_hotpath_index_recipes_menu_item_id.sql
-- for the full explanation and why this is a single-statement file.

-- ingredients.kitchen_id: kitchen stock-screen load + every stock update
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ingredients_kitchen_id
    ON ingredients(kitchen_id);
