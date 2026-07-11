-- Admin-configurable COD cash limit and company UPI ID
INSERT INTO app_settings (key, value, description) VALUES
  ('cod_cash_limit_paise', '200000', 'Max COD cash a rider can hold before being blocked from new COD orders (in paise; 200000 = ₹2000)'),
  ('company_upi_id',       '"badal90603@okaxis"', 'Company UPI ID shown to riders for cash transfers')
ON CONFLICT (key) DO NOTHING;
