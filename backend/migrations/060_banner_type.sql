-- Migration 060: Add banner_type to promotional_banners table

ALTER TABLE promotional_banners ADD COLUMN IF NOT EXISTS banner_type VARCHAR(50) DEFAULT 'MAIN';
