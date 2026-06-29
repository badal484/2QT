import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

let app: App | null = null;

function parseServiceAccount(): any | null {
    // Prefer base64-encoded version — immune to newline/escaping issues in env var editors
    const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
    if (b64) {
        try {
            return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
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
        console.warn('[FCM] No Firebase credentials — set FIREBASE_SERVICE_ACCOUNT_B64 or FIREBASE_SERVICE_ACCOUNT_JSON');
        return null;
    }
    try {
        app = initializeApp({ credential: cert(sa) });
        console.log('[FCM] Firebase Admin initialized ✓');
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
    return !!(process.env.FIREBASE_SERVICE_ACCOUNT_B64 || process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
}
