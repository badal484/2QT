import React, { useState } from 'react';
import { StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import { fontFamily } from '../../theme/typography';

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  leftAdornment?: React.ReactNode;
  rightAdornment?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
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
  ...rest
}) => {
  const [focused, setFocused] = useState(false);
  return (
    <View style={containerStyle}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.field, focused && styles.fieldFocused, error && styles.fieldError]}>
        {leftAdornment}
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={colors.inkFaint}
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
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  label: {
    fontFamily: fontFamily.extrabold,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.inkMuted,
    marginBottom: spacing.sm,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    minHeight: 56,
  },
  fieldFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  fieldError: {
    borderColor: colors.danger,
  },
  input: {
    flex: 1,
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    color: colors.ink,
    paddingVertical: spacing.md,
  },
  error: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: colors.danger,
    marginTop: spacing.xs,
  },
});
