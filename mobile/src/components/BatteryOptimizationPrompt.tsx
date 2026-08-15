import React from 'react';
import { View, Modal, StyleSheet, Text } from 'react-native';
import { Bell } from 'lucide-react-native';
import { tokens } from '../theme/tokens';
import { PressableScale } from './ui/internal/PressableScale';
import { requestIgnoreBatteryOptimizations, markBatteryPromptDismissed } from '../services/batteryOptimization';

interface BatteryOptimizationPromptProps {
  visible: boolean;
  onDone: () => void;
}

export const BatteryOptimizationPrompt: React.FC<BatteryOptimizationPromptProps> = ({ visible, onDone }) => {
  const handleAllow = () => {
    requestIgnoreBatteryOptimizations();
    markBatteryPromptDismissed();
    onDone();
  };

  const handleNotNow = () => {
    markBatteryPromptDismissed();
    onDone();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleNotNow}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Bell size={28} color={tokens.colors.primary} />
          </View>
          <Text style={styles.title}>Never miss an order</Text>
          <Text style={styles.body}>
            Some phones pause apps running in the background, which can delay order
            confirmations, rider updates and delivery alerts.{'\n\n'}
            Allow 2QT to keep running normally in the background so updates reach you on time.
          </Text>
          <View style={styles.actions}>
            <PressableScale style={styles.notNowBtn} onPress={handleNotNow}>
              <Text style={styles.notNowText}>Not now</Text>
            </PressableScale>
            <PressableScale style={styles.allowBtn} onPress={handleAllow}>
              <Text style={styles.allowText}>Allow</Text>
            </PressableScale>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: tokens.colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.xl,
    padding: tokens.spacing.xl,
    alignItems: 'center',
    ...tokens.shadows.strong,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing.lg,
  },
  title: {
    ...tokens.typography.type.h3,
    color: tokens.colors.textPrimary,
    marginBottom: tokens.spacing.sm,
    textAlign: 'center',
  },
  body: {
    ...tokens.typography.type.body,
    color: tokens.colors.textSecondary,
    textAlign: 'center',
    marginBottom: tokens.spacing.xl,
  },
  actions: {
    flexDirection: 'row',
    gap: tokens.spacing.md,
    width: '100%',
  },
  notNowBtn: {
    flex: 1,
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.radii.md,
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceMuted,
  },
  notNowText: {
    ...tokens.typography.type.body,
    fontFamily: tokens.typography.family.semibold,
    color: tokens.colors.textSecondary,
  },
  allowBtn: {
    flex: 1,
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.radii.md,
    alignItems: 'center',
    backgroundColor: tokens.colors.primary,
  },
  allowText: {
    ...tokens.typography.type.body,
    fontFamily: tokens.typography.family.semibold,
    color: tokens.colors.textInverse,
  },
});
