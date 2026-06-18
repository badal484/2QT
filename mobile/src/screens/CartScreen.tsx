import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Image,
  ActivityIndicator, Alert, StyleSheet,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, interpolateColor, FadeIn, FadeInDown, SlideInDown } from 'react-native-reanimated';
import { useSelector, useDispatch } from 'react-redux';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { RootState } from '../store';
import { api } from '../api/client';
import { setQuantity, clearCart, setPromoCode as setPromoCodeAction } from '../store/slices/cartSlice';
import { getSocket } from '../socket/client';
import { MapPin, ShoppingCart, X, ChefHat, Tag, Star, Wallet, UserRound, Phone, CheckCircle2 } from 'lucide-react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import RazorpayCheckout from 'react-native-razorpay';

const hapticOptions = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };
const triggerHaptic = () => ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);

const ACCENT = colors.accent;
const BG = colors.background;

// ── Custom cross-platform toggle ──────────────────────────────────────────────
const Toggle = ({ value, onValueChange, activeColor = ACCENT }: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  activeColor?: string;
}) => {
  const progress = useSharedValue(value ? 1 : 0);

  React.useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: 200 });
  }, [value]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ['#D1D5DB', activeColor]),
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withTiming(value ? 20 : 2, { duration: 200 }) }],
  }));

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={() => { triggerHaptic(); onValueChange(!value); }}>
      <Animated.View style={[toggleStyles.track, trackStyle]}>
        <Animated.View style={[toggleStyles.thumb, thumbStyle]} />
      </Animated.View>
    </TouchableOpacity>
  );
};

const toggleStyles = StyleSheet.create({
  track: {
    width: 44, height: 26, borderRadius: 13,
    justifyContent: 'center',
  },
  thumb: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
});

const VerifyingOverlay = () => (
  <View style={styles.overlay}>
    <ActivityIndicator size="large" color={ACCENT} />
    <Text style={styles.overlayTitle}>Verifying Payment</Text>
    <Text style={styles.overlaySub}>Confirming your order with the kitchen…</Text>
  </View>
);

const CartScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const { items, addressId } = useSelector((state: RootState) => state.cart);
  const { user } = useSelector((state: RootState) => state.auth);

  const [promoCode, setPromoCode] = useState('');
  const [appliedPromoCode, setAppliedPromoCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cod'>('online');
  const [useLoyalty, setUseLoyalty] = useState(false);
  const [useWallet, setUseWallet] = useState(false);
  const [altReceiver, setAltReceiver] = useState(false);
  const [altName, setAltName] = useState('');
  const [altPhone, setAltPhone] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  React.useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ['your-order-pricing'] });
      queryClient.invalidateQueries({ queryKey: ['loyalty-pts'] });
    };
    socket.on('menu_updated', refresh);
    socket.on('wallet_updated', refresh);
    socket.on('loyalty_updated', refresh);
    return () => {
      socket.off('menu_updated', refresh);
      socket.off('wallet_updated', refresh);
      socket.off('loyalty_updated', refresh);
    };
  }, [queryClient]);

  const { data: addressesData } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => api.get('/customers/addresses'),
    enabled: !!addressId,
  });
  const selectedAddress = addressesData?.addresses?.find((a: any) => a.id === addressId);
  const isOutOfZone = !!addressId && !!selectedAddress && !selectedAddress.is_serviceable;

  const { data: loyaltyData } = useQuery({
    queryKey: ['loyalty-pts'],
    queryFn: () => api.get('/customers/loyalty'),
    enabled: !!user,
  });

  const fallbackSubtotal = items.reduce((s, i) => s + i.quantity * i.pricePaise, 0);
  const { data: pricingData, isFetching: pricingFetching } = useQuery({
    queryKey: ['your-order-pricing', items, addressId, appliedPromoCode, useLoyalty, useWallet],
    queryFn: () =>
      api.post('/payment/create-order', {
        items, addressId, promoCode: appliedPromoCode, useLoyalty, useWallet, dryRun: true,
      }),
    enabled: items.length > 0 && !!addressId && !isOutOfZone,
    placeholderData: keepPreviousData,
  });

  const p = pricingData?.pricing || {
    subtotalPaise: fallbackSubtotal,
    deliveryFeePaise: 0,
    gstPaise: 0,
    cgstPaise: 0,
    sgstPaise: 0,
    totalAmountPaise: fallbackSubtotal,
    gatewayAmountPaise: fallbackSubtotal,
    discountPaise: 0,
    loyaltyDiscountPaise: 0,
    walletDeductionPaise: 0,
  };
  const availableWallet = pricingData?.availableWallet || 0;
  const subtotal = p.subtotalPaise / 100;
  const deliveryFee = p.deliveryFeePaise / 100;
  const tax = ((p.gstPaise || 0) + (p.cgstPaise || 0) + (p.sgstPaise || 0)) / 100;
  const grandTotal = p.gatewayAmountPaise / 100;

  const verifyOrder = (orderId: string) => {
    setIsVerifying(true);
    let attempts = 0;
    const id = setInterval(async () => {
      attempts++;
      try {
        const res: any = await api.get(`/orders/${orderId}`);
        if (['confirmed', 'preparing'].includes(res.order?.status)) {
          clearInterval(id);
          setIsVerifying(false);
          dispatch(clearCart());
          queryClient.invalidateQueries({ queryKey: ['order-history'] });
          navigation.navigate('OrderConfirmed', { orderId });
        }
      } catch (_) {}
      if (attempts >= 10) {
        clearInterval(id);
        setIsVerifying(false);
        navigation.navigate('OrderHistory');
      }
    }, 2000);
  };

  const placeOrderMutation = useMutation({
    mutationFn: (data: any) => api.post('/payment/create-order', data),
    onSuccess: (res: any) => {
      if (res.status === 'confirmed') {
        dispatch(clearCart());
        navigation.navigate('OrderConfirmed', { orderId: res.orderId });
        return;
      }
      if (__DEV__ && !res.keyId) {
        api
          .post('/payment/mock-success', { razorpayOrderId: res.razorpayOrderId })
          .then(() => verifyOrder(res.orderId))
          .catch((err: any) => Alert.alert('Mock Payment Failed', err.message));
        return;
      }
      const options = {
        description: 'VELTO Food Order',
        currency: 'INR',
        key: res.keyId,
        amount: res.amount,
        name: 'VELTO Food Palace',
        order_id: res.razorpayOrderId,
        prefill: {
          email: user?.email || 'customer@velto.app',
          contact: user?.phone || '',
          name: user?.name || 'Customer',
        },
        theme: { color: ACCENT },
      };
      if (RazorpayCheckout && typeof RazorpayCheckout.open === 'function') {
        RazorpayCheckout.open(options)
          .then((data: any) => {
            api
              .post('/payment/verify-payment', {
                razorpay_order_id: data.razorpay_order_id,
                razorpay_payment_id: data.razorpay_payment_id,
                razorpay_signature: data.razorpay_signature,
                type: 'order',
              })
              .then(() => verifyOrder(res.orderId))
              .catch(() => verifyOrder(res.orderId));
          })
          .catch((err: any) => {
            const msg =
              err?.error?.description ||
              (typeof err?.description === 'string' ? err.description : null) ||
              'Transaction cancelled or failed.';
            Alert.alert('Payment Failed', msg);
          });
      } else {
        Alert.alert('Error', 'Payment gateway unavailable on this device.');
      }
    },
    onError: (err: any) => Alert.alert('Order Failed', err.message || 'Could not place order'),
  });

  const handlePlaceOrder = () => {
    if (!addressId) {
      Alert.alert('Missing Address', 'Please select a delivery address first.');
      navigation.navigate('Address');
      return;
    }
    if (altReceiver && altPhone.length < 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit phone number for the alternate receiver.');
      return;
    }
    placeOrderMutation.mutate({
      items, addressId, promoCode: appliedPromoCode, useLoyalty, useWallet, paymentMethod, dryRun: false,
      deliveryContactName: altReceiver && altName.trim() ? altName.trim() : undefined,
      deliveryContactPhone: altReceiver && altPhone.trim() ? altPhone.trim() : undefined,
    });
  };

  if (items.length === 0) {
    return (
      <View style={[styles.emptyContainer, { paddingTop: insets.top }]}>
        <Animated.View entering={FadeIn.duration(600)} style={styles.emptyIconBox}>
          <ShoppingCart size={48} color={ACCENT} />
        </Animated.View>
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptySub}>Discover our delicious menu and add something tasty!</Text>
        <TouchableOpacity
          style={styles.exploreBtn}
          onPress={() => { triggerHaptic(); navigation.reset({ index: 0, routes: [{ name: 'Home' }] }); }}
        >
          <Text style={styles.exploreBtnText}>Explore Menu</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const busy = placeOrderMutation.isPending || pricingFetching;
  const totalItemCount = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {isVerifying && <VerifyingOverlay />}

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Your Order</Text>
          <Text style={styles.headerSub}>{totalItemCount} {totalItemCount === 1 ? 'item' : 'items'}</Text>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={() => { triggerHaptic(); navigation.goBack(); }}>
          <X size={18} color={colors.ink} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Cart Items Card */}
        <Animated.View entering={FadeInDown.duration(300)} style={styles.card}>
          {items.map((item, index) => (
            <View key={item.menuItemId}>
              <View style={styles.itemRow}>
                <View style={styles.itemImgBox}>
                  {item.photoUrl ? (
                    <Image source={{ uri: item.photoUrl }} style={styles.itemImg} />
                  ) : (
                    <View style={[styles.itemImg, styles.itemImgPlaceholder]}>
                      <ChefHat size={22} color={colors.inkFaint} />
                    </View>
                  )}
                </View>
                <View style={styles.itemMeta}>
                  <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.itemPrice}>₹{item.pricePaise / 100}</Text>
                </View>
                <View style={styles.qtyRow}>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => { triggerHaptic(); dispatch(setQuantity({ menuItemId: item.menuItemId, quantity: item.quantity - 1 })); }}
                  >
                    <Text style={styles.qtyBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyNum}>{item.quantity}</Text>
                  <TouchableOpacity
                    style={[styles.qtyBtn, styles.qtyBtnActive]}
                    onPress={() => { triggerHaptic(); dispatch(setQuantity({ menuItemId: item.menuItemId, quantity: item.quantity + 1 })); }}
                  >
                    <Text style={[styles.qtyBtnText, styles.qtyBtnActiveText]}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {index < items.length - 1 && <View style={styles.cardDivider} />}
            </View>
          ))}
        </Animated.View>

        {/* Delivery Address Card */}
        <Animated.View entering={FadeInDown.delay(60).duration(300)} style={styles.card}>
          <TouchableOpacity
            style={styles.addressRow}
            activeOpacity={0.7}
            onPress={() => { triggerHaptic(); navigation.navigate('Address'); }}
          >
            <View style={styles.addressIconCircle}>
              <MapPin size={16} color={ACCENT} />
            </View>
            <View style={styles.addressBody}>
              <Text style={styles.cardSectionLabel}>Delivering to</Text>
              {selectedAddress ? (
                <>
                  <Text style={styles.addressLabel}>{selectedAddress.label}</Text>
                  <Text style={styles.addressText} numberOfLines={2}>
                    {selectedAddress.address_text}
                  </Text>
                </>
              ) : (
                <Text style={styles.addressText}>
                  {addressId ? 'Loading…' : 'No address selected'}
                </Text>
              )}
            </View>
            <Text style={styles.changeText}>Change</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Alternate Receiver Card */}
        <Animated.View entering={FadeInDown.delay(75).duration(300)} style={styles.card}>
          <View style={styles.savingsRow}>
            <View style={styles.savingsLeft}>
              <View style={styles.savingsIconBox}>
                <UserRound size={14} color={ACCENT} />
              </View>
              <View>
                <Text style={styles.savingsTitle}>Someone else will receive</Text>
                <Text style={styles.savingsSubtitle}>Add alternate contact for rider</Text>
              </View>
            </View>
            <Toggle value={altReceiver} onValueChange={setAltReceiver} />
          </View>
          {altReceiver && (
            <>
              <View style={styles.cardDivider} />
              <View style={styles.altFieldRow}>
                <UserRound size={14} color={colors.inkFaint} />
                <TextInput
                  style={styles.altInput}
                  placeholder="Receiver's name"
                  placeholderTextColor={colors.inkFaint}
                  value={altName}
                  onChangeText={setAltName}
                  returnKeyType="next"
                />
              </View>
              <View style={[styles.altFieldRow, { marginTop: 10 }]}>
                <Phone size={14} color={colors.inkFaint} />
                <TextInput
                  style={styles.altInput}
                  placeholder="Receiver's phone number"
                  placeholderTextColor={colors.inkFaint}
                  value={altPhone}
                  onChangeText={setAltPhone}
                  keyboardType="phone-pad"
                  maxLength={10}
                  returnKeyType="done"
                />
              </View>
            </>
          )}
        </Animated.View>

        {/* Promo Code Card */}
        <Animated.View entering={FadeInDown.delay(90).duration(300)} style={styles.card}>
          <View style={styles.promoRow}>
            <View style={styles.promoIconBox}>
              <Tag size={15} color={ACCENT} />
            </View>
            {appliedPromoCode ? (
              <View style={styles.promoAppliedRow}>
                <CheckCircle2 size={14} color={colors.success} />
                <Text style={styles.promoAppliedText}>{appliedPromoCode}</Text>
                {p.discountPaise > 0 && (
                  <Text style={styles.promoSavingText}>−₹{p.discountPaise / 100}</Text>
                )}
                {p.discountPaise === 0 && (
                  <Text style={styles.promoInvalidText}>Invalid code</Text>
                )}
              </View>
            ) : (
              <TextInput
                style={styles.promoInput}
                placeholder="Enter promo code"
                placeholderTextColor={colors.inkFaint}
                value={promoCode}
                onChangeText={setPromoCode}
                autoCapitalize="characters"
                returnKeyType="done"
              />
            )}
            <TouchableOpacity
              style={[styles.applyBtn, !promoCode && !appliedPromoCode && styles.applyBtnDisabled]}
              onPress={() => {
                triggerHaptic();
                if (appliedPromoCode) {
                  setAppliedPromoCode('');
                  setPromoCode('');
                } else if (promoCode) {
                  setAppliedPromoCode(promoCode);
                }
              }}
            >
              <Text style={[styles.applyBtnText, !promoCode && !appliedPromoCode && styles.applyBtnTextDisabled]}>
                {appliedPromoCode ? 'Remove' : 'Apply'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Loyalty toggle */}
          {!!loyaltyData?.points && (
            <>
              <View style={styles.cardDivider} />
              <View style={styles.savingsRow}>
                <View style={styles.savingsLeft}>
                  <View style={styles.savingsIconBox}>
                    <Star size={14} color={ACCENT} fill={ACCENT} />
                  </View>
                  <View>
                    <Text style={styles.savingsTitle}>Loyalty Points</Text>
                    <Text style={styles.savingsSubtitle}>{loyaltyData.points} pts available</Text>
                  </View>
                </View>
                <Toggle value={useLoyalty} onValueChange={setUseLoyalty} />
              </View>
            </>
          )}

          {/* Wallet toggle */}
          {availableWallet > 0 && (
            <>
              <View style={styles.cardDivider} />
              <View style={styles.savingsRow}>
                <View style={styles.savingsLeft}>
                  <View style={styles.savingsIconBox}>
                    <Wallet size={14} color={colors.primary} />
                  </View>
                  <View>
                    <Text style={styles.savingsTitle}>Wallet Balance</Text>
                    <Text style={styles.savingsSubtitle}>
                      ₹{(availableWallet / 100).toFixed(2)} available
                      {useWallet && p.walletDeductionPaise > 0
                        ? `  ·  −₹${(p.walletDeductionPaise / 100).toFixed(2)} applied`
                        : ''}
                    </Text>
                  </View>
                </View>
                <Toggle value={useWallet} onValueChange={setUseWallet} activeColor={colors.primary} />
              </View>
            </>
          )}
        </Animated.View>

        {/* Payment Method Card */}
        <Animated.View entering={FadeInDown.delay(120).duration(300)} style={styles.card}>
          <Text style={styles.cardTitle}>Payment Method</Text>
          <View style={styles.paymentRow}>
            <TouchableOpacity
              style={[styles.payBtn, paymentMethod === 'online' && styles.payBtnActive]}
              onPress={() => { triggerHaptic(); setPaymentMethod('online'); }}
              activeOpacity={0.8}
            >
              <Text style={[styles.payBtnText, paymentMethod === 'online' && styles.payBtnTextActive]}>
                Pay Online
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.payBtn, paymentMethod === 'cod' && styles.payBtnActive]}
              onPress={() => { triggerHaptic(); setPaymentMethod('cod'); }}
              activeOpacity={0.8}
            >
              <Text style={[styles.payBtnText, paymentMethod === 'cod' && styles.payBtnTextActive]}>
                Cash on Delivery
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Bill Summary Card */}
        <Animated.View entering={FadeInDown.delay(150).duration(300)} style={styles.card}>
          <Text style={styles.cardTitle}>Order Summary</Text>

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Subtotal</Text>
            <Text style={styles.billValue}>₹{subtotal}</Text>
          </View>
          {deliveryFee > 0 && (
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Delivery Fee</Text>
              <Text style={styles.billValue}>₹{deliveryFee}</Text>
            </View>
          )}
          {!addressId && (
            <View style={styles.billRow}>
              <Text style={[styles.billLabel, { color: colors.inkFaint, fontStyle: 'italic' }]}>Delivery fee</Text>
              <Text style={[styles.billValue, { color: colors.inkFaint, fontSize: 12 }]}>Add address</Text>
            </View>
          )}
          {tax > 0 && (
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Taxes & GST</Text>
              <Text style={styles.billValue}>₹{tax.toFixed(2)}</Text>
            </View>
          )}
          {p.discountPaise > 0 && (
            <View style={styles.billRow}>
              <Text style={[styles.billLabel, { color: colors.success }]}>Promo Discount</Text>
              <Text style={[styles.billValue, { color: colors.success }]}>−₹{p.discountPaise / 100}</Text>
            </View>
          )}
          {p.loyaltyDiscountPaise > 0 && (
            <View style={styles.billRow}>
              <Text style={[styles.billLabel, { color: colors.success }]}>Loyalty Points</Text>
              <Text style={[styles.billValue, { color: colors.success }]}>−₹{p.loyaltyDiscountPaise / 100}</Text>
            </View>
          )}
          {p.walletDeductionPaise > 0 && (
            <View style={styles.billRow}>
              <Text style={[styles.billLabel, { color: colors.primary }]}>Wallet</Text>
              <Text style={[styles.billValue, { color: colors.primary }]}>−₹{(p.walletDeductionPaise / 100).toFixed(2)}</Text>
            </View>
          )}

          <View style={styles.totalSeparator} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>₹{grandTotal.toFixed(2)}</Text>
          </View>
        </Animated.View>

        {isOutOfZone && (
          <View style={styles.outOfZoneBanner}>
            <Text style={styles.outOfZoneText}>This address is outside our delivery zone. Please change your address.</Text>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <Animated.View
        entering={SlideInDown.duration(400)}
        style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 8, 20) }]}
      >
        <TouchableOpacity
          style={[styles.placeOrderBtn, (busy || isOutOfZone) && styles.placeOrderBtnDisabled]}
          disabled={busy || isOutOfZone}
          activeOpacity={0.88}
          onPress={handlePlaceOrder}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.placeOrderContent}>
              <View>
                <Text style={styles.placeOrderText}>Place Order</Text>
              </View>
              <View style={styles.placeOrderRight}>
                <Text style={styles.placeOrderTotal}>₹{grandTotal.toFixed(2)}</Text>
                <Text style={styles.placeOrderArrow}>›</Text>
              </View>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

export default CartScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14,
    backgroundColor: BG,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 26, fontFamily: fontFamily.black, color: colors.ink, letterSpacing: -0.5 },
  headerSub: { fontSize: 13, fontFamily: fontFamily.medium, color: colors.inkMuted, marginTop: 1 },
  closeBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center', justifyContent: 'center',
  },

  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 120, gap: 12 },

  // Card base
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardDivider: { height: 1, backgroundColor: colors.border, marginVertical: 14 },
  cardTitle: {
    fontSize: 15, fontFamily: fontFamily.bold, color: colors.ink,
    marginBottom: 14,
  },
  cardSectionLabel: {
    fontSize: 11, fontFamily: fontFamily.extrabold, color: colors.inkFaint,
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 3,
  },

  // Cart items
  itemRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 4,
  },
  itemImgBox: { width: 60, height: 60, borderRadius: 12, overflow: 'hidden', marginRight: 12 },
  itemImg: { width: '100%', height: '100%' },
  itemImgPlaceholder: { backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  itemMeta: { flex: 1, marginRight: 8 },
  itemName: { fontSize: 14, fontFamily: fontFamily.semibold, color: colors.ink, marginBottom: 4, lineHeight: 18 },
  itemPrice: { fontSize: 14, fontFamily: fontFamily.bold, color: ACCENT },

  // Qty stepper
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyBtn: {
    width: 30, height: 30, borderRadius: 9,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  qtyBtnActive: { backgroundColor: ACCENT },
  qtyBtnText: { fontSize: 17, color: colors.ink, fontFamily: fontFamily.bold, lineHeight: 20 },
  qtyBtnActiveText: { color: '#FFFFFF' },
  qtyNum: { fontSize: 15, fontFamily: fontFamily.extrabold, color: colors.ink, minWidth: 18, textAlign: 'center' },

  // Address
  addressRow: { flexDirection: 'row', alignItems: 'flex-start' },
  addressIconCircle: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.accentTint,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12, marginTop: 2,
  },
  addressBody: { flex: 1, marginRight: 8 },
  addressLabel: { fontSize: 14, fontFamily: fontFamily.bold, color: colors.ink, marginBottom: 2 },
  addressText: { fontSize: 12, fontFamily: fontFamily.regular, color: colors.inkMuted, lineHeight: 18 },
  changeText: { fontSize: 13, fontFamily: fontFamily.bold, color: ACCENT, marginTop: 2 },

  // Alternate receiver
  altFieldRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  altInput: {
    flex: 1, height: 42,
    fontSize: 14, fontFamily: fontFamily.medium, color: colors.ink,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },

  // Promo
  promoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  promoIconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.accentTint,
    alignItems: 'center', justifyContent: 'center',
  },
  promoInput: {
    flex: 1, height: 42,
    fontSize: 14, fontFamily: fontFamily.medium, color: colors.ink,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  promoAppliedRow: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  promoAppliedText: { fontSize: 14, fontFamily: fontFamily.bold, color: colors.success },
  promoSavingText: { fontSize: 13, fontFamily: fontFamily.semibold, color: colors.success },
  promoInvalidText: { fontSize: 12, fontFamily: fontFamily.medium, color: colors.danger },
  applyBtn: {
    height: 42, paddingHorizontal: 16, borderRadius: 12,
    backgroundColor: ACCENT,
    alignItems: 'center', justifyContent: 'center',
  },
  applyBtnDisabled: { backgroundColor: colors.surfaceMuted },
  applyBtnText: { fontSize: 14, fontFamily: fontFamily.bold, color: '#FFFFFF' },
  applyBtnTextDisabled: { color: colors.inkFaint },

  // Savings rows (loyalty + wallet)
  savingsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  savingsLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 8 },
  savingsIconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.accentTint,
    alignItems: 'center', justifyContent: 'center',
  },
  savingsTitle: { fontSize: 14, fontFamily: fontFamily.semibold, color: colors.ink },
  savingsSubtitle: { fontSize: 12, fontFamily: fontFamily.medium, color: colors.inkMuted, marginTop: 1 },

  // Payment
  paymentRow: { flexDirection: 'row', gap: 10 },
  payBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface, alignItems: 'center',
  },
  payBtnActive: { borderColor: ACCENT, backgroundColor: colors.accentTint },
  payBtnText: { fontSize: 13, fontFamily: fontFamily.semibold, color: colors.inkMuted },
  payBtnTextActive: { color: ACCENT, fontFamily: fontFamily.bold },

  // Bill
  billRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10,
  },
  billLabel: { fontSize: 14, fontFamily: fontFamily.medium, color: colors.inkMuted },
  billValue: { fontSize: 14, fontFamily: fontFamily.semibold, color: colors.ink },

  totalSeparator: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 14, fontFamily: fontFamily.bold, color: colors.ink },
  totalValue: { fontSize: 22, fontFamily: fontFamily.black, color: colors.ink, letterSpacing: -0.5 },

  // Out-of-zone
  outOfZoneBanner: {
    backgroundColor: colors.dangerTint, borderRadius: 12,
    padding: 14,
  },
  outOfZoneText: { fontSize: 13, fontFamily: fontFamily.medium, color: colors.danger, textAlign: 'center', lineHeight: 19 },

  // Footer
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: BG,
    paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  placeOrderBtn: {
    height: 58, borderRadius: 18,
    backgroundColor: ACCENT,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  placeOrderBtnDisabled: { opacity: 0.55 },
  placeOrderContent: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  placeOrderText: { fontSize: 17, fontFamily: fontFamily.extrabold, color: '#FFFFFF' },
  placeOrderRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  placeOrderTotal: { fontSize: 17, fontFamily: fontFamily.bold, color: 'rgba(255,255,255,0.9)' },
  placeOrderArrow: { fontSize: 22, color: '#FFFFFF', marginTop: -1 },

  // Empty state
  emptyContainer: {
    flex: 1, backgroundColor: BG,
    alignItems: 'center', justifyContent: 'center', padding: 40,
  },
  emptyIconBox: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: colors.accentTint, alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  emptyTitle: { fontSize: 22, fontFamily: fontFamily.black, color: colors.ink, marginBottom: 8 },
  emptySub: { fontSize: 14, fontFamily: fontFamily.medium, color: colors.inkMuted, textAlign: 'center', lineHeight: 22 },
  exploreBtn: {
    marginTop: 28, backgroundColor: ACCENT,
    paddingHorizontal: 32, paddingVertical: 14, borderRadius: 16,
  },
  exploreBtnText: { fontSize: 14, fontFamily: fontFamily.extrabold, color: '#FFFFFF' },

  // Verifying overlay
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 9999,
  },
  overlayTitle: { marginTop: 20, fontSize: 20, fontFamily: fontFamily.extrabold, color: colors.ink },
  overlaySub: { marginTop: 8, fontSize: 13, fontFamily: fontFamily.medium, color: colors.inkMuted, textAlign: 'center' },
});
