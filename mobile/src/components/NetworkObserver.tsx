import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export const NetworkObserver = () => {
  const { isConnected, isInternetReachable, isServerReachable, isOnline } = useNetworkStatus();
  const [showRestored, setShowRestored] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const wasOfflineRef = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const translateY = useSharedValue(-80);
  const opacity = useSharedValue(0);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    if (!isOnline || !isServerReachable) {
      wasOfflineRef.current = true;
      setIsRendered(true);
      setShowRestored(false);

      // Spring in
      translateY.value = withSpring(0, { damping: 20, stiffness: 160 });
      opacity.value = withTiming(1, { duration: 200 });

      // Auto-hide after 4.0 seconds of idle browsing
      hideTimerRef.current = setTimeout(() => {
        translateY.value = withTiming(-80, { duration: 350 });
        opacity.value = withTiming(0, { duration: 350 }, () => {
          runOnJS(setIsRendered)(false);
        });
      }, 4000);
    } else if (wasOfflineRef.current && isOnline && isServerReachable) {
      wasOfflineRef.current = false;
      setShowRestored(true);
      setIsRendered(true);

      // Spring in with restored state
      translateY.value = withSpring(0, { damping: 20, stiffness: 160 });
      opacity.value = withTiming(1, { duration: 200 });

      // Auto-hide restored badge after 2.2 seconds
      hideTimerRef.current = setTimeout(() => {
        translateY.value = withTiming(-80, { duration: 350 });
        opacity.value = withTiming(0, { duration: 350 }, () => {
          runOnJS(setIsRendered)(false);
          runOnJS(setShowRestored)(false);
        });
      }, 2200);
    } else {
      translateY.value = withTiming(-80, { duration: 250 });
      opacity.value = withTiming(0, { duration: 250 }, () => {
        runOnJS(setIsRendered)(false);
      });
    }

    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [isOnline, isServerReachable]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!isRendered) return null;

  let dotColor = '#10B981';
  let message = 'Back online • Updated';
  let isRestored = showRestored;

  if (isRestored) {
    dotColor = '#10B981';
    message = 'Back online • Updated';
  } else if (!isConnected) {
    dotColor = '#F59E0B';
    message = 'Offline • Showing saved menu';
  } else if (isInternetReachable === false) {
    dotColor = '#F87171';
    message = 'No internet connection';
  } else if (!isServerReachable) {
    dotColor = '#38BDF8';
    message = 'Connecting to 2QT...';
  }

  const topOffset = Math.max(insets.top, Platform.OS === 'android' ? 12 : 8) + 8;

  return (
    <Animated.View
      style={[
        styles.capsuleContainer,
        { top: topOffset },
        animatedStyle,
      ]}
      pointerEvents="none"
    >
      <View style={[styles.capsule, isRestored && styles.capsuleRestored]}>
        <View style={[styles.pulseDot, { backgroundColor: dotColor }]} />
        <Text style={styles.text} numberOfLines={1}>
          {message}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  capsuleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 99999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(24, 24, 27, 0.94)',
    paddingVertical: 7,
    paddingHorizontal: 15,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  capsuleRestored: {
    backgroundColor: 'rgba(6, 78, 59, 0.95)',
    borderColor: 'rgba(52, 211, 153, 0.3)',
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 8,
  },
  text: {
    color: '#FAFAFA',
    fontWeight: '700',
    fontSize: 12.5,
    letterSpacing: 0.2,
  },
});
