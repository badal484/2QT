import React, { useEffect } from 'react';
import { StyleSheet, Text, View, Dimensions, Platform } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withDelay,
  withSpring,
  withSequence,
  withRepeat,
} from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import { ChefHat, Bike, ShoppingBag } from 'lucide-react-native';

const SplashScreen = () => {
  const { width, height } = useWindowDimensions();
  const logoScale = useSharedValue(0.3);
  const logoOpacity = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);
  const subtitleTranslateY = useSharedValue(20);
  
  const ring1Scale = useSharedValue(0.5);
  const ring1Opacity = useSharedValue(0);

  const ring2Scale = useSharedValue(0.5);
  const ring2Opacity = useSharedValue(0);

  useEffect(() => {
    // Elegant spring scale for logo
    logoScale.value = withSpring(1, { damping: 12, stiffness: 90 });
    logoOpacity.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) });

    // Subtitle fade and slide up
    subtitleOpacity.value = withDelay(400, withTiming(1, { duration: 800 }));
    subtitleTranslateY.value = withDelay(400, withTiming(0, { duration: 800, easing: Easing.out(Easing.cubic) }));

    // Continuous subtle pulsing rings
    ring1Scale.value = withRepeat(withTiming(2.5, { duration: 2500, easing: Easing.out(Easing.ease) }), -1, false);
    ring1Opacity.value = withRepeat(
      withSequence(
        withTiming(0.4, { duration: 0 }),
        withTiming(0, { duration: 2500, easing: Easing.out(Easing.ease) })
      ),
      -1,
      false
    );

    setTimeout(() => {
      ring2Scale.value = withRepeat(withTiming(2.5, { duration: 2500, easing: Easing.out(Easing.ease) }), -1, false);
      ring2Opacity.value = withRepeat(
        withSequence(
          withTiming(0.4, { duration: 0 }),
          withTiming(0, { duration: 2500, easing: Easing.out(Easing.ease) })
        ),
        -1,
        false
      );
    }, 1250);
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
    transform: [{ translateY: subtitleTranslateY.value }],
  }));

  const ring1Style = useAnimatedStyle(() => ({
    opacity: ring1Opacity.value,
    transform: [{ scale: ring1Scale.value }],
  }));

  const ring2Style = useAnimatedStyle(() => ({
    opacity: ring2Opacity.value,
    transform: [{ scale: ring2Scale.value }],
  }));

  return (
    <View style={styles.container}>
      {/* Background Decor Circles */}
      <View style={styles.bgDecorTop} />
      <View style={styles.bgDecorBottom} />

      {/* Pulsing Rings */}
      <Animated.View style={[styles.ring, ring1Style]} />
      <Animated.View style={[styles.ring, ring2Style]} />

      {/* Main Logo */}
      <Animated.View style={[styles.logoContainer, logoStyle]}>
        <View style={styles.iconRow}>
          <ChefHat size={30} color="#FFFFFF" opacity={0.9} />
          <ShoppingBag size={30} color="#FFFFFF" opacity={0.9} />
          <Bike size={30} color="#FFFFFF" opacity={0.9} />
        </View>
        <Text style={styles.logoText}>2QT</Text>
      </Animated.View>

      {/* Subtitle */}
      <Animated.View style={[styles.subtitleContainer, subtitleStyle, { bottom: height * 0.12 }]}>
        <Text style={styles.subtitle}>Premium Culinary Experience</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  bgDecorTop: {
    position: 'absolute',
    top: -150,
    right: -100,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  bgDecorBottom: {
    position: 'absolute',
    bottom: -150,
    left: -100,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  ring: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: -4,
  },
  logoText: {
    fontFamily: fontFamily.black,
    fontSize: 100,
    color: '#FFFFFF',
    letterSpacing: -8,
    includeFontPadding: false,
    textShadowColor: 'rgba(0, 0, 0, 0.15)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 12,
  },
  subtitleContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  subtitle: {
    fontFamily: fontFamily.bold,
    fontSize: 13,
    color: '#FFFFFF',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    opacity: 0.9,
  },
});

export default SplashScreen;
