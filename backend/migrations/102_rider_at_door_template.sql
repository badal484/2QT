-- Migration 102: Add rider_at_door notification template
-- Fixes silent drop when rider marks customer as unreachable ("retry" action).
INSERT INTO notification_templates (type, label, title_template, body_template, whatsapp_template, channels)
VALUES (
  'rider_at_door',
  'Rider Waiting at Door',
  '🏍️ Your rider is at the door!',
  'Your rider is waiting outside. Please come to the door — order #{{displayId}} is here!',
  '2QT: Your rider is waiting at your door for order #{{displayId}}. Please open up!',
  ARRAY['push', 'whatsapp']
)
ON CONFLICT (type) DO NOTHING;
