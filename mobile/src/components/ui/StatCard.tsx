import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { tokens } from '../../theme/tokens';

interface StatCardProps {
  icon: React.ReactNode;
  value: string;
  label: string;
  iconBg?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ icon, value, label, iconBg = tokens.colors.primaryTint }) => (
  <View style={styles.container}>
    <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>{icon}</View>
    <Text style={styles.value}>{value}</Text>
    <Text style={styles.label}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radii.xl,
    padding: tokens.spacing.lg,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: tokens.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing.md,
  },
  value: {
    fontFamily: tokens.typography.family.black,
    fontSize: 22,
    color: tokens.colors.textPrimary,
    marginBottom: 2,
  },
  label: {
    fontFamily: tokens.typography.family.extrabold,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: tokens.colors.textSecondary,
  },
});
