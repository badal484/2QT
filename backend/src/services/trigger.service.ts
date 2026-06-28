import { query } from '../db';
import { sendNotification, NotifType } from './notification.service';

// ─── Audience resolver ────────────────────────────────────────────────────────

async function resolveAudience(trigger: any): Promise<string[]> {
    const { audience_type, segment, conditions } = trigger;

    if (audience_type === 'all') {
        const { rows } = await query(
            `SELECT id FROM users WHERE role IN ('customer','buyer') AND is_active = TRUE`
        );
        return rows.map(r => r.id);
    }

    if (audience_type === 'segment') {
        return resolveSegment(segment, conditions);
    }

    // 'custom' — conditions object drives the query
    return resolveCustom(conditions);
}

async function resolveSegment(segment: string, conditions: any): Promise<string[]> {
    let sql = '';
    const params: any[] = [];

    switch (segment) {
        case 'new_users':
            sql = `SELECT id FROM users WHERE role IN ('customer','buyer')
                   AND is_active = TRUE AND created_at >= NOW() - INTERVAL '7 days'`;
            break;
        case 'active':
            sql = `SELECT DISTINCT customer_id AS id FROM orders
                   WHERE created_at >= NOW() - INTERVAL '14 days' AND status = 'delivered'`;
            break;
        case 'at_risk':
            sql = `SELECT id FROM users WHERE role IN ('customer','buyer') AND is_active = TRUE
                   AND id IN (
                       SELECT customer_id FROM orders WHERE status = 'delivered'
                       GROUP BY customer_id HAVING MAX(created_at) < NOW() - INTERVAL '7 days'
                                                    AND MAX(created_at) >= NOW() - INTERVAL '14 days'
                   )`;
            break;
        case 'churned':
            sql = `SELECT id FROM users WHERE role IN ('customer','buyer') AND is_active = TRUE
                   AND id IN (
                       SELECT customer_id FROM orders WHERE status = 'delivered'
                       GROUP BY customer_id HAVING MAX(created_at) < NOW() - INTERVAL '30 days'
                   )`;
            break;
        case 'loyal':
            sql = `SELECT customer_id AS id FROM orders WHERE status = 'delivered'
                   GROUP BY customer_id HAVING COUNT(*) >= 10`;
            break;
        case 'subscribers':
            sql = `SELECT user_id AS id FROM subscriptions WHERE is_active = TRUE AND status = 'active'`;
            break;
        default:
            return [];
    }

    const { rows } = await query(sql, params);
    return rows.map(r => r.id);
}

async function resolveCustom(conditions: any): Promise<string[]> {
    const clauses: string[] = [`u.role IN ('customer','buyer') AND u.is_active = TRUE`];
    const params: any[] = [];

    if (conditions.min_orders != null) {
        clauses.push(`(SELECT COUNT(*) FROM orders o WHERE o.customer_id = u.id AND o.status='delivered') >= $${params.length + 1}`);
        params.push(conditions.min_orders);
    }
    if (conditions.max_orders != null) {
        clauses.push(`(SELECT COUNT(*) FROM orders o WHERE o.customer_id = u.id AND o.status='delivered') <= $${params.length + 1}`);
        params.push(conditions.max_orders);
    }
    if (conditions.inactive_days != null) {
        clauses.push(`(SELECT MAX(created_at) FROM orders o WHERE o.customer_id = u.id AND o.status='delivered') < NOW() - ($${params.length + 1} || ' days')::INTERVAL`);
        params.push(conditions.inactive_days);
    }
    if (conditions.zone_id != null) {
        clauses.push(`u.zone_id = $${params.length + 1}`);
        params.push(conditions.zone_id);
    }
    if (conditions.max_balance_paise != null) {
        clauses.push(`u.wallet_balance_paise <= $${params.length + 1}`);
        params.push(conditions.max_balance_paise);
    }
    if (conditions.has_subscription === true) {
        clauses.push(`EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = u.id AND s.is_active = TRUE)`);
    }
    if (conditions.has_subscription === false) {
        clauses.push(`NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = u.id AND s.is_active = TRUE)`);
    }

    const { rows } = await query(
        `SELECT u.id FROM users u WHERE ${clauses.join(' AND ')}`,
        params
    );
    return rows.map(r => r.id);
}

// ─── Schedule a delayed send (cart abandoned, order_delivered) ────────────────

export async function scheduleTriggerSend(
    eventType: string,
    userId: string,
    contextVars: Record<string, string> = {}
) {
    const { rows: triggers } = await query(
        `SELECT * FROM notification_triggers WHERE event_type = $1 AND is_active = TRUE`,
        [eventType]
    );

    for (const trigger of triggers) {
        const fireAt = new Date(Date.now() + trigger.delay_minutes * 60 * 1000);
        await query(
            `INSERT INTO notification_trigger_jobs (trigger_id, user_id, fire_at, context)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (trigger_id, user_id, fire_at) DO NOTHING`,
            [trigger.id, userId, fireAt.toISOString(), JSON.stringify(contextVars)]
        );
    }
}

// Cancel pending jobs for a user+event (e.g. user placed order — cancel cart_abandoned)
export async function cancelTriggerJobs(eventType: string, userId: string) {
    const { rows: triggers } = await query(
        `SELECT id FROM notification_triggers WHERE event_type = $1`,
        [eventType]
    );
    if (!triggers.length) return;
    const triggerIds = triggers.map(t => t.id);
    await query(
        `UPDATE notification_trigger_jobs
         SET status = 'cancelled'
         WHERE trigger_id = ANY($1::uuid[]) AND user_id = $2 AND status = 'pending'`,
        [triggerIds, userId]
    );
}

// ─── Process due jobs (called by cron every minute) ──────────────────────────

export async function processDueTriggerJobs() {
    const { rows: jobs } = await query(
        `SELECT j.*, t.template_type, t.channels, t.name AS trigger_name
         FROM notification_trigger_jobs j
         JOIN notification_triggers t ON t.id = j.trigger_id
         WHERE j.status = 'pending' AND j.fire_at <= NOW()
         ORDER BY j.fire_at ASC
         LIMIT 100`
    );

    for (const job of jobs) {
        try {
            await sendNotification(job.template_type as NotifType, {
                userId: job.user_id,
                vars: job.context ?? {},
                overrideChannels: job.channels,
                dedupeKey: job.id,
            });

            await query(
                `UPDATE notification_trigger_jobs SET status = 'sent' WHERE id = $1`,
                [job.id]
            );
            await query(
                `UPDATE notification_triggers
                 SET fired_count = fired_count + 1, last_fired_at = NOW()
                 WHERE id = $1`,
                [job.trigger_id]
            );
        } catch (err: any) {
            console.error(`[TRIGGER] Job ${job.id} failed:`, err.message);
        }
    }
}

// ─── Daily cron triggers (no_order_days, subscription_expiring, birthday) ────

export async function runDailyTriggers() {
    const { rows: triggers } = await query(
        `SELECT * FROM notification_triggers WHERE is_active = TRUE
         AND event_type IN ('no_order_days', 'subscription_expiring', 'birthday_tomorrow')`
    );

    for (const trigger of triggers) {
        const conds = trigger.conditions ?? {};
        let userIds: string[] = [];

        if (trigger.event_type === 'no_order_days') {
            const days = conds.inactive_days ?? 7;
            const { rows } = await query(
                `SELECT id FROM users WHERE role IN ('customer','buyer') AND is_active = TRUE
                 AND id IN (
                     SELECT customer_id FROM orders WHERE status = 'delivered'
                     GROUP BY customer_id
                     HAVING MAX(created_at) BETWEEN NOW() - ($1 || ' days')::INTERVAL - INTERVAL '1 day'
                                                  AND NOW() - ($1 || ' days')::INTERVAL
                 )`,
                [String(days)]
            );
            userIds = rows.map(r => r.id);
        }

        if (trigger.event_type === 'subscription_expiring') {
            const days = conds.expiry_days ?? 3;
            const { rows } = await query(
                `SELECT user_id AS id FROM subscriptions
                 WHERE is_active = TRUE AND status = 'active'
                 AND end_date BETWEEN NOW() AND NOW() + ($1 || ' days')::INTERVAL`,
                [String(days)]
            );
            userIds = rows.map(r => r.id);
        }

        if (trigger.event_type === 'birthday_tomorrow') {
            const { rows } = await query(
                `SELECT id FROM users
                 WHERE role IN ('customer','buyer') AND is_active = TRUE
                 AND date_of_birth IS NOT NULL
                 AND TO_CHAR(date_of_birth, 'MM-DD') = TO_CHAR(NOW() + INTERVAL '1 day', 'MM-DD')`
            );
            userIds = rows.map(r => r.id);
        }

        for (const userId of userIds) {
            try {
                await sendNotification(trigger.template_type as NotifType, {
                    userId,
                    overrideChannels: trigger.channels,
                    dedupeKey: `trigger:${trigger.id}:${userId}:${new Date().toISOString().slice(0, 10)}`,
                });
            } catch {}
        }

        if (userIds.length > 0) {
            await query(
                `UPDATE notification_triggers
                 SET fired_count = fired_count + $1, last_fired_at = NOW()
                 WHERE id = $2`,
                [userIds.length, trigger.id]
            );
        }
    }
}

// ─── Wallet low trigger ───────────────────────────────────────────────────────

export async function checkWalletLowTrigger(userId: string, newBalancePaise: number) {
    const { rows: triggers } = await query(
        `SELECT * FROM notification_triggers WHERE event_type = 'wallet_low' AND is_active = TRUE`
    );

    for (const trigger of triggers) {
        const threshold = trigger.conditions?.max_balance_paise ?? 10000;
        if (newBalancePaise <= threshold) {
            await sendNotification(trigger.template_type as NotifType, {
                userId,
                vars: { amount: String(Math.round(newBalancePaise / 100)) },
                overrideChannels: trigger.channels,
                dedupeKey: `wallet_low:${userId}`,
            });
        }
    }
}
