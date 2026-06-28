import React from 'react';
import { TouchableOpacity } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import ReactNativeHapticFeedback from "react-native-haptic-feedback";

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

const triggerHaptic = (type = 'impactLight') => ReactNativeHapticFeedback.trigger(type as any, hapticOptions);

export const BouncingButton = ({ onPress, style, children, disabled = false, hapticType = 'impactMedium', scaleDownTo = 0.95, ...rest }: any) => {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedTouchable
      activeOpacity={1}
      disabled={disabled}
      onPressIn={() => {
        if (!disabled) {
          scale.value = withSpring(scaleDownTo, { damping: 10, stiffness: 400 });
          if (hapticType) triggerHaptic(hapticType);
        }
      }}
      onPressOut={() => { if (!disabled) scale.value = withSpring(1, { damping: 10, stiffness: 400 }); }}
      onPress={() => { if (!disabled && onPress) onPress(); }}
      style={[style, animatedStyle]}
      {...rest}
    >
      {children}
    </AnimatedTouchable>
  );
};
