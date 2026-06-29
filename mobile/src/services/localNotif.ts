import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
import { navigateFromNotification } from '../navigation/navigationRef';

// ── Channel IDs (must match MainActivity.kt) ──────────────────────────────────
export const CHANNELS = {
  ORDER:    { id: 'order_updates',  name: 'Order Updates',  importance: AndroidImportance.HIGH },
  PROMO:    { id: 'promotions',     name: 'Promotions',     importance: AndroidImportance.DEFAULT },
  ACCOUNT:  { id: 'account',        name: 'Account',        importance: AndroidImportance.HIGH },
} as const;

// Pick the right channel based on notification type
function channelForType(type: string): string {
  if (type.startsWith('order_') || type === 'low_subscription_meals') return CHANNELS.ORDER.id;
  if (type === 'rider_payout' || type === 'kitchen_payout' || type.includes('wallet')) return CHANNELS.ACCOUNT.id;
  return CHANNELS.PROMO.id;
}

// Create all Android channels — call once on app start
export async function createNotificationChannels() {
  await notifee.createChannel(CHANNELS.ORDER);
  await notifee.createChannel(CHANNELS.PROMO);
  await notifee.createChannel(CHANNELS.ACCOUNT);
}

// Post a real system notification in the tray (foreground use)
export async function displayLocalNotification(
  title: string,
  body: string,
  data: Record<string, string> = {}
) {
  await notifee.displayNotification({
    title,
    body,
    data,
    android: {
      channelId: channelForType(data.type ?? ''),
      pressAction: { id: 'default' },
      importance: AndroidImportance.HIGH,
    },
    ios: {
      sound: 'default',
      foregroundPresentationOptions: {
        alert: true,
        badge: true,
        sound: true,
        banner: true,
        list: true,
      },
    },
  });
}

// Handle taps on notifee-posted notifications (foreground + background)
export function setupNotifeeHandlers() {
  // Foreground taps
  notifee.onForegroundEvent(({ type, detail }) => {
    if (type === EventType.PRESS) {
      const data = (detail.notification?.data ?? {}) as Record<string, string>;
      navigateFromNotification(data);
    }
  });

  // Background / killed taps (must be called outside component)
  notifee.onBackgroundEvent(async ({ type, detail }) => {
    if (type === EventType.PRESS) {
      const data = (detail.notification?.data ?? {}) as Record<string, string>;
      navigateFromNotification(data);
    }
  });
}
