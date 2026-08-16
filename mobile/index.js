import 'react-native-reanimated';
import { AppRegistry } from 'react-native';
import { enableScreens } from 'react-native-screens';
import App from './App';
import { name as appName } from './app.json';

enableScreens(false);

// Pre-create notification channels & Notifee background event handlers at top-level native boot
try {
  const { createNotificationChannels, setupNotifeeHandlers } = require('./src/services/localNotif');
  setupNotifeeHandlers();
  createNotificationChannels().catch(() => {});
} catch (e) {}

// Register top-level background message handler for when app is closed / killed / background
try {
  const messaging = require('@react-native-firebase/messaging').default;
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    console.log('[PUSH_BACKGROUND] Message received in background/killed state:', remoteMessage);

    // If native FCM notification payload is present, Android OS has already rendered
    // the system notification tray item natively. Only render Notifee fallback if data-only.
    if (remoteMessage?.notification) {
      console.log('[PUSH_BACKGROUND] Native notification already displayed by Android OS in system tray');
      return;
    }

    const data = remoteMessage?.data ?? {};
    let title = remoteMessage?.notification?.title || data?.title || '';
    let body  = remoteMessage?.notification?.body  || data?.body  || data?.message || '';

    if (!title && !body && data.type) {
      const TYPE_LABELS = {
        order_confirmed:        'Order Confirmed! 🎉',
        order_preparing:        'Your food is being prepared 👨‍🍳',
        order_ready:            'Order Ready! 🛵',
        order_out_for_delivery: 'Rider on the way! 🛵',
        order_delivered:        'Order Delivered! 🎉',
        order_cancelled:        'Order Cancelled',
        rider_payout:           'Payment Sent! 💰',
        broadcast_message:      data.title ?? '2QT',
        new_kitchen_order:      '🍽️ New Order!',
      };
      title = TYPE_LABELS[data.type] ?? '2QT';
      body  = data.body ?? '';
    }

    if (title || body) {
      try {
        const { displayLocalNotification } = require('./src/services/localNotif');
        await displayLocalNotification(title || '2QT', body || '', data);
      } catch (e) {
        console.warn('[PUSH_BACKGROUND] Failed to display local notif:', e);
      }
    }
  });
} catch (e) {
  console.warn('[PUSH_BACKGROUND] Failed to setup background handler in index.js:', e);
}

AppRegistry.registerComponent(appName, () => App);
