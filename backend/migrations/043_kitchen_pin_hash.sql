-- kitchens.pin_hash was referenced by /auth/kitchen-pin since the route was written,
-- but the live table never had the column (it predates this migration system) —
-- every PIN login attempt 500'd before checking any PIN.
ALTER TABLE kitchens ADD COLUMN IF NOT EXISTS pin_hash TEXT;
