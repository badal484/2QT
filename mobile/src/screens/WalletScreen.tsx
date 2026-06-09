import { ArrowLeft, CreditCard, Plus, History } from 'lucide-react-native';
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import RazorpayCheckout from 'react-native-razorpay';

import { getSocket } from '../socket/client';

const WalletScreen = ({ navigation }: any) => {
  const queryClient = useQueryClient();
  const socket = getSocket();

  const { data: wallet, isLoading } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => api.get('/customers/wallet'),
  });

  React.useEffect(() => {
    if (socket) {
      socket.on('wallet_updated', () => {
        queryClient.invalidateQueries({ queryKey: ['wallet'] });
      });
    }
    return () => {
      if (socket) socket.off('wallet_updated');
    };
  }, [socket]);

  const rechargeMutation = useMutation({
    mutationFn: (amount: number) => api.post('/payment/wallet/recharge', { amountPaise: amount * 100 }),
    onSuccess: async (data, amount) => {
        const options = {
            description: 'Velto Wallet Recharge',
            image: 'https://velto.app/logo.png',
            currency: 'INR',
            key: data.keyId,
            amount: data.amount,
            name: 'Velto Food Palace',
            order_id: data.razorpayOrderId,
            prefill: {
                email: 'customer@example.com',
                contact: '9100000000',
                name: 'Velto User'
            },
            theme: { color: '#FF6B35' }
        };

        try {
            const success = await RazorpayCheckout.open(options);
            await api.post('/payment/verify-payment', {
                ...success,
                type: 'wallet',
                amountPaise: amount * 100
            });
            Alert.alert('Success', 'Wallet recharged successfully!');
            queryClient.invalidateQueries({ queryKey: ['wallet'] });
        } catch (error: any) {
            console.error('PAYMENT_ERROR:', error);
            Alert.alert('Payment Failed', error.description || 'Transaction cancelled');
        }
    }
  });

  if (isLoading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FF6B35" />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header Card */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        
        <Text style={styles.headerLabel}>Velto Wallet</Text>
        <Text style={styles.balanceValue}>₹{wallet?.balancePaise / 100 || '0.00'}</Text>
        
        <View style={styles.actionRow}>
          <TouchableOpacity 
            style={styles.addMoneyBtn}
            onPress={() => {
                Alert.prompt(
                    'Add Money',
                    'Enter amount to add (Min ₹100)',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Add', onPress: (val) => {
                            const amt = parseInt(val || '0');
                            if (amt >= 100) rechargeMutation.mutate(amt);
                            else Alert.alert('Error', 'Minimum ₹100 required');
                        }}
                    ],
                    'plain-text',
                    '500'
                );
            }}
            disabled={rechargeMutation.isPending}
          >
            {rechargeMutation.isPending ? <ActivityIndicator color="#FF6B35" /> : (
                <>
                    <Plus size={18} color="#FF6B35" style={{ marginRight: 8 }} />
                    <Text style={styles.addMoneyText}>Add Money</Text>
                </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.transactionHeaderRow}>
          <History size={20} color="#1A1A2E" style={{ marginRight: 12 }} />
          <Text style={styles.transactionTitle}>Transactions</Text>
        </View>
        
        {wallet?.transactions?.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrapper}>
              <CreditCard size={24} color="#9CA3AF" />
            </View>
            <Text style={styles.emptyText}>No transactions yet.</Text>
          </View>
        ) : (
          wallet?.transactions?.map((tx: any) => (
            <View key={tx.id} style={styles.txRow}>
              <View style={styles.txInfo}>
                <Text style={styles.txDesc}>{tx.description}</Text>
                <Text style={styles.txDate}>{new Date(tx.created_at).toLocaleDateString()}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.txAmount, { color: tx.type === 'credit' ? '#22C55E' : '#EF4444' }]}>
                  {tx.type === 'credit' ? '+' : '−'}₹{Math.abs(tx.amountPaise) / 100}
                </Text>
                <Text style={styles.txBalanceAfter}>Balance: ₹{tx.balanceAfterPaise / 100}</Text>
              </View>
            </View>
          ))
        )}
        <View style={{ height: 40 }} />
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
    paddingTop: 80,
    paddingHorizontal: 32,
    paddingBottom: 48,
    backgroundColor: '#FF6B35',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  backButton: {
    marginBottom: 24,
    alignSelf: 'flex-start',
  },
  headerLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 4,
    marginBottom: 8,
  },
  balanceValue: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -1,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 40,
  },
  addMoneyBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  addMoneyText: {
    color: '#FF6B35',
    fontWeight: '900',
    fontSize: 16,
    textTransform: 'uppercase',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 32,
  },
  transactionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  transactionTitle: {
    color: '#1A1A2E',
    fontSize: 20,
    fontWeight: '900',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 48,
  },
  emptyIconWrapper: {
    width: 64,
    height: 64,
    backgroundColor: '#f9fafb',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyText: {
    color: '#9ca3af',
    fontWeight: '700',
    textAlign: 'center',
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  txInfo: {
    flex: 1,
    marginRight: 16,
  },
  txDesc: {
    color: '#1A1A2E',
    fontWeight: '700',
    fontSize: 17,
  },
  txDate: {
    color: '#9ca3af',
    fontSize: 10,
    marginTop: 4,
    textTransform: 'uppercase',
    fontWeight: '900',
    letterSpacing: 1,
  },
  txAmount: {
    fontSize: 18,
    fontWeight: '900',
  },
  txBalanceAfter: {
    color: '#9ca3af',
    fontSize: 10,
    marginTop: 4,
    fontWeight: '700',
  },
});

export default WalletScreen;
