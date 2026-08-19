// Two distinct logging paths, deliberately kept separate:
//
// 1. `logger` — operational logs. Structured JSON to stdout via Pino, non-blocking,
//    no DB write. Use this for anything request/debug/trace level.
//
// 2. `logSystemEvent` — the audit trail. Compliance/security/critical business
//    milestones only (admin actions, payment status changes, overrides, refunds).
//    Writes go through a bounded in-memory batch queue and land in the
//    `system_audit_logs` Postgres table on a timer, never inline on the caller's
//    request path.
import pino from 'pino';
import { query } from '../db';
import { getContext } from './asyncContext';

const isProd = process.env.NODE_ENV === 'production';

// Pino redaction: scrub these keys wherever they appear at a top level or one level
// of nesting (the common shapes: a flat metadata object, or `req.body.<key>` /
// `req.headers.<key>`). Values are replaced with '[REDACTED]', never dropped, so the
// key's presence is still visible in the log.
const SENSITIVE_KEYS = ['password', 'token', 'authorization', 'otp', 'creditCard', 'cvv', 'pin', 'secret'];
const redactPaths = SENSITIVE_KEYS.flatMap((key) => [key, `*.${key}`, `req.body.${key}`, `req.headers.${key}`]);

export const pinoLogger = pino({
    level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
    redact: { paths: redactPaths, censor: '[REDACTED]' },
    // Injects the active request/job's trace identity into every log line
    // automatically — callers never pass traceId/userId themselves.
    mixin() {
        const ctx = getContext();
        if (!ctx) return {};
        const fields: Record<string, unknown> = { traceId: ctx.traceId };
        if (ctx.userId) fields.userId = ctx.userId;
        return fields;
    },
    ...(isProd
        ? {}
        : {
              transport: {
                  target: 'pino-pretty',
                  options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
              },
          }),
});

type LogMeta = Record<string, unknown>;

export const logger = {
    debug: (message: string, meta?: LogMeta) => pinoLogger.debug(meta || {}, message),
    info: (message: string, meta?: LogMeta) => pinoLogger.info(meta || {}, message),
    warn: (message: string, meta?: LogMeta) => pinoLogger.warn(meta || {}, message),
    error: (message: string, meta?: LogMeta) => pinoLogger.error(meta || {}, message),
    fatal: (message: string, meta?: LogMeta) => pinoLogger.fatal(meta || {}, message),
};

// ─── Audit log: bounded async batch queue → system_audit_logs ─────────────────

export type LogSeverity = 'info' | 'warning' | 'error' | 'critical';

interface AuditLogEntry {
    severity: LogSeverity;
    component: string;
    eventType: string;
    message: string;
    metadata: unknown;
    sourceIp: string | null;
}

const AUDIT_QUEUE_MAX = 5000;
const AUDIT_FLUSH_INTERVAL_MS = 2000;

const auditQueue: AuditLogEntry[] = [];
let auditFlushInFlight = false;

function enqueueAuditLog(entry: AuditLogEntry): void {
    if (auditQueue.length >= AUDIT_QUEUE_MAX) {
        // Drop the oldest entry to make room. Losing one old audit row to a burst is
        // preferable to growing the queue unbounded or blocking the caller.
        auditQueue.shift();
        pinoLogger.error({ component: entry.component }, 'Audit log queue at capacity — oldest entry dropped');
    }
    auditQueue.push(entry);
}

async function flushAuditQueue(): Promise<void> {
    if (auditFlushInFlight || auditQueue.length === 0) return;
    auditFlushInFlight = true;
    const batch = auditQueue.splice(0, auditQueue.length);
    try {
        const values: unknown[] = [];
        const rowPlaceholders = batch.map((entry, i) => {
            const base = i * 6;
            values.push(
                entry.severity,
                entry.component,
                entry.eventType,
                entry.message,
                entry.metadata != null ? JSON.stringify(entry.metadata) : null,
                entry.sourceIp,
            );
            return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
        });
        await query(
            `INSERT INTO system_audit_logs (severity, component, event_type, message, metadata, source_ip)
             VALUES ${rowPlaceholders.join(', ')}`,
            values,
        );
    } catch (err) {
        pinoLogger.error({ err, droppedCount: batch.length }, 'Audit log batch flush failed — entries lost');
    } finally {
        auditFlushInFlight = false;
    }
}

const auditFlushTimer = setInterval(() => {
    flushAuditQueue().catch(() => {});
}, AUDIT_FLUSH_INTERVAL_MS);
auditFlushTimer.unref(); // never keep the process alive for this alone

// Call from the SIGTERM/SIGINT shutdown path (before the DB pool closes) so nothing
// still queued at shutdown time is silently lost.
export async function shutdownAuditLogger(): Promise<void> {
    clearInterval(auditFlushTimer);
    await flushAuditQueue();
}

export function logSystemEvent(
    eventType: string,
    message: string,
    severity: LogSeverity = 'info',
    metadata: unknown = null,
): void {
    const ctx = getContext();
    enqueueAuditLog({
        severity,
        component: 'SYSTEM',
        eventType,
        message,
        metadata,
        sourceIp: ctx?.ip ?? null,
    });

    // Mirror to stdout for real-time visibility/alerting — the DB row is the durable
    // compliance record, this is so the event also shows up in normal log aggregation.
    const pinoLevel: 'fatal' | 'error' | 'warn' | 'info' =
        severity === 'critical' ? 'fatal' : severity === 'warning' ? 'warn' : severity === 'error' ? 'error' : 'info';
    pinoLogger[pinoLevel]({ component: 'SYSTEM', eventType, metadata }, message);
}
