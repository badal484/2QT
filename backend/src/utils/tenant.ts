// Phase 4 (SaaS migration) — small, focused helpers for consuming the restaurant tenant
// foundation introduced in Phase 3. Deliberately kept minimal: this is NOT a general
// authorization framework, and does not replace or duplicate Phase 2's kitchen/order/zone
// authorization (getKitchenId in routes/kitchen.ts, isAuthorizedForOrder in routes/order.ts).
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
