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
  if (type === 'order_update' || type === 'new_kitchen_order') return 'order_dispatch_v2';
  if (type.startsWith('order_') || type === 'low_subscription_meals') return 'order_updates';
  if (type === 'rider_payout' || type === 'kitchen_payout' || type.includes('wallet') || type === 'chat_message') return 'account';
  return 'promotions';
}

export async function createNotificationChannels() {
  if (!loadNotifee()) return;
  // Each channel created independently — a single shared try/catch around all four
  // meant one failure (e.g. a transient native-bridge hiccup) silently aborted every
  // channel after it too, since await stops at the first rejection. A push whose
  // channelId was never created is silently dropped by Android with no error visible
  // anywhere, which is exactly the kind of failure that's invisible until someone
  // notices notifications aren't arriving. Promise.allSettled means one bad channel
  // can't take the others down with it.
  const results = await Promise.allSettled([
    // MAX-importance channel for direct rider dispatch & kitchen orders — custom sound + heads-up on lock screen
    _notifee.createChannel({
      id: 'order_dispatch_v2',
      name: 'Order Dispatch Alerts',
      importance: _AndroidImportance.HIGH,
      sound: 'alert', // Plays alert.mp3 from res/raw
      vibration: true,
      vibrationPattern: [0, 800, 400, 800, 400, 800, 400, 800, 400, 800],
    }),
    _notifee.createChannel({ id: 'order_updates', name: 'Order Updates', importance: _AndroidImportance.HIGH }),
    _notifee.createChannel({ id: 'promotions',    name: 'Promotions',    importance: _AndroidImportance.DEFAULT }),
    _notifee.createChannel({ id: 'account',       name: 'Account',       importance: _AndroidImportance.HIGH }),
  ]);
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.warn(`[Notifee] createChannel #${i} failed:`, r.reason);
    }
  });
}

export async function displayLocalNotification(
  title: string,
  body: string,
  data: Record<string, string> = {}
) {
  if (!loadNotifee()) return;
  const channelId = channelForType(data.type ?? '');
  const isDispatch = channelId === 'order_dispatch_v2';
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

  // Group order status updates under a single expandable notification per order
  const groupId = data.orderId ? `order_${data.orderId}` : undefined;

  try {
    await _notifee.displayNotification({
      id: isChat && data.ticketId ? data.ticketId : undefined,
      title,
      body,
      data,
      android: {
        channelId,
        groupId,
        pressAction: { id: 'default' },
        importance: _AndroidImportance.HIGH,
        sound: isDispatch ? 'alert' : 'default',
        ...(isDispatch && {
          fullScreenAction: { id: 'default', launchActivity: 'default' },
          vibrationPattern: [0, 800, 400, 800, 400, 800, 400, 800, 400, 800],
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
        // timeSensitive breaks through Focus mode (does not require Apple entitlement)
        // critical bypasses silent mode but requires explicit Apple approval — skip
        interruptionLevel: isDispatch ? 'timeSensitive' : 'active',
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
      const { persistor } = require('../store');
      
      // Wait for Redux persist to finish rehydrating the token from AsyncStorage
      await new Promise(resolve => {
        if (persistor.getState().bootstrapped) {
          resolve(true);
        } else {
          const unsubscribe = persistor.subscribe(() => {
            if (persistor.getState().bootstrapped) {
              unsubscribe();
              resolve(true);
            }
          });
        }
      });

      const isRider = data.screen === 'RiderSupportTicketDetail';
      const endpoint = isRider 
        ? `/riders/support/tickets/${ticketId}/reply` 
        : `/customers/support/tickets/${ticketId}/reply`;
        
      await api.post(endpoint, { message: replyText });
      
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
