-- Migration 092: Per-zone max concurrent orders (Phase 1 = 1, Phase 2 = smart stacking)
ALTER TABLE zones
  ADD COLUMN IF NOT EXISTS max_concurrent_orders INTEGER NOT NULL DEFAULT 1;

-- Default everything to 1 (safe, controlled)
UPDATE zones SET max_concurrent_orders = 1 WHERE max_concurrent_orders IS NULL;
