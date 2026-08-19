// Request-scoped context propagated implicitly through async call chains via
// AsyncLocalStorage, so any code deep in a request (or a background job that
// restores it — see jobs/worker.ts) can attach trace/user identity to a log
// line without threading it through every function signature.
import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
    traceId: string;
    userId?: string;
    method?: string;
    path?: string;
    ip?: string;
    startTime: number;
}

export const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

export function getContext(): RequestContext | undefined {
    return asyncLocalStorage.getStore();
}

export function getTraceId(): string | undefined {
    return asyncLocalStorage.getStore()?.traceId;
}

// Called by the auth middleware once a token is verified — userId is only known
// partway through the request, after requestLogger has already opened the context.
export function setContextUserId(userId: string): void {
    const store = asyncLocalStorage.getStore();
    if (store) store.userId = userId;
}

export function runWithContext<T>(context: RequestContext, fn: () => T): T {
    return asyncLocalStorage.run(context, fn);
}

// Restores a trace context from a serialized traceId (e.g. a BullMQ job payload).
// If no traceId is available, the handler just runs without one — logs from that
// invocation simply won't carry a traceId field rather than failing.
export function runWithTraceId<T>(traceId: string | undefined, fn: () => T): T {
    if (!traceId) return fn();
    return asyncLocalStorage.run({ traceId, startTime: Date.now() }, fn);
}
