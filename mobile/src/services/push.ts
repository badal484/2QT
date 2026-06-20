/**
 * FCM push notification service for React Native
 *
 * SETUP REQUIRED before this file works:
 *   1. npm install @react-native-firebase/app @react-native-firebase/messaging
 *   2. cd android && ./gradlew clean
 *   3. Add google-services.json to android/app/
 *   4. Follow RN Firebase setup guide for android/build.gradle patches
 *
 * Until the package is installed, every function below is a no-op so the
 * app still builds and runs.
 */

import { api } from '../api/client';

let messagingModule: any = null;

function getMessaging() {
    if (messagingModule) return messagingModule;
    try {
        messagingModule = require('@react-native-firebase/messaging').default;
    } catch {
        // Package not installed yet — silent no-op
    }
    return messagingModule;
}

// Register the device's FCM token with the backend
export async function registerDeviceToken() {
    const messaging = getMessaging();
    if (!messaging) return;

    try {
        const authStatus = await messaging().requestPermission();
        const granted = [
            messaging.AuthorizationStatus.AUTHORIZED,
            messaging.AuthorizationStatus.PROVISIONAL,
        ].includes(authStatus);
        if (!granted) return;

        const token = await messaging().getToken();
        if (token) {
            await api.patch('/notifications/device-token', { token });
            console.log('[PUSH] Device token registered');
        }
    } catch (err) {
        console.warn('[PUSH] Token registration failed:', err);
    }
}

// Refresh token if FCM rotates it
export function subscribeToTokenRefresh() {
    const messaging = getMessaging();
    if (!messaging) return () => {};

    const unsubscribe = messaging().onTokenRefresh(async (token: string) => {
        try {
            await api.patch('/notifications/device-token', { token });
        } catch {}
    });
    return unsubscribe;
}

// Handle notifications when app is in foreground
export function subscribeToForegroundMessages(
    onMessage: (title: string, body: string, data: Record<string, string>) => void
) {
    const messaging = getMessaging();
    if (!messaging) return () => {};

    return messaging().onMessage(async (remoteMessage: any) => {
        const title = remoteMessage.notification?.title ?? '';
        const body  = remoteMessage.notification?.body  ?? '';
        const data  = remoteMessage.data ?? {};
        onMessage(title, body, data);
    });
}

// Call once on app mount to handle tapped notifications (background → open)
export function setupBackgroundHandler() {
    const messaging = getMessaging();
    if (!messaging) return;

    messaging().setBackgroundMessageHandler(async (_remoteMessage: any) => {
        // Android only — iOS handled by system
    });
}

// Get the notification that launched the app from killed state
export async function getInitialNotification() {
    const messaging = getMessaging();
    if (!messaging) return null;
    return messaging().getInitialNotification();
}
