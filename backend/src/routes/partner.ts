import { Router } from 'express';
import { query } from '../db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { emitToPartner } from '../socket';

const router = Router();

// All routes require 'partner' role unless noted.
// Partner can only manage their own restaurant.

async function getPartnerRestaurant(partnerId: string) {
    const { rows } = await query(
        'SELECT * FROM restaurant_config WHERE partner_id = $1 AND is_active = true LIMIT 1',
        [partnerId]
    );
    return rows[0] ?? null;
}

// ── GET /partner/restaurant ────────────────────────────────────────────────────
router.get('/restaurant', authenticate, requireRole('partner', 'super_admin'), async (req: AuthRequest, res) => {
    try {
        const restaurant = await getPartnerRestaurant(req.user!.userId);
        if (!restaurant) return res.status(404).json({ error: 'NO_RESTAURANT_ASSIGNED' });
        // Strip Razorpay internal IDs from partner view
        const { razorpay_contact_id, razorpay_fund_account_id, ...safe } = restaurant;
        res.json({ restaurant: safe });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── PUT /partner/restaurant ────────────────────────────────────────────────────
// Partner can update their restaurant info (description, hours, photos, upi_id).
// They cannot change commission_percent or zone — only admin can do that.
router.put('/restaurant', authenticate, requireRole('partner'), async (req: AuthRequest, res) => {
    const { description, cuisineType, address, photos, operatingHours, upiId } = req.body;
    try {
        const restaurant = await getPartnerRestaurant(req.user!.userId);
        if (!restaurant) return res.status(404).json({ error: 'NO_RESTAURANT_ASSIGNED' });

        const { rows } = await query(`
            UPDATE restaurant_config SET
                description      = COALESCE($2, description),
                cuisine_type     = COALESCE($3, cuisine_type),
                address          = COALESCE($4, address),
                photos           = COALESCE($5, photos),
                operating_hours  = COALESCE($6, operating_hours),
                upi_id           = COALESCE($7, upi_id),
                updated_at       = NOW()
            WHERE id = $1
            RETURNING id, name, description, cuisine_type, address, photos, operating_hours, upi_id
        `, [restaurant.id, description, cuisineType, address, photos, operatingHours, upiId]);

        res.json({ restaurant: rows[0] });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /partner/restaurant/menu ──────────────────────────────────────────────
router.get('/restaurant/menu', authenticate, requireRole('partner', 'super_admin'), async (req: AuthRequest, res) => {
    try {
        const restaurant = await getPartnerRestaurant(req.user!.userId);
        if (!restaurant) return res.status(404).json({ error: 'NO_RESTAURANT_ASSIGNED' });

        const { rows } = await query(
            'SELECT * FROM restaurant_menu_items WHERE restaurant_id = $1 ORDER BY category, sort_order, name',
            [restaurant.id]
        );
        res.json({ items: rows });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /partner/restaurant/menu ─────────────────────────────────────────────
router.post('/restaurant/menu', authenticate, requireRole('partner'), async (req: AuthRequest, res) => {
    const { name, description, pricePaise, category, imageUrl, isVeg, sortOrder } = req.body;
    if (!name || !pricePaise) return res.status(400).json({ error: 'name and pricePaise required' });

    try {
        const restaurant = await getPartnerRestaurant(req.user!.userId);
        if (!restaurant) return res.status(404).json({ error: 'NO_RESTAURANT_ASSIGNED' });

        const { rows } = await query(`
            INSERT INTO restaurant_menu_items
                (restaurant_id, name, description, price_paise, category, image_url, is_veg, sort_order)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            RETURNING *
        `, [restaurant.id, name, description || null, pricePaise, category || null, imageUrl || null, isVeg !== false, sortOrder || 0]);

        res.status(201).json({ item: rows[0] });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── PUT /partner/restaurant/menu/:itemId ──────────────────────────────────────
router.put('/restaurant/menu/:itemId', authenticate, requireRole('partner'), async (req: AuthRequest, res) => {
    const { itemId } = req.params;
    const { name, description, pricePaise, category, imageUrl, isVeg, isAvailable, sortOrder } = req.body;

    try {
        const restaurant = await getPartnerRestaurant(req.user!.userId);
        if (!restaurant) return res.status(404).json({ error: 'NO_RESTAURANT_ASSIGNED' });

        const { rows } = await query(`
            UPDATE restaurant_menu_items SET
                name         = COALESCE($3, name),
                description  = COALESCE($4, description),
                price_paise  = COALESCE($5, price_paise),
                category     = COALESCE($6, category),
                image_url    = COALESCE($7, image_url),
                is_veg       = COALESCE($8, is_veg),
                is_available = COALESCE($9, is_available),
                sort_order   = COALESCE($10, sort_order)
            WHERE id = $1 AND restaurant_id = $2
            RETURNING *
        `, [itemId, restaurant.id, name, description, pricePaise, category, imageUrl, isVeg, isAvailable, sortOrder]);

        if (!rows[0]) return res.status(404).json({ error: 'ITEM_NOT_FOUND' });
        res.json({ item: rows[0] });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── DELETE /partner/restaurant/menu/:itemId ───────────────────────────────────
router.delete('/restaurant/menu/:itemId', authenticate, requireRole('partner'), async (req: AuthRequest, res) => {
    const { itemId } = req.params;
    try {
        const restaurant = await getPartnerRestaurant(req.user!.userId);
        if (!restaurant) return res.status(404).json({ error: 'NO_RESTAURANT_ASSIGNED' });

        const { rows } = await query(
            'DELETE FROM restaurant_menu_items WHERE id=$1 AND restaurant_id=$2 RETURNING id',
            [itemId, restaurant.id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'ITEM_NOT_FOUND' });
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /partner/bookings ──────────────────────────────────────────────────────
// List bookings for partner's restaurant. Query params: date=YYYY-MM-DD, status.
router.get('/bookings', authenticate, requireRole('partner', 'super_admin'), async (req: AuthRequest, res) => {
    const { date, status } = req.query as { date?: string; status?: string };
    try {
        const restaurant = await getPartnerRestaurant(req.user!.userId);
        if (!restaurant) return res.status(404).json({ error: 'NO_RESTAURANT_ASSIGNED' });

        const params: any[] = [restaurant.id];
        let dateFilter = '';
        let statusFilter = '';

        if (date) {
            params.push(date);
            dateFilter = `AND DATE(tb.slot_start AT TIME ZONE 'Asia/Kolkata') = $${params.length}`;
        }
        if (status) {
            params.push(status);
            statusFilter = `AND tb.status = $${params.length}`;
        }

        const { rows } = await query(`
            SELECT
                tb.id, tb.display_id, tb.status, tb.party_size,
                tb.slot_start, tb.slot_end, tb.occasion, tb.special_requests,
                tb.pre_order_amount_paise, tb.post_order_amount_paise,
                tb.gst_amount_paise, tb.total_paid_paise, tb.final_payment_method,
                tb.seated_at, tb.completed_at,
                u.name AS customer_name, u.phone AS customer_phone,
                rt.table_number,
                COALESCE(items.list, '[]') AS items
            FROM table_bookings tb
            JOIN users u ON u.id = tb.customer_id
            LEFT JOIN restaurant_tables rt ON rt.id = tb.table_id
            LEFT JOIN LATERAL (
                SELECT json_agg(json_build_object(
                    'name', tbi.menu_item_name, 'quantity', tbi.quantity,
                    'type', tbi.type, 'status', tbi.status
                ) ORDER BY tbi.ordered_at) AS list
                FROM table_booking_items tbi WHERE tbi.booking_id = tb.id
            ) items ON true
            WHERE tb.restaurant_id = $1 ${dateFilter} ${statusFilter}
            ORDER BY tb.slot_start ASC
            LIMIT 100
        `, params);

        res.json({ bookings: rows });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /partner/bookings/today ────────────────────────────────────────────────
router.get('/bookings/today', authenticate, requireRole('partner', 'super_admin'), async (req: AuthRequest, res) => {
    try {
        const restaurant = await getPartnerRestaurant(req.user!.userId);
        if (!restaurant) return res.status(404).json({ error: 'NO_RESTAURANT_ASSIGNED' });

        const { rows } = await query(`
            SELECT
                tb.id, tb.display_id, tb.status, tb.party_size,
                tb.slot_start, tb.slot_end, tb.occasion, tb.special_requests,
                tb.pre_order_amount_paise, tb.post_order_amount_paise,
                tb.total_paid_paise, tb.seated_at,
                u.name AS customer_name, u.phone AS customer_phone,
                rt.table_number,
                COALESCE(items.list, '[]') AS items
            FROM table_bookings tb
            JOIN users u ON u.id = tb.customer_id
            LEFT JOIN restaurant_tables rt ON rt.id = tb.table_id
            LEFT JOIN LATERAL (
                SELECT json_agg(json_build_object(
                    'name', tbi.menu_item_name, 'quantity', tbi.quantity,
                    'type', tbi.type, 'status', tbi.status
                ) ORDER BY tbi.ordered_at) AS list
                FROM table_booking_items tbi WHERE tbi.booking_id = tb.id
            ) items ON true
            WHERE tb.restaurant_id = $1
              AND DATE(tb.slot_start AT TIME ZONE 'Asia/Kolkata') = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE
              AND tb.status NOT IN ('cancelled')
            ORDER BY tb.slot_start ASC
        `, [restaurant.id]);

        // Summary stats
        const confirmed = rows.filter((r: any) => r.status === 'confirmed').length;
        const seated = rows.filter((r: any) => r.status === 'seated').length;
        const completed = rows.filter((r: any) => r.status === 'completed').length;
        const totalRevenuePaise = rows
            .filter((r: any) => r.status === 'completed')
            .reduce((sum: number, r: any) => sum + r.total_paid_paise, 0);

        res.json({ bookings: rows, summary: { confirmed, seated, completed, totalRevenuePaise } });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /partner/earnings ──────────────────────────────────────────────────────
// Revenue breakdown for the partner. Includes pending payout.
router.get('/earnings', authenticate, requireRole('partner', 'super_admin'), async (req: AuthRequest, res) => {
    const { period = '7d' } = req.query as { period?: '7d' | '30d' | 'all' };

    try {
        const restaurant = await getPartnerRestaurant(req.user!.userId);
        if (!restaurant) return res.status(404).json({ error: 'NO_RESTAURANT_ASSIGNED' });

        const daysMap: Record<string, number> = { '7d': 7, '30d': 30, 'all': 36500 };
        const days = daysMap[period] ?? 7;

        const { rows: revRows } = await query(`
            SELECT
                COUNT(*) FILTER (WHERE tb.status = 'completed') AS completed_bookings,
                COALESCE(SUM(tb.total_paid_paise) FILTER (WHERE tb.status = 'completed'), 0) AS gross_revenue_paise,
                COALESCE(SUM(tbp.amount_paise) FILTER (WHERE tbp.payment_method IN ('cash','card_pos')), 0) AS cash_collected_paise
            FROM table_bookings tb
            LEFT JOIN table_booking_payments tbp ON tbp.booking_id = tb.id
                AND tbp.payment_type = 'final_settlement'
            WHERE tb.restaurant_id = $1
              AND tb.completed_at >= NOW() - ($2 || ' days')::INTERVAL
        `, [restaurant.id, days]);

        const rev = revRows[0];
        const grossPaise = Number(rev.gross_revenue_paise);
        const cashPaise = Number(rev.cash_collected_paise);
        const commissionPaise = Math.round(grossPaise * (restaurant.commission_percent / 100));
        const partnerSharePaise = grossPaise - commissionPaise;
        const netPendingPaise = partnerSharePaise - cashPaise;

        // Payout history
        const { rows: payouts } = await query(`
            SELECT id, period_start, period_end, gross_revenue_paise, commission_paise,
                   cash_collected_paise, net_payout_paise, status, paid_at, utr_number
            FROM partner_restaurant_payouts
            WHERE restaurant_id = $1
            ORDER BY created_at DESC
            LIMIT 20
        `, [restaurant.id]);

        res.json({
            period,
            commissionPercent: restaurant.commission_percent,
            grossRevenuePaise: grossPaise,
            commissionPaise,
            cashCollectedPaise: cashPaise,
            partnerSharePaise,
            netPendingPaise,
            completedBookings: Number(rev.completed_bookings),
            payoutHistory: payouts,
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /partner/tables ────────────────────────────────────────────────────────
router.get('/tables', authenticate, requireRole('partner', 'super_admin'), async (req: AuthRequest, res) => {
    try {
        const restaurant = await getPartnerRestaurant(req.user!.userId);
        if (!restaurant) return res.status(404).json({ error: 'NO_RESTAURANT_ASSIGNED' });

        const { rows } = await query(
            'SELECT * FROM restaurant_tables WHERE restaurant_id = $1 ORDER BY table_number',
            [restaurant.id]
        );
        res.json({ tables: rows });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
