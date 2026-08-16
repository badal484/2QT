import 'react-native-reanimated';
import { AppRegistry } from 'react-native';
import { enableScreens } from 'react-native-screens';
import App from './App';
import { name as appName } from './app.json';

enableScreens(false);

// Top-level FCM Background & Killed State Message Handler
try {
    const messaging = require('@react-native-firebase/messaging').default;
    messaging().setBackgroundMessageHandler(async remoteMessage => {
        console.log('[FCM Background] Remote message received:', remoteMessage);
        const notification = remoteMessage?.notification;
        const data = remoteMessage?.data || {};

        const title = notification?.title || data.title || '2QT Alert';
        const body = notification?.body || data.body || data.message || '';
        const appType = data.appType || 'buyer';

        const channelId = appType === 'kitchen' ? 'kitchen_orders' : (appType === 'rider' ? 'rider_alerts' : 'order_updates');

        try {
            const notifeePackage = require('@notifee/react-native');
            const notifee = notifeePackage.default;
            const AndroidImportance = notifeePackage.AndroidImportance || { HIGH: 4 };

            await notifee.displayNotification({
                title,
                body,
                data: data,
                android: {
                    channelId,
                    importance: AndroidImportance.HIGH,
                    pressAction: {
                        id: 'default',
                    },
                },
            });
        } catch (e) {
            console.warn('[FCM Background] Display notification error:', e);
        }
    });
} catch (e) {
    console.warn('[FCM Background] Messaging module fallback in index.js:', e);
}

AppRegistry.registerComponent(appName, () => App);
