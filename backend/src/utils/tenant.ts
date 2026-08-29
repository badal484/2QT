// Phase 4/5 (SaaS migration) — small, focused helpers for consuming the restaurant tenant
// foundation introduced in Phase 3. Deliberately kept minimal: this is NOT a general
// authorization framework, and does not replace or duplicate Phase 2's kitchen/order/zone
// authorization (getKitchenId in routes/kitchen.ts, isAuthorizedForOrder in routes/order.ts).
import { Response, NextFunction } from 'express';
import { query } from '../db';
import { AuthRequest } from '../middleware/auth';

// Platform-level roles are never restaurant-scoped. Kept as an independent copy of the same
// list already used in routes/kitchen.ts (PLATFORM_ADMIN_ROLES) rather than importing it from
// there — this module has no other reason to depend on a route file, and the two lists
// expressing the same, stable, rarely-changing fact independently is a smaller risk than adding
// a cross-file coupling for it.
export const PLATFORM_ROLES = ['super_admin', 'admin'];

export function isPlatformAdmin(role: string): boolean {
    return PLATFORM_ROLES.includes(role);
}

/**
 * The one, canonical way to read the authenticated user's delivery-business tenant.
 *
 * ALWAYS server-derived: req.user.tenantRestaurantId is populated at auth time from
 * users.restaurant_id (see middleware/auth.ts's authenticate()) — never read a restaurant/tenant
 * id from req.body, req.query, or req.headers anywhere in the codebase. There is deliberately no
 * "override" parameter on this function, unlike routes/kitchen.ts's getKitchenId() (which allows
 * an explicit, audited override for platform admins only) — Phase 4 introduces no such override
 * for the tenant dimension.
 *
 * Returns null for platform admins (they are not restaurant-scoped, by design — see
 * isPlatformAdmin) and for any user who has not yet been assigned to a restaurant.
 */
export function getTenantRestaurantId(req: AuthRequest): string | null {
    return req.user?.tenantRestaurantId ?? null;
}

type QueryFn = (text: string, params?: any[]) => Promise<{ rows: any[] }>;

/**
 * restaurant_users is the authoritative membership ledger (Phase 3/4) — this checks it
 * directly, rather than trusting the denormalized users.restaurant_id column. NOT currently
 * wired into any request-time authorization check (Phase 4's additive checks use
 * req.user.tenantRestaurantId instead, which is kept consistent with this table by
 * syncTenantMembership/deactivateTenantMembership below) — exposed as foundation for a later
 * phase that needs a genuine membership lookup rather than a column comparison. See the Phase 4
 * report for the reasoning.
 */
export async function isActiveRestaurantMember(userId: string, restaurantId: string): Promise<boolean> {
    const { rows } = await query(
        `SELECT 1 FROM restaurant_users WHERE user_id = $1 AND restaurant_id = $2 AND status = 'active' LIMIT 1`,
        [userId, restaurantId]
    );
    return rows.length > 0;
}

/**
 * Keeps users.restaurant_id and the restaurant_users membership ledger in sync whenever an
 * admin assigns a user to a kitchen (e.g. POST /admin/kitchens/:id/staff, POST /admin/team/users)
 * — without this, any kitchen/staff created after migration 148 would silently drift out of the
 * Phase 3 tenant model (their restaurant_id would stay NULL forever, since the migration only
 * backfilled data that existed at that point in time).
 *
 * Safe no-op if the kitchen has no restaurant_id yet — never throws, just leaves the user's
 * restaurant_id untouched, so a pre-existing data gap here can never break staff assignment.
 *
 * Pass the plain `query` function for a standalone call, or `client.query.bind(client)` to run
 * inside an existing transaction.
 */
export async function syncTenantMembership(
    queryFn: QueryFn,
    userId: string,
    kitchenId: string,
    membershipRole: string
): Promise<void> {
    const { rows } = await queryFn('SELECT restaurant_id FROM kitchens WHERE id = $1', [kitchenId]);
    const restaurantId = rows[0]?.restaurant_id;
    if (!restaurantId) return;

    await queryFn('UPDATE users SET restaurant_id = $1 WHERE id = $2', [restaurantId, userId]);
    await queryFn(
        `INSERT INTO restaurant_users (restaurant_id, user_id, role, status)
         VALUES ($1, $2, $3, 'active')
         ON CONFLICT (restaurant_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = 'active'`,
        [restaurantId, userId, membershipRole]
    );
}

/**
 * Reverse of syncTenantMembership — call when an admin removes a user from kitchen/staff duty
 * (e.g. DELETE /admin/kitchens/:id/staff/:staffId, or the kitchen-hard-delete cleanup in
 * DELETE /admin/kitchens/:id). Nulls users.restaurant_id and deactivates (never deletes) the
 * restaurant_users row, so membership history is preserved.
 */
export async function deactivateTenantMembership(queryFn: QueryFn, userId: string): Promise<void> {
    await queryFn('UPDATE users SET restaurant_id = NULL WHERE id = $1', [userId]);
    await queryFn(`UPDATE restaurant_users SET status = 'inactive' WHERE user_id = $1`, [userId]);
}

/**
 * The single, shared way to bring a kitchen into the Phase 3 tenant model: creates the matching
 * `restaurants` + `outlets` rows and sets `kitchens.restaurant_id`.
 *
 * Extracted so there is exactly one code path capable of creating a kitchen's tenant — before
 * this existed, POST /admin/kitchens had this logic inlined, while the (older, pre-dating this
 * migration) partner-application-approval flow created kitchens via its own separate INSERT and
 * never called anything like this at all, silently leaving every partner-approved kitchen without
 * a tenant: invisible in the Tenants admin view and impossible to bill. A future kitchen-creation
 * path calling this instead of hand-writing the same three writes again is what actually prevents
 * that class of gap from recurring, rather than relying on every call site remembering to.
 *
 * `restaurantName` is independent of `kitchenName` — a business's public/billing identity
 * (`restaurants.name`) is not required to be the same string as its kitchen's operational name.
 */
export async function createRestaurantTenantForKitchen(
    queryFn: QueryFn,
    kitchenId: string,
    kitchenName: string,
    zoneId: string | null,
    restaurantName?: string
): Promise<string> {
    const name = (restaurantName ?? kitchenName).trim() || kitchenName;
    let baseSlug = name.toLowerCase().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!baseSlug) baseSlug = 'restaurant';
    const slug = `${baseSlug}-${String(kitchenId).slice(0, 8)}`;

    const { rows } = await queryFn(
        `INSERT INTO restaurants (name, slug, status) VALUES ($1, $2, 'active') RETURNING id`,
        [name, slug]
    );
    const restaurantId = rows[0].id;
    await queryFn('UPDATE kitchens SET restaurant_id = $1 WHERE id = $2', [restaurantId, kitchenId]);
    await queryFn(
        `INSERT INTO outlets (restaurant_id, name, zone_id, kitchen_id, status) VALUES ($1, $2, $3, $4, 'active')`,
        [restaurantId, name, zoneId, kitchenId]
    );
    return restaurantId;
}

// ─── Phase 5: restaurant dashboard access ────────────────────────────────────────────────────

// The roles the new tenant-facing restaurant dashboard (routes/restaurant.ts) is open to.
// Deliberately excludes rider/rider_captain/customer/finance/support (per the approved Phase 5
// plan) and platform admins (super_admin/admin) — the existing /admin panel already gives them
// unrestricted, platform-wide access; granting them this dashboard too would require a tenant
// *selection* mechanism (which restaurant is an admin currently "viewing as"?) that does not
// exist anywhere in this codebase. Building one was explicitly out of scope for this phase —
// see the Phase 5 report for why this is a "document, don't invent" situation.
export const RESTAURANT_DASHBOARD_ROLES = ['partner_kitchen', 'kitchen_manager', 'chef', 'packer'];

/**
 * Express middleware gating every routes/restaurant.ts endpoint. Enforces the full chain
 * required by Phase 5: authenticated user → tenantRestaurantId → restaurant_users → active
 * membership → access. This is the "authoritative" check (queries restaurant_users directly,
 * per the Phase 5 instruction not to rely on users.restaurant_id alone) — unlike Phase 4's softer
 * additive checks, dashboard access is a brand-new, security-sensitive surface, so it's worth
 * the one extra query per request.
 *
 * Fails closed (403) for: wrong role, no tenantRestaurantId, or no active restaurant_users row
 * for that exact (user, restaurant) pair — which also transparently covers "membership was
 * deactivated" and "wrong restaurant", since both simply fail to match an active row.
 *
 * Never reads restaurant identity from req.body/req.query/req.headers — only
 * req.user.tenantRestaurantId (server-derived, see middleware/auth.ts).
 */
export async function requireActiveRestaurantMembership(req: AuthRequest, res: Response, next: NextFunction) {
    const user = req.user!;
    if (!RESTAURANT_DASHBOARD_ROLES.includes(user.role)) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Restaurant dashboard access requires a restaurant-staff role.' });
    }

    const restaurantId = getTenantRestaurantId(req);
    if (!restaurantId) {
        return res.status(403).json({ error: 'NO_RESTAURANT_ASSIGNED', message: 'This account is not linked to a restaurant.' });
    }

    const isMember = await isActiveRestaurantMember(user.userId, restaurantId);
    if (!isMember) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'No active membership for this restaurant.' });
    }

    next();
}
