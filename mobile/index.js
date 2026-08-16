import 'react-native-reanimated';
import { AppRegistry } from 'react-native';
import { enableScreens } from 'react-native-screens';
import App from './App';
import { name as appName } from './app.json';

import messaging from '@react-native-firebase/messaging';
import { safeNotifee, AndroidImportance } from './src/services/notifeeSafe';

enableScreens(false);

// Top-level FCM Background & Killed State Message Handler
try {
    messaging().setBackgroundMessageHandler(async remoteMessage => {
        console.log('[FCM Background] Remote message received:', remoteMessage);
        
        // If Android OS native FCM SDK already displayed the notification banner (notification object exists),
        // suppress duplicate JS Notifee display call to prevent double banners on system tray.
        if (remoteMessage?.notification) {
            console.log('[FCM Background] Native FCM banner rendered by Android OS. Suppressing duplicate JS banner.');
            return;
        }

        const notification = remoteMessage?.notification;
        const data = remoteMessage?.data || {};
        const title = (notification?.title || data.title || '').trim();
        const body = (notification?.body || data.body || data.message || '').trim();
        const appType = data.appType || 'buyer';

        // If message has neither title nor body, treat as silent background data event and do not display banner
        if (!title && !body) {
            console.log('[FCM Background] Skipping silent message banner with empty title/body');
            return;
        }

        const channelId = appType === 'kitchen' ? 'kitchen_orders' : (appType === 'rider' ? 'rider_alerts' : 'order_updates');

        if (safeNotifee.isAvailable) {
            await safeNotifee.displayNotification({
                title,
                body,
                android: {
                    channelId,
                    importance: AndroidImportance.HIGH,
                    pressAction: {
                        id: 'default',
                    },
                },
                data,
            });
        }
    });
} catch (e) {
    console.warn('[FCM Background] Messaging setBackgroundMessageHandler error:', e);
}

if (safeNotifee.isAvailable) {
    try {
        safeNotifee.onBackgroundEvent(async ({ type, detail }: any) => {
            console.log('[Notifee Background Event]', type, detail?.notification?.title);
        });
    } catch (e) {
        console.warn('[Notifee Background Event Handler Registration Error]', e);
    }
}

AppRegistry.registerComponent(appName, () => App);
