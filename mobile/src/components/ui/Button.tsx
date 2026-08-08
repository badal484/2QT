import React from 'react';
import { ActivityIndicator, GestureResponderEvent, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { tokens } from '../../theme/tokens';
import { haptics, HapticKind } from '../../utils/haptics';
import { PressableScale } from './internal/PressableScale';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost';
type Size = 'lg' | 'md' | 'sm';

interface ButtonProps {
  label: string;
  onPress: (e: GestureResponderEvent) => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  /** Opt-in only — reserve for meaningful moments (order/payment success or failure,
   *  destructive confirmation, save). Plain navigation/toggle buttons should omit this. */
  haptic?: HapticKind | 'none';
}

const HEIGHTS: Record<Size, number> = { lg: 56, md: 48, sm: 48 };
const FONT_SIZES: Record<Size, number> = {
  lg: tokens.typography.size.bodyLarge,
  md: tokens.typography.size.bodyLarge,
  sm: tokens.typography.size.body
};

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  disabled,
  loading,
  icon,
  iconPosition = 'left',
  style,
  fullWidth = true,
  accessibilityLabel,
  haptic = 'none',
}) => {
  const isDisabled = Boolean(disabled || loading);

  let textColor: string = tokens.colors.textPrimary;
  if (isDisabled) {
    textColor = tokens.colors.textSecondary;
  } else if (variant === 'primary') {
    textColor = tokens.colors.textInverse;
  }

  return (
    <PressableScale
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={(e: GestureResponderEvent) => {
        if (isDisabled) return;
        if (haptic !== 'none') haptics[haptic]();
        onPress(e);
      }}
      disabled={isDisabled}
      style={[
        styles.base,
        { height: HEIGHTS[size] },
        styles[variant],
        isDisabled && styles.disabled,
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.content}>
          {icon && iconPosition === 'left' && <View style={styles.iconLeft}>{icon}</View>}
          <Text
            style={[styles.label, { color: textColor, fontSize: FONT_SIZES[size] }]}
            allowFontScaling={true} // Accessibility: dynamic font scaling
            maxFontSizeMultiplier={1.5}
          >
            {label}
          </Text>
          {icon && iconPosition === 'right' && <View style={styles.iconRight}>{icon}</View>}
        </View>
      )}
    </PressableScale>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: tokens.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.xl,
    minHeight: 48, // Accessibility: true 48x48dp touch target
    minWidth: 48,
  },
  fullWidth: { width: '100%' },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  iconLeft: { marginRight: tokens.spacing.sm },
  iconRight: { marginLeft: tokens.spacing.sm },
  label: { 
    fontFamily: tokens.typography.family.black, 
    letterSpacing: 0.3 
  },
  primary: {
    backgroundColor: tokens.colors.primary,
    shadowColor: tokens.shadows.medium.shadowColor,
    shadowOpacity: tokens.shadows.medium.shadowOpacity,
    shadowRadius: tokens.shadows.medium.shadowRadius,
    shadowOffset: tokens.shadows.medium.shadowOffset,
    elevation: tokens.shadows.medium.elevation,
  },
  secondary: {
    backgroundColor: tokens.colors.background,
  },
  outline: {
    backgroundColor: tokens.colors.surface,
    borderWidth: 1.5,
    borderColor: tokens.colors.border,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    backgroundColor: tokens.colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
});
