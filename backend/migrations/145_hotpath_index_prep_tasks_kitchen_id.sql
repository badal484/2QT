-- Restoration of a deleted-migration-131 index (6/6). See 140_hotpath_index_recipes_menu_item_id.sql
-- for the full explanation and why this is a single-statement file.

-- prep_tasks.kitchen_id: kitchen ops screens
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prep_tasks_kitchen_id
    ON prep_tasks(kitchen_id);
