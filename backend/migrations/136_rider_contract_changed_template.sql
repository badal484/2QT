-- Migration 136: Add rider_contract_changed notification template
-- Fires when an admin changes a rider's payment_model / salary / fuel
-- allowance, so the rider learns about pay-model changes instead of just
-- noticing a different number in the app.
INSERT INTO notification_templates (type, label, title_template, body_template, whatsapp_template, channels)
VALUES (
  'rider_contract_changed',
  'Rider Contract Changed',
  '{{title}}',
  '{{body}}',
  '{{body}}',
  ARRAY['push', 'whatsapp']
)
ON CONFLICT (type) DO NOTHING;
