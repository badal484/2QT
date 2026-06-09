"use client";

import { useCallback } from 'react';

export function useHaptics() {
    const vibrate = useCallback((pattern: number | number[]) => {
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
            try {
                navigator.vibrate(pattern);
            } catch (e) {
                // Ignore errors on devices that don't support vibration
            }
        }
    }, []);

    const tap = useCallback(() => vibrate(10), [vibrate]);
    const heavyTap = useCallback(() => vibrate(20), [vibrate]);
    const doubleTap = useCallback(() => vibrate([10, 30, 10]), [vibrate]);
    const success = useCallback(() => vibrate([10, 50, 30, 50, 50]), [vibrate]);
    const error = useCallback(() => vibrate([50, 50, 50]), [vibrate]);

    return { tap, heavyTap, doubleTap, success, error, vibrate };
}
