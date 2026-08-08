import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { tokens } from '../../theme/tokens';
import { Button } from './Button';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  onCtaPress?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, subtitle, ctaLabel, onCtaPress }) => {
  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.container}>
      <View style={styles.iconWrap}>{icon}</View>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {ctaLabel && onCtaPress && (
        <View style={styles.cta}>
          <Button label={ctaLabel} onPress={onCtaPress} variant="primary" size="md" fullWidth={false} />
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.spacing.huge,
    paddingHorizontal: tokens.spacing.xxl,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: tokens.colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing.xl,
  },
  title: {
    fontFamily: tokens.typography.family.extrabold,
    fontSize: 18,
    color: tokens.colors.textPrimary,
    textAlign: 'center',
    marginBottom: tokens.spacing.sm,
  },
  subtitle: {
    fontFamily: tokens.typography.family.medium,
    fontSize: 14,
    color: tokens.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  cta: {
    marginTop: tokens.spacing.xl,
  },
});
