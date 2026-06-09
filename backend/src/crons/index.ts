import cron from 'node-cron';
import { query, withTransaction } from '../db';
import { notificationsQueue } from '../jobs/queues';
import { 2QT } from '../config/constants';
import { emitToKitchen, emitToAdmin, emitToRiders } from '../socket';

export const initCrons = () => {
    // Daily limit reset at midnight
    cron.schedule('0 0 * * *', async () => {
        console.log('[CRON] Resetting daily limits...');
        await query(`
            UPDATE menu_items 
            SET today_sold_count = 0, 
                available = true 
            WHERE sold_out_reason = 'daily_limit_reached'
        `);
        // Note: also clear sold_out_reason where it was daily_limit_reached
        await query(`
            UPDATE menu_items 
            SET sold_out_reason = NULL 
            WHERE sold_out_reason = 'daily_limit_reached'
        `);

        // Reset subscription daily credits
        console.log('[CRON] Resetting subscription daily credits...');
        await query(`
            UPDATE subscriptions 
            SET current_day_credits = 1 
            WHERE is_active = true AND status = 'active'
        `);
    });

    // Rider guarantee top-up at 11:30pm
    cron.schedule('30 23 * * *', async () => {
        console.log('[CRON] Processing rider guarantee top-ups...');
        const { rows: riders } = await query(`
            SELECT rider_id, total_paise, online_minutes 
            FROM rider_daily_earnings 
            WHERE date = CURRENT_DATE 
            AND online_minutes >= $1
            AND total_paise < $2
        `, [2QT.RIDER.GUARANTEE_MIN_ONLINE_HOURS * 60, 2QT.RIDER.GUARANTEE_MINIMUM_PAISE]);

        for (const rider of riders) {
            const topup = 2QT.RIDER.GUARANTEE_MINIMUM_PAISE - rider.total_paise;
            if (topup > 0) {
                console.log(`[CRON] Topping up rider ${rider.rider_id} with Rs. ${topup/100}`);
                await withTransaction(async (client) => {
                    await client.query(`
                        UPDATE rider_daily_earnings 
                        SET guarantee_topup_paise = guarantee_topup_paise + $1,
                            total_paise = total_paise + $1
                        WHERE rider_id = $2 AND date = CURRENT_DATE
                    `, [topup, rider.rider_id]);
                    
                    // Also notify the rider
                    await notificationsQueue.add('rider_guarantee_payout', { 
                        riderId: rider.rider_id, 
                        amountPaise: topup 
                    });
                });
            }
        }
    });

    // Subscription expiry check at 9am
    cron.schedule('0 9 * * *', async () => {
        console.log('[CRON] Checking subscription expiries...');
        // Logic for 7, 3, 1 day reminders
    });

    // Scheduled order processor every 15 minutes
    cron.schedule('*/15 * * * *', async () => {
        console.log('[CRON] Processing scheduled orders...');
        const leadTimeMinutes = 45; // Prepare orders 45 mins before scheduled time
        
        const { rows: scheduled } = await query(`
            SELECT * FROM scheduled_orders 
            WHERE status = 'scheduled' 
            AND scheduled_for <= NOW() + INTERVAL '1 minute' * $1
            AND (payment_status = 'paid' OR payment_method = 'cod')
        `, [leadTimeMinutes]);

        for (const s of scheduled) {
            console.log(`[CRON] Activating scheduled order: ${s.id}`);
            try {
                await withTransaction(async (client) => {
                    // 1. Find a suitable kitchen in the zone (for now, pick first one or based on load)
                    const { rows: kitchens } = await client.query('SELECT id FROM kitchens WHERE zone_id = $1 AND is_active = true LIMIT 1', [s.zone_id]);
                    const kitchenId = kitchens[0]?.id;
                    if (!kitchenId) throw new Error('NO_KITCHEN_IN_ZONE');

                    // 2. Create actual order
                    const { rows: orderRows } = await client.query(`
                        INSERT INTO orders (
                            customer_id, kitchen_id, zone_id, address_id, 
                            status, payment_method, payment_status,
                            subtotal_paise, delivery_fee_paise, total_amount_paise,
                            cgst_paise, sgst_paise, gateway_amount_paise,
                            is_scheduled, scheduled_for
                        ) VALUES ($1, $2, $3, $4, 'confirmed', $5, $6, $7, $8, $9, $10, $11, $12, true, $13)
                        RETURNING id, display_id
                    `, [
                        s.customer_id, kitchenId, s.zone_id, s.address_id,
                        s.payment_method, s.payment_status,
                        s.subtotal_paise, s.delivery_fee_paise, s.total_paise,
                        0, 0, s.payment_method === 'cod' ? 0 : s.total_paise,
                        s.scheduled_for
                    ]);
                    const orderId = orderRows[0].id;
                    const displayId = orderRows[0].display_id;

                    // 3. Create items
                    for (const item of s.items) {
                        const { rows: menuItems } = await client.query('SELECT name, price_paise FROM menu_items WHERE id = $1', [item.menuItemId]);
                        const mi = menuItems[0];
                        await client.query(`
                            INSERT INTO order_items (order_id, menu_item_id, menu_item_name, quantity, price_paise)
                            VALUES ($1, $2, $3, $4, $5)
                        `, [orderId, item.menuItemId, mi.name, item.quantity, mi.price_paise]);
                    }

                    // 4. Mark scheduled order as converted
                    await client.query('UPDATE scheduled_orders SET status = \'confirmed\', actual_order_id = $1 WHERE id = $2', [orderId, s.id]);

                    // SYSTEMATIC INTEGRATION: Notify Kitchen and Rider Pool
                    emitToKitchen(kitchenId, 'new_order', { orderId, displayId });
                    emitToRiders('new_available_mission', { orderId, displayId, zoneId: s.zone_id }, s.zone_id);
                });
            } catch (err) {
                console.error(`[CRON_ERROR] Failed to convert scheduled order ${s.id}:`, err);
                await query('UPDATE scheduled_orders SET status = \'failed\' WHERE id = $1', [s.id]);
            }
        }
    });

    // No-rider alert every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
        console.log('[CRON] Checking for orders with no rider...');
        const { rows: stuckOrders } = await query(`
            SELECT id, display_id FROM orders 
            WHERE status = 'confirmed' 
            AND rider_id IS NULL 
            AND created_at < NOW() - INTERVAL '10 minutes'
        `);

        for (const order of stuckOrders) {
            console.log(`[ALERT] Order ${order.display_id} has no rider for 10+ mins!`);
            emitToAdmin('critical_alert', {
                type: 'NO_RIDER',
                orderId: order.id,
                displayId: order.display_id,
                message: 'No rider assigned for 10+ minutes'
            });
        }
    });

    // Weekly payout generator at 6am Monday
    cron.schedule('0 6 * * 1', async () => {
        console.log('[CRON] Generating weekly payouts...');
        const { rows: riders } = await query("SELECT id FROM users WHERE role = 'rider'");
        
        for (const rider of riders) {
            await withTransaction(async (client) => {
                // Calculate previous week's earnings (Mon-Sun)
                const { rows: earnings } = await client.query(`
                    SELECT COALESCE(SUM(total_paise), 0) as total,
                           COALESCE(SUM(cash_collected_paise), 0) as cash
                    FROM rider_daily_earnings 
                    WHERE rider_id = $1 
                    AND date >= CURRENT_DATE - INTERVAL '7 days'
                    AND date < CURRENT_DATE
                `, [rider.id]);

                const gross = parseInt(earnings[0].total);
                const cash = parseInt(earnings[0].cash);
                const net = Math.max(0, gross - cash);

                if (net > 0) {
                    await client.query(`
                        INSERT INTO weekly_payouts (
                            rider_id, week_start, week_end, 
                            gross_earnings_paise, cash_collected_paise, net_amount_paise, 
                            status
                        ) VALUES ($1, CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE - INTERVAL '1 day', $2, $3, $4, 'pending')
                    `, [rider.id, gross, cash, net]);
                }
            });
        }
    });

    // Update scheduled marketing campaigns status every minute
    cron.schedule('* * * * *', async () => {
        const { rowCount } = await query(`
            UPDATE marketing_campaigns
            SET status = 'completed'
            WHERE status = 'scheduled' AND scheduled_for <= NOW()
        `);
        if (rowCount && rowCount > 0) {
            console.log(`[CRON] Updated ${rowCount} marketing campaigns to completed`);
        }
    });

    console.log('Crons initialized.');
};
