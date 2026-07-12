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
  background: '#F8F9FA', // Cooler, pristine gray-white
  surface: '#FFFFFF',
  surfaceMuted: '#F1F3F5',
  
  // Ink / Text
  ink: '#111827', // Deep slate for high contrast
  inkMuted: '#4B5563', // Slate gray
  inkFaint: '#9CA3AF', // Lighter slate

  // Borders
  border: '#E5E7EB',
  borderStrong: '#D1D5DB',

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
