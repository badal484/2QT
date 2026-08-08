import React from 'react';
import { TouchableOpacity } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import ReactNativeHapticFeedback from "react-native-haptic-feedback";

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

const triggerHaptic = (type = 'impactLight') => ReactNativeHapticFeedback.trigger(type as any, hapticOptions);

// @deprecated — being phased out screen-by-screen in favor of
// components/ui/internal/PressableScale. Press feedback is a flat opacity dim
// (no scale/spring/bounce), matching PressableScale, so both primitives feel
// identical while the migration is in progress. `scaleDownTo` is accepted but
// unused, kept only so existing call sites passing it don't break.
export const BouncingButton = ({ onPress, style, children, disabled = false, hapticType = 'impactMedium', scaleDownTo, ...rest }: any) => {
  const opacity = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <AnimatedTouchable
      activeOpacity={1}
      disabled={disabled}
      onPressIn={() => {
        if (!disabled) {
          opacity.value = withTiming(0.6, { duration: 100 });
          if (hapticType) triggerHaptic(hapticType);
        }
      }}
      onPressOut={() => { if (!disabled) opacity.value = withTiming(1, { duration: 150 }); }}
      onPress={() => { if (!disabled && onPress) onPress(); }}
      style={[style, animatedStyle]}
      {...rest}
    >
      {children}
    </AnimatedTouchable>
  );
};
