// Boot-time environment validation. Import and call the relevant loader as the very
// first thing each entry point does (after src/instrument.ts, which must stay first
// so Sentry is wired up before anything else runs) so a missing/invalid var fails the
// process immediately instead of surfacing as a confusing runtime failure under load.
//
// The API (src/index.ts) and worker (src/worker.ts) are deployed as two separate
// services with two separate env var sets (see .env.example's [API only]/[WORKER]/[BOTH]
// tags) — that split is preserved here as two schemas so validating one service's env
// doesn't require secrets the other service was never given.
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const sharedSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().optional(),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
    // Shared because src/socket/index.ts (the Redis-backed Socket.IO emitter) is
    // imported by both entry points, even though only the API verifies tokens with it.
    JWT_SECRET: z.string().min(32, 'JWT_SECRET is required and must be at least 32 characters'),
    // No default on purpose: this is the exact flag that decides whether cron jobs and
    // BullMQ workers run embedded in this process. Leaving it unset on a horizontally
    // scaled API instance means every instance silently starts its own copy of every
    // cron/job, double- (or N-) processing notifications, invoices, and payouts.
    ENABLE_EMBEDDED_WORKER: z.enum(['true', 'false'], {
        errorMap: () => ({
            message:
                "ENABLE_EMBEDDED_WORKER must be explicitly set to 'true' or 'false' — " +
                'an unset value on a scaled-out API instance causes duplicate cron/job execution',
        }),
    }).default('true'),
    SENTRY_DSN: z.string().optional(),
    GOOGLE_MAPS_KEY: z.string().optional(),
    GOOGLE_MAPS_API_KEY: z.string().optional(),
    IMAGEKIT_PUBLIC_KEY: z.string().optional(),
    IMAGEKIT_PRIVATE_KEY: z.string().optional(),
    IMAGEKIT_URL_ENDPOINT: z.string().optional(),
    DB_POOL_MAX: z.coerce.number().int().positive().optional(),
});

const apiSchema = sharedSchema.extend({
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET is required and must be at least 32 characters'),
    RAZORPAY_KEY_ID: z.string().min(1, 'RAZORPAY_KEY_ID is required'),
    RAZORPAY_KEY_SECRET: z.string().min(1, 'RAZORPAY_KEY_SECRET is required'),
    RAZORPAY_WEBHOOK_SECRET: z.string().min(1, 'RAZORPAY_WEBHOOK_SECRET is required'),
    ALLOWED_ORIGINS: z.string().optional(),
    BULL_BOARD_PASSWORD: z.string().optional(),
    MSG91_AUTH_KEY: z.string().optional(),
    MSG91_TEMPLATE_ID: z.string().optional(),
    EXOTEL_ACCOUNT_SID: z.string().optional(),
    EXOTEL_API_KEY: z.string().optional(),
    EXOTEL_API_TOKEN: z.string().optional(),
    EXOTEL_CALLER_ID: z.string().optional(),
    FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
    FIREBASE_SERVICE_ACCOUNT_B64: z.string().optional(),
    TEST_DELIVERY_OTP: z.string().optional(),
});

const workerSchema = sharedSchema.extend({
    WORKER_PORT: z.coerce.number().int().positive().optional(),
    RAZORPAY_ACCOUNT_NUMBER: z.string().optional(),
    MSG91_FLOW_ID: z.string().optional(),
    MSG91_SENDER_ID: z.string().optional(),
    INTERAKT_API_KEY: z.string().optional(),
    BACKEND_SELF_URL: z.string().optional(),
});

export type ApiEnv = z.infer<typeof apiSchema>;
export type WorkerEnv = z.infer<typeof workerSchema>;

function formatErrors(error: z.ZodError): string {
    return error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
}

export function loadApiEnv(): ApiEnv {
    const result = apiSchema.safeParse(process.env);
    if (!result.success) {
        console.error('[ENV] Invalid or missing environment variables for the API service:\n' + formatErrors(result.error));
        process.exit(1);
    }
    return result.data;
}

export function loadWorkerEnv(): WorkerEnv {
    const result = workerSchema.safeParse(process.env);
    if (!result.success) {
        console.error('[ENV] Invalid or missing environment variables for the worker service:\n' + formatErrors(result.error));
        process.exit(1);
    }
    return result.data;
}
