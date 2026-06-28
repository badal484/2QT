export const colors = {
  primary: '#1B5E46',
  primaryDark: '#123F30',
  primaryTint: '#E8F2EC',

  accent: '#1B5E46',
  accentTint: '#E8F2EC',

  background: '#FAF8F4',
  surface: '#FFFFFF',
  surfaceMuted: '#F3F0EA',

  ink: '#1A1F1C',
  inkMuted: '#6B7570',
  inkFaint: '#9CA3A0',

  border: '#E6E2DA',
  borderStrong: '#D6D1C6',

  success: '#1B5E46',
  successTint: '#E8F2EC',
  warning: '#B8853B',
  warningTint: '#F5EDE0',
  danger: '#B5453B',
  dangerTint: '#F7E8E6',

  overlay: 'rgba(26, 31, 28, 0.6)',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export type ColorToken = keyof typeof colors;
