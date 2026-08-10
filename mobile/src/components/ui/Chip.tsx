import React from 'react';
import { Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { tokens } from '../../theme/tokens';
import { haptics, HapticKind } from '../../utils/haptics';
import { PressableScale } from './internal/PressableScale';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** A state toggle is a defensible "meaningful" haptic moment — defaults to 'selection'.
   *  Pass 'none' to suppress if this chip is used somewhere that shouldn't buzz. */
  haptic?: HapticKind | 'none';
  accessibilityLabel?: string;
}

// Interactive, selectable pill — category filters, Search/Category filter rows.
// Distinct from Badge, which stays a static, non-interactive status indicator.
export const Chip: React.FC<ChipProps> = ({
  label, selected = false, onPress, icon, disabled, style, haptic = 'selection', accessibilityLabel,
}) => {
  return (
    <PressableScale
      onPress={() => {
        if (disabled) return;
        if (haptic !== 'none') haptics[haptic]();
        onPress();
      }}
      disabled={disabled}
      style={[styles.base, selected && styles.selected, disabled && styles.disabled, style]}
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ selected, disabled }}
    >
      {icon}
      <Text
        style={[styles.label, selected && styles.labelSelected]}
        allowFontScaling
        maxFontSizeMultiplier={1.4}
      >
        {label}
      </Text>
    </PressableScale>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.lg,
    minHeight: 48,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.background,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  selected: {
    backgroundColor: tokens.colors.primary,
    borderColor: tokens.colors.primary,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: tokens.typography.type.bodySmall.fontSize,
    fontFamily: tokens.typography.family.semibold,
    color: tokens.colors.textPrimary,
  },
  labelSelected: {
    color: tokens.colors.textInverse,
  },
});
