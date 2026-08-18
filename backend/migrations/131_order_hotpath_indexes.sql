-- Migration 131: Order hot-path indexes (checkout stock deduction + kitchen ops)
-- Identified in the pre-deploy audit: recipes/recipe_ingredients/ingredients are joined on
-- EVERY order placement for stock deduction (order.service.ts, stock.service.ts), and
-- production_batches/prep_tasks are hit by kitchen_id on every kitchen ops screen load.
-- None of these six columns had an index despite being on the checkout hot path.
--
-- Uses CONCURRENTLY so these can be built against a live database without taking an
-- exclusive lock on tables that every order and kitchen screen load depends on. The
-- migration runner (src/db/migrate.ts) detects CONCURRENTLY and runs each statement
-- outside a transaction block, since CREATE INDEX CONCURRENTLY cannot run inside one.

-- recipes.menu_item_id: resolve which recipe(s) a menu item uses, on every order
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recipes_menu_item_id
    ON recipes(menu_item_id);

-- recipe_ingredients.recipe_id: stock deduction join, on every order
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recipe_ingredients_recipe_id
    ON recipe_ingredients(recipe_id);

-- recipe_ingredients.ingredient_id: stock deduction join, on every order
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recipe_ingredients_ingredient_id
    ON recipe_ingredients(ingredient_id);

-- ingredients.kitchen_id: kitchen stock-screen load + every stock update
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ingredients_kitchen_id
    ON ingredients(kitchen_id);

-- production_batches.kitchen_id: kitchen ops screens
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_production_batches_kitchen_id
    ON production_batches(kitchen_id);

-- prep_tasks.kitchen_id: kitchen ops screens
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prep_tasks_kitchen_id
    ON prep_tasks(kitchen_id);
