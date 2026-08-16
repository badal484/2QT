import { DeepLinkResolver } from './deepLinkResolver';
import messaging from '@react-native-firebase/messaging';
import { safeNotifee, AndroidImportance, EventType } from './notifeeSafe';

const seenMessageIds = new Set<string>();

export class NotificationHandler {
    private static channelsInitialized = false;

    static async initChannels() {
        if (this.channelsInitialized || !safeNotifee.isAvailable) return;

        try {
            // 1. Buyer Channel: order_updates
            await safeNotifee.createChannel({
                id: 'order_updates',
                name: 'Order Updates',
                importance: AndroidImportance.HIGH,
                sound: 'default',
                vibration: true,
            });

            // 2. Rider Channel: rider_alerts
            await safeNotifee.createChannel({
                id: 'rider_alerts',
                name: 'Rider Alerts',
                importance: AndroidImportance.HIGH,
                sound: 'rider_alert',
                vibration: true,
                vibrationPattern: [300, 500, 300, 500],
            });

            // 3. Kitchen Channel: kitchen_orders
            await safeNotifee.createChannel({
                id: 'kitchen_orders',
                name: 'Kitchen Orders',
                importance: AndroidImportance.HIGH,
                sound: 'kitchen_alarm',
                vibration: true,
            });

            this.channelsInitialized = true;
            console.log('[NotificationHandler] Android channels initialized cleanly');
        } catch (e) {
            console.error('[NotificationHandler] Channel setup failed:', e);
        }
    }

    static setupListeners(navigation: any, queryClient?: any) {
        this.initChannels();

        // 1. Foreground Message Handler (App Open)
        const unsubscribeForeground = messaging().onMessage(async (remoteMessage: any) => {
            const messageId = remoteMessage?.messageId || `${remoteMessage?.sentTime}_${remoteMessage?.data?.type}_${remoteMessage?.data?.notifId}`;
            if (messageId && seenMessageIds.has(messageId)) {
                console.log('[NotificationHandler] Suppressing duplicate foreground message:', messageId);
                return;
            }
            if (messageId) {
                seenMessageIds.add(messageId);
                if (seenMessageIds.size > 200) {
                    const oldest = Array.from(seenMessageIds).slice(0, 50);
                    oldest.forEach(id => seenMessageIds.delete(id));
                }
            }

            console.log('[NotificationHandler] Foreground Remote Message:', remoteMessage);
            const notification = remoteMessage?.notification;
            const data = remoteMessage?.data || {};

            const title = notification?.title || data.title || '2QT Alert';
            const body = notification?.body || data.body || data.message || '';
            const appType = data.appType || 'buyer';

            const channelId = appType === 'kitchen' ? 'kitchen_orders' : (appType === 'rider' ? 'rider_alerts' : 'order_updates');

            // Invalidate React Query cache if queryClient passed
            if (queryClient && data.type) {
                if (['order_status', 'rider_assigned', 'out_for_delivery'].includes(data.type)) {
                    queryClient.invalidateQueries({ queryKey: ['activeOrders'] });
                    queryClient.invalidateQueries({ queryKey: ['orderHistory'] });
                }
            }

            if (safeNotifee.isAvailable) {
                try {
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
                } catch (err) {
                    console.error('[NotificationHandler] Failed displaying Notifee banner:', err);
                }
            }
        });

        // 2. Notification Opened App Event (Background State Tap)
        const unsubscribeNotificationOpened = messaging().onNotificationOpenedApp((remoteMessage: any) => {
            console.log('[NotificationHandler] App opened from background notification:', remoteMessage);
            if (remoteMessage?.data) {
                DeepLinkResolver.handle(navigation, remoteMessage.data);
            }
        });

        // 3. Initial Notification (Killed State Tap)
        messaging().getInitialNotification().then((remoteMessage: any) => {
            if (remoteMessage?.data) {
                console.log('[NotificationHandler] App launched from killed notification:', remoteMessage);
                setTimeout(() => {
                    DeepLinkResolver.handle(navigation, remoteMessage.data);
                }, 1000);
            }
        });

        // 4. Notifee Foreground Press Handler
        const unsubscribeNotifee = safeNotifee.onForegroundEvent(({ type, detail }: any) => {
            if (type === EventType.PRESS && detail?.notification?.data) {
                console.log('[NotificationHandler] Notifee banner tapped:', detail.notification.data);
                DeepLinkResolver.handle(navigation, detail.notification.data);
            }
        });

        return () => {
            unsubscribeForeground();
            unsubscribeNotificationOpened();
            unsubscribeNotifee();
        };
    }
}
