import React from 'react';
import { StyleSheet, View } from 'react-native';
import { tokens } from '../../theme/tokens';

interface ProgressBarProps {
  value: number;
  color?: string;
  trackColor?: string;
  height?: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  color = tokens.colors.primary,
  trackColor = tokens.colors.surfaceMuted,
  height = 8,
}) => {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <View style={[styles.track, { backgroundColor: trackColor, height, borderRadius: height / 2 }]}>
      <View style={[styles.fill, { width: `${clamped}%`, backgroundColor: color, borderRadius: height / 2 }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
  fill: { height: '100%' },
});
