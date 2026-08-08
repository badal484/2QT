import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { tokens } from '../../theme/tokens';

type Variant = 'success' | 'warning' | 'danger' | 'neutral' | 'accent';

interface BadgeProps {
  label: string;
  variant?: Variant;
  icon?: React.ReactNode;
}

const VARIANT_COLORS: Record<Variant, { bg: string; fg: string }> = {
  success: { bg: tokens.colors.successTint, fg: tokens.colors.success },
  warning: { bg: tokens.colors.warningTint, fg: tokens.colors.warning },
  danger: { bg: tokens.colors.dangerTint, fg: tokens.colors.danger },
  neutral: { bg: tokens.colors.surfaceMuted, fg: tokens.colors.textSecondary },
  accent: { bg: tokens.colors.primaryTint, fg: tokens.colors.primary },
};

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'neutral', icon }) => {
  const { bg, fg } = VARIANT_COLORS[variant];
  return (
    <View style={[styles.base, { backgroundColor: bg }]}>
      {icon}
      <Text style={[styles.label, { color: fg, marginLeft: icon ? tokens.spacing.xs : 0 }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radii.full,
  },
  label: {
    fontFamily: tokens.typography.family.extrabold,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
