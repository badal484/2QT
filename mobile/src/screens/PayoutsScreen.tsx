import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { ArrowLeft, Landmark, History, Clock, ArrowUpRight } from 'lucide-react-native';

const PayoutsScreen = ({ navigation }: any) => {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['rider-payouts-history'],
    queryFn: () => api.get('/riders/payouts'),
  });

  const withdrawMutation = useMutation({
    mutationFn: () => api.post('/riders/payouts/request', { amountPaise: data?.pendingAmountPaise }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rider-payouts-history'] });
      Alert.alert('Success', 'Withdrawal request submitted for approval.');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Withdrawal failed');
    }
  });

  if (isLoading) return (
    <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          activeOpacity={0.7}
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settlements</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceLabelRow}>
             <Landmark size={16} color="rgba(255,255,255,0.5)" style={{ marginRight: 8 }} />
             <Text style={styles.balanceLabelText}>Available Balance</Text>
          </View>
          <Text style={styles.balanceAmountText}>₹{data?.pendingAmountPaise / 100 || '0.00'}</Text>
          <View style={styles.nextPayoutBox}>
             <Clock size={14} color="rgba(255,255,255,0.4)" style={{ marginRight: 12 }} />
             <Text style={styles.nextPayoutText}>Next automated payout on Friday, 10:00 AM</Text>
          </View>
        </View>

        {data?.pendingAmountPaise >= 10000 && (
          <TouchableOpacity 
            activeOpacity={0.9}
            onPress={() => {
              Alert.alert('Withdraw Funds', `Request settlement of ₹${data.pendingAmountPaise / 100}?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Withdraw', onPress: () => withdrawMutation.mutate() }
              ]);
            }}
            style={styles.withdrawBtn}
          >
            <ArrowUpRight size={20} color="white" style={{ marginRight: 8 }} />
            <Text style={styles.withdrawBtnText}>Withdraw to Bank</Text>
          </TouchableOpacity>
        )}

        <View style={styles.historyHeader}>
            <History size={20} color="#1A1A2E" style={{ marginRight: 12 }} />
            <Text style={styles.historyTitle}>Settlement History</Text>
        </View>
        
        {data?.payouts?.length === 0 ? (
          <View style={styles.emptyHistory}>
             <Landmark size={48} color="#D1D5DB" />
             <Text style={styles.emptyText}>No settlements processed yet.</Text>
          </View>
        ) : (
          data?.payouts?.map((payout: any) => (
            <View key={payout.id} style={styles.payoutCard}>
              <View>
                <Text style={styles.payoutDate}>{new Date(payout.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text>
                <View style={styles.payoutStatusRow}>
                    <View style={[styles.statusDot, { backgroundColor: payout.status === 'paid' ? '#00D084' : '#F59E0B' }]} />
                    <Text style={styles.payoutStatusText}>{payout.status}</Text>
                </View>
              </View>
              <Text style={styles.payoutAmountText}>₹{payout.amount_paise / 100}</Text>
            </View>
          ))
        )}
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
  header: {
    paddingTop: 64,
    paddingHorizontal: 32,
    paddingBottom: 40,
    backgroundColor: '#f9fafb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backButton: {
    width: 48,
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  headerTitle: {
    color: '#1A1A2E',
    fontSize: 20,
    fontWeight: '900',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 32,
  },
  balanceCard: {
    backgroundColor: '#1A1A2E',
    padding: 40,
    borderRadius: 48,
    marginBottom: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 10,
  },
  balanceLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  balanceLabelText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  balanceAmountText: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -2,
  },
  nextPayoutBox: {
    marginTop: 32,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 16,
    borderRadius: 16,
  },
  nextPayoutText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    lineHeight: 16,
    flex: 1,
  },
  withdrawBtn: {
    backgroundColor: '#FF6B35',
    height: 64,
    borderRadius: 28,
    marginBottom: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  withdrawBtnText: {
    color: '#fff',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  historyTitle: {
    color: '#1A1A2E',
    fontSize: 20,
    fontWeight: '900',
  },
  emptyHistory: {
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 40,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#e5e7eb',
  },
  emptyText: {
    color: '#9ca3af',
    fontWeight: '700',
    marginTop: 16,
  },
  payoutCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    borderRadius: 32,
    padding: 28,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  payoutDate: {
    color: '#1A1A2E',
    fontWeight: '900',
    fontSize: 18,
  },
  payoutStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  payoutStatusText: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  payoutAmountText: {
    color: '#1A1A2E',
    fontWeight: '900',
    fontSize: 24,
  },
});

export default PayoutsScreen;
