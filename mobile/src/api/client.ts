import { setAccessToken, logout } from '../store/slices/authSlice';
import { ENV } from '../config/env';

const BASE_URL = ENV.API_URL;
export const APP_VERSION = ENV.APP_VERSION;

let _cachedStore: any = null;
const getStore = () => {
  if (_cachedStore && typeof _cachedStore.getState === 'function') return _cachedStore;
  try {
    const m = require('../store');
    _cachedStore = m.store || m.default || m;
    return _cachedStore;
  } catch (e) {
    console.error('--- CLIENT: FAILED TO REQUIRE STORE:', e);
    return null;
  }
};

// Generate lightweight client-side UUIDv4 for Idempotency
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

interface RequestOptions {
  method?: string;
  body?: any;
  timeout?: number;
  idempotencyKey?: string;
  skipAuth?: boolean;
}

// ─── Atomic Token Refresh Mutex ─────────────────────────────────────────────
let isRefreshing = false;
let refreshSubscribers: Array<{
  resolve: (token: string) => void;
  reject: (err: any) => void;
}> = [];

const subscribeTokenRefresh = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    refreshSubscribers.push({ resolve, reject });
  });
};

const onTokenRefreshed = (newToken: string) => {
  refreshSubscribers.forEach((sub) => sub.resolve(newToken));
  refreshSubscribers = [];
};

const onTokenRefreshFailed = (err: any) => {
  refreshSubscribers.forEach((sub) => sub.reject(err));
  refreshSubscribers = [];
};

const performTokenRefresh = async (refreshToken: string, store: any): Promise<string> => {
  try {
    const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-App-Version': APP_VERSION },
      body: JSON.stringify({ refreshToken }),
    });

    if (refreshRes.ok) {
      const { accessToken } = await refreshRes.json();
      store.dispatch(setAccessToken(accessToken));
      onTokenRefreshed(accessToken);
      return accessToken;
    } else {
      store.dispatch(logout());
      const error = new Error('SESSION_EXPIRED');
      onTokenRefreshFailed(error);
      throw error;
    }
  } catch (err) {
    store.dispatch(logout());
    onTokenRefreshFailed(err);
    throw err;
  } finally {
    isRefreshing = false;
  }
};

// ─── Core Request Engine ───────────────────────────────────────────────────
const request = async (path: string, options: RequestOptions = {}): Promise<any> => {
  const store = getStore();
  const state = store && typeof store.getState === 'function' ? store.getState() : null;
  let token = state?.auth?.accessToken;

  const method = options.method || 'GET';
  const isFormData = options.body instanceof FormData;
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());

  // Automatic idempotency key for mutations to prevent double orders/payments on retries
  const idempotencyKey = options.idempotencyKey || (isMutation ? generateUUID() : undefined);

  const buildHeaders = (authToken?: string) => {
    const headers: Record<string, string> = {
      'Accept-Encoding': 'gzip, deflate',
      'X-App-Version': APP_VERSION,
      'Bypass-Tunnel-Reminder': 'true',
    };

    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    if (idempotencyKey) {
      headers['X-Idempotency-Key'] = idempotencyKey;
    }

    if (authToken && !options.skipAuth) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    return headers;
  };

  const fetchWithTimeout = async (url: string, opts: any, timeout = options.timeout ?? 30000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { ...opts, signal: controller.signal });
      clearTimeout(id);
      return response;
    } catch (e) {
      clearTimeout(id);
      throw e;
    }
  };

  // Exponential backoff with jitter
  const MAX_RETRIES = isMutation ? 0 : 1; // Mutations must not blind-retry without idempotency guarantee
  const delayWithJitter = (attempt: number) => {
    const base = 500;
    const max = 2000;
    const jitter = Math.random() * Math.min(max, base * Math.pow(2, attempt));
    return new Promise<void>((res) => setTimeout(res, jitter));
  };

  let response: Response | null = null;
  let lastError: any = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        await delayWithJitter(attempt);
      }

      const fetchOptions: any = {
        method,
        headers: buildHeaders(token),
      };

      if (options.body) {
        fetchOptions.body = isFormData ? options.body : JSON.stringify(options.body);
      }

      if (__DEV__) console.log(`[API] ${method} ${path}`);
      response = await fetchWithTimeout(`${BASE_URL}${path}`, fetchOptions);
      break;
    } catch (err) {
      lastError = err;
      if (attempt === MAX_RETRIES) throw err;
    }
  }

  if (!response) {
    throw lastError || new Error('NETWORK_ERROR: No response received');
  }

  // ─── 401 Unauthorized Mutex Handling ─────────────────────────────────────
  if (response.status === 401 && !options.skipAuth && state?.auth?.refreshToken) {
    let resolvedToken: string;

    if (isRefreshing) {
      // Wait for existing refresh to complete
      resolvedToken = await subscribeTokenRefresh();
    } else {
      isRefreshing = true;
      resolvedToken = await performTokenRefresh(state.auth.refreshToken, store);
    }

    // Replay original request with refreshed token
    const replayOptions: any = {
      method,
      headers: buildHeaders(resolvedToken),
    };
    if (options.body) {
      replayOptions.body = isFormData ? options.body : JSON.stringify(options.body);
    }
    response = await fetchWithTimeout(`${BASE_URL}${path}`, replayOptions);
  }

  // ─── Response Parsing & Error Normalization ──────────────────────────────
  let data: any;
  const contentType = response.headers.get('content-type');

  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      throw new Error('SERVER_ERROR: Invalid JSON response');
    }
  } else {
    data = { status: response.status, statusText: response.statusText };
  }

  if (!response.ok) {
    const errorMsg = data?.message || data?.error || `HTTP_${response.status}`;
    const error: any = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
};

export const api = {
  get: (path: string, opts?: { timeout?: number; skipAuth?: boolean }) =>
    request(path, { method: 'GET', timeout: opts?.timeout, skipAuth: opts?.skipAuth }),
  post: (path: string, body?: any, opts?: { timeout?: number; idempotencyKey?: string; skipAuth?: boolean }) =>
    request(path, { method: 'POST', body, timeout: opts?.timeout, idempotencyKey: opts?.idempotencyKey, skipAuth: opts?.skipAuth }),
  put: (path: string, body?: any, opts?: { timeout?: number; idempotencyKey?: string }) =>
    request(path, { method: 'PUT', body, timeout: opts?.timeout, idempotencyKey: opts?.idempotencyKey }),
  patch: (path: string, body?: any, opts?: { timeout?: number; idempotencyKey?: string }) =>
    request(path, { method: 'PATCH', body, timeout: opts?.timeout, idempotencyKey: opts?.idempotencyKey }),
  delete: (path: string, opts?: { timeout?: number; idempotencyKey?: string }) =>
    request(path, { method: 'DELETE', timeout: opts?.timeout, idempotencyKey: opts?.idempotencyKey }),
};
