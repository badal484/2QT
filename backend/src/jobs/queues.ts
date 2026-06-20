import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    tls: process.env.REDIS_URL?.startsWith('rediss://')
        ? { rejectUnauthorized: false }
        : undefined,
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
