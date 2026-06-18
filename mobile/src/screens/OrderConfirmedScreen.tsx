import React, { useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  FadeInDown, SlideInDown,
} from 'react-native-reanimated';
import {
  ArrowLeft, ShoppingBag, MapPin, Package,
  ChefHat, Bike, CircleCheck, Navigation, MessageCircle,
} from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';

const { height: SCREEN_H } = Dimensions.get('window');
const HERO_H = Math.round(SCREEN_H * 0.44);

// ── Progress step ─────────────────────────────────────────────────────────────
const STEPS = [
  { key: 'confirmed',         label: 'Confirmed',  Icon: ShoppingBag },
  { key: 'preparing',         label: 'Preparing',  Icon: ChefHat     },
  { key: 'ready_for_pickup',  label: 'Pickup',     Icon: Package     },
  { key: 'out_for_delivery',  label: 'On the Way', Icon: Bike        },
  { key: 'delivered',         label: 'Delivered',  Icon: CircleCheck },
];

const STATUS_ORDER = ['confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered'];

const stepIndex = (status: string) => {
  const i = STATUS_ORDER.indexOf(status);
  return i === -1 ? 0 : i;
};

const ProgressTracker = ({ status }: { status: string }) => {
  const current = stepIndex(status);
  return (
    <View style={track.row}>
      {STEPS.map(({ key, label, Icon }, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <React.Fragment key={key}>
            <View style={track.step}>
              <View style={[
                track.circle,
                done && track.circleDone,
                active && track.circleActive,
              ]}>
                <Icon
                  size={14}
                  color={done ? colors.white : active ? colors.white : colors.inkFaint}
                  strokeWidth={2.5}
                />
              </View>
              <Text style={[track.label, (done || active) && track.labelActive]}>
                {label}
              </Text>
            </View>
            {i < STEPS.length - 1 && (
              <View style={[track.line, done && track.lineDone]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
};

const track = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  step: { alignItems: 'center', width: 52 },
  circle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  circleDone: { backgroundColor: colors.primary },
  circleActive: { backgroundColor: colors.ink },
  label: { fontSize: 9, fontFamily: fontFamily.semibold, color: colors.inkFaint, marginTop: 5, textAlign: 'center' },
  labelActive: { color: colors.ink },
  line: { flex: 1, height: 2, backgroundColor: '#E5E7EB', marginBottom: 18, borderRadius: 1 },
  lineDone: { backgroundColor: colors.primary },
});

// ─────────────────────────────────────────────────────────────────────────────
const OrderConfirmedScreen = ({ route, navigation }: any) => {
  const { orderId } = route.params;
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  // Animated bag icon entrance
  const scale = useSharedValue(0.3);
  const opacity = useSharedValue(0);
  useEffect(() => {
    scale.value = withSpring(1, { stiffness: 260, damping: 18 });
    opacity.value = withTiming(1, { duration: 400 });
  }, []);
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  // Fetch order details
  const { data: orderData, isLoading } = useQuery({
    queryKey: ['order-confirmed', orderId],
    queryFn: () => api.get(`/orders/${orderId}`),
    refetchInterval: 8000,
  });
  const o = orderData?.order;
  const items: any[] = o?.items || [];

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/orders/${orderId}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-confirmed', orderId] });
      queryClient.invalidateQueries({ queryKey: ['order-history'] });
      Alert.alert('Cancelled', 'Your order has been cancelled. Refund will be added to your wallet.');
    },
    onError: () => Alert.alert('Error', 'Could not cancel the order at this time.'),
  });

  const handleCancel = () => {
    Alert.alert('Cancel Order', 'Are you sure? Refund will go to your wallet.', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes, Cancel', style: 'destructive', onPress: () => cancelMutation.mutate() },
    ]);
  };

  const status = o?.status || 'confirmed';
  const canCancel = !!o && ['pending_payment', 'confirmed'].includes(status);

  const subtotal    = o ? o.subtotal_paise / 100 : 0;
  const delivery    = o ? (o.delivery_fee_paise + (o.surge_paise || 0)) / 100 : 0;
  const tax         = o ? ((o.cgst_paise || 0) + (o.sgst_paise || 0)) / 100 : 0;
  const discount    = o ? (o.discount_paise || 0) / 100 : 0;
  const loyalty     = o ? (o.loyalty_discount_paise || 0) / 100 : 0;
  const wallet      = o ? (o.wallet_deduction_paise || 0) / 100 : 0;
  const total       = o ? o.total_amount_paise / 100 : 0;

  return (
    <View style={styles.root}>

      {/* ── Hero ── */}
      <View style={[styles.hero, { paddingTop: insets.top + 8 }]}>
        {/* Header row */}
        <View style={styles.heroHeader}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <ArrowLeft size={20} color={colors.ink} />
          </TouchableOpacity>
          {o?.display_id && (
            <View style={styles.orderIdBadge}>
              <Text style={styles.orderIdText}>#{o.display_id}</Text>
            </View>
          )}
          <View style={{ width: 40 }} />
        </View>

        {/* Animated icon */}
        <View style={styles.heroIconWrap}>
          <Animated.View style={[styles.heroIconBox, iconStyle]}>
            <ShoppingBag size={52} color={colors.primary} strokeWidth={1.8} />
          </Animated.View>
        </View>
      </View>

      {/* ── Sheet ── */}
      <Animated.View entering={SlideInDown.duration(380)} style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScroll}>

          {/* Title */}
          <Text style={styles.title}>Order Confirmed!</Text>
          <Text style={styles.subtitle}>We have received your order</Text>

          {/* Progress tracker */}
          <View style={styles.trackerWrap}>
            <ProgressTracker status={status} />
          </View>

          {/* Live Track button */}
          <TouchableOpacity
            style={styles.trackBtn}
            activeOpacity={0.88}
            onPress={() => navigation.navigate('OrderTracking', { orderId })}
          >
            <Navigation size={16} color={colors.white} />
            <Text style={styles.trackBtnText}>Live Track Order</Text>
          </TouchableOpacity>

          {/* Delivery address */}
          {o && (
            <Animated.View entering={FadeInDown.delay(80)} style={styles.section}>
              <View style={styles.addressCard}>
                <View style={styles.addressIconBox}>
                  <MapPin size={16} color={ACCENT} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.addressCardLabel}>DELIVERY ADDRESS</Text>
                  <Text style={styles.addressCardText}>
                    {o.delivery_address_text || o.address_text || '—'}
                  </Text>
                  {(o.delivery_address_label || o.label) && (
                    <View style={styles.labelPill}>
                      <Text style={styles.labelPillText}>
                        {(o.delivery_address_label || o.label || '').toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </Animated.View>
          )}

          {/* Items ordered */}
          {items.length > 0 && (
            <Animated.View entering={FadeInDown.delay(120)} style={styles.section}>
              <Text style={styles.sectionTitle}>Items Ordered</Text>
              {items.map((item: any, i: number) => (
                <View key={i} style={styles.itemRow}>
                  <View style={styles.itemQtyBadge}>
                    <Text style={styles.itemQtyText}>{item.quantity}×</Text>
                  </View>
                  <Text style={styles.itemName} numberOfLines={1}>{item.menu_item_name || item.name}</Text>
                  <Text style={styles.itemPrice}>
                    ₹{((item.price_paise * item.quantity) / 100).toFixed(0)}
                  </Text>
                </View>
              ))}
            </Animated.View>
          )}

          {/* Bill */}
          {o && (
            <Animated.View entering={FadeInDown.delay(150)} style={[styles.section, styles.billSection]}>
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Subtotal</Text>
                <Text style={styles.billValue}>₹{subtotal.toFixed(0)}</Text>
              </View>
              {delivery > 0 && (
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Delivery & Surge</Text>
                  <Text style={styles.billValue}>₹{delivery.toFixed(0)}</Text>
                </View>
              )}
              {tax > 0 && (
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Taxes (GST)</Text>
                  <Text style={styles.billValue}>₹{tax.toFixed(2)}</Text>
                </View>
              )}
              {discount > 0 && (
                <View style={styles.billRow}>
                  <Text style={[styles.billLabel, { color: colors.success }]}>Promo Discount</Text>
                  <Text style={[styles.billValue, { color: colors.success }]}>−₹{discount.toFixed(0)}</Text>
                </View>
              )}
              {loyalty > 0 && (
                <View style={styles.billRow}>
                  <Text style={[styles.billLabel, { color: colors.success }]}>Loyalty Points</Text>
                  <Text style={[styles.billValue, { color: colors.success }]}>−₹{loyalty.toFixed(0)}</Text>
                </View>
              )}
              {wallet > 0 && (
                <View style={styles.billRow}>
                  <Text style={[styles.billLabel, { color: colors.primary }]}>Wallet</Text>
                  <Text style={[styles.billValue, { color: colors.primary }]}>−₹{wallet.toFixed(2)}</Text>
                </View>
              )}
              <View style={styles.billDivider} />
              <View style={styles.billRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>₹{total.toFixed(2)}</Text>
              </View>
            </Animated.View>
          )}

          {/* Cancel order */}
          {canCancel && (
            <Animated.View entering={FadeInDown.delay(180)} style={styles.cancelCard}>
              <View>
                <Text style={styles.cancelCardTitle}>Cancel Order</Text>
                <Text style={styles.cancelCardSub}>Refund to wallet</Text>
              </View>
              <TouchableOpacity
                style={[styles.cancelBtn, cancelMutation.isPending && { opacity: 0.6 }]}
                onPress={handleCancel}
                disabled={cancelMutation.isPending}
                activeOpacity={0.85}
              >
                {cancelMutation.isPending
                  ? <ActivityIndicator size="small" color={colors.white} />
                  : <Text style={styles.cancelBtnText}>Cancel</Text>}
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Help */}
          <Animated.View entering={FadeInDown.delay(200)} style={styles.helpCard}>
            <View>
              <Text style={styles.helpTitle}>Need help?</Text>
              <Text style={styles.helpSub}>Support available 24/7</Text>
            </View>
            <TouchableOpacity
              style={styles.helpBtn}
              onPress={() => navigation.navigate('Support')}
              activeOpacity={0.85}
            >
              <MessageCircle size={14} color={colors.ink} />
              <Text style={styles.helpBtnText}>Contact Us</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Back to home */}
          <TouchableOpacity
            style={styles.homeBtn}
            onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Home' }] })}
            activeOpacity={0.7}
          >
            <Text style={styles.homeBtnText}>Back to Home</Text>
          </TouchableOpacity>

          {isLoading && !o && (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
};

export default OrderConfirmedScreen;

const ACCENT = colors.accent;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primaryTint },

  // Hero
  hero: {
    height: HERO_H,
    backgroundColor: '#EAF1FF',
    paddingHorizontal: 20,
  },
  heroHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  orderIdBadge: {
    backgroundColor: '#FFFFFF', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  orderIdText: { fontSize: 13, fontFamily: fontFamily.bold, color: colors.ink },
  heroIconWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroIconBox: {
    width: 120, height: 120, borderRadius: 36,
    backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primary, shadowOpacity: 0.18, shadowRadius: 30, shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },

  // Sheet
  sheet: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -28,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: -4 },
    elevation: 10,
  },
  sheetHandle: {
    width: 44, height: 4, borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  sheetScroll: { paddingHorizontal: 20, paddingBottom: 48 },

  title: { fontSize: 28, fontFamily: fontFamily.black, color: colors.ink, letterSpacing: -0.5, marginTop: 16 },
  subtitle: { fontSize: 14, fontFamily: fontFamily.medium, color: colors.inkMuted, marginTop: 4, marginBottom: 20 },

  // Tracker
  trackerWrap: { marginBottom: 16 },

  // Live track button
  trackBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 14, paddingVertical: 14,
    marginBottom: 20,
  },
  trackBtnText: { fontSize: 15, fontFamily: fontFamily.bold, color: colors.white },

  // Sections
  section: {
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
    paddingTop: 16, marginBottom: 4,
  },
  sectionTitle: { fontSize: 15, fontFamily: fontFamily.bold, color: colors.ink, marginBottom: 12 },

  // Address card
  addressCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: colors.background, borderRadius: 14, padding: 14, gap: 12,
  },
  addressIconBox: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: colors.accentTint,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  addressCardLabel: {
    fontSize: 10, fontFamily: fontFamily.extrabold, color: colors.inkFaint,
    letterSpacing: 1, marginBottom: 4,
  },
  addressCardText: { fontSize: 14, fontFamily: fontFamily.semibold, color: colors.ink, lineHeight: 20 },
  labelPill: {
    alignSelf: 'flex-start', marginTop: 6,
    backgroundColor: '#E5E7EB', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  labelPillText: { fontSize: 10, fontFamily: fontFamily.bold, color: colors.inkMuted },

  // Items
  itemRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 10,
  },
  itemQtyBadge: {
    width: 32, alignItems: 'flex-start',
  },
  itemQtyText: { fontSize: 13, fontFamily: fontFamily.bold, color: ACCENT },
  itemName: { flex: 1, fontSize: 14, fontFamily: fontFamily.medium, color: colors.ink },
  itemPrice: { fontSize: 14, fontFamily: fontFamily.semibold, color: colors.ink },

  // Bill
  billSection: { paddingTop: 16 },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  billLabel: { fontSize: 14, fontFamily: fontFamily.regular, color: colors.inkMuted },
  billValue: { fontSize: 14, fontFamily: fontFamily.medium, color: colors.ink },
  billDivider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 10 },
  totalLabel: { fontSize: 15, fontFamily: fontFamily.bold, color: colors.ink },
  totalValue: { fontSize: 20, fontFamily: fontFamily.black, color: colors.ink, letterSpacing: -0.5 },

  // Cancel
  cancelCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.dangerTint, borderRadius: 16,
    padding: 16, marginTop: 16,
  },
  cancelCardTitle: { fontSize: 14, fontFamily: fontFamily.bold, color: colors.danger },
  cancelCardSub: { fontSize: 12, fontFamily: fontFamily.regular, color: colors.danger + 'AA', marginTop: 2 },
  cancelBtn: {
    backgroundColor: colors.danger, borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 10,
    minWidth: 80, alignItems: 'center',
  },
  cancelBtnText: { fontSize: 13, fontFamily: fontFamily.bold, color: colors.white },

  // Help
  helpCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 16, padding: 16, marginTop: 12,
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  helpTitle: { fontSize: 14, fontFamily: fontFamily.bold, color: colors.ink },
  helpSub: { fontSize: 12, fontFamily: fontFamily.regular, color: colors.inkMuted, marginTop: 2 },
  helpBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.surfaceMuted, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  helpBtnText: { fontSize: 13, fontFamily: fontFamily.semibold, color: colors.ink },

  // Home
  homeBtn: { alignItems: 'center', paddingVertical: 20 },
  homeBtnText: { fontSize: 14, fontFamily: fontFamily.semibold, color: colors.inkMuted },
});
