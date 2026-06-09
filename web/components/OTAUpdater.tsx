"use client";

import { useEffect } from 'react';
import { toast } from 'sonner';

export default function OTAUpdater() {
    useEffect(() => {
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').then((registration) => {
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                // A new service worker is installed and waiting
                                toast('A new version of 2QT is available!', {
                                    action: {
                                        label: 'Update Now',
                                        onClick: () => {
                                            newWorker.postMessage({ type: 'SKIP_WAITING' });
                                            window.location.reload();
                                        }
                                    },
                                    duration: Infinity, // Keep it open until they click
                                });
                            }
                        });
                    }
                });
            }).catch((err) => {
                console.error("Service Worker registration failed:", err);
            });

            // Listen for controlling service worker change
            let refreshing = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (!refreshing) {
                    refreshing = true;
                    window.location.reload();
                }
            });
        }
    }, []);

    return null;
}
