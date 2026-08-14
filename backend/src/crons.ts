import cron from 'node-cron';
import { resetDailyCredits } from './services/subscription.service';
import { checkAllStockThresholds } from './services/stock.service';
import { query, withTransaction } from './db';
import { NotificationService } from './services/notification.service';
import { emitToUser, emitToAdmin } from './socket';
import { redis, keys } from './redis';
import { haversineMetres } from './services/distance.service';
import { generateKitchenPayout } from './services/kitchen-payout.service';

// NOTE: this is a SEPARATE module from src/crons/index.ts (same base name, one is a
// file and one is a directory) — Node resolves `./crons` to this file before it ever
// looks at `./crons/index.ts`. The two used to be initialized from two different-looking
// imports in src/index.ts that both got called, which looked like (and was diagnosed as)
// "the same cron job running twice" — it wasn't; these are 12 entirely different jobs
// plus the auto-dispatch interval below, all of which are real, needed functionality
// (booking reminders, mission assignment, loyalty expiry, weekly payout reconciliation).
// Both this file and src/crons/index.ts are now only ever initialized from
// src/worker.ts, the singleton worker process — see that file.

let cronsInitialized = false;
let autoDispatchInterval: ReturnType<typeof setInterval> | undefined;

export const initCrons = () => {
    if (cronsInitialized) {
        console.warn('[CRON] initCrons() (crons.ts) called again in this process — ignoring.');
        return;
    }
    cronsInitialized = true;
    console.log('Crons initialized.');

    // 06:00 AM - Reset Daily Subscription Credits
    cron.schedule('0 6 * * *', async () => {
        try {
            await resetDailyCredits();
        } catch (err) {
            console.error('[CRON] Credit reset failed:', err);
        }
    });

    // 00:00 AM - Midnight Audits
    cron.schedule('0 0 * * *', async () => {
        try {
            console.log('[CRON] Running midnight audits...');
            
            // 1. Check Stock
            await checkAllStockThresholds();

            // 2. Generate Daily Financial Log for yesterday
            // Revenue from orders table (not joined to items to avoid row multiplication).
            // Cost from order_items × quantity × unit cost (LEFT JOIN handles deleted menu items).
            const { rows: totals } = await query(`
                SELECT
                    (SELECT COALESCE(SUM(total_amount_paise), 0)
                     FROM orders
                     WHERE status = 'delivered'
                       AND updated_at >= CURRENT_DATE - INTERVAL '1 day'
                       AND updated_at <  CURRENT_DATE
                    ) AS revenue,
                    (SELECT COALESCE(SUM(COALESCE(mi.cost_price_paise, 0) * oi.quantity), 0)
                     FROM orders o
                     LEFT JOIN order_items oi ON oi.order_id = o.id
                     LEFT JOIN menu_items  mi ON mi.id = oi.menu_item_id
                     WHERE o.status = 'delivered'
                       AND o.updated_at >= CURRENT_DATE - INTERVAL '1 day'
                       AND o.updated_at <  CURRENT_DATE
                    ) AS cost
            `);

            await query(`
                INSERT INTO daily_financial_log (date, total_revenue_paise, total_expenses_paise, net_profit_paise)
                VALUES (CURRENT_DATE - interval '1 day', $1, $2, $3)
                ON CONFLICT (date) DO NOTHING
            `, [totals[0].revenue, totals[0].cost, totals[0].revenue - totals[0].cost]);

        } catch (err) {
            console.error('[CRON] Midnight audit failed:', err);
        }
    });

    // Every 5 mins - Check for unassigned orders
    cron.schedule('*/5 * * * *', async () => {
        try {
            const { rows } = await query("SELECT count(*) FROM orders WHERE status = 'confirmed' AND created_at < NOW() - interval '10 minutes'");
            if (parseInt(rows[0].count) > 0) {
                console.log(`[ALERT] There are ${rows[0].count} unassigned orders older than 10 mins!`);
            }
        } catch (err) {
            console.error('[CRON] Unassigned order check failed:', err);
        }
    });

    // Every 10 mins - Send 24h booking reminders
    cron.schedule('*/10 * * * *', async () => {
        try {
            const { rows } = await query(`
                SELECT tb.id, tb.customer_id, tb.slot_start, rc.name AS restaurant_name
                FROM table_bookings tb
                JOIN restaurant_config rc ON rc.id = tb.restaurant_id
                WHERE tb.status = 'confirmed'
                  AND tb.slot_start BETWEEN NOW() + interval '23 hours 50 minutes'
                                        AND NOW() + interval '24 hours 10 minutes'
                  AND tb.reminder_24h_sent_at IS NULL
            `);
            for (const b of rows) {
                const timeStr = new Date(b.slot_start).toLocaleString('en-IN', {
                    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit',
                    day: 'numeric', month: 'short',
                });
                await NotificationService.send('broadcast_message', {
                    userId: b.customer_id,
                    title: 'Table Booking Tomorrow',
                    body: `Reminder: Your table at ${b.restaurant_name} is booked for ${timeStr}. See you then!`,
                    screen: 'TableBookingDetail',
                    bookingId: b.id,
                }).catch(() => {});
                await query('UPDATE table_bookings SET reminder_24h_sent_at = NOW() WHERE id = $1', [b.id]);
            }
            if (rows.length > 0) console.log(`[CRON] Sent 24h reminders for ${rows.length} bookings`);
        } catch (err) {
            console.error('[CRON] 24h reminder failed:', err);
        }
    });

    // Every 10 mins - Send 2h booking reminders
    cron.schedule('*/10 * * * *', async () => {
        try {
            const { rows } = await query(`
                SELECT tb.id, tb.customer_id, tb.slot_start, rc.name AS restaurant_name, rc.address
                FROM table_bookings tb
                JOIN restaurant_config rc ON rc.id = tb.restaurant_id
                WHERE tb.status = 'confirmed'
                  AND tb.slot_start BETWEEN NOW() + interval '1 hour 50 minutes'
                                        AND NOW() + interval '2 hours 10 minutes'
                  AND tb.reminder_2h_sent_at IS NULL
            `);
            for (const b of rows) {
                const timeStr = new Date(b.slot_start).toLocaleString('en-IN', {
                    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit',
                });
                await NotificationService.send('broadcast_message', {
                    userId: b.customer_id,
                    title: 'Your table is in 2 hours!',
                    body: `Get ready — ${b.restaurant_name} at ${timeStr}. Don't forget your QR code!`,
                    screen: 'TableBookingDetail',
                    bookingId: b.id,
                }).catch(() => {});
                await query('UPDATE table_bookings SET reminder_2h_sent_at = NOW() WHERE id = $1', [b.id]);
            }
            if (rows.length > 0) console.log(`[CRON] Sent 2h reminders for ${rows.length} bookings`);
        } catch (err) {
            console.error('[CRON] 2h reminder failed:', err);
        }
    });

    // 00:01 daily — Assign daily missions to all active riders
    cron.schedule('1 0 * * *', async () => {
        try {
            const { rowCount } = await query(`
                INSERT INTO rider_missions (rider_id, template_id, date)
                SELECT u.id, mt.id, CURRENT_DATE
                FROM users u
                CROSS JOIN mission_templates mt
                WHERE u.role IN ('rider','rider_captain')
                  AND mt.is_active = true
                  AND mt.window_type = 'daily'
                  AND (mt.zone_id IS NULL OR mt.zone_id = u.zone_id)
                ON CONFLICT (rider_id, template_id, date) DO NOTHING
            `);
            console.log(`[CRON] Daily missions assigned: ${rowCount} rows`);
        } catch (err) {
            console.error('[CRON] Daily mission assignment failed:', err);
        }
    });

    // 00:01 every Monday IST — Assign weekly missions
    cron.schedule('1 0 * * 1', async () => {
        try {
            const { rowCount } = await query(`
                INSERT INTO rider_missions (rider_id, template_id, date)
                SELECT u.id, mt.id, date_trunc('week', CURRENT_DATE)::date
                FROM users u
                CROSS JOIN mission_templates mt
                WHERE u.role IN ('rider','rider_captain')
                  AND mt.is_active = true
                  AND mt.window_type = 'weekly'
                  AND (mt.zone_id IS NULL OR mt.zone_id = u.zone_id)
                ON CONFLICT (rider_id, template_id, date) DO NOTHING
            `);
            console.log(`[CRON] Weekly missions assigned: ${rowCount} rows`);
        } catch (err) {
            console.error('[CRON] Weekly mission assignment failed:', err);
        }
    });

    // Monday 10:00 AM IST (04:30 UTC) - Weekly rider payout
    cron.schedule('30 4 * * 1', async () => {
        try {
            console.log('[CRON] Starting weekly rider payouts...');

            // Compute week window: last Monday 00:00 to this Monday 00:00 IST
            const { rows: riders } = await query(`
                SELECT
                    u.id AS rider_id,
                    u.upi_id,
                    u.bank_account_number,
                    u.bank_ifsc,
                    u.bank_account_name,
                    u.payout_method,
                    COALESCE(SUM(rde.total_paise), 0)::int        AS total_earned_paise,
                    COALESCE(settled.settled_paise, 0)::int        AS settled_paise
                FROM users u
                JOIN rider_daily_earnings rde ON rde.rider_id = u.id
                LEFT JOIN (
                    SELECT rider_id, SUM(net_amount_paise) AS settled_paise
                    FROM weekly_payouts WHERE status IN ('paid', 'pending', 'approved')
                    GROUP BY rider_id
                ) settled ON settled.rider_id = u.id
                WHERE u.role IN ('rider', 'rider_captain')
                GROUP BY u.id, u.upi_id, u.bank_account_number, u.bank_ifsc, u.bank_account_name, u.payout_method, settled.settled_paise
                HAVING COALESCE(SUM(rde.total_paise), 0) - COALESCE(settled.settled_paise, 0) >= 10000
            `);

            if (riders.length === 0) {
                console.log('[CRON] Weekly payouts: no riders with ≥₹100 pending');
                return;
            }

            // Monday of this week (IST) as week_start; Sunday as week_end
            const now = new Date();
            const monday = new Date(now);
            monday.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7));
            monday.setUTCHours(0, 0, 0, 0);
            const sunday = new Date(monday);
            sunday.setUTCDate(monday.getUTCDate() + 6);
            const weekStart = monday.toISOString().slice(0, 10);
            const weekEnd = sunday.toISOString().slice(0, 10);

            for (const r of riders) {
                const pending = r.total_earned_paise - r.settled_paise;
                const hasPayoutMethod = r.payout_method === 'bank'
                    ? !!(r.bank_account_number && r.bank_ifsc)
                    : !!r.upi_id;

                try {
                    await query(`
                        INSERT INTO weekly_payouts
                          (rider_id, week_start, week_end, gross_earnings_paise, net_amount_paise, status, payout_mode, payout_method)
                        VALUES ($1, $2, $3, $4, $4, $5, 'auto', $6)
                        ON CONFLICT DO NOTHING
                    `, [
                        r.rider_id, weekStart, weekEnd, pending,
                        hasPayoutMethod ? 'pending' : 'pending',
                        r.payout_method || 'upi',
                    ]);

                    await NotificationService.send('broadcast_message', {
                        userId: r.rider_id,
                        title: 'Weekly Payout Initiated',
                        body: `₹${(pending / 100).toFixed(0)} payout for this week is being processed${hasPayoutMethod ? '' : '. Add your UPI/bank details to receive it'}.`,
                        screen: 'Payouts',
                    }).catch(() => {});

                    console.log(`[CRON] Payout created for rider ${r.rider_id}: ₹${(pending / 100).toFixed(0)} via ${r.payout_method}`);
                } catch (innerErr) {
                    console.error(`[CRON] Payout failed for rider ${r.rider_id}:`, innerErr);
                }
            }

            console.log(`[CRON] Weekly payouts done: ${riders.length} riders processed`);
        } catch (err) {
            console.error('[CRON] Weekly payout cron failed:', err);
        }
    });

    // Monday 11:00 AM IST (05:30 UTC) - Weekly kitchen payout generation
    cron.schedule('30 5 * * 1', async () => {
        try {
            console.log('[CRON] Starting weekly kitchen payout generation...');

            const now = new Date();
            // Previous week: Mon–Sun in IST (UTC+5:30)
            const todayMonday = new Date(now);
            todayMonday.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7));
            todayMonday.setUTCHours(0, 0, 0, 0);
            const lastMonday = new Date(todayMonday);
            lastMonday.setUTCDate(todayMonday.getUTCDate() - 7);
            const lastSunday = new Date(todayMonday);
            lastSunday.setUTCDate(todayMonday.getUTCDate() - 1);
            const periodStart = lastMonday.toISOString().slice(0, 10);
            const periodEnd   = lastSunday.toISOString().slice(0, 10);

            const { rows: kitchens } = await query(`
                SELECT id, name FROM kitchens WHERE is_partner = TRUE AND is_active = TRUE
            `);

            let generated = 0;
            for (const k of kitchens) {
                try {
                    // generateKitchenPayout nets this week's revenue against anything
                    // already paid for a period overlapping this week — including every
                    // night's daily auto-payout (src/crons/index.ts) for kitchens with
                    // auto_payout_enabled=TRUE. A kitchen paid daily all week nets to ~0
                    // and no duplicate weekly payout is created; a kitchen with a partial
                    // week of daily payouts (e.g. it enabled auto-pay mid-week) gets a
                    // weekly payout for exactly the remainder. See that service for why.
                    const result = await generateKitchenPayout(k.id, periodStart, periodEnd);
                    if (result.created) {
                        generated++;
                        console.log(`[CRON] Kitchen payout generated for ${k.name}: ₹${(result.netPayoutPaise / 100).toFixed(0)}`);
                    } else if (result.reason === 'already_covered') {
                        console.log(`[CRON] Kitchen ${k.name}: week already covered by daily/prior payouts — no weekly payout needed`);
                    }
                } catch (innerErr) {
                    console.error(`[CRON] Kitchen payout failed for ${k.id}:`, innerErr);
                }
            }

            console.log(`[CRON] Kitchen payouts done: ${generated}/${kitchens.length} generated`);
        } catch (err) {
            console.error('[CRON] Weekly kitchen payout cron failed:', err);
        }
    });

    // Daily 09:00 AM IST (03:30 UTC) - Warn customers whose loyalty points expire within 7 days
    cron.schedule('30 3 * * *', async () => {
        try {
            // Find distinct customers with earn points expiring in 1–7 days
            const { rows: expiring } = await query(`
                SELECT
                    lt.customer_id,
                    SUM(lt.points) AS expiring_points,
                    MIN(lt.expires_at) AS earliest_expiry
                FROM loyalty_transactions lt
                WHERE lt.type = 'earn'
                  AND lt.expires_at > NOW()
                  AND lt.expires_at <= NOW() + INTERVAL '7 days'
                  AND NOT EXISTS (
                      SELECT 1 FROM loyalty_transactions lt2
                      WHERE lt2.customer_id = lt.customer_id
                        AND lt2.type = 'expiry_warned'
                        AND lt2.expires_at::date = lt.expires_at::date
                  )
                GROUP BY lt.customer_id
            `);

            for (const row of expiring) {
                const daysLeft = Math.ceil(
                    (new Date(row.earliest_expiry).getTime() - Date.now()) / 86_400_000
                );
                await NotificationService.send('broadcast_message', {
                    userId: row.customer_id,
                    title: 'Your loyalty points are expiring soon!',
                    body: `${row.expiring_points} points expire in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Use them before they're gone!`,
                    screen: 'Loyalty',
                }).catch(() => {});

                // Mark warned so we don't spam the same customer again this expiry cycle
                await query(`
                    INSERT INTO loyalty_transactions (customer_id, points, type, expires_at)
                    VALUES ($1, 0, 'expiry_warned', $2)
                `, [row.customer_id, row.earliest_expiry]);
            }

            if (expiring.length) {
                console.log(`[CRON] Loyalty expiry warnings sent: ${expiring.length} customers`);
            }
        } catch (err) {
            console.error('[CRON] Loyalty expiry warning cron failed:', err);
        }
    });

    // Daily 00:30 UTC (6 AM IST) - Expire loyalty points and notify customers
    // Balance queries already filter expires_at > NOW() so no balance update needed.
    // This cron fires post-expiry notifications and creates sentinel 'expire' records
    // (points=0) so we don't notify the same batch twice.
    cron.schedule('30 0 * * *', async () => {
        try {
            const { rows: justExpired } = await query(`
                SELECT
                    lt.customer_id,
                    SUM(lt.points) AS expired_points,
                    lt.expires_at::date AS expiry_date
                FROM loyalty_transactions lt
                WHERE lt.type = 'earn'
                  AND lt.expires_at <= NOW()
                  AND lt.expires_at > NOW() - INTERVAL '25 hours'
                  AND NOT EXISTS (
                      SELECT 1 FROM loyalty_transactions lt2
                      WHERE lt2.customer_id = lt.customer_id
                        AND lt2.type = 'expire'
                        AND lt2.expires_at::date = lt.expires_at::date
                  )
                GROUP BY lt.customer_id, lt.expires_at::date
            `);

            for (const row of justExpired) {
                // Sentinel record — prevents duplicate processing, balance unaffected (points=0)
                await query(`
                    INSERT INTO loyalty_transactions (customer_id, points, type, description, expires_at)
                    VALUES ($1, 0, 'expire', $2, $3)
                `, [
                    row.customer_id,
                    `${row.expired_points} loyalty points expired`,
                    row.expiry_date,
                ]);

                await NotificationService.send('broadcast_message', {
                    userId: row.customer_id,
                    title: 'Loyalty points expired',
                    body: `${row.expired_points} points expired. Earn more with your next order!`,
                    screen: 'Loyalty',
                }).catch(() => {});
            }

            if (justExpired.length) {
                console.log(`[CRON] Loyalty expiry notifications sent: ${justExpired.length} customers`);
            }
        } catch (err) {
            console.error('[CRON] Loyalty expiry cron failed:', err);
        }
    });

    // Every 15 mins - Auto mark no-show for confirmed bookings whose slot has ended
    cron.schedule('*/15 * * * *', async () => {
        try {
            const { rows: expired } = await query(`
                SELECT tb.id, tb.customer_id, tb.pre_order_amount_paise, tb.display_id,
                       rc.name AS restaurant_name
                FROM table_bookings tb
                JOIN restaurant_config rc ON rc.id = tb.restaurant_id
                WHERE tb.status = 'confirmed'
                  AND tb.slot_end < NOW() - interval '5 minutes'
            `);

            for (const b of expired) {
                try {
                    await withTransaction(async (client) => {
                        await client.query(
                            "UPDATE table_bookings SET status='no_show', no_show_at=NOW() WHERE id=$1 AND status='confirmed'",
                            [b.id]
                        );
                        if (b.pre_order_amount_paise > 0) {
                            await client.query(`
                                INSERT INTO customer_wallet (customer_id, balance_paise) VALUES ($1,$2)
                                ON CONFLICT (customer_id) DO UPDATE SET balance_paise = customer_wallet.balance_paise + $2
                            `, [b.customer_id, b.pre_order_amount_paise]);
                            await client.query(`
                                INSERT INTO wallet_transactions (customer_id, amount_paise, type, description, balance_after_paise)
                                SELECT $1,$2,'credit',$3,balance_paise FROM customer_wallet WHERE customer_id=$1
                            `, [b.customer_id, b.pre_order_amount_paise, `No-show refund for ${b.display_id} at ${b.restaurant_name}`]);
                        }
                    });
                    emitToUser(b.customer_id, 'table_booking_updated', { bookingId: b.id, status: 'no_show' });
                    if (b.pre_order_amount_paise > 0) {
                        emitToUser(b.customer_id, 'wallet_updated', {});
                        await NotificationService.send('broadcast_message', {
                            userId: b.customer_id,
                            title: 'Booking Marked No-Show',
                            body: `Pre-order of ₹${(b.pre_order_amount_paise / 100).toFixed(0)} refunded. Deposit forfeited.`,
                            screen: 'TableBookingDetail',
                            bookingId: b.id,
                        }).catch(() => {});
                    }
                } catch (innerErr) {
                    console.error(`[CRON] No-show for ${b.id} failed:`, innerErr);
                }
            }
            if (expired.length > 0) console.log(`[CRON] Auto no-show marked for ${expired.length} bookings`);
        } catch (err) {
            console.error('[CRON] Auto no-show cron failed:', err);
        }
    });

    // Every 15 mins — SLA breach escalation
    cron.schedule('*/15 * * * *', async () => {
        try {
            // Find tickets past sla_deadline that aren't resolved/closed
            const { rows: breached } = await query(`
                SELECT id, subject, priority
                FROM support_tickets
                WHERE sla_deadline < NOW()
                  AND status NOT IN ('resolved', 'closed')
                  AND priority != 'critical'
            `);

            if (breached.length === 0) return;

            const priorityUp: Record<string, string> = {
                normal: 'high',
                high: 'critical',
                low: 'normal',
            };

            for (const ticket of breached) {
                const newPriority = priorityUp[ticket.priority] ?? ticket.priority;
                if (newPriority === ticket.priority) continue;

                await query(
                    `UPDATE support_tickets SET priority = $1, updated_at = NOW() WHERE id = $2`,
                    [newPriority, ticket.id]
                );

                emitToAdmin('ticket_sla_breach', {
                    ticketId: ticket.id,
                    subject: ticket.subject,
                    newPriority,
                });
            }

            console.log(`[CRON] SLA escalation: ${breached.length} ticket(s) escalated`);
        } catch (err) {
            console.error('[CRON] SLA breach escalation failed:', err);
        }
    });

    // --- Strict Auto-Dispatch Engine ---
    // Runs every 30 seconds to intelligently batch and assign orders
    let autoDispatchRunning = false;
    autoDispatchInterval = setInterval(async () => {
        if (autoDispatchRunning) return;
        autoDispatchRunning = true;
        try {
            // Check if enabled
            const { rows: settings } = await query("SELECT key, value FROM app_settings WHERE key IN ('auto_dispatch_enabled', 'max_batch_size')");
            const enabledSetting = settings.find(s => s.key === 'auto_dispatch_enabled');
            if (!enabledSetting || enabledSetting.value !== 'true') return;

            const batchSetting = settings.find(s => s.key === 'max_batch_size');
            const maxBatchSize = batchSetting ? parseInt(batchSetting.value, 10) || 1 : 1;

            // Fetch unassigned ready orders
            const { rows: orders } = await query(`
                SELECT o.id, o.display_id, o.kitchen_id, o.zone_id, o.address_id,
                       a.lat AS customer_lat, a.lng AS customer_lng, a.address_text AS delivery_address,
                       k.lat AS kitchen_lat, k.lng AS kitchen_lng
                FROM orders o
                JOIN addresses a ON o.address_id = a.id
                JOIN kitchens k ON o.kitchen_id = k.id
                WHERE o.status IN ('confirmed', 'preparing', 'ready_for_pickup') AND o.rider_id IS NULL
                ORDER BY o.created_at ASC
            `);

            if (orders.length === 0) return;

            // Group by Kitchen ID (batching should only happen per-kitchen)
            const kitchens = [...new Set(orders.map(o => o.kitchen_id))];

            for (const kId of kitchens) {
                const kOrders = orders.filter(o => o.kitchen_id === kId);
                const batches: any[] = [];
                
                if (maxBatchSize > 1) {
                    for (const order of kOrders) {
                        let placed = false;
                        for (const batch of batches) {
                            if (batch.orders.length < maxBatchSize) {
                                const firstOrder = batch.orders[0];
                                const dist = haversineMetres(
                                    parseFloat(order.customer_lat), parseFloat(order.customer_lng),
                                    parseFloat(firstOrder.customer_lat), parseFloat(firstOrder.customer_lng)
                                );
                                if (dist <= 1500) {
                                    batch.orders.push(order);
                                    placed = true;
                                    break;
                                }
                            }
                        }
                        if (!placed) batches.push({ orders: [order] });
                    }
                } else {
                    for (const order of kOrders) { batches.push({ orders: [order] }); }
                }

                // For each batch, find the best rider
                for (const batch of batches) {
                    const firstOrder = batch.orders[0];
                    const kLat = parseFloat(firstOrder.kitchen_lat);
                    const kLng = parseFloat(firstOrder.kitchen_lng);

                    const { rows: riders } = await query(`
                        SELECT u.id,
                               (SELECT count(*) FROM orders o WHERE o.rider_id = u.id AND o.status NOT IN ('delivered', 'cancelled')) as active_count
                        FROM users u
                        WHERE u.role IN ('rider', 'rider_captain', 'super_admin') AND u.is_online = true
                    `);

                    let bestRiderId = null;
                    let bestScore = -Infinity;

                    for (const rider of riders) {
                        // For strict V1: Only assign to fully idle riders
                        if (parseInt(rider.active_count) > 0) continue;

                        const locStr = await redis.get(keys.riderLocation(rider.id));
                        if (!locStr) continue;

                        try {
                            const loc = JSON.parse(locStr);
                            const distFromKitchen = haversineMetres(kLat, kLng, loc.lat, loc.lng);
                            
                            // Base score is negative distance (closer = higher score)
                            let score = -distFromKitchen;

                            if (score > bestScore) {
                                bestScore = score;
                                bestRiderId = rider.id;
                            }
                        } catch (e) {}
                    }

                    if (bestRiderId) {
                        // Atomically assign the whole batch
                        console.log(`[CRON] Auto-Assigning batch of ${batch.orders.length} to rider ${bestRiderId}`);
                        for (const order of batch.orders) {
                            const { rowCount } = await query(`
                                UPDATE orders SET rider_id = $1
                                WHERE id = $2 AND rider_id IS NULL AND status IN ('confirmed', 'preparing', 'ready_for_pickup')
                            `, [bestRiderId, order.id]);

                            if ((rowCount ?? 0) > 0) {
                                emitToUser(bestRiderId, 'order_auto_assigned', {
                                    orderId: order.id,
                                    displayId: order.display_id,
                                    assignedBy: 'system',
                                    deliveryAddress: order.delivery_address || null,
                                });
                                // Legacy fallback
                                await query('UPDATE users SET current_order_id = NULL WHERE id = $1', [bestRiderId]);
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.error('[CRON] Auto-dispatch engine error:', e);
        } finally {
            autoDispatchRunning = false;
        }
    }, 30000);
};

// Called by the worker process on SIGTERM/SIGINT.
export const stopCrons = () => {
    for (const task of cron.getTasks().values()) {
        task.stop();
    }
    if (autoDispatchInterval) {
        clearInterval(autoDispatchInterval);
        autoDispatchInterval = undefined;
    }
    cronsInitialized = false;
    console.log('[CRON] (crons.ts) All scheduled jobs stopped.');
};
