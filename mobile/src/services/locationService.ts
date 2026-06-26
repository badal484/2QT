import { NativeModules, Platform, PermissionsAndroid, Alert, Linking } from 'react-native';
import { ENV } from '../config/env';

const { LocationService } = NativeModules;

async function ensureBackgroundLocationPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    // Check if already granted
    const already = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION
    );
    if (already) return true;

    // Android 10 (API 29): request shows "Allow all the time" option in dialog
    // Android 11+ (API 30+): must go to Settings to select "Allow all the time"
    try {
        const result = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
            {
                title: 'Background Location Required',
                message:
                    'To share your live location with customers during delivery, ' +
                    'please set Location access to "Allow all the time".',
                buttonPositive: 'Open Settings',
                buttonNegative: 'Skip',
            }
        );

        if (result === PermissionsAndroid.RESULTS.GRANTED) return true;

        // On Android 11+ the above request shows a settings redirect — if denied, guide manually
        Alert.alert(
            'Enable Background Location',
            'Go to Settings → Apps → 2QT → Permissions → Location → "Allow all the time".\n\nThis is required so the customer can see your location while you are delivering.',
            [
                { text: 'Open Settings', onPress: () => Linking.openSettings() },
                { text: 'Skip', style: 'cancel' },
            ]
        );
        return false;
    } catch {
        return false;
    }
}

export async function startRiderLocationService(token: string) {
    if (Platform.OS !== 'android' || !LocationService) return;
    // Request background location — service still starts even if denied
    // (works in foreground, disabled only when app is fully backgrounded without permission)
    await ensureBackgroundLocationPermission();
    LocationService.start(token, ENV.API_URL);
}

export function stopRiderLocationService() {
    if (Platform.OS !== 'android' || !LocationService) return;
    LocationService.stop();
}
