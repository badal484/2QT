// src/config/firebaseAdmin.ts
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { parseServiceAccount } from '../services/fcm.service';

// Single source of truth for credential parsing (see fcm.service.ts) — checks
// FIREBASE_SERVICE_ACCOUNT_B64 first, then FIREBASE_SERVICE_ACCOUNT_JSON. This file
// used to maintain its own separate copy that only checked FIREBASE_SERVICE_ACCOUNT_JSON
// (and an undocumented, never-used FIREBASE_SERVICE_ACCOUNT name) — if only the B64 var
// was set in production, this file silently fell back to default credentials while
// fcm.service.ts worked fine, causing prelaunch login token verification specifically
// to break while push notifications kept working. One parser now, can't drift again.
const serviceAccount = parseServiceAccount();

if (getApps().length === 0) {
  if (serviceAccount) {
    console.log('--- FIREBASE ADMIN: Initializing with service account credential');
    initializeApp({
      credential: cert(serviceAccount),
    });
  } else {
    console.warn('--- FIREBASE ADMIN: No service account configured in environment variables. Falling back to default app credentials.');
    try {
      initializeApp();
    } catch (e: any) {
      console.error('--- FIREBASE ADMIN: Failed to initialize with default credentials:', e.message);
    }
  }
}

export const firebaseAdminAuth = getAuth();
export { getAuth };
