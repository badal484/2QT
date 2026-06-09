import webpush from 'web-push';
import db from '../db';

const publicVapidKey = process.env.VAPID_PUBLIC_KEY!;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY!;

// Initialize web-push
webpush.setVapidDetails(
    'mailto:hello@2qthello.com',
    publicVapidKey,
    privateVapidKey
);

export const pushService = {
    async sendNotificationToUser(userId: string, payload: { title: string; body: string; url?: string; icon?: string }) {
        if (!publicVapidKey || !privateVapidKey) {
            console.warn('Push notification skipped: VAPID keys not configured');
            return;
        }

        try {
            const result = await db.query(
                `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1`,
                [userId]
            );

            if (result.rows.length === 0) return; // User hasn't subscribed

            const subscription = {
                endpoint: result.rows[0].endpoint,
                keys: {
                    p256dh: result.rows[0].p256dh,
                    auth: result.rows[0].auth
                }
            };

            const data = JSON.stringify({
                title: payload.title,
                body: payload.body,
                url: payload.url || '/',
                icon: payload.icon || '/icon-192x192.png'
            });

            await webpush.sendNotification(subscription, data);
        } catch (err: any) {
            if (err.statusCode === 410 || err.statusCode === 404) {
                // Subscription has expired or is no longer valid
                console.log(`Deleting expired push subscription for user ${userId}`);
                await db.query(`DELETE FROM push_subscriptions WHERE user_id = $1`, [userId]);
            } else {
                console.error('Error sending push notification:', err);
            }
        }
    }
};
