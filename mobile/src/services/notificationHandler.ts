import { DeepLinkResolver } from './deepLinkResolver';

let messagingModule: any = null;
let notifeeModule: any = null;
let AndroidImportance: any = { HIGH: 4, DEFAULT: 3 };
let EventType: any = { PRESS: 1 };

try {
    const messagingPkg = require('@react-native-firebase/messaging');
    messagingModule = messagingPkg.default || messagingPkg;
} catch (e: any) {
    console.warn('[NotificationHandler] @react-native-firebase/messaging not available:', e?.message || e);
}

try {
    const notifeePackage = require('@notifee/react-native');
    notifeeModule = notifeePackage.default || notifeePackage;
    AndroidImportance = notifeePackage.AndroidImportance || AndroidImportance;
    EventType = notifeePackage.EventType || EventType;
} catch (e: any) {
    console.warn('[NotificationHandler] @notifee/react-native not available:', e?.message || e);
}

const seenMessageIds = new Set<string>();

export class NotificationHandler {
    private static channelsInitialized = false;

    static async initChannels() {
        if (this.channelsInitialized || !notifeeModule) return;

        try {
            // 1. Buyer Channel: order_updates
            await notifeeModule.createChannel({
                id: 'order_updates',
                name: 'Order Updates',
                importance: AndroidImportance.HIGH,
                sound: 'default',
                vibration: true,
            });

            // 2. Rider Channel: rider_alerts
            await notifeeModule.createChannel({
                id: 'rider_alerts',
                name: 'Rider Alerts',
                importance: AndroidImportance.HIGH,
                sound: 'rider_alert',
                vibration: true,
                vibrationPattern: [300, 500, 300, 500],
            });

            // 3. Kitchen Channel: kitchen_orders
            await notifeeModule.createChannel({
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
        if (!messagingModule) return () => {};

        this.initChannels();

        // 1. Foreground Message Handler (App Open)
        const unsubscribeForeground = messagingModule().onMessage(async (remoteMessage: any) => {
            const messageId = remoteMessage?.messageId || `${remoteMessage?.sentTime}_${remoteMessage?.data?.type}_${remoteMessage?.data?.notifId}`;
            if (messageId && seenMessageIds.has(messageId)) {
                console.log('[NotificationHandler] Suppressing duplicate foreground message:', messageId);
                return;
            }
            if (messageId) {
                seenMessageIds.add(messageId);
                setTimeout(() => seenMessageIds.delete(messageId), 10000);
            }

            console.log('[NotificationHandler] Foreground message received:', remoteMessage);

            const notification = remoteMessage?.notification;
            const data = remoteMessage?.data || {};
            const appType = data?.appType || 'buyer';
            const channelId = appType === 'kitchen' ? 'kitchen_orders' : (appType === 'rider' ? 'rider_alerts' : 'order_updates');

            if (notification && notifeeModule) {
                await notifeeModule.displayNotification({
                    title: notification.title,
                    body: notification.body,
                    data: data as any,
                    android: {
                        channelId,
                        importance: AndroidImportance.HIGH,
                        pressAction: {
                            id: 'default',
                        },
                    },
                });
            }

            if (queryClient) {
                queryClient.invalidateQueries({ queryKey: ['notifications'] });
                queryClient.invalidateQueries({ queryKey: ['rider-notifications'] });
            }
        });

        // 2. Background Notification Click (App in Background -> Opened)
        const unsubscribeNotificationOpened = messagingModule().onNotificationOpenedApp((remoteMessage: any) => {
            console.log('[NotificationHandler] Notification opened app from background:', remoteMessage);
            if (remoteMessage?.data) {
                DeepLinkResolver.resolve(remoteMessage.data, navigation);
            }
        });

        // 3. Cold Start Notification Click (App Killed -> Booted by Tap)
        messagingModule()
            .getInitialNotification()
            .then((remoteMessage: any) => {
                if (remoteMessage?.data) {
                    console.log('[NotificationHandler] App launched from killed state via notification:', remoteMessage);
                    setTimeout(() => {
                        DeepLinkResolver.resolve(remoteMessage.data, navigation);
                    }, 1000);
                }
            })
            .catch((err: any) => console.error('[NotificationHandler] getInitialNotification error:', err));

        // 4. Notifee Event Listener for Foreground/Background Taps
        let unsubscribeNotifee = () => {};
        if (notifeeModule) {
            unsubscribeNotifee = notifeeModule.onForegroundEvent(({ type, detail }: { type: any; detail: any }) => {
                if (type === EventType.PRESS && detail?.notification?.data) {
                    DeepLinkResolver.resolve(detail.notification.data as any, navigation);
                }
            });
        }

        return () => {
            unsubscribeForeground();
            unsubscribeNotificationOpened();
            unsubscribeNotifee();
        };
    }
}
