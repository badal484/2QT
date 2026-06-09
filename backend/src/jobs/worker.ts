// @ts-nocheck
import { Worker, Job } from 'bullmq';
import { generateInvoicePDF } from '../services/invoice.service';
import { query } from '../db';
import axios from 'axios';

const connection = {
    host: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).hostname : 'localhost',
    port: process.env.REDIS_URL ? parseInt(new URL(process.env.REDIS_URL).port) || 6379 : 6379,
};

console.log('--- 2QT BACKGROUND WORKER INITIALIZING ---');

// 1. Notifications Worker (WhatsApp/SMS)
const notificationsWorker = new Worker('notifications', async (job) => {
    const { type, phone, message, displayId } = job.data;
    console.log(`[WORKER:NOTIF] Processing ${type} for ${phone}`);

    if (process.env.NODE_ENV === 'development') {
        console.log(`[DEV_SIM] SENT: ${message || `Order ${displayId} Confirmed`}`);
        return;
    }

    // Production logic using Interakt (WhatsApp) or SMS gateway
    try {
        if (process.env.INTERAKT_API_KEY) {
            await axios.post('https://api.interakt.ai/v1/public/message/', {
                phoneNumber: phone,
                type: 'Template',
                template: {
                    name: type === 'order_confirmed' ? '2qt_order_confirm' : '2qt_general',
                    languageCode: 'en',
                    bodyValues: [displayId || 'User']
                }
            }, {
                headers: { 'Authorization': `Basic ${process.env.INTERAKT_API_KEY}` }
            });
        }
    } catch (err: any) {
        console.error(`[WORKER:NOTIF_ERROR] ${err.message}`);
        throw err; // Trigger BullMQ retry
    }
}, {
    connection,
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 }
});

// 2. Orders Worker (Invoicing/Scheduling)
const ordersWorker = new Worker('orders', async (job) => {
    const { type, orderId } = job.data;
    console.log(`[WORKER:ORDERS] Processing ${type} for ${orderId}`);

    if (type === 'generate_invoice') {
        const invoiceUrl = await generateInvoicePDF(orderId);
        await query('UPDATE orders SET invoice_url = $1 WHERE id = $2', [invoiceUrl, orderId]);
        console.log(`[WORKER:INVOICE] Generated: ${invoiceUrl}`);
    }

    if (type === 'process_scheduled_order') {
        await query('UPDATE orders SET status = \'confirmed\' WHERE id = $1', [orderId]);
        // Trigger subsequent logic like notifying kitchen
        const { rows } = await query('SELECT kitchen_id, display_id, customer_id FROM orders WHERE id = $1', [orderId]);
        const { emitToKitchen } = require('../socket');
        emitToKitchen(rows[0].kitchen_id, 'new_order', { orderId, displayId: rows[0].display_id });
        
        const { pushService } = require('../services/push.service');
        await pushService.sendNotificationToUser(rows[0].customer_id, {
            title: "Order Confirmed! 👨‍🍳",
            body: `Your order ${rows[0].display_id} has been confirmed and is being prepared!`
        });
    }
}, { 
    connection,
    attempts: 2
});

// 3. Subscriptions Worker (Expiry/Renewals)
const subscriptionsWorker = new Worker('subscriptions', async (job) => {
    const { type } = job.data;
    console.log(`[WORKER:SUBS] Processing ${type}`);

    if (type === 'cleanup_expired') {
        const { rowCount } = await query(`
            UPDATE customer_subscriptions 
            SET status = 'expired' 
            WHERE status = 'active' AND ends_on < CURRENT_DATE
        `, []);
        console.log(`[WORKER:SUBS] Systematically Expired ${rowCount} plans.`);
    }

    if (type === 'notify_renewal') {
        const { rows } = await query(`
            SELECT u.phone, u.id as user_id, s.id as sub_id 
            FROM customer_subscriptions s
            JOIN users u ON s.customer_id = u.id
            WHERE s.status = 'active' AND s.ends_on = CURRENT_DATE + INTERVAL '1 day'
        `, []);

        for (const user of rows) {
            // Queue a notification job
            const { notificationsQueue } = require('./queues');
            await notificationsQueue.add('renewal_reminder', {
                phone: user.phone,
                type: 'renewal_prompt',
                message: 'Your 2QT Plan expires tomorrow! Renew now to keep the deliciousness coming.'
            });
        }
        console.log(`[WORKER:SUBS] Queued renewal reminders for ${rows.length} users.`);
    }
}, { 
    connection,
    attempts: 2
});

notificationsWorker.on('completed', job => console.log(`[WORKER:SUCCESS] Job ${job.id} done.`));
notificationsWorker.on('failed', (job, err) => console.error(`[WORKER:FAILED] Job ${job?.id}: ${err.message}`));

export { notificationsWorker, ordersWorker, subscriptionsWorker };
