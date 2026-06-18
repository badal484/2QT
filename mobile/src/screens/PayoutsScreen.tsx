import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StatusBar, StyleSheet, TextInput } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { ArrowLeft, Landmark, History, Clock, ArrowUpRight, ShieldCheck, AlertCircle } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PayoutsScreen = ({ navigation }: any) => {
  const queryClient = useQueryClient();
  const [upiId, setUpiId] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['rider-payouts-history'],
    queryFn: () => api.get('/riders/payouts'),
  });

  const withdrawMutation = useMutation({
    mutationFn: () => api.post('/riders/payouts/request', { amountPaise: data?.pendingAmountPaise, upiId }),
    onSuccess: () => {
      setUpiId('');
      queryClient.invalidateQueries({ queryKey: ['rider-payouts-history'] });
      Alert.alert('Request Sent', 'Your instant settlement request was submitted to the treasury desk.');
    },
    onError: (err: any) => {
      Alert.alert('Settlement Failed', err.response?.data?.message || err.message || 'Unable to request settlement.');
    }
  });

  if (isLoading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FF6B35" />
    </View>
  );

  const pendingAmount = data?.pendingAmountPaise || 0;
  const pendingRupees = (pendingAmount / 100).toFixed(2);
  const canWithdraw = pendingAmount >= 10000; // ₹100 minimum threshold

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.content} edges={['top']}>
        {/* Premium Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            activeOpacity={0.7}
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <ArrowLeft size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.terminalLabel}>ACCOUNT // SETTLEMENTS</Text>
            <Text style={styles.headerTitle}>Squad Settlements</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Balance Card */}
          <View style={styles.balanceCard}>
            <View style={styles.balanceHeader}>
              <View style={styles.balanceIconWrapper}>
                <Landmark size={20} color="#FF6B35" />
              </View>
              <View>
                <Text style={styles.balanceLabel}>AVAILABLE CLEARANCE</Text>
                <Text style={styles.balanceSubLabel}>Transferable Ledger Balance</Text>
              </View>
            </View>

            <View style={styles.amountContainer}>
              <Text style={styles.currencySymbol}>₹</Text>
              <Text style={styles.balanceAmount}>{pendingRupees}</Text>
            </View>

            <View style={styles.nextPayoutBox}>
              <Clock size={14} color="#94A3B8" style={{ marginRight: 8 }} />
              <Text style={styles.nextPayoutText}>
                AUTO-SETTLEMENT ON FRIDAYS AT 10:00 AM
              </Text>
            </View>
          </View>

          {/* Conditional Instant Withdrawal Actions */}
          {canWithdraw ? (
            <View style={styles.upiInputContainer}>
              <Text style={styles.upiLabel}>UPI ID FOR SETTLEMENT</Text>
              <TextInput 
                style={styles.upiInput}
                placeholder="e.g. rider@ybl"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={upiId}
                onChangeText={setUpiId}
                autoCapitalize="none"
              />
              <TouchableOpacity 
                activeOpacity={0.9}
                onPress={() => {
                  if (!upiId) return Alert.alert('Missing Info', 'Please enter your UPI ID');
                  Alert.alert(
                    'Confirm Instant Settlement', 
                    `Withdraw ₹${pendingRupees} immediately to ${upiId}?`, 
                    [
                      { text: 'Decline', style: 'cancel' },
                      { text: 'Authorize Payout', onPress: () => withdrawMutation.mutate() }
                    ]
                  );
                }}
                style={styles.withdrawBtnActive}
              >
                <ArrowUpRight size={18} color="white" style={{ marginRight: 8 }} />
                <Text style={styles.withdrawBtnTextActive}>Instant Bank Withdrawal</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.withdrawBtnInactive}>
              <AlertCircle size={16} color="#475569" style={{ marginRight: 8 }} />
              <Text style={styles.withdrawBtnTextInactive}>
                Withdraw Locked (Min threshold ₹100)
              </Text>
            </View>
          )}

          {/* History Header */}
          <View style={styles.historyHeaderRow}>
            <History size={16} color="#FF6B35" style={{ marginRight: 8 }} />
            <Text style={styles.historySectionTitle}>LEDGER TRANSFERS</Text>
          </View>
          
          {/* History List */}
          {data?.payouts?.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Landmark size={36} color="#475569" />
              <Text style={styles.emptyText}>No historical settlements recorded.</Text>
            </View>
          ) : (
            data?.payouts?.map((payout: any) => {
              const isPaid = payout.status === 'paid';
              return (
                <View key={payout.id} style={styles.payoutCard}>
                  <View style={styles.payoutLeft}>
                    <View style={[styles.payoutIconContainer, isPaid ? styles.iconPaid : styles.iconPending]}>
                      <ShieldCheck size={18} color={isPaid ? '#22C55E' : '#FF6B35'} />
                    </View>
                    <View style={styles.payoutDetails}>
                      <Text style={styles.payoutDate}>
                        {new Date(payout.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </Text>
                      <Text style={styles.payoutRef}>TXN-REF-{payout.id.slice(0, 8).toUpperCase()}</Text>
                    </View>
                  </View>
                  <View style={styles.payoutRight}>
                    <Text style={styles.payoutAmount}>₹{payout.net_amount_paise / 100}</Text>
                    <View style={[styles.statusBadge, isPaid ? styles.badgePaid : styles.badgePending]}>
                      <Text style={[styles.statusBadgeText, isPaid ? styles.textPaid : styles.textPending]}>
                        {payout.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0C10',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0B0C10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    backgroundColor: '#0D0E15',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  backButton: {
    width: 40,
    height: 40,
    backgroundColor: '#161726',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  terminalLabel: {
    color: '#FF6B35',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 2,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  balanceCard: {
    backgroundColor: '#161726',
    padding: 24,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 6,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  balanceIconWrapper: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(255, 107, 53, 0.08)',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.15)',
  },
  balanceLabel: {
    color: '#FF6B35',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  balanceSubLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 20,
  },
  currencySymbol: {
    color: '#94A3B8',
    fontSize: 28,
    fontWeight: '900',
    marginRight: 4,
  },
  balanceAmount: {
    color: '#FFFFFF',
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -1,
  },
  nextPayoutBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D0E15',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  nextPayoutText: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    flex: 1,
  },
  upiInputContainer: {
    backgroundColor: '#1A1A2E',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 24,
  },
  upiLabel: {
    color: '#FF6B35',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 12,
  },
  upiInput: {
    backgroundColor: '#161726',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 20,
  },
  withdrawBtnActive: {
    backgroundColor: '#FF6B35',
    height: 60,
    borderRadius: 20,
    marginBottom: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 4,
  },
  withdrawBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontSize: 13,
  },
  withdrawBtnInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.06)',
    height: 60,
    borderRadius: 20,
    marginBottom: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  withdrawBtnTextInactive: {
    color: '#475569',
    fontWeight: '800',
    fontSize: 12,
  },
  historyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  historySectionTitle: {
    color: '#FF6B35',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },
  emptyHistory: {
    paddingVertical: 64,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#161726',
    borderRadius: 24,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  emptyText: {
    color: '#64748B',
    fontWeight: '700',
    fontSize: 13,
    marginTop: 12,
  },
  payoutCard: {
    backgroundColor: '#161726',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  payoutLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  payoutIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  iconPaid: {
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
  },
  iconPending: {
    backgroundColor: 'rgba(255, 107, 53, 0.08)',
  },
  payoutDetails: {
    justifyContent: 'center',
  },
  payoutDate: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  payoutRef: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  payoutRight: {
    alignItems: 'flex-end',
  },
  payoutAmount: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: -0.5,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  badgePaid: {
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
  },
  badgePending: {
    backgroundColor: 'rgba(255, 107, 53, 0.08)',
  },
  statusBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  textPaid: {
    color: '#22C55E',
  },
  textPending: {
    color: '#FF6B35',
  },
});

export default PayoutsScreen;
