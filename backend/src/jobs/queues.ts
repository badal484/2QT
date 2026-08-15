import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { getCleanRedisUrl, isRedisTls } from '../redis/parseRedisUrl';

const redisUrl = getCleanRedisUrl();
const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    tls: isRedisTls(redisUrl) ? { rejectUnauthorized: false } : undefined,
});

const defaultJobOptions = {
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 5000 },
    removeOnComplete: 500,
    removeOnFail: 200,
};

export const notificationsQueue = new Queue('2qt:notifications', {
    connection,
    defaultJobOptions,
});

export const invoicesQueue = new Queue('2qt:invoices', {
    connection,
    defaultJobOptions: { ...defaultJobOptions, attempts: 2 },
});

export const emailsQueue = new Queue('2qt:emails', {
    connection,
    defaultJobOptions,
});

// Called on graceful shutdown by whichever process created these Queue producers
// (both the API process, which enqueues jobs from request handlers, and the worker
// process, which enqueues follow-up jobs from cron — each has its own instance of
// this module and its own IORedis connection).
export const closeQueueConnections = async () => {
    await Promise.allSettled([
        notificationsQueue.close(),
        invoicesQueue.close(),
        emailsQueue.close(),
    ]);
    await connection.quit().catch(() => {});
};
