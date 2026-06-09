import { Platform } from 'react-native';
// Removed top-level store import to break circular dependency
import { setAccessToken, logout } from '../store/slices/authSlice';

const BASE_URL = Platform.OS === 'android' 
  ? 'http://192.168.0.143:3000/api/v1' 
  : 'http://localhost:3000/api/v1';

export const APP_VERSION = '1.0.0';


interface RequestOptions {
  method?: string;
  body?: any;
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
    'X-App-Version': APP_VERSION,
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

  console.log(`--- API REQUEST: [${fetchOptions.method}] ${BASE_URL}${path}`);
  
  const fetchWithTimeout = async (url: string, opts: any, timeout = 10000) => {
    // Offline Mock Intercepts
    if (url.includes('/auth/send-otp')) {
      console.log('--- [OFFLINE MOCK] /auth/send-otp ---');
      const body = JSON.parse(opts.body || '{}');
      return { ok: true, status: 200, json: async () => ({ sent: true, phone: body.phone }), headers: { get: () => 'application/json' } };
    }
    if (url.includes('/auth/verify-otp')) {
      console.log('--- [OFFLINE MOCK] /auth/verify-otp ---');
      const body = JSON.parse(opts.body || '{}');
      const phone = body.phone || "";
      let role = "customer";
      if (phone.includes("0000000000")) role = "super_admin";
      else if (phone.includes("1111111111")) role = "chef";
      else if (phone.includes("2222222222")) role = "rider";
      
      return { 
        ok: true, 
        status: 200, 
        json: async () => ({ 
          accessToken: "mock_token", 
          refreshToken: "mock_refresh", 
          user: { id: "mock_id", name: "Mock User", phone, role, is_verified: true, onboarding_complete: true } 
        }),
        headers: { get: () => 'application/json' }
      };
    }
    if (url.includes('/auth/onboarding/complete')) {
      console.log('--- [OFFLINE MOCK] /auth/onboarding/complete ---');
      return { ok: true, status: 200, json: async () => ({ success: true }), headers: { get: () => 'application/json' } };
    }
    if (url.includes('/app/version')) {
      return { ok: true, status: 200, json: async () => ({ forceUpdate: false, maintenanceMode: false }), headers: { get: () => 'application/json' } };
    }

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
  const MAX_RETRIES = 3;
  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
  
  let response;
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const waitTime = Math.pow(2, attempt - 1) * 1000;
        console.log(`--- SYSTEMATIC RETRY [Attempt ${attempt}]: Waiting ${waitTime}ms for ${path}`);
        await delay(waitTime);
      }
      
      response = await fetchWithTimeout(`${BASE_URL}${path}`, fetchOptions);
      break; // Success!
    } catch (err) {
      lastError = err;
      if (attempt === MAX_RETRIES) {
        console.warn('--- SYSTEMATIC NETWORK FAILURE: Max retries reached ---', err);
        throw err;
      }
    }
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
    } catch (e) {
      console.error('--- API JSON PARSE ERROR:', e);
      throw new Error('SERVER_ERROR: Invalid JSON response');
    }
  } else {
    const text = await response.text();
    console.error('--- API NON-JSON RESPONSE:', text.slice(0, 200));
    throw new Error('SERVER_ERROR: Expected JSON but received HTML/Text. Check backend logs.');
  }

  if (!response.ok) {
    throw new Error(data.error || 'UNKNOWN_ERROR');
  }

  return data;
};

export const api = {
  get: (path: string) => request(path),
  post: (path: string, body: any) => request(path, { method: 'POST', body }),
  patch: (path: string, body: any) => request(path, { method: 'PATCH', body }),
  delete: (path: string) => request(path, { method: 'DELETE' }),
};
