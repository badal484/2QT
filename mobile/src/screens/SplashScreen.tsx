import React, { useEffect } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';

const SplashScreen = () => {
  const { height } = useWindowDimensions();
  const logoScale = useSharedValue(0.85);
  const logoOpacity = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);
  const subtitleTranslateY = useSharedValue(15);
  
  useEffect(() => {
    // Cinematic, slow fade and slight scale up for premium feel
    logoScale.value = withTiming(1, { duration: 1200, easing: Easing.out(Easing.cubic) });
    logoOpacity.value = withTiming(1, { duration: 1200, easing: Easing.out(Easing.cubic) });

    // Subtitle subtle reveal
    subtitleOpacity.value = withDelay(600, withTiming(1, { duration: 1000 }));
    subtitleTranslateY.value = withDelay(600, withTiming(0, { duration: 1000, easing: Easing.out(Easing.cubic) }));
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
    transform: [{ translateY: subtitleTranslateY.value }],
  }));

  return (
    <View style={styles.container}>
      {/* Gentle center glow */}
      <View style={styles.centerGlow} />

      {/* Dust particles could go here if using images, but omitted for code simplicity */}

      {/* Main Logo */}
      <Animated.View style={[styles.logoContainer, logoStyle]}>
        <View style={styles.logoRow}>
          <Text style={styles.logoText}>2QT</Text>
          <View style={styles.accentDot} />
        </View>
      </Animated.View>

      {/* Subtitle */}
      <Animated.View style={[styles.subtitleContainer, subtitleStyle, { bottom: height * 0.15 }]}>
        <Text style={styles.subtitle}>Crafted Better.</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A', // Deep matte black
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerGlow: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#FFFFFF',
    opacity: 0.03, // Ultra-soft ambient light
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.1,
    shadowRadius: 100,
    elevation: 0,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  logoText: {
    fontFamily: fontFamily.black, // Still using black but styling it minimally
    fontSize: 72,
    color: '#FFFFFF',
    letterSpacing: -2,
    includeFontPadding: false,
  },
  accentDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primary, // Orange accent
    marginLeft: 6,
    marginBottom: 10,
  },
  subtitleContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  subtitle: {
    fontFamily: fontFamily.regular, // Thinner weight
    fontSize: 14,
    color: '#FFFFFF',
    letterSpacing: 6, // Generous letter spacing
    textTransform: 'uppercase',
    opacity: 0.6, // Minimalist subtle look
  },
});

export default SplashScreen;

