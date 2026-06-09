-- Migration 021: User Photo URL for Persona
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT;
