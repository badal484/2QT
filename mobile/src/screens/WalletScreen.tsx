import { tokens } from '../theme/tokens';
import { ArrowLeft, CreditCard, Plus, History } from 'lucide-react-native';
import React from 'react';
import { PressableScale } from '../components/ui/internal/PressableScale';
import { View, Text, ActivityIndicator, StyleSheet, Modal, TextInput } from 'react-native';
import { SkeletonScreenList, SkeletonListItem } from '../components/ui';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import RazorpayCheckout from 'react-native-razorpay';
import { haptics } from '../utils/haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { useFeedback } from '../context/FeedbackContext';

const WalletScreen = ({ navigation }: any) => {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [isModalVisible, setModalVisible] = React.useState(false);
  const [rechargeAmount, setRechargeAmount] = React.useState('');
  const { showDialog } = useFeedback();

  const { data: walletData, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['wallet'],
    queryFn: ({ pageParam = 0 }) => api.get(`/customers/wallet?offset=${pageParam}&limit=50`),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const fetched = lastPage.transactions || [];
      if (fetched.length < 50) return undefined;
      return allPages.length * 50;
    },
  });

  const wallet = walletData?.pages[0];
  const transactions = walletData ? walletData.pages.flatMap((p: any) => p.transactions || []) : [];

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
                haptics.success();
                showDialog({ title: 'Success', message: 'Wallet recharged successfully! (Mock)', confirmText: 'Okay', type: 'success' });
                queryClient.invalidateQueries({ queryKey: ['wallet'] });
            } catch (error: any) {
                console.error('MOCK_PAYMENT_ERROR:', error);
                showDialog({ title: 'Mock Payment Failed', message: error.message || 'Transaction cancelled', confirmText: 'Okay', type: 'error' });
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
            theme: { color: tokens.colors.primary }
        };

        try {
            const success = await RazorpayCheckout.open(options);
            await api.post('/payment/verify-payment', {
                ...success,
                type: 'wallet',
                amountPaise: amount * 100
            });
            haptics.success();
            showDialog({ title: 'Success', message: 'Wallet recharged successfully!', confirmText: 'Okay', type: 'success' });
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
                    haptics.success();
                    showDialog({ title: 'Dev Mock Success', message: 'Razorpay failed, but wallet recharged via Mock.', confirmText: 'Okay', type: 'success' });
                    queryClient.invalidateQueries({ queryKey: ['wallet'] });
                } catch (mockErr: any) {
                    showDialog({ title: 'Payment Failed', message: error?.error?.description || error.description || 'Transaction cancelled', confirmText: 'Okay', type: 'error' });
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
                showDialog({ title: 'Payment Failed', message: msg, confirmText: 'Okay', type: 'error' });
            }
        }
    }
  });
  return (
    <View style={styles.container}>
      {/* Header Card */}
      <Animated.View entering={FadeInDown.duration(500)} style={[styles.header, { paddingTop: Math.max(insets.top + 16, 48) }]}>
        <PressableScale onPress={() => { haptics.selection(); navigation.goBack(); }} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <ArrowLeft size={24} color={tokens.colors.textInverse} />
        </PressableScale>
        
        <Text allowFontScaling={false} style={styles.headerLabel}>2QT Wallet</Text>
        <Text allowFontScaling={false} style={styles.balanceValue}>₹{wallet ? (wallet.balancePaise / 100).toFixed(2) : '0.00'}</Text>
        
        <View style={styles.actionRow}>
          <PressableScale 
            style={styles.addMoneyBtn}
            onPress={() => { haptics.selection(); setModalVisible(true); }}
            disabled={rechargeMutation.isPending}
            accessibilityRole="button"
            accessibilityLabel="Add money to wallet"
          >
            {rechargeMutation.isPending ? <ActivityIndicator color={tokens.colors.primary} /> : (
                <>
                    <Plus size={18} color={tokens.colors.primary} style={{ marginRight: 8 }} />
                    <Text allowFontScaling={false} style={styles.addMoneyText}>Add Money</Text>
                </>
            )}
          </PressableScale>
        </View>
        <View style={styles.glassDecoration} />
        <View style={styles.glassDecoration2} />
      </Animated.View>

      {isLoading ? (
        <View style={{ flex: 1, padding: 20 }}>
          <SkeletonScreenList item={<SkeletonListItem />} />
        </View>
      ) : (
        <Animated.FlatList
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          data={transactions}
          keyExtractor={(tx: any) => tx.id}
          initialNumToRender={8}
          windowSize={5}
          removeClippedSubviews={true}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={
            <View style={styles.transactionHeaderRow}>
              <History size={20} color={tokens.colors.textPrimary} style={{ marginRight: 12 }} />
              <Text allowFontScaling={false} style={styles.transactionTitle}>Transactions</Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconWrapper}>
                <CreditCard size={24} color={tokens.colors.textTertiary} />
              </View>
              <Text allowFontScaling={false} style={styles.emptyText}>No transactions yet.</Text>
            </View>
          }
          renderItem={({ item: tx, index }: any) => (
            <Animated.View
              entering={FadeInDown.delay(Math.min(index * 50 + 200, 1000)).duration(400)}
              style={styles.txRow}
            >
              <View style={styles.txInfo}>
                <Text allowFontScaling={false} style={styles.txDesc}>{tx.description}</Text>
                <Text allowFontScaling={false} style={styles.txDate}>{new Date(tx.created_at).toLocaleDateString()}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text allowFontScaling={false} style={[styles.txAmount, { color: tx.type === 'credit' ? tokens.colors.success : tokens.colors.danger }]}>
                  {tx.type === 'credit' ? '+' : '−'}₹{(Math.abs(tx.amountPaise) / 100).toFixed(2)}
                </Text>
                <Text allowFontScaling={false} style={styles.txBalanceAfter}>Balance: ₹{(tx.balanceAfterPaise / 100).toFixed(2)}</Text>
              </View>
            </Animated.View>
          )}
          ListFooterComponent={<View style={{ height: 40 }} />}
        />
      )}

      <Modal visible={isModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text allowFontScaling={false} style={styles.modalTitle}>Add Money</Text>
            <Text allowFontScaling={false} style={styles.modalSub}>Enter amount to add (Min ₹100)</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              placeholder="500"
              value={rechargeAmount}
              onChangeText={setRechargeAmount}
              autoFocus
              accessibilityLabel="Amount to recharge"
            />
            <View style={styles.modalButtons}>
              <PressableScale style={styles.modalCancelBtn} onPress={() => { haptics.selection(); setModalVisible(false); }} accessibilityRole="button" accessibilityLabel="Cancel">
                <Text allowFontScaling={false} style={styles.modalCancelText}>Cancel</Text>
              </PressableScale>
              <PressableScale 
                style={styles.modalAddBtn} 
                accessibilityRole="button"
                accessibilityLabel="Add money"
                onPress={() => {
                  haptics.success();
                  const amt = parseInt(rechargeAmount || '0');
                  if (amt >= 100) {
                    setModalVisible(false);
                    rechargeMutation.mutate(amt);
                    setRechargeAmount('');
                  } else {
                    showDialog({ title: 'Error', message: 'Minimum ₹100 required', confirmText: 'Okay', type: 'error' });
                  }
                }}
              >
                <Text allowFontScaling={false} style={styles.modalAddText}>Add</Text>
              </PressableScale>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.surface },
  loadingContainer: { flex: 1, backgroundColor: tokens.colors.surface, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: tokens.spacing.xxxl, paddingBottom: 48, backgroundColor: tokens.colors.textPrimary, borderBottomLeftRadius: 40, borderBottomRightRadius: 40, ...tokens.shadows.soft, overflow: 'hidden' },
  glassDecoration: { position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(252, 70, 3, 0.15)' },
  glassDecoration2: { position: 'absolute', bottom: -20, left: -60, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255, 255, 255, 0.05)' },
  backButton: { marginBottom: tokens.spacing.xl, alignSelf: 'flex-start' },
  headerLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontFamily: tokens.typography.family.black, textTransform: 'uppercase', letterSpacing: 4, marginBottom: 8 },
  balanceValue: { color: tokens.colors.textInverse, fontSize: 48, fontFamily: tokens.typography.family.black, letterSpacing: -1 },
  actionRow: { flexDirection: 'row', marginTop: 40 },
  addMoneyBtn: { backgroundColor: tokens.colors.surface, paddingHorizontal: tokens.spacing.xxxl, paddingVertical: tokens.spacing.md, borderRadius: tokens.radii.xl, flexDirection: 'row', alignItems: 'center', ...tokens.shadows.soft, },
  addMoneyText: { color: tokens.colors.textPrimary, fontFamily: tokens.typography.family.black, fontSize: 14, textTransform: 'uppercase' },
  scrollView: { flex: 1, paddingHorizontal: tokens.spacing.xxxl, paddingTop: tokens.spacing.xxxl },
  transactionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: tokens.spacing.xl },
  transactionTitle: { color: tokens.colors.textPrimary, fontSize: 20, fontFamily: tokens.typography.family.black },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 48 },
  emptyIconWrapper: { width: 64, height: 64, backgroundColor: tokens.colors.background, borderRadius: tokens.radii.full, alignItems: 'center', justifyContent: 'center', marginBottom: tokens.spacing.lg },
  emptyText: { color: tokens.colors.textTertiary, fontFamily: tokens.typography.family.bold, textAlign: 'center' },
  txRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: tokens.spacing.xl, borderBottomWidth: 1, borderBottomColor: tokens.colors.background },
  txInfo: { flex: 1, marginRight: tokens.spacing.lg },
  txDesc: { color: tokens.colors.textPrimary, fontFamily: tokens.typography.family.bold, fontSize: 17 },
  txDate: { color: tokens.colors.textTertiary, fontSize: 10, marginTop: 4, textTransform: 'uppercase', fontFamily: tokens.typography.family.black, letterSpacing: 1 },
  txAmount: { fontSize: 18, fontFamily: tokens.typography.family.black },
  txBalanceAfter: { color: tokens.colors.textTertiary, fontSize: 10, marginTop: 4, fontFamily: tokens.typography.family.bold },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: tokens.colors.surface, width: '80%', borderRadius: tokens.radii.xxl, padding: tokens.spacing.xxl },
  modalTitle: { fontSize: 20, fontFamily: tokens.typography.family.black, color: tokens.colors.textPrimary },
  modalSub: { fontSize: 12, color: tokens.colors.textTertiary, marginTop: 4, marginBottom: tokens.spacing.xl },
  modalInput: { borderWidth: 1, borderColor: tokens.colors.border, borderRadius: tokens.radii.xl, padding: tokens.spacing.lg, fontSize: 24, fontFamily: tokens.typography.family.black, color: tokens.colors.textPrimary, marginBottom: tokens.spacing.xl, textAlign: 'center' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  modalCancelBtn: { flex: 1, padding: tokens.spacing.lg, alignItems: 'center', marginRight: tokens.spacing.sm, backgroundColor: tokens.colors.background, borderRadius: tokens.radii.xl },
  modalCancelText: { color: tokens.colors.textTertiary, fontFamily: tokens.typography.family.black },
  modalAddBtn: { flex: 1, padding: tokens.spacing.lg, alignItems: 'center', marginLeft: tokens.spacing.sm, backgroundColor: tokens.colors.primary, borderRadius: tokens.radii.xl },
  modalAddText: { color: tokens.colors.textInverse, fontFamily: tokens.typography.family.black },
});

export default WalletScreen;
