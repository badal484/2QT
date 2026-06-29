-- Migration 068: Add timed pause support to kitchens
ALTER TABLE kitchens ADD COLUMN IF NOT EXISTS pause_until TIMESTAMPTZ;
