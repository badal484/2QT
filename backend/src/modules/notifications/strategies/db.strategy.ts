import { query } from '../../../db';
import { NotificationChannelStrategy, NotificationPayload, StrategySendResult } from './notification-channel.interface';

export class DBStrategy implements NotificationChannelStrategy {
    readonly name = 'db';

    canHandle(payload: NotificationPayload): boolean {
        // DB strategy is enabled by default unless channels explicitly exclude it
        if (!payload.channels || payload.channels.length === 0) return true;
        return payload.channels.includes('db') || payload.channels.includes('in_app') || payload.channels.includes('push');
    }

    async send(payload: NotificationPayload): Promise<StrategySendResult> {
        try {
            const { userId, type, title, body, data = {} } = payload;
            
            const { rows } = await query(
                `INSERT INTO notifications (user_id, type, title, body, data, channel, delivery_status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING id`,
                [userId, type, title, body, JSON.stringify(data), 'db', 'sent']
            );

            const insertedId = rows[0]?.id;
            if (insertedId) {
                payload.notifId = insertedId;
            }

            return { success: true, channel: this.name, deliveredCount: 1 };
        } catch (error: any) {
            console.error('[DBStrategy] Error storing notification history:', error.message);
            return { success: false, channel: this.name, error: error.message };
        }
    }
}
