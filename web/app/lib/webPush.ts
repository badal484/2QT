// Registers this browser for VAPID web-push and saves the subscription to the backend.
// Called once after the user logs in. Safe to call repeatedly — exits early if already subscribed.

import { api } from "./api";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export async function registerWebPush(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) return;

  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;

    // Already subscribed — re-save in case backend lost the row
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      const json = existing.toJSON();
      await api.post("/notifications/subscribe", {
        subscription: { endpoint: existing.endpoint, keys: json.keys },
      });
      return;
    }

    // Ask permission (browser native dialog — no custom UI needed)
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
    });

    const json = sub.toJSON();
    await api.post("/notifications/subscribe", {
      subscription: { endpoint: sub.endpoint, keys: json.keys },
    });
  } catch (err) {
    console.warn("[WebPush] registration failed:", err);
  }
}
