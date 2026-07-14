// src/config/firebaseAdmin.ts
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Load Service Account JSON from env var (either FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT)
const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT;
let serviceAccount: any = null;

if (serviceAccountEnv) {
  try {
    serviceAccount = JSON.parse(serviceAccountEnv);
    if (serviceAccount && typeof serviceAccount.private_key === 'string') {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
  } catch (err: any) {
    console.error('--- FIREBASE ADMIN: Failed to parse service account JSON string:', err.message);
  }
}

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
