import { NotificationChannelStrategy, NotificationPayload, StrategySendResult } from '../strategies/notification-channel.interface';
import { DBStrategy } from '../strategies/db.strategy';
import { SocketStrategy } from '../strategies/socket.strategy';
import { FCMStrategy } from '../strategies/fcm.strategy';

export class NotificationDispatcherService {
    private static strategies: NotificationChannelStrategy[] = [
        new DBStrategy(),
        new SocketStrategy(),
        new FCMStrategy(),
    ];

    static async dispatch(payload: NotificationPayload): Promise<Record<string, StrategySendResult>> {
        const results: Record<string, StrategySendResult> = {};

        // 1. Execute DBStrategy first to obtain generated notifId
        const dbStrategy = this.strategies.find(s => s.name === 'db');
        if (dbStrategy && dbStrategy.canHandle(payload)) {
            results['db'] = await dbStrategy.send(payload);
        }

        // 2. Execute other channel strategies (Socket, FCM, etc.)
        const otherStrategies = this.strategies.filter(s => s.name !== 'db' && s.canHandle(payload));
        
        await Promise.allSettled(
            otherStrategies.map(async (strategy) => {
                try {
                    const res = await strategy.send(payload);
                    results[strategy.name] = res;
                } catch (err: any) {
                    console.error(`[Dispatcher] Strategy ${strategy.name} failed:`, err.message);
                    results[strategy.name] = { success: false, channel: strategy.name, error: err.message };
                }
            })
        );

        return results;
    }
}
