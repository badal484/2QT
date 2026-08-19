import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { asyncLocalStorage, RequestContext } from '../utils/asyncContext';
import { pinoLogger } from '../utils/logger';

const TRACE_ID_RE = /^[0-9a-f]{32}$/i;

// Reuses the trace ID from an incoming W3C `traceparent` header
// (`version-traceid-parentid-flags`, e.g. from an upstream gateway or another
// internal service) so a request can be correlated end-to-end across hops;
// otherwise mints a fresh one.
function extractTraceId(req: Request): string {
    const header = req.headers['traceparent'];
    const value = Array.isArray(header) ? header[0] : header;
    if (value) {
        const parts = value.split('-');
        if (parts.length === 4 && TRACE_ID_RE.test(parts[1])) {
            return parts[1];
        }
    }
    return randomUUID().replace(/-/g, '');
}

// Opens an AsyncLocalStorage context for the lifetime of the request so every log
// statement made anywhere during it — route handlers, services, DB helpers — picks
// up traceId/userId automatically via logger.ts's Pino `mixin()`, with no manual
// passing required. userId is added later by middleware/auth.ts once the token is
// verified, via setContextUserId() mutating this same context object.
export function requestLogger(req: Request, res: Response, next: NextFunction) {
    const traceId = extractTraceId(req);
    const startTime = Date.now();

    const context: RequestContext = {
        traceId,
        method: req.method,
        path: req.originalUrl || req.url,
        ip: req.ip,
        startTime,
    };

    res.setHeader('x-trace-id', traceId);

    asyncLocalStorage.run(context, () => {
        res.on('finish', () => {
            pinoLogger.info(
                {
                    method: context.method,
                    path: context.path,
                    statusCode: res.statusCode,
                    durationMs: Date.now() - startTime,
                    ip: context.ip,
                },
                'request completed',
            );
        });

        next();
    });
}
