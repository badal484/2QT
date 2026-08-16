import 'react-native-reanimated';
import { AppRegistry } from 'react-native';
import { enableScreens } from 'react-native-screens';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';

enableScreens(false);

// Top-level FCM Background & Killed State Message Handler
messaging().setBackgroundMessageHandler(async remoteMessage => {
    console.log('[FCM Background] Remote message received:', remoteMessage);
    const notification = remoteMessage?.notification;
    const data = remoteMessage?.data || {};

    const title = notification?.title || data.title || '2QT Alert';
    const body = notification?.body || data.body || data.message || '';
    const appType = data.appType || 'buyer';

    const channelId = appType === 'kitchen' ? 'kitchen_orders' : (appType === 'rider' ? 'rider_alerts' : 'order_updates');

    try {
        await notifee.displayNotification({
            title,
            body,
            data,
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

AppRegistry.registerComponent(appName, () => App);
