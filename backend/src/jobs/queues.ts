import { Queue, Worker, Job } from 'bullmq';
import { redis } from '../redis';
import { NotificationService } from '../services/notification.service';
import { generateInvoicePDF } from '../services/invoice.service';
import { query } from '../db';

import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    tls: process.env.REDIS_URL?.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined
});

// Queues
export const notificationsQueue = new Queue('2qt:notifications', { connection });
export const invoicesQueue = new Queue('2qt:invoices', { connection });
export const emailsQueue = new Queue('2qt:emails', { connection });

// Workers
new Worker('2qt:notifications', async (job: Job) => {
    const type = job.name as any;
    const data = job.data;
    try {
        await NotificationService.send(type, data);
    } catch (err) {
        console.error(`[WORKER_ERROR] Notification failed: ${type}`, err);
        throw err;
    }
}, { connection });

new Worker('2qt:invoices', async (job: Job) => {
    const { orderId } = job.data;
    try {
        const invoiceUrl = await generateInvoicePDF(orderId);
        await query('UPDATE orders SET invoice_url = $1 WHERE id = $2', [invoiceUrl, orderId]);
        console.log(`[WORKER] Invoice generated for ${orderId}: ${invoiceUrl}`);
    } catch (err) {
        console.error(`[WORKER_ERROR] Invoice generation failed: ${orderId}`, err);
        throw err;
    }
}, { connection });

new Worker('2qt:emails', async (job: Job) => {
    const { orderId, email } = job.data;
    console.log(`[JOB] Sending GST invoice email to: ${email}`);
    // Use nodemailer or SendGrid here
}, { connection });