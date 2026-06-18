import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { ArrowLeft, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react-native';
import RazorpayCheckout from 'react-native-razorpay';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

const RenewSubscriptionScreen = ({ navigation, route }: any) => {
  const { activeSub } = route.params;
  const { user } = useSelector((state: RootState) => state.auth);
  const queryClient = useQueryClient();
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
            theme: { color: '#FF6B35' }
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
            Alert.alert('Success', 'Your membership has been renewed!');
            queryClient.invalidateQueries({ queryKey: ['my-subscriptions'] });
            navigation.navigate('ProfileMain');
        } catch (error: any) {
            Alert.alert('Payment Failed', error.description || 'Transaction cancelled');
        }
    },
    onError: (err: any) => {
        Alert.alert('Error', err.message || 'Failed to initiate renewal');
    }
  });

  if (isLoading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FF6B35" />
    </View>
  );

  const plans = plansData?.plans || [];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Renew Membership</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeaderRow}>
            <View style={styles.sparkleIconWrapper}>
              <Sparkles size={20} color="#FF6B35" />
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
          <TouchableOpacity 
            key={plan.id}
            activeOpacity={0.9}
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
          </TouchableOpacity>
        ))}

        {/* Secure Note */}
        <View style={styles.secureNote}>
          <ShieldCheck size={24} color="#10B981" />
          <View style={{ marginLeft: 16, flex: 1 }}>
            <Text style={styles.secureTitle}>Secure Transaction</Text>
            <Text style={styles.secureSub}>Payments processed via Razorpay</Text>
          </View>
        </View>
        
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Action Footer */}
      <View style={styles.footer}>
        <TouchableOpacity 
          activeOpacity={0.9}
          onPress={() => selectedPlan && renewMutation.mutate(selectedPlan)}
          disabled={!selectedPlan || renewMutation.isPending}
          style={[styles.payBtn, !selectedPlan ? styles.payBtnDisabled : styles.payBtnEnabled]}
        >
          <View>
            <Text style={styles.payBtnLabel}>Complete Renewal</Text>
            <Text style={styles.payBtnText}>Pay Securely</Text>
          </View>
          {renewMutation.isPending ? (
            <ActivityIndicator color="white" />
          ) : (
            <View style={styles.payBtnIconWrapper}>
              <ArrowRight size={24} color="white" />
            </View>
          )}
        </TouchableOpacity>
      </View>
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
  header: {
    paddingTop: 64,
    paddingHorizontal: 32,
    paddingBottom: 32,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 48,
    height: 48,
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 24,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  headerTitle: {
    color: '#1A1A2E',
    fontSize: 24,
    fontWeight: '900',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 32,
  },
  statusCard: {
    backgroundColor: '#1A1A2E',
    padding: 32,
    borderRadius: 40,
    marginBottom: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 10,
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
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  statusLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 2,
  },
  statusTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  statusDesc: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 20,
  },
  sectionLabel: {
    color: '#9ca3af',
    fontWeight: '900',
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
    backgroundColor: '#FFF7ED',
    borderColor: '#FF6B35',
  },
  planCardInactive: {
    backgroundColor: '#fff',
    borderColor: '#f3f4f6',
  },
  planName: {
    fontSize: 20,
    fontWeight: '900',
  },
  planNameActive: {
    color: '#FF6B35',
  },
  planNameInactive: {
    color: '#1A1A2E',
  },
  planSubLabel: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 4,
  },
  planPrice: {
    color: '#1A1A2E',
    fontWeight: '900',
    fontSize: 24,
  },
  selectedBadge: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 8,
  },
  selectedBadgeText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 8,
    textTransform: 'uppercase',
  },
  secureNote: {
    backgroundColor: '#f9fafb',
    padding: 24,
    borderRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
  },
  secureTitle: {
    color: '#1A1A2E',
    fontWeight: '900',
    fontSize: 12,
  },
  secureSub: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '700',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  payBtnEnabled: {
    backgroundColor: '#1A1A2E',
  },
  payBtnDisabled: {
    backgroundColor: '#e5e7eb',
  },
  payBtnLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  payBtnText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
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
