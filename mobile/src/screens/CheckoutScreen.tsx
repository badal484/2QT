import { ArrowLeft, MapPin, CreditCard, Sparkles, Clock, ShieldCheck, Heart, Banknote, Ticket, ChevronRight } from 'lucide-react-native';
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, StyleSheet } from 'react-native';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api } from '../api/client';
import { getSocket } from '../socket/client';
import { useSelector, useDispatch } from 'react-redux';
import { clearCart, setPromoCode as setPromoCodeAction } from '../store/slices/cartSlice';
import RazorpayCheckout from 'react-native-razorpay';
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import Animated, { FadeInDown, FadeIn, SlideInDown, useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSpring } from 'react-native-reanimated';

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

const triggerHaptic = (type = 'impactLight') => ReactNativeHapticFeedback.trigger(type as any, hapticOptions);

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
    const maxAttempts = 10;
    
    const interval = setInterval(async () => {
      attempts++;
      try {
        const res: any = await api.get(`/orders/${orderId}`);
        if (res.order?.status === 'confirmed' || res.order?.status === 'preparing') {
          clearInterval(interval);
          triggerHaptic('notificationSuccess');
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
        triggerHaptic('notificationSuccess');
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
            // Instantly verify on backend to avoid waiting for webhooks
            api.post('/payment/verify-payment', {
              razorpay_order_id: data.razorpay_order_id,
              razorpay_payment_id: data.razorpay_payment_id,
              razorpay_signature: data.razorpay_signature,
              type: 'order'
            }).then(() => {
              verifyOrder(res.orderId);
            }).catch(() => {
              verifyOrder(res.orderId); // fallback to polling
            });
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
        <ArrowLeft size={24} color="#1A1A2E" />
      </TouchableOpacity>
      <Animated.View entering={FadeInDown.duration(400)} style={styles.outOfZoneContent}>
        <View style={styles.outOfZoneIconBox}>
          <MapPin size={48} color="#EF4444" />
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

  const p = pricing?.pricing || { totalAmountPaise: 0, subtotalPaise: 0, deliveryFeePaise: 0, gstPaise: 0 };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { triggerHaptic('impactLight'); navigation.goBack(); }} style={styles.backButton}>
          <ArrowLeft size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review & Pay</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        
        {/* Delivery Address Summary */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.premiumCard}>
          <View style={styles.addressHeaderRow}>
            <View style={styles.addressIconCircle}>
              <MapPin size={22} color="#10B981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionSubtitle}>Delivering To</Text>
              <Text style={styles.addressLabel} numberOfLines={1}>{selectedAddress?.label || 'Selected Address'}</Text>
            </View>
            <TouchableOpacity style={styles.editBtn}>
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.addressText} numberOfLines={2}>
            {selectedAddress?.address_text}, {selectedAddress?.landmark}
          </Text>
        </Animated.View>

        {/* Schedule Info */}
        {(route.params?.scheduledAt) && (
          <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.premiumCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.addressIconCircle, { backgroundColor: '#FEF3C7' }]}>
                <Clock size={22} color="#D97706" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionSubtitle}>Scheduled Delivery</Text>
                <Text style={styles.addressLabel}>
                  {new Date(route.params.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Delivery Instructions */}
        <Animated.View entering={FadeInDown.delay(160).duration(400)} style={styles.premiumCard}>
          <Text style={styles.cardHeaderTitle}>Delivery Instructions</Text>
          <TextInput 
            placeholder="e.g. Leave at door, don't ring bell..."
            placeholderTextColor="#9ca3af"
            value={deliveryInstructions}
            onChangeText={setDeliveryInstructions}
            style={styles.premiumInput}
            multiline
          />
        </Animated.View>

        {/* Tip the Rider */}
        <Animated.View entering={FadeInDown.delay(180).duration(400)} style={styles.premiumCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <Heart size={20} color="#FF6B35" style={{ marginRight: 8 }} />
            <Text style={styles.cardHeaderTitle}>Tip your delivery partner</Text>
          </View>
          <Text style={styles.tipSub}>100% of your tip goes directly to your rider.</Text>
          <View style={styles.tipOptionsRow}>
            {[20, 50, 100].map((amt) => (
              <TouchableOpacity 
                key={amt}
                style={[styles.tipChip, riderTip === amt && styles.tipChipActive]}
                onPress={() => {
                  triggerHaptic('impactLight');
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
          <Text style={styles.cardHeaderTitle}>Bill Details</Text>
          
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

        {/* Payment Options Header */}
        <Text style={styles.sectionHeaderTitle}>Offers & Payment</Text>

        {/* Promo Code Ticket */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.promoTicketCard}>
          <View style={styles.promoTicketLeft}>
            <Ticket size={24} color="#1A1A2E" />
            <TextInput 
              placeholder="Enter Promo Code" 
              placeholderTextColor="#9ca3af"
              value={promoCode}
              onChangeText={setPromoCode}
              style={styles.promoTicketInput}
            />
          </View>
          <TouchableOpacity 
            style={styles.promoTicketBtn}
            onPress={() => {
              triggerHaptic('impactHeavy');
              if (promoCode.toUpperCase() === '2QT50') {
                dispatch(setPromoCodeAction(promoCode.toUpperCase()));
                Alert.alert('Success', 'Promo code applied! You get 50% off.');
              } else {
                Alert.alert('Invalid Code', 'Try 2QT50 for a discount.');
              }
            }} 
          >
            <Text style={styles.promoTicketBtnText}>Apply</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Toggles */}
        <Animated.View entering={FadeInDown.delay(350).duration(400)}>
          <TouchableOpacity 
            onPress={() => { triggerHaptic('impactMedium'); setUseWallet(!useWallet); }}
            activeOpacity={0.8}
            style={[styles.toggleCardPremium, useWallet && styles.toggleCardActive]}
          >
            <View style={styles.toggleCardLeft}>
              <View style={[styles.toggleIconCircle, useWallet && { backgroundColor: '#10B981' }]}>
                <CreditCard size={20} color={useWallet ? "#fff" : "#6B7280"} />
              </View>
              <View>
                <Text style={styles.toggleTitle}>Pay from Wallet</Text>
                <Text style={styles.toggleSub}>Available Balance: ₹{pricing?.availableWallet / 100 || 0}</Text>
              </View>
            </View>
            <View style={[styles.customCheckbox, useWallet && styles.customCheckboxActive]}>
              {useWallet && <View style={styles.customCheckboxInner} />}
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => { triggerHaptic('impactMedium'); setUseLoyalty(!useLoyalty); }}
            activeOpacity={0.8}
            disabled={!loyaltyData?.points}
            style={[styles.toggleCardPremium, useLoyalty && styles.toggleCardActive, !loyaltyData?.points && { opacity: 0.6 }]}
          >
            <View style={styles.toggleCardLeft}>
              <View style={[styles.toggleIconCircle, useLoyalty && { backgroundColor: '#FF6B35' }]}>
                <Sparkles size={20} color={useLoyalty ? "#fff" : "#6B7280"} />
              </View>
              <View>
                <Text style={styles.toggleTitle}>Redeem 2QT Points</Text>
                <Text style={styles.toggleSub}>Balance: {loyaltyData?.points || 0} pts</Text>
              </View>
            </View>
            <View style={[styles.customCheckbox, useLoyalty && { borderColor: '#FF6B35' }]}>
              {useLoyalty && <View style={[styles.customCheckboxInner, { backgroundColor: '#FF6B35' }]} />}
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Payment Methods */}
        <Animated.View entering={FadeInDown.delay(400).duration(400)}>
          
          <TouchableOpacity 
            activeOpacity={0.9}
            onPress={() => { triggerHaptic('selection'); setPaymentMethod('online'); }}
            style={[styles.paymentMethodPremium, paymentMethod === 'online' && styles.paymentMethodActive]}
          >
            <View style={styles.paymentMethodLeft}>
              <View style={[styles.paymentMethodIconBox, paymentMethod === 'online' && { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                <CreditCard size={24} color={paymentMethod === 'online' ? '#10B981' : '#6B7280'} />
              </View>
              <View>
                <Text style={[styles.paymentMethodTitle, paymentMethod === 'online' && styles.paymentMethodTitleActive]}>Pay Online</Text>
                <Text style={styles.paymentMethodSub}>UPI, Cards, Netbanking</Text>
              </View>
            </View>
            <View style={[styles.radioOuter, paymentMethod === 'online' && styles.radioOuterActive]}>
              {paymentMethod === 'online' && <Animated.View entering={FadeIn} style={styles.radioInner} />}
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            activeOpacity={0.9}
            onPress={() => { triggerHaptic('selection'); setPaymentMethod('cod'); }}
            style={[styles.paymentMethodPremium, paymentMethod === 'cod' && styles.paymentMethodActive, { marginBottom: 40 }]}
          >
            <View style={styles.paymentMethodLeft}>
              <View style={[styles.paymentMethodIconBox, paymentMethod === 'cod' && { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                <Banknote size={24} color={paymentMethod === 'cod' ? '#10B981' : '#6B7280'} />
              </View>
              <View>
                <Text style={[styles.paymentMethodTitle, paymentMethod === 'cod' && styles.paymentMethodTitleActive]}>Cash on Delivery</Text>
                <Text style={styles.paymentMethodSub}>Pay when it arrives</Text>
              </View>
            </View>
            <View style={[styles.radioOuter, paymentMethod === 'cod' && styles.radioOuterActive]}>
              {paymentMethod === 'cod' && <Animated.View entering={FadeIn} style={styles.radioInner} />}
            </View>
          </TouchableOpacity>

        </Animated.View>
      </ScrollView>

      {/* Sticky Full-Width Footer */}
      <Animated.View entering={SlideInDown.duration(400).delay(200)} style={styles.stickyFooter}>
        <BouncingButton 
          style={styles.premiumPayBtn}
          disabled={placeOrderMutation.isPending || isFetching}
          onPress={() => {
            triggerHaptic('impactHeavy');
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
                  <Text style={styles.payBtnActionText}>Place Order</Text>
                  <View style={styles.payBtnIconWrapper}>
                    <ChevronRight size={20} color="#10B981" />
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
  pulseCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(16, 185, 129, 0.1)', alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    paddingTop: 64,
    paddingHorizontal: 24,
    paddingBottom: 24,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    zIndex: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    backgroundColor: '#F9FAFB',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  headerTitle: {
    color: '#1A1A2E',
    fontSize: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 140 }, // Extra padding for sticky footer
  
  premiumCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeaderTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1A1A2E',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  
  addressHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  addressIconCircle: { width: 44, height: 44, backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  sectionSubtitle: { color: '#9CA3AF', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 2 },
  addressLabel: { color: '#1A1A2E', fontWeight: '900', fontSize: 17, letterSpacing: -0.5 },
  addressText: { color: '#6B7280', fontSize: 14, lineHeight: 22, fontWeight: '500' },
  editBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#F3F4F6', borderRadius: 10 },
  editBtnText: { color: '#4B5563', fontSize: 12, fontWeight: '800' },
  
  premiumInput: { backgroundColor: '#F9FAFB', borderRadius: 16, padding: 16, minHeight: 80, textAlignVertical: 'top', color: '#1A1A2E', fontWeight: '600', fontSize: 14, borderWidth: 1, borderColor: '#F3F4F6' },
  
  tipSub: { fontSize: 13, color: '#6B7280', marginBottom: 16, fontWeight: '500' },
  tipOptionsRow: { flexDirection: 'row', gap: 12 },
  tipChip: { flex: 1, paddingVertical: 14, borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', alignItems: 'center' },
  tipChipActive: { backgroundColor: '#FF6B35', borderColor: '#FF6B35' },
  tipChipText: { color: '#4B5563', fontWeight: '800', fontSize: 16 },
  tipChipTextActive: { color: '#FFFFFF' },

  billCard: { backgroundColor: '#FFFFFF', padding: 24, borderRadius: 24, marginBottom: 32, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 3 },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  billLabel: { color: '#6B7280', fontWeight: '600', fontSize: 14 },
  billValue: { color: '#1A1A2E', fontWeight: '800', fontSize: 15 },
  billRowHighlight: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, backgroundColor: '#ECFDF5', padding: 12, borderRadius: 12, marginHorizontal: -12 },
  discountText: { color: '#10B981', fontWeight: '800', fontSize: 14 },
  discountValue: { color: '#10B981', fontWeight: '900', fontSize: 15 },
  loyaltyText: { color: '#10B981', fontWeight: '800', fontSize: 14 },
  loyaltyValue: { color: '#10B981', fontWeight: '900', fontSize: 15 },
  billDividerDashed: { height: 1, borderRadius: 1, borderWidth: 1, borderColor: '#E5E7EB', borderStyle: 'dashed', marginVertical: 16 },
  billTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 },
  billTotalLabel: { color: '#1A1A2E', fontSize: 18, fontWeight: '900' },
  billTotalValue: { color: '#1A1A2E', fontSize: 24, fontWeight: '900', letterSpacing: -1 },

  sectionHeaderTitle: { color: '#1A1A2E', fontSize: 20, fontWeight: '900', letterSpacing: -0.5, marginBottom: 16, marginTop: 8 },

  promoTicketCard: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 8, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: '#F3F4F6' },
  promoTicketLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  promoTicketInput: { flex: 1, fontWeight: '900', color: '#1A1A2E', fontSize: 14, textTransform: 'uppercase', letterSpacing: 2, marginLeft: 12 },
  promoTicketBtn: { backgroundColor: '#1A1A2E', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16, justifyContent: 'center' },
  promoTicketBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },

  toggleCardPremium: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#F3F4F6', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 2 },
  toggleCardActive: { backgroundColor: '#F0FDF4', borderColor: '#10B981' },
  toggleCardLeft: { flexDirection: 'row', alignItems: 'center' },
  toggleIconCircle: { width: 40, height: 40, backgroundColor: '#F3F4F6', borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  toggleTitle: { color: '#1A1A2E', fontWeight: '800', fontSize: 15 },
  toggleSub: { color: '#6B7280', fontSize: 12, fontWeight: '600', marginTop: 2 },
  customCheckbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  customCheckboxActive: { borderColor: '#10B981' },
  customCheckboxInner: { width: 12, height: 12, backgroundColor: '#10B981', borderRadius: 4 },

  paymentMethodPremium: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: '#F3F4F6', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 2 },
  paymentMethodActive: { borderColor: '#10B981', backgroundColor: '#FFFFFF' },
  paymentMethodLeft: { flexDirection: 'row', alignItems: 'center' },
  paymentMethodIconBox: { width: 48, height: 48, backgroundColor: '#F3F4F6', borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  paymentMethodTitle: { fontWeight: '800', fontSize: 16, color: '#1A1A2E' },
  paymentMethodTitleActive: { color: '#10B981' },
  paymentMethodSub: { color: '#6B7280', fontSize: 13, fontWeight: '500', marginTop: 2 },
  radioOuter: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  radioOuterActive: { borderColor: '#10B981' },
  radioInner: { width: 12, height: 12, backgroundColor: '#10B981', borderRadius: 6 },

  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 20,
  },
  premiumPayBtn: {
    height: 64,
    backgroundColor: '#10B981',
    borderRadius: 20,
    width: '100%',
  },
  premiumPayBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    height: '100%',
  },
  payBtnGrandTotal: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  payBtnSubText: { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginTop: 2 },
  payBtnActionRow: { flexDirection: 'row', alignItems: 'center' },
  payBtnActionText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginRight: 12 },
  payBtnIconWrapper: { width: 36, height: 36, backgroundColor: '#FFFFFF', borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  
  loadingContainer: { flex: 1, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center' },
  verifyingContainer: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,255,255,0.98)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, zIndex: 1000 },
  verifyingTitle: { marginTop: 40, color: '#1A1A2E', fontSize: 24, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5 },
  verifyingSub: { marginTop: 12, color: '#6B7280', fontSize: 16, fontWeight: '500', textAlign: 'center', lineHeight: 24 },

  outOfZoneContainer: { flex: 1, backgroundColor: '#F9FAFB' },
  outOfZoneBack: { position: 'absolute', top: 64, left: 24, zIndex: 10, width: 44, height: 44, backgroundColor: '#FFFFFF', borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F3F4F6' },
  outOfZoneContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  outOfZoneIconBox: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginBottom: 32, borderWidth: 1, borderColor: '#FECACA' },
  outOfZoneTitle: { color: '#1A1A2E', fontSize: 28, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5, marginBottom: 12 },
  outOfZoneSub: { color: '#6B7280', fontSize: 15, fontWeight: '500', textAlign: 'center', lineHeight: 24, marginBottom: 40 },
  outOfZoneChangeBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1A1A2E', paddingHorizontal: 28, paddingVertical: 18, borderRadius: 20, width: '100%', justifyContent: 'center', marginBottom: 16 },
  outOfZoneChangeBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  outOfZoneBackLink: { paddingVertical: 12 },
  outOfZoneBackLinkText: { color: '#9CA3AF', fontSize: 14, fontWeight: '700' },
});

export default CheckoutScreen;
