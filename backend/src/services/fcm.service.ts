import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

let app: App | null = null;

const DEFAULT_SERVICE_ACCOUNT = {
    type: "service_account",
    project_id: "qqtt-ddd83",
    private_key_id: "52362073166770c9a1228adcb0ce74b05e0f72d4",
    private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCkSBDwT3gioA+0\nsROZQdwcgA6UDP+llW44aJ67BszbGUDBXKqTJRkjCz7JcZzTicQEUiOrqiYh23Iz\nCK7J6HqYtxQYuUquy3ADRtcj9kk8Scn8unwh0AG1No2S1uF4ruGa5aWORJj3dAnN\nkXdu/c5FHvxhQYswcUAJbVOrvR6f1QtB+XaqHMKk4kQNF4HVP3uBl9P7YcJyZ04F\n5IionYLI73gwAxHeFxC52Jeg4u15oYQohzcLYt5S62aYEoRpPLBcfMy2lybK4pe9\nD0GxJQ8bCEszIuHugWYNKa7A+ajnwSHMdpzl8VhxFDR/IDwKxKtpwcfM4Ih9pgt2\ncHgl8ucfAgMBAAECggEAOVZDvzPlWKRnxud00S0o3zOcovSkd0zfwsVU/S7C6gd2\nz+YBTMkKbG481D8YfsZbCS0H8R66H2ABjClQI/1FaK6hT33AQKCVcDdV2GHZrraM\nTm5h68U3C2HGaMUhvaa/6/mR3kU35En2L+7A8haYWwyVBnbDVz13nbKwHMUtfpfk\nHTsTuSI3kVtedRPEQIXNSXiDLkFKBeHxYhKq7QH3tnlFsnHzLWsZEk5FQjj2vAoL\nJc01Uc0JSjuvLHxl3irp6jQ2W8Drd/h398sQkHSZpB62uWHszot1jjb5q0BuDS6Q\nwMVoKEuNyWPyzXKEAHAsT8UG7myAoD06A3I1FtgQwQKBgQDRxEQd4572izl12W9B\nzLABfADQLSZMAk3IMEgsYWIPHVQ4oFvmf/kdjRzMGr7Zrmkjq36Kp1rgFZWU4dOt\ngMnOmNER/zH/PGfdtzK56uerFqy56DKQGR5LIzI1qXt4UtIPWmlArFTWnAVfOZnC\nyNUElftkiYuHhJ9p7/PEHLs23wKBgQDIfWBG560jGx7jfsIx8IIdlBr46xuilp93\nLxWnV0nQdUwnDze5SgY3p21zSsD0uB+iiih5XcmnGIIePaallvqmqHp74Rwz3+QB\nOqAvS73bXEAA4DRkkE009hqjuaFUSHDfNG7SJx09+z97hjBliazCi3tqe36Dq40O\nHRtBE6+XwQKBgF4mUEh2DLgtvwmVISmQXIMeDCNj0GeXNSAgA5Tf1KpiCJYt63Gm\niMJpvr4hVv3PGWOoKnDDMreXGH8taNvcDTgMQPJp7x/XFeteuYbW10pkL/x1KpSg\noYcp8fRB8KgNzDiV5N3hO2bjukmGSewyReH8C0yRq62UqhRbXbbtCl5TAoGANqog\nrxSKG5FQebzdHBq0j3YLaKVKEqm47xkycT8WjDT/P4MhsW6ihVgsOow+UjtFvN6o\nrHbK/blr+OzcXDfvPbOgOdimBOrd0wv2Ew82w/HCLbrz7ht+QZt8pfl+KGncBK/a\nK4ioq3au13I+DeFc7mpzixQC6cnDmv6KqNLCRMECgYEAksZuufmjeIlVoK2KfzJ4\nYKj9x7kfbOJz9pwOQXYGik0MmzjtT4SEWYIv86e8dHaTwalfxyiEe4ZWtop3IViZ\nXE8R+aPv/sH4z9UnPJQM3H0PwV7XR1JTkjd9UW0raF17fau0Qfvj0XMPBKzeQJoP\nVZMFHqv39X309KC+ItFnS5o=\n-----END PRIVATE KEY-----\n",
    client_email: "firebase-adminsdk-fbsvc@qqtt-ddd83.iam.gserviceaccount.com",
    client_id: "108268321947046671702",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40qqtt-ddd83.iam.gserviceaccount.com",
    universe_domain: "googleapis.com"
};

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
    if (raw) {
        try {
            const sa = JSON.parse(raw);
            if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n');
            return sa;
        } catch (e) {
            console.error('[FCM] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', e);
        }
    }

    // Fallback: Return embedded production project credentials
    return DEFAULT_SERVICE_ACCOUNT;
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
        // Pure data-only payload forces Notifee native module to handle high-importance heads-up banner rendering
        const skipNotif = true;
        const channelId = data.android_channel_id || 
            (data.type === 'broadcast_message' || data.type === 'promo' || data.type === 'offer' ? 'promotions_v5' : 'order_updates_v5');
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
