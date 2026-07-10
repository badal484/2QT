-- Migration 091: Admin-configurable mission/quest system

-- Mission templates (admin creates/edits these)
CREATE TABLE IF NOT EXISTS mission_templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  icon         TEXT NOT NULL DEFAULT 'zap',   -- 'zap' | 'target' | 'trending-up' | 'trophy' | 'star' | 'flame'
  color        TEXT NOT NULL DEFAULT '#FC4603',
  type         TEXT NOT NULL CHECK (type IN ('delivery_count', 'earnings_amount', 'zone_deliveries')),
  -- tiers: [{target:5, reward_paise:5000, label:"Starter"}, ...]  ordered ascending
  tiers        JSONB NOT NULL DEFAULT '[]',
  window_type  TEXT NOT NULL DEFAULT 'daily' CHECK (window_type IN ('daily', 'weekly')),
  zone_id      UUID REFERENCES zones(id) ON DELETE SET NULL,  -- NULL = all zones
  is_active    BOOLEAN NOT NULL DEFAULT true,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_mission_templates_updated_at ON mission_templates;
CREATE TRIGGER update_mission_templates_updated_at
  BEFORE UPDATE ON mission_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Per-rider mission instances (one row per rider per template per day/week)
CREATE TABLE IF NOT EXISTS rider_missions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id          UUID NOT NULL REFERENCES mission_templates(id) ON DELETE CASCADE,
  date                 DATE NOT NULL DEFAULT CURRENT_DATE,
  progress             INTEGER NOT NULL DEFAULT 0,
  tier_reached         INTEGER NOT NULL DEFAULT 0,   -- highest tier index awarded (0=none)
  bonus_awarded_paise  INTEGER NOT NULL DEFAULT 0,
  status               TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired')),
  completed_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (rider_id, template_id, date)
);

CREATE INDEX IF NOT EXISTS idx_rider_missions_rider_date ON rider_missions(rider_id, date);
CREATE INDEX IF NOT EXISTS idx_rider_missions_template    ON rider_missions(template_id);

DROP TRIGGER IF EXISTS update_rider_missions_updated_at ON rider_missions;
CREATE TRIGGER update_rider_missions_updated_at
  BEFORE UPDATE ON rider_missions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed 3 default templates so the system works immediately
INSERT INTO mission_templates (title, description, icon, color, type, tiers, window_type, sort_order) VALUES
(
  'Quick Starter',
  'Complete deliveries today and unlock tier bonuses',
  'zap', '#FC4603', 'delivery_count',
  '[{"target":5,"reward_paise":5000,"label":"Starter"},{"target":10,"reward_paise":12000,"label":"Pro"},{"target":15,"reward_paise":20000,"label":"Champion"}]',
  'daily', 1
),
(
  'Daily Earner',
  'Hit your earnings milestone today',
  'trending-up', '#1BA672', 'earnings_amount',
  '[{"target":50000,"reward_paise":3000,"label":"₹500 Earned"},{"target":100000,"reward_paise":8000,"label":"₹1000 Earned"}]',
  'daily', 2
),
(
  'Weekly Warrior',
  'Rack up deliveries this week for a big bonus',
  'trophy', '#F59E0B', 'delivery_count',
  '[{"target":30,"reward_paise":30000,"label":"30 Trips"},{"target":50,"reward_paise":60000,"label":"50 Trips"}]',
  'weekly', 3
)
ON CONFLICT DO NOTHING;
