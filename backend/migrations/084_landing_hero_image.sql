-- Migration 084: Add Landing Page Hero Image Setting

INSERT INTO app_settings (key, value, description)
VALUES (
    'landing_hero_image',
    '"/premium_healthy_bowl_1777968667530.png"',
    'Hero image URL for the main landing page. Recommended size: 1000x1250 (4:5 aspect ratio)'
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, description = EXCLUDED.description;
