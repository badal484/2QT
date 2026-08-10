import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { tokens } from '../../theme/tokens';
import { haptics, HapticKind } from '../../utils/haptics';
import { PressableScale } from './internal/PressableScale';

interface ListItemProps {
  title: string;
  subtitle?: string;
  leftAdornment?: React.ReactNode;
  rightAdornment?: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  /** Opt-in only — use 'selection' for a genuine commit (e.g. picking a saved address),
   *  omit for pure drill-down navigation (e.g. an order-history row). */
  haptic?: HapticKind | 'none';
}

export const ListItem: React.FC<ListItemProps> = ({
  title,
  subtitle,
  leftAdornment,
  rightAdornment,
  onPress,
  style,
  disabled,
  haptic = 'none',
}) => {
  const handlePress = () => {
    if (disabled || !onPress) return;
    if (haptic !== 'none') haptics[haptic]();
    onPress();
  };

  if (!onPress) {
    return (
      <View style={[styles.container, disabled && styles.disabled, style]}>
        {leftAdornment && <View style={styles.left}>{leftAdornment}</View>}
        <View style={styles.content}>
          <Text style={styles.title} allowFontScaling={true} maxFontSizeMultiplier={1.5}>
            {title}
          </Text>
          {subtitle && (
            <Text style={styles.subtitle} allowFontScaling={true} maxFontSizeMultiplier={1.5}>
              {subtitle}
            </Text>
          )}
        </View>
        {rightAdornment && <View style={styles.right}>{rightAdornment}</View>}
      </View>
    );
  }

  return (
    <PressableScale
      style={[styles.container, disabled && styles.disabled, style]}
      onPress={handlePress}
      disabled={disabled}
      accessible={true}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      {leftAdornment && <View style={styles.left}>{leftAdornment}</View>}
      <View style={styles.content}>
        <Text style={styles.title} allowFontScaling={true} maxFontSizeMultiplier={1.5}>
          {title}
        </Text>
        {subtitle && (
          <Text style={styles.subtitle} allowFontScaling={true} maxFontSizeMultiplier={1.5}>
            {subtitle}
          </Text>
        )}
      </View>
      {rightAdornment && <View style={styles.right}>{rightAdornment}</View>}
    </PressableScale>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
    backgroundColor: tokens.colors.surface,
    minHeight: 56, // Accessibility: Touch target >= 44x44
  },
  disabled: {
    opacity: 0.5,
  },
  left: {
    marginRight: tokens.spacing.md,
  },
  right: {
    marginLeft: tokens.spacing.md,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontFamily: tokens.typography.family.semibold,
    fontSize: tokens.typography.size.bodyLarge,
    color: tokens.colors.textPrimary,
  },
  subtitle: {
    fontFamily: tokens.typography.family.regular,
    fontSize: tokens.typography.size.caption,
    color: tokens.colors.textSecondary,
    marginTop: 2,
  },
});
