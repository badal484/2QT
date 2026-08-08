import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, withTiming, runOnJS, Easing } from 'react-native-reanimated';
import { AlertCircle, CheckCircle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';

export type ToastType = 'error' | 'success';

export interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
}

class ToastManager {
  listener: ((options: ToastOptions) => void) | null = null;
  timeout: ReturnType<typeof setTimeout> | null = null;
  
  show(options: ToastOptions) {
    if (this.listener) this.listener(options);
  }
}

export const toast = new ToastManager();

export const Toast = () => {
  const [current, setCurrent] = useState<ToastOptions | null>(null);
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);
  const insets = useSafeAreaInsets();

  const hide = useCallback(() => {
    translateY.value = withTiming(-100, { duration: 250, easing: Easing.out(Easing.ease) });
    opacity.value = withTiming(0, { duration: 250 }, () => {
      runOnJS(setCurrent)(null);
    });
  }, [translateY, opacity]);

  useEffect(() => {
    toast.listener = (options) => {
      if (toast.timeout) clearTimeout(toast.timeout);
      
      setCurrent(options);
      translateY.value = withTiming(insets.top + 10, { duration: 350, easing: Easing.out(Easing.back(1.2)) });
      opacity.value = withTiming(1, { duration: 300 });
      
      const duration = options.duration || 3000;
      toast.timeout = setTimeout(() => {
        hide();
      }, duration);
    };
    return () => { toast.listener = null; };
  }, [insets.top, hide, translateY, opacity]);

  if (!current) return null;

  const Icon = current.type === 'error' ? AlertCircle : CheckCircle;
  const fill = current.type === 'error' ? tokens.colors.danger : tokens.colors.success;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }], opacity }]} pointerEvents="none">
      <View style={styles.pill}>
        <Icon size={18} color={tokens.colors.textInverse} fill={fill} />
        <Text style={styles.text} allowFontScaling maxFontSizeMultiplier={1.4}>{current.message}</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 99999,
    elevation: 99999,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    // Intentionally darker-than-surface for contrast against any backdrop — not a token value.
    backgroundColor: '#1A1A1A',
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.radii.full,
    ...tokens.shadows.medium,
  },
  text: {
    color: tokens.colors.textInverse,
    fontFamily: tokens.typography.family.bold,
    fontSize: tokens.typography.type.bodySmall.fontSize,
    marginLeft: tokens.spacing.sm,
  }
});
