import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const OPTIONS = { enableVibrateFallback: false, ignoreAndroidSystemSettings: false };

// Semantic API only — no raw impact/notification type names should leak past this file.
// Reserve these for MEANINGFUL moments (order/payment success or failure, destructive
// confirmation, save/validation feedback, a real selection commit) — not routine taps,
// navigation, or toggles.
const safeTrigger = (type: any) => {
  requestAnimationFrame(() => {
    try {
      ReactNativeHapticFeedback.trigger(type, OPTIONS);
    } catch (_) {}
  });
};

export const haptics = {
  selection: () => safeTrigger('selection'),
  success: () => safeTrigger('notificationSuccess'),
  warning: () => safeTrigger('notificationWarning'),
  error: () => safeTrigger('notificationError'),
  impact: () => safeTrigger('impactMedium'),
};

export type HapticKind = keyof typeof haptics;
