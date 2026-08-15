import { Platform, PermissionsAndroid } from 'react-native';
import { api } from '../api/client';
import { navigateFromNotification } from '../navigation/navigationRef';

let messagingInstance: any = null;
let initAttempted = false;

function getMessaging() {
    if (initAttempted) return messagingInstance;
    initAttempted = true;
    try {
        const mod = require('@react-native-firebase/messaging').default;
        messagingInstance = mod();
    } catch {
        // Firebase native module not available
    }
    return messagingInstance;
}

export async function registerDeviceToken() {
    const msg = getMessaging();
    if (!msg) {
        console.warn('[PUSH] Firebase messaging module not available');
        return;
    }
    try {
        let authStatus = await msg.hasPermission();
        if (authStatus < 1) {
            authStatus = await msg.requestPermission();
        }
        console.log('[PUSH] Notification permission status:', authStatus);
        
        const token = await msg.getToken();
        console.log('[PUSH] Got FCM token:', token ? token.slice(0, 20) + '…' : 'null');
        if (token) {
            await api.patch('/notifications/device-token', { token });
            console.log('[PUSH] Device token saved to backend ✓');
        } else {
            console.warn('[PUSH] FCM getToken() returned null — check Google Play Services');
        }
    } catch (err) {
        console.warn('[PUSH] Token registration failed:', err);
    }
}

export async function getCurrentDeviceToken(): Promise<string | null> {
    const msg = getMessaging();
    if (!msg) return null;
    try {
        const status = await msg.requestPermission();
        if (status < 1) return null;
        return await msg.getToken();
    } catch { return null; }
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
            const data = remoteMessage.data ?? {};
            let title = remoteMessage.notification?.title || data?.title || '';
            let body  = remoteMessage.notification?.body  || data?.body  || data?.message || '';

            if (!title && !body) {
                const TYPE_LABELS: Record<string, string> = {
                    order_confirmed:        'Order Confirmed! 🎉',
                    order_preparing:        'Your food is being prepared 👨‍🍳',
                    order_ready:            'Order Ready! 🛵',
                    order_out_for_delivery: 'Rider on the way! 🛵',
                    order_delivered:        'Order Delivered! 🎉',
                    order_cancelled:        'Order Cancelled',
                    rider_payout:           'Payment Sent! 💰',
                    broadcast_message:      '2QT Announcement',
                    new_kitchen_order:      '🍽️ New Order!',
                };
                title = TYPE_LABELS[data.type] || '2QT Notification';
            }

            if (!title && !body) return; // Prevent blank 2QT notifications

            onMessage(title, body, data);
        });
    } catch {
        return () => {};
    }
}

// App was in background (not killed) — user tapped notification
export function subscribeToNotificationTap() {
    const msg = getMessaging();
    if (!msg) return () => {};
    try {
        return msg.onNotificationOpenedApp((remoteMessage: any) => {
            const data = remoteMessage?.data ?? {};
            console.log('[PUSH] Notification tapped (background):', data.type);
            navigateFromNotification(data);
        });
    } catch {
        return () => {};
    }
}

// App was killed — user tapped notification to launch app
export async function handleInitialNotification() {
    const msg = getMessaging();
    if (!msg) return;
    try {
        const remoteMessage = await msg.getInitialNotification();
        if (remoteMessage) {
            const data = remoteMessage?.data ?? {};
            console.log('[PUSH] App launched from notification:', data.type);
            // Small delay so NavigationContainer is ready
            setTimeout(() => navigateFromNotification(data), 1500);
        }
    } catch {
        // ignore
    }
}

export function setupBackgroundHandler() {
    // Background message handler is registered at top-level in index.js to prevent duplicate registration race conditions.
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
