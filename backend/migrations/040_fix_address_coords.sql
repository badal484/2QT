-- Migration 040: Fix customer addresses whose coordinates are stale placeholders.
--
-- Detection: an address is considered a placeholder if its lat/lng exactly matches
-- a kitchen row in the same zone. This means the address was never explicitly pinned
-- by the customer — it inherited the kitchen/seed coordinates.
--
-- Fix: replace with the zone's kitchen_lat/lng (centroid of the delivery polygon),
-- which is geographically correct for the zone regardless of city.

-- Fix addresses joined to a zone whose coords match any kitchen in that zone
UPDATE addresses a
SET
    lat        = z.kitchen_lat,
    lng        = z.kitchen_lng,
    updated_at = NOW()
FROM zones z
WHERE a.zone_id = z.id
  AND z.kitchen_lat IS NOT NULL
  AND z.kitchen_lng IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM kitchens k
    JOIN kitchen_zones kz ON kz.kitchen_id = k.id
    WHERE kz.zone_id = z.id
      AND k.lat = a.lat
      AND k.lng = a.lng
  );

-- Fix addresses not tied to a zone whose coords match any kitchen (use first active zone as fallback)
UPDATE addresses a
SET
    lat        = (SELECT kitchen_lat FROM zones WHERE is_active = true AND kitchen_lat IS NOT NULL ORDER BY created_at LIMIT 1),
    lng        = (SELECT kitchen_lng FROM zones WHERE is_active = true AND kitchen_lng IS NOT NULL ORDER BY created_at LIMIT 1),
    updated_at = NOW()
WHERE zone_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM kitchens k
    WHERE k.lat = a.lat
      AND k.lng = a.lng
  );
