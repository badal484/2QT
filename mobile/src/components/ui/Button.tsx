import React from 'react';
import { ActivityIndicator, GestureResponderEvent, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import { fontFamily } from '../../theme/typography';

type Variant = 'primary' | 'accent' | 'outline' | 'ghost';
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
}

const HEIGHTS: Record<Size, number> = { lg: 64, md: 52, sm: 44 };
const FONT_SIZES: Record<Size, number> = { lg: 16, md: 15, sm: 13 };

const triggerHaptic = () =>
  ReactNativeHapticFeedback.trigger('impactLight', {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  });

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
}) => {
  const [pressed, setPressed] = React.useState(false);
  const isDisabled = Boolean(disabled || loading);
  const textColor = isDisabled
    ? colors.inkFaint
    : variant === 'outline' || variant === 'ghost'
    ? colors.ink
    : colors.white;

  return (
    <Pressable
      onPress={(e: GestureResponderEvent) => {
        if (isDisabled) return;
        triggerHaptic();
        onPress(e);
      }}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={isDisabled}
      style={[
        styles.base,
        { height: HEIGHTS[size] },
        isDisabled ? styles.disabled : styles[variant],
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.content}>
          {icon && iconPosition === 'left' && <View style={styles.iconLeft}>{icon}</View>}
          <Text style={[styles.label, { color: textColor, fontSize: FONT_SIZES[size] }]}>{label}</Text>
          {icon && iconPosition === 'right' && <View style={styles.iconRight}>{icon}</View>}
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  fullWidth: { width: '100%' },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  iconLeft: { marginRight: spacing.sm },
  iconRight: { marginLeft: spacing.sm },
  label: { fontFamily: fontFamily.extrabold, letterSpacing: 0.3 },
  primary: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  accent: {
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  outline: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  ghost: {
    backgroundColor: colors.surfaceMuted,
  },
  disabled: {
    backgroundColor: colors.surfaceMuted,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
});
