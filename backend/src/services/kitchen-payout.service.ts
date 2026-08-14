import { withTransaction } from '../db';

export interface KitchenPayoutResult {
    created: boolean;
    payoutId?: string;
    netPayoutPaise: number;
    reason?: 'already_covered' | 'below_minimum';
}

// Matches the floor the daily auto-payout cron already used for its own (unrelated,
// per-kitchen-configurable) minimum — kept as a plain constant here since this path
// isn't per-kitchen configurable. Avoids generating noise-level payout rows.
const MIN_PAYOUT_PAISE = 100;

/**
 * Computes what a kitchen is still owed for [periodStart, periodEnd] and, if it's at
 * or above the minimum floor, inserts a new 'pending' kitchen_payouts row for exactly
 * that remainder. All amounts are integer paise throughout — no floating-point money.
 *
 * This exists because kitchen payouts can be generated from more than one place —
 * the nightly daily auto-payout cron (src/crons/index.ts, untouched by this function),
 * the weekly payout-generation cron (src/crons.ts), and finance staff clicking
 * "generate" for an arbitrary date range (src/routes/finance.ts) — and all of them
 * compute "revenue for this kitchen in this date range" from the same `orders` table.
 * Without netting, two of those paths covering overlapping days would both create a
 * full-amount payout for the same underlying revenue.
 *
 * Safety:
 *  - "Already owed" nets against every prior kitchen_payouts row (any status except
 *    'failed' — a failed transfer never actually reached the kitchen, so that amount
 *    is still genuinely owed) whose period overlaps the requested one. This is what
 *    makes a weekly run correctly net to ~0 for a kitchen that already got paid daily
 *    all week, and what makes a manual "generate" safe even for an irregular date range.
 *  - gross_sales_paise and commission_paise are netted the same way as net_payout_paise
 *    (plain integer subtraction, not prorated), so `gross - commission` still equals
 *    `net` on the inserted row, and summing commission_paise across rows for financial
 *    reporting can't double-count a day that was already included in an earlier row.
 *  - A per-kitchen Postgres advisory lock (`pg_advisory_xact_lock`, transaction-scoped —
 *    released automatically on COMMIT/ROLLBACK) serializes concurrent calls for the same
 *    kitchen, so two callers racing on overlapping-but-different periods (e.g. the
 *    weekly cron and a manual generate happening at the same moment) can't both read the
 *    same stale "already paid" snapshot and both insert.
 *  - The pre-existing UNIQUE index on (kitchen_id, period_start, period_end) is kept as
 *    a second, independent backstop against two calls for the *identical* period (e.g.
 *    the weekly cron itself firing twice during a Cloud Run rolling deploy).
 */
export async function generateKitchenPayout(
    kitchenId: string,
    periodStart: string,
    periodEnd: string,
): Promise<KitchenPayoutResult> {
    return withTransaction(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [kitchenId]);

        const { rows: statRows } = await client.query(`
            SELECT
                COUNT(*) AS orders_count,
                COALESCE(SUM(subtotal_paise), 0)       AS gross_sales_paise,
                COALESCE(SUM(commission_paise), 0)     AS commission_paise,
                COALESCE(SUM(kitchen_payout_paise), 0) AS net_payout_paise
            FROM orders
            WHERE kitchen_id = $1
              AND status = 'delivered'
              AND DATE(updated_at AT TIME ZONE 'Asia/Kolkata') BETWEEN $2 AND $3
        `, [kitchenId, periodStart, periodEnd]);
        const stat = statRows[0];
        const periodGrossPaise = parseInt(stat.gross_sales_paise);
        const periodCommissionPaise = parseInt(stat.commission_paise);
        const periodNetPaise = parseInt(stat.net_payout_paise);
        const periodOrdersCount = parseInt(stat.orders_count);

        const { rows: alreadyRows } = await client.query(`
            SELECT
                COALESCE(SUM(gross_sales_paise), 0) AS already_gross_paise,
                COALESCE(SUM(commission_paise), 0)  AS already_commission_paise,
                COALESCE(SUM(net_payout_paise), 0)  AS already_net_paise,
                COALESCE(SUM(orders_count), 0)       AS already_orders_count
            FROM kitchen_payouts
            WHERE kitchen_id = $1
              AND status != 'failed'
              AND period_start <= $3 AND period_end >= $2
        `, [kitchenId, periodStart, periodEnd]);
        const already = alreadyRows[0];

        const grossSalesPaise = Math.max(0, periodGrossPaise - parseInt(already.already_gross_paise));
        const commissionPaise = Math.max(0, periodCommissionPaise - parseInt(already.already_commission_paise));
        const netPayoutPaise = Math.max(0, periodNetPaise - parseInt(already.already_net_paise));
        const ordersCount = Math.max(0, periodOrdersCount - parseInt(already.already_orders_count));

        if (netPayoutPaise < MIN_PAYOUT_PAISE) {
            return {
                created: false,
                netPayoutPaise,
                reason: (parseInt(already.already_net_paise) > 0 ? 'already_covered' : 'below_minimum') as 'already_covered' | 'below_minimum',
            };
        }

        const { rows: inserted } = await client.query(`
            INSERT INTO kitchen_payouts
              (kitchen_id, period_start, period_end, gross_sales_paise, commission_paise,
               net_payout_paise, orders_count, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
            ON CONFLICT (kitchen_id, period_start, period_end) DO NOTHING
            RETURNING id
        `, [kitchenId, periodStart, periodEnd, grossSalesPaise, commissionPaise, netPayoutPaise, ordersCount]);

        if (!inserted.length) {
            // Lost a race against an identical-period insert. Shouldn't happen given the
            // advisory lock above serializes same-kitchen calls, but stay safe regardless.
            return { created: false, netPayoutPaise, reason: 'already_covered' };
        }

        return { created: true, payoutId: inserted[0].id, netPayoutPaise };
    });
}
