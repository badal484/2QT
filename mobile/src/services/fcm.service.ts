import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { api } from '../api/client';

const DEVICE_ID_KEY = '2qt_device_id';

let messagingModule: any = null;
try {
    messagingModule = require('@react-native-firebase/messaging').default;
} catch {
    console.warn('[FCMService] @react-native-firebase/messaging package not loaded');
}

export class FCMService {
    static async getDeviceId(): Promise<string> {
        try {
            let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
            if (!deviceId) {
                deviceId = `dev_${Platform.OS}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
            }
            return deviceId;
        } catch {
            return `dev_${Platform.OS}_fallback_${Date.now()}`;
        }
    }

    static async requestPermission(): Promise<boolean> {
        if (!messagingModule) return false;
        try {
            const authStatus = await messagingModule().requestPermission();
            const enabled =
                authStatus === 1 || // AUTHORIZED
                authStatus === 2;   // PROVISIONAL
            return enabled;
        } catch (error) {
            console.warn('[FCMService] Permission request failed:', error);
            return false;
        }
    }

    static async registerDeviceToken(userRole?: string): Promise<string | null> {
        if (!messagingModule) return null;
        try {
            const hasPermission = await this.requestPermission();
            if (!hasPermission) {
                console.log('[FCMService] Push permission not granted');
                return null;
            }

            const fcmToken = await messagingModule().getToken();
            if (!fcmToken) {
                console.warn('[FCMService] No FCM token retrieved from Firebase');
                return null;
            }

            const deviceId = await this.getDeviceId();
            const platform = Platform.OS === 'ios' ? 'ios' : 'android';
            
            // Resolve appType from user role
            let appType: 'buyer' | 'rider' | 'kitchen' = 'buyer';
            if (userRole === 'rider' || userRole === 'rider_captain') {
                appType = 'rider';
            } else if (['chef', 'partner_kitchen', 'kitchen_manager', 'packer'].includes(userRole || '')) {
                appType = 'kitchen';
            }

            await api.post('/device-tokens', {
                deviceId,
                appType,
                platform,
                fcmToken,
            });

            console.log('[FCMService] Device token registered successfully:', { deviceId, appType, platform });
            return fcmToken;
        } catch (error: any) {
            console.error('[FCMService] Failed registering device token:', error.message || error);
            return null;
        }
    }

    static async deactivateDeviceToken(userRole?: string): Promise<void> {
        try {
            const deviceId = await this.getDeviceId();
            await api.delete('/device-tokens');
            console.log('[FCMService] Device token deactivated on backend for deviceId:', deviceId);
        } catch (error: any) {
            console.warn('[FCMService] Failed deactivating device token on logout:', error.message || error);
        }
    }

    static setupTokenRefreshListener(userRole?: string) {
        if (!messagingModule) return () => {};
        return messagingModule().onTokenRefresh(async (newToken: string) => {
            console.log('[FCMService] Token refreshed by Firebase SDK:', newToken);
            const deviceId = await this.getDeviceId();
            const platform = Platform.OS === 'ios' ? 'ios' : 'android';
            
            let appType: 'buyer' | 'rider' | 'kitchen' = 'buyer';
            if (userRole === 'rider' || userRole === 'rider_captain') {
                appType = 'rider';
            } else if (['chef', 'partner_kitchen', 'kitchen_manager', 'packer'].includes(userRole || '')) {
                appType = 'kitchen';
            }

            try {
                await api.post('/device-tokens', {
                    deviceId,
                    appType,
                    platform,
                    fcmToken: newToken,
                });
            } catch (e) {
                console.error('[FCMService] Token refresh API sync failed:', e);
            }
        });
    }
}
