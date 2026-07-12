import { navigateFromNotification } from '../navigation/navigationRef';

let _notifee: any = null;
let _EventType: any = null;
let _AndroidImportance: any = null;
let _AndroidStyle: any = null;
let _notifeeAvailable = false;

function loadNotifee() {
  if (_notifeeAvailable || _notifee !== null) return _notifeeAvailable;
  try {
    const mod = require('@notifee/react-native');
    _notifee = mod.default;
    _EventType = mod.EventType;
    _AndroidImportance = mod.AndroidImportance;
    _AndroidStyle = mod.AndroidStyle;
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
  if (type === 'rider_payout' || type === 'kitchen_payout' || type.includes('wallet') || type === 'chat_message') return 'account';
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
  const isChat = data.type === 'chat_message';
  
  let chatMessages: any[] = [];
  if (isChat && data.ticketId) {
    const displayed = await _notifee.getDisplayedNotifications();
    const existing = displayed.find((n: any) => n.id === data.ticketId);
    if (existing?.notification?.android?.style?.type === _AndroidStyle.MESSAGING) {
      chatMessages = existing.notification.android.style.messages || [];
    }
    chatMessages.push({
      text: data.message || body,
      timestamp: data.timestamp ? new Date(data.timestamp).getTime() : Date.now(),
      person: { name: data.senderName || 'Support' },
    });
  }

  try {
    await _notifee.displayNotification({
      id: isChat && data.ticketId ? data.ticketId : undefined,
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
        ...(isChat && {
          style: {
            type: _AndroidStyle.MESSAGING,
            person: { name: 'Me' },
            messages: chatMessages,
          },
          actions: [
            {
              title: 'Reply',
              pressAction: { id: 'reply' },
              input: { placeholder: 'Type a reply...' }
            }
          ]
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
      if (type === _EventType.ACTION_PRESS && detail.pressAction.id === 'reply') {
        handleInlineReply(detail);
      }
    });

    _notifee.onBackgroundEvent(async ({ type, detail }: any) => {
      if (type === _EventType.PRESS) {
        const data = (detail.notification?.data ?? {}) as Record<string, string>;
        navigateFromNotification(data);
      }
      if (type === _EventType.ACTION_PRESS && detail.pressAction.id === 'reply') {
        await handleInlineReply(detail);
      }
    });
  } catch (e) {
    console.warn('[Notifee] setupHandlers failed:', e);
  }
}

async function handleInlineReply(detail: any) {
  const replyText = detail.input;
  const data = detail.notification?.data ?? {};
  const ticketId = data.ticketId;
  
  if (replyText && ticketId) {
    try {
      const { api } = require('../api/client');
      await api.post(`/support/tickets/${ticketId}/reply`, { message: replyText });
      
      // Acknowledge the reply by updating the notification thread
      const displayed = await _notifee.getDisplayedNotifications();
      const existing = displayed.find((n: any) => n.id === ticketId);
      if (existing?.notification?.android?.style?.type === _AndroidStyle.MESSAGING) {
        const messages = existing.notification.android.style.messages || [];
        messages.push({
          text: replyText,
          timestamp: Date.now(),
          person: { name: 'Me' } // Null/Self person for the sender
        });
        
        await _notifee.displayNotification({
          ...existing.notification,
          android: {
            ...existing.notification.android,
            style: {
              ...existing.notification.android.style,
              messages
            }
          }
        });
      }
    } catch (e) {
      console.warn('[Notifee] Failed to send inline reply:', e);
    }
  }
}
