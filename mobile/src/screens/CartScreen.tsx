import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Image,
  ActivityIndicator, Alert, StyleSheet, Switch,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { RootState } from '../store';
import { api } from '../api/client';
import { setQuantity, clearCart, setPromoCode as setPromoCodeAction } from '../store/slices/cartSlice';
import { getSocket } from '../socket/client';
import { MapPin, ShoppingCart, X, ChefHat } from 'lucide-react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import Animated, { FadeIn, FadeInDown, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import { spacing } from '../theme/spacing';
import RazorpayCheckout from 'react-native-razorpay';

const hapticOptions = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };
const triggerHaptic = () => ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);

const ACCENT = colors.accent; // #D97B4F

// ── Loading overlay shown while verifying payment ──────────────────────────
const VerifyingOverlay = () => (
  <View style={styles.overlay}>
    <ActivityIndicator size="large" color={ACCENT} />
    <Text style={styles.overlayTitle}>Verifying Payment</Text>
    <Text style={styles.overlaySub}>Confirming your order with the kitchen…</Text>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
const CartScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const { items, addressId } = useSelector((state: RootState) => state.cart);
  const { user } = useSelector((state: RootState) => state.auth);

  const [promoCode, setPromoCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cod'>('online');
  const [useLoyalty, setUseLoyalty] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // ── Socket invalidations ─────────────────────────────────────────────────
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

  // ── Queries ──────────────────────────────────────────────────────────────
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
    queryKey: ['your-order-pricing', items, addressId, promoCode, useLoyalty],
    queryFn: () =>
      api.post('/payment/create-order', {
        items,
        addressId,
        promoCode,
        useLoyalty,
        dryRun: true,
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
  };
  const subtotal = p.subtotalPaise / 100;
  const deliveryFee = p.deliveryFeePaise / 100;
  const tax = ((p.gstPaise || 0) + (p.cgstPaise || 0) + (p.sgstPaise || 0)) / 100;
  const grandTotal = p.gatewayAmountPaise / 100;

  // ── verifyOrder polling ──────────────────────────────────────────────────
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

  // ── Place order mutation ─────────────────────────────────────────────────
  const placeOrderMutation = useMutation({
    mutationFn: (data: any) => api.post('/payment/create-order', data),
    onSuccess: (res: any) => {
      if (res.status === 'confirmed') {
        dispatch(clearCart());
        navigation.navigate('OrderConfirmed', { orderId: res.orderId });
        return;
      }

      // Dev mock payment
      if (__DEV__ && !res.keyId) {
        api
          .post('/payment/mock-success', { razorpayOrderId: res.razorpayOrderId })
          .then(() => verifyOrder(res.orderId))
          .catch((err: any) => Alert.alert('Mock Payment Failed', err.message));
        return;
      }

      // Real Razorpay flow
      const options = {
        description: '2QT Food Order',
        currency: 'INR',
        key: res.keyId,
        amount: res.amount,
        name: '2QT',
        order_id: res.razorpayOrderId,
        prefill: {
          email: user?.email || 'customer@2qt.app',
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
          .catch((err: any) => Alert.alert('Payment Failed', err.description || 'Transaction cancelled'));
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
    placeOrderMutation.mutate({
      items,
      addressId,
      promoCode,
      useLoyalty,
      paymentMethod,
      dryRun: false,
    });
  };

  // ── Empty cart ───────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Animated.View entering={FadeIn.duration(600)} style={styles.emptyIconBox}>
          <ShoppingCart size={48} color={ACCENT} />
        </Animated.View>
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptySub}>Discover our delicious menu and add something tasty!</Text>
        <TouchableOpacity
          style={styles.exploreBtn}
          onPress={() => {
            triggerHaptic();
            navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
          }}
        >
          <Text style={styles.exploreBtnText}>Explore Menu</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const busy = placeOrderMutation.isPending || pricingFetching;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {isVerifying && <VerifyingOverlay />}

      {/* ── Header ──────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Your Order</Text>
          <Text style={styles.headerSub}>{items.length} {items.length === 1 ? 'item' : 'items'}</Text>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={() => { triggerHaptic(); navigation.goBack(); }}>
          <X size={18} color={colors.ink} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 }}
      >
        {/* ── Cart items ──────────────────────────────────────────── */}
        <View style={styles.section}>
          {items.map((item) => (
            <Animated.View key={item.menuItemId} entering={FadeInDown.duration(300)} style={styles.itemRow}>
              <View style={styles.itemImgBox}>
                {item.photoUrl ? (
                  <Image source={{ uri: item.photoUrl }} style={styles.itemImg} />
                ) : (
                  <View style={[styles.itemImg, styles.itemImgPlaceholder]}>
                    <ChefHat size={24} color={colors.inkFaint} />
                  </View>
                )}
              </View>

              <View style={styles.itemMeta}>
                <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.itemPrice}>₹{item.pricePaise / 100}</Text>
              </View>

              <View style={styles.qtyRow}>
                <TouchableOpacity
                  style={styles.qtyMinus}
                  onPress={() => { triggerHaptic(); dispatch(setQuantity({ menuItemId: item.menuItemId, quantity: item.quantity - 1 })); }}
                >
                  <Text style={styles.qtyMinusText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.qtyNum}>{item.quantity}</Text>
                <TouchableOpacity
                  style={styles.qtyPlus}
                  onPress={() => { triggerHaptic(); dispatch(setQuantity({ menuItemId: item.menuItemId, quantity: item.quantity + 1 })); }}
                >
                  <Text style={styles.qtyPlusText}>+</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          ))}
        </View>

        <View style={styles.divider} />

        {/* ── Delivering To ───────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(50)} style={styles.addressCard}>
          <View style={styles.addressIconCircle}>
            <MapPin size={16} color={ACCENT} />
          </View>
          <View style={styles.addressBody}>
            <Text style={styles.addressLabel}>DELIVERING TO</Text>
            <Text style={styles.addressText} numberOfLines={1}>
              {selectedAddress
                ? (selectedAddress.label ? `${selectedAddress.label}, ${selectedAddress.address_text?.split(',')[0]}` : selectedAddress.address_text?.split(',').slice(0, 2).join(','))
                : (addressId ? 'Loading…' : 'No address selected')}
            </Text>
          </View>
          <TouchableOpacity onPress={() => { triggerHaptic(); navigation.navigate('Address'); }}>
            <Text style={styles.changeText}>CHANGE</Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.divider} />

        {/* ── Promo code ──────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(80)} style={styles.promoRow}>
          <TextInput
            style={styles.promoInput}
            placeholder="Promo code"
            placeholderTextColor={colors.inkFaint}
            value={promoCode}
            onChangeText={setPromoCode}
            autoCapitalize="characters"
          />
          <TouchableOpacity
            style={[styles.applyBtn, !promoCode && { opacity: 0.55 }]}
            disabled={!promoCode}
            onPress={() => { triggerHaptic(); queryClient.invalidateQueries({ queryKey: ['your-order-pricing'] }); }}
          >
            <Text style={styles.applyBtnText}>Apply</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* ── Loyalty toggle ──────────────────────────────────────── */}
        {!!loyaltyData?.points && (
          <Animated.View entering={FadeInDown.delay(100)} style={styles.loyaltyRow}>
            <Text style={styles.loyaltyText}>Use {loyaltyData.points} Loyalty Points</Text>
            <Switch
              value={useLoyalty}
              onValueChange={(v) => { triggerHaptic(); setUseLoyalty(v); }}
              trackColor={{ false: colors.border, true: `${ACCENT}44` }}
              thumbColor={useLoyalty ? ACCENT : '#ccc'}
            />
          </Animated.View>
        )}

        <View style={styles.divider} />

        {/* ── Payment Method ──────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(120)} style={styles.paymentSection}>
          <Text style={styles.paymentTitle}>Payment Method</Text>
          <View style={styles.paymentBtnsRow}>
            <TouchableOpacity
              style={[styles.payMethodBtn, paymentMethod === 'online' && styles.payMethodBtnActive]}
              onPress={() => { triggerHaptic(); setPaymentMethod('online'); }}
            >
              <Text style={[styles.payMethodText, paymentMethod === 'online' && styles.payMethodTextActive]}>
                Pay Online
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.payMethodBtn, paymentMethod === 'cod' && styles.payMethodBtnActive]}
              onPress={() => { triggerHaptic(); setPaymentMethod('cod'); }}
            >
              <Text style={[styles.payMethodText, paymentMethod === 'cod' && styles.payMethodTextActive]}>
                Cash on Delivery
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <View style={styles.divider} />

        {/* ── Bill breakdown ──────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(140)} style={styles.billSection}>
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
          {tax > 0 && (
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Taxes (GST)</Text>
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
        </Animated.View>

        <View style={styles.divider} />

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>TOTAL AMOUNT</Text>
          <Text style={styles.totalValue}>₹{grandTotal.toFixed(2)}</Text>
        </View>
      </ScrollView>

      {/* ── Place Order button ──────────────────────────────────── */}
      <Animated.View
        entering={SlideInDown.duration(400)}
        style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 12, 24) }]}
      >
        <TouchableOpacity
          style={[styles.placeOrderBtn, (busy || isOutOfZone) && { opacity: 0.6 }]}
          disabled={busy || isOutOfZone}
          activeOpacity={0.88}
          onPress={handlePlaceOrder}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.placeOrderText}>Place Order</Text>
              <Text style={styles.placeOrderArrow}>›</Text>
            </>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

export default CartScreen;

// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 28, fontFamily: fontFamily.black, color: colors.ink, letterSpacing: -0.5 },
  headerSub: { fontSize: 13, fontFamily: fontFamily.medium, color: colors.inkMuted, marginTop: 2 },
  closeBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },

  // Cart items
  section: { paddingHorizontal: 20, paddingVertical: 16 },
  itemRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16, padding: 12,
    marginBottom: 12,
    borderWidth: 1, borderColor: '#F0F0F0',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  itemImgBox: { width: 64, height: 64, borderRadius: 12, overflow: 'hidden', marginRight: 12 },
  itemImg: { width: '100%', height: '100%' },
  itemImgPlaceholder: { backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center' },
  itemMeta: { flex: 1, marginRight: 8 },
  itemName: { fontSize: 15, fontFamily: fontFamily.bold, color: colors.ink, marginBottom: 4 },
  itemPrice: { fontSize: 15, fontFamily: fontFamily.extrabold, color: ACCENT },

  // Qty stepper
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyMinus: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
    alignItems: 'center', justifyContent: 'center',
  },
  qtyMinusText: { fontSize: 18, color: colors.ink, fontFamily: fontFamily.bold },
  qtyNum: { fontSize: 15, fontFamily: fontFamily.extrabold, color: colors.ink, minWidth: 20, textAlign: 'center' },
  qtyPlus: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: ACCENT,
    alignItems: 'center', justifyContent: 'center',
  },
  qtyPlusText: { fontSize: 18, color: '#FFFFFF', fontFamily: fontFamily.bold },

  // Dividers
  divider: { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 20 },

  // Address card
  addressCard: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 20, marginVertical: 16,
    backgroundColor: '#FFF8F5',
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#FDEEE6',
  },
  addressIconCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FEE9DC',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  addressBody: { flex: 1 },
  addressLabel: { fontSize: 10, fontFamily: fontFamily.extrabold, color: colors.inkMuted, letterSpacing: 1, marginBottom: 2 },
  addressText: { fontSize: 14, fontFamily: fontFamily.bold, color: colors.ink },
  changeText: { fontSize: 12, fontFamily: fontFamily.extrabold, color: ACCENT, letterSpacing: 0.5 },

  // Promo
  promoRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 20, marginVertical: 16, gap: 10,
  },
  promoInput: {
    flex: 1, height: 50,
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 14, fontFamily: fontFamily.medium, color: colors.ink,
    backgroundColor: '#FAFAFA',
  },
  applyBtn: {
    height: 50, paddingHorizontal: 18, borderRadius: 14,
    backgroundColor: '#FEE9DC', borderWidth: 1, borderColor: '#FDEEE6',
    alignItems: 'center', justifyContent: 'center',
  },
  applyBtnText: { fontSize: 14, fontFamily: fontFamily.extrabold, color: ACCENT },

  // Loyalty
  loyaltyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 20, marginBottom: 16,
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 14,
    backgroundColor: '#FAFAFA',
  },
  loyaltyText: { fontSize: 14, fontFamily: fontFamily.semibold, color: colors.ink },

  // Payment method
  paymentSection: { paddingHorizontal: 20, paddingVertical: 16 },
  paymentTitle: { fontSize: 16, fontFamily: fontFamily.bold, color: colors.ink, marginBottom: 12 },
  paymentBtnsRow: { flexDirection: 'row', gap: 12 },
  payMethodBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF', alignItems: 'center',
  },
  payMethodBtnActive: { borderColor: ACCENT, backgroundColor: '#FFF8F5' },
  payMethodText: { fontSize: 13, fontFamily: fontFamily.semibold, color: colors.inkMuted },
  payMethodTextActive: { color: ACCENT, fontFamily: fontFamily.extrabold },

  // Bill
  billSection: { paddingHorizontal: 20, paddingVertical: 16 },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  billLabel: { fontSize: 14, fontFamily: fontFamily.medium, color: colors.inkMuted },
  billValue: { fontSize: 14, fontFamily: fontFamily.semibold, color: colors.ink },

  // Total
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  totalLabel: { fontSize: 12, fontFamily: fontFamily.extrabold, color: colors.inkMuted, letterSpacing: 1 },
  totalValue: { fontSize: 26, fontFamily: fontFamily.black, color: colors.ink, letterSpacing: -0.5 },

  // Footer & button
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  placeOrderBtn: {
    height: 56, borderRadius: 18,
    backgroundColor: ACCENT,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  placeOrderText: { fontSize: 17, fontFamily: fontFamily.extrabold, color: '#FFFFFF' },
  placeOrderArrow: { fontSize: 22, color: '#FFFFFF', marginLeft: 6, marginTop: -2 },

  // Empty
  emptyContainer: {
    flex: 1, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center', padding: 40,
  },
  emptyIconBox: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#FFF8F5', alignItems: 'center', justifyContent: 'center', marginBottom: 24,
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
