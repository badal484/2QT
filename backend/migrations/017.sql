-- Migration 017: Rider Finance Enhancements
ALTER TABLE rider_daily_earnings 
ADD COLUMN IF NOT EXISTS cash_collected_paise INTEGER DEFAULT 0;

-- Add index for historical earning lookups
CREATE INDEX IF NOT EXISTS idx_rider_daily_earnings_date ON rider_daily_earnings(date);

-- Add support for subscription credit balance tracking in users table if needed
-- (Assuming currently handled by subscription table)
