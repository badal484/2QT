// Worker process entry point — Cloud Run service `2qt-worker`.
//
// This is the ONLY place in the codebase that should call initCrons() and the only
// place that starts the BullMQ Workers (via the `./jobs/worker` side-effect import).
// It intentionally does NOT start Express or Socket.IO — the API process (src/index.ts)
// owns those. Keeping this process singular (min instances = max instances = 1 on Cloud
// Run) is what guarantees every cron job and every BullMQ job fires exactly once,
// regardless of how many API instances are handling HTTP traffic at the same time.
//
// Real-time events fired from here (e.g. a cron notifying a kitchen of a new order)
// go out via the Redis-backed Socket.IO emitter in src/socket/index.ts, not a locally
// hosted Socket.IO server — see initSocketEmitter() below.

import './instrument'; // Sentry must be first — before any other import
import { loadWorkerEnv } from './config/env';
loadWorkerEnv(); // Fail fast if a required env var is missing/invalid — before any other module loads
import * as Sentry from '@sentry/node';
Sentry.setTag('service', 'worker');

import http from 'http';
import dotenv from 'dotenv';
dotenv.config();

import { connectRedis, redis, redisPub, redisSub } from './redis';
import { initSocketEmitter } from './socket';
// `./crons` (src/crons.ts) and `./crons/index` (src/crons/index.ts) are two SEPARATE
// modules with two separate sets of cron jobs — Node resolves the bare `./crons` to the
// *file* src/crons.ts, not the *directory* src/crons/index.ts, so these were never the
// same function. Both are real, needed functionality and both must be started here.
// See the comments at the top of each file for the full explanation.
import { initCrons as initFileCrons, stopCrons as stopFileCrons } from './crons';
import { initCrons as initDirCrons, stopCrons as stopDirCrons } from './crons/index';
import { closeWorkers } from './jobs/worker';
import { closeQueueConnections } from './jobs/queues';
import { shutdownAuditLogger } from './utils/logger';

process.on('uncaughtException', (err) => {
    console.error('[WORKER] UNCAUGHT EXCEPTION! 💥', err.name, err.message, err.stack);
    process.exit(1);
});
process.on('unhandledRejection', (err: any) => {
    const msg = err?.message || String(err);
    if (
        msg.includes('The client is closed') ||
        msg.includes('Redis Client Error') ||
        msg.includes('Redis Timeout') ||
        msg.includes('max requests limit exceeded') ||
        msg.includes('max_requests_limit') ||
        msg.includes('unexpected reply') ||
        msg.includes('ReplyError') ||
        err?.name === 'ReplyError'
    ) {
        console.warn('[WORKER] [REDIS WARNING] Ignored Redis error (operating on in-memory fallback):', msg);
        return;
    }
    console.error('[WORKER] UNHANDLED REJECTION! 💥', err?.name, err?.message);
    process.exit(1);
});

// Cloud Run requires every Service (as opposed to a Job) to listen on $PORT and answer
// health checks, even a background-only one like this. Kept intentionally trivial —
// no DB/Redis round trip — per the "health checks must be lightweight" requirement;
// readiness for actual work is reflected by whether the process is up at all.
const server = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            service: 'worker',
            redis: redis.isOpen && redisPub.isOpen && redisSub.isOpen ? 'connected' : 'degraded',
        }));
        return;
    }
    res.writeHead(404);
    res.end();
});

const PORT = process.env.WORKER_PORT || (process.env.NODE_ENV !== 'production' ? 8081 : (process.env.PORT || 8081));

const start = async () => {
    try {
        await connectRedis();
        console.log('[WORKER] Redis connected.');

        // Lets cron jobs (and anything else running in this process) emit real-time
        // events to clients connected to the API instances, without hosting a Socket.IO
        // server here — see src/socket/index.ts.
        initSocketEmitter();

        // Side-effect import: constructs the BullMQ Workers and starts consuming
        // 2qt:notifications / 2qt:invoices / 2qt:emails. This must only ever be
        // imported from this entry point, never from src/index.ts (the API process).
        await import('./jobs/worker');
        console.log('[WORKER] BullMQ workers started.');

        // The ONLY place in the whole codebase that calls either file's initCrons().
        // Do not add another call anywhere else — that's exactly the class of bug this
        // file exists to eliminate (see the import comment above for what actually
        // happened here previously).
        initFileCrons();
        initDirCrons();

        server.on('error', (err: any) => {
            if (err.code === 'EADDRINUSE') {
                console.warn(`[WORKER] Health check port ${PORT} already occupied — job processor continuing in secondary mode.`);
            } else {
                console.error('[WORKER] Health server error:', err.message);
            }
        });

        server.listen(PORT as number, '0.0.0.0', () => {
            console.log(`[WORKER] Health server listening on port ${PORT} (0.0.0.0)`);
        });

        const shutdown = (signal: string) => {
            console.log(`[WORKER][${signal}] Graceful shutdown initiated...`);
            (async () => {
                try {
                    // 1. Stop taking new health checks / scheduling further cron ticks.
                    stopFileCrons();
                    stopDirCrons();
                    server.close();

                    // 2. Let in-flight BullMQ jobs finish, then stop pulling new ones.
                    await closeWorkers();
                    await closeQueueConnections();

                    // Flush any audit log entries still sitting in the batch queue —
                    // refund/payout side effects processed here can enqueue audit events too.
                    await shutdownAuditLogger();

                    // 3. Close the shared Redis clients (cache, pub/sub for the socket
                    //    emitter) last, since the steps above may still use them.
                    await Promise.allSettled([redis.quit(), redisPub.quit(), redisSub.quit()]);

                    console.log(`[WORKER][${signal}] Shutdown complete. Exiting.`);
                    process.exit(0);
                } catch (err) {
                    console.error(`[WORKER][${signal}] Error during shutdown:`, err);
                    process.exit(1);
                }
            })();

            // Force exit if graceful shutdown takes too long (stuck job, stalled Redis
            // call) — kept short since PDF/notification jobs are seconds-scale, not
            // minutes-scale, and Cloud Run's own termination grace period is limited.
            setTimeout(() => {
                console.error(`[WORKER][${signal}] Forced exit after 25s`);
                process.exit(1);
            }, 25_000);
        };
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

    } catch (err) {
        console.error('[WORKER] Failed to start:', err);
        process.exit(1);
    }
};

start();
