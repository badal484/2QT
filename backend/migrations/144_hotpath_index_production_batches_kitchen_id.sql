-- Restoration of a deleted-migration-131 index (5/6). See 140_hotpath_index_recipes_menu_item_id.sql
-- for the full explanation and why this is a single-statement file.

-- production_batches.kitchen_id: kitchen ops screens
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_production_batches_kitchen_id
    ON production_batches(kitchen_id);
