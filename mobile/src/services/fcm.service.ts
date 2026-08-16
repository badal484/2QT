import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { api } from '../api/client';

import messaging from '@react-native-firebase/messaging';

const DEVICE_ID_KEY = '2qt_device_id';

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
        try {
            if (Platform.OS === 'android') {
                const androidApiLevel = typeof Platform.Version === 'string' ? parseInt(Platform.Version, 10) : (Platform.Version || 0);
                if (androidApiLevel >= 33) {
                    const { PermissionsAndroid } = require('react-native');
                    const granted = await PermissionsAndroid.request(
                        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
                    );
                    console.log('[FCMService] POST_NOTIFICATIONS permission result:', granted);
                }
            }
            const authStatus = await messaging().requestPermission();
            console.log('[FCMService] messaging().requestPermission authStatus:', authStatus);
            return true;
        } catch (error) {
            console.warn('[FCMService] Permission request failed:', error);
            return true;
        }
    }

    static async registerDeviceToken(userRole?: string): Promise<string | null> {
        try {
            const hasPermission = await this.requestPermission();
            if (!hasPermission) {
                console.log('[FCMService] Push permission not granted');
                return null;
            }

            const fcmToken = await messaging().getToken();
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

            let attempts = 0;
            let success = false;
            while (attempts < 3 && !success) {
                try {
                    await api.post('/device-tokens', {
                        deviceId,
                        appType,
                        platform,
                        fcmToken,
                    });
                    success = true;
                    console.log('[FCMService] Device token registered successfully on backend:', { deviceId, appType, platform });
                } catch (err: any) {
                    attempts++;
                    console.warn(`[FCMService] Device token registration attempt ${attempts} failed:`, err?.message || err);
                    if (attempts < 3) await new Promise(r => setTimeout(r, 1500));
                }
            }

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
        return messaging().onTokenRefresh(async (newToken: string) => {
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
