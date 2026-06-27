import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, StyleSheet, AppState } from 'react-native';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api } from '../api/client';
import { getSocket } from '../socket/client';
import { useSelector, useDispatch } from 'react-redux';
import { clearCart, setPromoCode as setPromoCodeAction } from '../store/slices/cartSlice';
import RazorpayCheckout from 'react-native-razorpay';
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import Animated, { FadeInDown, FadeIn, SlideInDown, useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSpring, interpolateColor } from 'react-native-reanimated';
import { ArrowLeft, MapPin, CreditCard, Sparkles, Clock, ShieldCheck, Heart, Banknote, Ticket, ChevronRight, UserRound, Phone, CheckCircle2, Landmark } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

const triggerHaptic = (type = 'impactLight') => ReactNativeHapticFeedback.trigger(type as any, hapticOptions);

// Custom Premium Toggle Component
const Toggle = ({ value, onValueChange, activeColor = '#1B5E46' }: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  activeColor?: string;
}) => {
  const progress = useSharedValue(value ? 1 : 0);

  React.useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: 200 });
  }, [value]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ['#E6E2DA', activeColor]),
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withTiming(value ? 18 : 2, { duration: 200 }) }],
  }));

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={() => { triggerHaptic('impactLight'); onValueChange(!value); }}>
      <Animated.View style={[toggleStyles.track, trackStyle]}>
        <Animated.View style={[toggleStyles.thumb, thumbStyle]} />
      </Animated.View>
    </TouchableOpacity>
  );
};

const toggleStyles = StyleSheet.create({
  track: {
    width: 42, height: 24, borderRadius: 12,
    justifyContent: 'center',
  },
  thumb: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
});

// Premium Bouncing Button for the Pay Action
const BouncingButton = ({ onPress, style, children, disabled = false }: any) => {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

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
        onPressOut={() => {
          if (!disabled) {
            scale.value = withSpring(1, { damping: 10, stiffness: 400 });
          }
        }}
        onPress={() => {
          if (!disabled) onPress();
        }}
        style={StyleSheet.absoluteFill}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
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
      <ShieldCheck size={48} color="#1B5E46" />
    </Animated.View>
  );
};

// UPI Circular Icon Custom Renderer
const UPIIcon = ({ type }: { type: 'gpay' | 'phonepe' | 'paytm' | 'other_upi' }) => {
  if (type === 'phonepe') {
    return (
      <View style={[styles.upiIconBase, { backgroundColor: '#5F259F' }]}>
        <Text style={styles.phonepeText}>Pe</Text>
      </View>
    );
  }
  if (type === 'paytm') {
    return (
      <View style={[styles.upiIconBase, { backgroundColor: '#00B9F1' }]}>
        <Text style={styles.paytmText}>paytm</Text>
      </View>
    );
  }
  if (type === 'gpay') {
    return (
      <View style={[styles.upiIconBase, { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E6E2DA' }]}>
        <View style={styles.gpayRow}>
          <Text style={{ color: '#4285F4', fontSize: 13, fontFamily: fontFamily.black }}>G</Text>
          <Text style={{ color: '#EA4335', fontSize: 13, fontFamily: fontFamily.black }}>p</Text>
          <Text style={{ color: '#FBBC05', fontSize: 13, fontFamily: fontFamily.black }}>a</Text>
          <Text style={{ color: '#34A853', fontSize: 13, fontFamily: fontFamily.black }}>y</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.upiIconBase, { backgroundColor: '#F3F0EA', borderWidth: 1, borderColor: '#E6E2DA' }]}>
      <Text style={styles.otherUpiText}>UPI</Text>
    </View>
  );
};

const CheckoutScreen = ({ navigation, route }: any) => {
  const queryClient = useQueryClient();
  const socket = getSocket();
  const dispatch = useDispatch();
  const cart = useSelector((state: any) => state.cart);
  const { user } = useSelector((state: any) => state.auth);
  const appState = useRef(AppState.currentState);

  // Refetch offers + pricing when app comes back to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        queryClient.invalidateQueries({ queryKey: ['pricing'] });
        queryClient.invalidateQueries({ queryKey: ['active-promos'] });
        queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [queryClient]);

  useEffect(() => {
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
  
  // Read order configuration from CartScreen via route.params
  const promoCode = route.params?.promoCode || '';
  const riderTip = route.params?.riderTip || 0;
  const deliveryInstructions = route.params?.instructions || '';
  const altReceiver = route.params?.altReceiver || false;
  const altName = route.params?.altName || '';
  const altPhone = route.params?.altPhone || '';

  // Payment Options sub-method state
  const [paymentSubMethod, setPaymentSubMethod] = useState<'gpay' | 'phonepe' | 'paytm' | 'other_upi' | 'card' | 'pluxee' | 'netbanking' | 'cod'>('gpay');

  const { data: addresses, isLoading: loadingAddresses } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => api.get('/customers/addresses'),
  });

  const selectedAddress = addresses?.addresses?.find((a: any) => a.id === route.params?.addressId);
  const isOutOfZone = !!selectedAddress && !selectedAddress.is_serviceable;

  const { data: pricing, isPending: loadingPricing, isFetching } = useQuery({
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
    enabled: !loadingAddresses && !isOutOfZone,
    placeholderData: keepPreviousData,
  });

  const { data: loyaltyData } = useQuery({
    queryKey: ['loyalty'],
    queryFn: () => api.get('/customers/loyalty'),
  });

  const [isVerifying, setIsVerifying] = useState(false);

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
          navigation.navigate('OrderPlaced', { orderId, displayId: res.order?.display_id });
          return;
        }
      } catch (e) {
        console.log('Verification polling error:', e);
      }

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
        navigation.navigate('OrderPlaced', { orderId: res.orderId, displayId: res.displayId });
        return;
      }

      if (!res.keyId) {
        Alert.alert('Payment Not Configured', 'Razorpay is not set up on the server. Please contact support.');
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
        prefill: {
          email: user?.email || 'customer@2qt.app',
          contact: user?.phone || '',
          name: user?.name || 'Customer'
        },
        theme: { color: '#1B5E46' }
      };

      // Force specific UPI apps via Razorpay's hidden intent flags
      if (paymentSubMethod === 'gpay' || paymentSubMethod === 'phonepe' || paymentSubMethod === 'paytm') {
        options.prefill = options.prefill || {};
        options.prefill.method = 'upi';
        options['_[flow]'] = 'intent';
        
        if (paymentSubMethod === 'gpay') {
          options.upi_app_package_name = 'com.google.android.apps.nbu.paisa.user';
        } else if (paymentSubMethod === 'phonepe') {
          options.upi_app_package_name = 'com.phonepe.app';
        } else if (paymentSubMethod === 'paytm') {
          options.upi_app_package_name = 'net.one97.paytm';
        }
      }

      if (RazorpayCheckout && typeof RazorpayCheckout.open === 'function') {
        RazorpayCheckout.open(options)
          .then((data: any) => {
            api.post('/payment/verify-payment', {
              razorpay_order_id: data.razorpay_order_id,
              razorpay_payment_id: data.razorpay_payment_id,
              razorpay_signature: data.razorpay_signature,
              type: 'order'
            }).then(() => {
              verifyOrder(res.orderId);
            }).catch(() => {
              verifyOrder(res.orderId); // fallback
            });
          })
          .catch((error: any) => {
            let msg = 'Transaction cancelled';
            try {
              // Sometimes Razorpay returns the error as a JSON string or an object with a JSON string in description
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
      <Animated.Text entering={FadeInDown.delay(300)} style={styles.verifyingSub}>Confirming your order with our kitchen. Please wait...</Animated.Text>
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
        <ArrowLeft size={24} color="#1A1F1C" />
      </TouchableOpacity>
      <Animated.View entering={FadeInDown.duration(400)} style={styles.outOfZoneContent}>
        <View style={styles.outOfZoneIconBox}>
          <MapPin size={48} color={colors.danger} />
        </View>
        <Text style={styles.outOfZoneTitle}>Out of delivery zone</Text>
        <Text style={styles.outOfZoneSub}>
          <Text style={{ fontWeight: '800' }}>{selectedAddress?.label || 'Your address'}</Text>
          {' '}is outside our current delivery area. Pick a different address to continue.
        </Text>
        <TouchableOpacity
          style={styles.outOfZoneChangeBtn}
          onPress={() => navigation.navigate('Address')}
        >
          <MapPin size={18} color="#FFFFFF" />
          <Text style={styles.outOfZoneChangeBtnText}>Change Delivery Address</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.outOfZoneBackLink}>
          <Text style={styles.outOfZoneBackLinkText}>Back to Cart</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );

  if (loadingPricing && !pricing) return (
    <View style={styles.verifyingContainer}>
      <PulseLoader />
      <Animated.Text entering={FadeInDown.delay(200)} style={styles.verifyingTitle}>Calculating Total</Animated.Text>
      <Animated.Text entering={FadeInDown.delay(300)} style={styles.verifyingSub}>Applying your discounts and loyalty points...</Animated.Text>
    </View>
  );

  const p = pricing?.pricing || { totalAmountPaise: 0, subtotalPaise: 0, deliveryFeePaise: 0, gstPaise: 0, cgstPaise: 0, sgstPaise: 0, discountPaise: 0, loyaltyDiscountPaise: 0, walletDeductionPaise: 0, gatewayAmountPaise: 0 };
  const payMethod = paymentSubMethod === 'cod' ? 'cod' : 'online';

  const handlePlaceOrder = () => {
    if (altReceiver) {
      if (!altName.trim()) {
        Alert.alert('Required Field', 'Please enter the receiver\'s name.');
        return;
      }
      if (altPhone.trim().length < 10) {
        Alert.alert('Required Field', 'Please enter a valid 10-digit phone number.');
        return;
      }
    }

    triggerHaptic('impactHeavy');
    placeOrderMutation.mutate({
      items: cart.items,
      addressId: route.params?.addressId,
      useWallet,
      useLoyalty,
      promoCode,
      paymentMethod: payMethod,
      riderTipPaise: riderTip * 100,
      scheduledAt: route.params?.scheduledAt,
      instructions: deliveryInstructions,
      deliveryContactName: altReceiver && altName.trim() ? altName.trim() : undefined,
      deliveryContactPhone: altReceiver && altPhone.trim() ? altPhone.trim() : undefined,
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { triggerHaptic('impactLight'); navigation.goBack(); }} style={styles.backButton}>
          <ArrowLeft size={24} color="#1A1F1C" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Payment Option</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        
        {/* Coupons & Deductions Card */}
        <Animated.View entering={FadeInDown.delay(160).duration(400)} style={styles.premiumCard}>
          <Text style={styles.cardHeaderTitle}>Wallet & Loyalty Deductions</Text>

          {/* Wallet Toggle */}
          <TouchableOpacity 
            onPress={() => { triggerHaptic('impactMedium'); setUseWallet(!useWallet); }}
            activeOpacity={0.8}
            style={[styles.toggleRowItem, useWallet && styles.toggleRowItemActive]}
          >
            <View style={styles.toggleItemLeft}>
              <View style={[styles.toggleIconBox, useWallet && { backgroundColor: '#1B5E46' }]}>
                <CreditCard size={18} color={useWallet ? "#fff" : "#1B5E46"} />
              </View>
              <View>
                <Text style={styles.toggleItemTitle}>Pay from Wallet</Text>
                <Text style={styles.toggleItemSub}>Available Balance: ₹{pricing?.availableWallet / 100 || 0}</Text>
              </View>
            </View>
            <View style={[styles.customCheckbox, useWallet && styles.customCheckboxActive]}>
              {useWallet && <View style={styles.customCheckboxInner} />}
            </View>
          </TouchableOpacity>

          {/* Loyalty Toggle */}
          <TouchableOpacity 
            onPress={() => { triggerHaptic('impactMedium'); setUseLoyalty(!useLoyalty); }}
            activeOpacity={0.8}
            disabled={!loyaltyData?.points}
            style={[styles.toggleRowItem, useLoyalty && styles.toggleRowItemActive, !loyaltyData?.points && { opacity: 0.5 }]}
          >
            <View style={styles.toggleItemLeft}>
              <View style={[styles.toggleIconBox, useLoyalty && { backgroundColor: '#D97B4F' }]}>
                <Sparkles size={18} color={useLoyalty ? "#fff" : "#D97B4F"} />
              </View>
              <View>
                <Text style={styles.toggleItemTitle}>Redeem 2QT Points</Text>
                <Text style={styles.toggleItemSub}>Balance: {loyaltyData?.points || 0} pts</Text>
              </View>
            </View>
            <View style={[styles.customCheckbox, useLoyalty && { borderColor: '#D97B4F' }]}>
              {useLoyalty && <View style={[styles.customCheckboxInner, { backgroundColor: '#D97B4F' }]} />}
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Select Payment Mode Title */}
        <Text style={styles.sectionHeaderTitle}>Select Payment Method</Text>

        {/* UPI Apps Horizontal Row */}
        <Animated.View entering={FadeInDown.delay(180).duration(400)} style={styles.premiumCard}>
          <Text style={styles.subSectionTitle}>UPI Apps</Text>
          <View style={styles.upiAppsRow}>
            {(['gpay', 'phonepe', 'paytm', 'other_upi'] as const).map((type) => (
              <TouchableOpacity
                key={type}
                activeOpacity={0.8}
                onPress={() => {
                  triggerHaptic('selection');
                  setPaymentSubMethod(type);
                }}
                style={[
                  styles.upiAppContainer,
                  paymentSubMethod === type && styles.upiAppContainerActive
                ]}
              >
                <View style={styles.upiIconWrapper}>
                  <UPIIcon type={type} />
                  {paymentSubMethod === type && (
                    <View style={styles.upiCheckedBadge}>
                      <CheckCircle2 size={12} color="#fff" fill="#1B5E46" />
                    </View>
                  )}
                </View>
                <Text style={[styles.upiAppName, paymentSubMethod === type && styles.upiAppNameActive]}>
                  {type === 'gpay' ? 'GPay' : type === 'phonepe' ? 'PhonePe' : type === 'paytm' ? 'Paytm' : 'Other UPI'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* Other Payment Methods List */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          
          {/* Cards Option */}
          <TouchableOpacity 
            activeOpacity={0.9}
            onPress={() => { triggerHaptic('selection'); setPaymentSubMethod('card'); }}
            style={[styles.paymentRowItem, paymentSubMethod === 'card' && styles.paymentRowItemActive]}
          >
            <View style={styles.paymentRowItemLeft}>
              <View style={[styles.paymentItemIconBox, paymentSubMethod === 'card' && { backgroundColor: '#E8F2EC' }]}>
                <CreditCard size={20} color={paymentSubMethod === 'card' ? '#1B5E46' : '#6B7570'} />
              </View>
              <View>
                <Text style={[styles.paymentItemTitle, paymentSubMethod === 'card' && styles.paymentItemTitleActive]}>Credit or Debit Cards</Text>
                <Text style={styles.paymentItemSub}>Visa, Mastercard, RuPay, Maestro</Text>
              </View>
            </View>
            <View style={[styles.radioOuter, paymentSubMethod === 'card' && styles.radioOuterActive]}>
              {paymentSubMethod === 'card' && <Animated.View entering={FadeIn} style={styles.radioInner} />}
            </View>
          </TouchableOpacity>

          {/* Net Banking Option */}
          <TouchableOpacity 
            activeOpacity={0.9}
            onPress={() => { triggerHaptic('selection'); setPaymentSubMethod('netbanking'); }}
            style={[styles.paymentRowItem, paymentSubMethod === 'netbanking' && styles.paymentRowItemActive]}
          >
            <View style={styles.paymentRowItemLeft}>
              <View style={[styles.paymentItemIconBox, paymentSubMethod === 'netbanking' && { backgroundColor: '#E8F2EC' }]}>
                <Landmark size={20} color={paymentSubMethod === 'netbanking' ? '#1B5E46' : '#6B7570'} />
              </View>
              <View>
                <Text style={[styles.paymentItemTitle, paymentSubMethod === 'netbanking' && styles.paymentItemTitleActive]}>Net Banking</Text>
                <Text style={styles.paymentItemSub}>All Indian banks supported</Text>
              </View>
            </View>
            <View style={[styles.radioOuter, paymentSubMethod === 'netbanking' && styles.radioOuterActive]}>
              {paymentSubMethod === 'netbanking' && <Animated.View entering={FadeIn} style={styles.radioInner} />}
            </View>
          </TouchableOpacity>

          {/* Pluxee / Sodexo Option */}
          <TouchableOpacity 
            activeOpacity={0.9}
            onPress={() => { triggerHaptic('selection'); setPaymentSubMethod('pluxee'); }}
            style={[styles.paymentRowItem, paymentSubMethod === 'pluxee' && styles.paymentRowItemActive]}
          >
            <View style={styles.paymentRowItemLeft}>
              <View style={[styles.paymentItemIconBox, paymentSubMethod === 'pluxee' && { backgroundColor: '#E8F2EC' }]}>
                <Ticket size={20} color={paymentSubMethod === 'pluxee' ? '#1B5E46' : '#6B7570'} />
              </View>
              <View>
                <Text style={[styles.paymentItemTitle, paymentSubMethod === 'pluxee' && styles.paymentItemTitleActive]}>Pluxee / Sodexo meal card</Text>
                <Text style={styles.paymentItemSub}>Pay using meal vouchers</Text>
              </View>
            </View>
            <View style={[styles.radioOuter, paymentSubMethod === 'pluxee' && styles.radioOuterActive]}>
              {paymentSubMethod === 'pluxee' && <Animated.View entering={FadeIn} style={styles.radioInner} />}
            </View>
          </TouchableOpacity>

          {/* Cash on Delivery Option */}
          <TouchableOpacity 
            activeOpacity={0.9}
            onPress={() => { triggerHaptic('selection'); setPaymentSubMethod('cod'); }}
            style={[styles.paymentRowItem, paymentSubMethod === 'cod' && styles.paymentRowItemActive, { marginBottom: 20 }]}
          >
            <View style={styles.paymentRowItemLeft}>
              <View style={[styles.paymentItemIconBox, paymentSubMethod === 'cod' && { backgroundColor: '#E8F2EC' }]}>
                <Banknote size={20} color={paymentSubMethod === 'cod' ? '#1B5E46' : '#6B7570'} />
              </View>
              <View>
                <Text style={[styles.paymentItemTitle, paymentSubMethod === 'cod' && styles.paymentItemTitleActive]}>Cash on Delivery (Pay on Delivery)</Text>
                <Text style={styles.paymentItemSub}>Pay cash or scan QR at your doorstep</Text>
              </View>
            </View>
            <View style={[styles.radioOuter, paymentSubMethod === 'cod' && styles.radioOuterActive]}>
              {paymentSubMethod === 'cod' && <Animated.View entering={FadeIn} style={styles.radioInner} />}
            </View>
          </TouchableOpacity>

        </Animated.View>

        {/* Bill Details */}
        <Animated.View entering={FadeInDown.delay(220).duration(400)} style={styles.billCard}>
          <Text style={styles.cardHeaderTitle}>Bill Details</Text>
          
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Item Total</Text>
            <Text style={styles.billValue}>₹{p.subtotalPaise / 100}</Text>
          </View>
          
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Delivery Fee</Text>
            {p.deliveryFeePaise === 0 ? (
              <Text style={[styles.billValue, { color: '#22C55E', fontWeight: '800' }]}>Free</Text>
            ) : (
              <Text style={styles.billValue}>₹{p.deliveryFeePaise / 100}</Text>
            )}
          </View>
          
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Taxes & Charges</Text>
            <Text style={styles.billValue}>₹{((p.cgstPaise || 0) + (p.sgstPaise || 0)) / 100}</Text>
          </View>

          {riderTip > 0 && (
            <Animated.View entering={FadeInDown} style={styles.billRow}>
              <Text style={styles.billLabel}>Rider Tip</Text>
              <Text style={styles.billValue}>₹{riderTip}</Text>
            </Animated.View>
          )}

          {p.discountPaise > 0 && (
            <Animated.View entering={FadeInDown} style={styles.billRowHighlight}>
              <Text style={styles.discountText}>Promo Discount</Text>
              <Text style={styles.discountValue}>-₹{p.discountPaise / 100}</Text>
            </Animated.View>
          )}

          {p.loyaltyDiscountPaise > 0 && (
            <Animated.View entering={FadeInDown} style={styles.billRowHighlight}>
              <Text style={styles.loyaltyText}>Points Applied</Text>
              <Text style={styles.loyaltyValue}>-₹{p.loyaltyDiscountPaise / 100}</Text>
            </Animated.View>
          )}

          {p.walletDeductionPaise > 0 && (
            <Animated.View entering={FadeInDown} style={styles.billRowHighlight}>
              <Text style={styles.discountText}>Wallet Used</Text>
              <Text style={styles.discountValue}>-₹{p.walletDeductionPaise / 100}</Text>
            </Animated.View>
          )}

          <View style={styles.billDividerDashed} />
          
          <View style={styles.billTotalRow}>
            <Text style={styles.billTotalLabel}>Grand Total</Text>
            <Text style={styles.billTotalValue}>₹{p.gatewayAmountPaise / 100}</Text>
          </View>
        </Animated.View>

      </ScrollView>

      {/* Sticky Full-Width Footer */}
      <Animated.View entering={SlideInDown.duration(400).delay(100)} style={styles.stickyFooter}>
        <BouncingButton 
          style={styles.premiumPayBtn}
          disabled={placeOrderMutation.isPending || isFetching}
          onPress={handlePlaceOrder}
        >
          <View style={styles.premiumPayBtnContent}>
            <View>
              <Text style={styles.payBtnGrandTotal}>₹{p.gatewayAmountPaise / 100}</Text>
              <Text style={styles.payBtnSubText}>TOTAL TO PAY</Text>
            </View>
            
            <View style={styles.payBtnActionRow}>
              {placeOrderMutation.isPending || isFetching ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Text style={styles.payBtnActionText}>
                    {p.gatewayAmountPaise <= 0 ? 'Place Order' : paymentSubMethod === 'cod' ? 'Place Order (COD)' : 'Proceed to Pay'}
                  </Text>
                  <View style={styles.payBtnIconWrapper}>
                    <ChevronRight size={20} color="#1B5E46" />
                  </View>
                </>
              )}
            </View>
          </View>
        </BouncingButton>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  pulseCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(27, 94, 70, 0.08)', alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: '#F7F8FA' }, // Off-white premium background
  header: {
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#F7F8FA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  headerTitle: {
    color: colors.ink,
    fontSize: 17,
    fontFamily: fontFamily.black,
    letterSpacing: 0.5,
  },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 150 }, 
  
  premiumCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 3,
  },
  cardHeaderTitle: {
    fontSize: 16,
    fontFamily: fontFamily.black,
    color: colors.ink,
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  cardHeaderTitleInline: {
    fontSize: 15,
    fontFamily: fontFamily.black,
    color: colors.ink,
    letterSpacing: -0.2,
  },
  
  addressHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  addressIconCircle: { width: 48, height: 48, backgroundColor: '#F0FDF4', borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  sectionSubtitle: { color: colors.inkMuted, fontSize: 11, fontFamily: fontFamily.bold, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 },
  addressLabel: { color: colors.ink, fontFamily: fontFamily.black, fontSize: 17, letterSpacing: -0.2 },
  addressText: { color: colors.inkMuted, fontSize: 13, lineHeight: 20, fontFamily: fontFamily.medium, marginTop: 4 },
  editBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#F0FDF4', borderRadius: 12 },
  editBtnText: { color: '#1B5E46', fontSize: 13, fontFamily: fontFamily.bold },
  
  premiumInput: { backgroundColor: '#F7F8FA', borderRadius: 16, padding: 16, minHeight: 64, textAlignVertical: 'top', color: colors.ink, fontFamily: fontFamily.medium, fontSize: 14 },
  
  tipSub: { fontSize: 13, color: colors.inkMuted, marginBottom: 16, fontFamily: fontFamily.medium },
  tipSubInline: { fontSize: 12, color: colors.inkMuted, fontFamily: fontFamily.medium, marginTop: 2 },
  tipOptionsRow: { flexDirection: 'row', gap: 12 },
  tipChip: { flex: 1, paddingVertical: 14, borderRadius: 16, backgroundColor: '#FFFFFF', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  tipChipActive: { backgroundColor: '#D97B4F', shadowOpacity: 0.1, shadowColor: '#D97B4F', shadowRadius: 8 },
  tipChipText: { color: colors.ink, fontFamily: fontFamily.bold, fontSize: 15 },
  tipChipTextActive: { color: '#FFFFFF' },

  altToggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  altToggleLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  altFieldsContainer: { marginTop: 16, borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: 16 },
  inputFieldBox: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, paddingHorizontal: 16, height: 52, backgroundColor: '#F7F8FA' },
  altTextInput: { flex: 1, fontSize: 14, color: colors.ink, fontFamily: fontFamily.semibold, padding: 0 },

  promoTicketCard: { flexDirection: 'row', backgroundColor: '#F7F8FA', borderRadius: 16, padding: 8, marginBottom: 16 },
  promoTicketLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 },
  promoTicketInput: { flex: 1, fontFamily: fontFamily.black, color: colors.ink, fontSize: 14, textTransform: 'uppercase', letterSpacing: 1.5, marginLeft: 12, padding: 0 },
  promoTicketBtn: { backgroundColor: colors.ink, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, justifyContent: 'center' },
  promoTicketBtnText: { color: '#FFFFFF', fontFamily: fontFamily.bold, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },

  toggleRowItem: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  toggleRowItemActive: { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#1B5E46' },
  toggleItemLeft: { flexDirection: 'row', alignItems: 'center' },
  toggleIconBox: { width: 38, height: 38, backgroundColor: '#F7F8FA', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  toggleItemTitle: { color: colors.ink, fontFamily: fontFamily.bold, fontSize: 14 },
  toggleItemSub: { color: colors.inkMuted, fontSize: 12, fontFamily: fontFamily.medium, marginTop: 2 },
  customCheckbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' },
  customCheckboxActive: { borderColor: '#1B5E46', backgroundColor: '#1B5E46' },
  customCheckboxInner: { width: 10, height: 10, backgroundColor: '#FFFFFF', borderRadius: 2 },

  sectionHeaderTitle: { color: colors.ink, fontSize: 18, fontFamily: fontFamily.black, marginBottom: 16, marginTop: 20, paddingHorizontal: 4, letterSpacing: -0.5 },
  subSectionTitle: { color: colors.ink, fontSize: 14, fontFamily: fontFamily.black, marginBottom: 16, letterSpacing: -0.2 },

  upiAppsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  upiAppContainer: { flex: 1, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 6, borderRadius: 16, backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: 'transparent' },
  upiAppContainerActive: { backgroundColor: '#F0FDF4', borderColor: '#1B5E46' },
  upiIconWrapper: { position: 'relative', marginBottom: 8 },
  upiIconBase: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#F7F8FA' },
  upiCheckedBadge: { position: 'absolute', top: -4, right: -4, zIndex: 10, backgroundColor: '#FFF', borderRadius: 10 },
  upiAppName: { fontSize: 12, fontFamily: fontFamily.bold, color: colors.inkMuted },
  upiAppNameActive: { fontFamily: fontFamily.black, color: '#1B5E46' },
  
  phonepeText: { color: '#fff', fontSize: 18, fontFamily: fontFamily.bold, fontStyle: 'italic' },
  paytmText: { color: '#fff', fontSize: 14, fontFamily: fontFamily.black },
  gpayRow: { flexDirection: 'row', alignItems: 'center' },
  otherUpiText: { color: '#1B5E46', fontSize: 12, fontFamily: fontFamily.black },

  paymentRowItem: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: 'transparent' },
  paymentRowItemActive: { borderColor: '#1B5E46', backgroundColor: '#F0FDF4' },
  paymentRowItemLeft: { flexDirection: 'row', alignItems: 'center' },
  paymentItemIconBox: { width: 42, height: 42, backgroundColor: '#F7F8FA', borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  paymentItemTitle: { fontFamily: fontFamily.black, fontSize: 14, color: colors.ink, letterSpacing: -0.2 },
  paymentItemTitleActive: { color: '#1B5E46' },
  paymentItemSub: { color: colors.inkMuted, fontSize: 12, fontFamily: fontFamily.medium, marginTop: 2 },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' },
  radioOuterActive: { borderColor: '#1B5E46' },
  radioInner: { width: 12, height: 12, backgroundColor: '#1B5E46', borderRadius: 6 },

  billCard: { backgroundColor: '#FFFFFF', padding: 24, borderRadius: 24, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.05, shadowRadius: 20, elevation: 4 },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  billLabel: { color: colors.inkMuted, fontFamily: fontFamily.medium, fontSize: 14 },
  billValue: { color: colors.ink, fontFamily: fontFamily.bold, fontSize: 14 },
  billRowHighlight: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14, backgroundColor: '#F0FDF4', padding: 12, borderRadius: 12, marginHorizontal: -12 },
  discountText: { color: '#1B5E46', fontFamily: fontFamily.black, fontSize: 14 },
  discountValue: { color: '#1B5E46', fontFamily: fontFamily.black, fontSize: 14 },
  loyaltyText: { color: '#1B5E46', fontFamily: fontFamily.black, fontSize: 14 },
  loyaltyValue: { color: '#1B5E46', fontFamily: fontFamily.black, fontSize: 14 },
  billDividerDashed: { height: 1, borderRadius: 1, borderWidth: 1, borderColor: '#E5E7EB', borderStyle: 'dashed', marginVertical: 16 },
  billTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6 },
  billTotalLabel: { color: colors.ink, fontSize: 16, fontFamily: fontFamily.black },
  billTotalValue: { color: colors.ink, fontSize: 24, fontFamily: fontFamily.black, letterSpacing: -1 },

  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  premiumPayBtn: {
    height: 56,
    backgroundColor: '#1B5E46',
    borderRadius: 16,
    width: '100%',
    shadowColor: '#1B5E46',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  premiumPayBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    height: '100%',
  },
  payBtnGrandTotal: { color: '#FFFFFF', fontSize: 20, fontFamily: fontFamily.black, letterSpacing: -0.5 },
  payBtnSubText: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontFamily: fontFamily.black, letterSpacing: 1.5, marginTop: 2 },
  payBtnActionRow: { flexDirection: 'row', alignItems: 'center' },
  payBtnActionText: { color: '#FFFFFF', fontSize: 16, fontFamily: fontFamily.black, marginRight: 10 },
  payBtnIconWrapper: { width: 32, height: 32, backgroundColor: '#FFFFFF', borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  
  loadingContainer: { flex: 1, backgroundColor: '#F7F8FA', alignItems: 'center', justifyContent: 'center' },
  verifyingContainer: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255, 255, 255, 0.98)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, zIndex: 1000 },
  verifyingTitle: { marginTop: 28, color: colors.ink, fontSize: 22, fontFamily: fontFamily.black, textAlign: 'center', letterSpacing: -0.5 },
  verifyingSub: { marginTop: 12, color: colors.inkMuted, fontSize: 15, fontFamily: fontFamily.medium, textAlign: 'center', lineHeight: 22 },

  outOfZoneContainer: { flex: 1, backgroundColor: '#F7F8FA' },
  outOfZoneBack: { position: 'absolute', top: 64, left: 20, zIndex: 10, width: 44, height: 44, backgroundColor: '#FFFFFF', borderRadius: 22, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  outOfZoneContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  outOfZoneIconBox: { width: 110, height: 110, borderRadius: 55, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  outOfZoneTitle: { color: colors.ink, fontSize: 24, fontFamily: fontFamily.black, textAlign: 'center', letterSpacing: -0.5, marginBottom: 12 },
  outOfZoneSub: { color: colors.inkMuted, fontSize: 15, fontFamily: fontFamily.medium, textAlign: 'center', lineHeight: 24, marginBottom: 36 },
  outOfZoneChangeBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.ink, paddingHorizontal: 24, paddingVertical: 16, borderRadius: 16, width: '100%', justifyContent: 'center', marginBottom: 16 },
  outOfZoneChangeBtnText: { color: '#FFFFFF', fontSize: 14, fontFamily: fontFamily.black, textTransform: 'uppercase', letterSpacing: 1 },
  outOfZoneBackLink: { paddingVertical: 12 },
  outOfZoneBackLinkText: { color: colors.inkFaint, fontSize: 14, fontFamily: fontFamily.bold },
});

export default CheckoutScreen;
