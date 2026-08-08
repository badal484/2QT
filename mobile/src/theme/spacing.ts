// Deprecated — kept as a compatibility shim while screens migrate to `theme/tokens`.
// Do not edit spacing/radius values here; edit `tokens.spacing`/`tokens.radii` in
// `theme/tokens.ts` instead. Note: `radius` now resolves to the crisper token scale
// (8/12/16 base) rather than this file's old rounder 12/16/20 — intentional, part of
// the design-system consolidation.
import { tokens } from './tokens';

export const spacing = tokens.spacing;
export const radius = tokens.radii;
