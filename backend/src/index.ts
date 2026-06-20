import './jobs/worker'; // Start background job processing
import 'express-async-errors';
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import * as Sentry from '@sentry/node';
import { connectRedis } from './redis';
import { initSocket } from './socket';
import { initCrons } from './crons';
import { errorHandler } from './middleware/errorHandler';
import { generalLimiter } from './middleware/rateLimiter';
import apiRouter from './routes';
import './jobs/queues'; // Start background workers

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

// Health Check
app.get('/api/v1/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

        server.listen(PORT as number, '0.0.0.0', () => {
            console.log(`Server running on port ${PORT} (0.0.0.0)`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
};

start();
