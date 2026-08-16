// Single consolidated BullMQ worker — processes all 2qt queues
import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { NotificationService, NotifType, deliverNotification } from '../services/notification.service';
import { generateInvoicePDF } from '../services/invoice.service';
import { query } from '../db';
import { getCleanRedisUrl, isRedisTls } from '../redis/parseRedisUrl';

const redisUrl = getCleanRedisUrl();
const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    tls: isRedisTls(redisUrl) ? { rejectUnauthorized: false } : undefined,
});

// ─── Notifications worker ─────────────────────────────────────────────────────

const notifWorker = new Worker('2qt:notifications', async (job: Job) => {
    const type = job.name as NotifType;
    const data = job.data;

    // Admin Campaign Broadcast Batch
    if (type === ('broadcast_batch' as any)) {
        const { campaignId, userIdsBatch = [], title, body, imageUrl, targetType } = data;
        const { redis } = require('../redis');
        const { NotificationDispatcherService } = require('../modules/notifications/services/notification-dispatcher.service');

        let sent = 0;
        let failed = 0;

        for (const userId of userIdsBatch) {
            const dedupeKey = `broadcast_dedup:${campaignId}:${userId}`;
            const alreadySent = await redis.get(dedupeKey).catch(() => null);
            if (alreadySent) continue;

            try {
                let appType: 'buyer' | 'rider' | 'kitchen' = 'buyer';
                if (targetType === 'riders') appType = 'rider';
                else if (targetType === 'kitchens') appType = 'kitchen';

                await NotificationDispatcherService.dispatch({
                    userId,
                    type: 'broadcast_message',
                    title,
                    body,
                    data: { campaignId, title, body },
                    appType,
                    imageUrl: imageUrl || undefined,
                });

                await redis.setEx(dedupeKey, 86400, '1').catch(() => {});
                sent++;
            } catch (e) {
                failed++;
            }
        }

        await query(
            `UPDATE broadcast_campaigns 
             SET sent_count = sent_count + $1, failed_count = failed_count + $2
             WHERE id = $3`,
            [sent, failed, campaignId]
        ).catch(() => {});

        const { rows } = await query(
            `SELECT total_recipients, sent_count, failed_count FROM broadcast_campaigns WHERE id = $1`,
            [campaignId]
        ).catch(() => ({ rows: [] }));

        if (rows[0] && (rows[0].sent_count + rows[0].failed_count >= rows[0].total_recipients)) {
            await query(
                `UPDATE broadcast_campaigns SET status = 'COMPLETED', completed_at = NOW() WHERE id = $1`,
                [campaignId]
            ).catch(() => {});
        }
        return;
    }

    // Broadcast: send to list of phones or userIds
    if (type === 'broadcast_message' && (data.phones || data.userIds)) {
        const { broadcastNotification } = require('../services/notification.service');
        let userIds: string[] = data.userIds || [];
        if (!userIds.length && data.phones?.length) {
            // Resolve phones → user IDs
            const inList = data.phones.map((_: any, i: number) => `$${i + 1}`).join(',');
            const { rows } = await query(
                `SELECT id FROM users WHERE phone = ANY(ARRAY[${inList}])`,
                data.phones
            );
            userIds = rows.map((r: any) => r.id);
        }
        await broadcastNotification(userIds, data.title || '2QT', data.message || data.body || '');
        return;
    }

    // 3-minute escalation: if no rider has accepted after ready_for_pickup, alert kitchen managers
    if (type === 'rider_escalation' as any) {
        const { orderId, displayId, kitchenId, zoneId } = data;
        // Only escalate if still no rider assigned
        const { rows: orderRows } = await query(
            `SELECT rider_id FROM orders WHERE id = $1 AND status = 'ready_for_pickup'`,
            [orderId]
        );
        if (!orderRows[0] || orderRows[0].rider_id) return; // already assigned or delivered

        // Find kitchen managers for this kitchen
        const { rows: managers } = await query(
            `SELECT id FROM users WHERE role IN ('kitchen_manager', 'super_admin') AND kitchen_id = $1`,
            [kitchenId]
        );

        const { emitToKitchen } = require('../socket');
        emitToKitchen(kitchenId, 'rider_escalation', { orderId, displayId });

        if (managers.length > 0) {
            const { broadcastNotification } = require('../services/notification.service');
            broadcastNotification(
                managers.map((m: any) => m.id),
                '⚠️ No Rider Found',
                `Order #${displayId} has been waiting 3 min with no rider. Please assign manually.`
            ).catch(() => {});
        }
        return;
    }

    // Single notification
    // _queuedOptions = enqueued via sendNotification() with SendOptions format
    // Otherwise it's a legacy flat-format job (e.g. rider_guarantee_payout from cron)
    if (data._queuedOptions) {
        const { _queuedOptions, ...opts } = data;
        await deliverNotification(type, opts);
    } else {
        await NotificationService.send(type, data);
    }
}, {
    connection,
    concurrency: 10,
});

// ─── Invoices worker ──────────────────────────────────────────────────────────

const invoiceWorker = new Worker('2qt:invoices', async (job: Job) => {
    const { orderId } = job.data;
    const invoiceUrl = await generateInvoicePDF(orderId);
    await query('UPDATE orders SET invoice_url = $1 WHERE id = $2', [invoiceUrl, orderId]);
    console.log(`[WORKER] Invoice generated: ${invoiceUrl}`);
}, { connection, concurrency: 3 });

// ─── Email worker (placeholder) ───────────────────────────────────────────────

const emailWorker = new Worker('2qt:emails', async (job: Job) => {
    const { orderId, email } = job.data;
    console.log(`[EMAIL] Would send GST invoice for ${orderId} to ${email}`);
}, { connection });

// ─── Lifecycle logging ────────────────────────────────────────────────────────
// Identifies queue, job id/type, and outcome — never logs job payloads (may contain
// phone numbers/tokens), matching the "never log secrets" requirement.

notifWorker.on('active',    job => console.log(`[WORKER][2qt:notifications] ▶ ${job.name} (${job.id})`));
notifWorker.on('completed', job => console.log(`[WORKER][2qt:notifications] ✓ ${job.name} (${job.id})`));
notifWorker.on('failed',    (job, err) => console.error(`[WORKER][2qt:notifications] ✗ ${job?.name} (${job?.id}) attempt ${job?.attemptsMade}: ${err.message}`));

invoiceWorker.on('active',    job => console.log(`[WORKER][2qt:invoices] ▶ (${job.id})`));
invoiceWorker.on('completed', job => console.log(`[WORKER][2qt:invoices] ✓ (${job.id})`));
invoiceWorker.on('failed',    (job, err) => console.error(`[WORKER][2qt:invoices] ✗ (${job?.id}) attempt ${job?.attemptsMade}: ${err.message}`));

emailWorker.on('failed', (job, err) => console.error(`[WORKER][2qt:emails] ✗ (${job?.id}): ${err.message}`));

console.log('[WORKER] All workers initialised on queue 2qt:*');

// Called by the worker process's SIGTERM/SIGINT handler. BullMQ's Worker.close() stops
// pulling new jobs immediately and waits for any job currently in flight to finish
// before resolving — that's what "allow currently running jobs to finish" means here.
export const closeWorkers = async () => {
    console.log('[WORKER] Closing BullMQ workers (waiting for in-flight jobs)...');
    await Promise.allSettled([
        notifWorker.close(),
        invoiceWorker.close(),
        emailWorker.close(),
    ]);
    await connection.quit().catch(() => {});
    console.log('[WORKER] BullMQ workers closed.');
};

export { notifWorker, invoiceWorker, emailWorker };
