export interface NotificationPayload {
    userId: string;
    type: string;
    title: string;
    body: string;
    data?: Record<string, any>;
    appType?: 'buyer' | 'rider' | 'kitchen';
    channels?: string[];
    userPhone?: string;
    notifId?: string;
    imageUrl?: string;
}

export interface StrategySendResult {
    success: boolean;
    channel: string;
    deliveredCount?: number;
    error?: string;
}

export interface NotificationChannelStrategy {
    readonly name: string;
    canHandle(payload: NotificationPayload): boolean;
    send(payload: NotificationPayload): Promise<StrategySendResult>;
}
