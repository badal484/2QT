import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

let app: App | null = null;

export function parseServiceAccount(): any | null {
    // Prefer base64-encoded version — immune to newline/escaping issues in env var editors
    const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
    if (b64) {
        try {
            const sa = JSON.parse(Buffer.from(b64.trim(), 'base64').toString('utf8'));
            if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n');
            return sa;
        } catch (e) {
            console.error('[FCM] Failed to decode FIREBASE_SERVICE_ACCOUNT_B64:', e);
        }
    }

    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) return null;

    try {
        const sa = JSON.parse(raw);
        // Fix newlines corrupted by env var editors (literal \n → real newline)
        if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n');
        return sa;
    } catch (e) {
        console.error('[FCM] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', e);
        return null;
    }
}

function getApp(): App | null {
    if (app) return app;
    if (getApps().length) { app = getApps()[0]; return app; }

    const sa = parseServiceAccount();
    if (!sa) {
        console.warn('[FCM_DIAGNOSTIC] ❌ Firebase Admin skipped — No FIREBASE_SERVICE_ACCOUNT_B64 or FIREBASE_SERVICE_ACCOUNT_JSON configured on server');
        return null;
    }
    try {
        app = initializeApp({ credential: cert(sa) });
        console.log('[FCM_DIAGNOSTIC] ✅ Firebase Admin initialized successfully for project:', sa.project_id);
    } catch (err) {
        console.error('[FCM_DIAGNOSTIC] ❌ Firebase Admin init failed:', err);
    }
    return app;
}

export async function sendFCM(
    token: string,
    title: string,
    body: string,
    data: Record<string, string> = {},
    imageUrl?: string,
    dataOnly = false
): Promise<'ok' | 'invalid_token' | 'skipped'> {
    const a = getApp();
    if (!a) {
        console.warn('[FCM_SEND] ⚠️ FCM send skipped — Firebase Admin app is not initialized');
        return 'skipped';
    }

    try {
        const skipNotif = dataOnly;
        const channelId = data.android_channel_id || 
            (data.type === 'broadcast_message' || data.type === 'promo' || data.type === 'offer' ? 'promotions_v4' : 'order_updates_v4');
        const tokenPrefix = token ? `${token.slice(0, 15)}...` : 'NULL';
        const img = imageUrl || data.imageUrl || data.image || data.bannerUrl || undefined;

        console.log(`[FCM_SEND] 🚀 Sending push to token=${tokenPrefix} title="${title}" channelId=${channelId} img=${img || 'none'}`);

        await getMessaging(a).send({
            token,
            ...(!skipNotif ? { notification: { title, body, imageUrl: img } } : {}),
            data: {
                ...data,
                title,
                body,
                ...(img ? { imageUrl: img, image: img } : {}),
                android_channel_id: channelId,
            },
            android: {
                priority: 'high',
                ...(!skipNotif ? { 
                    notification: { 
                        title,
                        body,
                        sound: data.sound || 'default', 
                        channelId: channelId, 
                        icon: 'ic_notification',
                        imageUrl: img,
                        priority: 'high',
                        visibility: 'public',
                        defaultSound: true,
                        defaultVibrateTimings: true,
                    } 
                } : {}),
            },
            apns: {
                headers: {
                    'apns-priority': '10',
                    'apns-push-type': 'alert',
                },
                payload: { aps: { alert: { title, body }, sound: 'default', badge: 1, 'content-available': 1 } },
                fcmOptions: { imageUrl: img },
            },
        });
        console.log(`[FCM_SEND] ✅ FCM push delivered successfully to token=${tokenPrefix}`);
        return 'ok';
    } catch (err: any) {
        const stale = [
            'messaging/registration-token-not-registered',
            'messaging/invalid-registration-token',
        ];
        if (stale.includes(err.code)) {
            console.warn(`[FCM_SEND] ⚠️ Target token is invalid/stale: code=${err.code}`);
            return 'invalid_token';
        }
        console.error('[FCM_ERROR] ❌ FCM send failed:', err.code || err.message);
        throw err;
    }
}

export function isFCMConfigured() {
    return !!(process.env.FIREBASE_SERVICE_ACCOUNT_B64 || process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
}
