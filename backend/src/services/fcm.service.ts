import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

let app: App | null = null;

function getApp(): App | null {
    if (app) return app;
    if (getApps().length) { app = getApps()[0]; return app; }

    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) {
        console.warn('[FCM] FIREBASE_SERVICE_ACCOUNT_JSON not set — push disabled.');
        return null;
    }
    try {
        app = initializeApp({ credential: cert(JSON.parse(raw)) });
        console.log('[FCM] Firebase Admin initialized');
    } catch (err) {
        console.error('[FCM] Init failed:', err);
    }
    return app;
}

export async function sendFCM(
    token: string,
    title: string,
    body: string,
    data: Record<string, string> = {}
): Promise<'ok' | 'invalid_token' | 'skipped'> {
    const a = getApp();
    if (!a) return 'skipped';

    try {
        await getMessaging(a).send({
            token,
            notification: { title, body },
            data,
            android: {
                priority: 'high',
                notification: { sound: 'default', channelId: 'order_updates' },
            },
            apns: {
                payload: { aps: { alert: { title, body }, sound: 'default', badge: 1 } },
            },
        });
        return 'ok';
    } catch (err: any) {
        const stale = [
            'messaging/registration-token-not-registered',
            'messaging/invalid-registration-token',
        ];
        if (stale.includes(err.code)) return 'invalid_token';
        console.error('[FCM_ERROR]', err.message);
        throw err;
    }
}

export function isFCMConfigured() {
    return !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
}
