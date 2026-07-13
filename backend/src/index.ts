import './jobs/worker'; // Start background job processing
import 'express-async-errors';
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import * as Sentry from '@sentry/node';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { connectRedis } from './redis';
import { initSocket } from './socket';
import { initCrons } from './crons';
import { initCrons as initCronsExt } from './crons/index';
import { errorHandler } from './middleware/errorHandler';
import { generalLimiter } from './middleware/rateLimiter';
import apiRouter from './routes';
import { notificationsQueue, invoicesQueue, emailsQueue } from './jobs/queues';

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

// Sentry Init
if (process.env.SENTRY_DSN) {
    Sentry.init({ dsn: process.env.SENTRY_DSN });
}

// Middleware
app.use(compression({ level: 6, threshold: 1024 })); // gzip responses > 1KB
app.use(helmet({ crossOriginResourcePolicy: false }));
// CSP removal must come AFTER helmet so it overrides what helmet just set
app.use('/admin/queues', (_req, res, next) => {
    res.removeHeader('Content-Security-Policy');
    next();
});
app.use(cors());
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

// Error Handling
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

        initCrons();
        initCronsExt();

        server.listen(PORT as number, '0.0.0.0', () => {
            console.log(`Server running on port ${PORT} (0.0.0.0)`);
        });

        // Graceful shutdown — registered here so `server` is in scope
        const shutdown = (signal: string) => {
            console.log(`[${signal}] Graceful shutdown initiated...`);
            server.close(() => {
                console.log(`[${signal}] HTTP server closed. Exiting.`);
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
