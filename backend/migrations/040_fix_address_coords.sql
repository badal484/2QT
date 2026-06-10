-- Migration 040: Fix customer addresses that still have the old Bangalore
-- hardcoded placeholder coordinates (lat=12.9716, lng=77.5946 or the
-- kitchen seed lat=12.9667, lng=77.7111).
--
-- These were saved before the MapPicker was added to the profile page.
-- We replace them with the zone's kitchen_lat/lng (centroid of the polygon)
-- so that delivery maps show the correct general area instead of Bangalore.
-- Customers should re-pin their exact address after this.

-- Fix addresses joined to a zone
UPDATE addresses a
SET
    lat        = z.kitchen_lat,
    lng        = z.kitchen_lng,
    updated_at = NOW()
FROM zones z
WHERE a.zone_id = z.id
  AND (
    (a.lat = 12.9716 AND a.lng = 77.5946)
    OR (a.lat = 12.9667 AND a.lng = 77.7111)
  );

-- Fix addresses not tied to a zone (use the first active zone as fallback)
UPDATE addresses
SET
    lat        = (SELECT kitchen_lat FROM zones WHERE is_active = true ORDER BY created_at LIMIT 1),
    lng        = (SELECT kitchen_lng FROM zones WHERE is_active = true ORDER BY created_at LIMIT 1),
    updated_at = NOW()
WHERE zone_id IS NULL
  AND (
    (lat = 12.9716 AND lng = 77.5946)
    OR (lat = 12.9667 AND lng = 77.7111)
  );
