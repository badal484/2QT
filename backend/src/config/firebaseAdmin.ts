// src/config/firebaseAdmin.ts
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Parses the Firebase service-account credential used to initialize Firebase Admin
// (needed for Firebase Auth — phone-login OTP token verification in routes/prelaunch.ts).
// Prefers FIREBASE_SERVICE_ACCOUNT_B64 (immune to newline/escaping issues in env var
// editors) and falls back to FIREBASE_SERVICE_ACCOUNT_JSON.
export function parseServiceAccount(): any | null {
    const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
    if (b64) {
        try {
            const sa = JSON.parse(Buffer.from(b64.trim(), 'base64').toString('utf8'));
            if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n');
            return sa;
        } catch (e) {
            console.error('[FIREBASE_ADMIN] Failed to decode FIREBASE_SERVICE_ACCOUNT_B64:', e);
        }
    }

    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (raw) {
        try {
            const sa = JSON.parse(raw);
            if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n');
            return sa;
        } catch (e) {
            console.error('[FIREBASE_ADMIN] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', e);
        }
    }

    return null;
}

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

import { getMessaging } from 'firebase-admin/messaging';

export const firebaseAdminAuth = getAuth();
export const firebaseAdminMessaging = getMessaging();
export { getAuth, getMessaging };

