// Deprecated — kept as a compatibility shim while screens migrate to `theme/tokens`.
// Do not add new colors here; add them to `tokens.colors` in `theme/tokens.ts` instead.
import { tokens } from './tokens';

export const colors = {
  ...tokens.colors,
  // Back-compat aliases for names this file used before the merge into tokens.ts.
  accent: tokens.colors.primary,
  accentTint: tokens.colors.primaryTint,
  ink: tokens.colors.textPrimary,
  inkMuted: tokens.colors.textSecondary,
  inkFaint: tokens.colors.textTertiary,
  white: '#FFFFFF',
  black: '#000000',
} as const;

export type ColorToken = keyof typeof colors;
