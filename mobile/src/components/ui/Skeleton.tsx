import React, { useEffect } from 'react';
import { DimensionValue, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/spacing';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const Skeleton: React.FC<SkeletonProps> = ({ width = '100%', height = 16, borderRadius = radius.sm, style }) => {
  const opacity = useSharedValue(0.35);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.7, { duration: 800 }), -1, true);
  }, [opacity]);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[{ width, height, borderRadius, backgroundColor: colors.surfaceMuted }, animStyle, style]} />;
};

interface SkeletonRowProps {
  imageSize?: number;
}

export const SkeletonRow: React.FC<SkeletonRowProps> = ({ imageSize = 100 }) => (
  <View style={styles.row}>
    <Skeleton width={imageSize} height={imageSize} borderRadius={radius.lg} />
    <View style={styles.col}>
      <Skeleton width="70%" height={16} style={styles.gapSm} />
      <Skeleton width="40%" height={13} style={styles.gapMd} />
      <Skeleton width="90%" height={10} style={styles.gapXs} />
      <Skeleton width="60%" height={10} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingVertical: 12 },
  col: { flex: 1, marginLeft: 16, justifyContent: 'center' },
  gapSm: { marginBottom: 8 },
  gapMd: { marginBottom: 12 },
  gapXs: { marginBottom: 4 },
});
