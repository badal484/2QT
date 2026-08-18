import './instrument'; // Sentry must be first — before any other import
import 'express-async-errors';
import express from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import * as Sentry from '@sentry/node';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { connectRedis, redis, redisPub, redisSub } from './redis';
import { initSocket, io } from './socket';
import { errorHandler } from './middleware/errorHandler';
import { generalLimiter } from './middleware/rateLimiter';
import apiRouter from './routes';
import { notificationsQueue, invoicesQueue, emailsQueue, closeQueueConnections } from './jobs/queues';

// This process is the API only — it does NOT start BullMQ workers or node-cron.
// Those live exclusively in src/worker.ts (the singleton `2qt-worker` Cloud Run
// service) so that scaling this API out to N instances never multiplies job/cron
// execution. See src/worker.ts and src/crons/index.ts for the reasoning.
Sentry.setTag('service', 'api');

dotenv.config();

process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
    console.error(err.name, err.message, err.stack);
});

process.on('unhandledRejection', (err: any) => {
    console.error('UNHANDLED REJECTION! 💥 Shutting down...');
    console.error(err.name, err.message);
});


const app = express();
const server = http.createServer(app);

// Middleware
app.use(compression({ level: 6, threshold: 1024 })); // gzip responses > 1KB
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use('/public', express.static(path.join(__dirname, '../public')));
// CSP removal must come AFTER helmet so it overrides what helmet just set
app.use('/admin/queues', (_req, res, next) => {
    res.removeHeader('Content-Security-Policy');
    next();
});
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

// Refuse to boot with an open CORS policy in production — an empty
// ALLOWED_ORIGINS here used to fall through to "allow every origin" at
// request time instead of failing loudly at startup.
if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
    throw new Error('ALLOWED_ORIGINS must be set in production — refusing to start with an open CORS policy.');
}

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        // Only reached in non-production, where the above boot check guarantees
        // allowedOrigins is non-empty — this keeps local dev usable without
        // requiring ALLOWED_ORIGINS to be set.
        if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        // Allow all Cloudflare Workers, Vercel preview deployments, 2QT domains and tunnel tools
        if (
            origin.endsWith('.workers.dev') ||
            origin.endsWith('.vercel.app') ||
            origin.endsWith('2qthello.com') ||
            origin.endsWith('go2qt.com') ||
            origin.endsWith('.loca.lt') ||
            origin.endsWith('.ngrok.io') ||
            origin.endsWith('.ngrok-free.app')
        ) {
            return callback(null, true);
        }
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
}));
app.use((req, res, next) => {
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Keep-Alive', 'timeout=60');
    next();
});
app.use(express.json({
    verify: (req: any, res, buf) => {
        req.rawBody = buf;
    }
}));
app.use('/public', express.static('public', { maxAge: '7d' }));
app.use(generalLimiter);

// ─── Bull Board (queue monitor) — /admin/queues ───────────────────────────────
// Protected by HTTP Basic Auth — browser shows native dialog and replays
// credentials for every subsequent asset request (JWT Bearer won't work here).
// Set BULL_BOARD_PASSWORD in .env; defaults to 'admin' for local dev only.
const bullBoardAdapter = new ExpressAdapter();
bullBoardAdapter.setBasePath('/admin/queues');
createBullBoard({
    queues: [
        new BullMQAdapter(notificationsQueue),
        new BullMQAdapter(invoicesQueue),
        new BullMQAdapter(emailsQueue),
    ],
    serverAdapter: bullBoardAdapter,
});

function bullBoardAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    const auth = req.headers.authorization;
    if (auth?.startsWith('Basic ')) {
        const [, pass] = Buffer.from(auth.slice(6), 'base64').toString().split(':');
        if (pass === (process.env.BULL_BOARD_PASSWORD || 'admin')) return next();
    }
    res.set('WWW-Authenticate', 'Basic realm="Queue Monitor"');
    res.status(401).send('Authentication required');
}

app.use('/admin/queues', bullBoardAuth, bullBoardAdapter.getRouter());

// Health Check — verifies DB connectivity so load balancers get honest status
app.get('/api/v1/health', async (req, res) => {
    try {
        const { query } = await import('./db');
        await query('SELECT 1');
        res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
    } catch (err) {
        console.error('[HEALTH] DB check failed:', err);
        res.status(503).json({ status: 'error', db: 'disconnected', timestamp: new Date().toISOString() });
    }
});

// Routes
app.use('/api/v1', apiRouter);

app.get('/', (req, res) => {
    res.send('2QT API Server Running');
});

// Error Handling — Sentry must come before the custom error handler
Sentry.setupExpressErrorHandler(app);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

const start = async () => {
    try {
        // Run Migrations
        // We can run it in a separate process or call it here.
        // For simplicity, I'll ensure it's triggered.

        await connectRedis();
        console.log('Redis connected.');

        initSocket(server);
        console.log('Socket.io initialized.');

        server.listen(PORT as number, '0.0.0.0', () => {
            console.log(`[API] Server running on port ${PORT} (0.0.0.0)`);

            if (process.env.ENABLE_EMBEDDED_WORKER !== 'false') {
                console.log('[API] Starting embedded background workers and cron jobs...');
                try {
                    require('./jobs/worker');
                    const { initCrons: initFileCrons } = require('./crons');
                    const { initCrons: initDirCrons } = require('./crons/index');
                    initFileCrons();
                    initDirCrons();
                } catch (e: any) {
                    console.error('[API] Failed to initialize embedded workers:', e.message);
                }
            }
        });

        // Graceful shutdown — registered here so `server` is in scope
        const shutdown = (signal: string) => {
            console.log(`[${signal}] Graceful shutdown initiated...`);
            server.close(async () => {
                console.log(`[${signal}] HTTP server closed.`);
                try {
                    // Stop accepting new Socket.IO connections and notify existing
                    // clients before the process exits, rather than dropping them silently.
                    io?.close();
                    await closeQueueConnections();
                    await Promise.allSettled([redis.quit(), redisPub.quit(), redisSub.quit()]);
                } catch (err) {
                    console.error(`[${signal}] Error while closing resources:`, err);
                }
                console.log(`[${signal}] Shutdown complete. Exiting.`);
                process.exit(0);
            });
            // Force exit if shutdown takes longer than 30s (stuck requests)
            setTimeout(() => {
                console.error(`[${signal}] Forced exit after 30s`);
                process.exit(1);
            }, 30_000);
        };
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT',  () => shutdown('SIGINT'));

    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
};

start();
