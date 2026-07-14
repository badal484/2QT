// src/config/firebaseAdmin.ts
import admin from 'firebase-admin';
import { ServiceAccount } from 'firebase-admin';

// Load service account from environment variable or JSON file.
// It's recommended to set GOOGLE_APPLICATION_CREDENTIALS env var pointing to the service account JSON.
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : (require('../../google-services.json') as ServiceAccount);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export const firebaseAdmin = admin;
