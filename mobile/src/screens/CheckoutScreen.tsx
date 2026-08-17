import { tokens } from '../theme/tokens';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet, AppState } from 'react-native';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api } from '../api/client';
import { useSelector, useDispatch } from 'react-redux';
import { clearCart } from '../store/slices/cartSlice';
import { RootState } from '../store';
import RazorpayCheckout from 'react-native-razorpay';
import Animated, { FadeInDown, SlideInDown, useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';
import { ArrowLeft, MapPin, Sparkles, ChevronRight, ShieldCheck, Wallet, Banknote, CreditCard, Lock, X } from 'lucide-react-native';
import { haptics } from '../utils/haptics';
import { PressableScale } from '../components/ui/internal/PressableScale';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFeedback } from '../context/FeedbackContext';

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
      <ShieldCheck size={48} color={tokens.colors.primary} />
    </Animated.View>
  );
};

const PaymentMethodCard = ({ title, subtitle, icon, isSelected, onPress }: any) => {
  return (
    <PressableScale hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      onPress={() => { haptics.selection(); onPress(); }}
      style={[styles.pmCard, isSelected && styles.pmCardSelected]}
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
      accessibilityLabel={title}
    >
      <View style={styles.pmLeft}>
        <View style={styles.pmIconWrap}>
          {icon}
        </View>
        <View style={styles.pmTextWrap}>
          <Text allowFontScaling={false} style={[styles.pmTitle, isSelected && { color: tokens.colors.textPrimary }]}>{title}</Text>
          {subtitle ? <Text allowFontScaling={false} style={styles.pmSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <View style={styles.pmRadioWrapper}>
        <View style={[styles.pmRadio, isSelected && styles.pmRadioSelected]}>
          {isSelected && <View style={styles.pmRadioInner} />}
        </View>
      </View>
    </PressableScale>
  );
};

const CheckoutScreen = ({ navigation, route }: any) => {
  const queryClient = useQueryClient();
  const dispatch = useDispatch();
  const cart = useSelector((state: any) => state.cart);
  const { user } = useSelector((state: any) => state.auth);
  const { featureLoyalty } = useSelector((state: RootState) => state.app);
  const appState = useRef(AppState.currentState);
  const insets = useSafeAreaInsets();
  const { showDialog } = useFeedback();

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
  const [showDeliveryFeeInfo, setShowDeliveryFeeInfo] = useState(false);
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
    queryKey: ['loyalty', 'balance'],
    queryFn: () => api.get('/customers/loyalty'),
  });

  const verifyIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (verifyIntervalRef.current) clearInterval(verifyIntervalRef.current);
    };
  }, []);

  const verifyOrder = async (orderId: string) => {
    setIsVerifying(true);
    let attempts = 0;
    let navigated = false;

    verifyIntervalRef.current = setInterval(async () => {
      if (navigated) return;
      attempts++;
      try {
        const res: any = await api.get(`/orders/${orderId}`);
        if (res.order?.status === 'confirmed' || res.order?.status === 'preparing') {
          if (verifyIntervalRef.current) clearInterval(verifyIntervalRef.current);
          navigated = true;
          haptics.success();
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
                campaignDiscountPaise: pricing?.campaignDiscountPaise || 0,
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
        if (verifyIntervalRef.current) clearInterval(verifyIntervalRef.current);
        navigated = true;
        setIsVerifying(false);
        showDialog({ title: 'Payment Pending', message: 'Your payment is being processed. You can check the status in your orders history.' });
        navigation.navigate('OrderHistory');
      }
    }, 2000);
  };

  const placeOrderMutation = useMutation({
    mutationFn: (data: any) => api.post('/payment/create-order', data),
    onSuccess: (res: any) => {
      if (res.status === 'confirmed') {
        haptics.success();
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
              campaignDiscountPaise: pricing?.campaignDiscountPaise || 0,
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
        showDialog({ title: 'Configuration Error', message: 'Razorpay is not set up on the server.' });
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
        theme: { color: tokens.colors.primary }
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
            showDialog({ title: 'Payment Failed', message: msg });
          });
      } else {
        showDialog({ title: 'Error', message: 'Payment gateway is not available on this device.' });
      }
    },
    onError: (err: any) => showDialog({ title: 'Order Failed', message: err.message || 'Could not initiate payment' })
  });

  const handlePlaceOrder = () => {
    haptics.impact(); // the one weighty confirmation on this screen — placing/paying for the order
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
      <Animated.Text allowFontScaling={false} entering={FadeInDown.delay(200)} style={styles.verifyingTitle}>Verifying Payment</Animated.Text>
      <Animated.Text allowFontScaling={false} entering={FadeInDown.delay(300)} style={styles.verifyingSub}>Securely confirming your order...</Animated.Text>
    </View>
  );

  if (loadingAddresses) return (
    <View style={styles.verifyingContainer}>
      <PulseLoader />
      <Animated.Text allowFontScaling={false} entering={FadeInDown.delay(200)} style={styles.verifyingTitle}>Loading</Animated.Text>
    </View>
  );

  if (isOutOfZone) return (
    <View style={styles.outOfZoneContainer}>
      <PressableScale 
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} 
        onPress={() => navigation.navigate('AddressBook')} 
        style={styles.outOfZoneBack}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <ArrowLeft size={24} color={tokens.colors.textPrimary} />
      </PressableScale>
      <Animated.View entering={FadeInDown.duration(400)} style={styles.outOfZoneContent}>
        <View style={styles.outOfZoneIconBox}>
          <MapPin size={48} color={tokens.colors.danger} />
        </View>
        <Text allowFontScaling={false} style={styles.outOfZoneTitle}>Out of delivery zone</Text>
        <Text allowFontScaling={false} style={styles.outOfZoneSub}>Your address is outside our delivery area.</Text>
        <PressableScale 
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} 
          style={styles.outOfZoneChangeBtn} 
          onPress={() => navigation.navigate('Address', { fromCheckout: true, returnToCart: true })}
          accessibilityRole="button"
          accessibilityLabel="Change delivery address"
        >
          <Text allowFontScaling={false} style={styles.outOfZoneChangeBtnText}>Change Delivery Address</Text>
        </PressableScale>
      </Animated.View>
    </View>
  );

  if (loadingPricing && !pricing) return (
    <View style={styles.verifyingContainer}>
      <PulseLoader />
      <Animated.Text allowFontScaling={false} entering={FadeInDown.delay(200)} style={styles.verifyingTitle}>Calculating Total</Animated.Text>
    </View>
  );

  const p = pricing?.pricing ? pricing.pricing : (pricing?.subtotalPaise !== undefined ? pricing : { totalAmountPaise: 0, subtotalPaise: 0, deliveryFeePaise: 0, cgstPaise: 0, sgstPaise: 0, discountPaise: 0, loyaltyDiscountPaise: 0, walletDeductionPaise: 0, gatewayAmountPaise: 0, menuOfferDiscountPaise: 0 });
  const walletBal = pricing?.availableWallet || 0;
  const loyaltyPts = loyaltyData?.points || 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <PressableScale hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={() => navigation.goBack()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
          <ArrowLeft size={22} color={tokens.colors.textPrimary} />
        </PressableScale>
        <Text allowFontScaling={false} style={styles.headerTitle}>Select Payment Method</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        
        {/* Bill Summary */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.card}>
          <Text allowFontScaling={false} style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.billRow}><Text allowFontScaling={false} style={styles.billLabel}>Item Total</Text><Text allowFontScaling={false} style={styles.billValue}>₹{((p.subtotalPaise || 0) / 100).toFixed(2)}</Text></View>
          <View style={styles.billRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text allowFontScaling={false} style={styles.billLabel}>Delivery Fee</Text>
              <PressableScale onPress={() => { haptics.selection(); setShowDeliveryFeeInfo(!showDeliveryFeeInfo); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text allowFontScaling={false} style={styles.whyThisText}>(Why this?)</Text>
              </PressableScale>
            </View>
            <Text allowFontScaling={false} style={styles.billValue}>{p.deliveryFeePaise === 0 ? 'FREE' : `₹${((p.deliveryFeePaise || 0) / 100).toFixed(2)}`}</Text>
          </View>

          {showDeliveryFeeInfo && (
            <Animated.View entering={FadeInDown.duration(250)} style={styles.feeInfoCard}>
              <View style={styles.feeInfoHeader}>
                <Text allowFontScaling={false} style={styles.feeInfoTitle}>Why pay a Delivery Fee ?</Text>
                <PressableScale onPress={() => setShowDeliveryFeeInfo(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <X size={16} color="#71717A" />
                </PressableScale>
              </View>
              <Text allowFontScaling={false} style={styles.feeInfoBody}>
                This goes towards fairly compensating our captains and covering the convenience of bringing yummy food right to the comfort of your home. It ensures a sustainable service for everyone involved.
              </Text>
            </Animated.View>
          )}

          <View style={styles.billRow}>
            <Text allowFontScaling={false} style={[styles.billLabel, { textDecorationLine: 'line-through' }]}>Platform fees</Text>
            <Text allowFontScaling={false} style={styles.feeStrikethroughText}>We're not those guys</Text>
          </View>
          <View style={styles.billRow}>
            <Text allowFontScaling={false} style={[styles.billLabel, { textDecorationLine: 'line-through' }]}>Packaging Fees</Text>
            <Text allowFontScaling={false} style={styles.feeStrikethroughText}>Seriously? Nope</Text>
          </View>
          <View style={styles.billRow}><Text allowFontScaling={false} style={styles.billLabel}>Taxes</Text><Text allowFontScaling={false} style={styles.billValue}>₹{(((p.cgstPaise || 0) + (p.sgstPaise || 0)) / 100).toFixed(2)}</Text></View>
          {riderTip > 0 && <View style={styles.billRow}><Text allowFontScaling={false} style={styles.billLabel}>Rider Tip</Text><Text allowFontScaling={false} style={styles.billValue}>₹{riderTip.toFixed(2)}</Text></View>}
          
          {(p.menuOfferDiscountPaise > 0 || p.discountPaise > 0 || p.loyaltyDiscountPaise > 0 || p.walletDeductionPaise > 0) && (
            <View style={styles.divider} />
          )}
          {p.menuOfferDiscountPaise > 0 && <View style={styles.billRow}><Text allowFontScaling={false} style={styles.billGreenLabel}>Item Offers</Text><Text allowFontScaling={false} style={styles.billGreenValue}>-₹{(p.menuOfferDiscountPaise / 100).toFixed(2)}</Text></View>}
          {p.discountPaise > 0 && <View style={styles.billRow}><Text allowFontScaling={false} style={styles.billGreenLabel}>Promo Discount</Text><Text allowFontScaling={false} style={styles.billGreenValue}>-₹{(p.discountPaise / 100).toFixed(2)}</Text></View>}
          {featureLoyalty && p.loyaltyDiscountPaise > 0 && <View style={styles.billRow}><Text allowFontScaling={false} style={styles.billGreenLabel}>2QT Points Used</Text><Text allowFontScaling={false} style={styles.billGreenValue}>-₹{(p.loyaltyDiscountPaise / 100).toFixed(2)}</Text></View>}
          {p.walletDeductionPaise > 0 && <View style={styles.billRow}><Text allowFontScaling={false} style={styles.billGreenLabel}>Wallet Used</Text><Text allowFontScaling={false} style={styles.billGreenValue}>-₹{(p.walletDeductionPaise / 100).toFixed(2)}</Text></View>}
          
          <View style={styles.divider} />
          <View style={styles.billTotalRow}>
            <Text allowFontScaling={false} style={styles.billTotalLabel}>To Pay</Text>
            <Text allowFontScaling={false} style={styles.billTotalValue}>₹{((p.gatewayAmountPaise || 0) / 100).toFixed(2)}</Text>
          </View>
        </Animated.View>

        {/* Use Wallet / Loyalty */}
        {(walletBal > 0 || (featureLoyalty && loyaltyPts > 0)) && (
          <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.card}>
            <Text allowFontScaling={false} style={styles.sectionTitle}>Apply Savings</Text>
            {walletBal > 0 && (
              <PressableScale hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={styles.savingsRow} onPress={() => { haptics.selection(); setUseWallet(!useWallet); }} accessibilityRole="checkbox" accessibilityState={{ checked: useWallet }} accessibilityLabel="Use 2QT Wallet">
                <View style={[styles.savingsIcon, useWallet && { backgroundColor: tokens.colors.primary }]}>
                  <Wallet size={16} color={useWallet ? tokens.colors.surface : tokens.colors.primary} />
                </View>
                <View style={styles.savingsInfo}>
                  <Text allowFontScaling={false} style={styles.savingsTitle}>2QT Wallet</Text>
                  <Text allowFontScaling={false} style={styles.savingsSub}>Balance: ₹{walletBal / 100}</Text>
                </View>
                <View style={[styles.customCheckbox, useWallet && styles.customCheckboxActive]}>
                  {useWallet && <View style={styles.customCheckboxInner} />}
                </View>
              </PressableScale>
            )}
            {featureLoyalty && loyaltyPts > 0 && (
              <PressableScale hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={[styles.savingsRow, { marginTop: walletBal > 0 ? tokens.spacing.lg : 0 }]} onPress={() => { haptics.selection(); setUseLoyalty(!useLoyalty); }} accessibilityRole="checkbox" accessibilityState={{ checked: useLoyalty }} accessibilityLabel="Use Loyalty Points">
                <View style={[styles.savingsIcon, useLoyalty && { backgroundColor: '#FC4603' }]}>
                  <Sparkles size={16} color={useLoyalty ? tokens.colors.surface : '#FC4603'} />
                </View>
                <View style={styles.savingsInfo}>
                  <Text allowFontScaling={false} style={styles.savingsTitle}>Loyalty Points</Text>
                  <Text allowFontScaling={false} style={styles.savingsSub}>{loyaltyPts} points available</Text>
                </View>
                <View style={[styles.customCheckbox, useLoyalty && { borderColor: '#FC4603' }]}>
                  {useLoyalty && <View style={[styles.customCheckboxInner, { backgroundColor: '#FC4603' }]} />}
                </View>
              </PressableScale>
            )}
          </Animated.View>
        )}

        {/* Payment Methods */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <Text allowFontScaling={false} style={styles.sectionHeader}>PAYMENT OPTIONS</Text>
          
          <PaymentMethodCard
            title="Pay Online"
            subtitle="Credit/Debit cards, UPI, Wallets, Netbanking via Razorpay"
            icon={<CreditCard size={20} color={tokens.colors.primary} />}
            isSelected={paymentSubMethod === 'online'}
            onPress={() => setPaymentSubMethod('online')}
          />
          <PaymentMethodCard
            title="Cash on Delivery"
            subtitle="Pay via cash or UPI at your doorstep"
            icon={<Banknote size={20} color={tokens.colors.warning} />}
            isSelected={paymentSubMethod === 'cod'}
            onPress={() => setPaymentSubMethod('cod')}
            isCod={true}
          />
        </Animated.View>
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Floating Action Button */}
      <Animated.View entering={SlideInDown.delay(300).duration(300)} style={[styles.fabContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.secureBadgeRow}>
          <Lock size={12} color={tokens.colors.textSecondary} />
          <Text allowFontScaling={false} style={styles.secureText}>100% Secure Payments via Razorpay</Text>
        </View>
        
        <PressableScale
          style={styles.fabBtn}
          disabled={placeOrderMutation.isPending || isFetching}
          onPress={handlePlaceOrder}
          accessibilityRole="button"
          accessibilityLabel={p.gatewayAmountPaise <= 0 ? 'Place Order' : (paymentSubMethod === 'cod' ? 'Place Order via Cash on Delivery' : 'Pay Now')}
        >
          <View style={styles.fabBtnContent}>
            <View>
              <Text allowFontScaling={false} style={styles.fabTotalLabel}>Total to Pay</Text>
              <Text allowFontScaling={false} style={styles.fabTotalValue}>₹{p.gatewayAmountPaise / 100}</Text>
            </View>
            <View style={styles.fabActionRow}>
              {placeOrderMutation.isPending || isFetching ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text allowFontScaling={false} style={styles.fabActionText}>
                    {p.gatewayAmountPaise <= 0 ? 'Place Order' : (paymentSubMethod === 'cod' ? 'Place Order (COD)' : 'Pay Now')}
                  </Text>
                  <ChevronRight size={18} color="#fff" style={{ marginLeft: 4 }} />
                </>
              )}
            </View>
          </View>
        </PressableScale>
      </Animated.View>
    </View>
  );
};

export default CheckoutScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: tokens.colors.surface, paddingHorizontal: tokens.spacing.lg, paddingBottom: tokens.spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tokens.colors.border,
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: tokens.colors.background,
    alignItems: 'center', justifyContent: 'center', marginRight: tokens.spacing.md,
  },
  headerTitle: { fontSize: 18, fontFamily: tokens.typography.family.bold, color: tokens.colors.textPrimary },
  
  scrollView: { flex: 1 },
  scrollContent: { padding: tokens.spacing.lg },

  card: {
    backgroundColor: tokens.colors.surface, borderRadius: tokens.radii.xxl, padding: tokens.spacing.xl, marginBottom: tokens.spacing.lg,
    ...tokens.shadows.soft,
  },
  sectionTitle: { fontSize: 16, fontFamily: tokens.typography.family.bold, color: tokens.colors.textPrimary, marginBottom: tokens.spacing.lg },
  
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: tokens.spacing.md },
  billLabel: { fontSize: 14, fontFamily: tokens.typography.family.medium, color: tokens.colors.textSecondary },
  billValue: { fontSize: 14, fontFamily: tokens.typography.family.semibold, color: tokens.colors.textPrimary },
  billGreenLabel: { fontSize: 14, fontFamily: tokens.typography.family.medium, color: tokens.colors.success },
  billGreenValue: { fontSize: 14, fontFamily: tokens.typography.family.bold, color: tokens.colors.success },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: tokens.colors.border, marginVertical: tokens.spacing.md },
  billTotalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  billTotalLabel: { fontSize: 16, fontFamily: tokens.typography.family.black, color: tokens.colors.textPrimary },
  billTotalValue: { fontSize: 18, fontFamily: tokens.typography.family.black, color: tokens.colors.textPrimary, letterSpacing: -0.5 },

  savingsRow: { flexDirection: 'row', alignItems: 'center' },
  savingsIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: tokens.colors.primaryTint, alignItems: 'center', justifyContent: 'center', marginRight: tokens.spacing.md },
  savingsInfo: { flex: 1 },
  savingsTitle: { fontSize: 15, fontFamily: tokens.typography.family.bold, color: tokens.colors.textPrimary, marginBottom: 2 },
  savingsSub: { fontSize: 12, fontFamily: tokens.typography.family.medium, color: tokens.colors.textSecondary },

  customCheckbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: tokens.colors.border, alignItems: 'center', justifyContent: 'center' },
  customCheckboxActive: { borderColor: tokens.colors.primary },
  customCheckboxInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: tokens.colors.primary },

  sectionHeader: { fontSize: 12, fontFamily: tokens.typography.family.black, color: tokens.colors.textTertiary, letterSpacing: 1, marginBottom: tokens.spacing.md, marginLeft: 4, marginTop: 8 },
  
  pmCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: tokens.colors.surface, borderRadius: 16, padding: tokens.spacing.lg, marginBottom: tokens.spacing.md,
    borderWidth: 1, borderColor: tokens.colors.border,
    ...tokens.shadows.soft,
  },
  pmCardSelected: { borderColor: tokens.colors.primary, backgroundColor: tokens.colors.primaryTint },
  pmLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  pmIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: tokens.colors.background, alignItems: 'center', justifyContent: 'center', marginRight: 14, borderWidth: 1, borderColor: tokens.colors.border },
  pmTextWrap: { flex: 1 },
  pmTitle: { fontSize: 15, fontFamily: tokens.typography.family.bold, color: tokens.colors.textPrimary, marginBottom: 2 },
  pmSubtitle: { fontSize: 12, fontFamily: tokens.typography.family.medium, color: tokens.colors.textSecondary },
  pmRadioWrapper: { marginLeft: tokens.spacing.md },
  pmRadio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: tokens.colors.border, alignItems: 'center', justifyContent: 'center' },
  pmRadioSelected: { borderColor: tokens.colors.primary },
  pmRadioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: tokens.colors.primary },

  fabContainer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: tokens.colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.colors.border,
    paddingHorizontal: tokens.spacing.lg, paddingTop: tokens.spacing.md,
    ...tokens.shadows.soft,
  },
  secureBadgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: tokens.spacing.md, gap: 6 },
  secureText: { fontSize: 11, fontFamily: tokens.typography.family.bold, color: tokens.colors.textSecondary },
  fabBtn: { backgroundColor: tokens.colors.primary, borderRadius: 16, overflow: 'hidden' },
  fabBtnContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: tokens.spacing.xl, paddingVertical: 18 },
  fabTotalLabel: { fontSize: 11, fontFamily: tokens.typography.family.semibold, color: 'rgba(255,255,255,0.8)' },
  fabTotalValue: { fontSize: 18, fontFamily: tokens.typography.family.black, color: tokens.colors.surface, letterSpacing: -0.5 },
  fabActionRow: { flexDirection: 'row', alignItems: 'center' },
  fabActionText: { fontSize: 16, fontFamily: tokens.typography.family.bold, color: tokens.colors.surface },

  verifyingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colors.background },
  pulseCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: tokens.colors.primaryTint, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  verifyingTitle: { fontSize: 22, fontFamily: tokens.typography.family.black, color: tokens.colors.textPrimary, marginBottom: 8 },
  verifyingSub: { fontSize: 14, fontFamily: tokens.typography.family.medium, color: tokens.colors.textSecondary, textAlign: 'center', paddingHorizontal: 40 },
  
  outOfZoneContainer: { flex: 1, backgroundColor: tokens.colors.background },
  whyThisText: { fontSize: 12, fontFamily: tokens.typography.family.bold, color: '#E11D48' },
  feeInfoCard: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 14,
    padding: 14,
    marginVertical: 10,
  },
  feeInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  feeInfoTitle: {
    fontSize: 14,
    fontFamily: tokens.typography.family.extrabold,
    color: '#18181B',
  },
  feeInfoBody: {
    fontSize: 12,
    fontFamily: tokens.typography.family.medium,
    color: '#52525B',
    lineHeight: 18,
  },
  feeStrikethroughText: {
    fontSize: 13,
    fontFamily: tokens.typography.family.medium,
    color: '#71717A',
  },
  outOfZoneBack: { position: 'absolute', top: 50, left: 20, zIndex: 10, width: 44, height: 44, borderRadius: 22, backgroundColor: tokens.colors.surface, alignItems: 'center', justifyContent: 'center', ...tokens.shadows.soft, },
  outOfZoneContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: tokens.spacing.xl },
  outOfZoneIconBox: { width: 80, height: 80, borderRadius: 40, backgroundColor: tokens.colors.dangerTint, alignItems: 'center', justifyContent: 'center', marginBottom: tokens.spacing.xl },
  outOfZoneTitle: { fontSize: 22, fontFamily: tokens.typography.family.black, color: tokens.colors.textPrimary, marginBottom: tokens.spacing.md },
  outOfZoneSub: { fontSize: 15, fontFamily: tokens.typography.family.medium, color: tokens.colors.textSecondary, textAlign: 'center', marginBottom: 32, lineHeight: 22 },
  outOfZoneChangeBtn: { backgroundColor: tokens.colors.primary, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 32, width: '100%', alignItems: 'center' },
  outOfZoneChangeBtnText: { fontSize: 16, fontFamily: tokens.typography.family.bold, color: tokens.colors.surface },
});
