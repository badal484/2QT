import { Queue, Worker, Job } from 'bullmq';
import { redis } from '../redis';
import { NotificationService } from '../services/notification.service';
import { generateInvoicePDF } from '../services/invoice.service';
import { query } from '../db';

const connection = {
    host: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).hostname : 'localhost',
    port: process.env.REDIS_URL ? parseInt(new URL(process.env.REDIS_URL).port) : 6379,
};

// Queues
export const notificationsQueue = new Queue('velto:notifications', { connection });
export const invoicesQueue = new Queue('velto:invoices', { connection });
export const emailsQueue = new Queue('velto:emails', { connection });

// Workers
new Worker('velto:notifications', async (job: Job) => {
    const type = job.name as any;
    const data = job.data;
    try {
        await NotificationService.send(type, data);
    } catch (err) {
        console.error(`[WORKER_ERROR] Notification failed: ${type}`, err);
        throw err;
    }
}, { connection });

new Worker('velto:invoices', async (job: Job) => {
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

new Worker('velto:emails', async (job: Job) => {
    const { orderId, email } = job.data;
    console.log(`[JOB] Sending GST invoice email to: ${email}`);
    // Use nodemailer or SendGrid here
}, { connection });