import React, { useEffect } from 'react';
import { StyleSheet, Text, View, Dimensions, Platform } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';

const { width, height } = Dimensions.get('window');

const SplashScreen = () => {
  // Shared values for high-end micro-animations
  const logoOpacity = useSharedValue(0);
  const logoTranslateY = useSharedValue(30);
  const dotOpacity = useSharedValue(0);
  const dotScale = useSharedValue(0);
  const loadingProgress = useSharedValue(0);
  const backgroundGlowOpacity = useSharedValue(0);

  useEffect(() => {
    // 1. Background subtle glow fades in
    backgroundGlowOpacity.value = withTiming(1, { duration: 1500, easing: Easing.out(Easing.ease) });

    // 2. Elegant spring entrance for the main logo text
    logoOpacity.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) });
    logoTranslateY.value = withSpring(0, {
      damping: 12,
      stiffness: 90,
      mass: 1,
    });

    // 3. The signature green dot pops in
    dotOpacity.value = withDelay(400, withTiming(1, { duration: 400 }));
    dotScale.value = withDelay(
      400,
      withSpring(1, { damping: 8, stiffness: 150 })
    );

    // 4. Premium infinite loading sweep at the bottom
    loadingProgress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800, easing: Easing.bezier(0.4, 0.0, 0.2, 1) }),
        withTiming(0, { duration: 1800, easing: Easing.bezier(0.4, 0.0, 0.2, 1) })
      ),
      -1,
      true
    );
  }, []);

  // --- Animated Styles ---
  const glowStyle = useAnimatedStyle(() => ({
    opacity: backgroundGlowOpacity.value,
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ translateY: logoTranslateY.value }],
  }));

  const dotStyle = useAnimatedStyle(() => ({
    opacity: dotOpacity.value,
    transform: [{ scale: dotScale.value }],
  }));

  const loadingStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          loadingProgress.value,
          [0, 1],
          [-width * 0.4, width * 0.4],
          Extrapolation.CLAMP
        ),
      },
      {
        scaleX: interpolate(
          loadingProgress.value,
          [0, 0.5, 1],
          [0.1, 1, 0.1],
          Extrapolation.CLAMP
        ),
      },
    ],
    opacity: interpolate(
      loadingProgress.value,
      [0, 0.5, 1],
      [0.2, 1, 0.2],
      Extrapolation.CLAMP
    ),
  }));

  return (
    <View style={styles.container}>
      {/* Ultra subtle gradient background for depth */}
      <Animated.View style={[StyleSheet.absoluteFill, glowStyle]}>
        <LinearGradient
          colors={['#FFFFFF', '#FFFFFF', '#F0FDF4']}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>

      {/* Main Brand Centered */}
      <Animated.View style={[styles.brandContainer, logoStyle]}>
        <Text style={styles.logoText}>2QT</Text>
        <Animated.View style={[styles.dotContainer, dotStyle]}>
          <View style={styles.dot} />
          {/* Subtle glow behind the dot */}
          <View style={styles.dotGlow} />
        </Animated.View>
      </Animated.View>

      {/* Bottom Loading Indicator */}
      <View style={styles.loadingTrack}>
        <Animated.View style={[styles.loadingThumb, loadingStyle]} />
      </View>
      <Text style={styles.subText}>Premium Delivery</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    // Slight offset to perfectly optical center since the dot adds width
    transform: [{ translateX: -8 }],
  },
  logoText: {
    fontFamily: fontFamily.black,
    fontSize: 72,
    color: '#0F172A', // Deep slate for high contrast and premium feel
    letterSpacing: -4,
    includeFontPadding: false,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  dotContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#22C55E', // Primary premium green
    zIndex: 2,
  },
  dotGlow: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4ADE80',
    opacity: 0.4,
    zIndex: 1,
  },
  loadingTrack: {
    position: 'absolute',
    bottom: height * 0.12,
    width: width * 0.4,
    height: 3,
    backgroundColor: 'transparent',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingThumb: {
    width: '100%',
    height: '100%',
    backgroundColor: '#22C55E',
    borderRadius: 2,
  },
  subText: {
    position: 'absolute',
    bottom: height * 0.12 - 28,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});

export default SplashScreen;
