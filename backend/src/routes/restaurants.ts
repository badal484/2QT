import { Router } from 'express';
import { query } from '../db';

const router = Router();

// ── GET /restaurants?zoneId=<uuid> ────────────────────────────────────────────
// Home-screen card: active restaurant(s) in the customer's zone with today's
// availability summary. Returns at most one restaurant per zone (current model).
router.get('/', async (req, res) => {
    const { zoneId } = req.query as { zoneId?: string };
    try {
        const { rows } = await query(`
            SELECT
                rc.id,
                rc.name,
                rc.description,
                rc.cuisine_type,
                rc.photos,
                rc.operating_hours,
                rc.slot_duration_minutes,
                rc.advance_booking_days,
                rc.cancellation_window_minutes,
                rc.deposit_paise,
                rc.max_party_size,
                rc.gst_percent,
                rc.lat,
                rc.lng,
                rc.address,
                CASE WHEN rc.partner_id IS NULL THEN 'own' ELSE 'partner' END AS restaurant_type,
                -- Count active bookings today to give a rough availability signal
                (
                    SELECT COUNT(*) FROM table_bookings tb
                    WHERE tb.restaurant_id = rc.id
                      AND tb.status NOT IN ('cancelled', 'no_show')
                      AND DATE(tb.slot_start AT TIME ZONE 'Asia/Kolkata') = CURRENT_DATE AT TIME ZONE 'Asia/Kolkata'
                ) AS bookings_today,
                -- Total active table slots today (capacity × slots_per_day)
                (
                    SELECT COUNT(*) FROM restaurant_tables rt
                    WHERE rt.restaurant_id = rc.id AND rt.is_active = true
                ) AS total_tables
            FROM restaurant_config rc
            WHERE rc.is_active = true
              ${zoneId ? 'AND rc.zone_id = $1' : ''}
            ORDER BY rc.created_at ASC
        `, zoneId ? [zoneId] : []);

        res.json({ restaurants: rows });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /restaurants/:id ───────────────────────────────────────────────────────
// Full restaurant detail page.
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await query(`
            SELECT rc.*,
                   CASE WHEN rc.partner_id IS NULL THEN 'own' ELSE 'partner' END AS restaurant_type
            FROM restaurant_config rc
            WHERE rc.id = $1 AND rc.is_active = true
        `, [id]);

        if (!rows[0]) return res.status(404).json({ error: 'NOT_FOUND' });

        // Ratings — table may not exist yet in all environments
        let avg_rating = 0, review_count = 0;
        try {
            const { rows: fbRows } = await query(`
                SELECT COALESCE(AVG(tbf.rating), 0) AS avg_rating, COUNT(*) AS review_count
                FROM table_booking_feedback tbf
                JOIN table_bookings tb ON tb.id = tbf.booking_id
                WHERE tb.restaurant_id = $1
            `, [id]);
            avg_rating = parseFloat(fbRows[0]?.avg_rating) || 0;
            review_count = parseInt(fbRows[0]?.review_count) || 0;
        } catch { /* table_booking_feedback not yet created */ }

        const { commission_percent, razorpay_contact_id, razorpay_fund_account_id, upi_id, partner_id, ...safe } = rows[0];
        res.json({ restaurant: { ...safe, avg_rating, review_count } });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /restaurants/:id/menu ─────────────────────────────────────────────────
// Returns dine-in menu for pre-order. Uses restaurant_menu_items if configured;
// falls back to the zone's kitchen menu_items so the same kitchen serves both.
router.get('/:id/menu', async (req, res) => {
    const { id } = req.params;
    try {
        // Try restaurant-specific menu first (table may not exist if migration 078 not applied)
        let restItems: any[] = [];
        try {
            const { rows } = await query(`
                SELECT id, name, description, price_paise, category,
                       image_url AS photo_url, is_veg, sort_order
                FROM restaurant_menu_items
                WHERE restaurant_id = $1 AND is_available = true
                ORDER BY category ASC, sort_order ASC, name ASC
            `, [id]);
            restItems = rows;
        } catch (tableErr: any) {
            console.warn(`[restaurant-menu] restaurant_menu_items query failed: ${tableErr.message}`);
        }

        let items = restItems;
        console.log(`[restaurant-menu] restaurantId=${id} restItems=${restItems.length}`);

        // Fallback 1: zone's kitchen menu — available items only
        if (items.length === 0) {
            const { rows: rcRows } = await query('SELECT zone_id FROM restaurant_config WHERE id = $1', [id]);
            const zoneId = rcRows[0]?.zone_id;
            if (zoneId) {
                const { rows: zoneItems } = await query(`
                    SELECT id, name, description, price_paise, category,
                           photo_url, is_veg, sort_order
                    FROM menu_items
                    WHERE zone_id = $1 AND available = true
                    ORDER BY category ASC, sort_order ASC, name ASC
                `, [zoneId]);
                console.log(`[restaurant-menu] fallback1 zoneId=${zoneId} items=${zoneItems.length}`);
                items = zoneItems;

                // Fallback 2: same zone, ignore available flag (kitchen may have paused)
                if (items.length === 0) {
                    const { rows: zoneAll } = await query(`
                        SELECT id, name, description, price_paise, category,
                               photo_url, is_veg, sort_order
                        FROM menu_items
                        WHERE zone_id = $1
                        ORDER BY category ASC, sort_order ASC, name ASC
                    `, [zoneId]);
                    console.log(`[restaurant-menu] fallback2 (ignore available) zoneId=${zoneId} items=${zoneAll.length}`);
                    items = zoneAll;
                }
            } else {
                console.warn(`[restaurant-menu] restaurantId=${id} has no zone_id`);
            }
        }

        // Fallback 3: all menu items across all zones (last resort — single-zone setups)
        if (items.length === 0) {
            const { rows: allItems } = await query(`
                SELECT id, name, description, price_paise, category,
                       photo_url, is_veg, sort_order
                FROM menu_items
                ORDER BY category ASC, sort_order ASC, name ASC
                LIMIT 100
            `);
            console.log(`[restaurant-menu] fallback3 (all zones) items=${allItems.length}`);
            items = allItems;
        }

        const grouped: Record<string, any[]> = {};
        for (const item of items) {
            const cat = item.category || 'Other';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(item);
        }

        res.json({ menu: grouped, items });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /restaurants/:id/availability?date=YYYY-MM-DD&partySize=2 ─────────────
// Returns available time slots for a given date and party size.
// A slot is available if at least one table with capacity >= partySize has no
// overlapping confirmed/seated booking.
router.get('/:id/availability', async (req, res) => {
    const { id } = req.params;
    const { date, partySize } = req.query as { date?: string; partySize?: string };

    if (!date || !partySize) {
        return res.status(400).json({ error: 'date and partySize are required' });
    }

    const size = parseInt(partySize, 10);
    if (isNaN(size) || size < 1) {
        return res.status(400).json({ error: 'Invalid partySize' });
    }

    try {
        const { rows: configs } = await query(`
            SELECT slot_duration_minutes, operating_hours, advance_booking_days, max_party_size
            FROM restaurant_config WHERE id = $1 AND is_active = true
        `, [id]);

        if (!configs[0]) return res.status(404).json({ error: 'NOT_FOUND' });
        const cfg = configs[0];

        if (size > cfg.max_party_size) {
            return res.status(400).json({ error: 'PARTY_TOO_LARGE', max: cfg.max_party_size });
        }

        // All date comparisons done in IST (UTC+5:30) to avoid server-timezone bugs.
        const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
        const todayStr = nowIST.toISOString().slice(0, 10); // 'YYYY-MM-DD' in IST
        const maxDt = new Date(nowIST);
        maxDt.setUTCDate(maxDt.getUTCDate() + cfg.advance_booking_days);
        const maxStr = maxDt.toISOString().slice(0, 10);
        if (date < todayStr || date > maxStr) {
            return res.status(400).json({ error: 'DATE_OUT_OF_RANGE' });
        }

        // Day-of-week: parse date parts directly — getDay() on local-midnight Date is
        // timezone-safe for calendar dates (July 4 is Saturday everywhere).
        const [yyyy, mm, dd] = date.split('-').map(Number);
        const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const dayKey = dayNames[new Date(yyyy, mm - 1, dd).getDay()];
        const dayHours = cfg.operating_hours[dayKey];

        if (!dayHours || dayHours.closed) {
            return res.json({ slots: [], reason: 'RESTAURANT_CLOSED' });
        }

        // Generate all slots for the day
        const [openH, openM] = (dayHours.open as string).split(':').map(Number);
        const [closeH, closeM] = (dayHours.close as string).split(':').map(Number);
        const openMinutes = openH * 60 + openM;
        const closeMinutes = closeH * 60 + closeM;
        const slotDuration = cfg.slot_duration_minutes as number;

        const slots: { slotStart: string; slotEnd: string; available: boolean }[] = [];

        for (let start = openMinutes; start + slotDuration <= closeMinutes; start += slotDuration) {
            const sh = Math.floor(start / 60);
            const sm = start % 60;
            const eh = Math.floor((start + slotDuration) / 60);
            const em = (start + slotDuration) % 60;

            const slotStart = `${date}T${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}:00+05:30`;
            const slotEnd   = `${date}T${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}:00+05:30`;

            // Skip slots that have already passed (add 30 min buffer for same-day)
            const slotStartDate = new Date(slotStart);
            const nowPlus30 = new Date(Date.now() + 30 * 60 * 1000);
            if (slotStartDate <= nowPlus30) {
                slots.push({ slotStart, slotEnd, available: false });
                continue;
            }

            // Check if at least one table is free in this slot
            const { rows: freeTables } = await query(`
                SELECT t.id FROM restaurant_tables t
                WHERE t.restaurant_id = $1
                  AND t.capacity >= $2
                  AND t.is_active = true
                  AND t.id NOT IN (
                      SELECT tb.table_id FROM table_bookings tb
                      WHERE tb.restaurant_id = $1
                        AND tb.status NOT IN ('cancelled', 'no_show')
                        AND tb.slot_start < $4
                        AND tb.slot_end   > $3
                  )
                LIMIT 1
            `, [id, size, slotStart, slotEnd]);

            slots.push({ slotStart, slotEnd, available: freeTables.length > 0 });
        }

        res.json({ slots });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
