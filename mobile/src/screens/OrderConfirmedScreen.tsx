import React, { useEffect, useRef, useState } from 'react';
import { BouncingButton } from '../components/ui/BouncingButton';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Linking, Image
} from 'react-native';
import {
  ArrowLeft, MapPin, Package, ChefHat, Bike,
  CircleCheck, ShoppingBag, MessageCircle, Phone, UserCircle, Check, ShieldCheck,
} from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { api } from '../api/client';
import { getSocket } from '../socket/client';
import { RootState } from '../store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TrackingLeafletMap } from '../components/TrackingLeafletMap';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const HAPTIC = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };
const triggerHaptic = () => ReactNativeHapticFeedback.trigger('impactLight', HAPTIC);
const triggerSuccess = () => ReactNativeHapticFeedback.trigger('notificationSuccess', HAPTIC);

const calculateBearing = (sLat: number, sLng: number, dLat: number, dLng: number) => {
  const r = (v: number) => (v * Math.PI) / 180;
  const d = (v: number) => (v * 180) / Math.PI;
  const y = Math.sin(r(dLng) - r(sLng)) * Math.cos(r(dLat));
  const x = Math.cos(r(sLat)) * Math.sin(r(dLat)) - Math.sin(r(sLat)) * Math.cos(r(dLat)) * Math.cos(r(dLng) - r(sLng));
  return (d(Math.atan2(y, x)) + 360) % 360;
};

// ── Progress tracker ──────────────────────────────────────────────────────────
const STEPS = [
  { key: 'confirmed',        label: 'Confirmed', Icon: ShoppingBag },
  { key: 'preparing',        label: 'Preparing', Icon: ChefHat     },
  { key: 'ready_for_pickup', label: 'Ready',     Icon: Package     },
  { key: 'out_for_delivery', label: 'On the Way',Icon: Bike        },
  { key: 'delivered',        label: 'Delivered', Icon: CircleCheck },
];
const STATUS_ORDER = ['confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered'];
const stepIndex = (s: string) => { const i = STATUS_ORDER.indexOf(s); return i === -1 ? 0 : i; };

const ProgressTracker = ({ status }: { status: string }) => {
  const cur = stepIndex(status);
  return (
    <View style={tr.row}>
      {STEPS.map(({ key, label, Icon }, i) => {
        const done = i < cur, active = i === cur;
        return (
          <React.Fragment key={key}>
            <View style={tr.step}>
              <View style={[tr.circle, done && tr.done, active && tr.active]}>
                <Icon size={13} color={done || active ? '#fff' : colors.inkFaint} strokeWidth={2.5} />
              </View>
              <Text style={[tr.label, (done || active) && tr.labelOn]}>{label}</Text>
            </View>
            {i < STEPS.length - 1 && <View style={[tr.line, done && tr.lineDone]} />}
          </React.Fragment>
        );
      })}
    </View>
  );
};
const tr = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  step:    { alignItems: 'center', width: 52 },
  circle:  { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  done:    { backgroundColor: colors.primary },
  active:  { backgroundColor: colors.ink },
  label:   { fontSize: 9, fontFamily: fontFamily.semibold, color: colors.inkFaint, marginTop: 5, textAlign: 'center' },
  labelOn: { color: colors.ink },
  line:    { flex: 1, height: 2, backgroundColor: '#E5E7EB', marginBottom: 16, borderRadius: 1 },
  lineDone:{ backgroundColor: colors.primary },
});

// ─────────────────────────────────────────────────────────────────────────────
const OrderConfirmedScreen = ({ route, navigation }: any) => {
  const { orderId } = route.params;
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const socket = getSocket();
  const globalLocation = useSelector((state: RootState) => state.app.globalLocation);

  const { data: orderData, isLoading } = useQuery({
    queryKey: ['order-confirmed', orderId],
    queryFn: () => api.get(`/orders/${orderId}`),
    refetchInterval: 6000,
  });
  const o = orderData?.order;
  const items: any[] = o?.items || [];

  // Live rider location
  const [riderLocation, setRiderLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [heading, setHeading] = useState(0);
  const [status, setStatus] = useState('confirmed');
  const [etaMins, setEtaMins] = useState<number | null>(null);
  const [riderJustAssigned, setRiderJustAssigned] = useState(false);
  const prevRiderNameRef = useRef<string | null>(null);

  useEffect(() => {
    if (o?.status) setStatus(o.status);
    if (o?.rider_lat && o?.rider_lng) {
      setRiderLocation({ lat: parseFloat(o.rider_lat), lng: parseFloat(o.rider_lng) });
    }
    // Detect when a rider first gets assigned
    if (o?.rider_name && !prevRiderNameRef.current) {
      triggerSuccess();
      setRiderJustAssigned(true);
    }
    prevRiderNameRef.current = o?.rider_name || null;
  }, [o?.status, o?.rider_lat, o?.rider_lng, o?.rider_name]);

  useEffect(() => {
    if (!riderJustAssigned) return;
    const t = setTimeout(() => setRiderJustAssigned(false), 3000);
    return () => clearTimeout(t);
  }, [riderJustAssigned]);

  useEffect(() => {
    if (!socket) return;
    socket.emit('join_order', orderId);
    socket.on('order_status_update', (data: any) => {
      if (data.orderId === orderId) {
        setStatus(data.status);
        if (data.status) triggerSuccess();
        queryClient.invalidateQueries({ queryKey: ['order-confirmed', orderId] });
      }
    });
    socket.on('rider_location', (data: any) => {
      setRiderLocation(prev => {
        if (prev) setHeading(calculateBearing(prev.lat, prev.lng, data.lat, data.lng));
        return { lat: data.lat, lng: data.lng };
      });
    });
    return () => { socket.off('order_status_update'); socket.off('rider_location'); };
  }, [socket, orderId]);

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

  const canCancel = !!o && ['pending_payment', 'confirmed'].includes(status);

  const customerLocation = o?.customer_lat && o?.customer_lng
    ? { lat: parseFloat(o.customer_lat), lng: parseFloat(o.customer_lng) } : null;
  const kitchenLocation = o?.kitchen_lat && o?.kitchen_lng
    ? { lat: parseFloat(o.kitchen_lat), lng: parseFloat(o.kitchen_lng) } : null;

  const subtotal = o ? o.subtotal_paise / 100 : 0;
  const delivery = o ? (o.delivery_fee_paise + (o.surge_paise || 0)) / 100 : 0;
  const tax      = o ? ((o.cgst_paise || 0) + (o.sgst_paise || 0)) / 100 : 0;
  const discount = o ? (o.discount_paise || 0) / 100 : 0;
  const loyalty  = o ? (o.loyalty_discount_paise || 0) / 100 : 0;
  const wallet   = o ? (o.wallet_deduction_paise || 0) / 100 : 0;
  const total    = o ? o.total_amount_paise / 100 : 0;

  const estTime = status === 'delivered' ? 'Delivered'
    : etaMins != null ? `${etaMins} min${etaMins === 1 ? '' : 's'}`
    : status === 'out_for_delivery' ? '~10 mins'
    : status === 'ready_for_pickup' ? '~15 mins' : '~25 mins';

  return (
    <View style={styles.root}>

      {/* ── Live Map ── */}
      <View style={styles.mapContainer}>
        <TrackingLeafletMap
          riderLocation={riderLocation}
          customerLocation={customerLocation}
          kitchenLocation={kitchenLocation}
          riderHeading={heading}
          initialLat={customerLocation?.lat ?? globalLocation?.latitude ?? 20.5937}
          initialLng={customerLocation?.lng ?? globalLocation?.longitude ?? 78.9629}
          initialZoom={customerLocation ? 15 : globalLocation ? 14 : 5}
          onEtaUpdate={setEtaMins}
          style={StyleSheet.absoluteFill}
        />
        {/* Floating back button */}
        <BouncingButton
          style={[styles.backBtn, { top: insets.top + 12 }]}
          onPress={() => { 
            triggerHaptic(); 
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('Home');
            }
          }}
          activeOpacity={0.85}
        >
          <ArrowLeft size={20} color={colors.ink} />
        </BouncingButton>
        {/* Order ID badge */}
        {o?.display_id && (
          <View style={[styles.orderIdBadge, { top: insets.top + 16 }]}>
            <Text style={styles.orderIdText}>#{o.display_id}</Text>
          </View>
        )}
      </View>

      {/* ── Bottom sheet ── */}
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScroll}>

          {/* ETA row */}
          <View style={styles.etaRow}>
            <View>
              <Text style={styles.etaLabel}>ESTIMATED ARRIVAL</Text>
              <Text style={styles.etaValue}>{estTime}</Text>
            </View>
            <View style={styles.onTimeBadge}>
              <Text style={styles.onTimeText}>ON TIME</Text>
            </View>
          </View>

          {/* Progress tracker */}
          <ProgressTracker status={status} />

          {/* Delivery OTP */}
          {status === 'out_for_delivery' && o?.delivery_otp && (
            <View style={styles.otpCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.otpLabel}>YOUR DELIVERY CODE</Text>
                <Text style={styles.otpCode}>{o.delivery_otp}</Text>
                <Text style={styles.otpHint}>Share this with your delivery partner</Text>
              </View>
              <ShieldCheck size={28} color={colors.primary} />
            </View>
          )}

          {/* Rider card */}
          {status === 'delivered' && o?.invoice_url ? (
            <View style={[styles.riderCard, styles.riderCardGreen]}>
              <View style={[styles.riderAvatar, { backgroundColor: colors.primary }]}>
                <Check size={22} color="#fff" strokeWidth={3} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.riderMeta, { color: colors.primary }]}>FINANCIAL RECORD</Text>
                <Text style={styles.riderName}>Invoice is Ready</Text>
              </View>
              <BouncingButton
                style={[styles.riderAction, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={() => Linking.openURL(o.invoice_url)}
              >
                <Text style={{ color: '#fff', fontFamily: fontFamily.extrabold, fontSize: 10 }}>VIEW</Text>
              </BouncingButton>
            </View>
          ) : (
            <View
              style={[
                styles.riderCard,
                o?.rider_name && styles.riderCardAssigned,
                riderJustAssigned && styles.riderCardPulse,
              ]}
            >
              <View style={[styles.riderAvatar, o?.rider_name && { backgroundColor: '#E8F5E9' }]}>
                <UserCircle size={26} color={o?.rider_name ? colors.primary : colors.inkFaint} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.riderMeta}>{o?.rider_name ? 'DELIVERY PARTNER' : 'FINDING PARTNER'}</Text>
                <Text style={[styles.riderName, !o?.rider_name && { color: colors.inkMuted, fontSize: 15 }]}>
                  {o?.rider_name || 'Assigning...'}
                </Text>
              </View>
              {o?.rider_phone && (
                <BouncingButton
                  style={[styles.riderAction, styles.riderCallBtn]}
                  onPress={() => { triggerHaptic(); Linking.openURL(`tel:${o.rider_phone}`); }}
                >
                  <Phone size={17} color="#fff" />
                </BouncingButton>
              )}
            </View>
          )}

          {/* Delivery address */}
          {o && (
            <View style={styles.section}>
              <View style={styles.addressCard}>
                <View style={styles.addressIconBox}>
                  <MapPin size={15} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.addressLabel}>DELIVERY ADDRESS</Text>
                  <Text style={styles.addressText}>{o.delivery_address_text || o.address_text || '—'}</Text>
                  {(o.delivery_address_label || o.label) && (
                    <View style={styles.labelPill}>
                      <Text style={styles.labelPillText}>
                        {(o.delivery_address_label || o.label || '').toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* Items */}
          {items.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Items Ordered</Text>
              {items.map((item: any, i: number) => (
                <View key={i} style={styles.itemRowWrapper}>
                  <View style={styles.itemRow}>
                    <Text style={styles.itemQty}>{item.quantity}×</Text>
                    <Text style={styles.itemName} numberOfLines={1}>{item.menu_item_name || item.name}</Text>
                    <Text style={styles.itemPrice}>₹{((item.price_paise * item.quantity) / 100).toFixed(0)}</Text>
                  </View>
                  {item.customizations && item.customizations.length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6, marginBottom: 6, marginLeft: 30 }}>
                      {item.customizations.map((c: any, idx: number) => (
                        <View key={idx} style={{ 
                          flexDirection: 'row', alignItems: 'center', 
                          backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', 
                          borderRadius: 8, padding: 4, paddingRight: 8 
                        }}>
                          {!!c.photo_url && (
                            <Image source={{ uri: c.photo_url }} style={{ width: 18, height: 18, borderRadius: 4, marginRight: 6, backgroundColor: '#f1f1f1' }} />
                          )}
                          <Text style={{ fontSize: 10, fontFamily: fontFamily.medium, color: colors.inkMuted }} numberOfLines={1}>
                            {c.group}: <Text style={{ fontFamily: fontFamily.bold, color: colors.ink }}>{c.option}</Text>
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Bill */}
          {o && (
            <View style={styles.section}>
              <View style={styles.billRow}><Text style={styles.billLabel}>Subtotal</Text><Text style={styles.billValue}>₹{subtotal.toFixed(0)}</Text></View>
              {delivery > 0 && <View style={styles.billRow}><Text style={styles.billLabel}>Delivery & Surge</Text><Text style={styles.billValue}>₹{delivery.toFixed(0)}</Text></View>}
              {tax > 0 && <View style={styles.billRow}><Text style={styles.billLabel}>Taxes (GST)</Text><Text style={styles.billValue}>₹{tax.toFixed(2)}</Text></View>}
              {discount > 0 && <View style={styles.billRow}><Text style={[styles.billLabel, { color: colors.success }]}>Promo Discount</Text><Text style={[styles.billValue, { color: colors.success }]}>−₹{discount.toFixed(0)}</Text></View>}
              {loyalty > 0 && <View style={styles.billRow}><Text style={[styles.billLabel, { color: colors.success }]}>Loyalty Points</Text><Text style={[styles.billValue, { color: colors.success }]}>−₹{loyalty.toFixed(0)}</Text></View>}
              {wallet > 0 && <View style={styles.billRow}><Text style={[styles.billLabel, { color: colors.primary }]}>Wallet</Text><Text style={[styles.billValue, { color: colors.primary }]}>−₹{wallet.toFixed(2)}</Text></View>}
              <View style={styles.billDivider} />
              <View style={styles.billRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>₹{total.toFixed(2)}</Text>
              </View>
            </View>
          )}

          {/* Cancel */}
          {canCancel && (
            <View style={styles.cancelCard}>
              <View>
                <Text style={styles.cancelTitle}>Cancel Order</Text>
                <Text style={styles.cancelSub}>Refund to wallet</Text>
              </View>
              <BouncingButton
                style={[styles.cancelBtn, cancelMutation.isPending && { opacity: 0.6 }]}
                onPress={handleCancel}
                disabled={cancelMutation.isPending}
                activeOpacity={0.85}
              >
                {cancelMutation.isPending
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.cancelBtnText}>Cancel</Text>}
              </BouncingButton>
            </View>
          )}

          {/* Help */}
          <View style={styles.helpCard}>
            <View>
              <Text style={styles.helpTitle}>Need help?</Text>
              <Text style={styles.helpSub}>Support available 24/7</Text>
            </View>
            <BouncingButton
              style={styles.helpBtn}
              onPress={() => navigation.navigate('Support')}
              activeOpacity={0.85}
            >
              <MessageCircle size={14} color={colors.ink} />
              <Text style={styles.helpBtnText}>Contact Us</Text>
            </BouncingButton>
          </View>

          {/* Back to home */}
          <BouncingButton
            style={styles.homeBtn}
            onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Home' }] })}
            activeOpacity={0.7}
          >
            <Text style={styles.homeBtnText}>Back to Home</Text>
          </BouncingButton>

          {isLoading && !o && <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />}
        </ScrollView>
      </View>
    </View>
  );
};

export default OrderConfirmedScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0ede9' },

  // Map
  mapContainer: { height: '48%', backgroundColor: '#f0ede9' },

  // Floating overlays on map
  backBtn: {
    position: 'absolute', left: 20,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  orderIdBadge: {
    position: 'absolute', alignSelf: 'center', left: 0, right: 0, marginHorizontal: 80,
    backgroundColor: '#fff', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 9, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  orderIdText: { fontSize: 13, fontFamily: fontFamily.bold, color: colors.ink },

  // Sheet
  sheet: {
    flex: 1, backgroundColor: '#fff',
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    marginTop: -32,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: -6 },
    elevation: 12,
  },
  sheetHandle: { width: 44, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginTop: 12, marginBottom: 2 },
  sheetScroll: { paddingHorizontal: 20, paddingBottom: 48 },

  // ETA
  etaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 16 },
  etaLabel: { fontSize: 10, fontFamily: fontFamily.extrabold, color: colors.inkFaint, letterSpacing: 1.5 },
  etaValue: { fontSize: 34, fontFamily: fontFamily.black, color: colors.ink, letterSpacing: -1, marginTop: 2 },
  onTimeBadge: { backgroundColor: '#ECFDF5', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  onTimeText: { color: colors.primary, fontFamily: fontFamily.extrabold, fontSize: 10, letterSpacing: 1 },

  // OTP
  otpCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F0FDF4', borderRadius: 16, padding: 16, marginVertical: 12,
    borderWidth: 1.5, borderColor: '#BBF7D0',
  },
  otpLabel: { fontSize: 9, fontFamily: fontFamily.extrabold, color: '#059669', letterSpacing: 1.5, marginBottom: 4 },
  otpCode: { fontSize: 34, fontFamily: fontFamily.black, color: colors.ink, letterSpacing: 8 },
  otpHint: { fontSize: 11, fontFamily: fontFamily.regular, color: colors.inkMuted, marginTop: 4 },

  // Rider
  riderCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 20, padding: 18, marginVertical: 12,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: '#fff',
  },
  riderCardGreen:    { backgroundColor: '#F0FDF4', borderColor: '#D1FAE5' },
  riderCardAssigned: { borderColor: colors.primary, borderWidth: 1.5 },
  riderCardPulse:    { backgroundColor: '#F0FDF4', borderColor: colors.primary, borderWidth: 2 },
  riderCallBtn:      { backgroundColor: colors.primary, borderColor: colors.primary },
  riderAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  riderMeta: { fontSize: 10, fontFamily: fontFamily.extrabold, color: colors.inkFaint, letterSpacing: 1 },
  riderName: { fontSize: 17, fontFamily: fontFamily.extrabold, color: colors.ink, marginTop: 2 },
  riderAction: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },

  // Sections
  section: { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 16, marginBottom: 4 },
  sectionTitle: { fontSize: 15, fontFamily: fontFamily.bold, color: colors.ink, marginBottom: 12 },

  // Address
  addressCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.background, borderRadius: 14, padding: 14, gap: 12 },
  addressIconBox: { width: 32, height: 32, borderRadius: 9, backgroundColor: colors.accentTint, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  addressLabel: { fontSize: 10, fontFamily: fontFamily.extrabold, color: colors.inkFaint, letterSpacing: 1, marginBottom: 4 },
  addressText: { fontSize: 14, fontFamily: fontFamily.semibold, color: colors.ink, lineHeight: 20 },
  labelPill: { alignSelf: 'flex-start', marginTop: 6, backgroundColor: '#E5E7EB', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  labelPillText: { fontSize: 10, fontFamily: fontFamily.bold, color: colors.inkMuted },

  // Items
  itemRowWrapper: { marginBottom: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start' },
  itemQty: { width: 30, fontSize: 13, fontFamily: fontFamily.bold, color: colors.accent },
  itemName: { flex: 1, fontSize: 14, fontFamily: fontFamily.medium, color: colors.ink },
  itemCustomizations: { fontSize: 11, fontFamily: fontFamily.medium, color: colors.inkMuted, marginTop: 4, marginLeft: 30, marginBottom: 4 },
  itemPrice: { fontSize: 14, fontFamily: fontFamily.semibold, color: colors.ink },

  // Bill
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  billLabel: { fontSize: 14, fontFamily: fontFamily.regular, color: colors.inkMuted },
  billValue: { fontSize: 14, fontFamily: fontFamily.medium, color: colors.ink },
  billDivider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 8 },
  totalLabel: { fontSize: 15, fontFamily: fontFamily.bold, color: colors.ink },
  totalValue: { fontSize: 20, fontFamily: fontFamily.black, color: colors.ink, letterSpacing: -0.5 },

  // Cancel
  cancelCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.dangerTint, borderRadius: 16, padding: 16, marginTop: 16 },
  cancelTitle: { fontSize: 14, fontFamily: fontFamily.bold, color: colors.danger },
  cancelSub: { fontSize: 12, fontFamily: fontFamily.regular, color: colors.danger + 'AA', marginTop: 2 },
  cancelBtn: { backgroundColor: colors.danger, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10, minWidth: 80, alignItems: 'center' },
  cancelBtnText: { fontSize: 13, fontFamily: fontFamily.bold, color: '#fff' },

  // Help
  helpCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 16, padding: 16, marginTop: 12, borderWidth: 1, borderColor: '#F3F4F6' },
  helpTitle: { fontSize: 14, fontFamily: fontFamily.bold, color: colors.ink },
  helpSub: { fontSize: 12, fontFamily: fontFamily.regular, color: colors.inkMuted, marginTop: 2 },
  helpBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surfaceMuted, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  helpBtnText: { fontSize: 13, fontFamily: fontFamily.semibold, color: colors.ink },

  // Home
  homeBtn: { alignItems: 'center', paddingVertical: 20 },
  homeBtnText: { fontSize: 14, fontFamily: fontFamily.semibold, color: colors.inkMuted },
});
