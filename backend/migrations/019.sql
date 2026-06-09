-- Migration 019: Subscription Schema Alignment
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan_id TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT false;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS total_meals INTEGER;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS remaining_meals INTEGER;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS current_day_credits INTEGER DEFAULT 1;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Sync data if necessary (for development)
UPDATE subscriptions SET 
    plan_id = CASE 
        WHEN plan_type = '20_lunch' THEN 'sub_lunch_20'
        WHEN plan_type = '30_lunch' THEN 'sub_lunch_30'
        WHEN plan_type = '20_dinner' THEN 'sub_dinner_20'
        WHEN plan_type = '30_dinner' THEN 'sub_dinner_30'
        ELSE 'sub_lunch_20'
    END,
    total_meals = meals_total,
    remaining_meals = meals_remaining,
    expires_at = end_date::timestamptz
WHERE plan_id IS NULL;
