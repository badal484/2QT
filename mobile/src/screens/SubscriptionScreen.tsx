import { ArrowLeft } from 'lucide-react-native';
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

const SubscriptionScreen = ({ navigation }: any) => {
  const queryClient = useQueryClient();
  
  const { data: subsData, isLoading: loadingSubs } = useQuery({
    queryKey: ['my-subscriptions'],
    queryFn: () => api.get('/subscriptions/me'),
  });

  const { data: plansData, isLoading: loadingPlans } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: () => api.get('/subscriptions/plans'),
  });

  const pauseMutation = useMutation({
    mutationFn: (subId: string) => api.post(`/subscriptions/${subId}/pause`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-subscriptions'] }),
  });

  const resumeMutation = useMutation({
    mutationFn: (subId: string) => api.post(`/subscriptions/${subId}/resume`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-subscriptions'] }),
  });

  if (loadingSubs || loadingPlans) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FF6B35" />
    </View>
  );

  const activeSub = subsData?.subscriptions?.[0];

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <ArrowLeft size={24} color="#1A1A2E" />
          </TouchableOpacity>
          <Text style={styles.headerLabel}>Your Membership</Text>
          <Text style={styles.headerTitle}>VELTO PRO</Text>
        </View>

        <View style={styles.content}>
          {activeSub ? (
            <View style={styles.activeCard}>
              <View style={styles.activeCardHeader}>
                <View>
                  <Text style={styles.cardSubLabel}>Active Plan</Text>
                  <Text style={styles.cardPlanName}>{activeSub.plan_id.replace('sub_', '').toUpperCase()}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: activeSub.is_paused ? '#FFFBEB' : '#F0FDF4' }]}>
                  <Text style={[styles.statusBadgeText, { color: activeSub.is_paused ? '#D97706' : '#166534' }]}>
                    {activeSub.is_paused ? 'PAUSED' : 'ACTIVE'}
                  </Text>
                </View>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Daily Credits</Text>
                  <Text style={styles.statValue}>{activeSub.current_day_credits}/1</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Remaining</Text>
                  <Text style={styles.statValue}>{activeSub.remaining_meals} Meals</Text>
                </View>
              </View>

              <View style={styles.progressBarWrapper}>
                <View 
                  style={[styles.progressBarFill, { width: `${(activeSub.remaining_meals / activeSub.total_meals) * 100}%` }]} 
                />
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity 
                  onPress={() => activeSub.is_paused ? resumeMutation.mutate(activeSub.id) : pauseMutation.mutate(activeSub.id)}
                  style={styles.pauseResumeBtn}
                >
                  <Text style={styles.pauseResumeText}>{activeSub.is_paused ? 'RESUME' : 'PAUSE'}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => navigation.navigate('RenewSubscription', { activeSub })}
                  style={styles.renewBtn}
                >
                  <Text style={styles.renewText}>RENEW</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.upsellCard}>
              <Text style={styles.upsellTitle}>Get Unlimited Free Delivery</Text>
              <Text style={styles.upsellSub}>Subscribe to a meal plan and save over ₹2500 monthly.</Text>
              <TouchableOpacity 
                style={styles.viewPlansBtn}
                onPress={() => navigation.navigate('RenewSubscription', { activeSub: null })}
              >
                <Text style={styles.viewPlansText}>VIEW PLANS</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.plansSection}>
          <Text style={styles.plansTitle}>Available Plans</Text>
          {plansData?.plans?.map((plan: any) => (
            <TouchableOpacity 
              key={plan.id}
              activeOpacity={0.8}
              style={styles.planCard}
            >
              <View>
                <Text style={styles.planNameText}>{plan.name}</Text>
                <Text style={styles.planDetailsText}>{plan.meals} Meals • {plan.type}</Text>
              </View>
              <Text style={styles.planPriceText}>₹{plan.pricePaise / 100}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingTop: 64,
    paddingHorizontal: 32,
    paddingBottom: 40,
    backgroundColor: '#FF6B35',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  backButton: {
    marginBottom: 24,
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLabel: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 4,
    marginBottom: 8,
    opacity: 0.8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -1,
  },
  content: {
    paddingHorizontal: 32,
    marginTop: -24,
  },
  activeCard: {
    backgroundColor: '#fff',
    padding: 32,
    borderRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  activeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  cardSubLabel: {
    color: '#9ca3af',
    fontWeight: '700',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  cardPlanName: {
    color: '#1A1A2E',
    fontSize: 24,
    fontWeight: '900',
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
  },
  statusBadgeText: {
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 1,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 32,
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    color: '#9ca3af',
    fontWeight: '700',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  statValue: {
    color: '#1A1A2E',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 4,
  },
  progressBarWrapper: {
    height: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 32,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FF6B35',
  },
  actionRow: {
    flexDirection: 'row',
  },
  pauseResumeBtn: {
    flex: 1,
    backgroundColor: '#1A1A2E',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginRight: 8,
  },
  pauseResumeText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
  },
  renewBtn: {
    flex: 1,
    backgroundColor: '#FF6B35',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginLeft: 8,
  },
  renewText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
  },
  upsellCard: {
    backgroundColor: '#1A1A2E',
    padding: 32,
    borderRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  upsellTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 8,
  },
  upsellSub: {
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '700',
    marginBottom: 24,
    lineHeight: 20,
  },
  viewPlansBtn: {
    backgroundColor: '#FF6B35',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  viewPlansText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
  },
  plansSection: {
    paddingHorizontal: 32,
    paddingTop: 40,
  },
  plansTitle: {
    color: '#1A1A2E',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 24,
  },
  planCard: {
    backgroundColor: '#f9fafb',
    padding: 24,
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planNameText: {
    color: '#1A1A2E',
    fontWeight: '900',
    fontSize: 18,
  },
  planDetailsText: {
    color: '#9ca3af',
    fontWeight: '700',
    fontSize: 12,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  planPriceText: {
    color: '#FF6B35',
    fontWeight: '900',
    fontSize: 20,
  },
});

export default SubscriptionScreen;
