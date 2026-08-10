export const tokens = {
  colors: {
    primary: '#FC4603',
    primaryDark: '#D93D00',
    primaryTint: '#FFF1ED',
    primaryGradStart: '#FF6422',
    primaryGradEnd: '#E83E00',

    surface: '#FFFFFF',
    surfaceMuted: '#E5E5EA',
    background: '#F9FAFB', // Brighter off-white, warmer and better for food photography

    textPrimary: '#2C2C2E',
    textSecondary: '#8E8E93', // warmer iOS gray, harmonizes with the primary orange
    textTertiary: '#AEAEB2',
    textInverse: '#FFFFFF',

    border: '#E5E5EA',
    borderStrong: '#C7C7CC',

    success: '#10B981',
    successTint: '#D1FAE5',
    warning: '#F59E0B',
    warningTint: '#FEF3C7',
    danger: '#EF4444',
    dangerTint: '#FEE2E2',
    error: '#EF4444', // alias for danger — some call sites reach for "error" specifically
    white: '#FFFFFF', // alias for textInverse — plain white, not semantically text-specific

    overlay: 'rgba(17, 24, 39, 0.65)',
    glass: 'rgba(255, 255, 255, 0.85)',
  },

  typography: {
    family: {
      regular: 'Inter-Regular',
      medium: 'Inter-Medium',
      semibold: 'Inter-SemiBold',
      bold: 'Inter-Bold',
      extrabold: 'Inter-ExtraBold',
      black: 'Inter-Black',
    },
    // Full scale — canonical source for typography. Prefer this over `size` below.
    type: {
      display:   { fontFamily: 'Inter-Black',     fontSize: 34, lineHeight: 40, letterSpacing: -0.5 },
      h1:        { fontFamily: 'Inter-ExtraBold', fontSize: 28, lineHeight: 34, letterSpacing: -0.3 },
      h2:        { fontFamily: 'Inter-Bold',      fontSize: 22, lineHeight: 28, letterSpacing: -0.2 },
      h3:        { fontFamily: 'Inter-Bold',      fontSize: 18, lineHeight: 24 },
      bodyLarge: { fontFamily: 'Inter-Medium',    fontSize: 16, lineHeight: 24 },
      body:      { fontFamily: 'Inter-Medium',    fontSize: 14, lineHeight: 21 },
      bodySmall: { fontFamily: 'Inter-Regular',   fontSize: 13, lineHeight: 19 },
      caption:   { fontFamily: 'Inter-Medium',    fontSize: 12, lineHeight: 16 },
      label:     { fontFamily: 'Inter-ExtraBold', fontSize: 11, lineHeight: 14, letterSpacing: 1.5, textTransform: 'uppercase' as const },
    },
    // Deprecated flat-size alias, kept for existing `tokens.typography.size.X` call sites.
    // Remove once every screen reads from `type` directly (tracked for the final cleanup batch).
    size: { h1: 28, h2: 22, h3: 18, bodyLarge: 16, body: 14, caption: 12, button: 15 },
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    xxxl: 40,
    huge: 48,
    massive: 64,
  },

  radii: {
    sm: 8,      // Small tags, badges
    md: 12,     // Standard buttons, inputs
    lg: 16,     // Cards, bottom sheets
    xl: 24,     // Large sheets, hero cards
    xxl: 32,
    full: 9999, // Avatars, pills
  },

  shadows: {
    soft: {
      shadowColor: '#111827',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    medium: {
      shadowColor: '#111827',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
    strong: {
      shadowColor: '#111827',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
      elevation: 8,
    },
    // Deprecated aliases for existing `tokens.shadows.sm/md/lg` call sites — same values as
    // soft/medium/strong above. Remove once every call site reads the new names directly
    // (tracked for the final cleanup batch).
    sm: {
      shadowColor: '#111827',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: '#111827',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
    lg: {
      shadowColor: '#111827',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
      elevation: 8,
    },
  },

  motion: {
    duration: {
      fast: 150,
      normal: 250,
      slow: 300,
    },
  },
} as const;

export type ThemeTokens = typeof tokens;
