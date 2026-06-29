import { navigateFromNotification } from '../navigation/navigationRef';

// Lazy-load notifee so the app doesn't crash if native module isn't linked yet
// (requires `npx react-native run-android` after installing @notifee/react-native)
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
    // Try calling a benign method to confirm native module is linked
    _notifee.getBadgeCount();
    _notifeeAvailable = true;
  } catch {
    console.warn('[Notifee] Native module not available — rebuild with npx react-native run-android');
    _notifeeAvailable = false;
  }
  return _notifeeAvailable;
}

function channelForType(type: string): string {
  if (type.startsWith('order_') || type === 'low_subscription_meals') return 'order_updates';
  if (type === 'rider_payout' || type === 'kitchen_payout' || type.includes('wallet')) return 'account';
  return 'promotions';
}

export async function createNotificationChannels() {
  if (!loadNotifee()) return;
  try {
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
  try {
    await _notifee.displayNotification({
      title,
      body,
      data,
      android: {
        channelId: channelForType(data.type ?? ''),
        pressAction: { id: 'default' },
        importance: _AndroidImportance.HIGH,
      },
      ios: {
        sound: 'default',
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
