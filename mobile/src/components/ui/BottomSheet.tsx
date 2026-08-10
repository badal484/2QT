import React from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, Text, KeyboardAvoidingView, Platform, StyleProp, ViewStyle } from 'react-native';
import { tokens } from '../../theme/tokens';
import { X } from 'lucide-react-native';
import { PressableScale } from './internal/PressableScale';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  children,
  contentStyle,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        style={styles.overlay} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}  />
        
        <View style={[styles.sheet, contentStyle]}>
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>

          {(title || subtitle) && (
            <View style={styles.header}>
              <View style={styles.headerTextWrap}>
                {title && <Text style={styles.title} allowFontScaling={true} maxFontSizeMultiplier={1.5}>{title}</Text>}
                {subtitle && <Text style={styles.subtitle} allowFontScaling={true} maxFontSizeMultiplier={1.5}>{subtitle}</Text>}
              </View>
              <PressableScale
                style={styles.closeBtn}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={8}
              >
                <X size={20} color={tokens.colors.textPrimary} />
              </PressableScale>
            </View>
          )}

          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: tokens.colors.overlay,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    backgroundColor: tokens.colors.surface,
    borderTopLeftRadius: tokens.radii.lg,
    borderTopRightRadius: tokens.radii.lg,
    maxHeight: '90%',
    paddingBottom: tokens.spacing.xl, // Safe area padding
  },
  handleWrap: {
    alignItems: 'center',
    paddingVertical: tokens.spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
    marginBottom: tokens.spacing.md,
  },
  headerTextWrap: {
    flex: 1,
    paddingRight: tokens.spacing.md,
  },
  title: {
    fontSize: tokens.typography.size.h3,
    fontFamily: tokens.typography.family.black,
    color: tokens.colors.textPrimary,
  },
  subtitle: {
    fontSize: tokens.typography.size.caption,
    fontFamily: tokens.typography.family.semibold,
    color: tokens.colors.textSecondary,
    marginTop: tokens.spacing.xs,
  },
  closeBtn: {
    width: 48,
    height: 48,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
