import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import { fontFamily } from '../../theme/typography';

interface StatCardProps {
  icon: React.ReactNode;
  value: string;
  label: string;
  iconBg?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ icon, value, label, iconBg = colors.primaryTint }) => (
  <View style={styles.container}>
    <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>{icon}</View>
    <Text style={styles.value}>{value}</Text>
    <Text style={styles.label}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  value: {
    fontFamily: fontFamily.black,
    fontSize: 22,
    color: colors.ink,
    marginBottom: 2,
  },
  label: {
    fontFamily: fontFamily.extrabold,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.inkMuted,
  },
});
