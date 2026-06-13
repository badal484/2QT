import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const redisConfig = {
    url: redisUrl,
    socket: redisUrl.startsWith('rediss://') ? { tls: true, rejectUnauthorized: false } : undefined
};

export const redis = createClient(redisConfig);
export const redisPub = createClient(redisConfig);
export const redisSub = createClient(redisConfig);

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
    menu: (zoneId: string) => `2qt:menu:${zoneId}`,
    pendingOtp: (phone: string) => `2qt:otp:${phone}`,
    pendingPayment: (customerId: string) => `2qt:pending_payment:${customerId}`,
    pendingOrder: (cfOrderId: string) => `2qt:pending_order:${cfOrderId}`,
    processedWebhook: (cfOrderId: string) => `2qt:webhook_done:${cfOrderId}`,
    riderLocation: (riderId: string) => `2qt:rider_loc:${riderId}`,
    otpAttempts: (phone: string) => `2qt:otp_attempts:${phone}`,
    revokedToken: (jti: string) => `2qt:revoked:${jti}`,
    cfPayoutToken: () => '2qt:cf_payout_token',
    deliveryOtpAttempts: (orderId: string) => `2qt:otp_fail:${orderId}`,
    walletTopup: (cfOrderId: string) => `2qt:wallet_topup:${cfOrderId}`,
    orderByCf: (cfOrderId: string) => `2qt:order_by_cf:${cfOrderId}`,
    activeRidersInZone: (zoneId: string) => `2qt:active_riders:${zoneId}`,
    customerCart: (customerId: string) => `2qt:cart:${customerId}`,
};

export default redis;
