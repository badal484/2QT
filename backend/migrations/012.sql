-- Migration 012: Add onboarding status to users
ALTER TABLE users ADD COLUMN onboarding_complete BOOLEAN DEFAULT false;
UPDATE users SET onboarding_complete = true WHERE role IN ('chef', 'partner_kitchen', 'super_admin');
