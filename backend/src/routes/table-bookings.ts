import { Router } from 'express';
import Razorpay from 'razorpay';
import { query, withTransaction } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { emitToUser, emitToKitchen, emitToPartner, emitToAdmin } from '../socket';
import { NotificationService } from '../services/notification.service';

const router = Router();

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || '',
    key_secret: process.env.RAZORPAY_KEY_SECRET || '',
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Find a free table for the slot and party size. Returns null if none available.
async function findFreeTable(
    restaurantId: string, partySize: number,
    slotStart: string, slotEnd: string, client?: any
): Promise<string | null> {
    const db = client || { query: (sql: string, params: any[]) => query(sql, params) };
    const { rows } = await db.query(`
        SELECT t.id FROM restaurant_tables t
        WHERE t.restaurant_id = $1
          AND t.capacity >= $2
          AND t.is_active = true
          AND t.id NOT IN (
              SELECT tb.table_id FROM table_bookings tb
              WHERE tb.restaurant_id = $1
                AND tb.status NOT IN ('cancelled','no_show')
                AND tb.slot_start < $4
                AND tb.slot_end   > $3
          )
        ORDER BY t.capacity ASC   -- smallest fitting table first
        LIMIT 1
    `, [restaurantId, partySize, slotStart, slotEnd]);
    return rows[0]?.id ?? null;
}

// Route a kitchen ticket to own restaurant kitchen or partner portal.
async function routeTicket(restaurantId: string, event: string, data: any) {
    const { rows } = await query(
        'SELECT partner_id, zone_id FROM restaurant_config WHERE id = $1', [restaurantId]
    );
    const restaurant = rows[0];
    if (!restaurant) return;

    if (restaurant.partner_id) {
        emitToPartner(restaurant.partner_id, event, data);
    } else {
        // Find the kitchen for this zone
        const { rows: kitchens } = await query(
            'SELECT id FROM kitchens WHERE zone_id = $1 AND is_active = true LIMIT 1',
            [restaurant.zone_id]
        );
        if (kitchens[0]) emitToKitchen(kitchens[0].id, event, data);
    }
}

// ── POST /table-bookings ───────────────────────────────────────────────────────
// Create a booking. Pre-order payment: 'wallet' (instant) or 'razorpay' (returns gateway order).
// Body: { restaurantId, partySize, slotStart, slotEnd, occasion?, specialRequests?,
//         preOrderItems?: [{menuItemId, quantity, customizations?}][],
//         paymentMethod?: 'wallet'|'razorpay' }
router.post('/', authenticate, async (req: AuthRequest, res) => {
    const customerId = req.user!.userId;
    const {
        restaurantId, partySize, slotStart, slotEnd,
        occasion, specialRequests,
        preOrderItems = [],
        paymentMethod = 'wallet',
    } = req.body as {
        restaurantId: string; partySize: number; slotStart: string; slotEnd: string;
        occasion?: string; specialRequests?: string;
        preOrderItems?: { menuItemId: string; quantity: number; customizations?: any }[];
        paymentMethod?: 'wallet' | 'razorpay';
    };

    if (!restaurantId || !partySize || !slotStart || !slotEnd) {
        return res.status(400).json({ error: 'restaurantId, partySize, slotStart, slotEnd are required' });
    }

    try {
        // 1. Validate restaurant
        const { rows: configs } = await query(`
            SELECT id, name, slot_duration_minutes, cancellation_window_minutes,
                   deposit_paise, max_party_size, gst_percent, partner_id, zone_id
            FROM restaurant_config WHERE id = $1 AND is_active = true
        `, [restaurantId]);
        if (!configs[0]) return res.status(404).json({ error: 'RESTAURANT_NOT_FOUND' });
        const cfg = configs[0];

        if (partySize > cfg.max_party_size) {
            return res.status(400).json({ error: 'PARTY_TOO_LARGE', max: cfg.max_party_size });
        }

        // 2. Check for existing active booking by this customer in overlapping slot
        const { rows: existingBookings } = await query(`
            SELECT id FROM table_bookings
            WHERE customer_id = $1
              AND restaurant_id = $2
              AND status NOT IN ('cancelled','no_show','completed')
              AND slot_start < $4 AND slot_end > $3
        `, [customerId, restaurantId, slotStart, slotEnd]);
        if (existingBookings.length > 0) {
            return res.status(409).json({ error: 'ALREADY_BOOKED_THIS_SLOT' });
        }

        // 3. Resolve pre-order items + compute amount
        let preOrderAmountPaise = 0;
        const resolvedItems: { menuItemId: string | null; name: string; pricePaise: number; quantity: number; customizations?: any }[] = [];

        for (const item of preOrderItems) {
            // Check restaurant-specific menu first, then fall back to zone kitchen menu
            let { rows: menuRows } = await query(
                'SELECT id, name, price_paise FROM restaurant_menu_items WHERE id = $1 AND restaurant_id = $2 AND is_available = true',
                [item.menuItemId, restaurantId]
            );
            let isRestaurantItem = !!menuRows[0];

            if (!menuRows[0]) {
                // Item may be from the zone's kitchen menu_items — look up zone_id directly
                const { rows: rcRows } = await query('SELECT zone_id FROM restaurant_config WHERE id = $1', [restaurantId]);
                const zoneId = rcRows[0]?.zone_id;
                if (zoneId) {
                    let { rows: kitchenRows } = await query(
                        'SELECT id, name, price_paise FROM menu_items WHERE id = $1 AND zone_id = $2 AND available = true',
                        [item.menuItemId, zoneId]
                    );
                    if (!kitchenRows[0]) {
                        const { rows: kitchenAny } = await query(
                            'SELECT id, name, price_paise FROM menu_items WHERE id = $1 AND zone_id = $2',
                            [item.menuItemId, zoneId]
                        );
                        kitchenRows = kitchenAny;
                    }
                    if (!kitchenRows[0]) {
                        const { rows: anyZone } = await query(
                            'SELECT id, name, price_paise FROM menu_items WHERE id = $1',
                            [item.menuItemId]
                        );
                        kitchenRows = anyZone;
                    }
                    menuRows = kitchenRows;
                }
            }
            if (!menuRows[0]) return res.status(400).json({ error: `MENU_ITEM_NOT_FOUND: ${item.menuItemId}` });
            const linePaise = menuRows[0].price_paise * item.quantity;
            preOrderAmountPaise += linePaise;
            // Only reference restaurant_menu_items FK when item actually lives there;
            // fallback kitchen menu items use NULL to avoid FK violation.
            resolvedItems.push({
                menuItemId: isRestaurantItem ? item.menuItemId : null,
                name: menuRows[0].name,
                pricePaise: menuRows[0].price_paise,
                quantity: item.quantity,
                customizations: item.customizations,
            });
        }

        // Deposit (if configured) is due regardless of pre-order
        const depositPaise = cfg.deposit_paise as number;
        const totalDueNow = preOrderAmountPaise + depositPaise;

        // 4. Find a free table inside a transaction (prevents double-booking)
        let bookingId = '';
        let displayId = '';

        await withTransaction(async (client) => {
            const tableId = await findFreeTable(restaurantId, partySize, slotStart, slotEnd, client);
            if (!tableId) throw new Error('NO_TABLE_AVAILABLE');

            // If wallet payment, deduct immediately inside the transaction
            if (paymentMethod === 'wallet' && totalDueNow > 0) {
                const { rows: wallet } = await client.query(
                    'SELECT balance_paise FROM customer_wallet WHERE customer_id = $1 FOR UPDATE',
                    [customerId]
                );
                const balance = wallet[0]?.balance_paise ?? 0;
                if (balance < totalDueNow) throw new Error('INSUFFICIENT_WALLET_BALANCE');

                await client.query(`
                    UPDATE customer_wallet SET balance_paise = balance_paise - $2 WHERE customer_id = $1
                `, [customerId, totalDueNow]);

                await client.query(`
                    INSERT INTO wallet_transactions (customer_id, amount_paise, type, description, balance_after_paise)
                    SELECT $1, $2, 'debit', $3, balance_paise FROM customer_wallet WHERE customer_id = $1
                `, [customerId, totalDueNow, `Table pre-order at ${cfg.name}`]);
            }

            // Create booking
            const status = (paymentMethod === 'razorpay' && totalDueNow > 0)
                ? 'pending_payment'
                : 'confirmed';

            const { rows: booking } = await client.query(`
                INSERT INTO table_bookings
                    (restaurant_id, customer_id, table_id, party_size, slot_start, slot_end,
                     occasion, special_requests, status,
                     pre_order_amount_paise, deposit_amount_paise, total_paid_paise)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
                RETURNING id, display_id
            `, [
                restaurantId, customerId, tableId, partySize, slotStart, slotEnd,
                occasion || null, specialRequests || null, status,
                preOrderAmountPaise, depositPaise,
                paymentMethod === 'wallet' ? totalDueNow : 0,
            ]);
            bookingId = booking[0].id;
            displayId = booking[0].display_id;

            // Insert pre-order items
            for (const item of resolvedItems) {
                await client.query(`
                    INSERT INTO table_booking_items
                        (booking_id, menu_item_id, menu_item_name, price_paise, quantity, customizations, type, added_by)
                    VALUES ($1,$2,$3,$4,$5,$6,'pre_order',$7)
                `, [bookingId, item.menuItemId, item.name, item.pricePaise, item.quantity, item.customizations ?? null, customerId]);
            }

            // Record wallet payment
            if (paymentMethod === 'wallet' && totalDueNow > 0) {
                if (preOrderAmountPaise > 0) {
                    await client.query(`
                        INSERT INTO table_booking_payments
                            (booking_id, amount_paise, payment_method, payment_type)
                        VALUES ($1,$2,'wallet','pre_order')
                    `, [bookingId, preOrderAmountPaise]);
                }
                if (depositPaise > 0) {
                    await client.query(`
                        INSERT INTO table_booking_payments
                            (booking_id, amount_paise, payment_method, payment_type)
                        VALUES ($1,$2,'wallet','deposit')
                    `, [bookingId, depositPaise]);
                }
            }
        });

        // 5. If razorpay, create a Razorpay order and return it
        if (paymentMethod === 'razorpay' && totalDueNow > 0) {
            const rzpOrder = await (razorpay.orders as any).create({
                amount: totalDueNow,
                currency: 'INR',
                receipt: displayId,
                notes: { bookingId, type: 'table_booking' },
            });
            await query(
                'UPDATE table_bookings SET gateway_order_id = $1 WHERE id = $2',
                [rzpOrder.id, bookingId]
            );
            return res.json({
                bookingId, displayId, status: 'pending_payment',
                razorpayOrderId: rzpOrder.id,
                razorpayKeyId: process.env.RAZORPAY_KEY_ID,
                amountPaise: totalDueNow,
            });
        }

        // 6. Notify kitchen / partner of pre-order
        if (resolvedItems.length > 0) {
            await routeTicket(restaurantId, 'table_order', {
                bookingId, displayId, type: 'pre_order',
                partySize, slotStart, occasion,
                items: resolvedItems.map(i => ({ name: i.name, quantity: i.quantity })),
            });
        }

        // Push notification to customer
        NotificationService.send('broadcast_message', {
            userId: customerId,
            title: 'Table Reserved!',
            body: `Your table at ${cfg.name} is confirmed for ${new Date(slotStart).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}`,
            screen: 'TableBookingDetail',
            bookingId,
        }).catch(() => {});

        emitToAdmin('new_table_booking', { bookingId, displayId, restaurantId, partySize, slotStart });

        res.json({ bookingId, displayId, status: 'confirmed', amountPaidPaise: totalDueNow });
    } catch (err: any) {
        if (err.message === 'NO_TABLE_AVAILABLE') return res.status(409).json({ error: 'NO_TABLE_AVAILABLE' });
        if (err.message === 'INSUFFICIENT_WALLET_BALANCE') return res.status(402).json({ error: 'INSUFFICIENT_WALLET_BALANCE' });
        console.error('[table-bookings POST]', err);
        res.status(500).json({ error: err.message });
    }
});

// ── POST /table-bookings/verify-payment ───────────────────────────────────────
// Confirms a Razorpay payment for a table booking (pre-order / deposit).
router.post('/verify-payment', authenticate, async (req: AuthRequest, res) => {
    const { bookingId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    if (!bookingId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        return res.status(400).json({ error: 'Missing payment fields' });
    }

    const crypto = await import('crypto');
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

    if (expected !== razorpaySignature) {
        return res.status(400).json({ error: 'INVALID_SIGNATURE' });
    }

    try {
        const { rows } = await query(`
            UPDATE table_bookings
            SET status = 'confirmed', gateway_payment_id = $2, total_paid_paise = pre_order_amount_paise + deposit_amount_paise
            WHERE id = $1 AND status = 'pending_payment'
            RETURNING restaurant_id, customer_id, pre_order_amount_paise, deposit_amount_paise,
                      display_id, slot_start, party_size, occasion
        `, [bookingId, razorpayPaymentId]);

        if (!rows[0]) return res.status(404).json({ error: 'BOOKING_NOT_FOUND_OR_ALREADY_CONFIRMED' });
        const b = rows[0];

        if (b.pre_order_amount_paise > 0) {
            await query(`
                INSERT INTO table_booking_payments (booking_id, amount_paise, payment_method, payment_type, gateway_payment_id)
                VALUES ($1,$2,'gateway','pre_order',$3)
            `, [bookingId, b.pre_order_amount_paise, razorpayPaymentId]);
        }
        if (b.deposit_amount_paise > 0) {
            await query(`
                INSERT INTO table_booking_payments (booking_id, amount_paise, payment_method, payment_type, gateway_payment_id)
                VALUES ($1,$2,'gateway','deposit',$3)
            `, [bookingId, b.deposit_amount_paise, razorpayPaymentId]);
        }

        // Notify kitchen/partner of pre-order items
        const { rows: items } = await query(
            'SELECT menu_item_name, quantity FROM table_booking_items WHERE booking_id = $1 AND type = $2',
            [bookingId, 'pre_order']
        );
        if (items.length > 0) {
            await routeTicket(b.restaurant_id, 'table_order', {
                bookingId, displayId: b.display_id, type: 'pre_order',
                partySize: b.party_size, slotStart: b.slot_start, occasion: b.occasion,
                items: items.map((i: any) => ({ name: i.menu_item_name, quantity: i.quantity })),
            });
        }

        emitToUser(b.customer_id, 'table_booking_updated', { bookingId, status: 'confirmed' });
        res.json({ success: true, displayId: b.display_id });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /table-bookings/mine ───────────────────────────────────────────────────
router.get('/mine', authenticate, async (req: AuthRequest, res) => {
    const customerId = req.user!.userId;
    const { status } = req.query as { status?: string };

    try {
        const { rows } = await query(`
            SELECT
                tb.id, tb.display_id, tb.status, tb.party_size,
                tb.slot_start, tb.slot_end, tb.occasion,
                tb.pre_order_amount_paise, tb.post_order_amount_paise,
                tb.gst_amount_paise, tb.total_paid_paise, tb.deposit_amount_paise,
                tb.final_payment_method, tb.seated_at, tb.completed_at, tb.cancelled_at,
                rc.name AS restaurant_name, rc.address AS restaurant_address,
                rc.photos AS restaurant_photos, rc.cuisine_type,
                rt.table_number,
                COALESCE(items.list, '[]') AS pre_order_items
            FROM table_bookings tb
            JOIN restaurant_config rc ON rc.id = tb.restaurant_id
            LEFT JOIN restaurant_tables rt ON rt.id = tb.table_id
            LEFT JOIN LATERAL (
                SELECT json_agg(json_build_object(
                    'name', tbi.menu_item_name,
                    'quantity', tbi.quantity,
                    'price_paise', tbi.price_paise,
                    'status', tbi.status,
                    'type', tbi.type
                ) ORDER BY tbi.ordered_at) AS list
                FROM table_booking_items tbi WHERE tbi.booking_id = tb.id
            ) items ON true
            WHERE tb.customer_id = $1
              ${status === 'upcoming' ? "AND tb.status IN ('confirmed','seated') AND tb.slot_end >= NOW()" : ''}
              ${status === 'past' ? "AND (tb.status IN ('completed','no_show') OR (tb.status IN ('confirmed','seated') AND tb.slot_end < NOW()))" : ''}
              ${status === 'cancelled' ? "AND tb.status = 'cancelled'" : ''}
            ORDER BY tb.slot_start DESC
            LIMIT 50
        `, [customerId]);

        res.json({ bookings: rows });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /table-bookings/:id ────────────────────────────────────────────────────
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
    const { id } = req.params;
    try {
        const { rows } = await query(`
            SELECT
                tb.*,
                rc.name AS restaurant_name, rc.address AS restaurant_address,
                rc.photos AS restaurant_photos, rc.cuisine_type,
                rc.gst_percent, rc.cancellation_window_minutes,
                rc.partner_id IS NOT NULL AS is_partner_restaurant,
                rt.table_number, rt.capacity AS table_capacity,
                COALESCE(items.list, '[]') AS items
            FROM table_bookings tb
            JOIN restaurant_config rc ON rc.id = tb.restaurant_id
            LEFT JOIN restaurant_tables rt ON rt.id = tb.table_id
            LEFT JOIN LATERAL (
                SELECT json_agg(json_build_object(
                    'id', tbi.id,
                    'name', tbi.menu_item_name,
                    'quantity', tbi.quantity,
                    'price_paise', tbi.price_paise,
                    'type', tbi.type,
                    'status', tbi.status,
                    'ordered_at', tbi.ordered_at
                ) ORDER BY tbi.ordered_at) AS list
                FROM table_booking_items tbi WHERE tbi.booking_id = tb.id
            ) items ON true
            WHERE tb.id = $1
        `, [id]);

        if (!rows[0]) return res.status(404).json({ error: 'NOT_FOUND' });
        const booking = rows[0];

        // Only the booking customer or staff can view
        if (req.user!.role === 'customer' && booking.customer_id !== req.user!.userId) {
            return res.status(403).json({ error: 'FORBIDDEN' });
        }

        // Compute outstanding
        const outstanding = (
            booking.pre_order_amount_paise +
            booking.post_order_amount_paise +
            booking.gst_amount_paise
        ) - booking.total_paid_paise;

        // Is free cancellation still available?
        const cutoff = new Date(booking.slot_start).getTime() - booking.cancellation_window_minutes * 60 * 1000;
        const freeCancellationUntil = new Date(cutoff).toISOString();

        res.json({ booking: { ...booking, outstanding_paise: outstanding, free_cancellation_until: freeCancellationUntil } });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /table-bookings/:id/cancel ───────────────────────────────────────────
// Cancels a booking. Pre-order refunded to wallet instantly.
// Deposit: refunded only if within free cancellation window.
router.post('/:id/cancel', authenticate, async (req: AuthRequest, res) => {
    const { id } = req.params;
    const customerId = req.user!.userId;

    try {
        const { rows } = await query(`
            SELECT tb.*, rc.cancellation_window_minutes, rc.name AS restaurant_name
            FROM table_bookings tb
            JOIN restaurant_config rc ON rc.id = tb.restaurant_id
            WHERE tb.id = $1
        `, [id]);
        if (!rows[0]) return res.status(404).json({ error: 'NOT_FOUND' });
        const b = rows[0];

        if (req.user!.role === 'customer' && b.customer_id !== customerId) {
            return res.status(403).json({ error: 'FORBIDDEN' });
        }
        if (!['confirmed', 'pending_payment'].includes(b.status)) {
            return res.status(400).json({ error: 'CANNOT_CANCEL', message: 'Only confirmed bookings can be cancelled' });
        }

        const now = Date.now();
        const cutoff = new Date(b.slot_start).getTime() - b.cancellation_window_minutes * 60 * 1000;
        const isFreeCancellation = now < cutoff;

        // Compute refund amounts
        const preOrderRefund = b.pre_order_amount_paise; // always refunded
        const depositRefund = isFreeCancellation ? b.deposit_amount_paise : 0;
        const totalRefund = preOrderRefund + depositRefund;

        await withTransaction(async (client) => {
            await client.query(
                "UPDATE table_bookings SET status='cancelled', cancelled_at=NOW(), cancellation_reason=$2 WHERE id=$1",
                [id, req.body.reason || 'Customer cancelled']
            );

            if (totalRefund > 0) {
                await client.query(`
                    INSERT INTO customer_wallet (customer_id, balance_paise) VALUES ($1, $2)
                    ON CONFLICT (customer_id) DO UPDATE SET balance_paise = customer_wallet.balance_paise + $2
                `, [b.customer_id, totalRefund]);

                await client.query(`
                    INSERT INTO wallet_transactions (customer_id, amount_paise, type, description, balance_after_paise)
                    SELECT $1, $2, 'credit', $3, balance_paise FROM customer_wallet WHERE customer_id = $1
                `, [b.customer_id, totalRefund, `Refund for cancelled table booking ${b.display_id} at ${b.restaurant_name}`]);

                await client.query(`
                    INSERT INTO table_booking_payments (booking_id, amount_paise, payment_method, payment_type, notes)
                    VALUES ($1,$2,'wallet','refund',$3)
                `, [id, totalRefund, isFreeCancellation ? 'Full refund — free cancellation' : 'Partial refund — deposit forfeited']);
            }
        });

        emitToUser(b.customer_id, 'table_booking_updated', { bookingId: id, status: 'cancelled' });

        if (totalRefund > 0) {
            emitToUser(b.customer_id, 'wallet_updated', {});
            NotificationService.send('broadcast_message', {
                userId: b.customer_id,
                title: 'Booking Cancelled',
                body: totalRefund > 0
                    ? `₹${(totalRefund / 100).toFixed(0)} refunded to your wallet.`
                    : 'Your booking has been cancelled.',
                screen: 'TableBookingDetail',
                bookingId: id,
            }).catch(() => {});
        }

        res.json({
            success: true,
            refundedPaise: totalRefund,
            depositForfeited: !isFreeCancellation && b.deposit_amount_paise > 0,
            message: isFreeCancellation
                ? `Full refund of ₹${(totalRefund / 100).toFixed(0)} to wallet`
                : `₹${(preOrderRefund / 100).toFixed(0)} refunded. Deposit of ₹${(b.deposit_amount_paise / 100).toFixed(0)} forfeited.`,
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /table-bookings/:id/checkin ─────────────────────────────────────────
// Staff / partner scans QR code → marks booking as 'seated'.
router.post('/:id/checkin', authenticate, async (req: AuthRequest, res) => {
    const { id } = req.params;
    const allowedRoles = ['super_admin', 'admin', 'chef', 'kitchen_manager', 'partner', 'partner_kitchen', 'dine_in_staff'];
    if (!allowedRoles.includes(req.user!.role)) {
        return res.status(403).json({ error: 'FORBIDDEN' });
    }

    try {
        // dine_in_staff can only check in bookings for their assigned restaurant
        const restaurantFilter = req.user!.role === 'dine_in_staff'
            ? `AND restaurant_id = '${req.user!.restaurantId}'` : '';

        const { rows } = await query(`
            UPDATE table_bookings
            SET status = 'seated', seated_at = NOW(), updated_at = NOW()
            WHERE id = $1 AND status = 'confirmed' ${restaurantFilter}
            RETURNING customer_id, restaurant_id, display_id, slot_start, party_size, occasion,
                      pre_order_amount_paise
        `, [id]);
        if (!rows[0]) return res.status(400).json({ error: 'BOOKING_NOT_FOUND_OR_WRONG_STATUS' });
        const b = rows[0];

        emitToUser(b.customer_id, 'table_booking_updated', {
            bookingId: id, status: 'seated', message: 'Welcome! You\'re seated.'
        });

        // Notify kitchen/partner to start serving the pre-order
        if (b.pre_order_amount_paise > 0) {
            await routeTicket(b.restaurant_id, 'table_checkin', {
                bookingId: id, displayId: b.display_id, partySize: b.party_size, occasion: b.occasion
            });
        }

        res.json({ success: true, displayId: b.display_id });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /table-bookings/:id/post-order ───────────────────────────────────────
// Add more items after the customer is seated. No payment yet — settled at checkout.
// Allowed by: customer (their own booking), staff/partner.
router.post('/:id/post-order', authenticate, async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { items, skipKitchen = false } = req.body as {
        items: { menuItemId: string; quantity: number; customizations?: any }[];
        skipKitchen?: boolean;
    };
    if (!items?.length) return res.status(400).json({ error: 'items array required' });
    // Only staff roles can bypass kitchen; customers always go through kitchen
    const canSkipKitchen = skipKitchen && req.user!.role !== 'customer';

    try {
        const { rows: bookings } = await query(
            'SELECT customer_id, restaurant_id, status FROM table_bookings WHERE id = $1',
            [id]
        );
        if (!bookings[0]) return res.status(404).json({ error: 'NOT_FOUND' });
        const b = bookings[0];

        if (b.status !== 'seated') {
            return res.status(400).json({ error: 'BOOKING_NOT_SEATED', message: 'Post-orders can only be added after check-in' });
        }
        // Customers can only add to their own booking
        if (req.user!.role === 'customer' && b.customer_id !== req.user!.userId) {
            return res.status(403).json({ error: 'FORBIDDEN' });
        }

        let addedAmountPaise = 0;
        const ticketItems: { name: string; quantity: number }[] = [];

        // Resolve zone_id once for fallback lookups
        const { rows: rcRows } = await query(
            'SELECT zone_id FROM restaurant_config WHERE id = $1', [b.restaurant_id]
        );
        const zoneId = rcRows[0]?.zone_id ?? null;

        await withTransaction(async (client) => {
            for (const item of items) {
                // Try restaurant-specific menu first
                let { rows: menuRows } = await client.query(
                    'SELECT id, name, price_paise FROM restaurant_menu_items WHERE id = $1 AND restaurant_id = $2 AND is_available = true',
                    [item.menuItemId, b.restaurant_id]
                );
                let isRestaurantItem = !!menuRows[0];

                // Fall back to zone kitchen menu_items (same as pre-order resolution)
                if (!menuRows[0] && zoneId) {
                    ({ rows: menuRows } = await client.query(
                        'SELECT id, name, price_paise FROM menu_items WHERE id = $1 AND zone_id = $2',
                        [item.menuItemId, zoneId]
                    ));
                    if (!menuRows[0]) {
                        ({ rows: menuRows } = await client.query(
                            'SELECT id, name, price_paise FROM menu_items WHERE id = $1',
                            [item.menuItemId]
                        ));
                    }
                }

                if (!menuRows[0]) throw new Error(`ITEM_NOT_FOUND:${item.menuItemId}`);

                const linePaise = menuRows[0].price_paise * item.quantity;
                addedAmountPaise += linePaise;

                const itemStatus = canSkipKitchen ? 'served' : 'pending';
                const resolvedMenuItemId = isRestaurantItem ? item.menuItemId : null;
                await client.query(`
                    INSERT INTO table_booking_items
                        (booking_id, menu_item_id, menu_item_name, price_paise, quantity,
                         customizations, type, status, added_by)
                    VALUES ($1,$2,$3,$4,$5,$6,'post_order',$7,$8)
                `, [id, resolvedMenuItemId, menuRows[0].name, menuRows[0].price_paise,
                    item.quantity, item.customizations ?? null, itemStatus, req.user!.userId]);

                ticketItems.push({ name: menuRows[0].name, quantity: item.quantity });
            }

            await client.query(
                'UPDATE table_bookings SET post_order_amount_paise = post_order_amount_paise + $2, updated_at = NOW() WHERE id = $1',
                [id, addedAmountPaise]
            );
        });

        // Route ticket to kitchen only if items need preparation
        if (!canSkipKitchen) {
            await routeTicket(b.restaurant_id, 'table_order', {
                bookingId: id, type: 'post_order', items: ticketItems, addedAmountPaise
            });
        }

        // Notify customer that items were added (useful when waiter adds on their behalf)
        if (req.user!.role !== 'customer') {
            emitToUser(b.customer_id, 'table_booking_updated', {
                bookingId: id, event: 'items_added', items: ticketItems
            });
        }

        res.json({ success: true, addedAmountPaise });
    } catch (err: any) {
        if (err.message?.startsWith('ITEM_NOT_FOUND')) {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: err.message });
    }
});

// ── GET /table-bookings/:id/bill ──────────────────────────────────────────────
// Compute and return the full bill (called before checkout).
router.get('/:id/bill', authenticate, async (req: AuthRequest, res) => {
    const { id } = req.params;
    try {
        const { rows } = await query(`
            SELECT tb.pre_order_amount_paise, tb.post_order_amount_paise,
                   tb.total_paid_paise, tb.deposit_amount_paise, tb.status, tb.display_id,
                   tb.customer_id, tb.bill_generated_at,
                   rc.gst_percent
            FROM table_bookings tb
            JOIN restaurant_config rc ON rc.id = tb.restaurant_id
            WHERE tb.id = $1
        `, [id]);
        if (!rows[0]) return res.status(404).json({ error: 'NOT_FOUND' });
        const b = rows[0];

        if (req.user!.role === 'customer' && b.customer_id !== req.user!.userId) {
            return res.status(403).json({ error: 'FORBIDDEN' });
        }

        const subtotal = b.pre_order_amount_paise + b.post_order_amount_paise;
        const gstAmount = Math.round(subtotal * (b.gst_percent / 100));
        const grandTotal = subtotal + gstAmount;
        const outstanding = grandTotal - b.total_paid_paise;

        // Mark bill_generated_at on first fetch during seated
        if (b.status === 'seated' && !b.bill_generated_at) {
            await query(
                'UPDATE table_bookings SET gst_amount_paise = $2, bill_generated_at = NOW() WHERE id = $1',
                [id, gstAmount]
            );
        }

        const { rows: items } = await query(`
            SELECT menu_item_name, quantity, price_paise, type, status
            FROM table_booking_items WHERE booking_id = $1 ORDER BY ordered_at ASC
        `, [id]);

        res.json({
            displayId: b.display_id,
            preOrderAmountPaise: b.pre_order_amount_paise,
            postOrderAmountPaise: b.post_order_amount_paise,
            subtotalPaise: subtotal,
            gstPercent: b.gst_percent,
            gstAmountPaise: gstAmount,
            grandTotalPaise: grandTotal,
            totalPaidPaise: b.total_paid_paise,
            outstandingPaise: outstanding,
            items,
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /table-bookings/:id/pay ──────────────────────────────────────────────
// Customer pays the outstanding balance via app (wallet or Razorpay).
router.post('/:id/pay', authenticate, async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { paymentMethod = 'wallet' } = req.body as { paymentMethod?: 'wallet' | 'razorpay' };
    const customerId = req.user!.userId;

    try {
        const { rows } = await query(`
            SELECT tb.customer_id, tb.pre_order_amount_paise, tb.post_order_amount_paise,
                   tb.gst_amount_paise, tb.total_paid_paise, tb.status, tb.restaurant_id,
                   tb.display_id, rc.name AS restaurant_name
            FROM table_bookings tb
            JOIN restaurant_config rc ON rc.id = tb.restaurant_id
            WHERE tb.id = $1
        `, [id]);
        if (!rows[0]) return res.status(404).json({ error: 'NOT_FOUND' });
        const b = rows[0];

        if (b.customer_id !== customerId) return res.status(403).json({ error: 'FORBIDDEN' });
        if (b.status !== 'seated') return res.status(400).json({ error: 'BOOKING_NOT_SEATED' });

        const grandTotal = b.pre_order_amount_paise + b.post_order_amount_paise + b.gst_amount_paise;
        const outstanding = grandTotal - b.total_paid_paise;

        if (outstanding <= 0) {
            return res.status(400).json({ error: 'NOTHING_OUTSTANDING', message: 'Bill is already fully paid' });
        }

        if (paymentMethod === 'wallet') {
            await withTransaction(async (client) => {
                // Lock booking row first to prevent double-payment race
                const { rows: locked } = await client.query(`
                    SELECT pre_order_amount_paise, post_order_amount_paise,
                           gst_amount_paise, total_paid_paise, status
                    FROM table_bookings WHERE id = $1 FOR UPDATE
                `, [id]);
                if (!locked[0] || locked[0].status !== 'seated') throw new Error('BOOKING_NOT_SEATED');
                const lb = locked[0];
                const freshOutstanding = lb.pre_order_amount_paise + lb.post_order_amount_paise + lb.gst_amount_paise - lb.total_paid_paise;
                if (freshOutstanding <= 0) throw new Error('NOTHING_OUTSTANDING');

                const { rows: wallet } = await client.query(
                    'SELECT balance_paise FROM customer_wallet WHERE customer_id = $1 FOR UPDATE',
                    [customerId]
                );
                const balance = wallet[0]?.balance_paise ?? 0;
                if (balance < freshOutstanding) throw new Error('INSUFFICIENT_WALLET_BALANCE');

                await client.query(
                    'UPDATE customer_wallet SET balance_paise = balance_paise - $2 WHERE customer_id = $1',
                    [customerId, freshOutstanding]
                );
                await client.query(`
                    INSERT INTO wallet_transactions (customer_id, amount_paise, type, description, balance_after_paise)
                    SELECT $1,$2,'debit',$3,balance_paise FROM customer_wallet WHERE customer_id = $1
                `, [customerId, freshOutstanding, `Final bill at ${b.restaurant_name} (${b.display_id})`]);

                await client.query(`
                    UPDATE table_bookings
                    SET total_paid_paise = total_paid_paise + $2,
                        final_payment_method = 'app_wallet',
                        status = 'completed', completed_at = NOW(), updated_at = NOW()
                    WHERE id = $1 AND status = 'seated'
                `, [id, freshOutstanding]);

                await client.query(`
                    INSERT INTO table_booking_payments (booking_id, amount_paise, payment_method, payment_type)
                    VALUES ($1,$2,'wallet','final_settlement')
                `, [id, freshOutstanding]);
            });

            emitToUser(customerId, 'wallet_updated', {});
            emitToUser(customerId, 'table_booking_updated', { bookingId: id, status: 'completed' });
            await routeTicket(b.restaurant_id, 'table_checkout', { bookingId: id, displayId: b.display_id, method: 'app_wallet' });

            // Award loyalty points (1 point per ₹10 spent)
            const loyaltyPoints = Math.floor(grandTotal / 1000);
            if (loyaltyPoints > 0) {
                await query(
                    "INSERT INTO loyalty_transactions (customer_id, points, type) VALUES ($1,$2,'earn')",
                    [customerId, loyaltyPoints]
                );
            }

            return res.json({ success: true, outstandingPaidPaise: outstanding, loyaltyPointsEarned: loyaltyPoints });
        }

        // Razorpay payment for outstanding amount
        if (paymentMethod === 'razorpay') {
            const rzpOrder = await (razorpay.orders as any).create({
                amount: outstanding,
                currency: 'INR',
                receipt: `${b.display_id}-final`,
                notes: { bookingId: id, type: 'table_booking_final' },
            });
            return res.json({
                razorpayOrderId: rzpOrder.id,
                razorpayKeyId: process.env.RAZORPAY_KEY_ID,
                amountPaise: outstanding,
            });
        }

        res.status(400).json({ error: 'INVALID_PAYMENT_METHOD' });
    } catch (err: any) {
        if (err.message === 'INSUFFICIENT_WALLET_BALANCE') return res.status(402).json({ error: err.message });
        if (err.message === 'NOTHING_OUTSTANDING') return res.status(400).json({ error: 'NOTHING_OUTSTANDING', message: 'Bill is already fully paid' });
        if (err.message === 'BOOKING_NOT_SEATED') return res.status(400).json({ error: 'BOOKING_NOT_SEATED' });
        res.status(500).json({ error: err.message });
    }
});

// ── POST /table-bookings/:id/mark-paid ───────────────────────────────────────
// Staff marks outstanding amount as collected (cash or card at POS).
router.post('/:id/mark-paid', authenticate, async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { method } = req.body as { method: 'cash' | 'card_pos' };
    const allowedRoles = ['super_admin', 'admin', 'chef', 'kitchen_manager', 'partner', 'partner_kitchen', 'dine_in_staff'];

    if (!allowedRoles.includes(req.user!.role)) return res.status(403).json({ error: 'FORBIDDEN' });
    if (!['cash', 'card_pos'].includes(method)) return res.status(400).json({ error: 'method must be cash or card_pos' });

    try {
        // Quick existence check before acquiring lock
        const { rows: exists } = await query('SELECT id FROM table_bookings WHERE id = $1', [id]);
        if (!exists[0]) return res.status(404).json({ error: 'NOT_FOUND' });

        let b: any = null;
        let outstanding: number = 0;
        let grandTotal: number = 0;

        await withTransaction(async (client) => {
            // Lock the row to prevent concurrent /pay or mark-paid double-settling
            const { rows } = await client.query(`
                SELECT customer_id, restaurant_id, display_id,
                       pre_order_amount_paise, post_order_amount_paise,
                       gst_amount_paise, total_paid_paise, status
                FROM table_bookings WHERE id = $1 FOR UPDATE
            `, [id]);
            if (!rows[0]) throw new Error('NOT_FOUND');
            b = rows[0];

            if (b.status !== 'seated') throw new Error('BOOKING_NOT_SEATED');

            grandTotal = b.pre_order_amount_paise + b.post_order_amount_paise + b.gst_amount_paise;
            outstanding = grandTotal - b.total_paid_paise;

            if (outstanding <= 0) throw new Error('NOTHING_OUTSTANDING');

            await client.query(`
                UPDATE table_bookings
                SET total_paid_paise = total_paid_paise + $2,
                    final_payment_method = $3,
                    status = 'completed', completed_at = NOW(), updated_at = NOW()
                WHERE id = $1 AND status = 'seated'
            `, [id, outstanding, method === 'cash' ? 'cash' : 'card_pos']);

            await client.query(`
                INSERT INTO table_booking_payments
                    (booking_id, amount_paise, payment_method, payment_type, collected_by)
                VALUES ($1,$2,$3,'final_settlement',$4)
            `, [id, outstanding, method, req.user!.userId]);
        });

        // Award loyalty points
        const loyaltyPoints = Math.floor(grandTotal / 1000);
        if (loyaltyPoints > 0) {
            await query(
                "INSERT INTO loyalty_transactions (customer_id, points, type) VALUES ($1,$2,'earn')",
                [b.customer_id, loyaltyPoints]
            );
        }

        emitToUser(b.customer_id, 'table_booking_updated', { bookingId: id, status: 'completed' });
        emitToUser(b.customer_id, 'wallet_updated', {});
        NotificationService.send('broadcast_message', {
            userId: b.customer_id,
            title: 'Thanks for dining with us!',
            body: `Bill settled for ${b.display_id}. ${loyaltyPoints > 0 ? `+${loyaltyPoints} loyalty points earned!` : ''}`,
        }).catch(() => {});

        res.json({ success: true, outstandingCollectedPaise: outstanding, loyaltyPointsEarned: loyaltyPoints });
    } catch (err: any) {
        if (err.message === 'BOOKING_NOT_SEATED') return res.status(400).json({ error: 'BOOKING_NOT_SEATED' });
        if (err.message === 'NOTHING_OUTSTANDING') return res.status(400).json({ error: 'NOTHING_OUTSTANDING' });
        if (err.message === 'NOT_FOUND') return res.status(404).json({ error: 'NOT_FOUND' });
        res.status(500).json({ error: err.message });
    }
});

// ── GET /table-bookings/restaurant/:restaurantId ──────────────────────────────
// Staff / admin / partner: list all bookings for a restaurant with filters.
router.get('/restaurant/:restaurantId', authenticate, async (req: AuthRequest, res) => {
    const { restaurantId } = req.params;
    const { date, status } = req.query as { date?: string; status?: string };
    const allowedRoles = ['super_admin', 'admin', 'chef', 'kitchen_manager', 'partner', 'partner_kitchen', 'finance'];

    if (!allowedRoles.includes(req.user!.role)) return res.status(403).json({ error: 'FORBIDDEN' });

    // Partners can only see their own restaurant
    if (req.user!.role === 'partner') {
        const { rows } = await query('SELECT id FROM restaurant_config WHERE id=$1 AND partner_id=$2', [restaurantId, req.user!.userId]);
        if (!rows[0]) return res.status(403).json({ error: 'FORBIDDEN' });
    }

    try {
        const params: any[] = [restaurantId];
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
                tb.gst_amount_paise, tb.total_paid_paise, tb.deposit_amount_paise,
                tb.final_payment_method, tb.seated_at, tb.completed_at,
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

// ── POST /table-bookings/:id/item-status ──────────────────────────────────────
// Kitchen/partner marks an individual item as preparing → served.
router.post('/:id/item-status', authenticate, async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { itemId, status } = req.body as { itemId: string; status: 'preparing' | 'served' };
    const allowedRoles = ['super_admin', 'admin', 'chef', 'kitchen_manager', 'partner', 'partner_kitchen'];

    if (!allowedRoles.includes(req.user!.role)) return res.status(403).json({ error: 'FORBIDDEN' });
    if (!['preparing', 'served'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

    try {
        const { rows } = await query(`
            UPDATE table_booking_items SET status = $1
            WHERE id = $2 AND booking_id = $3
            RETURNING menu_item_name, quantity
        `, [status, itemId, id]);
        if (!rows[0]) return res.status(404).json({ error: 'NOT_FOUND' });

        const { rows: booking } = await query('SELECT customer_id FROM table_bookings WHERE id=$1', [id]);
        if (booking[0]) {
            emitToUser(booking[0].customer_id, 'table_booking_updated', {
                bookingId: id, event: 'item_status', itemId, status, itemName: rows[0].menu_item_name
            });
        }

        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /table-bookings/:id/no-show ──────────────────────────────────────────
// Admin/partner marks a booking as no-show after slot time passes.
router.post('/:id/no-show', authenticate, async (req: AuthRequest, res) => {
    const { id } = req.params;
    const allowedRoles = ['super_admin', 'admin', 'chef', 'kitchen_manager', 'partner', 'dine_in_staff'];
    if (!allowedRoles.includes(req.user!.role)) return res.status(403).json({ error: 'FORBIDDEN' });

    try {
        const restaurantFilter = req.user!.role === 'dine_in_staff'
            ? `AND restaurant_id = '${req.user!.restaurantId}'` : '';

        const { rows } = await query(`
            UPDATE table_bookings
            SET status = 'no_show', no_show_at = NOW()
            WHERE id = $1 AND status = 'confirmed' ${restaurantFilter}
            RETURNING customer_id, deposit_amount_paise, pre_order_amount_paise, display_id, restaurant_id
        `, [id]);
        if (!rows[0]) return res.status(400).json({ error: 'BOOKING_NOT_CONFIRMED' });
        const b = rows[0];

        // Pre-order is refunded to wallet; deposit is forfeited (no-show penalty)
        if (b.pre_order_amount_paise > 0) {
            await withTransaction(async (client) => {
                await client.query(`
                    INSERT INTO customer_wallet (customer_id, balance_paise) VALUES ($1,$2)
                    ON CONFLICT (customer_id) DO UPDATE SET balance_paise = customer_wallet.balance_paise + $2
                `, [b.customer_id, b.pre_order_amount_paise]);
                await client.query(`
                    INSERT INTO wallet_transactions (customer_id, amount_paise, type, description, balance_after_paise)
                    SELECT $1,$2,'credit',$3,balance_paise FROM customer_wallet WHERE customer_id=$1
                `, [b.customer_id, b.pre_order_amount_paise, `No-show refund for ${b.display_id}`]);
                await client.query(`
                    INSERT INTO table_booking_payments (booking_id, amount_paise, payment_method, payment_type, notes)
                    VALUES ($1,$2,'wallet','refund','No-show: pre-order refunded, deposit forfeited')
                `, [id, b.pre_order_amount_paise]);
            });
            emitToUser(b.customer_id, 'wallet_updated', {});
        }

        emitToUser(b.customer_id, 'table_booking_updated', { bookingId: id, status: 'no_show' });
        NotificationService.send('broadcast_message', {
            userId: b.customer_id,
            title: 'Booking Marked No-Show',
            body: b.pre_order_amount_paise > 0
                ? `Pre-order refunded to your wallet. Deposit forfeited.`
                : 'Your booking has been marked as no-show.',
        }).catch(() => {});

        res.json({ success: true, preOrderRefundedPaise: b.pre_order_amount_paise, depositForfeitedPaise: b.deposit_amount_paise });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
