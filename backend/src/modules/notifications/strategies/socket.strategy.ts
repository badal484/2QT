import { emitToUser, emitToKitchen, emitToRiders, emitToOrder } from '../../../socket';
import { NotificationChannelStrategy, NotificationPayload, StrategySendResult } from './notification-channel.interface';

export class SocketStrategy implements NotificationChannelStrategy {
    readonly name = 'socket';

    canHandle(payload: NotificationPayload): boolean {
        // Enabled by default unless explicitly excluded
        if (!payload.channels || payload.channels.length === 0) return true;
        return payload.channels.includes('socket') || payload.channels.includes('push') || payload.channels.includes('in_app');
    }

    async send(payload: NotificationPayload): Promise<StrategySendResult> {
        try {
            const { userId, type, title, body, notifId, data = {}, appType } = payload;

            // 1. Emit new_notification event to target user room
            emitToUser(userId, 'new_notification', {
                type,
                title,
                body,
                notifId,
                data,
                createdAt: new Date().toISOString(),
            });

            // 2. Role-specific additional room socket emits
            if (appType === 'kitchen' && data.kitchenId) {
                emitToKitchen(data.kitchenId, 'new_kitchen_notification', { type, title, body, notifId, data });
            } else if (appType === 'rider') {
                emitToRiders('new_rider_notification', { type, title, body, notifId, data }, data.zoneId);
            }

            if (data.orderId) {
                emitToOrder(data.orderId, 'order_status_notification', { type, title, body, orderId: data.orderId, data });
            }

            return { success: true, channel: this.name, deliveredCount: 1 };
        } catch (error: any) {
            console.error('[SocketStrategy] Error emitting socket event:', error.message);
            return { success: false, channel: this.name, error: error.message };
        }
    }
}
