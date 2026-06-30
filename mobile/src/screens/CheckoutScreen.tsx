import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, AppState, Image } from 'react-native';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api } from '../api/client';
import { useSelector, useDispatch } from 'react-redux';
import { clearCart } from '../store/slices/cartSlice';
import RazorpayCheckout from 'react-native-razorpay';
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import Animated, { FadeInDown, SlideInDown, useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSpring, interpolateColor } from 'react-native-reanimated';
import { ArrowLeft, MapPin, Sparkles, ChevronRight, CheckCircle2, ShieldCheck, Wallet, Banknote, CreditCard, Lock } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

const triggerHaptic = (type = 'impactLight') => ReactNativeHapticFeedback.trigger(type as any, hapticOptions);

const BouncingButton = ({ onPress, style, children, disabled = false }: any) => {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[style, animatedStyle]}>
      <TouchableOpacity
        activeOpacity={1}
        disabled={disabled}
        onPressIn={() => {
          if (!disabled) {
            scale.value = withSpring(0.95, { damping: 10, stiffness: 400 });
            triggerHaptic('impactMedium');
          }
        }}
        onPressOut={() => { if (!disabled) scale.value = withSpring(1, { damping: 10, stiffness: 400 }); }}
        onPress={() => { if (!disabled) onPress(); }}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};

const PulseLoader = () => {
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(withTiming(1.2, { duration: 1000 }), -1, true);
    opacity.value = withRepeat(withTiming(0.4, { duration: 1000 }), -1, true);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.pulseCircle, animatedStyle]}>
      <ShieldCheck size={48} color={colors.primary} />
    </Animated.View>
  );
};

const PaymentMethodCard = ({ title, subtitle, icon, isSelected, onPress, isCod = false }: any) => {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => { triggerHaptic('impactLight'); onPress(); }}
      style={[styles.pmCard, isSelected && styles.pmCardSelected]}
    >
      <View style={styles.pmLeft}>
        <View style={styles.pmIconWrap}>
          {icon}
        </View>
        <View style={styles.pmTextWrap}>
          <Text style={[styles.pmTitle, isSelected && { color: colors.ink }]}>{title}</Text>
          {subtitle ? <Text style={styles.pmSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <View style={styles.pmRadioWrapper}>
        <View style={[styles.pmRadio, isSelected && styles.pmRadioSelected]}>
          {isSelected && <View style={styles.pmRadioInner} />}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const CheckoutScreen = ({ navigation, route }: any) => {
  const queryClient = useQueryClient();
  const dispatch = useDispatch();
  const cart = useSelector((state: any) => state.cart);
  const { user } = useSelector((state: any) => state.auth);
  const appState = useRef(AppState.currentState);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        queryClient.invalidateQueries({ queryKey: ['pricing'] });
        queryClient.invalidateQueries({ queryKey: ['loyalty'] });
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [queryClient]);

  const [useWallet, setUseWallet] = useState(false);
  const [useLoyalty, setUseLoyalty] = useState(false);
  const [paymentSubMethod, setPaymentSubMethod] = useState<'online' | 'cod'>('online');
  const [isVerifying, setIsVerifying] = useState(false);

  const promoCode = route.params?.promoCode || '';
  const riderTip = route.params?.riderTip || 0;
  const deliveryInstructions = route.params?.instructions || '';
  const altReceiver = route.params?.altReceiver || false;
  const altName = route.params?.altName || '';
  const altPhone = route.params?.altPhone || '';

  const { data: addresses, isLoading: loadingAddresses } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => api.get('/customers/addresses'),
  });

  const selectedAddress = addresses?.addresses?.find((a: any) => a.id === route.params?.addressId);
  const isOutOfZone = !!selectedAddress && !selectedAddress.is_serviceable;

  const activeZoneId = useSelector((state: any) => state.app.activeZoneId);
  const zoneId = cart.zoneId || activeZoneId;

  const { data: pricing, isPending: loadingPricing, isFetching } = useQuery({
    queryKey: ['pricing', cart.items, useWallet, useLoyalty, promoCode, riderTip, zoneId],
    queryFn: () => api.post('/payment/create-order', {
      items: cart.items,
      addressId: route.params?.addressId,
      useWallet,
      useLoyalty,
      promoCode,
      riderTipPaise: riderTip * 100,
      instructions: deliveryInstructions,
      scheduledAt: route.params?.scheduledAt,
      zoneId,
      dryRun: true
    }),
    enabled: !loadingAddresses && !isOutOfZone,
    placeholderData: keepPreviousData,
  });

  const { data: loyaltyData } = useQuery({
    queryKey: ['loyalty'],
    queryFn: () => api.get('/customers/loyalty'),
  });

  const verifyOrder = async (orderId: string) => {
    setIsVerifying(true);
    let attempts = 0;
    let navigated = false;

    const interval = setInterval(async () => {
      if (navigated) return;
      attempts++;
      try {
        const res: any = await api.get(`/orders/${orderId}`);
        if (res.order?.status === 'confirmed' || res.order?.status === 'preparing') {
          clearInterval(interval);
          navigated = true;
          triggerHaptic('notificationSuccess');
          setIsVerifying(false);
          dispatch(clearCart());
          queryClient.invalidateQueries({ queryKey: ['wallet'] });
          queryClient.invalidateQueries({ queryKey: ['loyalty'] });
          queryClient.invalidateQueries({ queryKey: ['order-history'] });
          navigation.reset({
            index: 1,
            routes: [
              { name: 'Home' },
              { name: 'OrderPlaced', params: {
                orderId,
                displayId: res.order?.display_id,
                menuOfferDiscountPaise: pricing?.menuOfferDiscountPaise || 0,
                promoDiscountPaise: pricing?.discountPaise || 0,
                loyaltyDiscountPaise: pricing?.loyaltyDiscountPaise || 0,
                walletDeductionPaise: pricing?.walletDeductionPaise || 0,
                subtotalPaise: pricing?.subtotalPaise || 0,
                promoCode,
              }},
            ],
          });
          return;
        }
      } catch (e) { console.log('Verification polling error:', e); }

      if (attempts >= 15) {
        clearInterval(interval);
        navigated = true;
        setIsVerifying(false);
        Alert.alert('Payment Pending', 'Your payment is being processed. You can check the status in your orders history.');
        navigation.navigate('OrderHistory');
      }
    }, 2000);
  };

  const placeOrderMutation = useMutation({
    mutationFn: (data: any) => api.post('/payment/create-order', data),
    onSuccess: (res: any) => {
      if (res.status === 'confirmed') {
        triggerHaptic('notificationSuccess');
        dispatch(clearCart());
        navigation.reset({
          index: 1,
          routes: [
            { name: 'Home' },
            { name: 'OrderPlaced', params: {
              orderId: res.orderId,
              displayId: res.displayId,
              menuOfferDiscountPaise: pricing?.menuOfferDiscountPaise || 0,
              promoDiscountPaise: pricing?.discountPaise || 0,
              loyaltyDiscountPaise: pricing?.loyaltyDiscountPaise || 0,
              walletDeductionPaise: pricing?.walletDeductionPaise || 0,
              subtotalPaise: pricing?.subtotalPaise || 0,
              promoCode,
            }},
          ],
        });
        return;
      }
      if (!res.keyId) {
        Alert.alert('Configuration Error', 'Razorpay is not set up on the server.');
        return;
      }

      const options: any = {
        description: '2QT Food Order',
        image: 'https://2qt.app/logo.png',
        currency: 'INR',
        key: res.keyId,
        amount: res.amount,
        name: '2QT',
        order_id: res.razorpayOrderId,
        prefill: { email: user?.email || 'customer@2qt.app', contact: user?.phone || '', name: user?.name || 'Customer' },
        theme: { color: colors.primary }
      };

      // Cleaned up the intent flow as user wants standard Razorpay checkout

      if (RazorpayCheckout && typeof RazorpayCheckout.open === 'function') {
        RazorpayCheckout.open(options)
          .then((data: any) => {
            api.post('/payment/verify-payment', {
              razorpay_order_id: data.razorpay_order_id,
              razorpay_payment_id: data.razorpay_payment_id,
              razorpay_signature: data.razorpay_signature,
              type: 'order'
            }).then(() => verifyOrder(res.orderId)).catch(() => verifyOrder(res.orderId));
          })
          .catch((error: any) => {
            let msg = 'Transaction cancelled';
            try {
              const errStr = typeof error === 'string' ? error : (error?.description || JSON.stringify(error));
              if (errStr && errStr.includes('{')) {
                const parsed = JSON.parse(errStr);
                msg = parsed?.error?.description || parsed?.description || msg;
              } else if (error?.description) msg = error.description;
              else if (error?.message) msg = error.message;
            } catch (e) { msg = error?.description || error?.message || 'Transaction cancelled'; }
            Alert.alert('Payment Failed', msg);
          });
      } else {
        Alert.alert('Error', 'Payment gateway is not available on this device.');
      }
    },
    onError: (err: any) => Alert.alert('Order Failed', err.message || 'Could not initiate payment')
  });

  const handlePlaceOrder = () => {
    triggerHaptic('impactHeavy');
    placeOrderMutation.mutate({
      items: cart.items,
      addressId: route.params?.addressId,
      useWallet,
      useLoyalty,
      promoCode,
      paymentMethod: paymentSubMethod === 'cod' ? 'cod' : 'online',
      riderTipPaise: riderTip * 100,
      scheduledAt: route.params?.scheduledAt,
      instructions: deliveryInstructions,
      deliveryContactName: altReceiver && altName.trim() ? altName.trim() : undefined,
      deliveryContactPhone: altReceiver && altPhone.trim() ? altPhone.trim() : undefined,
    });
  };

  if (isVerifying) return (
    <View style={styles.verifyingContainer}>
      <PulseLoader />
      <Animated.Text entering={FadeInDown.delay(200)} style={styles.verifyingTitle}>Verifying Payment</Animated.Text>
      <Animated.Text entering={FadeInDown.delay(300)} style={styles.verifyingSub}>Securely confirming your order...</Animated.Text>
    </View>
  );

  if (loadingAddresses) return (
    <View style={styles.verifyingContainer}>
      <PulseLoader />
      <Animated.Text entering={FadeInDown.delay(200)} style={styles.verifyingTitle}>Loading</Animated.Text>
    </View>
  );

  if (isOutOfZone) return (
    <View style={styles.outOfZoneContainer}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.outOfZoneBack}>
        <ArrowLeft size={24} color={colors.ink} />
      </TouchableOpacity>
      <Animated.View entering={FadeInDown.duration(400)} style={styles.outOfZoneContent}>
        <View style={styles.outOfZoneIconBox}>
          <MapPin size={48} color={colors.danger} />
        </View>
        <Text style={styles.outOfZoneTitle}>Out of delivery zone</Text>
        <Text style={styles.outOfZoneSub}>Your address is outside our delivery area.</Text>
        <TouchableOpacity style={styles.outOfZoneChangeBtn} onPress={() => navigation.navigate('Address')}>
          <Text style={styles.outOfZoneChangeBtnText}>Change Delivery Address</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );

  if (loadingPricing && !pricing) return (
    <View style={styles.verifyingContainer}>
      <PulseLoader />
      <Animated.Text entering={FadeInDown.delay(200)} style={styles.verifyingTitle}>Calculating Total</Animated.Text>
    </View>
  );

  const p = pricing?.pricing || { totalAmountPaise: 0, subtotalPaise: 0, deliveryFeePaise: 0, cgstPaise: 0, sgstPaise: 0, discountPaise: 0, loyaltyDiscountPaise: 0, walletDeductionPaise: 0, gatewayAmountPaise: 0 };
  const walletBal = pricing?.availableWallet || 0;
  const loyaltyPts = loyaltyData?.points || 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity onPress={() => { triggerHaptic('impactLight'); navigation.goBack(); }} style={styles.backButton}>
          <ArrowLeft size={22} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Payment Method</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        
        {/* Bill Summary */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.card}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.billRow}><Text style={styles.billLabel}>Item Total</Text><Text style={styles.billValue}>₹{p.subtotalPaise / 100}</Text></View>
          <View style={styles.billRow}><Text style={styles.billLabel}>Delivery Fee</Text><Text style={styles.billValue}>₹{p.deliveryFeePaise / 100}</Text></View>
          <View style={styles.billRow}><Text style={styles.billLabel}>Taxes</Text><Text style={styles.billValue}>₹{((p.cgstPaise || 0) + (p.sgstPaise || 0)) / 100}</Text></View>
          {riderTip > 0 && <View style={styles.billRow}><Text style={styles.billLabel}>Rider Tip</Text><Text style={styles.billValue}>₹{riderTip}</Text></View>}
          
          {(p.discountPaise > 0 || p.loyaltyDiscountPaise > 0 || p.walletDeductionPaise > 0) && (
            <View style={styles.divider} />
          )}
          {p.discountPaise > 0 && <View style={styles.billRow}><Text style={styles.billGreenLabel}>Promo Discount</Text><Text style={styles.billGreenValue}>-₹{p.discountPaise / 100}</Text></View>}
          {p.loyaltyDiscountPaise > 0 && <View style={styles.billRow}><Text style={styles.billGreenLabel}>2QT Points Used</Text><Text style={styles.billGreenValue}>-₹{p.loyaltyDiscountPaise / 100}</Text></View>}
          {p.walletDeductionPaise > 0 && <View style={styles.billRow}><Text style={styles.billGreenLabel}>Wallet Used</Text><Text style={styles.billGreenValue}>-₹{p.walletDeductionPaise / 100}</Text></View>}
          
          <View style={styles.divider} />
          <View style={styles.billTotalRow}>
            <Text style={styles.billTotalLabel}>To Pay</Text>
            <Text style={styles.billTotalValue}>₹{p.gatewayAmountPaise / 100}</Text>
          </View>
        </Animated.View>

        {/* Use Wallet / Loyalty */}
        {(walletBal > 0 || loyaltyPts > 0) && (
          <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.card}>
            <Text style={styles.sectionTitle}>Apply Savings</Text>
            {walletBal > 0 && (
              <TouchableOpacity style={styles.savingsRow} activeOpacity={0.8} onPress={() => { triggerHaptic(); setUseWallet(!useWallet); }}>
                <View style={[styles.savingsIcon, useWallet && { backgroundColor: colors.primary }]}>
                  <Wallet size={16} color={useWallet ? '#fff' : colors.primary} />
                </View>
                <View style={styles.savingsInfo}>
                  <Text style={styles.savingsTitle}>2QT Wallet</Text>
                  <Text style={styles.savingsSub}>Balance: ₹{walletBal / 100}</Text>
                </View>
                <View style={[styles.customCheckbox, useWallet && styles.customCheckboxActive]}>
                  {useWallet && <View style={styles.customCheckboxInner} />}
                </View>
              </TouchableOpacity>
            )}
            {loyaltyPts > 0 && (
              <TouchableOpacity style={[styles.savingsRow, { marginTop: walletBal > 0 ? 16 : 0 }]} activeOpacity={0.8} onPress={() => { triggerHaptic(); setUseLoyalty(!useLoyalty); }}>
                <View style={[styles.savingsIcon, useLoyalty && { backgroundColor: '#1B5E46' }]}>
                  <Sparkles size={16} color={useLoyalty ? '#fff' : '#1B5E46'} />
                </View>
                <View style={styles.savingsInfo}>
                  <Text style={styles.savingsTitle}>Loyalty Points</Text>
                  <Text style={styles.savingsSub}>{loyaltyPts} points available</Text>
                </View>
                <View style={[styles.customCheckbox, useLoyalty && { borderColor: '#1B5E46' }]}>
                  {useLoyalty && <View style={[styles.customCheckboxInner, { backgroundColor: '#1B5E46' }]} />}
                </View>
              </TouchableOpacity>
            )}
          </Animated.View>
        )}

        {/* Payment Methods */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <Text style={styles.sectionHeader}>PAYMENT OPTIONS</Text>
          
          <PaymentMethodCard
            title="Pay Online"
            subtitle="Credit/Debit cards, UPI, Wallets, Netbanking via Razorpay"
            icon={<CreditCard size={20} color={colors.primary} />}
            isSelected={paymentSubMethod === 'online'}
            onPress={() => setPaymentSubMethod('online')}
          />
          <PaymentMethodCard
            title="Cash on Delivery"
            subtitle="Pay via cash or UPI at your doorstep"
            icon={<Banknote size={20} color="#F59E0B" />}
            isSelected={paymentSubMethod === 'cod'}
            onPress={() => setPaymentSubMethod('cod')}
            isCod={true}
          />
        </Animated.View>
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Floating Action Button */}
      <Animated.View entering={SlideInDown.duration(400).delay(250)} style={[styles.fabContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.secureBadgeRow}>
          <Lock size={12} color={colors.inkMuted} />
          <Text style={styles.secureText}>100% Secure Payments via Razorpay</Text>
        </View>
        
        <BouncingButton 
          style={styles.fabBtn}
          disabled={placeOrderMutation.isPending || isFetching}
          onPress={handlePlaceOrder}
        >
          <View style={styles.fabBtnContent}>
            <View>
              <Text style={styles.fabTotalLabel}>Total to Pay</Text>
              <Text style={styles.fabTotalValue}>₹{p.gatewayAmountPaise / 100}</Text>
            </View>
            <View style={styles.fabActionRow}>
              {placeOrderMutation.isPending || isFetching ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={styles.fabActionText}>
                    {p.gatewayAmountPaise <= 0 ? 'Place Order' : (paymentSubMethod === 'cod' ? 'Place Order (COD)' : 'Pay Now')}
                  </Text>
                  <ChevronRight size={18} color="#fff" style={{ marginLeft: 4 }} />
                </>
              )}
            </View>
          </View>
        </BouncingButton>
      </Animated.View>
    </View>
  );
};

export default CheckoutScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  headerTitle: { fontSize: 18, fontFamily: fontFamily.bold, color: colors.ink },
  
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },

  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  sectionTitle: { fontSize: 16, fontFamily: fontFamily.bold, color: colors.ink, marginBottom: 16 },
  
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  billLabel: { fontSize: 14, fontFamily: fontFamily.medium, color: colors.inkMuted },
  billValue: { fontSize: 14, fontFamily: fontFamily.semibold, color: colors.ink },
  billGreenLabel: { fontSize: 14, fontFamily: fontFamily.medium, color: '#10B981' },
  billGreenValue: { fontSize: 14, fontFamily: fontFamily.bold, color: '#10B981' },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 12 },
  billTotalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  billTotalLabel: { fontSize: 16, fontFamily: fontFamily.black, color: colors.ink },
  billTotalValue: { fontSize: 18, fontFamily: fontFamily.black, color: colors.ink, letterSpacing: -0.5 },

  savingsRow: { flexDirection: 'row', alignItems: 'center' },
  savingsIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  savingsInfo: { flex: 1 },
  savingsTitle: { fontSize: 15, fontFamily: fontFamily.bold, color: colors.ink, marginBottom: 2 },
  savingsSub: { fontSize: 12, fontFamily: fontFamily.medium, color: colors.inkMuted },

  customCheckbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  customCheckboxActive: { borderColor: colors.primary },
  customCheckboxInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary },

  sectionHeader: { fontSize: 12, fontFamily: fontFamily.black, color: colors.inkFaint, letterSpacing: 1, marginBottom: 12, marginLeft: 4, marginTop: 8 },
  
  pmCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#F3F4F6',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 1,
  },
  pmCardSelected: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  pmLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  pmIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center', marginRight: 14, borderWidth: 1, borderColor: '#F3F4F6' },
  pmTextWrap: { flex: 1 },
  pmTitle: { fontSize: 15, fontFamily: fontFamily.bold, color: colors.ink, marginBottom: 2 },
  pmSubtitle: { fontSize: 12, fontFamily: fontFamily.medium, color: colors.inkMuted },
  pmRadioWrapper: { marginLeft: 12 },
  pmRadio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  pmRadioSelected: { borderColor: colors.primary },
  pmRadioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary },

  fabContainer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F3F4F6',
    paddingHorizontal: 16, paddingTop: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 10,
  },
  secureBadgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12, gap: 6 },
  secureText: { fontSize: 11, fontFamily: fontFamily.bold, color: colors.inkMuted },
  fabBtn: { backgroundColor: colors.primary, borderRadius: 16, overflow: 'hidden' },
  fabBtnContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 18 },
  fabTotalLabel: { fontSize: 11, fontFamily: fontFamily.semibold, color: 'rgba(255,255,255,0.8)' },
  fabTotalValue: { fontSize: 18, fontFamily: fontFamily.black, color: '#fff', letterSpacing: -0.5 },
  fabActionRow: { flexDirection: 'row', alignItems: 'center' },
  fabActionText: { fontSize: 16, fontFamily: fontFamily.bold, color: '#fff' },

  verifyingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' },
  pulseCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  verifyingTitle: { fontSize: 22, fontFamily: fontFamily.black, color: colors.ink, marginBottom: 8 },
  verifyingSub: { fontSize: 14, fontFamily: fontFamily.medium, color: colors.inkMuted, textAlign: 'center', paddingHorizontal: 40 },

  outOfZoneContainer: { flex: 1, backgroundColor: '#F9FAFB' },
  outOfZoneBack: { position: 'absolute', top: 50, left: 20, zIndex: 10, width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 4 },
  outOfZoneContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  outOfZoneIconBox: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  outOfZoneTitle: { fontSize: 22, fontFamily: fontFamily.black, color: colors.ink, marginBottom: 12 },
  outOfZoneSub: { fontSize: 15, fontFamily: fontFamily.medium, color: colors.inkMuted, textAlign: 'center', marginBottom: 32, lineHeight: 22 },
  outOfZoneChangeBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 32, width: '100%', alignItems: 'center' },
  outOfZoneChangeBtnText: { fontSize: 16, fontFamily: fontFamily.bold, color: '#fff' },
});
