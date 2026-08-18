import React, { useEffect, useState } from 'react';
import { TouchableWithoutFeedback } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { tokens } from '../../../theme/tokens';
import { haptics } from '../../../utils/haptics';

interface CustomVegToggleProps {
  value: boolean;
  onValueChange: (val: boolean) => void;
}

export const CustomVegToggle: React.FC<CustomVegToggleProps> = ({ value, onValueChange }) => {
  const [localValue, setLocalValue] = useState(value);
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    if (value !== localValue) {
      setLocalValue(value);
      progress.value = withTiming(value ? 1 : 0, { duration: 120 });
    }
  }, [value]);

  const animatedTrackStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: progress.value > 0.5 ? tokens.colors.successTint : tokens.colors.primaryTint,
      borderColor: progress.value > 0.5 ? '#A7F3D0' : '#FFD8CC',
    };
  });

  const animatedThumbStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: progress.value * 14 }],
      backgroundColor: progress.value > 0.5 ? tokens.colors.success : tokens.colors.primary,
    };
  });

  const handlePress = () => {
    haptics.selection();
    const newValue = !localValue;
    setLocalValue(newValue);
    progress.value = withTiming(newValue ? 1 : 0, { duration: 120 });
    onValueChange(newValue);
  };

  return (
    <TouchableWithoutFeedback onPress={handlePress}>
      <Animated.View style={[{ width: 34, height: 20, borderRadius: 10, borderWidth: 1, padding: 1, justifyContent: 'center' }, animatedTrackStyle]}>
        <Animated.View style={[{ width: 16, height: 16, borderRadius: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 1 }, animatedThumbStyle]} />
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};
