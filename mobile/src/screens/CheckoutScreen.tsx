import { ArrowLeft, MapPin, CreditCard, ArrowRight, Sparkles, Clock, ShieldCheck, Heart, Banknote } from 'lucide-react-native';
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, StyleSheet } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { getSocket } from '../socket/client';
import { useSelector, useDispatch } from 'react-redux';
import { clearCart, setPromoCode as setPromoCodeAction } from '../store/slices/cartSlice';
import RazorpayCheckout from 'react-native-razorpay';
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import Animated, { FadeInDown, FadeIn, Layout, BounceInUp, useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

const PulseLoader = () => {
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(1);

  React.useEffect(() => {
    scale.value = withRepeat(withTiming(1.2, { duration: 1000 }), -1, true);
    opacity.value = withRepeat(withTiming(0.4, { duration: 1000 }), -1, true);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.pulseCircle, animatedStyle]}>
      <ShieldCheck size={48} color="#10B981" />
    </Animated.View>
  );
};

const CheckoutScreen = ({ navigation, route }: any) => {
  const queryClient = useQueryClient();
  const socket = getSocket();
  const dispatch = useDispatch();
  const cart = useSelector((state: any) => state.cart);
  const { user } = useSelector((state: any) => state.auth);

  const triggerHaptic = () => ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
  const triggerHapticHeavy = () => ReactNativeHapticFeedback.trigger("impactHeavy", hapticOptions);
  const triggerHapticSuccess = () => ReactNativeHapticFeedback.trigger("notificationSuccess", hapticOptions);

  React.useEffect(() => {
    if (socket) {
      const handleUpdate = () => {
        queryClient.invalidateQueries({ queryKey: ['pricing'] });
        queryClient.invalidateQueries({ queryKey: ['wallet'] });
        queryClient.invalidateQueries({ queryKey: ['loyalty'] });
      };
      socket.on('wallet_updated', handleUpdate);
      socket.on('loyalty_updated', handleUpdate);
      socket.on('subscription_updated', handleUpdate);
      return () => {
        socket.off('wallet_updated', handleUpdate);
        socket.off('loyalty_updated', handleUpdate);
        socket.off('subscription_updated', handleUpdate);
      };
    }
  }, [socket]);

  const [useWallet, setUseWallet] = useState(false);
  const [useLoyalty, setUseLoyalty] = useState(false);
  const [promoCode, setPromoCode] = useState(route.params?.promoCode || '');
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cod'>('online');
  const [riderTip, setRiderTip] = useState<number>(0);
  const [deliveryInstructions, setDeliveryInstructions] = useState(route.params?.instructions || '');
  
  const { data: pricing, isLoading: loadingPricing } = useQuery({
    queryKey: ['pricing', cart.items, useWallet, useLoyalty, promoCode, riderTip],
    queryFn: () => api.post('/payment/create-order', { 
        items: cart.items, 
        addressId: route.params?.addressId, 
        useWallet,
        useLoyalty,
        promoCode,
        riderTipPaise: riderTip * 100,
        instructions: deliveryInstructions,
        scheduledAt: route.params?.scheduledAt,
        dryRun: true 
    }),
  });

  const { data: addresses } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => api.get('/customers/addresses'),
  });

  const selectedAddress = addresses?.addresses?.find((a: any) => a.id === route.params?.addressId);

  const { data: loyaltyData } = useQuery({
    queryKey: ['loyalty'],
    queryFn: () => api.get('/customers/loyalty'),
  });

  const [isVerifying, setIsVerifying] = useState(false);

  const verifyOrder = async (orderId: string) => {
    setIsVerifying(true);
    let attempts = 0;
    const maxAttempts = 10;
    
    const interval = setInterval(async () => {
      attempts++;
      try {
        const res: any = await api.get(`/orders/${orderId}`);
        if (res.order?.status === 'confirmed' || res.order?.status === 'preparing') {
          clearInterval(interval);
          triggerHapticSuccess();
          setIsVerifying(false);
          dispatch(clearCart());
          queryClient.invalidateQueries({ queryKey: ['wallet'] });
          queryClient.invalidateQueries({ queryKey: ['loyalty'] });
          queryClient.invalidateQueries({ queryKey: ['order-history'] });
          navigation.navigate('OrderConfirmed', { orderId });
        }
      } catch (e) {
        console.log('Verification polling error:', e);
      }

      if (attempts >= maxAttempts) {
        clearInterval(interval);
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
        triggerHapticSuccess();
        dispatch(clearCart());
        navigation.navigate('OrderConfirmed', { orderId: res.orderId });
        return;
      }

      if (__DEV__ && !res.keyId) {
        api.post('/payment/mock-success', { razorpayOrderId: res.razorpayOrderId })
          .then(() => verifyOrder(res.orderId))
          .catch((err) => {
            Alert.alert('Mock Payment Failed', err.message);
          });
        return;
      }

      const options = {
        description: '2QT Food Order',
        image: 'https://2qt.app/logo.png',
        currency: 'INR',
        key: res.keyId,
        amount: res.amount,
        name: '2QT',
        order_id: res.razorpayOrderId,
        prefill: {
          email: user?.email || 'customer@2qt.app',
          contact: user?.phone || '',
          name: user?.name || 'Customer'
        },
        theme: { color: '#10B981' }
      };

      if (RazorpayCheckout && typeof RazorpayCheckout.open === 'function') {
        RazorpayCheckout.open(options)
          .then((data: any) => {
            verifyOrder(res.orderId);
          })
          .catch((error: any) => {
            Alert.alert('Payment Failed', error.description || 'Transaction cancelled');
          });
      } else {
        Alert.alert('Error', 'Payment gateway is not available on this device.');
      }
    },
    onError: (err: any) => {
      Alert.alert('Order Failed', err.message || 'Could not initiate payment');
    }
  });

  if (isVerifying) return (
    <View style={styles.verifyingContainer}>
      <PulseLoader />
      <Animated.Text entering={FadeInDown.delay(200)} style={styles.verifyingTitle}>Verifying Payment</Animated.Text>
      <Animated.Text entering={FadeInDown.delay(300)} style={styles.verifyingSub}>We are confirming your order with our kitchen. Please don't close the app.</Animated.Text>
    </View>
  );

  if (loadingPricing) return (
    <View style={styles.verifyingContainer}>
      <PulseLoader />
      <Animated.Text entering={FadeInDown.delay(200)} style={styles.verifyingTitle}>Calculating Total</Animated.Text>
      <Animated.Text entering={FadeInDown.delay(300)} style={styles.verifyingSub}>Please wait while we apply your discounts and loyalty points...</Animated.Text>
    </View>
  );

  const p = pricing?.pricing || { totalAmountPaise: 0, subtotalPaise: 0, deliveryFeePaise: 0, gstPaise: 0 };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView}>
        <View style={styles.scrollContent}>
          <Animated.View entering={FadeInDown.duration(400)}>
            <TouchableOpacity onPress={() => { triggerHaptic(); navigation.goBack(); }} style={styles.backButton}>
              <ArrowLeft size={24} color="#1A1A2E" />
            </TouchableOpacity>
            <Text style={styles.screenTitle}>Final Step</Text>
            <Text style={styles.screenSubTitle}>Review and Pay</Text>
          </Animated.View>

          {/* Delivery Address Summary */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.addressCard}>
            <View style={styles.addressHeader}>
              <View style={styles.addressIconWrapper}>
                <MapPin size={24} color="#10B981" />
              </View>
              <View style={styles.addressLabelCol}>
                <Text style={styles.addressSubLabel}>Delivering to</Text>
                <Text style={styles.addressLabel} numberOfLines={1}>{selectedAddress?.label || 'Selected Address'}</Text>
              </View>
            </View>
            <Text style={styles.addressText}>
              {selectedAddress?.address_text}, {selectedAddress?.landmark}
            </Text>
          </Animated.View>

          {/* Delivery & Notes Summary */}
          {(route.params?.scheduledAt) && (
            <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.metaInfoRow}>
              {route.params?.scheduledAt && (
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Schedule</Text>
                  <View style={styles.metaValueRow}>
                    <Clock size={12} color="#10B981" />
                    <Text style={styles.metaValue}>
                      {new Date(route.params.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              )}
            </Animated.View>
          )}

          {/* Delivery Instructions */}
          <Animated.View entering={FadeInDown.delay(160).duration(400)} style={styles.sectionCard}>
            <Text style={styles.sectionHeader}>Delivery Instructions</Text>
            <TextInput 
              placeholder="e.g. Leave at door, Don't ring bell..."
              placeholderTextColor="#9ca3af"
              value={deliveryInstructions}
              onChangeText={setDeliveryInstructions}
              style={styles.instructionsInput}
              multiline
            />
          </Animated.View>

          {/* Tip the Rider */}
          <Animated.View entering={FadeInDown.delay(180).duration(400)} style={styles.sectionCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Heart size={20} color="#10B981" style={{ marginRight: 8 }} />
              <Text style={styles.sectionHeader}>Tip your delivery partner</Text>
            </View>
            <Text style={styles.tipSub}>Your entire tip goes directly to the rider.</Text>
            <View style={styles.tipOptionsRow}>
              {[20, 50, 100].map((amt) => (
                <TouchableOpacity 
                  key={amt}
                  style={[styles.tipChip, riderTip === amt && styles.tipChipActive]}
                  onPress={() => {
                    triggerHaptic();
                    setRiderTip(riderTip === amt ? 0 : amt);
                  }}
                >
                  <Text style={[styles.tipChipText, riderTip === amt && styles.tipChipTextActive]}>
                    ₹{amt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>

          {/* Bill Details */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.billCard}>
            <Text style={styles.billHeader}>Bill Details</Text>
            
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Item Total</Text>
              <Text style={styles.billValue}>₹{p.subtotalPaise / 100}</Text>
            </View>
            
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Delivery Fee</Text>
              <Text style={styles.billValue}>₹{p.deliveryFeePaise / 100}</Text>
            </View>
            
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Taxes & Charges</Text>
              <Text style={styles.billValue}>₹{(p.cgstPaise + p.sgstPaise) / 100}</Text>
            </View>

            {riderTip > 0 && (
              <Animated.View entering={FadeInDown} style={styles.billRow}>
                <Text style={styles.billLabel}>Rider Tip</Text>
                <Text style={styles.billValue}>₹{riderTip}</Text>
              </Animated.View>
            )}

            {p.discountPaise > 0 && (
              <Animated.View entering={FadeInDown} style={styles.billRow}>
                <Text style={styles.discountText}>Promo Discount</Text>
                <Text style={styles.discountValue}>-₹{p.discountPaise / 100}</Text>
              </Animated.View>
            )}

            {p.loyaltyDiscountPaise > 0 && (
              <Animated.View entering={FadeInDown} style={styles.billRow}>
                <Text style={styles.loyaltyText}>Points Applied</Text>
                <Text style={styles.loyaltyValue}>-₹{p.loyaltyDiscountPaise / 100}</Text>
              </Animated.View>
            )}

            {p.walletDeductionPaise > 0 && (
              <Animated.View entering={FadeInDown} style={styles.billRow}>
                <Text style={styles.discountText}>Wallet Used</Text>
                <Text style={styles.discountValue}>-₹{p.walletDeductionPaise / 100}</Text>
              </Animated.View>
            )}

            {p.isSubscriptionOrder && (
              <Animated.View entering={FadeInDown} style={styles.subOrderBadge}>
                <View style={styles.subOrderBadgeLeft}>
                    <Sparkles size={14} color="#10B981" />
                    <Text style={styles.subOrderText}>Pro Meal Credit</Text>
                </View>
                <Text style={styles.subOrderValue}>-₹{p.subtotalPaise / 100}</Text>
              </Animated.View>
            )}

            <View style={styles.billDivider} />
            
            <View style={styles.billTotalRow}>
              <Text style={styles.billTotalLabel}>Total</Text>
              <Text style={styles.billTotalValue}>₹{p.gatewayAmountPaise / 100}</Text>
            </View>
          </Animated.View>

          {/* Wallet Toggle */}
          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
            <TouchableOpacity 
              onPress={() => { triggerHaptic(); setUseWallet(!useWallet); }}
              activeOpacity={0.8}
              style={[styles.toggleCard, useWallet ? styles.toggleCardActive : styles.toggleCardInactive]}
            >
              <View style={styles.toggleCardLeft}>
                <View style={styles.toggleIconWrapper}>
                  <CreditCard size={24} color="#1A1A2E" />
                </View>
                <View>
                  <Text style={styles.toggleTitle}>2QT Wallet</Text>
                  <Text style={styles.toggleSub}>Bal: ₹{pricing?.availableWallet / 100 || 0}</Text>
                </View>
              </View>
              <View style={[styles.switchTrack, { backgroundColor: useWallet ? '#10B981' : '#e5e7eb' }]}>
                <View style={[styles.switchThumb, { alignSelf: useWallet ? 'flex-end' : 'flex-start' }]} />
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* Loyalty Toggle */}
          <Animated.View entering={FadeInDown.delay(350).duration(400)}>
            <TouchableOpacity 
              onPress={() => { triggerHaptic(); setUseLoyalty(!useLoyalty); }}
              activeOpacity={0.8}
              disabled={!loyaltyData?.points}
              style={[styles.toggleCard, useLoyalty ? styles.toggleCardActive : styles.toggleCardInactive, !loyaltyData?.points && { opacity: 0.5 }]}
            >
              <View style={styles.toggleCardLeft}>
                <View style={styles.toggleIconWrapper}>
                  <Sparkles size={24} color={useLoyalty ? "#10B981" : "#1A1A2E"} />
                </View>
                <View>
                  <Text style={styles.toggleTitle}>2QT Points</Text>
                  <Text style={styles.toggleSub}>Bal: {loyaltyData?.points || 0} pts</Text>
                </View>
              </View>
              <View style={[styles.switchTrack, { backgroundColor: useLoyalty ? '#10B981' : '#e5e7eb' }]}>
                <View style={[styles.switchThumb, { alignSelf: useLoyalty ? 'flex-end' : 'flex-start' }]} />
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* Promo Code */}
          <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.promoCard}>
            <View style={styles.promoInputWrapper}>
              <TextInput 
                placeholder="PROMO CODE" 
                placeholderTextColor="#A0A0A0"
                value={promoCode}
                onChangeText={setPromoCode}
                style={styles.promoInput}
              />
            </View>
            <TouchableOpacity 
              style={styles.promoApplyBtn}
              onPress={() => {
                triggerHapticHeavy();
                if (promoCode.toUpperCase() === '2QT50') {
                  dispatch(setPromoCodeAction(promoCode.toUpperCase()));
                  Alert.alert('Success', 'Promo code applied! You get 50% off.');
                } else {
                  Alert.alert('Invalid Code', 'Try 2QT50 for a discount.');
                }
              }} 
            >
              <Text style={styles.promoApplyText}>Apply</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Payment Method Selector */}
          <Animated.View entering={FadeInDown.delay(450).duration(400)}>
            <Text style={styles.sectionTitle}>Payment Method</Text>
            
            <TouchableOpacity 
              activeOpacity={0.8}
              onPress={() => { triggerHaptic(); setPaymentMethod('online'); }}
              style={[styles.paymentMethodBtn, paymentMethod === 'online' ? styles.paymentMethodBtnActive : styles.paymentMethodBtnInactive]}
            >
              <View style={styles.paymentMethodLeft}>
                <View style={styles.paymentMethodIconWrapper}>
                  <CreditCard size={20} color={paymentMethod === 'online' ? '#10B981' : '#1A1A2E'} />
                </View>
                <Text style={[styles.paymentMethodText, paymentMethod === 'online' ? styles.paymentMethodTextActive : styles.paymentMethodTextInactive]}>Pay Online (UPI/Cards)</Text>
              </View>
              <View style={[styles.radioOuter, { borderColor: paymentMethod === 'online' ? '#10B981' : '#d1d5db' }]}>
                {paymentMethod === 'online' && <Animated.View entering={FadeIn} style={styles.radioInner} />}
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              activeOpacity={0.8}
              onPress={() => { triggerHaptic(); setPaymentMethod('cod'); }}
              style={[styles.paymentMethodBtn, paymentMethod === 'cod' ? styles.paymentMethodBtnActive : styles.paymentMethodBtnInactive, { marginBottom: 120 }]}
            >
              <View style={styles.paymentMethodLeft}>
                  <Banknote size={24} color="#10B981" />
                <Text style={[styles.paymentMethodText, paymentMethod === 'cod' ? styles.paymentMethodTextActive : styles.paymentMethodTextInactive]}>Cash on Delivery</Text>
              </View>
              <View style={[styles.radioOuter, { borderColor: paymentMethod === 'cod' ? '#10B981' : '#d1d5db' }]}>
                {paymentMethod === 'cod' && <Animated.View entering={FadeIn} style={styles.radioInner} />}
              </View>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </ScrollView>

      {/* Final Action Button */}
      <Animated.View entering={BounceInUp.duration(600).delay(500)} style={styles.footer}>
        <TouchableOpacity 
          onPress={() => {
            triggerHapticHeavy();
            placeOrderMutation.mutate({ 
              items: cart.items, 
              addressId: route.params?.addressId, 
              useWallet,
              useLoyalty,
              promoCode,
              paymentMethod,
              scheduledAt: route.params?.scheduledAt,
              instructions: route.params?.instructions
            });
          }}
          disabled={placeOrderMutation.isPending}
          style={styles.payButton}
        >
          <View>
            <Text style={styles.payButtonSub}>Secure Checkout</Text>
            <Text style={styles.payButtonMain}>Pay ₹{p.gatewayAmountPaise / 100}</Text>
          </View>
          {placeOrderMutation.isPending ? (
            <ActivityIndicator color="white" />
          ) : (
            <View style={styles.payArrowWrapper}>
              <ArrowRight size={24} color="white" />
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  pulseCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(16, 185, 129, 0.1)', alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 64, paddingBottom: 32 },
  backButton: { marginBottom: 32, alignSelf: 'flex-start', width: 48, height: 48, backgroundColor: '#FFFFFF', borderRadius: 24, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 8, elevation: 2 },
  screenTitle: { color: '#1A1A2E', fontSize: 32, fontWeight: '900', marginBottom: 8, letterSpacing: -0.5 },
  screenSubTitle: { color: '#9ca3af', fontWeight: '900', marginBottom: 40, textTransform: 'uppercase', letterSpacing: 1.5, fontSize: 11 },
  addressCard: { backgroundColor: '#FFFFFF', padding: 24, borderRadius: 24, marginBottom: 24, borderWidth: 1, borderColor: '#F3F4F6', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 8, elevation: 2 },
  addressHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  addressIconWrapper: { width: 40, height: 40, backgroundColor: '#ECFDF5', borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  addressLabelCol: { flex: 1 },
  addressSubLabel: { color: '#9ca3af', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2 },
  addressLabel: { color: '#1A1A2E', fontWeight: '900', fontSize: 15 },
  addressText: { color: '#6b7280', fontWeight: '500', fontSize: 14, lineHeight: 20 },
  metaInfoRow: { backgroundColor: '#FFFFFF', padding: 24, borderRadius: 24, marginBottom: 24, borderWidth: 1, borderColor: '#F3F4F6', flexDirection: 'row', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 8, elevation: 2 },
  metaItem: { flex: 1 },
  metaLabel: { color: '#9ca3af', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 },
  metaValueRow: { flexDirection: 'row', alignItems: 'center' },
  metaValue: { fontSize: 13, fontWeight: 'bold', color: '#1A1A2E', marginLeft: 6 },
  sectionCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, marginBottom: 16, borderWidth: 1, borderColor: '#F3F4F6', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 8, elevation: 2 },
  sectionHeader: { fontSize: 16, fontWeight: '900', color: '#1A1A2E', marginBottom: 12 },
  instructionsInput: { backgroundColor: '#F9FAFB', borderRadius: 16, padding: 16, minHeight: 80, textAlignVertical: 'top', color: '#1A1A2E', fontWeight: '500' },
  tipSub: { fontSize: 12, color: '#9ca3af', marginBottom: 16 },
  tipOptionsRow: { flexDirection: 'row', gap: 12 },
  tipChip: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, borderWidth: 1, borderColor: '#F3F4F6', backgroundColor: '#FFFFFF' },
  tipChipActive: { backgroundColor: '#10B981', borderColor: '#10B981' },
  tipChipText: { color: '#1A1A2E', fontWeight: 'bold', fontSize: 14 },
  tipChipTextActive: { color: '#fff' },
  billCard: { backgroundColor: '#FFFFFF', padding: 24, borderRadius: 24, marginBottom: 24, borderWidth: 1, borderColor: '#F3F4F6', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 8, elevation: 2 },
  billHeader: { color: '#9CA3AF', fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2, fontSize: 10, marginBottom: 24 },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  billLabel: { color: '#6B7280', fontWeight: '700' },
  billValue: { color: '#1A1A2E', fontWeight: '900' },
  discountText: { color: '#10B981', fontWeight: '700' },
  discountValue: { color: '#10B981', fontWeight: '900' },
  loyaltyText: { color: '#10B981', fontWeight: '700' },
  loyaltyValue: { color: '#10B981', fontWeight: '900' },
  subOrderBadge: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, backgroundColor: '#ECFDF5', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#D1FAE5' },
  subOrderBadgeLeft: { flexDirection: 'row', alignItems: 'center' },
  subOrderText: { color: '#10B981', fontWeight: '700', marginLeft: 8 },
  subOrderValue: { color: '#10B981', fontWeight: '900' },
  billDivider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 16, borderStyle: 'dashed' },
  billTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 },
  billTotalLabel: { color: '#1A1A2E', fontSize: 16, fontWeight: '900' },
  billTotalValue: { color: '#1A1A2E', fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  toggleCard: { backgroundColor: '#FFFFFF', padding: 24, borderRadius: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: '#F3F4F6', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 8, elevation: 2 },
  toggleCardActive: { backgroundColor: '#ECFDF5', borderColor: '#10B981' },
  toggleCardInactive: { backgroundColor: '#FFFFFF', borderColor: '#F3F4F6' },
  toggleCardLeft: { flexDirection: 'row', alignItems: 'center' },
  toggleIconWrapper: { width: 48, height: 48, backgroundColor: '#F9FAFB', borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  toggleTitle: { color: '#1A1A2E', fontWeight: '900' },
  toggleSub: { color: '#9ca3af', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginTop: 4 },
  switchTrack: { width: 56, height: 28, borderRadius: 14, paddingHorizontal: 4, justifyContent: 'center' },
  switchThumb: { width: 20, height: 20, backgroundColor: '#fff', borderRadius: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },
  promoCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F3F4F6', padding: 6, borderRadius: 24, flexDirection: 'row', alignItems: 'center', marginBottom: 32, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 8, elevation: 2 },
  promoInputWrapper: { flex: 1, paddingHorizontal: 20 },
  promoInput: { fontWeight: '900', color: '#1A1A2E', fontSize: 12, textTransform: 'uppercase', letterSpacing: 2 },
  promoApplyBtn: { backgroundColor: '#1A1A2E', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 20 },
  promoApplyText: { color: '#fff', fontWeight: '900', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  sectionTitle: { color: '#9ca3af', fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2, fontSize: 10, marginBottom: 20, marginLeft: 8 },
  paymentMethodBtn: { padding: 20, borderRadius: 24, marginBottom: 16, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 8, elevation: 2 },
  paymentMethodBtnActive: { backgroundColor: '#ECFDF5', borderColor: '#10B981' },
  paymentMethodBtnInactive: { backgroundColor: '#FFFFFF', borderColor: '#F3F4F6' },
  paymentMethodLeft: { flexDirection: 'row', alignItems: 'center' },
  paymentMethodIconWrapper: { width: 48, height: 48, backgroundColor: '#F9FAFB', borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  codEmoji: { fontSize: 20 },
  paymentMethodText: { fontWeight: '900', fontSize: 15 },
  paymentMethodTextActive: { color: '#10B981' },
  paymentMethodTextInactive: { color: '#1A1A2E' },
  radioOuter: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 12, height: 12, backgroundColor: '#10B981', borderRadius: 6 },
  footer: { position: 'absolute', bottom: 40, left: 24, right: 24 },
  payButton: { height: 72, backgroundColor: '#10B981', borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 32, shadowColor: '#10B981', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 8 },
  payButtonSub: { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2 },
  payButtonMain: { color: '#fff', fontSize: 20, fontWeight: '900' },
  payArrowWrapper: { width: 40, height: 40, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  loadingContainer: { flex: 1, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 16, color: '#9ca3af', fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2, fontSize: 10 },
  verifyingContainer: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, zIndex: 1000 },
  verifyingTitle: { marginTop: 32, color: '#1A1A2E', fontSize: 24, fontWeight: '900', textAlign: 'center' },
  verifyingSub: { marginTop: 8, color: '#9ca3af', fontWeight: '600', textAlign: 'center', lineHeight: 22 },
});

export default CheckoutScreen;
