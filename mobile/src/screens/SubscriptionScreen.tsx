import { tokens } from '../theme/tokens';
import { ArrowLeft } from 'lucide-react-native';
import React from 'react';
import { PressableScale } from '../components/ui/internal/PressableScale';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
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
      <ActivityIndicator size="large" color={tokens.colors.primary} />
    </View>
  );

  const activeSub = subsData?.subscriptions?.[0];

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <PressableScale onPress={() => navigation.goBack()} style={styles.backButton}>
            <ArrowLeft size={24} color={tokens.colors.textPrimary} />
          </PressableScale>
          <Text style={styles.headerLabel}>Your Membership</Text>
          <Text style={styles.headerTitle}>EIGEN PRO</Text>
        </View>

        <View style={styles.content}>
          {activeSub ? (
            <View style={styles.activeCard}>
              <View style={styles.activeCardHeader}>
                <View>
                  <Text style={styles.cardSubLabel}>Active Plan</Text>
                  <Text style={styles.cardPlanName}>{activeSub.plan_id.replace('sub_', '').replace(/_/g, ' ').toUpperCase()}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: activeSub.is_paused ? tokens.colors.warningTint : tokens.colors.successTint }]}>
                  <Text style={[styles.statusBadgeText, { color: activeSub.is_paused ? tokens.colors.warning : tokens.colors.success }]}>
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
                <PressableScale 
                  onPress={() => activeSub.is_paused ? resumeMutation.mutate(activeSub.id) : pauseMutation.mutate(activeSub.id)}
                  style={styles.pauseResumeBtn}
                >
                  <Text style={styles.pauseResumeText}>{activeSub.is_paused ? 'RESUME' : 'PAUSE'}</Text>
                </PressableScale>
                <PressableScale 
                  onPress={() => navigation.navigate('RenewSubscription', { activeSub })}
                  style={styles.renewBtn}
                >
                  <Text style={styles.renewText}>RENEW</Text>
                </PressableScale>
              </View>
            </View>
          ) : (
            <View style={styles.upsellCard}>
              <Text style={styles.upsellTitle}>Get Unlimited Free Delivery</Text>
              <Text style={styles.upsellSub}>Subscribe to a meal plan and save over ₹2500 monthly.</Text>
              <PressableScale 
                style={styles.viewPlansBtn}
                onPress={() => navigation.navigate('RenewSubscription', { activeSub: null })}
              >
                <Text style={styles.viewPlansText}>VIEW PLANS</Text>
              </PressableScale>
            </View>
          )}
        </View>

        <View style={styles.plansSection}>
          <Text style={styles.plansTitle}>Available Plans</Text>
          {plansData?.plans?.map((plan: any) => (
            <PressableScale 
              key={plan.id}
              style={styles.planCard}
            >
              <View>
                <Text style={styles.planNameText}>{plan.name}</Text>
                <Text style={styles.planDetailsText}>{plan.meals} Meals • {plan.type}</Text>
              </View>
              <Text style={styles.planPriceText}>₹{plan.pricePaise / 100}</Text>
            </PressableScale>
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
    backgroundColor: tokens.colors.surface,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
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
    backgroundColor: tokens.colors.primary,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  backButton: {
    marginBottom: 24,
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLabel: {
    color: tokens.colors.textInverse,
    fontSize: 10,
    fontFamily: tokens.typography.family.black,
    textTransform: 'uppercase',
    letterSpacing: 4,
    marginBottom: 8,
    opacity: 0.8,
  },
  headerTitle: {
    color: tokens.colors.textInverse,
    fontSize: 40,
    fontFamily: tokens.typography.family.black,
    letterSpacing: -1,
  },
  content: {
    paddingHorizontal: 32,
    marginTop: -24,
  },
  activeCard: {
    backgroundColor: tokens.colors.surface,
    padding: 32,
    borderRadius: 32,
    ...tokens.shadows.soft,
    borderWidth: 1,
    borderColor: tokens.colors.background,
  },
  activeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  cardSubLabel: {
    color: tokens.colors.textTertiary,
    fontFamily: tokens.typography.family.bold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  cardPlanName: {
    color: tokens.colors.textPrimary,
    fontSize: 24,
    fontFamily: tokens.typography.family.black,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
  },
  statusBadgeText: {
    fontFamily: tokens.typography.family.black,
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
    color: tokens.colors.textTertiary,
    fontFamily: tokens.typography.family.bold,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  statValue: {
    color: tokens.colors.textPrimary,
    fontSize: 20,
    fontFamily: tokens.typography.family.black,
    marginTop: 4,
  },
  progressBarWrapper: {
    height: 8,
    backgroundColor: tokens.colors.background,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 32,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: tokens.colors.primary,
  },
  actionRow: {
    flexDirection: 'row',
  },
  pauseResumeBtn: {
    flex: 1,
    backgroundColor: tokens.colors.textPrimary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginRight: 8,
  },
  pauseResumeText: {
    color: tokens.colors.textInverse,
    fontFamily: tokens.typography.family.black,
    fontSize: 12,
  },
  renewBtn: {
    flex: 1,
    backgroundColor: tokens.colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginLeft: 8,
  },
  renewText: {
    color: tokens.colors.textInverse,
    fontFamily: tokens.typography.family.black,
    fontSize: 12,
  },
  upsellCard: {
    backgroundColor: tokens.colors.textPrimary,
    padding: 32,
    borderRadius: 32,
    ...tokens.shadows.soft,
  },
  upsellTitle: {
    color: tokens.colors.textInverse,
    fontSize: 24,
    fontFamily: tokens.typography.family.black,
    marginBottom: 8,
  },
  upsellSub: {
    color: 'rgba(255,255,255,0.6)',
    fontFamily: tokens.typography.family.bold,
    marginBottom: 24,
    lineHeight: 20,
  },
  viewPlansBtn: {
    backgroundColor: tokens.colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: tokens.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  viewPlansText: {
    color: tokens.colors.textInverse,
    fontFamily: tokens.typography.family.black,
    fontSize: 12,
  },
  plansSection: {
    paddingHorizontal: 32,
    paddingTop: 40,
  },
  plansTitle: {
    color: tokens.colors.textPrimary,
    fontSize: 20,
    fontFamily: tokens.typography.family.black,
    marginBottom: 24,
  },
  planCard: {
    backgroundColor: tokens.colors.background,
    padding: 24,
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: tokens.colors.background,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planNameText: {
    color: tokens.colors.textPrimary,
    fontFamily: tokens.typography.family.black,
    fontSize: 18,
  },
  planDetailsText: {
    color: tokens.colors.textTertiary,
    fontFamily: tokens.typography.family.bold,
    fontSize: 12,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  planPriceText: {
    color: tokens.colors.primary,
    fontFamily: tokens.typography.family.black,
    fontSize: 20,
  },
});

export default SubscriptionScreen;
