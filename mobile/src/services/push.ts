import { Platform, PermissionsAndroid } from 'react-native';
import { api } from '../api/client';
import { getItem } from '../utils/storage';
import { navigateFromNotification } from '../navigation/navigationRef';

let messagingInstance: any = null;

function getMessaging() {
    if (messagingInstance) return messagingInstance;
    try {
        const mod = require('@react-native-firebase/messaging').default;
        messagingInstance = mod();
    } catch (e: any) {
        console.warn('[PUSH_LOGGER] Firebase native module load error:', e?.message || e);
        messagingInstance = null;
    }
    return messagingInstance;
}

export async function registerDeviceToken(retries = 3, explicitPhone?: string) {
    const msg = getMessaging();
    if (!msg) {
        console.warn('[PUSH_LOGGER] ❌ Firebase messaging module not available on device');
        return;
    }
    try {
        let authStatus = await msg.hasPermission();
        if (authStatus < 1) {
            authStatus = await msg.requestPermission();
        }
        console.log('[PUSH_LOGGER] 📱 Notification permission status code:', authStatus, '(1=Authorized, 0=Denied)');
        
        let token = await msg.getToken();
        let attempt = 0;
        while (!token && attempt < retries) {
            attempt++;
            console.log(`[PUSH_LOGGER] ⏳ Retrying getToken() attempt ${attempt}/${retries}...`);
            await new Promise(r => setTimeout(r, 1500 * attempt));
            token = await msg.getToken();
        }

        console.log('[PUSH_LOGGER] 🔑 FCM Token:', token ? `${token.slice(0, 25)}...` : 'NULL');
        if (token) {
            let apiAttempt = 0;
            let saved = false;
            while (!saved && apiAttempt < retries) {
                try {
                    apiAttempt++;
                    let userPhone = explicitPhone;
                    if (!userPhone) {
                        try {
                            const m = require('../store');
                            const s = (m.store || m.default || m)?.getState?.();
                            userPhone = s?.auth?.user?.phone || s?.user?.phone || undefined;
                        } catch {}
                    }
                    await api.patch('/notifications/device-token', { token, phone: userPhone });
                    console.log('[PUSH_LOGGER] ✅ Device token registered with backend database successfully (phone:', userPhone || 'none', ')');
                    saved = true;
                } catch (apiErr: any) {
                    const status = apiErr?.response?.status;
                    console.warn(`[PUSH_LOGGER] ⚠️ Failed to save token to backend (attempt ${apiAttempt}/${retries}):`, status || apiErr?.message);
                    if (apiAttempt < retries) {
                        await new Promise(r => setTimeout(r, 2000));
                    }
                }
            }
        } else {
            console.warn('[PUSH_LOGGER] ⚠️ FCM getToken() returned null — Google Play Services missing or unconfigured');
        }
    } catch (err: any) {
        console.warn('[PUSH_LOGGER] ❌ Token registration process error:', err?.message || err);
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
