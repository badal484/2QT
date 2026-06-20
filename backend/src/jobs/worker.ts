// Single consolidated BullMQ worker — processes all 2qt queues
import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { NotificationService, NotifType } from '../services/notification.service';
import { generateInvoicePDF } from '../services/invoice.service';
import { query } from '../db';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    tls: process.env.REDIS_URL?.startsWith('rediss://')
        ? { rejectUnauthorized: false }
        : undefined,
});

// ─── Notifications worker ─────────────────────────────────────────────────────

const notifWorker = new Worker('2qt:notifications', async (job: Job) => {
    const type = job.name as NotifType;
    const data = job.data;

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

    // Single notification
    await NotificationService.send(type, data);
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

notifWorker.on('completed', job => console.log(`[WORKER] ✓ ${job.name} (${job.id})`));
notifWorker.on('failed', (job, err) => console.error(`[WORKER] ✗ ${job?.name}: ${err.message}`));
invoiceWorker.on('failed', (job, err) => console.error(`[INVOICE_WORKER] ✗ ${job?.id}: ${err.message}`));

console.log('[WORKER] All workers initialised on queue 2qt:*');

export { notifWorker, invoiceWorker, emailWorker };
