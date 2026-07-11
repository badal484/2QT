-- Admin-triggered surge needs an expiry time
ALTER TABLE zones
  ADD COLUMN IF NOT EXISTS surge_expires_at TIMESTAMPTZ;

-- Auto-clear surge_enabled when expiry has passed (checked at query time via view or app logic)
-- Also reset defaults to match new earning model
-- rider_base_pay_paise = flat pay for short trips (≤ rider_free_km)
-- rider_per_km_paise   = per-km rate applied to FULL distance for longer trips
-- rider_free_km        = short-trip threshold in km
