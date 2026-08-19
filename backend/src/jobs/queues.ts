import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { getCleanRedisUrl, isRedisTls } from '../redis/parseRedisUrl';
import { getTraceId } from '../utils/asyncContext';

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

// Wraps Queue#add so every call site across the codebase automatically serializes
// the active request's traceId (if any) into the job payload — no change needed at
// any of the individual `queue.add(...)` call sites. jobs/worker.ts's
// withTraceContext() restores it when the job is picked up, so a background job's
// logs correlate back to the request that enqueued it.
function withTracing(q: Queue): Queue {
    const originalAdd = q.add.bind(q);
    (q as any).add = (name: string, data: any = {}, opts?: any) => {
        const traceId = getTraceId();
        return originalAdd(name, traceId ? { ...data, traceId } : data, opts);
    };
    return q;
}

export const notificationsQueue = withTracing(new Queue('2qt:notifications', {
    connection,
    defaultJobOptions,
}));

export const invoicesQueue = withTracing(new Queue('2qt:invoices', {
    connection,
    defaultJobOptions: { ...defaultJobOptions, attempts: 2 },
}));

export const emailsQueue = withTracing(new Queue('2qt:emails', {
    connection,
    defaultJobOptions,
}));

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
