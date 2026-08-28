-- Restoration of a deleted-migration-131 index (3/6). See 140_hotpath_index_recipes_menu_item_id.sql
-- for the full explanation and why this is a single-statement file.

-- recipe_ingredients.ingredient_id: stock deduction join, on every order
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recipe_ingredients_ingredient_id
    ON recipe_ingredients(ingredient_id);
