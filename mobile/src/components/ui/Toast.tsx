import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, withTiming, runOnJS, Easing } from 'react-native-reanimated';
import { AlertCircle, CheckCircle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontFamily } from '../../theme/typography';

export type ToastType = 'error' | 'success';

export interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
}

class ToastManager {
  listener: ((options: ToastOptions) => void) | null = null;
  timeout: NodeJS.Timeout | null = null;
  
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
  const fill = current.type === 'error' ? '#EF4444' : '#10B981';

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }], opacity }]} pointerEvents="none">
      <View style={styles.pill}>
        <Icon size={18} color="#FFFFFF" fill={fill} />
        <Text style={styles.text}>{current.message}</Text>
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
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  text: {
    color: '#FFFFFF',
    fontFamily: fontFamily.bold,
    fontSize: 13,
    marginLeft: 8,
  }
});
