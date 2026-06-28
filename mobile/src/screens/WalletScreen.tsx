import { ArrowLeft, CreditCard, Plus, History } from 'lucide-react-native';
import React from 'react';
import { BouncingButton } from '../components/ui/BouncingButton';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, Modal, TextInput } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import RazorpayCheckout from 'react-native-razorpay';
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import Animated, { FadeInDown, Layout, FadeIn } from 'react-native-reanimated';

import { getSocket } from '../socket/client';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

const WalletScreen = ({ navigation }: any) => {
  const queryClient = useQueryClient();
  const socket = getSocket();
  const [isModalVisible, setModalVisible] = React.useState(false);
  const [rechargeAmount, setRechargeAmount] = React.useState('');

  const triggerHaptic = () => ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
  const triggerHapticHeavy = () => ReactNativeHapticFeedback.trigger("impactHeavy", hapticOptions);

  const { data: wallet, isLoading } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => api.get('/customers/wallet'),
  });



  const { user } = useSelector((state: RootState) => state.auth);

  const rechargeMutation = useMutation({
    mutationFn: (amount: number) => api.post('/payment/wallet/recharge', { amountPaise: amount * 100 }),
    onSuccess: async (data, amount) => {
        if (__DEV__ && !data.keyId) {
            try {
                await api.post('/payment/mock-success', {
                    razorpayOrderId: data.razorpayOrderId,
                    type: 'wallet',
                    amountPaise: amount * 100
                });
                triggerHapticHeavy();
                Alert.alert('Success', 'Wallet recharged successfully! (Mock)');
                queryClient.invalidateQueries({ queryKey: ['wallet'] });
            } catch (error: any) {
                console.error('MOCK_PAYMENT_ERROR:', error);
                Alert.alert('Mock Payment Failed', error.message || 'Transaction cancelled');
            }
            return;
        }

        const options = {
            description: '2QT Wallet Recharge',
            image: 'https://2qt.app/logo.png',
            currency: 'INR',
            key: data.keyId,
            amount: data.amount,
            name: '2QT',
            order_id: data.razorpayOrderId,
            prefill: {
                email: user?.email || 'customer@2qt.app',
                contact: user?.phone || '9999999999',
                name: user?.name || '2QT User'
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
            triggerHapticHeavy();
            Alert.alert('Success', 'Wallet recharged successfully!');
            queryClient.invalidateQueries({ queryKey: ['wallet'] });
        } catch (error: any) {
            console.error('PAYMENT_ERROR:', error);
            
            // If in dev mode and Razorpay fails, automatically fall back to mock success
            if (__DEV__) {
                try {
                    await api.post('/payment/mock-success', {
                        razorpayOrderId: data.razorpayOrderId,
                        type: 'wallet',
                        amountPaise: amount * 100
                    });
                    triggerHapticHeavy();
                    Alert.alert('Dev Mock Success', 'Razorpay failed, but wallet recharged via Mock.');
                    queryClient.invalidateQueries({ queryKey: ['wallet'] });
                } catch (mockErr: any) {
                    Alert.alert('Payment Failed', error?.error?.description || error.description || 'Transaction cancelled');
                }
            } else {
                let msg = 'Transaction cancelled';
                try {
                  const errStr = typeof error === 'string' ? error : (error?.description || JSON.stringify(error));
                  if (errStr && errStr.includes('{')) {
                    const parsed = JSON.parse(errStr);
                    msg = parsed?.error?.description || parsed?.description || msg;
                  } else if (error?.description) {
                    msg = error.description;
                  } else if (error?.message) {
                    msg = error.message;
                  }
                } catch (e) {
                  msg = error?.description || error?.message || 'Transaction cancelled';
                }
                if (msg === 'undefined' || !msg) msg = 'Transaction cancelled';
                Alert.alert('Payment Failed', msg);
            }
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
      <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
        <BouncingButton onPress={() => { triggerHaptic(); navigation.goBack(); }} style={styles.backButton}>
          <ArrowLeft size={24} color="#fff" />
        </BouncingButton>
        
        <Text style={styles.headerLabel}>2QT Wallet</Text>
        <Text style={styles.balanceValue}>₹{wallet ? (wallet.balancePaise / 100).toFixed(2) : '0.00'}</Text>
        
        <View style={styles.actionRow}>
          <BouncingButton 
            style={styles.addMoneyBtn}
            onPress={() => { triggerHaptic(); setModalVisible(true); }}
            disabled={rechargeMutation.isPending}
          >
            {rechargeMutation.isPending ? <ActivityIndicator color="#FF6B35" /> : (
                <>
                    <Plus size={18} color="#FF6B35" style={{ marginRight: 8 }} />
                    <Text style={styles.addMoneyText}>Add Money</Text>
                </>
            )}
          </BouncingButton>
        </View>
        <View style={styles.glassDecoration} />
        <View style={styles.glassDecoration2} />
      </Animated.View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.transactionHeaderRow}>
          <History size={20} color="#1A1A2E" style={{ marginRight: 12 }} />
          <Text style={styles.transactionTitle}>Transactions</Text>
        </Animated.View>
        
        {wallet?.transactions?.length === 0 ? (
          <Animated.View entering={FadeIn.delay(300)} style={styles.emptyContainer}>
            <View style={styles.emptyIconWrapper}>
              <CreditCard size={24} color="#9CA3AF" />
            </View>
            <Text style={styles.emptyText}>No transactions yet.</Text>
          </Animated.View>
        ) : (
          wallet?.transactions?.map((tx: any, index: number) => (
            <Animated.View 
              key={tx.id} 
              entering={FadeInDown.delay(index * 50 + 200).duration(400)}
              layout={Layout.springify()}
              style={styles.txRow}
            >
              <View style={styles.txInfo}>
                <Text style={styles.txDesc}>{tx.description}</Text>
                <Text style={styles.txDate}>{new Date(tx.created_at).toLocaleDateString()}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.txAmount, { color: tx.type === 'credit' ? '#22C55E' : '#EF4444' }]}>
                  {tx.type === 'credit' ? '+' : '−'}₹{(Math.abs(tx.amountPaise) / 100).toFixed(2)}
                </Text>
                <Text style={styles.txBalanceAfter}>Balance: ₹{(tx.balanceAfterPaise / 100).toFixed(2)}</Text>
              </View>
            </Animated.View>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={isModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Money</Text>
            <Text style={styles.modalSub}>Enter amount to add (Min ₹100)</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              placeholder="500"
              value={rechargeAmount}
              onChangeText={setRechargeAmount}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <BouncingButton style={styles.modalCancelBtn} onPress={() => { triggerHaptic(); setModalVisible(false); }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </BouncingButton>
              <BouncingButton 
                style={styles.modalAddBtn} 
                onPress={() => {
                  triggerHapticHeavy();
                  const amt = parseInt(rechargeAmount || '0');
                  if (amt >= 100) {
                    setModalVisible(false);
                    rechargeMutation.mutate(amt);
                    setRechargeAmount('');
                  } else {
                    Alert.alert('Error', 'Minimum ₹100 required');
                  }
                }}
              >
                <Text style={styles.modalAddText}>Add</Text>
              </BouncingButton>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loadingContainer: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  header: { paddingTop: 80, paddingHorizontal: 32, paddingBottom: 48, backgroundColor: '#1A1A2E', borderBottomLeftRadius: 40, borderBottomRightRadius: 40, shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 8, overflow: 'hidden' },
  glassDecoration: { position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255, 107, 53, 0.15)' },
  glassDecoration2: { position: 'absolute', bottom: -20, left: -60, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255, 255, 255, 0.05)' },
  backButton: { marginBottom: 24, alignSelf: 'flex-start' },
  headerLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 4, marginBottom: 8 },
  balanceValue: { color: '#fff', fontSize: 48, fontWeight: '900', letterSpacing: -1 },
  actionRow: { flexDirection: 'row', marginTop: 40 },
  addMoneyBtn: { backgroundColor: '#fff', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 16, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4 },
  addMoneyText: { color: '#1A1A2E', fontWeight: '900', fontSize: 14, textTransform: 'uppercase' },
  scrollView: { flex: 1, paddingHorizontal: 32, paddingTop: 32 },
  transactionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  transactionTitle: { color: '#1A1A2E', fontSize: 20, fontWeight: '900' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 48 },
  emptyIconWrapper: { width: 64, height: 64, backgroundColor: '#f9fafb', borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyText: { color: '#9ca3af', fontWeight: '700', textAlign: 'center' },
  txRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#f9fafb' },
  txInfo: { flex: 1, marginRight: 16 },
  txDesc: { color: '#1A1A2E', fontWeight: '700', fontSize: 17 },
  txDate: { color: '#9ca3af', fontSize: 10, marginTop: 4, textTransform: 'uppercase', fontWeight: '900', letterSpacing: 1 },
  txAmount: { fontSize: 18, fontWeight: '900' },
  txBalanceAfter: { color: '#9ca3af', fontSize: 10, marginTop: 4, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', width: '80%', borderRadius: 24, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#1A1A2E' },
  modalSub: { fontSize: 12, color: '#9CA3AF', marginTop: 4, marginBottom: 24 },
  modalInput: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 20, padding: 16, fontSize: 24, fontWeight: '900', color: '#1A1A2E', marginBottom: 24, textAlign: 'center' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  modalCancelBtn: { flex: 1, padding: 16, alignItems: 'center', marginRight: 8, backgroundColor: '#F3F4F6', borderRadius: 20 },
  modalCancelText: { color: '#9CA3AF', fontWeight: '900' },
  modalAddBtn: { flex: 1, padding: 16, alignItems: 'center', marginLeft: 8, backgroundColor: '#FF6B35', borderRadius: 20 },
  modalAddText: { color: '#fff', fontWeight: '900' },
});

export default WalletScreen;
