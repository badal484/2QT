-- Migration 053: Link kitchen_applications to created kitchens
ALTER TABLE kitchen_applications
  ADD COLUMN IF NOT EXISTS kitchen_id UUID REFERENCES kitchens(id) ON DELETE SET NULL;
