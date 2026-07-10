export const colors = {
  primary: '#FC4603',
  primaryDark: '#D95A2D',
  primaryTint: '#FFF0E8',

  accent: '#FC4603',
  accentTint: '#FFF0E8',

  background: '#FAF8F4',
  surface: '#FFFFFF',
  surfaceMuted: '#F3F0EA',

  ink: '#1A1F1C',
  inkMuted: '#6B7570',
  inkFaint: '#9CA3A0',

  border: '#E6E2DA',
  borderStrong: '#D6D1C6',

  success: '#10B981',
  successTint: '#D1FAE5',
  warning: '#F59E0B',
  warningTint: '#FEF3C7',
  danger: '#EF4444',
  dangerTint: '#FEE2E2',

  overlay: 'rgba(26, 31, 28, 0.6)',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export type ColorToken = keyof typeof colors;
