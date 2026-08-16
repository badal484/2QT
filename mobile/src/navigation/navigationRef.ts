import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef<any>();

// Queue for calls that arrive before the navigator is mounted
let pendingNav: { name: string; params?: Record<string, any> } | null = null;

export function flushPendingNav() {
  if (pendingNav && navigationRef.isReady()) {
    (navigationRef as any).navigate(pendingNav.name, pendingNav.params);
    pendingNav = null;
  }
}

export function navigateTo(name: string, params?: Record<string, any>) {
  if (navigationRef.isReady()) {
    (navigationRef as any).navigate(name, params);
  } else {
    // Store and retry once the navigator calls flushPendingNav on mount
    pendingNav = { name, params };
  }
}
