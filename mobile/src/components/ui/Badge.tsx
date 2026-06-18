import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import { fontFamily } from '../../theme/typography';

type Variant = 'success' | 'warning' | 'danger' | 'neutral' | 'accent';

interface BadgeProps {
  label: string;
  variant?: Variant;
  icon?: React.ReactNode;
}

const VARIANT_COLORS: Record<Variant, { bg: string; fg: string }> = {
  success: { bg: colors.successTint, fg: colors.success },
  warning: { bg: colors.warningTint, fg: colors.warning },
  danger: { bg: colors.dangerTint, fg: colors.danger },
  neutral: { bg: colors.surfaceMuted, fg: colors.inkMuted },
  accent: { bg: colors.accentTint, fg: colors.accent },
};

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'neutral', icon }) => {
  const { bg, fg } = VARIANT_COLORS[variant];
  return (
    <View style={[styles.base, { backgroundColor: bg }]}>
      {icon}
      <Text style={[styles.label, { color: fg, marginLeft: icon ? spacing.xs : 0 }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  label: {
    fontFamily: fontFamily.extrabold,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
