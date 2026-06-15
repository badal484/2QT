-- Migration 039: Fix kitchen and zone reference coordinates
--
-- The zone polygon was drawn by admin (covering Jharkhand), but the
-- kitchen_lat/kitchen_lng on zones and the lat/lng on kitchens are
-- still at the original Bangalore seed values (12.9667, 77.7111).
--
-- This migration recomputes both from the polygon centroid so that
-- LiveTrackingMap and RiderLiveMap show the correct location.

-- Step 1: Update zone kitchen_lat/kitchen_lng to polygon centroid
--         (only for zones that have a valid polygon defined)
UPDATE zones
SET
    kitchen_lat = (
        SELECT AVG((elem->>'lat')::DECIMAL)
        FROM jsonb_array_elements(polygon_points) AS elem
    ),
    kitchen_lng = (
        SELECT AVG((elem->>'lng')::DECIMAL)
        FROM jsonb_array_elements(polygon_points) AS elem
    ),
    updated_at = NOW()
WHERE polygon_points IS NOT NULL
  AND jsonb_typeof(polygon_points) = 'array'
  AND jsonb_array_length(polygon_points) > 2;

-- Step 2: Sync kitchen lat/lng from its zone's kitchen_lat/kitchen_lng
--         (using the kitchen_zones join table)
UPDATE kitchens k
SET
    lat  = z.kitchen_lat,
    lng  = z.kitchen_lng
FROM kitchen_zones kz
JOIN zones z ON z.id = kz.zone_id
WHERE kz.kitchen_id = k.id;

-- Step 3: Fallback — if a kitchen has no zone but still has the old Bangalore
--         seed value, update it to the first zone's computed center
UPDATE kitchens
SET
    lat  = (SELECT kitchen_lat FROM zones ORDER BY created_at LIMIT 1),
    lng  = (SELECT kitchen_lng FROM zones ORDER BY created_at LIMIT 1)
WHERE id NOT IN (SELECT kitchen_id FROM kitchen_zones)
  AND lat = 12.9667;
