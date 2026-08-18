import { firebaseAdminMessaging } from '../../../config/firebaseAdmin';
import { DeviceTokenService } from '../services/device-token.service';
import { NotificationChannelStrategy, NotificationPayload, StrategySendResult } from './notification-channel.interface';
import { MulticastMessage } from 'firebase-admin/messaging';

export class FCMStrategy implements NotificationChannelStrategy {
    readonly name = 'fcm';

    canHandle(payload: NotificationPayload): boolean {
        // Enabled when channels includes push or fcm, or default if unspecified
        if (!payload.channels || payload.channels.length === 0) return true;
        return payload.channels.includes('fcm') || payload.channels.includes('push');
    }

    async send(payload: NotificationPayload): Promise<StrategySendResult> {
        try {
            const { userId, type, title, body, data = {}, appType, imageUrl, largeIcon, notifId } = payload;

            // 1. Fetch active tokens for user (scoped by appType with fallback to any active token)
            let tokens = await DeviceTokenService.getActiveTokensForUser(userId, appType);
            if (!tokens || tokens.length === 0) {
                tokens = await DeviceTokenService.getActiveTokensForUser(userId);
            }

            if (!tokens || tokens.length === 0) {
                return { success: true, channel: this.name, deliveredCount: 0 };
            }

            // 2. Select channel sound & priority based on appType & target urgency
            const sound = this.getSoundForApp(appType, type);
            const channelId = this.getChannelIdForApp(appType);

            // Convert data object to key-value strings required by FCM SDK (always include title & body)
            const stringifiedData: Record<string, string> = {
                type: String(type || ''),
                notifId: String(notifId || ''),
                appType: String(appType || 'buyer'),
                title: String(title || ''),
                body: String(body || ''),
                ...(largeIcon ? { largeIcon: String(largeIcon) } : {}),
                ...(imageUrl ? { imageUrl: String(imageUrl) } : {}),
            };

            for (const [key, value] of Object.entries(data)) {
                if (value !== undefined && value !== null) {
                    stringifiedData[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
                }
            }

            const multicastPayload: MulticastMessage = {
                tokens,
                notification: {
                    title,
                    body,
                    imageUrl: imageUrl || undefined,
                },
                data: stringifiedData,
                android: {
                    priority: 'high',
                    notification: {
                        sound,
                        channelId,
                        priority: 'high',
                        defaultVibrateTimings: true,
                        ...(imageUrl ? { imageUrl } : {}),
                    },
                },
                apns: {
                    payload: {
                        aps: {
                            sound,
                            alert: { title, body },
                            'content-available': 1,
                        },
                    },
                },
            };

            // 3. Batch dispatch to Google FCM API in chunks of 500
            const MAX_FCM_BATCH = 500;
            let successCount = 0;
            const invalidTokens: string[] = [];

            for (let i = 0; i < tokens.length; i += MAX_FCM_BATCH) {
                const tokenChunk = tokens.slice(i, i + MAX_FCM_BATCH);
                const chunkPayload: MulticastMessage = {
                    ...multicastPayload,
                    tokens: tokenChunk,
                };

                const response = await firebaseAdminMessaging.sendEachForMulticast(chunkPayload);

                response.responses.forEach((resp, idx) => {
                    if (resp.success) {
                        successCount++;
                    } else if (resp.error) {
                        const code = resp.error.code;
                        if (
                            code === 'messaging/invalid-registration-token' ||
                            code === 'messaging/registration-token-not-registered'
                        ) {
                            invalidTokens.push(tokenChunk[idx]);
                        }
                    }
                });
            }

            // 4. Auto-cleanup invalid tokens from DB asynchronously
            if (invalidTokens.length > 0) {
                Promise.allSettled(
                    invalidTokens.map(t => DeviceTokenService.markTokenInvalid(t))
                ).catch(err => console.error('[FCMStrategy] Failed cleaning up invalid tokens:', err));
            }

            return {
                success: true,
                channel: this.name,
                deliveredCount: successCount,
            };
        } catch (error: any) {
            console.error('[FCMStrategy] Error sending FCM push:', error.message);
            return { success: false, channel: this.name, error: error.message };
        }
    }

    private getSoundForApp(appType?: string, type?: string): string {
        if (appType === 'kitchen') return 'kitchen_alarm.mp3';
        if (appType === 'rider') return 'rider_alert.mp3';
        if (type?.includes('cancel') || type?.includes('urgent')) return 'alert.mp3';
        return 'default';
    }

    private getChannelIdForApp(appType?: string): string {
        if (appType === 'kitchen') return 'kitchen_orders';
        if (appType === 'rider') return 'rider_alerts';
        return 'order_updates';
    }
}
