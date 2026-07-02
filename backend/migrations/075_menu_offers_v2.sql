-- Rename name→title, add description, multi-target, expanded audience
ALTER TABLE menu_offers RENAME COLUMN name TO title;
ALTER TABLE menu_offers ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE menu_offers ADD COLUMN IF NOT EXISTS target_ids UUID[];
ALTER TABLE menu_offers ADD COLUMN IF NOT EXISTS audience_config JSONB DEFAULT '{}';

-- Expand audience constraint
ALTER TABLE menu_offers DROP CONSTRAINT IF EXISTS menu_offers_audience_check;
ALTER TABLE menu_offers ADD CONSTRAINT menu_offers_audience_check
  CHECK (audience = ANY (ARRAY[
    'all'::text, 'new_users'::text, 'plus_subscribers'::text,
    'loyal'::text, 'at_risk'::text, 'churned'::text, 'high_spenders'::text
  ]));

CREATE INDEX IF NOT EXISTS idx_menu_offers_target_ids ON menu_offers USING gin(target_ids);
