import cron from 'node-cron';
import { resetDailyCredits } from './services/subscription.service';
import { checkAllStockThresholds } from './services/stock.service';
import { query, withTransaction } from './db';
import { NotificationService } from './services/notification.service';
import { emitToUser } from './socket';

export const initCrons = () => {
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

            // 2. Generate Daily Financial Log
            // This is a simple version - real one would sum all payments/expenses
            const { rows: totals } = await query(`
                SELECT 
                    COALESCE(SUM(total_amount_paise), 0) as revenue,
                    COALESCE(SUM(cost_price_paise), 0) as cost
                FROM orders o
                JOIN order_items oi ON o.id = oi.order_id
                JOIN menu_items mi ON oi.menu_item_id = mi.id
                WHERE o.status = 'delivered' AND o.created_at >= CURRENT_DATE - interval '1 day'
            `);

            await query(`
                INSERT INTO daily_financial_log (date, total_revenue_paise, total_expenses_paise, net_profit_paise)
                VALUES (CURRENT_DATE - interval '1 day', $1, $2, $3)
            `, [totals[0].revenue, totals[0].cost, totals[0].revenue - totals[0].cost]);

        } catch (err) {
            console.error('[CRON] Midnight audit failed:', err);
        }
    });

    // Every 5 mins - Check for unassigned orders
    cron.schedule('*/5 * * * *', async () => {
        const { rows } = await query("SELECT count(*) FROM orders WHERE status = 'confirmed' AND created_at < NOW() - interval '10 minutes'");
        if (parseInt(rows[0].count) > 0) {
            console.log(`[ALERT] There are ${rows[0].count} unassigned orders older than 10 mins!`);
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
};
