-- Migration 152: Per-tenant delivery model
--
-- Distinguishes restaurants that ride the platform's own shared rider pool (every existing
-- restaurant today — your own kitchens AND commission Partners) from SaaS tenants who run their
-- own dedicated riders, isolated from the shared pool and from every other tenant's riders.
--
-- Defaults every restaurant to 'platform_fleet' — this is not inferred from how the restaurant
-- was created (POST /admin/kitchens and the New Restaurant wizard's attach-tenant flow both call
-- the same createRestaurantTenantForKitchen() helper, so the creation path alone can't tell SaaS
-- tenants apart from your own kitchens). An admin explicitly promotes a restaurant to
-- 'dedicated_fleet' once its own riders are in place.

ALTER TABLE restaurants
    ADD COLUMN IF NOT EXISTS delivery_model TEXT NOT NULL DEFAULT 'platform_fleet'
    CHECK (delivery_model IN ('platform_fleet', 'dedicated_fleet'));
