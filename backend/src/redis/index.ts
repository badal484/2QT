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

// --- SAFE WRAPPERS TO PREVENT UPSTASH RATE LIMIT CRASHES ---
// In-memory fallback if Redis is down/rate-limited
const fallbackCache = new Map<string, { value: string, expiresAt: number }>();
setInterval(() => {
    const now = Date.now();
    for (const [k, v] of fallbackCache.entries()) {
        if (v.expiresAt > 0 && v.expiresAt < now) fallbackCache.delete(k);
    }
}, 60000); // cleanup every 60s

const withTimeout = <T>(promise: Promise<T>, ms = 200): Promise<T> => {
    let timer: NodeJS.Timeout;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Redis Timeout')), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

const originalGet = redis.get.bind(redis);
redis.get = (async (...args: any[]) => {
    const key = args[0];
    try { 
        const res = await withTimeout((originalGet as any)(...args)); 
        if (res !== null) return res;
    } catch (e: any) { 
        console.error('[Redis Safe GET]', e.message); 
    }
    // Check fallback
    const cached = fallbackCache.get(key);
    if (cached && (cached.expiresAt === 0 || cached.expiresAt > Date.now())) return cached.value;
    return null;
}) as any;

const originalSet = redis.set.bind(redis);
redis.set = (async (...args: any[]) => {
    const [key, value, options] = args;
    let ttl = 0;
    if (options?.EX) ttl = options.EX * 1000;
    else if (options?.PX) ttl = options.PX;
    
    fallbackCache.set(key, { value: String(value), expiresAt: ttl ? Date.now() + ttl : 0 });
    
    try { return await withTimeout((originalSet as any)(...args)); } 
    catch (e: any) { console.error('[Redis Safe SET]', e.message); return null; }
}) as any;

const originalDel = redis.del.bind(redis);
redis.del = (async (...args: any[]) => {
    const key = args[0];
    fallbackCache.delete(key);
    try { return await withTimeout((originalDel as any)(...args)); } 
    catch (e: any) { console.error('[Redis Safe DEL]', e.message); return null; }
}) as any;

const originalSetEx = redis.setEx.bind(redis);
redis.setEx = (async (...args: any[]) => {
    const [key, seconds, value] = args;
    fallbackCache.set(key, { value: String(value), expiresAt: Date.now() + (Number(seconds) * 1000) });
    try { return await withTimeout((originalSetEx as any)(...args)); } 
    catch (e: any) { console.error('[Redis Safe SETEX]', e.message); return null; }
}) as any;
// -------------------------------------------------------------

redis.on('error', (err) => console.error('Redis Client Error', err));
redisPub.on('error', (err) => console.error('Redis Pub Error', err));
redisSub.on('error', (err) => console.error('Redis Sub Error', err));

export const connectRedis = async () => {
    try {
        if (!redis.isOpen) await withTimeout(redis.connect(), 2000).catch(() => {});
        if (!redisPub.isOpen) await withTimeout(redisPub.connect(), 2000).catch(() => {});
        if (!redisSub.isOpen) await withTimeout(redisSub.connect(), 2000).catch(() => {});
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
    activePromos: () => '2qt:offers:promos',
    activeCampaigns: () => '2qt:offers:campaigns',
};

export default redis;
