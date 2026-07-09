-- Migration 085: Convert landing_hero_image to array

UPDATE app_settings 
SET value = '["' || replace(value, '"', '') || '"]' 
WHERE key = 'landing_hero_image' AND value NOT LIKE '[%';
