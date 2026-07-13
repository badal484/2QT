-- The DO-block approach in migration 103 was rolled back by the old migration
-- runner's ROLLBACK when CREATE FUNCTION failed. This bare statement runs as its
-- own autocommit statement so the new value commits before migration 108 runs.
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'packing' BEFORE 'ready_for_pickup';
