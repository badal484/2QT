-- Restores an index originally introduced in the deleted migration
-- 131_order_hotpath_indexes.sql (added in commit 11cfbf5, unintentionally reverted alongside an
-- unrelated notification/UI change in commit 5c956b3 — see the Pre-Phase-3 Validation Report
-- for the full git-history trace). Re-created here under a fresh migration number per
-- instruction: never reuse a historical migration number/name.
--
-- Split into one CREATE INDEX CONCURRENTLY per migration file (140-145), deliberately: the
-- migration runner (src/db/migrate.ts) executes each file's entire contents as a single
-- node-postgres client.query(sql) call using the simple query protocol, and PostgreSQL
-- implicitly wraps a multi-statement simple-query message in one transaction block — which
-- CREATE INDEX CONCURRENTLY cannot run inside. A file containing exactly one statement avoids
-- that wrapping entirely, preserving the original non-blocking intent: safe to build against a
-- live database without taking an exclusive lock on a table every order placement depends on.

-- recipes.menu_item_id: resolve which recipe(s) a menu item uses, on every order
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recipes_menu_item_id
    ON recipes(menu_item_id);
