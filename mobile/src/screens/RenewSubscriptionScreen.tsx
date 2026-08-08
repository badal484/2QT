import { tokens } from '../theme/tokens';
import React, { useState } from 'react';
import { PressableScale } from '../components/ui/internal/PressableScale';
import { View, Text, ScrollView, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { SkeletonScreenList, SkeletonListItem } from '../components/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { Sparkles, ArrowRight, ShieldCheck } from 'lucide-react-native';
import RazorpayCheckout from 'react-native-razorpay';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { useFeedback } from '../context/FeedbackContext';

const RenewSubscriptionScreen = ({ navigation, route }: any) => {
  const { activeSub } = route.params;
  const { user } = useSelector((state: RootState) => state.auth);
  const queryClient = useQueryClient();
  const { showDialog } = useFeedback();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(activeSub?.plan_id || null);

  const { data: plansData, isLoading } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: () => api.get('/subscriptions/plans'),
  });

  const renewMutation = useMutation({
    mutationFn: (planId: string) => api.post('/payments/subscription/purchase', { planId }),
    onSuccess: async (data) => {
        const options = {
            description: '2QT Pro Membership Renewal',
            image: 'https://2qt.app/logo.png',
            currency: 'INR',
            key: data.keyId,
            amount: data.amount,
            name: '2QT PRO',
            order_id: data.razorpayOrderId,
            prefill: {
                email: user?.email || '',
                contact: user?.phone || '',
                name: user?.name || ''
            },
            theme: { color: tokens.colors.primary }
        };

        try {
            const paymentData: any = await RazorpayCheckout.open(options);
            await api.post('/payments/verify-payment', {
                razorpay_order_id: paymentData.razorpay_order_id,
                razorpay_payment_id: paymentData.razorpay_payment_id,
                razorpay_signature: paymentData.razorpay_signature,
                type: 'subscription',
                planId: selectedPlan,
            });
            showDialog({ title: 'Success', message: 'Your membership has been renewed!', confirmText: 'Okay', type: 'success' });
            queryClient.invalidateQueries({ queryKey: ['my-subscriptions'] });
            navigation.navigate('ProfileMain');
        } catch (error: any) {
            showDialog({ title: 'Payment Failed', message: error.description || 'Transaction cancelled', confirmText: 'Okay', type: 'error' });
        }
    },
    onError: (err: any) => {
        showDialog({ title: 'Error', message: err.message || 'Failed to initiate renewal', confirmText: 'Okay', type: 'error' });
    }
  });

  if (isLoading) return (
    <View style={styles.container}>
      <ScreenHeader title="Renew Membership" />
      <SkeletonScreenList item={<SkeletonListItem />} />
    </View>
  );

  const plans = plansData?.plans || [];

  return (
    <View style={styles.container}>
      <ScreenHeader title="Renew Membership" />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeaderRow}>
            <View style={styles.sparkleIconWrapper}>
              <Sparkles size={20} color={tokens.colors.primary} />
            </View>
            <View>
              <Text style={styles.statusLabel}>Current Status</Text>
              <Text style={styles.statusTitle}>2QT Pro Active</Text>
            </View>
          </View>
          <Text style={styles.statusDesc}>
            Your current plan has {activeSub?.remaining_meals} meals left. Renewing now will add credits to your balance.
          </Text>
        </View>

        <Text style={styles.sectionLabel}>Choose Renewal Plan</Text>
        
        {plans.map((plan: any) => (
          <PressableScale 
            key={plan.id}
            onPress={() => setSelectedPlan(plan.id)}
            style={[styles.planCard, selectedPlan === plan.id ? styles.planCardActive : styles.planCardInactive]}
          >
            <View style={{ flex: 1, marginRight: 16 }}>
              <Text style={[styles.planName, selectedPlan === plan.id ? styles.planNameActive : styles.planNameInactive]}>{plan.name}</Text>
              <Text style={styles.planSubLabel}>{plan.meals} Meals • {plan.type}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.planPrice}>₹{plan.pricePaise / 100}</Text>
              {selectedPlan === plan.id && (
                <View style={styles.selectedBadge}>
                  <Text style={styles.selectedBadgeText}>Selected</Text>
                </View>
              )}
            </View>
          </PressableScale>
        ))}

        {/* Secure Note */}
        <View style={styles.secureNote}>
          <ShieldCheck size={24} color={tokens.colors.success} />
          <View style={{ marginLeft: 16, flex: 1 }}>
            <Text style={styles.secureTitle}>Secure Transaction</Text>
            <Text style={styles.secureSub}>Payments processed via Razorpay</Text>
          </View>
        </View>
        
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Action Footer */}
      <View style={styles.footer}>
        <PressableScale
          onPress={() => selectedPlan && renewMutation.mutate(selectedPlan)}
          disabled={!selectedPlan || renewMutation.isPending}
          style={[styles.payBtn, !selectedPlan ? styles.payBtnDisabled : styles.payBtnEnabled]}
        >
          <View>
            <Text style={styles.payBtnLabel}>Complete Renewal</Text>
            <Text style={styles.payBtnText}>Pay Securely</Text>
          </View>
          {renewMutation.isPending ? (
            <ActivityIndicator color={tokens.colors.textInverse} />
          ) : (
            <View style={styles.payBtnIconWrapper}>
              <ArrowRight size={24} color={tokens.colors.textInverse} />
            </View>
          )}
        </PressableScale>
      </View>
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
    paddingHorizontal: 32,
  },
  statusCard: {
    backgroundColor: tokens.colors.textPrimary,
    padding: 32,
    borderRadius: 40,
    marginBottom: 48,
    ...tokens.shadows.soft,
  },
  statusHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  sparkleIconWrapper: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  statusLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9,
    fontFamily: tokens.typography.family.black,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 2,
  },
  statusTitle: {
    color: tokens.colors.textInverse,
    fontSize: 18,
    fontFamily: tokens.typography.family.black,
  },
  statusDesc: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontFamily: tokens.typography.family.medium,
    lineHeight: 20,
  },
  sectionLabel: {
    color: tokens.colors.textTertiary,
    fontFamily: tokens.typography.family.black,
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 10,
    marginBottom: 24,
    marginLeft: 8,
  },
  planCard: {
    padding: 24,
    borderRadius: 32,
    marginBottom: 24,
    borderWidth: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planCardActive: {
    backgroundColor: tokens.colors.primaryTint,
    borderColor: tokens.colors.primary,
  },
  planCardInactive: {
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.background,
  },
  planName: {
    fontSize: 20,
    fontFamily: tokens.typography.family.black,
  },
  planNameActive: {
    color: tokens.colors.primary,
  },
  planNameInactive: {
    color: tokens.colors.textPrimary,
  },
  planSubLabel: {
    color: tokens.colors.textTertiary,
    fontSize: 10,
    fontFamily: tokens.typography.family.black,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 4,
  },
  planPrice: {
    color: tokens.colors.textPrimary,
    fontFamily: tokens.typography.family.black,
    fontSize: 24,
  },
  selectedBadge: {
    backgroundColor: tokens.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 8,
  },
  selectedBadgeText: {
    color: tokens.colors.textInverse,
    fontFamily: tokens.typography.family.black,
    fontSize: 8,
    textTransform: 'uppercase',
  },
  secureNote: {
    backgroundColor: tokens.colors.background,
    padding: 24,
    borderRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
  },
  secureTitle: {
    color: tokens.colors.textPrimary,
    fontFamily: tokens.typography.family.black,
    fontSize: 12,
  },
  secureSub: {
    color: tokens.colors.textTertiary,
    fontSize: 10,
    fontFamily: tokens.typography.family.bold,
    marginTop: 2,
  },
  footer: {
    padding: 32,
    paddingBottom: 40,
  },
  payBtn: {
    height: 80,
    borderRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    ...tokens.shadows.soft,
  },
  payBtnEnabled: {
    backgroundColor: tokens.colors.textPrimary,
  },
  payBtnDisabled: {
    backgroundColor: tokens.colors.border,
  },
  payBtnLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontFamily: tokens.typography.family.black,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  payBtnText: {
    color: tokens.colors.textInverse,
    fontSize: 20,
    fontFamily: tokens.typography.family.black,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  payBtnIconWrapper: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default RenewSubscriptionScreen;
