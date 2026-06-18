import React, { useEffect } from 'react';
import { StyleSheet, Text, View, Dimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
} from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';

const { width } = Dimensions.get('window');

const SplashScreen = () => {
  const dotOpacity = useSharedValue(0);
  const loadingScale = useSharedValue(0.8);
  const loadingOpacity = useSharedValue(0.5);

  useEffect(() => {
    // Fade in the orange dot
    dotOpacity.value = withDelay(300, withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) }));
    
    // Pulse the loading indicator below
    loadingScale.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.8, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    loadingOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: dotOpacity.value,
  }));

  const loadingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: loadingScale.value }],
    opacity: loadingOpacity.value,
  }));

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Text style={styles.wordmark}>2QT</Text>
        <Animated.Text style={[styles.dot, dotStyle]}>.</Animated.Text>
      </View>
      <Animated.View style={[styles.loadingPill, loadingStyle]} />
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
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  wordmark: {
    fontFamily: fontFamily.black,
    fontSize: 56,
    color: colors.ink,
    letterSpacing: -2,
    includeFontPadding: false,
  },
  dot: {
    fontFamily: fontFamily.black,
    fontSize: 56,
    color: colors.primary,
    includeFontPadding: false,
  },
  loadingPill: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginTop: 32,
  },
});

export default SplashScreen;
