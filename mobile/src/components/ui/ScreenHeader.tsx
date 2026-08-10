import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { tokens } from '../../theme/tokens';
import { PressableScale } from './internal/PressableScale';

export interface HeaderAction {
  icon: React.ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
}

interface ScreenHeaderProps {
  title?: string;
  subtitle?: string;
  /** Omit to auto-wire to navigation.goBack(); pass `false` to hide the back button entirely
   *  (e.g. a screen that shouldn't offer a way back, like one with gestureEnabled:false). */
  onBack?: (() => void) | false;
  rightActions?: HeaderAction[];
  /** 'large' = bigger title, for screens that feel like a "home" for their flow
   *  (Home, Category, OrderHistory). 'default' = compact, for pushed detail/form screens.
   *  'transparent' = no background fill, for screens with their own hero/image backdrop. */
  variant?: 'default' | 'large' | 'transparent';
  style?: StyleProp<ViewStyle>;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title, subtitle, onBack, rightActions = [], variant = 'default', style,
}) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const canGoBack = navigation.canGoBack?.() ?? false;

  const handleBack =
    onBack === false ? undefined
    : onBack ?? (canGoBack ? () => navigation.goBack() : undefined);

  return (
    <View
      style={[
        styles.root,
        { paddingTop: Math.max(insets.top, tokens.spacing.lg) },
        variant === 'transparent' && styles.transparent,
        style,
      ]}
    >
      <View style={styles.row}>
        {handleBack ? (
          <PressableScale
            onPress={handleBack}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
          >
            <ArrowLeft size={22} color={tokens.colors.textPrimary} />
          </PressableScale>
        ) : (
          <View style={styles.backBtnSpacer} />
        )}

        <View style={styles.titleWrap}>
          {title && (
            <Text
              style={variant === 'large' ? styles.titleLarge : styles.title}
              numberOfLines={1}
              allowFontScaling
              maxFontSizeMultiplier={1.4}
            >
              {title}
            </Text>
          )}
          {subtitle && (
            <Text style={styles.subtitle} numberOfLines={1} allowFontScaling maxFontSizeMultiplier={1.4}>
              {subtitle}
            </Text>
          )}
        </View>

        <View style={styles.actions}>
          {rightActions.length === 0 && <View style={styles.actionSpacer} />}
          {rightActions.map((a, i) => (
            <PressableScale
              key={i}
              onPress={a.onPress}
              style={styles.actionBtn}
              accessibilityRole="button"
              accessibilityLabel={a.accessibilityLabel}
              hitSlop={8}
            >
              {a.icon}
            </PressableScale>
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    backgroundColor: tokens.colors.background,
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.md,
  },
  transparent: { backgroundColor: 'transparent' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  // 48x48dp touch target, not just the visual icon size
  backBtn: {
    width: 48, height: 48, borderRadius: tokens.radii.full,
    alignItems: 'center', justifyContent: 'center',
  },
  backBtnSpacer: { width: 48, height: 48 },
  titleWrap: { flex: 1, alignItems: 'center' },
  title: { fontSize: tokens.typography.type.h3.fontSize, fontFamily: tokens.typography.family.bold, color: tokens.colors.textPrimary },
  titleLarge: { fontSize: tokens.typography.type.h1.fontSize, fontFamily: tokens.typography.family.extrabold, color: tokens.colors.textPrimary },
  subtitle: { fontSize: tokens.typography.type.caption.fontSize, fontFamily: tokens.typography.family.medium, color: tokens.colors.textSecondary },
  actions: { flexDirection: 'row', gap: tokens.spacing.xs },
  actionSpacer: { width: 48, height: 48 },
  actionBtn: { width: 48, height: 48, borderRadius: tokens.radii.full, alignItems: 'center', justifyContent: 'center' },
});
