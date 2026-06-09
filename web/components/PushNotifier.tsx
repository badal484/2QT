"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { Bell, BellRing } from 'lucide-react';
import { toast } from 'sonner';

function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export default function PushNotifier() {
    const { user } = useAuth() || {};
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isSupported, setIsSupported] = useState(false);

    useEffect(() => {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            setIsSupported(true);
            registerServiceWorker();
        }
    }, []);

    const registerServiceWorker = async () => {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            const subscription = await registration.pushManager.getSubscription();
            if (subscription) setIsSubscribed(true);
        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    };

    const subscribeToPush = async () => {
        if (!user) {
            toast.error("Please login to enable notifications");
            return;
        }

        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                toast.error("Notification permission denied");
                return;
            }

            const registration = await navigator.serviceWorker.ready;
            
            const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            if (!vapidKey) {
                console.error("VAPID key not found");
                return;
            }

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidKey)
            });

            await api.post('/notifications/subscribe', {
                subscription: subscription.toJSON()
            });

            setIsSubscribed(true);
            toast.success("Live order updates enabled! 🚀");
            
            // Show a test notification immediately
            if (Notification.permission === 'granted') {
                 navigator.serviceWorker.ready.then(reg => {
                    reg.showNotification("Notifications Enabled", {
                        body: "You will now receive live updates for your orders!",
                        icon: "/icon-192x192.png",
                        vibrate: [200, 100, 200]
                    });
                 });
            }

        } catch (error) {
            console.error('Failed to subscribe:', error);
            toast.error("Failed to enable notifications");
        }
    };

    if (!isSupported) return null;

    return (
        <button
            onClick={subscribeToPush}
            disabled={isSubscribed}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                isSubscribed 
                ? 'bg-green-100 text-green-700' 
                : 'bg-brand-primary/10 text-brand-primary hover:bg-brand-primary hover:text-white'
            }`}
        >
            {isSubscribed ? <BellRing className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">
                {isSubscribed ? 'Notifications On' : 'Enable Notifications'}
            </span>
        </button>
    );
}
