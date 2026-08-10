import React from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { tokens } from '../../theme/tokens';

/** Cycles through item name placeholders in isolation — no HomeScreen re-render */
export const AnimatedSearchPlaceholder = React.memo(({ names }: { names: string[] }) => {
  const [idx, setIdx] = React.useState(0);
  React.useEffect(() => {
    if (names.length < 2) return;
    const id = setInterval(() => setIdx(i => (i + 1) % names.length), 2500);
    return () => clearInterval(id);
  }, [names.length]);
  const textStyle = { fontSize: 13, fontFamily: tokens.typography.family.medium, color: tokens.colors.textSecondary } as const;
  if (!names.length) return <Text allowFontScaling={false} style={textStyle}>Search for food...</Text>;
  return (
    <>
      <Text allowFontScaling={false} style={textStyle}>Search{' '}</Text>
      <View style={{ flex: 1, height: '100%', justifyContent: 'center', overflow: 'hidden' }}>
        <Animated.Text allowFontScaling={false}
          key={idx}
          entering={FadeInDown.duration(350)}
          exiting={FadeOutUp.duration(350)}
          numberOfLines={1}
          ellipsizeMode="tail"
          style={textStyle}
        >
          "{names[idx]}"
        </Animated.Text>
      </View>
    </>
  );
});
