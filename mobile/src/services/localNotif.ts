import { navigateFromNotification } from '../navigation/navigationRef';

let _notifee: any = null;
let _EventType: any = null;
let _AndroidImportance: any = null;
let _notifeeAvailable = false;

function loadNotifee() {
  if (_notifeeAvailable || _notifee !== null) return _notifeeAvailable;
  try {
    const mod = require('@notifee/react-native');
    _notifee = mod.default;
    _EventType = mod.EventType;
    _AndroidImportance = mod.AndroidImportance;
    _notifee.getBadgeCount();
    _notifeeAvailable = true;
  } catch {
    console.warn('[Notifee] Native module not available — rebuild with npx react-native run-android');
    _notifeeAvailable = false;
  }
  return _notifeeAvailable;
}

function channelForType(type: string): string {
  if (type === 'order_update') return 'order_dispatch'; // highest priority for rider assignments
  if (type.startsWith('order_') || type === 'low_subscription_meals') return 'order_updates';
  if (type === 'rider_payout' || type === 'kitchen_payout' || type.includes('wallet')) return 'account';
  return 'promotions';
}

export async function createNotificationChannels() {
  if (!loadNotifee()) return;
  try {
    // Separate MAX-importance channel for direct rider dispatch — sound + heads-up on lock screen
    await _notifee.createChannel({
      id: 'order_dispatch',
      name: 'Order Dispatch Alerts',
      importance: _AndroidImportance.HIGH,
      sound: 'default',
      vibration: true,
      vibrationPattern: [300, 500, 300, 500, 300],
    });
    await _notifee.createChannel({ id: 'order_updates', name: 'Order Updates',   importance: _AndroidImportance.HIGH });
    await _notifee.createChannel({ id: 'promotions',   name: 'Promotions',       importance: _AndroidImportance.DEFAULT });
    await _notifee.createChannel({ id: 'account',      name: 'Account',          importance: _AndroidImportance.HIGH });
  } catch (e) {
    console.warn('[Notifee] createChannels failed:', e);
  }
}

export async function displayLocalNotification(
  title: string,
  body: string,
  data: Record<string, string> = {}
) {
  if (!loadNotifee()) return;
  const channelId = channelForType(data.type ?? '');
  const isDispatch = channelId === 'order_dispatch';
  try {
    await _notifee.displayNotification({
      title,
      body,
      data,
      android: {
        channelId,
        pressAction: { id: 'default' },
        importance: _AndroidImportance.HIGH,
        sound: 'default',
        // Show as heads-up notification even when screen is off
        ...(isDispatch && {
          fullScreenAction: { id: 'default', launchActivity: 'default' },
          vibrationPattern: [300, 500, 300, 500, 300],
          lights: [0xFFFC4603, 500, 500],
        }),
      },
      ios: {
        sound: 'default',
        critical: isDispatch,   // bypasses silent mode for order dispatch
        foregroundPresentationOptions: { alert: true, badge: true, sound: true, banner: true, list: true },
      },
    });
  } catch (e) {
    console.warn('[Notifee] displayNotification failed:', e);
  }
}

export function setupNotifeeHandlers() {
  if (!loadNotifee()) return;
  try {
    _notifee.onForegroundEvent(({ type, detail }: any) => {
      if (type === _EventType.PRESS) {
        const data = (detail.notification?.data ?? {}) as Record<string, string>;
        navigateFromNotification(data);
      }
    });

    _notifee.onBackgroundEvent(async ({ type, detail }: any) => {
      if (type === _EventType.PRESS) {
        const data = (detail.notification?.data ?? {}) as Record<string, string>;
        navigateFromNotification(data);
      }
    });
  } catch (e) {
    console.warn('[Notifee] setupHandlers failed:', e);
  }
}
