-- Add salary fields to users table for riders
ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_model TEXT DEFAULT 'per_order'; -- 'per_order' or 'salary'
ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_salary_paise INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS fuel_allowance_per_km_paise INTEGER DEFAULT 0;
