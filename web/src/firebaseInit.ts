// web/src/firebaseInit.ts
// This file contains the explicit Firebase initialization you requested, including Analytics.

import { initializeApp } from "firebase/app";
import { getAnalytics, Analytics } from "firebase/analytics";

// Hard‑coded configuration (replace with env vars for production if needed)
const firebaseConfig = {
  apiKey: "AIzaSyCmN6UbkpIjP-_nb9E_g0EXi5t_2Daub_Y",
  authDomain: "qqtt-ddd83.firebaseapp.com",
  projectId: "qqtt-ddd83",
  storageBucket: "qqtt-ddd83.firebasestorage.app",
  messagingSenderId: "1613467594",
  appId: "1:1613467594:web:8198288b189cc976a04933",
  measurementId: "G-MVJ05EEQEK",
};

// Initialize Firebase app and Analytics instance
export const firebaseApp = initializeApp(firebaseConfig);
export const analytics: Analytics | null = typeof window !== "undefined" ? getAnalytics(firebaseApp) : null;

// Export the Auth instance for reuse elsewhere in the web codebase (optional)
import { getAuth } from "firebase/auth";
export const auth = getAuth(firebaseApp);
