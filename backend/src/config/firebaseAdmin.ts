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
      console.log('--- FIREBASE ADMIN DIAGNOSTICS:');
      console.log('    Raw private_key length:', serviceAccount.private_key.length);
      console.log('    Starts with BEGIN:', serviceAccount.private_key.startsWith('-----BEGIN PRIVATE KEY-----'));
      console.log('    Ends with END:', serviceAccount.private_key.trim().endsWith('-----END PRIVATE KEY-----'));
      console.log('    Contains raw \\n (literal):', serviceAccount.private_key.includes('\\n'));
      console.log('    Contains actual newline:', serviceAccount.private_key.includes('\n'));
      
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      
      console.log('    After replacement length:', serviceAccount.private_key.length);
      console.log('    After replacement contains actual newline:', serviceAccount.private_key.includes('\n'));
    } else {
      console.error('--- FIREBASE ADMIN DIAGNOSTICS: serviceAccount or private_key is invalid type:', typeof serviceAccount);
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
