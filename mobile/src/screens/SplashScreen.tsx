import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, Dimensions, Platform } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withDelay,
  withSequence,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { fontFamily } from '../theme/typography';

const { width, height } = Dimensions.get('window');

const PARTICLES_COUNT = 20;

const SplashScreen = () => {
  // Shared values for the high-end animations
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.95);
  const sweepProgress = useSharedValue(0);
  const particlesOpacity = useSharedValue(0);

  useEffect(() => {
    // 1. Logo elegant fade in and scale
    logoOpacity.value = withTiming(1, { duration: 1200, easing: Easing.out(Easing.cubic) });
    logoScale.value = withTiming(1, { duration: 1800, easing: Easing.out(Easing.cubic) });

    // 2. Vibrant green accent light sweep across the logo
    sweepProgress.value = withDelay(
      300,
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) })
    );

    // 3. Soft ambient particles fade in quickly, then gently dissolve
    particlesOpacity.value = withSequence(
      withTiming(0.6, { duration: 600, easing: Easing.out(Easing.ease) }),
      withDelay(400, withTiming(0, { duration: 1000, easing: Easing.in(Easing.ease) }))
    );
  }, []);

  // --- Animated Styles ---
  const logoContainerStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          sweepProgress.value,
          [0, 1],
          [-width * 0.8, width * 0.8],
          Extrapolation.CLAMP
        ),
      },
    ],
    opacity: interpolate(
      sweepProgress.value,
      [0, 0.2, 0.8, 1],
      [0, 0.8, 0.8, 0], // fades out at edges
      Extrapolation.CLAMP
    ),
  }));

  const particlesStyle = useAnimatedStyle(() => ({
    opacity: particlesOpacity.value,
  }));

  // Generate random stable particles
  const particles = useMemo(() => {
    return Array.from({ length: PARTICLES_COUNT }).map((_, i) => ({
      id: i,
      size: Math.random() * 4 + 1,
      x: Math.random() * width,
      y: Math.random() * height * 0.4 + height * 0.3, // concentrated around the center
      opacity: Math.random() * 0.5 + 0.2,
    }));
  }, []);

  return (
    <View style={styles.container}>
      {/* Soft ambient particles */}
      <Animated.View style={[StyleSheet.absoluteFill, particlesStyle]}>
        {particles.map((p) => (
          <View
            key={p.id}
            style={{
              position: 'absolute',
              left: p.x,
              top: p.y,
              width: p.size,
              height: p.size,
              borderRadius: p.size / 2,
              backgroundColor: '#00C853',
              opacity: p.opacity,
            }}
          />
        ))}
      </Animated.View>

      {/* Main Brand Centered */}
      <Animated.View style={[styles.logoContainer, logoContainerStyle]}>
        {/* Subtle light sweep under the text */}
        <Animated.View style={[styles.sweepContainer, sweepStyle]}>
          <LinearGradient
            colors={['rgba(0, 200, 83, 0)', 'rgba(0, 200, 83, 0.6)', 'rgba(0, 200, 83, 0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Text style={styles.logoText}>2QT</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontFamily: fontFamily.black,
    fontSize: 82,
    color: '#FFFFFF',
    letterSpacing: -5,
    includeFontPadding: false,
    ...Platform.select({
      ios: {
        shadowColor: '#00C853',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
        textShadowColor: 'rgba(0, 200, 83, 0.2)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 20,
      },
    }),
  },
  sweepContainer: {
    position: 'absolute',
    width: width * 0.6,
    height: 180,
    zIndex: -1,
    transform: [{ rotate: '20deg' }],
  },
});

export default SplashScreen;
