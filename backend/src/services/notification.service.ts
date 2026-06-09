import { query } from '../db';
import axios from 'axios';

export type NotificationType = 
    | 'order_confirmed' 
    | 'order_preparing' 
    | 'order_ready'
    | 'order_out_for_delivery' 
    | 'order_delivered' 
    | 'order_cancelled'
    | 'low_subscription_meals'
    | 'rider_payout_sent'
    | 'broadcast_message';

export interface NotificationPayload {
    phone: string;
    displayId?: string;
    riderName?: string;
    otp?: string;
    minutes?: number;
    amount?: number;
    upiId?: string;
    count?: number;
    message?: string;
    imageUrl?: string;
}

export class NotificationService {
    static async send(type: NotificationType, data: NotificationPayload) {
        console.log(`[NOTIFICATION_SERVICE] Processing ${type} for ${data.phone}`);

        const message = this.getMessageTemplate(type, data);
        if (!message) return;

        // 1. WhatsApp Logic (e.g., via Twilio or WATI)
        await this.sendWhatsApp(data.phone, message, data.imageUrl);

        // 2. Push Notification Logic (via FCM)
        await this.sendPushNotification(data.phone, type, message, data.imageUrl);
    }

    private static getMessageTemplate(type: NotificationType, data: NotificationPayload): string | null {
        switch (type) {
            case 'order_confirmed':
                return `2QT: Your order #${data.displayId} is confirmed! Our chefs are starting to prep it. ETA: ${data.minutes} mins.`;
            case 'order_preparing':
                return `2QT: Chef is currently preparing your meal with fresh ingredients!`;
            case 'order_ready':
                return `2QT: Your order is ready and waiting for the rider!`;
            case 'order_out_for_delivery':
                return `2QT: Your rider ${data.riderName} is on the way! Your delivery OTP is ${data.otp}. Track in the app.`;
            case 'order_delivered':
                return `2QT: Delivered! Hope you enjoy your meal. Please rate us in the app.`;
            case 'order_cancelled':
                return `2QT: Your order #${data.displayId} has been cancelled. A refund of ₹${data.amount} has been added to your wallet.`;
            case 'low_subscription_meals':
                return `2QT: Heads up! You only have ${data.count} meals left in your plan. Renew soon to keep the hunger away!`;
            case 'rider_payout_sent':
                return `2QT: Your payout of ₹${data.amount} has been sent to your UPI ${data.upiId}. Great work!`;
            case 'broadcast_message':
                return data.message || null;
            default:
                return null;
        }
    }

    private static async sendSMS(phone: string, message: string) {
        if (!process.env.MSG91_AUTH_KEY || process.env.NODE_ENV === 'development') {
            console.log(`[SMS_SIMULATOR] TO: ${phone} | MSG: ${message}`);
            return;
        }

        try {
            await axios.post(
                'https://control.msg91.com/api/v5/flow/',
                {
                    flow_id: process.env.MSG91_FLOW_ID,
                    sender: process.env.MSG91_SENDER_ID,
                    mobiles: phone,
                    message: message
                },
                {
                    headers: {
                        'authkey': process.env.MSG91_AUTH_KEY,
                        'Content-Type': 'application/json'
                    }
                }
            );
        } catch (err: any) {
            console.error('[SMS_ERROR] Fallback failed:', err?.response?.data || err.message);
        }
    }

    private static async sendWhatsApp(phone: string, message: string, imageUrl?: string) {
        if (!process.env.INTERAKT_API_KEY || process.env.NODE_ENV === 'development') {
            console.log(`[WHATSAPP_SIMULATOR] TO: ${phone} | MSG: ${message}${imageUrl ? ` | IMAGE: ${imageUrl}` : ''}`);
            return;
        }

        try {
            const type = imageUrl ? 'Image' : 'Text';
            const payload: any = {
                countryCode: phone.substring(0, 2),
                phoneNumber: phone.substring(2),
                type: type,
                message: message
            };
            if (imageUrl) payload.mediaUrl = imageUrl;

            await axios.post(
                'https://api.interakt.ai/v1/public/message/',
                payload,
                {
                    headers: {
                        'Authorization': `Basic ${process.env.INTERAKT_API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
        } catch (err: any) {
            console.error('[WHATSAPP_ERROR]', err?.response?.data || err.message);
            console.log('[NOTIFICATION_SERVICE] Triggering SMS Fallback...');
            await this.sendSMS(phone, message);
        }
    }

    private static async sendPushNotification(phone: string, title: string, body: string, imageUrl?: string) {
        try {
            const { rows } = await query('SELECT fcm_token FROM users WHERE phone = $1', [phone]);
            const token = rows[0]?.fcm_token;
            if (!token) return;

            console.log(`[FCM_SIMULATOR] TO: ${token} | TITLE: ${title} | BODY: ${body}${imageUrl ? ` | IMAGE: ${imageUrl}` : ''}`);
        } catch (err) {
            console.error('[PUSH_ERROR]', err);
        }
    }
}
