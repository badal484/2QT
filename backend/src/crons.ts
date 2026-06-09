import cron from 'node-cron';
import { resetDailyCredits } from './services/subscription.service';
import { checkAllStockThresholds } from './services/stock.service';
import { query } from './db';

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
};
