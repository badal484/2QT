import axios from 'axios';
import { query } from '../db';
import { redis } from '../redis';
import { sendFCM } from './fcm.service';
import { pushService } from './push.service'; // web-push VAPID for browser
import { emitToUser } from '../socket';

export type NotifType =
    | 'order_confirmed' | 'order_preparing' | 'order_ready'
    | 'order_out_for_delivery' | 'order_delivered' | 'order_cancelled'
    | 'rider_payout' | 'kitchen_payout' | 'low_subscription_meals'
    | 'rider_verified' | 'cash_submitted' | 'broadcast_message'
    | 'low_stock_alert' | 'rider_guarantee_payout' | 'renewal_reminder';

const PROMO_TYPES   = new Set(['broadcast_message', 'winback', 'birthday', 'flash_sale', 'renewal_reminder']);
const PAYOUT_TYPES  = new Set(['rider_payout', 'kitchen_payout', 'rider_guarantee_payout']);
const TEMPLATE_CACHE_TTL = 300; // 5 min

// ─── Template cache ───────────────────────────────────────────────────────────

async function loadTemplate(type: NotifType) {
    const key = `notif_tmpl:${type}`;
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    const { rows } = await query(
        'SELECT * FROM notification_templates WHERE type = $1 AND is_active = TRUE',
        [type]
    );
    if (!rows.length) return null;

    await redis.setEx(key, TEMPLATE_CACHE_TTL, JSON.stringify(rows[0]));
    return rows[0];
}

export async function bustTemplateCache(type: string) {
    await redis.del(`notif_tmpl:${type}`);
}

// ─── Variable interpolation ───────────────────────────────────────────────────

function interpolate(template: string, vars: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
}

// ─── Main send ────────────────────────────────────────────────────────────────

export interface SendOptions {
    userId?: string;
    phone?: string;
    vars?: Record<string, string>;
    dedupeKey?: string;     // e.g. orderId — prevents duplicate sends
    overrideChannels?: ('push' | 'whatsapp' | 'sms')[];
}

export async function sendNotification(type: NotifType, options: SendOptions): Promise<void> {
    const { userId, phone, vars = {}, dedupeKey, overrideChannels } = options;

    // 1. Resolve user
    let user: { id: string; phone: string; device_token: string | null; name: string } | null = null;
    if (userId) {
        const { rows } = await query('SELECT id, phone, device_token, name FROM users WHERE id = $1', [userId]);
        user = rows[0] ?? null;
    } else if (phone) {
        const { rows } = await query('SELECT id, phone, device_token, name FROM users WHERE phone = $1', [phone]);
        user = rows[0] ?? null;
    }
    if (!user) {
        console.warn(`[NOTIF] User not found type=${type} userId=${userId} phone=${phone}`);
        return;
    }

    // 2. Deduplicate within 60 s
    if (dedupeKey) {
        const dk = `notif:${user.id}:${type}:${dedupeKey}`;
        if (await redis.get(dk)) return; // already sent
        await redis.setEx(dk, 60, '1');
    }

    // 3. Load template
    const tmpl = await loadTemplate(type);
    if (!tmpl) {
        console.warn(`[NOTIF] No active template for type=${type}`);
        return;
    }

    // 4. Check user preferences
    const { rows: pRows } = await query(
        'SELECT * FROM notification_preferences WHERE user_id = $1',
        [user.id]
    );
    const prefs = pRows[0] ?? {
        order_updates: true, promotions: true, payouts: true,
        push_enabled: true, whatsapp_enabled: true,
    };
    if (PROMO_TYPES.has(type) && !prefs.promotions) return;
    if (PAYOUT_TYPES.has(type) && !prefs.payouts) return;

    // 5. Build content
    const title   = interpolate(tmpl.title_template, vars);
    const body    = interpolate(tmpl.body_template, vars);
    const waText  = interpolate(tmpl.whatsapp_template || tmpl.body_template, vars);
    const channels: string[] = overrideChannels ?? tmpl.channels ?? ['push', 'whatsapp'];

    // 6. Dispatch channels in parallel (fire-and-forget individually)
    const tasks: Promise<any>[] = [];

    // FCM mobile push
    if (channels.includes('push') && prefs.push_enabled && user.device_token) {
        tasks.push(
            sendFCM(user.device_token, title, body, { type, ...vars })
                .then((result: any) => {
                    if (result === 'invalid_token') {
                        return query('UPDATE users SET device_token = NULL WHERE id = $1', [user!.id]);
                    }
                })
                .catch((err: any) => console.error('[NOTIF_FCM_ERR]', err.message))
        );
    }

    // Web-push (VAPID) — for browser customers
    if (channels.includes('push') && prefs.push_enabled) {
        tasks.push(
            pushService.sendNotificationToUser(user.id, { title, body })
                .catch(() => {}) // non-fatal
        );
    }

    // WhatsApp
    if (channels.includes('whatsapp') && prefs.whatsapp_enabled) {
        tasks.push(sendWhatsApp(user.phone, waText).catch(() => {}));
    }

    // Store in notifications table (in-app bell)
    tasks.push(
        query(
            `INSERT INTO notifications (user_id, type, title, body, data, channel, delivery_status)
             VALUES ($1, $2, $3, $4, $5, $6, 'sent')`,
            [user.id, type, title, body, JSON.stringify(vars), channels[0] ?? 'push']
        ).then(() => {
            emitToUser(user!.id, 'new_notification', { type, title, body });
        }).catch(err => console.error('[NOTIF_DB_ERR]', err.message))
    );

    await Promise.allSettled(tasks);
}

// ─── Broadcast helper ─────────────────────────────────────────────────────────

export async function broadcastNotification(
    userIds: string[], title: string, body: string
) {
    const BATCH = 50;
    for (let i = 0; i < userIds.length; i += BATCH) {
        const batch = userIds.slice(i, i + BATCH);
        await Promise.allSettled(
            batch.map(uid =>
                sendNotification('broadcast_message', {
                    userId: uid,
                    vars: { title, body },
                })
            )
        );
    }
}

// ─── WhatsApp via Interakt ────────────────────────────────────────────────────

async function sendWhatsApp(rawPhone: string, message: string) {
    if (!process.env.INTERAKT_API_KEY) {
        console.log(`[WA_SIM] ${rawPhone} | ${message}`);
        return;
    }
    try {
        const digits    = rawPhone.replace(/\D/g, '');
        const full      = digits.startsWith('91') ? digits : `91${digits.slice(-10)}`;
        const countryCode = '91';
        const number    = full.slice(2); // 10-digit

        await axios.post(
            'https://api.interakt.ai/v1/public/message/',
            { countryCode, phoneNumber: number, type: 'Text', data: { message } },
            {
                headers: {
                    Authorization: `Basic ${process.env.INTERAKT_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                timeout: 8000,
            }
        );
    } catch (err: any) {
        console.error('[WA_ERROR]', err?.response?.data || err.message);
        await sendSMS(rawPhone, message);
    }
}

// ─── SMS fallback via MSG91 ───────────────────────────────────────────────────

async function sendSMS(phone: string, message: string) {
    if (!process.env.MSG91_AUTH_KEY) {
        console.log(`[SMS_SIM] ${phone} | ${message}`);
        return;
    }
    try {
        await axios.post(
            'https://control.msg91.com/api/v5/flow/',
            { flow_id: process.env.MSG91_FLOW_ID, sender: process.env.MSG91_SENDER_ID, mobiles: phone, message },
            { headers: { authkey: process.env.MSG91_AUTH_KEY }, timeout: 8000 }
        );
    } catch (err: any) {
        console.error('[SMS_ERROR]', err?.response?.data || err.message);
    }
}

// ─── Legacy class wrapper — keeps old call sites working ─────────────────────

export class NotificationService {
    static async send(type: NotifType, data: any) {
        const { userId, phone, displayId, orderId, riderName, otp, minutes, amount, upiId, count, message, title, body } = data;
        await sendNotification(type, {
            userId: userId || undefined,
            phone: phone || undefined,
            vars: {
                displayId:  String(displayId  ?? ''),
                orderId:    String(orderId    ?? ''),
                riderName:  String(riderName  ?? ''),
                otp:        String(otp         ?? ''),
                minutes:    String(minutes     ?? ''),
                amount:     String(amount      ?? ''),
                upiId:      String(upiId       ?? ''),
                count:      String(count       ?? ''),
                message:    String(message     ?? ''),
                title:      String(title       ?? ''),
                body:       String(body        ?? ''),
            },
            dedupeKey: displayId || undefined,
        });
    }
}
