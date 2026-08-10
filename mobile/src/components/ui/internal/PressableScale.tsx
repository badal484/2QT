import React from 'react';
import { Pressable, PressableProps } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableScaleProps extends PressableProps {
  /** @deprecated no longer used — press feedback is a flat opacity dim, not a scale/bounce. Kept so existing call sites passing it don't break. */
  scaleTo?: number;
  opacityTo?: number;
  children: React.ReactNode;
}

// Flat opacity-dim press-feedback primitive — no scale/spring/bounce, no haptics, no styling
// opinion. Internal only: components/ui primitives (Button, Card, ListItem, Chip, ScreenHeader)
// use this for their shared tactile feedback. Never import directly from a screen.
export const PressableScale: React.FC<PressableScaleProps> = ({
  children, style, opacityTo = 0.6, disabled, onPressIn, onPressOut, ...rest
}) => {
  const opacity = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={(e) => {
        if (!disabled) opacity.value = withTiming(opacityTo, { duration: 100 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!disabled) opacity.value = withTiming(1, { duration: 150 });
        onPressOut?.(e);
      }}
      style={[style, animatedStyle]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
};
