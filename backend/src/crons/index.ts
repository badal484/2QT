import cron from 'node-cron';
import { query, withTransaction } from '../db';
import { redis, keys } from '../redis';
import { notificationsQueue } from '../jobs/queues';
import { TWO_QT } from '../config/constants';
import { emitToKitchen, emitToAdmin, emitToRiders, emitToPartner } from '../socket';
import {
    ensureKitchenFundAccount, ensureRiderFundAccount,
    firePayout, isAutoPayConfigured,
} from '../services/razorpay-payout.service';
import { payoutMonthlySalaryForRider } from '../services/rider-payout.service';
import { processDueTriggerJobs, runDailyTriggers } from '../services/trigger.service';
import { fireCampaignNotification } from '../routes/campaigns';

// Defense in depth only — the real fix for "crons run more than once" is architectural:
// initCrons() is called from exactly one place now (src/worker.ts, the singleton worker
// process; see that file). This guard just stops a stray second call within the SAME
// process from double-registering every job — it does NOT protect against two separate
// processes both calling initCrons() (that's what pinning the worker service to
// min=max=1 Cloud Run instances is for).
let cronsInitialized = false;

export const initCrons = () => {
    if (cronsInitialized) {
        console.warn('[CRON] initCrons() called again in this process — ignoring, jobs are already scheduled.');
        return;
    }
    cronsInitialized = true;

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
                try {
                    await withTransaction(async (client) => {
                        // Idempotency guard (migration 126): claims (rider_id, date) via a
                        // unique index before touching money. If this rider was already
                        // topped up today — an overlapping run during a deploy, or a retry —
                        // this INSERT throws a unique violation and the whole transaction
                        // rolls back before the additive UPDATE below ever runs.
                        await client.query(
                            `INSERT INTO rider_guarantee_topups (rider_id, date, amount_paise) VALUES ($1, CURRENT_DATE, $2)`,
                            [rider.rider_id, topup]
                        );

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
                    console.log(`[CRON] Topped up rider ${rider.rider_id} with Rs. ${topup / 100}`);
                } catch (err: any) {
                    if (err.code === '23505') {
                        console.log(`[CRON] Rider ${rider.rider_id} already topped up today — skipping duplicate.`);
                    } else {
                        console.error(`[CRON_ERROR] Rider guarantee top-up failed for ${rider.rider_id}:`, err.message);
                    }
                }
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
            SELECT id FROM scheduled_orders
            WHERE status = 'scheduled'
            AND scheduled_for <= NOW() + INTERVAL '1 minute' * $1
            AND (payment_status = 'paid' OR payment_method = 'cod')
        `, [leadTimeMinutes]);

        for (const row of scheduled) {
            try {
                await withTransaction(async (client) => {
                    // Atomically claim this scheduled order before doing anything else.
                    // If a concurrent run (e.g. two worker instances briefly overlapping
                    // during a deploy rollout) already claimed it, this UPDATE matches 0
                    // rows and we return early — no duplicate order is ever created for
                    // the same scheduled_order.
                    const { rows: claimedRows } = await client.query(
                        `UPDATE scheduled_orders SET status = 'converting' WHERE id = $1 AND status = 'scheduled' RETURNING *`,
                        [row.id]
                    );
                    const s = claimedRows[0];
                    if (!s) {
                        console.log(`[CRON] Scheduled order ${row.id} already claimed by another run — skipping.`);
                        return;
                    }
                    console.log(`[CRON] Activating scheduled order: ${s.id}`);

                    // 1. Find a suitable kitchen in the zone (for now, pick first one or based on load)
                    const { rows: kitchens } = await client.query('SELECT id, restaurant_id FROM kitchens WHERE zone_id = $1 AND is_active = true AND is_paused = false LIMIT 1', [s.zone_id]);
                    const kitchenId = kitchens[0]?.id;
                    if (!kitchenId) throw new Error('NO_KITCHEN_IN_ZONE');

                    // 2. Create actual order — restaurant_id (Phase 4) mirrors the same fix in
                    // order.service.ts's createPendingOrderWithClient, so scheduled orders carry
                    // their kitchen's tenant too, not just orders placed through the normal flow.
                    const { rows: orderRows } = await client.query(`
                        INSERT INTO orders (
                            customer_id, kitchen_id, zone_id, address_id,
                            status, payment_method, payment_status,
                            subtotal_paise, delivery_fee_paise, total_amount_paise,
                            cgst_paise, sgst_paise, gateway_amount_paise,
                            is_scheduled, scheduled_for, restaurant_id
                        ) VALUES ($1, $2, $3, $4, 'confirmed', $5, $6, $7, $8, $9, $10, $11, $12, true, $13, $14)
                        RETURNING id, display_id
                    `, [
                        s.customer_id, kitchenId, s.zone_id, s.address_id,
                        s.payment_method, s.payment_status,
                        s.subtotal_paise, s.delivery_fee_paise, s.total_paise,
                        0, 0, s.payment_method === 'cod' ? 0 : s.total_paise,
                        s.scheduled_for, kitchens[0]?.restaurant_id ?? null,
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

                    const { rows: settings } = await query("SELECT value FROM app_settings WHERE key = 'auto_dispatch_enabled'");
                    const autoDispatchEnabled = settings[0]?.value === 'true';
                    if (!autoDispatchEnabled) {
                        emitToRiders('new_available_mission', { orderId, displayId, zoneId: s.zone_id }, s.zone_id);
                    }
                });
            } catch (err) {
                console.error(`[CRON_ERROR] Failed to convert scheduled order ${row.id}:`, err);
                // Runs outside the transaction above, so it still commits even though that
                // transaction (including the 'converting' claim) rolled back on failure.
                await query('UPDATE scheduled_orders SET status = \'failed\' WHERE id = $1', [row.id]).catch(() => {});
            }
        }
    });

    // No-rider alert every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
        console.log('[CRON] Checking for orders with no rider...');
        const { rows: stuckOrders } = await query(`
            SELECT id, display_id, kitchen_id FROM orders 
            WHERE status = 'ready_for_pickup'
            AND rider_id IS NULL
            AND created_at < NOW() - INTERVAL '10 minutes'
        `);

        for (const order of stuckOrders) {
            console.log(`[ALERT] Order ${order.display_id} has no rider for 10+ mins!`);
            const payload = {
                type: 'NO_RIDER',
                orderId: order.id,
                displayId: order.display_id,
                message: 'No rider assigned for 10+ minutes'
            };
            if (order.kitchen_id) {
                emitToKitchen(order.kitchen_id, 'critical_alert', payload);
            }
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
                    emitToKitchen(kitchen.id, 'kitchen_payout_updated', {
                        payoutId: payoutRowId,
                        amountPaise: netPaise,
                        status: 'paid',
                        utr: result.utr,
                    });
                    console.log(`[CRON] Kitchen ${kitchen.name}: ₹${netPaise / 100} paid (${result.payoutId})`);
                } else {
                    // Razorpay not configured — leave pending for manual payment
                    await query(`UPDATE kitchen_payouts SET status = 'pending' WHERE id = $1`, [payoutRowId]);
                    emitToKitchen(kitchen.id, 'kitchen_payout_updated', {
                        payoutId: payoutRowId,
                        amountPaise: netPaise,
                        status: 'pending',
                    });
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

    // ── Monthly Salaried Rider Payout on the 1st of every month at 9:00 AM ──
    cron.schedule('0 9 1 * *', async () => {
        console.log('[CRON] Running monthly salaried rider payouts...');
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

        const { rows: salariedRiders } = await query(`
            SELECT u.id, u.name, u.phone, u.upi_id,
                   u.razorpay_contact_id, u.razorpay_fund_account_id,
                   COALESCE(u.pending_deductions_paise, 0) AS pending_deductions,
                   u.monthly_salary_paise
            FROM users u
            WHERE u.role = 'rider'
              AND u.is_active = TRUE
              AND u.payment_model = 'salary'
              AND COALESCE(u.monthly_salary_paise, 0) > 0
        `);

        for (const rider of salariedRiders) {
            try {
                const result = await payoutMonthlySalaryForRider(rider, today.substring(0, 7));
                if (result.status === 'absorbed') {
                    console.log(`[CRON] Salaried Rider ${rider.name}: fully absorbed by deductions`);
                } else {
                    console.log(`[CRON] Salaried Rider ${rider.name}: ₹${result.netPaise / 100} ${result.status}`);
                }
            } catch (err: any) {
                console.error(`[CRON_ERROR] Salaried rider payout failed for ${rider.name}:`, err.message);
                await query(
                    `UPDATE weekly_payouts SET status = 'failed' WHERE rider_id = $1 AND week_start = $2`,
                    [rider.id, today]
                ).catch(() => {});
            }
        }
        console.log('[CRON] Monthly salaried rider payouts done');
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
                       status, payout_mode, payout_type, complaint_deduction_paise, upi_id)
                    VALUES ($1, $2, $2, $3, 'processing', $4, 'gig_daily', $5, $6)
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

    // Campaign schedule: auto-start and auto-expire based on schedule_start / schedule_end
    cron.schedule('* * * * *', async () => {
        // Activate campaigns whose schedule_start has arrived
        const { rows: toActivate } = await query(`
            UPDATE campaigns
            SET is_active = TRUE, updated_at = NOW()
            WHERE is_active = FALSE
              AND schedule_start IS NOT NULL AND schedule_start <= NOW()
              AND (schedule_end IS NULL OR schedule_end > NOW())
            RETURNING *
        `);
        for (const c of toActivate) {
            console.log(`[CRON] Campaign "${c.name}" auto-activated`);
            if (c.notif_template_type && !c.notif_sent_at) {
                fireCampaignNotification(c).catch(() => {});
            }
        }

        // Expire campaigns whose schedule_end has passed
        const { rows: toExpire } = await query(`
            UPDATE campaigns
            SET is_active = FALSE, updated_at = NOW()
            WHERE is_active = TRUE
              AND schedule_end IS NOT NULL AND schedule_end <= NOW()
            RETURNING id, name
        `);
        for (const c of toExpire) {
            console.log(`[CRON] Campaign "${c.name}" auto-expired`);
        }

        if (toActivate.length > 0 || toExpire.length > 0) {
            await redis.del(keys.activeCampaigns()).catch(() => {});
        }
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

    // ── Weekly partner restaurant payouts — every Monday 9 AM IST ────────────
    // Computes last Mon–Sun revenue for each active partner restaurant,
    // creates a payout record, and fires RazorpayX transfer if configured.
    // Commission is on platform bookings only (every row in table_bookings).
    cron.schedule('30 3 * * 1', async () => {  // 3:30 UTC = 9:00 AM IST
        console.log('[CRON] Running weekly partner restaurant payouts...');

        const today = new Date();
        // Last Monday → last Sunday
        const lastMonday = new Date(today);
        lastMonday.setDate(today.getDate() - today.getDay() - 6); // last Mon
        const lastSunday = new Date(lastMonday);
        lastSunday.setDate(lastMonday.getDate() + 6);

        const fmt = (d: Date) => d.toISOString().slice(0, 10);
        const periodStart = fmt(lastMonday);
        const periodEnd   = fmt(lastSunday);

        try {
            const { rows: partners } = await query(`
                SELECT rc.id AS restaurant_id, rc.name, rc.partner_id,
                       rc.commission_percent, rc.upi_id,
                       rc.razorpay_contact_id, rc.razorpay_fund_account_id,
                       u.name AS partner_name, u.phone AS partner_phone
                FROM restaurant_config rc
                JOIN users u ON u.id = rc.partner_id
                WHERE rc.partner_id IS NOT NULL AND rc.is_active = true
            `);

            for (const rc of partners) {
                try {
                    // Skip if payout already exists for this period
                    const { rows: existing } = await query(
                        'SELECT id FROM partner_restaurant_payouts WHERE restaurant_id=$1 AND period_start=$2',
                        [rc.restaurant_id, periodStart]
                    );
                    if (existing[0]) continue;

                    // Compute revenue
                    const { rows: revRows } = await query(`
                        SELECT
                            COALESCE(SUM(tb.total_paid_paise), 0) AS gross_revenue_paise,
                            COALESCE(SUM(cash.cash_total), 0)      AS cash_collected_paise
                        FROM table_bookings tb
                        LEFT JOIN LATERAL (
                            SELECT COALESCE(SUM(p.amount_paise), 0) AS cash_total
                            FROM table_booking_payments p
                            WHERE p.booking_id = tb.id
                              AND p.payment_method IN ('cash','card_pos')
                              AND p.payment_type = 'final_settlement'
                        ) cash ON true
                        WHERE tb.restaurant_id = $1
                          AND tb.status = 'completed'
                          AND DATE(tb.completed_at AT TIME ZONE 'Asia/Kolkata') BETWEEN $2 AND $3
                    `, [rc.restaurant_id, periodStart, periodEnd]);

                    const grossPaise = Number(revRows[0].gross_revenue_paise);
                    const cashPaise  = Number(revRows[0].cash_collected_paise);
                    const appPaise   = grossPaise - cashPaise;
                    const commissionPaise = Math.round(grossPaise * (rc.commission_percent / 100));
                    const netPayoutPaise  = Math.max(0, grossPaise - commissionPaise - cashPaise);

                    if (grossPaise === 0) {
                        console.log(`[CRON] partner=${rc.name} — no revenue this week, skipping`);
                        continue;
                    }

                    const { rows: payoutRows } = await query(`
                        INSERT INTO partner_restaurant_payouts
                            (partner_id, restaurant_id, period_start, period_end,
                             gross_revenue_paise, app_payments_paise, cash_collected_paise,
                             commission_paise, net_payout_paise)
                        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                        RETURNING id
                    `, [rc.partner_id, rc.restaurant_id, periodStart, periodEnd,
                        grossPaise, appPaise, cashPaise, commissionPaise, netPayoutPaise]);

                    const payoutId = payoutRows[0].id;
                    console.log(`[CRON] partner=${rc.name} gross=₹${grossPaise/100} net=₹${netPayoutPaise/100}`);

                    if (netPayoutPaise <= 0) {
                        emitToPartner(rc.partner_id, 'partner_payout_updated', {
                            payoutId, status: 'pending', amountPaise: 0,
                            message: 'No transfer needed — you already collected the full amount in cash.',
                        });
                        await query(
                            "UPDATE partner_restaurant_payouts SET status='paid', notes='Cash-only week, no transfer needed', paid_at=NOW() WHERE id=$1",
                            [payoutId]
                        );
                        continue;
                    }

                    if (!isAutoPayConfigured() || !rc.upi_id) {
                        emitToAdmin('partner_payout_generated', { payoutId, restaurantName: rc.name, netPayoutPaise });
                        emitToPartner(rc.partner_id, 'partner_payout_updated', {
                            payoutId, status: 'pending', amountPaise: netPayoutPaise,
                        });
                        continue;
                    }

                    // Fire RazorpayX payout
                    try {
                        let fundAccountId = rc.razorpay_fund_account_id;
                        if (!fundAccountId) {
                            fundAccountId = await ensureRiderFundAccount({
                                id: rc.partner_id, name: rc.partner_name,
                                phone: (rc.partner_phone || '').replace(/\D/g, '') || '0000000000',
                                upi_id: rc.upi_id,
                                razorpay_contact_id: rc.razorpay_contact_id,
                                razorpay_fund_account_id: rc.razorpay_fund_account_id,
                            });
                            await query(
                                'UPDATE restaurant_config SET razorpay_fund_account_id=$1 WHERE id=$2',
                                [fundAccountId, rc.restaurant_id]
                            );
                        }

                        const narration = `VELTO ${rc.name} ${periodStart}`;
                        const result = await firePayout(fundAccountId, netPayoutPaise, narration, payoutId);

                        await query(`
                            UPDATE partner_restaurant_payouts
                            SET status='paid', razorpay_payout_id=$2, utr_number=$3, paid_at=NOW()
                            WHERE id=$1
                        `, [payoutId, result.payoutId, result.utr]);

                        emitToPartner(rc.partner_id, 'partner_payout_updated', {
                            payoutId, status: 'paid', amountPaise: netPayoutPaise, utr: result.utr,
                        });
                        emitToAdmin('partner_payout_updated', { payoutId, status: 'paid', restaurantName: rc.name });
                        console.log(`[CRON] partner=${rc.name} payout fired rzp=${result.payoutId}`);
                    } catch (rzpErr: any) {
                        await query(
                            "UPDATE partner_restaurant_payouts SET status='failed', failure_reason=$2 WHERE id=$1",
                            [payoutId, rzpErr.message]
                        );
                        emitToAdmin('partner_payout_failed', { payoutId, restaurantName: rc.name, reason: rzpErr.message });
                        console.error(`[CRON] partner=${rc.name} payout FAILED`, rzpErr.message);
                    }
                } catch (partnerErr: any) {
                    console.error(`[CRON] Error processing partner ${rc.name}:`, partnerErr.message);
                }
            }
        } catch (err: any) {
            console.error('[CRON] Weekly partner payout error:', err.message);
        }
    });

    console.log(`[CRON] ${cron.getTasks().size} jobs initialized.`);
};

// Called by the worker process on SIGTERM/SIGINT so no cron job fires mid-shutdown.
// node-cron 3.x tracks every task it created in a process-wide registry, so this stops
// all of them without us having to keep our own array of task handles in sync.
export const stopCrons = () => {
    for (const task of cron.getTasks().values()) {
        task.stop();
    }
    cronsInitialized = false;
    console.log('[CRON] All scheduled jobs stopped.');
};
