import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { BatteryOptimization } = NativeModules;
const DISMISSED_KEY = 'battery_opt_prompt_dismissed';

export async function isIgnoringBatteryOptimizations(): Promise<boolean> {
    if (Platform.OS !== 'android' || !BatteryOptimization) return true;
    try {
        return await BatteryOptimization.isIgnoringBatteryOptimizations();
    } catch {
        return true;
    }
}

export function requestIgnoreBatteryOptimizations() {
    if (Platform.OS !== 'android' || !BatteryOptimization) return;
    try {
        BatteryOptimization.requestIgnoreBatteryOptimizations();
    } catch {
        // ignore — native intent failed to launch, nothing we can recover here
    }
}

// One-time auto-prompt eligibility: only if never dismissed/actioned before AND not already exempt.
export async function shouldShowBatteryPrompt(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    const alreadyExempt = await isIgnoringBatteryOptimizations();
    if (alreadyExempt) return false;
    const dismissed = await AsyncStorage.getItem(DISMISSED_KEY).catch(() => null);
    return !dismissed;
}

export async function markBatteryPromptDismissed() {
    await AsyncStorage.setItem(DISMISSED_KEY, '1').catch(() => {});
}
