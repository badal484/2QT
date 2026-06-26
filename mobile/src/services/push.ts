import { api } from '../api/client';

let messagingInstance: any = null;
let initAttempted = false;

// Returns the initialized messaging instance, or null if Firebase isn't available.
// Calling the messaging factory (mod()) triggers firebase.app() — keep it inside try/catch.
function getMessaging() {
    if (initAttempted) return messagingInstance;
    initAttempted = true;
    try {
        const mod = require('@react-native-firebase/messaging').default;
        messagingInstance = mod();
    } catch {
        // Firebase native module not available (New Architecture interop not wired)
    }
    return messagingInstance;
}

export async function registerDeviceToken() {
    const msg = getMessaging();
    if (!msg) return;
    try {
        const authStatus = await msg.requestPermission();
        // AUTHORIZED = 1, PROVISIONAL = 2
        if (authStatus < 1) return;

        const token = await msg.getToken();
        if (token) {
            await api.patch('/notifications/device-token', { token });
            console.log('[PUSH] Device token registered');
        }
    } catch (err) {
        console.warn('[PUSH] Token registration failed:', err);
    }
}

export function subscribeToTokenRefresh() {
    const msg = getMessaging();
    if (!msg) return () => {};
    try {
        return msg.onTokenRefresh(async (token: string) => {
            try { await api.patch('/notifications/device-token', { token }); } catch {}
        });
    } catch {
        return () => {};
    }
}

export function subscribeToForegroundMessages(
    onMessage: (title: string, body: string, data: Record<string, string>) => void
) {
    const msg = getMessaging();
    if (!msg) return () => {};
    try {
        return msg.onMessage(async (remoteMessage: any) => {
            const title = remoteMessage.notification?.title ?? '';
            const body  = remoteMessage.notification?.body  ?? '';
            const data  = remoteMessage.data ?? {};
            onMessage(title, body, data);
        });
    } catch {
        return () => {};
    }
}

export function setupBackgroundHandler() {
    const msg = getMessaging();
    if (!msg) return;
    try {
        msg.setBackgroundMessageHandler(async (_remoteMessage: any) => {});
    } catch {}
}

export async function getInitialNotification() {
    const msg = getMessaging();
    if (!msg) return null;
    try {
        return msg.getInitialNotification();
    } catch {
        return null;
    }
}
