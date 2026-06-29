-- Migration 069: Add is_active flag to kitchens table
-- Allows admin to permanently enable/disable a kitchen (distinct from is_paused which is temporary)
ALTER TABLE kitchens ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
