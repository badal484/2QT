import { NativeModules } from 'react-native';

let notifeeInstance: any = null;
let AndroidImportanceEnum: any = { HIGH: 4, DEFAULT: 3, LOW: 2, MIN: 1, NONE: 0 };
let EventTypeEnum: any = { PRESS: 1, DISMISSED: 2, ACTION_PRESS: 3 };

try {
    // Only attempt loading Notifee if native module exists to prevent red screen error
    if (NativeModules.NotifeeApiModule || NativeModules.Notifee) {
        const notifeePkg = require('@notifee/react-native');
        notifeeInstance = notifeePkg.default || notifeePkg;
        if (notifeePkg.AndroidImportance) AndroidImportanceEnum = notifeePkg.AndroidImportance;
        if (notifeePkg.EventType) EventTypeEnum = notifeePkg.EventType;
    } else {
        console.warn('[NotifeeSafe] NativeModules.NotifeeApiModule not present on this build');
    }
} catch (e: any) {
    console.warn('[NotifeeSafe] Failed loading Notifee safely:', e?.message || e);
}

export const safeNotifee = {
    get isAvailable(): boolean {
        return !!notifeeInstance;
    },
    async displayNotification(options: any) {
        if (!notifeeInstance) return null;
        try {
            return await notifeeInstance.displayNotification(options);
        } catch (e) {
            console.warn('[NotifeeSafe] displayNotification error:', e);
            return null;
        }
    },
    async createChannel(channelConfig: any) {
        if (!notifeeInstance) return null;
        try {
            return await notifeeInstance.createChannel(channelConfig);
        } catch (e) {
            console.warn('[NotifeeSafe] createChannel error:', e);
            return null;
        }
    },
    onForegroundEvent(callback: any) {
        if (!notifeeInstance) return () => {};
        try {
            return notifeeInstance.onForegroundEvent(callback);
        } catch (e) {
            return () => {};
        }
    },
    onBackgroundEvent(callback: any) {
        if (!notifeeInstance || typeof notifeeInstance.onBackgroundEvent !== 'function') return;
        try {
            notifeeInstance.onBackgroundEvent(callback);
        } catch (e) {
            console.warn('[NotifeeSafe] onBackgroundEvent error:', e);
        }
    }
};

export const AndroidImportance = AndroidImportanceEnum;
export const EventType = EventTypeEnum;
