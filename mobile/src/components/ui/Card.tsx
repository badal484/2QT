import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { tokens } from '../../theme/tokens';
import { PressableScale } from './internal/PressableScale';

type Variant = 'standard' | 'header' | 'dark' | 'tint';

interface CardProps {
  children: React.ReactNode;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  /** When provided, the card becomes an interactive PressableScale target instead of
   *  a plain View — use for cards that today are hand-wrapped in TouchableOpacity. */
  onPress?: () => void;
  disabled?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, variant = 'standard', style, padded = true, onPress, disabled }) => {
  const composedStyle = [styles.base, styles[variant], padded && styles.padded, style];
  if (onPress) {
    return (
      <PressableScale
        style={composedStyle}
        onPress={onPress}
        disabled={disabled}
        accessible={true}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
      >
        {children}
      </PressableScale>
    );
  }
  return <View style={composedStyle}>{children}</View>;
};

const styles = StyleSheet.create({
  base: {
    borderRadius: tokens.radii.lg,
  },
  padded: {
    padding: tokens.spacing.lg,
  },
  standard: {
    backgroundColor: tokens.colors.surface,
    borderWidth: 1.5,
    borderColor: tokens.colors.border,
    shadowColor: tokens.shadows.sm.shadowColor,
    shadowOffset: tokens.shadows.sm.shadowOffset,
    shadowOpacity: tokens.shadows.sm.shadowOpacity,
    shadowRadius: tokens.shadows.sm.shadowRadius,
    elevation: tokens.shadows.sm.elevation,
  },
  header: {
    backgroundColor: tokens.colors.primary,
  },
  dark: {
    backgroundColor: tokens.colors.textPrimary,
  },
  tint: {
    backgroundColor: tokens.colors.background,
  },
});
