import cron from 'node-cron';
import { query, withTransaction } from '../db';
import { notificationsQueue } from '../jobs/queues';
import { TWO_QT } from '../config/constants';
import { emitToKitchen, emitToAdmin, emitToRiders } from '../socket';
import {
    ensureKitchenFundAccount, ensureRiderFundAccount,
    firePayout, isAutoPayConfigured,
} from '../services/razorpay-payout.service';
import { processDueTriggerJobs, runDailyTriggers } from '../services/trigger.service';

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
        `, [TWO_QT.RIDER.GUARANTEE_MIN_ONLINE_HOURS * 60, TWO_QT.RIDER.GUARANTEE_MINIMUM_PAISE]);

        for (const rider of riders) {
            const topup = TWO_QT.RIDER.GUARANTEE_MINIMUM_PAISE - rider.total_paise;
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
                    notificationsQueue.add('rider_guarantee_payout', { 
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
            WHERE status = 'ready_for_pickup'
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
                    SELECT COALESCE(SUM(deliveries_count), 0) as deliveries_count,
                           COALESCE(SUM(base_earnings_paise), 0) as base,
                           COALESCE(SUM(bonus_earnings_paise + COALESCE(rain_bonus_paise, 0) + COALESCE(guarantee_topup_paise, 0)), 0) as bonus,
                           COALESCE(SUM(cash_collected_paise), 0) as cash
                    FROM rider_daily_earnings 
                    WHERE rider_id = $1 
                    AND date >= CURRENT_DATE - INTERVAL '7 days'
                    AND date < CURRENT_DATE
                `, [rider.id]);

                const base = parseInt(earnings[0].base);
                const bonus = parseInt(earnings[0].bonus);
                const deductions = parseInt(earnings[0].cash);
                const deliveries = parseInt(earnings[0].deliveries_count);
                const net = Math.max(0, base + bonus - deductions);

                if (net > 0) {
                    await client.query(`
                        INSERT INTO weekly_payouts (
                            rider_id, week_start, week_end, 
                            base_amount_paise, bonus_amount_paise, deductions_paise, total_deliveries,
                            net_amount_paise, status
                        ) VALUES ($1, CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE - INTERVAL '1 day', $2, $3, $4, $5, $6, 'pending')
                    `, [rider.id, base, bonus, deductions, deliveries, net]);
                }
            });
        }
    });

    // ── Daily kitchen auto-payout at 11:00 PM ────────────────────────────────
    cron.schedule('0 23 * * *', async () => {
        console.log('[CRON] Running daily kitchen auto-payouts...');
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD

        const { rows: kitchens } = await query(`
            SELECT k.id, k.name, k.upi_id, k.commission_rate,
                   k.razorpay_contact_id, k.razorpay_fund_account_id,
                   k.contact_phone, k.contact_email,
                   COALESCE(k.min_daily_payout_paise, 5000) AS min_payout
            FROM kitchens k
            WHERE k.is_partner = TRUE AND k.is_active = TRUE
              AND k.upi_id IS NOT NULL AND k.auto_payout_enabled = TRUE
        `);

        for (const kitchen of kitchens) {
            try {
                // Skip if payout already generated today
                const { rows: existing } = await query(
                    `SELECT id FROM kitchen_payouts WHERE kitchen_id = $1 AND period_start = $2`,
                    [kitchen.id, today]
                );
                if (existing.length > 0) continue;

                // Calculate today's delivered order earnings
                const { rows: stats } = await query(`
                    SELECT
                        COUNT(*) AS orders_count,
                        COALESCE(SUM(subtotal_paise), 0) AS gross_paise,
                        COALESCE(SUM(kitchen_payout_paise), 0) AS net_paise,
                        COALESCE(SUM(commission_paise), 0) AS commission_paise
                    FROM orders
                    WHERE kitchen_id = $1
                      AND status = 'delivered'
                      AND DATE(updated_at AT TIME ZONE 'Asia/Kolkata') = $2
                `, [kitchen.id, today]);

                const s = stats[0];
                const netPaise = parseInt(s.net_paise);
                const grossPaise = parseInt(s.gross_paise);
                const commissionPaise = parseInt(s.commission_paise);
                const ordersCount = parseInt(s.orders_count);

                if (netPaise < parseInt(kitchen.min_payout)) {
                    console.log(`[CRON] Kitchen ${kitchen.name}: ₹${netPaise / 100} below minimum — skipped`);
                    continue;
                }

                // Create payout record as 'processing'
                const { rows: pr } = await query(`
                    INSERT INTO kitchen_payouts
                      (kitchen_id, period_start, period_end, gross_sales_paise, commission_paise,
                       net_payout_paise, orders_count, status, payout_mode)
                    VALUES ($1, $2, $2, $3, $4, $5, $6, 'processing', 'auto')
                    RETURNING id
                `, [kitchen.id, today, grossPaise, commissionPaise, netPaise, ordersCount]);
                const payoutRowId = pr[0].id;

                if (isAutoPayConfigured()) {
                    const fundAccountId = await ensureKitchenFundAccount(kitchen);
                    const result = await firePayout(
                        fundAccountId,
                        netPaise,
                        `2QT ${today}`,
                        `2QT-K-${kitchen.id.slice(0, 8)}-${today}`
                    );
                    await query(`
                        UPDATE kitchen_payouts
                        SET status = 'paid', paid_at = NOW(),
                            razorpay_payout_id = $1, utr_number = $2
                        WHERE id = $3
                    `, [result.payoutId, result.utr, payoutRowId]);
                    console.log(`[CRON] Kitchen ${kitchen.name}: ₹${netPaise / 100} paid (${result.payoutId})`);
                } else {
                    // Razorpay not configured — leave pending for manual payment
                    await query(`UPDATE kitchen_payouts SET status = 'pending' WHERE id = $1`, [payoutRowId]);
                    console.log(`[CRON] Kitchen ${kitchen.name}: ₹${netPaise / 100} queued (no Razorpay account configured)`);
                }
            } catch (err: any) {
                console.error(`[CRON_ERROR] Kitchen payout failed for ${kitchen.name}:`, err.message);
                await query(`
                    UPDATE kitchen_payouts SET status = 'failed', failure_reason = $1
                    WHERE kitchen_id = $2 AND period_start = $3
                `, [err.message, kitchen.id, today]).catch(() => {});
                emitToAdmin('payout_failed', { type: 'kitchen', name: kitchen.name, error: err.message });
            }
        }
        console.log('[CRON] Daily kitchen payouts done');
    });

    // ── Daily rider auto-payout at 11:45 PM (after 11:30 PM guarantee top-up) ─
    cron.schedule('45 23 * * *', async () => {
        console.log('[CRON] Running daily rider auto-payouts...');
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

        const { rows: riders } = await query(`
            SELECT u.id, u.name, u.phone, u.upi_id,
                   u.razorpay_contact_id, u.razorpay_fund_account_id,
                   COALESCE(u.pending_deductions_paise, 0) AS pending_deductions,
                   rde.total_paise AS earned_today
            FROM users u
            JOIN rider_daily_earnings rde ON rde.rider_id = u.id AND rde.date = CURRENT_DATE
            WHERE u.role = 'rider'
              AND u.is_active = TRUE
              AND rde.total_paise > 0
        `);

        for (const rider of riders) {
            try {
                // Skip if already paid today
                const { rows: existing } = await query(
                    `SELECT id FROM weekly_payouts WHERE rider_id = $1 AND week_start = $2`,
                    [rider.id, today]
                );
                if (existing.length > 0) continue;

                const earnedToday = parseInt(rider.earned_today);
                const deductions = parseInt(rider.pending_deductions);
                const complaintDeduction = Math.min(deductions, earnedToday);
                const netPaise = Math.max(0, earnedToday - complaintDeduction);

                if (netPaise <= 0) {
                    console.log(`[CRON] Rider ${rider.name}: fully absorbed by deductions`);
                    // Reduce pending deductions by what was absorbed
                    await query(
                        `UPDATE users SET pending_deductions_paise = pending_deductions_paise - $1 WHERE id = $2`,
                        [complaintDeduction, rider.id]
                    );
                    continue;
                }

                // Create payout record
                const mode = (isAutoPayConfigured() && rider.upi_id) ? 'auto' : 'manual';
                const { rows: pr } = await query(`
                    INSERT INTO weekly_payouts
                      (rider_id, week_start, week_end, net_amount_paise,
                       status, payout_mode, complaint_deduction_paise, upi_id)
                    VALUES ($1, $2, $2, $3, 'processing', $4, $5, $6)
                    RETURNING id
                `, [rider.id, today, netPaise, mode, complaintDeduction, rider.upi_id || null]);
                const payoutRowId = pr[0].id;

                if (mode === 'auto') {
                    const fundAccountId = await ensureRiderFundAccount(rider);
                    const result = await firePayout(
                        fundAccountId,
                        netPaise,
                        `2QT Earnings ${today}`,
                        `2QT-R-${rider.id.slice(0, 8)}-${today}`
                    );
                    await query(`
                        UPDATE weekly_payouts
                        SET status = 'paid', paid_at = NOW(),
                            razorpay_payout_id = $1, utr_number = $2
                        WHERE id = $3
                    `, [result.payoutId, result.utr, payoutRowId]);
                    console.log(`[CRON] Rider ${rider.name}: ₹${netPaise / 100} paid (${result.payoutId})`);
                } else {
                    await query(`UPDATE weekly_payouts SET status = 'pending' WHERE id = $1`, [payoutRowId]);
                    console.log(`[CRON] Rider ${rider.name}: ₹${netPaise / 100} pending (no UPI stored)`);
                }

                // Clear absorbed deductions
                if (complaintDeduction > 0) {
                    await query(
                        `UPDATE users SET pending_deductions_paise = pending_deductions_paise - $1 WHERE id = $2`,
                        [complaintDeduction, rider.id]
                    );
                }
            } catch (err: any) {
                console.error(`[CRON_ERROR] Rider payout failed for ${rider.name}:`, err.message);
                await query(
                    `UPDATE weekly_payouts SET status = 'failed' WHERE rider_id = $1 AND week_start = $2`,
                    [rider.id, today]
                ).catch(() => {});
            }
        }
        console.log('[CRON] Daily rider payouts done');
    });

    // Update scheduled marketing campaigns status every 5 minutes (not every minute)
    cron.schedule('*/5 * * * *', async () => {
        const { rowCount } = await query(`
            UPDATE marketing_campaigns
            SET status = 'completed'
            WHERE status = 'scheduled' AND scheduled_for <= NOW()
        `);
        if (rowCount && rowCount > 0) {
            console.log(`[CRON] Updated ${rowCount} marketing campaigns to completed`);
        }
    });

    // Process due notification trigger jobs every minute
    cron.schedule('* * * * *', async () => {
        await processDueTriggerJobs();
    });

    // Run daily notification triggers (re-engagement, birthday, subscription expiry) at 10am IST
    cron.schedule('0 10 * * *', async () => {
        console.log('[CRON] Running daily notification triggers...');
        await runDailyTriggers();
    });

    // Keep Render free-tier warm — ping own health endpoint every 10 minutes
    cron.schedule('*/10 * * * *', async () => {
        const selfUrl = process.env.BACKEND_SELF_URL || `http://localhost:${process.env.PORT || 8000}/api/v1/health`;
        try {
            const { default: https } = await import('https');
            const { default: http } = await import('http');
            const client = selfUrl.startsWith('https') ? https : http;
            client.get(selfUrl, (res) => {
                res.resume();
            }).on('error', () => {});
        } catch {}
    });

    console.log('Crons initialized.');
};
