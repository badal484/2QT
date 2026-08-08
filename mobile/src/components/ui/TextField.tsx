import React, { useState } from 'react';
import { StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { tokens } from '../../theme/tokens';

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  leftAdornment?: React.ReactNode;
  rightAdornment?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export const TextField: React.FC<TextFieldProps> = ({
  label,
  error,
  leftAdornment,
  rightAdornment,
  containerStyle,
  style,
  onFocus,
  onBlur,
  accessibilityLabel,
  ...rest
}) => {
  const [focused, setFocused] = useState(false);
  return (
    <View style={containerStyle}>
      {label && (
        <Text style={styles.label} allowFontScaling={true} maxFontSizeMultiplier={1.5}>
          {label}
        </Text>
      )}
      <View style={[styles.field, focused && styles.fieldFocused, error && styles.fieldError]}>
        {leftAdornment}
        <TextInput
          accessible={true}
          accessibilityLabel={accessibilityLabel || label || rest.placeholder || 'Text Input'}
          accessibilityState={{ disabled: rest.editable === false }}
          style={[styles.input, style]}
          placeholderTextColor={tokens.colors.textSecondary}
          allowFontScaling={true}
          maxFontSizeMultiplier={1.5}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {rightAdornment}
      </View>
      {error && (
        <Text style={styles.error} allowFontScaling={true} maxFontSizeMultiplier={1.5}>
          {error}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  label: {
    fontFamily: tokens.typography.family.extrabold,
    fontSize: tokens.typography.size.caption,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: tokens.colors.textSecondary,
    marginBottom: tokens.spacing.sm,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.background,
    borderWidth: 1.5,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radii.lg,
    paddingHorizontal: tokens.spacing.lg,
    minHeight: 52, // Accessibility: Touch target >= 44x44
  },
  fieldFocused: {
    borderColor: tokens.colors.primary,
    backgroundColor: tokens.colors.surface,
  },
  fieldError: {
    borderColor: tokens.colors.danger,
  },
  input: {
    flex: 1,
    fontFamily: tokens.typography.family.semibold,
    fontSize: tokens.typography.size.bodyLarge,
    color: tokens.colors.textPrimary,
    paddingVertical: tokens.spacing.md,
    minHeight: 44, // Accessibility: Input inner area
  },
  error: {
    fontFamily: tokens.typography.family.medium,
    fontSize: tokens.typography.size.caption,
    color: tokens.colors.danger,
    marginTop: tokens.spacing.xs,
  },
});
