export const colors = {
  primary: '#FC4603',
  primaryDark: '#D93D00',
  primaryTint: '#FFF1ED',
  
  // Premium Orange Gradient stops
  primaryGradStart: '#FF6422',
  primaryGradEnd: '#E83E00',

  accent: '#FC4603',
  accentTint: '#FFF1ED',

  // Backgrounds
  background: '#F2F2F7', // iOS Grouped Background
  surface: '#FFFFFF',
  surfaceMuted: '#E5E5EA', // Slightly darker than surface for distinction
  
  // Ink / Text
  ink: '#2C2C2E', // Distinctly softer than black, premium luxury slate
  inkMuted: '#8E8E93', // Much softer secondary text
  inkFaint: '#AEAEB2', // Tertiary text

  // Borders
  border: '#E5E5EA',
  borderStrong: '#C7C7CC',

  // Semantic
  success: '#10B981',
  successTint: '#D1FAE5',
  warning: '#F59E0B',
  warningTint: '#FEF3C7',
  danger: '#EF4444',
  dangerTint: '#FEE2E2',

  // Utilities
  overlay: 'rgba(17, 24, 39, 0.65)',
  glass: 'rgba(255, 255, 255, 0.85)',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export type ColorToken = keyof typeof colors;
