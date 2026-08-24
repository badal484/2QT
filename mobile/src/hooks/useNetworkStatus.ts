import { useState, useEffect } from 'react';
import { networkManager, NetworkHealthState } from '../services/networkManager';

export function useNetworkStatus(): NetworkHealthState & {
  isOnline: boolean;
  isDegraded: boolean;
  canExecuteMutations: boolean;
} {
  const [status, setStatus] = useState<NetworkHealthState>(networkManager.getState());

  useEffect(() => {
    const unsubscribe = networkManager.subscribe((newStatus) => {
      setStatus(newStatus);
    });
    return unsubscribe;
  }, []);

  const isOnline = Boolean(status.isConnected && status.isInternetReachable !== false);
  const isDegraded = status.quality === 'slow' || !status.isServerReachable;
  const canExecuteMutations = isOnline && status.isServerReachable;

  return {
    ...status,
    isOnline,
    isDegraded,
    canExecuteMutations,
  };
}
