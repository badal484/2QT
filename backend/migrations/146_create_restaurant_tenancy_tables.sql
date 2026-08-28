-- Migration 146: Restaurant tenancy foundation (Phase 3 of the SaaS migration)
--
-- Introduces `restaurant` as the primary tenant boundary, purely additively — no existing
-- table, column, or authorization behavior is changed by this file. No data is touched here;
-- backfill happens in migration 148.
--
-- Hierarchy (per the approved Phase 3 plan):
--   restaurant (tenant)  ->  outlet (operating location)  ->  kitchen (prep unit)
--   zone remains a separate geographic/delivery dimension attached to the outlet, NOT a rung
--   above restaurant in the tenant hierarchy (see the Phase 0/1 audit report, §14, for why).
--
-- This is intentionally independent of the existing dine-in table-booking system
-- (restaurant_config / restaurant_menu_items / partner_restaurant_payouts, migration 078).
-- That system is not merged, renamed, or modified here — see the Phase 3 report for the
-- explicit reconciliation decision this defers.

CREATE TABLE restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),
    settings JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_restaurants_updated_at ON restaurants;
CREATE TRIGGER update_restaurants_updated_at BEFORE UPDATE ON restaurants
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Tenant membership: which platform users belong to which restaurant, and in what capacity.
-- This does NOT replace the existing global `users.role` enum — Phase 2's authorization
-- (requireRole, getKitchenId, isAuthorizedForOrder, etc.) continues to run entirely off
-- users.role in Phase 3. `role` here is a membership-role snapshot for Phase 4+ to build on.
CREATE TABLE restaurant_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (restaurant_id, user_id)
);

CREATE INDEX idx_restaurant_users_restaurant_id ON restaurant_users(restaurant_id);
CREATE INDEX idx_restaurant_users_user_id ON restaurant_users(user_id);

DROP TRIGGER IF EXISTS update_restaurant_users_updated_at ON restaurant_users;
CREATE TRIGGER update_restaurant_users_updated_at BEFORE UPDATE ON restaurant_users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- A restaurant's physical/operating locations. zone_id and kitchen_id are both nullable and
-- independent of each other and of the tenant relationship — an outlet's geography (zone) and
-- prep unit (kitchen) are facts about that outlet, not part of its tenant identity.
-- kitchen_id is uniquely indexed (where set) because Phase 3's backfill assumption is strictly
-- one outlet per existing kitchen — this constraint makes that invariant hold at the DB level,
-- not just by migration-script convention, and prevents duplicate outlets on any rerun.
CREATE TABLE outlets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    zone_id UUID REFERENCES zones(id) ON DELETE SET NULL,
    kitchen_id UUID REFERENCES kitchens(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    settings JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_outlets_restaurant_id ON outlets(restaurant_id);
CREATE INDEX idx_outlets_zone_id ON outlets(zone_id);
CREATE UNIQUE INDEX idx_outlets_kitchen_id ON outlets(kitchen_id) WHERE kitchen_id IS NOT NULL;

DROP TRIGGER IF EXISTS update_outlets_updated_at ON outlets;
CREATE TRIGGER update_outlets_updated_at BEFORE UPDATE ON outlets
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
