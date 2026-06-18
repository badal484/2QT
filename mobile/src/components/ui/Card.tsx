import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';

type Variant = 'standard' | 'header' | 'dark' | 'tint';

interface CardProps {
  children: React.ReactNode;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, variant = 'standard', style, padded = true }) => {
  return <View style={[styles.base, styles[variant], padded && styles.padded, style]}>{children}</View>;
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.xl,
  },
  padded: {
    padding: spacing.xl,
  },
  standard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.ink,
    shadowOpacity: 0.04,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  header: {
    backgroundColor: colors.primary,
  },
  dark: {
    backgroundColor: colors.ink,
  },
  tint: {
    backgroundColor: colors.primaryTint,
  },
});
