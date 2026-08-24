import NetInfo, { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { ENV } from '../config/env';

export type ConnectionQuality = 'fast' | 'moderate' | 'slow' | 'offline';

export interface NetworkHealthState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  connectionType: NetInfoStateType;
  quality: ConnectionQuality;
  isServerReachable: boolean;
  lastCheckedAt: number;
}

type NetworkListener = (state: NetworkHealthState) => void;

class NetworkManager {
  private static instance: NetworkManager;
  private listeners: Set<NetworkListener> = new Set();
  private state: NetworkHealthState = {
    isConnected: true,
    isInternetReachable: true,
    connectionType: NetInfoStateType.other,
    quality: 'fast',
    isServerReachable: true,
    lastCheckedAt: Date.now(),
  };
  private isInitialized = false;
  private healthCheckTimeout: ReturnType<typeof setTimeout> | null = null;

  private constructor() {}

  public static getInstance(): NetworkManager {
    if (!NetworkManager.instance) {
      NetworkManager.instance = new NetworkManager();
    }
    return NetworkManager.instance;
  }

  public initialize() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // 1. Wire NetInfo directly into TanStack Query onlineManager
    onlineManager.setEventListener((setOnline) => {
      return NetInfo.addEventListener((netState: NetInfoState) => {
        const isOnline = Boolean(
          netState.isConnected && netState.isInternetReachable !== false
        );
        setOnline(isOnline);
        this.updateState(netState);
      });
    });

    // 2. Fetch initial state
    NetInfo.fetch().then((netState) => {
      this.updateState(netState);
    });
  }

  private updateState(netState: NetInfoState) {
    const isConnected = Boolean(netState.isConnected);
    const isInternetReachable = netState.isInternetReachable;
    const connectionType = netState.type;

    let quality: ConnectionQuality = 'fast';
    if (!isConnected || isInternetReachable === false) {
      quality = 'offline';
    } else if (netState.details && 'cellularGeneration' in netState.details) {
      const gen = (netState.details as any).cellularGeneration;
      if (gen === '2g') quality = 'slow';
      else if (gen === '3g') quality = 'moderate';
      else quality = 'fast';
    }

    this.state = {
      ...this.state,
      isConnected,
      isInternetReachable,
      connectionType,
      quality,
      lastCheckedAt: Date.now(),
    };

    this.notifyListeners();

    // Trigger lightweight server probe if internet is reachable
    if (isConnected && isInternetReachable !== false) {
      this.scheduleServerHealthCheck();
    } else {
      this.state.isServerReachable = false;
    }
  }

  private scheduleServerHealthCheck() {
    if (this.healthCheckTimeout) clearTimeout(this.healthCheckTimeout);
    this.healthCheckTimeout = setTimeout(() => {
      this.probeServerHealth();
    }, 1000);
  }

  public async probeServerHealth(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`${ENV.API_URL}/app/version`, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'Cache-Control': 'no-cache' },
      });
      clearTimeout(id);
      const isReachable = res.ok || res.status === 401 || res.status === 403;
      this.state.isServerReachable = isReachable;
      this.notifyListeners();
      return isReachable;
    } catch {
      this.state.isServerReachable = false;
      this.notifyListeners();
      return false;
    }
  }

  public getState(): NetworkHealthState {
    return { ...this.state };
  }

  public subscribe(listener: NetworkListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    const currentState = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(currentState);
      } catch (err) {
        console.warn('[NetworkManager] Listener error:', err);
      }
    });
  }
}

export const networkManager = NetworkManager.getInstance();
