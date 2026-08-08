import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { WifiOff, RefreshCw, AlertCircle } from 'lucide-react-native';
import { tokens } from '../../theme/tokens';
import { PressableScale } from './internal/PressableScale';

interface ScreenErrorProps {
  onRetry: () => void;
  message?: string;
  type?: 'network' | 'generic';
}

export const ScreenError: React.FC<ScreenErrorProps> = ({
  onRetry,
  message = 'Something went wrong',
  type = 'generic',
}) => {
  const Icon = type === 'network' ? WifiOff : AlertCircle;
  return (
    <Animated.View entering={FadeIn.duration(tokens.motion.duration.slow)} style={s.root}>
      <View style={s.iconWrap}>
        <Icon size={28} color={tokens.colors.textTertiary} strokeWidth={1.5} />
      </View>
      <Text style={s.title} allowFontScaling maxFontSizeMultiplier={1.4}>{message}</Text>
      <Text style={s.sub} allowFontScaling maxFontSizeMultiplier={1.4}>Pull to refresh or tap below</Text>
      <PressableScale style={s.btn} onPress={onRetry} accessibilityRole="button" accessibilityLabel="Try again">
        <RefreshCw size={14} color={tokens.colors.textInverse} />
        <Text style={s.btnText} allowFontScaling maxFontSizeMultiplier={1.4}>Try Again</Text>
      </PressableScale>
    </Animated.View>
  );
};

const s = StyleSheet.create({
  root: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: tokens.spacing.xxl, gap: tokens.spacing.sm,
  },
  iconWrap: {
    width: 64, height: 64, borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.background, alignItems: 'center', justifyContent: 'center',
    marginBottom: tokens.spacing.sm,
  },
  title: { fontSize: tokens.typography.type.bodyLarge.fontSize, fontFamily: tokens.typography.family.bold, color: tokens.colors.textPrimary, textAlign: 'center' },
  sub: { fontSize: tokens.typography.type.bodySmall.fontSize, fontFamily: tokens.typography.family.regular, color: tokens.colors.textTertiary, textAlign: 'center', marginBottom: tokens.spacing.sm },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm,
    backgroundColor: tokens.colors.primary, borderRadius: tokens.radii.md,
    paddingHorizontal: tokens.spacing.xl, paddingVertical: tokens.spacing.md, marginTop: tokens.spacing.xs,
    minHeight: 48,
  },
  btnText: { color: tokens.colors.textInverse, fontFamily: tokens.typography.family.bold, fontSize: tokens.typography.type.body.fontSize },
});
