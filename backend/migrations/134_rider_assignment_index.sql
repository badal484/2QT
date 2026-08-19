-- Composite index for the rider auto-assignment lookup (services/autoAssign.ts),
-- which filters users on zone_id + role + is_online + is_verified on every order.
--
-- Rollback (this migration system is forward-only — no down-migration runner exists;
-- run manually if ever needed):
--   DROP INDEX IF EXISTS idx_users_rider_assignment;

CREATE INDEX IF NOT EXISTS idx_users_rider_assignment
    ON users (zone_id, role, is_online, is_verified);
