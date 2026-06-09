import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = createClient({ url: redisUrl });
export const redisPub = createClient({ url: redisUrl });
export const redisSub = createClient({ url: redisUrl });

redis.on('error', (err) => console.error('Redis Client Error', err));
redisPub.on('error', (err) => console.error('Redis Pub Error', err));
redisSub.on('error', (err) => console.error('Redis Sub Error', err));

export const connectRedis = async () => {
    try {
        if (!redis.isOpen) await redis.connect();
        if (!redisPub.isOpen) await redisPub.connect();
        if (!redisSub.isOpen) await redisSub.connect();
    } catch (e) {
        console.error('--- REDIS: CONNECTION FAILED (NON-BLOCKING)', e);
    }
};

export const keys = {
    menu: (zoneId: string) => `velto:menu:${zoneId}`,
    pendingOtp: (phone: string) => `velto:otp:${phone}`,
    pendingPayment: (customerId: string) => `velto:pending_payment:${customerId}`,
    pendingOrder: (cfOrderId: string) => `velto:pending_order:${cfOrderId}`,
    processedWebhook: (cfOrderId: string) => `velto:webhook_done:${cfOrderId}`,
    riderLocation: (riderId: string) => `velto:rider_loc:${riderId}`,
    otpAttempts: (phone: string) => `velto:otp_attempts:${phone}`,
    revokedToken: (jti: string) => `velto:revoked:${jti}`,
    cfPayoutToken: () => 'velto:cf_payout_token',
    deliveryOtpAttempts: (orderId: string) => `velto:otp_fail:${orderId}`,
    walletTopup: (cfOrderId: string) => `velto:wallet_topup:${cfOrderId}`,
    orderByCf: (cfOrderId: string) => `velto:order_by_cf:${cfOrderId}`,
    activeRidersInZone: (zoneId: string) => `velto:active_riders:${zoneId}`,
};

export default redis;
