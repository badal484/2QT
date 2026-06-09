import { ArrowLeft } from 'lucide-react-native';
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

const SubscriptionDetailScreen = ({ route, navigation }: any) => {
  const { subscription } = route.params;
  const queryClient = useQueryClient();

  const pauseMutation = useMutation({
    mutationFn: () => api.post(`/subscriptions/${subscription.id}/pause`, {}),
    onSuccess: () => {
      Alert.alert('Success', 'Subscription paused.');
      queryClient.invalidateQueries({ queryKey: ['my-plans'] });
      navigation.goBack();
    },
  });

  const resumeMutation = useMutation({
    mutationFn: () => api.post(`/subscriptions/${subscription.id}/resume`, {}),
    onSuccess: () => {
      Alert.alert('Success', 'Subscription resumed.');
      queryClient.invalidateQueries({ queryKey: ['my-plans'] });
      navigation.goBack();
    },
  });

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
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
            <TouchableOpacity 
                style={styles.pauseBtn}
                onPress={() => pauseMutation.mutate()}
            >
                <Text style={styles.pauseBtnText}>PAUSE SUBSCRIPTION</Text>
            </TouchableOpacity>
        ) : (
            <TouchableOpacity 
                style={styles.resumeBtn}
                onPress={() => resumeMutation.mutate()}
            >
                <Text style={styles.resumeBtnText}>RESUME SUBSCRIPTION</Text>
            </TouchableOpacity>
        )}
        
        <TouchableOpacity 
            style={styles.cancelBtn}
            onPress={() => Alert.alert('Cancel Plan', 'Cancellation is only allowed if no meals have been consumed.')}
        >
            <Text style={styles.cancelBtnText}>CANCEL PLAN</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingTop: 64,
    paddingHorizontal: 32,
    paddingBottom: 40,
    backgroundColor: '#1A1A2E',
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
    color: '#fff',
    fontSize: 32,
    fontWeight: '900',
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 100,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontWeight: '900',
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
    backgroundColor: '#f9fafb',
    flex: 1,
    padding: 24,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  statValue: {
    color: '#1A1A2E',
    fontSize: 32,
    fontWeight: '900',
  },
  statLabel: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },
  infoCard: {
    backgroundColor: '#f9fafb',
    padding: 32,
    borderRadius: 32,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  infoLabel: {
    color: '#9ca3af',
    fontWeight: '700',
  },
  infoValue: {
    color: '#1A1A2E',
    fontWeight: '900',
  },
  pauseBtn: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 16,
  },
  pauseBtnText: {
    color: '#92400E',
    fontWeight: '900',
  },
  resumeBtn: {
    backgroundColor: '#DCFCE7',
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginBottom: 16,
  },
  resumeBtnText: {
    color: '#166534',
    fontWeight: '900',
  },
  cancelBtn: {
    backgroundColor: '#FEF2F2',
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  cancelBtnText: {
    color: '#B91C1C',
    fontWeight: '900',
  },
});

export default SubscriptionDetailScreen;
