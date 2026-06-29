// Removed top-level store import to break circular dependency
import { setAccessToken, logout } from '../store/slices/authSlice';

import { ENV } from '../config/env';

const BASE_URL = ENV.API_URL;
export const APP_VERSION = ENV.APP_VERSION;


interface RequestOptions {
  method?: string;
  body?: any;
  timeout?: number;
}

const request = async (path: string, options: RequestOptions = {}): Promise<any> => {
  let store;
  try {
    const storeModule = require('../store');
    store = storeModule.store || storeModule.default || storeModule;
  } catch (e) {
    console.error('--- CLIENT: FAILED TO REQUIRE STORE:', e);
  }

  if (!store || typeof store.getState !== 'function') {
    console.error('--- CLIENT: STORE NOT FOUND OR INVALID', store);
    throw new Error('INTERNAL_ERROR: Store not initialized');
  }

  const state = store.getState();
  const token = state?.auth?.accessToken;

  const headers: any = {
    'Content-Type': 'application/json',
    'Accept-Encoding': 'gzip, deflate',
    'X-App-Version': APP_VERSION,
    'Bypass-Tunnel-Reminder': 'true',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fetchOptions: any = {
    method: options.method || 'GET',
    headers,
  };

  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  if (__DEV__) console.log(`[API] ${fetchOptions.method} ${path}`);
  
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

  // SYSTEMATIC INTEGRATION: Exponential Backoff Retry Engine
  const MAX_RETRIES = 1;
  const delay = (ms: number) => new Promise<void>(res => setTimeout(res, ms));

  let response;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const waitTime = Math.pow(2, attempt - 1) * 1000;
        await delay(waitTime);
      }

      response = await fetchWithTimeout(`${BASE_URL}${path}`, fetchOptions);
      break; // Success!
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
    }
  }


  if (!response) {
    throw new Error('NETWORK_ERROR: No response received');
  }

  if (response.status === 401 && state.auth.refreshToken) {
    // Attempt token refresh
    const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: state.auth.refreshToken }),
    });

    if (refreshRes.ok) {
      const { accessToken } = await refreshRes.json();
      store.dispatch(setAccessToken(accessToken));
      
      // Retry original request
      headers['Authorization'] = `Bearer ${accessToken}`;
      response = await fetch(`${BASE_URL}${path}`, fetchOptions);
    } else {
      store.dispatch(logout());
      throw new Error('SESSION_EXPIRED');
    }
  }

  let data;
  const contentType = response.headers.get('content-type');
  
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      throw new Error('SERVER_ERROR: Invalid JSON response');
    }
  } else {
    throw new Error('SERVER_ERROR: Unexpected response format');
  }

  if (!response.ok) {
    throw new Error(data.message || data.error || 'UNKNOWN_ERROR');
  }

  return data;
};

export const api = {
  get: (path: string, opts?: { timeout?: number }) => request(path, { timeout: opts?.timeout }),
  post: (path: string, body?: any) => request(path, { method: 'POST', body }),
  put: (path: string, body?: any) => request(path, { method: 'PUT', body }),
  patch: (path: string, body?: any) => request(path, { method: 'PATCH', body }),
  delete: (path: string) => request(path, { method: 'DELETE' }),
};
