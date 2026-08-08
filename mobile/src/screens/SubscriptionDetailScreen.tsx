import { tokens } from '../theme/tokens';
import { ArrowLeft } from 'lucide-react-native';
import React from 'react';
import { PressableScale } from '../components/ui/internal/PressableScale';
import { View, Text, ScrollView, Alert, StyleSheet } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useFeedback } from '../context/FeedbackContext';

const SubscriptionDetailScreen = ({ route, navigation }: any) => {
  const { subscription } = route.params;
  const queryClient = useQueryClient();
  const { showDialog } = useFeedback();

  const pauseMutation = useMutation({
    mutationFn: () => api.post(`/subscriptions/${subscription.id}/pause`, {}),
    onSuccess: () => {
      showDialog({ title: 'Success', message: 'Subscription paused.', confirmText: 'Okay', type: 'success' });
      queryClient.invalidateQueries({ queryKey: ['my-plans'] });
      navigation.goBack();
    },
  });

  const resumeMutation = useMutation({
    mutationFn: () => api.post(`/subscriptions/${subscription.id}/resume`, {}),
    onSuccess: () => {
      showDialog({ title: 'Success', message: 'Subscription resumed.', confirmText: 'Okay', type: 'success' });
      queryClient.invalidateQueries({ queryKey: ['my-plans'] });
      navigation.goBack();
    },
  });

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <PressableScale onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={24} color={tokens.colors.textInverse} />
        </PressableScale>
        <Text style={styles.planName}>{subscription.plan_name}</Text>
        <View style={[styles.statusBadge, { backgroundColor: subscription.status === 'active' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(234, 179, 8, 0.2)' }]}>
          <Text style={[styles.statusText, { color: subscription.status === 'active' ? '#4ADE80' : '#FACC15' }]}>
            {subscription.status}
          </Text>
        </View>
      </View>

      <View style={styles.content}>
        {/* Stats */}
        <View style={styles.statsRow}>
            <View style={styles.statCard}>
                <Text style={styles.statValue}>{subscription.remaining_meals}</Text>
                <Text style={styles.statLabel}>Meals Left</Text>
            </View>
            <View style={styles.statCard}>
                <Text style={styles.statValue}>{subscription.current_day_credits}</Text>
                <Text style={styles.statLabel}>Daily Credits</Text>
            </View>
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
            <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Total Meals</Text>
                <Text style={styles.infoValue}>{subscription.total_meals}</Text>
            </View>
            <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Start Date</Text>
                <Text style={styles.infoValue}>{new Date(subscription.created_at).toLocaleDateString()}</Text>
            </View>
            <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Expiry Date</Text>
                <Text style={styles.infoValue}>{new Date(subscription.expires_at).toLocaleDateString()}</Text>
            </View>
        </View>

        {/* Actions */}
        {subscription.status === 'active' ? (
            <PressableScale 
                style={styles.pauseBtn}
                onPress={() => pauseMutation.mutate()}
            >
                <Text style={styles.pauseBtnText}>PAUSE SUBSCRIPTION</Text>
            </PressableScale>
        ) : (
            <PressableScale 
                style={styles.resumeBtn}
                onPress={() => resumeMutation.mutate()}
            >
                <Text style={styles.resumeBtnText}>RESUME SUBSCRIPTION</Text>
            </PressableScale>
        )}
        
        <PressableScale
            style={styles.cancelBtn}
            onPress={() => showDialog({ title: 'Cancel Plan', message: 'Cancellation is only allowed if no meals have been consumed.', confirmText: 'Okay', type: 'info' })}
        >
            <Text style={styles.cancelBtnText}>CANCEL PLAN</Text>
        </PressableScale>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
  },
  header: {
    paddingTop: 64,
    paddingHorizontal: 32,
    paddingBottom: 40,
    backgroundColor: tokens.colors.textPrimary,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  backButton: {
    marginBottom: 16,
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planName: {
    color: tokens.colors.textInverse,
    fontSize: 32,
    fontFamily: tokens.typography.family.black,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 100,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontFamily: tokens.typography.family.black,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  content: {
    padding: 32,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
    gap: 16,
  },
  statCard: {
    backgroundColor: tokens.colors.background,
    flex: 1,
    padding: 24,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.background,
  },
  statValue: {
    color: tokens.colors.textPrimary,
    fontSize: 32,
    fontFamily: tokens.typography.family.black,
  },
  statLabel: {
    color: tokens.colors.textTertiary,
    fontSize: 10,
    fontFamily: tokens.typography.family.black,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },
  infoCard: {
    backgroundColor: tokens.colors.background,
    padding: 32,
    borderRadius: 32,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: tokens.colors.background,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  infoLabel: {
    color: tokens.colors.textTertiary,
    fontFamily: tokens.typography.family.bold,
  },
  infoValue: {
    color: tokens.colors.textPrimary,
    fontFamily: tokens.typography.family.black,
  },
  pauseBtn: {
    backgroundColor: tokens.colors.warningTint,
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 16,
  },
  pauseBtnText: {
    color: tokens.colors.warning,
    fontFamily: tokens.typography.family.black,
  },
  resumeBtn: {
    backgroundColor: tokens.colors.successTint,
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginBottom: 16,
  },
  resumeBtnText: {
    color: tokens.colors.success,
    fontFamily: tokens.typography.family.black,
  },
  cancelBtn: {
    backgroundColor: tokens.colors.dangerTint,
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.dangerTint,
  },
  cancelBtnText: {
    color: tokens.colors.danger,
    fontFamily: tokens.typography.family.black,
  },
});

export default SubscriptionDetailScreen;
