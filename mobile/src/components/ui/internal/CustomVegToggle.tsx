import React, { useEffect, useState } from 'react';
import { TouchableWithoutFeedback } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { tokens } from '../../../theme/tokens';
import { haptics } from '../../../utils/haptics';

interface CustomVegToggleProps {
  value: boolean;
  onValueChange: (val: boolean) => void;
}

export const CustomVegToggle: React.FC<CustomVegToggleProps> = ({ value, onValueChange }) => {
  // Use local state so UI updates instantly without waiting for parent
  const [localValue, setLocalValue] = useState(value);
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    setLocalValue(value);
    progress.value = withSpring(value ? 1 : 0, { damping: 15, stiffness: 200, mass: 0.5 });
  }, [value]);

  const animatedTrackStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: progress.value > 0.5 ? tokens.colors.successTint : '#E2E8F0',
      borderColor: progress.value > 0.5 ? tokens.colors.successTint : '#CBD5E1',
    };
  });

  const animatedThumbStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: progress.value * 14 }],
      backgroundColor: progress.value > 0.5 ? tokens.colors.success : tokens.colors.surface,
    };
  });

  const handlePress = () => {
    const newValue = !localValue;
    setLocalValue(newValue);
    progress.value = withSpring(newValue ? 1 : 0, { damping: 15, stiffness: 200, mass: 0.5 });
    
    // Defer the expensive parent update so animation starts instantly
    setTimeout(() => {
      onValueChange(newValue);
    }, 50);
  };

  return (
    <TouchableWithoutFeedback onPress={handlePress}>
      <Animated.View style={[{ width: 34, height: 20, borderRadius: 10, borderWidth: 1, padding: 1, justifyContent: 'center' }, animatedTrackStyle]}>
        <Animated.View style={[{ width: 16, height: 16, borderRadius: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 1 }, animatedThumbStyle]} />
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};
