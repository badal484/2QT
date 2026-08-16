import axios from 'axios';
import { query } from '../db';
import { redis } from '../redis';
import { sendFCM } from './fcm.service';
import { pushService } from './push.service'; // web-push VAPID for browser
import { emitToUser } from '../socket';

export type NotifType =
    | 'order_confirmed' | 'order_preparing' | 'order_packing' | 'order_ready'
    | 'order_out_for_delivery' | 'order_delivered' | 'order_cancelled'
    | 'rider_payout' | 'kitchen_payout' | 'low_subscription_meals'
    | 'rider_verified' | 'cash_submitted' | 'broadcast_message' | 'chat_message'
    | 'low_stock_alert' | 'rider_guarantee_payout' | 'renewal_reminder' | 'generic_sms'
    | 'rider_at_door';

const PROMO_TYPES   = new Set(['broadcast_message', 'winback', 'birthday', 'flash_sale', 'renewal_reminder']);
const PAYOUT_TYPES  = new Set(['rider_payout', 'kitchen_payout', 'rider_guarantee_payout']);
const TEMPLATE_CACHE_TTL = 300; // 5 min

// ─── Hardcoded fallback templates (used when DB table is empty / migration not run) ──

const FALLBACK_TEMPLATES: Record<string, { title_template: string; body_template: string; channels: string[] }> = {
    order_confirmed:        { title_template: 'Order Confirmed! 🎉', body_template: 'Your order #{{displayId}} is confirmed — ~{{minutes}} mins.', channels: ['push', 'whatsapp'] },
    order_preparing:        { title_template: 'Chefs are cooking! 👨‍🍳', body_template: 'Your meal is being freshly prepared right now.', channels: ['push'] },
    order_packing:          { title_template: 'Packing your order! 📦', body_template: 'Your food is cooked and being packed right now.', channels: ['push'] },
    order_ready:            { title_template: 'Order Ready! 🛵', body_template: 'Your order is packed and a rider is on the way.', channels: ['push', 'whatsapp'] },
    order_out_for_delivery: { title_template: '{{riderName}} is heading to you! 🛵', body_template: 'Your rider is on the way. OTP: {{otp}} — share only at door.', channels: ['push', 'whatsapp'] },
    order_delivered:        { title_template: 'Delivered! 🎉', body_template: 'Your order has been delivered. Rate your experience!', channels: ['push', 'whatsapp'] },
    order_cancelled:        { title_template: 'Order Cancelled', body_template: 'Order #{{displayId}} cancelled. ₹{{amount}} refunded to your wallet.', channels: ['push', 'whatsapp'] },
    rider_payout:           { title_template: 'Payment Sent! 💰', body_template: '₹{{amount}} sent to {{upiId}} — great work today!', channels: ['push', 'whatsapp'] },
    kitchen_payout:         { title_template: 'Settlement Done! 💰', body_template: '₹{{amount}} transferred to {{upiId}} for today\'s orders.', channels: ['push', 'whatsapp'] },
    low_subscription_meals: { title_template: 'Low Meal Balance ⚠️', body_template: 'Only {{count}} meals left in your plan. Renew soon!', channels: ['push'] },
    rider_verified:         { title_template: 'You\'re Approved! 🏍️', body_template: 'Your rider account is live. Go online and start earning!', channels: ['push', 'whatsapp'] },
    broadcast_message:      { title_template: '{{title}}', body_template: '{{body}}', channels: ['push', 'whatsapp'] },
    cash_submitted:         { title_template: 'Cash Submission', body_template: 'Rider {{riderName}} submitted ₹{{amount}} cash for Order #{{displayId}}.', channels: ['push'] },
    generic_sms:            { title_template: '{{title}}', body_template: '{{message}}', channels: ['whatsapp'] },
    chat_message:           { title_template: '{{title}}', body_template: '{{senderName}}: {{message}}', channels: ['push'] },
    rider_at_door:          { title_template: 'Your rider is at the door!', body_template: 'Your rider is waiting outside. Please come to the door — order #{{displayId}} is here!', channels: ['push', 'whatsapp'] },
    low_stock_alert:        { title_template: 'Low Stock Alert', body_template: '{{itemName}} is running low — only {{remaining}} left. Restock soon.', channels: ['push'] },
    rider_guarantee_payout: { title_template: 'Earnings Top-Up Added', body_template: '₹{{amount}} guarantee top-up has been added to your earnings for today.', channels: ['push'] },
};

// ─── Template cache ───────────────────────────────────────────────────────────

async function loadTemplate(type: NotifType) {
    const key = `notif_tmpl:${type}`;
    const cached = await redis.get(key).catch(() => null);
    if (cached) return JSON.parse(cached);

    try {
        const { rows } = await query(
            'SELECT * FROM notification_templates WHERE type = $1 AND is_active = TRUE',
            [type]
        );
        if (rows.length) {
            await redis.setEx(key, TEMPLATE_CACHE_TTL, JSON.stringify(rows[0])).catch(() => {});
            return rows[0];
        }
    } catch {
        // notification_templates table might not exist yet (migration not run)
    }

    // Fallback to hardcoded templates
    const fallback = FALLBACK_TEMPLATES[type] || { title_template: '{{title}}', body_template: '{{body}}', channels: ['push', 'whatsapp'] };
    return { ...fallback, whatsapp_template: fallback.body_template };
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
    title?: string;
    body?: string;
    vars?: Record<string, string>;
    dedupeKey?: string;
    overrideChannels?: ('push' | 'whatsapp' | 'sms')[];
    imageUrl?: string;
    overrideQuietHours?: boolean;
}

export async function sendNotification(type: NotifType, options: SendOptions): Promise<void> {
    try {
        const { notificationsQueue } = require('../jobs/queues');
        // BullMQ's Redis connection is configured with maxRetriesPerRequest: null (required by
        // BullMQ), which means a struggling/unreachable Redis makes .add() retry indefinitely
        // instead of failing fast. Bound it explicitly so a Redis outage falls back to direct
        // delivery within a few seconds instead of hanging this call (and, since callers like
        // admin.ts's broadcast loop await each batch, potentially the whole batch) forever.
        await Promise.race([
            (notificationsQueue as any).add(type, { ...options, _queuedOptions: true }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('QUEUE_ADD_TIMEOUT')), 3000)),
        ]);
    } catch (e: any) {
        console.warn(`[NOTIF] Queue add failed for type=${type} (delivering directly):`, e.message);
        deliverNotification(type, options).catch(err => console.error('[NOTIF_DIRECT_DELIVERY_ERR]', err.message));
    }
}

// Actual delivery — called by the worker. Do NOT call from HTTP handlers (blocks response).
export async function deliverNotification(type: NotifType, options: SendOptions): Promise<void> {
    const { userId, phone, vars = {}, dedupeKey, overrideChannels, imageUrl } = options;

    // 1. Resolve user
    let user: { id: string; phone: string; device_token: string | null; name: string } | null = null;
    if (userId) {
        const { rows } = await query('SELECT id, phone, COALESCE(device_token, fcm_token) AS device_token, name, role FROM users WHERE id = $1', [userId]);
        user = rows[0] ?? null;
    } else if (phone) {
        const { rows } = await query("SELECT id, phone, COALESCE(device_token, fcm_token) AS device_token, name FROM users WHERE phone = $1 AND COALESCE(device_token, fcm_token) IS NOT NULL ORDER BY (role = 'customer') DESC, updated_at DESC", [phone]);
        user = rows[0] ?? null;
    }
    if (!user) {
        console.warn(`[NOTIF] User not found type=${type} userId=${userId} phone=${phone}`);
        return;
    }

    // Fallback: If target user row has no device token, check if any active user account with the same phone and role has one
    if (!user.device_token && user.phone) {
        const cleanPhone = user.phone.replace(/\D/g, '').slice(-10);
        const userRole = (user as any).role || 'customer';
        const { rows: siblingRows } = await query(
            "SELECT COALESCE(device_token, fcm_token) AS device_token FROM users WHERE (phone = $1 OR RIGHT(REGEXP_REPLACE(phone, '\\D', '', 'g'), 10) = $2) AND LOWER(role::text) = LOWER($3) AND COALESCE(device_token, fcm_token) IS NOT NULL ORDER BY updated_at DESC LIMIT 1",
            [user.phone, cleanPhone, userRole]
        );
        if (siblingRows[0]?.device_token) {
            user.device_token = siblingRows[0].device_token;
            query('UPDATE users SET device_token = $1, fcm_token = $1 WHERE id = $2', [user.device_token, user.id]).catch(() => {});
        }
    }

    // 2. Deduplicate within 60 s (non-fatal — skip dedup if Redis is down)
    if (dedupeKey) {
        try {
            const dk = `notif:${user.id}:${type}:${dedupeKey}`;
            if (await redis.get(dk)) return; // already sent
            await redis.setEx(dk, 60, '1');
        } catch (e) {
            console.warn('[NOTIF] Redis dedup failed (proceeding anyway):', (e as Error).message);
        }
    }

    // 3. Load template
    const tmpl = await loadTemplate(type);
    if (!tmpl) {
        console.warn(`[NOTIF] No active template for type=${type}`);
        return;
    }

    // 4. Check user preferences (non-fatal — default to all enabled if table missing)
    let prefs = { order_updates: true, promotions: true, payouts: true, push_enabled: true, whatsapp_enabled: true };
    try {
        const { rows: pRows } = await query(
            'SELECT * FROM notification_preferences WHERE user_id = $1',
            [user.id]
        );
        if (pRows[0]) prefs = pRows[0];
    } catch {
        // notification_preferences table may not exist yet — proceed with defaults
    }
    if (PROMO_TYPES.has(type) && !prefs.promotions) return;
    if (PAYOUT_TYPES.has(type) && !prefs.payouts) return;

    // 5. Quiet hours (10pm–8am IST) and rate limit for promotional messages
    if (PROMO_TYPES.has(type) && !options.overrideQuietHours) {
        // IST = UTC+5:30
        const nowIST = new Date(Date.now() + 330 * 60 * 1000);
        const hourIST = nowIST.getUTCHours();
        if (hourIST >= 22 || hourIST < 8) {
            console.log(`[NOTIF] Quiet hours — skipping promo type=${type} user=${user.id}`);
            return;
        }
        // Max 3 promotional pushes per user per hour
        try {
            const rateKey = `notif_rate:${user.id}:promo`;
            const count = await redis.incr(rateKey);
            if (count === 1) await redis.expire(rateKey, 3600);
            if (count > 3) {
                console.log(`[NOTIF] Rate limit — skipping promo type=${type} user=${user.id}`);
                return;
            }
        } catch {
            // Redis down — proceed without rate limiting
        }
    }

    // 6. Build content
    const title   = options.title || vars.title || interpolate(tmpl.title_template, vars);
    const body    = options.body  || vars.body  || interpolate(tmpl.body_template, vars);
    const waText  = options.body  || vars.body  || interpolate(tmpl.whatsapp_template || tmpl.body_template, vars);
    const channels: string[] = overrideChannels ?? tmpl.channels ?? ['push', 'whatsapp'];

    // 7. Insert to DB first so we get notifId to embed in FCM data (enables click tracking)
    let notifId: string | undefined;
    const initialStatus = user.device_token ? 'sent' : 'no_device_token';
    try {
        const { rows: notifRows } = await query(
            `INSERT INTO notifications (user_id, type, title, body, data, channel, delivery_status)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
            [user.id, type, title, body, JSON.stringify(vars), channels[0] ?? 'push', initialStatus]
        );
        notifId = notifRows[0]?.id;
        emitToUser(user.id, 'new_notification', { type, title, body, notifId });
    } catch (err: any) {
        console.error('[NOTIF_DB_ERR]', err.message);
    }

    // 8. Dispatch channels in parallel (fire-and-forget individually)
    const rawData: Record<string, any> = {
        type,
        title,
        body,
        ...(imageUrl ? { imageUrl, image: imageUrl } : {}),
        ...vars,
        ...(notifId ? { notifId } : {})
    };
    const fcmData: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawData)) {
        if (v !== undefined && v !== null) {
            fcmData[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
        }
    }
    const tasks: Promise<any>[] = [];

    // FCM mobile push
    if (channels.includes('push') && prefs.push_enabled) {
        if (!user.device_token) {
            console.warn(`[NOTIF_LOGGER] ❌ Skipping FCM push for type=${type} user=${user.id} (${user.phone}) — REASON: device_token is NULL in DB (user has not registered FCM token or is logged out)`);
            if (notifId) {
                query("UPDATE notifications SET delivery_status = 'no_device_token' WHERE id = $1", [notifId]).catch(() => {});
            }
        } else {
            console.log(`[NOTIF_LOGGER] 🚀 Dispatching FCM push type=${type} to user=${user.id} token=${(user.device_token as string).slice(0, 15)}...`);
            tasks.push(
                sendFCM(user.device_token, title, body, fcmData, imageUrl)
                    .then((result: any) => {
                        console.log(`[NOTIF_LOGGER] 📊 FCM result=${result} for type=${type} user=${user!.id}`);
                        if (result === 'invalid_token') {
                            console.warn(`[NOTIF_LOGGER] ⚠️ Stale token cleared from DB for user=${user!.id}`);
                            query("UPDATE notifications SET delivery_status = 'invalid_token' WHERE id = $1", [notifId]).catch(() => {});
                            return query('UPDATE users SET device_token = NULL WHERE id = $1', [user!.id]);
                        } else if (result === 'skipped' && notifId) {
                            query("UPDATE notifications SET delivery_status = 'skipped' WHERE id = $1", [notifId]).catch(() => {});
                        }
                    })
                    .catch((err: any) => {
                        console.error('[NOTIF_LOGGER] ❌ FCM Dispatch Error:', err.message);
                        if (notifId) query("UPDATE notifications SET delivery_status = 'failed' WHERE id = $1", [notifId]).catch(() => {});
                    })
            );
        }
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

// ─── Rider zone FCM push (new delivery available in the pool) ────────────────
// The mission-pool broadcast (emitToRiders('new_available_mission', ...)) is
// Socket.IO-only — it never reaches a rider whose app isn't open and connected.
// This is the push counterpart: same audience, delivered via FCM so it still
// arrives when the app is backgrounded or fully closed. Kept as a direct
// per-rider sendFCM (not routed through deliverNotification's per-user DB
// insert/template lookup) since this can fan out to many riders in a zone and
// is inherently ambient/best-effort, not a per-user transactional record.
export async function notifyRidersInZone(
    zoneId: string,
    title: string,
    body: string,
    data: Record<string, string> = {}
): Promise<void> {
    try {
        const { rows } = await query(
            `SELECT device_token FROM users
             WHERE role IN ('rider', 'rider_captain')
               AND zone_id = $1
               AND is_online = TRUE
               AND is_active = TRUE
               AND device_token IS NOT NULL`,
            [zoneId]
        );
        const sends = rows.map(({ device_token }: { device_token: string }) =>
            sendFCM(
                device_token,
                title,
                body,
                { type: 'new_available_mission', android_channel_id: 'order_dispatch_v2', sound: 'alert', ...data },
                undefined,
                true // data-only — Notifee renders the full-screen dispatch alert reliably in bg/killed
            ).catch(() => {})
        );
        await Promise.allSettled(sends);
    } catch (err) {
        console.error('[NOTIF] notifyRidersInZone failed:', err);
    }
}

// ─── Kitchen staff FCM push (background alert for new orders) ────────────────
// Sends FCM push to all active kitchen staff of the given kitchenId so they
// get an alert even when the app is backgrounded (socket closes in background).
export async function notifyKitchenStaff(
    kitchenId: string,
    title: string,
    body: string,
    data: Record<string, string> = {}
): Promise<void> {
    try {
        const { rows } = await query(
            `SELECT device_token FROM users
             WHERE kitchen_id = $1
               AND role IN ('chef', 'kitchen_manager', 'packer', 'partner_kitchen')
               AND device_token IS NOT NULL
               AND is_active = TRUE`,
            [kitchenId]
        );
        const sends = rows.map(({ device_token }: { device_token: string }) =>
            sendFCM(
                device_token, 
                title, 
                body, 
                { ...data, body, sound: 'alert', android_channel_id: 'order_dispatch_v2' },
                undefined,
                true // data-only — Notifee renders the full-screen dispatch alert reliably in bg/killed
            ).catch(() => {})
        );
        await Promise.allSettled(sends);
    } catch (err) {
        console.error('[NOTIF] notifyKitchenStaff failed:', err);
    }
}

// ─── Legacy class wrapper — keeps flat-data call sites (routes, workers) working ──

export class NotificationService {
    static async send(type: NotifType, data: any) {
        const { userId, phone, displayId, orderId, riderName, otp, minutes, amount, upiId, count, message, title, body, imageUrl, screen, bookingId, ticketId, senderName, timestamp, overrideQuietHours } = data;
        // Calls deliverNotification directly — no re-queueing (used by the worker itself)
        await deliverNotification(type, {
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
                screen:     String(screen      ?? ''),
                bookingId:  String(bookingId   ?? ''),
                ticketId:   String(ticketId    ?? ''),
                senderName: String(senderName  ?? ''),
                timestamp:  String(timestamp   ?? ''),
            },
            dedupeKey: displayId || undefined,
            imageUrl:  imageUrl  || undefined,
            overrideQuietHours: !!overrideQuietHours,
        });
    }
}
