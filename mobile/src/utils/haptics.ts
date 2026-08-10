import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const OPTIONS = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };

// Semantic API only — no raw impact/notification type names should leak past this file.
// Reserve these for MEANINGFUL moments (order/payment success or failure, destructive
// confirmation, save/validation feedback, a real selection commit) — not routine taps,
// navigation, or toggles.
export const haptics = {
  selection: () => ReactNativeHapticFeedback.trigger('selection', OPTIONS),
  success: () => ReactNativeHapticFeedback.trigger('notificationSuccess', OPTIONS),
  warning: () => ReactNativeHapticFeedback.trigger('notificationWarning', OPTIONS),
  error: () => ReactNativeHapticFeedback.trigger('notificationError', OPTIONS),
  impact: () => ReactNativeHapticFeedback.trigger('impactMedium', OPTIONS),
};

export type HapticKind = keyof typeof haptics;
