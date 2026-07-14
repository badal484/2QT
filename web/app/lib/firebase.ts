import { initializeApp, getApps } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCmN6UbkpIjP-_nb9E_g0EXi5t_2Daub_Y",
  authDomain: "qqtt-ddd83.firebaseapp.com",
  projectId: "qqtt-ddd83",
  storageBucket: "qqtt-ddd83.firebasestorage.app",
  messagingSenderId: "1613467594",
  appId: "1:1613467594:web:8198288b189cc976a04933",
  measurementId: "G-MVJ05EEQEK",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export { app };

export async function initAnalytics() {
  if (typeof window === "undefined") return null;
  const supported = await isSupported();
  if (!supported) return null;
  return getAnalytics(app);
}
