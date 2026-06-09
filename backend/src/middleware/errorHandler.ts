import { Request, Response, NextFunction } from 'express';
import { logSystemEvent } from '../utils/logger';
import { emitToAdmin } from '../socket';

export const errorHandler = (err: any, req: any, res: Response, next: NextFunction) => {
    const status = err.status || 500;
    const message = err.message || 'Internal Server Error';
    const errorCode = err.code || 'INTERNAL_ERROR';

    // SYSTEMATIC INTEGRATION: Observable Mission Control
    if (status >= 500) {
        const userId = req.user?.userId || 'GUEST';
        const context = {
            method: req.method,
            url: req.url,
            body: req.body,
            stack: err.stack,
            userId
        };

        console.error(`--- SYSTEMATIC CRASH [${userId}]: ${req.method} ${req.url}`, err);

        // 1. Record in DB Audit Log
        logSystemEvent('SERVER_CRASH', `Critical error at ${req.url}: ${message}`, 'critical', context);

        // 2. Pulse real-time alert to Admin Dashboard
        emitToAdmin('critical_alert', {
            type: 'SERVER_ERROR',
            message: `CRITICAL: ${message} at ${req.url}`,
            userId
        });
    }

    res.status(status).json({
        error: errorCode,
        message: message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
};
