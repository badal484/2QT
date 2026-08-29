// Phase 5 (SaaS migration) — the restaurant tenant's own operational dashboard.
//
// NOT the same as routes/restaurants.ts (plural) — that's the unrelated, customer-facing
// dine-in table-booking discovery endpoint (queries restaurant_config). This file is mounted at
// /restaurant (singular) and serves the new SaaS delivery-business tenant introduced in Phase 3.
//
// Every endpoint here is gated by requireActiveRestaurantMembership (utils/tenant.ts), which
// derives the tenant strictly from req.user.tenantRestaurantId — never from a client-supplied
// id — and verifies an ACTIVE restaurant_users row exists before allowing any query to run.
// Every query below additionally carries its own `restaurant_id = $1` predicate at the database
// level; there is no code path in this file that fetches unscoped data and filters afterward.
import { Router } from 'express';
import { query } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireActiveRestaurantMembership, getTenantRestaurantId } from '../utils/tenant';

const router = Router();

router.use(authenticate, requireActiveRestaurantMembership);

// ─── Profile ──────────────────────────────────────────────────────────────────
// GET /restaurant/me — never /restaurant/:id. The tenant is always the authenticated caller's
// own restaurant; there is no route parameter anywhere in this file that accepts a restaurant id.
router.get('/me', async (req: AuthRequest, res) => {
    const restaurantId = getTenantRestaurantId(req)!; // non-null: guaranteed by the gate above
    const { rows } = await query(
        `SELECT id, name, slug, status, settings, created_at, updated_at FROM restaurants WHERE id = $1`,
        [restaurantId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ restaurant: rows[0] });
});

// ─── Outlets ──────────────────────────────────────────────────────────────────
router.get('/outlets', async (req: AuthRequest, res) => {
    const restaurantId = getTenantRestaurantId(req)!;
    const { rows } = await query(
        `SELECT id, name, zone_id, kitchen_id, status, settings, created_at, updated_at
         FROM outlets WHERE restaurant_id = $1 ORDER BY created_at`,
        [restaurantId]
    );
    res.json({ outlets: rows });
});

// ─── Kitchens ─────────────────────────────────────────────────────────────────
// Additive to, not a replacement for, Phase 2's getKitchenId()-based kitchen.ts authorization —
// this is a read-only tenant-level listing, not a new way to operate a kitchen.
router.get('/kitchens', async (req: AuthRequest, res) => {
    const restaurantId = getTenantRestaurantId(req)!;
    const { rows } = await query(
        `SELECT id, name, address, lat, lng, is_active, is_paused, pause_reason, avg_prep_time_minutes
         FROM kitchens WHERE restaurant_id = $1 ORDER BY name`,
        [restaurantId]
    );
    res.json({ kitchens: rows });
});

// ─── Staff ────────────────────────────────────────────────────────────────────
// restaurant_users is the authoritative source for "who is on this tenant's team" — joined to
// users for display fields only. No password hashes, PINs, tokens, or bank/payout details.
router.get('/staff', async (req: AuthRequest, res) => {
    const restaurantId = getTenantRestaurantId(req)!;
    const { rows } = await query(
        `SELECT u.id, u.name, u.phone, u.kitchen_id, u.is_online, u.is_active,
                ru.role AS membership_role, ru.status AS membership_status, ru.created_at AS member_since
         FROM restaurant_users ru
         JOIN users u ON u.id = ru.user_id
         WHERE ru.restaurant_id = $1
         ORDER BY ru.role, u.name`,
        [restaurantId]
    );
    res.json({ staff: rows });
});

// ─── Orders ───────────────────────────────────────────────────────────────────
// Tenant scope is applied first (restaurant_id = $1) and every optional filter is ANDed onto
// that same query — never an alternate path that could substitute for the tenant predicate.
router.get('/orders', async (req: AuthRequest, res) => {
    const restaurantId = getTenantRestaurantId(req)!;
    const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

    const conditions: string[] = ['o.restaurant_id = $1'];
    const params: any[] = [restaurantId];

    const { status, kitchenId, fromDate, toDate } = req.query as Record<string, string | undefined>;
    if (status) { params.push(status); conditions.push(`o.status = $${params.length}`); }
    if (kitchenId) { params.push(kitchenId); conditions.push(`o.kitchen_id = $${params.length}`); }
    if (fromDate) { params.push(fromDate); conditions.push(`o.created_at >= $${params.length}`); }
    if (toDate) { params.push(toDate); conditions.push(`o.created_at <= $${params.length}`); }

    const whereClause = conditions.join(' AND ');
    const limitParamIdx = params.length + 1;
    const offsetParamIdx = params.length + 2;

    const { rows } = await query(
        `SELECT o.id, o.display_id, o.status, o.kitchen_id, o.total_amount_paise,
                o.payment_method, o.payment_status, o.created_at, o.updated_at,
                u.name AS customer_name
         FROM orders o
         JOIN users u ON u.id = o.customer_id
         WHERE ${whereClause}
         ORDER BY o.created_at DESC
         LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}`,
        [...params, limit, offset]
    );

    const { rows: countRows } = await query(
        `SELECT COUNT(*)::int AS count FROM orders o WHERE ${whereClause}`,
        params
    );

    res.json({ orders: rows, limit, offset, total: countRows[0]?.count ?? 0 });
});

// ─── Menu (read-only — see Phase 5 report §9 for the architecture decision) ──────────────────
// menu_items.restaurant_id is the tenant boundary used here — NOT zone_id, which is a separate,
// shared-per-zone browsing concept (see routes/menu.ts) and is preserved untouched. Deliberately
// no create/update/delete endpoints in this file: menu mutation stays admin-only (unchanged),
// pending a deliberate future decision on restaurant-owned menu management.
router.get('/menu', async (req: AuthRequest, res) => {
    const restaurantId = getTenantRestaurantId(req)!;
    const { rows } = await query(
        `SELECT id, name, description, price_paise, category, available, is_veg, zone_id, kitchen_id
         FROM menu_items WHERE restaurant_id = $1 ORDER BY category, name`,
        [restaurantId]
    );
    res.json({ menu: rows });
});

// ─── Statistics ───────────────────────────────────────────────────────────────
router.get('/stats', async (req: AuthRequest, res) => {
    const restaurantId = getTenantRestaurantId(req)!;
    const [orderStats, kitchenCount, staffCount] = await Promise.all([
        query(
            `SELECT
                COUNT(*)::int AS total_orders,
                COUNT(*) FILTER (WHERE status = 'confirmed')::int AS pending,
                COUNT(*) FILTER (WHERE status IN ('preparing', 'packing'))::int AS preparing,
                COUNT(*) FILTER (WHERE status = 'out_for_delivery')::int AS out_for_delivery,
                COUNT(*) FILTER (WHERE status = 'delivered' AND updated_at >= CURRENT_DATE)::int AS delivered_today
             FROM orders WHERE restaurant_id = $1`,
            [restaurantId]
        ),
        query(`SELECT COUNT(*)::int AS count FROM kitchens WHERE restaurant_id = $1 AND is_active = true`, [restaurantId]),
        query(`SELECT COUNT(*)::int AS count FROM restaurant_users WHERE restaurant_id = $1 AND status = 'active'`, [restaurantId]),
    ]);

    res.json({
        orders: orderStats.rows[0],
        activeKitchens: kitchenCount.rows[0]?.count ?? 0,
        activeStaff: staffCount.rows[0]?.count ?? 0,
    });
});

// ─── Sales ──────────────────────────────────────────────────────────────────
// Unlike kitchen.ts's /my-earnings (the commission-based Partners program), a SaaS restaurant
// keeps 100% of its order revenue — 2QT's revenue here is the subscription fee (Phase 8), not a
// per-order cut — so there is no commission line to compute or subtract. "Sales" is simply
// total_amount_paise minus delivery_fee_paise (the delivery fee is never the restaurant's money
// regardless of billing model — see kitchen.ts's identical convention).
router.get('/sales', async (req: AuthRequest, res) => {
    const restaurantId = getTenantRestaurantId(req)!;
    const now = new Date();
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const periodQuery = (sinceParam: number) => `
        SELECT COALESCE(SUM(total_amount_paise - delivery_fee_paise), 0)::bigint AS sales,
               COUNT(*)::int AS orders
        FROM orders WHERE restaurant_id = $1 AND status = 'delivered' AND updated_at >= $${sinceParam}`;

    const [today, thisWeek, thisMonth, allTime, trend] = await Promise.all([
        query(periodQuery(2), [restaurantId, todayStart]),
        query(periodQuery(2), [restaurantId, weekStart]),
        query(periodQuery(2), [restaurantId, monthStart]),
        query(
            `SELECT COALESCE(SUM(total_amount_paise - delivery_fee_paise), 0)::bigint AS sales, COUNT(*)::int AS orders
             FROM orders WHERE restaurant_id = $1 AND status = 'delivered'`,
            [restaurantId]
        ),
        query(
            `SELECT DATE(updated_at AT TIME ZONE 'Asia/Kolkata') AS date,
                    COALESCE(SUM(total_amount_paise - delivery_fee_paise), 0)::bigint AS sales
             FROM orders WHERE restaurant_id = $1 AND status = 'delivered' AND updated_at >= NOW() - INTERVAL '7 days'
             GROUP BY DATE(updated_at AT TIME ZONE 'Asia/Kolkata') ORDER BY date ASC`,
            [restaurantId]
        ),
    ]);

    const trendByDate = new Map(trend.rows.map((r: any) => [new Date(r.date).toISOString().split('T')[0], parseInt(r.sales)]));
    const trendData = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(todayStart);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        trendData.push({ date: dateStr, sales: trendByDate.get(dateStr) ?? 0 });
    }

    res.json({
        today: today.rows[0],
        thisWeek: thisWeek.rows[0],
        thisMonth: thisMonth.rows[0],
        allTime: allTime.rows[0],
        trend: trendData,
    });
});

export default router;
