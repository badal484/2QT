CREATE TABLE IF NOT EXISTS app_config (
  key VARCHAR(50) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pre_launch_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  survey_responses JSONB,
  source VARCHAR(50) DEFAULT 'organic',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default config if not exists
INSERT INTO app_config (key, value, description)
VALUES ('IS_PRELAUNCH_MODE', 'false'::jsonb, 'If true, blocks normal customer logins and redirects to landing page')
ON CONFLICT (key) DO NOTHING;
