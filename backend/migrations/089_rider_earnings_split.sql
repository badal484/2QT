-- Split bonus_earnings_paise into distance_bonus_paise + tip_paise
-- Old bonus column kept for backwards compat but no longer written to

ALTER TABLE rider_daily_earnings
  ADD COLUMN IF NOT EXISTS distance_bonus_paise INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tip_paise             INTEGER NOT NULL DEFAULT 0;

-- Backfill: move existing bonus into tip_paise (all historic bonus was tips since
-- distances were NULL when this migration runs — no distance bonus was ever stored correctly)
UPDATE rider_daily_earnings
SET tip_paise = COALESCE(bonus_earnings_paise, 0)
WHERE tip_paise = 0 AND COALESCE(bonus_earnings_paise, 0) > 0;
