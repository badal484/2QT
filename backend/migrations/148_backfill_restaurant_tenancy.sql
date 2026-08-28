-- Migration 148: Backfill restaurant tenancy from existing kitchen relationships
--
-- Strategy (intentionally conservative, per the approved Phase 3 scope):
--     one existing kitchen  ->  one new restaurant  ->  one new outlet
-- No kitchens are merged into a shared restaurant even where they might appear to belong to the
-- same business — that merge is a deliberate future decision, never inferred by this migration.
--
-- Idempotent: the loop below only processes kitchens where restaurant_id IS NULL, and every
-- downstream UPDATE only touches rows where restaurant_id IS NULL, so re-running this migration
-- (or restoring this file on a fresh environment that already has data) never creates duplicate
-- restaurants/outlets/membership rows.

DO $$
DECLARE
    k RECORD;
    new_restaurant_id UUID;
    base_slug TEXT;
    final_slug TEXT;
BEGIN
    FOR k IN SELECT id, name, zone_id FROM kitchens WHERE restaurant_id IS NULL LOOP
        base_slug := lower(regexp_replace(k.name, '[^a-zA-Z0-9]+', '-', 'g'));
        base_slug := trim(both '-' from base_slug);
        IF base_slug = '' THEN
            base_slug := 'restaurant';
        END IF;
        -- Append an 8-char fragment of the kitchen's own UUID for deterministic, collision-free
        -- uniqueness — kitchen ids are already unique, so no uniqueness-retry loop is needed.
        final_slug := base_slug || '-' || substr(k.id::text, 1, 8);

        INSERT INTO restaurants (name, slug, status)
        VALUES (k.name, final_slug, 'active')
        RETURNING id INTO new_restaurant_id;

        UPDATE kitchens SET restaurant_id = new_restaurant_id WHERE id = k.id;

        INSERT INTO outlets (restaurant_id, name, zone_id, kitchen_id, status)
        VALUES (new_restaurant_id, k.name, k.zone_id, k.id, 'active');
    END LOOP;
END $$;

-- Backfill orders.restaurant_id from the order's own kitchen_id. Orders whose kitchen_id is
-- already NULL (kitchen was hard-deleted by an admin — migration 065) are intentionally left
-- NULL: there is no deterministic source for their restaurant, and this migration does not guess.
UPDATE orders o
SET restaurant_id = k.restaurant_id
FROM kitchens k
WHERE o.kitchen_id = k.id
  AND o.restaurant_id IS NULL
  AND k.restaurant_id IS NOT NULL;

-- Backfill menu_items.restaurant_id from the item's own kitchen_id. menu_items has carried a
-- direct, nullable kitchen_id column since it was created (migration 006) — this is derived
-- from that direct column, NOT inferred through zone_id (menu_items.zone_id identifies which
-- zone's shared menu an item appears on; it is not an ownership relationship, and is left
-- untouched by this migration). Items whose kitchen_id is already NULL are left NULL, same
-- reasoning as orders above.
UPDATE menu_items m
SET restaurant_id = k.restaurant_id
FROM kitchens k
WHERE m.kitchen_id = k.id
  AND m.restaurant_id IS NULL
  AND k.restaurant_id IS NOT NULL;

-- Backfill users.restaurant_id ONLY for roles with a deterministic kitchen relationship:
-- chef, kitchen_manager, packer, partner_kitchen. Explicitly excluded, per the approved Phase 3
-- scope:
--   - super_admin / admin / finance / support: platform-level staff identities, never
--     restaurant-scoped.
--   - rider / rider_captain: riders are 2QT-owned and zone-pooled today, not kitchen- or
--     restaurant-owned (see services/autoAssign.ts) — assigning a restaurant_id here would
--     misrepresent the current architecture. Restaurant-owned riders are Phase 8, not Phase 3.
--   - dine_in_staff / partner: belong to the separate, untouched dine-in restaurant_config
--     system via users.dine_in_restaurant_id, which this migration does not read or write.
--   - customer: no kitchen relationship exists to backfill from.
UPDATE users u
SET restaurant_id = k.restaurant_id
FROM kitchens k
WHERE u.kitchen_id = k.id
  AND u.restaurant_id IS NULL
  AND k.restaurant_id IS NOT NULL
  AND u.role::text IN ('chef', 'kitchen_manager', 'packer', 'partner_kitchen');

-- Backfill restaurant_users membership rows for that same deterministic set of users.
INSERT INTO restaurant_users (restaurant_id, user_id, role, status)
SELECT u.restaurant_id, u.id, u.role::text, 'active'
FROM users u
WHERE u.restaurant_id IS NOT NULL
  AND u.role::text IN ('chef', 'kitchen_manager', 'packer', 'partner_kitchen')
ON CONFLICT (restaurant_id, user_id) DO NOTHING;
