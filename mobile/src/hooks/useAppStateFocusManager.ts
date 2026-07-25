import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { focusManager } from '@tanstack/react-query';

// Wires RN's foreground/background transitions into React Query's own focus
// tracking, per TanStack Query's documented RN integration. This lets
// staleTime-aware refetch-on-focus fire when the app comes back to the
// foreground, without a blanket invalidateQueries() that would re-fire
// queries already kept fresh by socket events.
export function useAppStateFocusManager() {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      focusManager.setFocused(state === 'active');
    });
    return () => subscription.remove();
  }, []);
}
