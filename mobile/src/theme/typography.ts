export const fontFamily = {
  regular: 'Inter-Regular',
  medium: 'Inter-Medium',
  semibold: 'Inter-SemiBold',
  bold: 'Inter-Bold',
  extrabold: 'Inter-ExtraBold',
  black: 'Inter-Black',
} as const;

export const type = {
  display: { fontFamily: fontFamily.black, fontSize: 34, lineHeight: 40, letterSpacing: -0.5 },
  h1: { fontFamily: fontFamily.extrabold, fontSize: 28, lineHeight: 34, letterSpacing: -0.3 },
  h2: { fontFamily: fontFamily.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.2 },
  h3: { fontFamily: fontFamily.bold, fontSize: 18, lineHeight: 24 },
  bodyLarge: { fontFamily: fontFamily.medium, fontSize: 16, lineHeight: 24 },
  body: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 21 },
  bodySmall: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 19 },
  caption: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 16 },
  label: {
    fontFamily: fontFamily.extrabold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
  },
} as const;
