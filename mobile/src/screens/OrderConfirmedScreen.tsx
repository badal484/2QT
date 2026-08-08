import { tokens } from '../theme/tokens';
import React, { useEffect, useRef, useState } from 'react';
import { PressableScale } from '../components/ui/internal/PressableScale';
import {
  View, Text, StyleSheet, ScrollView,
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
import { haptics } from '../utils/haptics';
import { useFeedback } from '../context/FeedbackContext';
import Animated, { FadeInDown } from 'react-native-reanimated';

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
// packing is an internal kitchen stage between preparing and ready_for_pickup;
// show it as the "Preparing" step so the customer sees correct progress.
const stepIndex = (s: string) => {
  const normalized = s === 'packing' ? 'preparing' : s;
  const i = STATUS_ORDER.indexOf(normalized);
  return i === -1 ? 0 : i;
};

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
                <Icon size={13} color={done || active ? tokens.colors.textInverse : tokens.colors.textTertiary} strokeWidth={2.5} />
              </View>
              <Text allowFontScaling={false} style={[tr.label, (done || active) && tr.labelOn]}>{label}</Text>
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
  circle:  { width: 30, height: 30, borderRadius: 15, backgroundColor: tokens.colors.background, alignItems: 'center', justifyContent: 'center' },
  done:    { backgroundColor: tokens.colors.primary },
  active:  { backgroundColor: tokens.colors.textPrimary },
  label:   { fontSize: 9, fontFamily: tokens.typography.family.semibold, color: tokens.colors.textTertiary, marginTop: 5, textAlign: 'center' },
  labelOn: { color: tokens.colors.textPrimary },
  line:    { flex: 1, height: 2, backgroundColor: tokens.colors.border, marginBottom: 16, borderRadius: 1 },
  lineDone:{ backgroundColor: tokens.colors.primary },
});

// ─────────────────────────────────────────────────────────────────────────────
const OrderConfirmedScreen = ({ route, navigation }: any) => {
  const { orderId } = route.params;
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const socket = getSocket();
  const globalLocation = useSelector((state: RootState) => state.app.globalLocation);
  const { showDialog } = useFeedback();

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
      haptics.success();
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
        if (data.status) haptics.success();
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
    mutationFn: (refundType: 'wallet' | 'bank') => api.post(`/orders/${orderId}/cancel`, { refundType }),
    onSuccess: (_data, refundType) => {
      queryClient.invalidateQueries({ queryKey: ['order-confirmed', orderId] });
      queryClient.invalidateQueries({ queryKey: ['order-history'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      const msg = refundType === 'bank'
        ? 'Order cancelled. Your refund will reach your bank account in 5–7 business days.'
        : 'Order cancelled. Refund has been added to your 2QT wallet instantly.';
      showDialog({ title: 'Cancelled', message: msg });
    },
    onError: () => showDialog({ title: 'Error', message: 'Could not cancel the order at this time.' }),
  });

  const handleCancel = () => {
    // Offer bank refund only when order was paid online and gateway_payment_id exists
    const canBankRefund = o?.payment_method !== 'cod' && o?.payment_status === 'paid' && !!o?.gateway_payment_id;

    if (canBankRefund) {
      showDialog({
        title: 'Cancel Order',
        message: 'Where would you like your refund?',
        confirmText: 'Wallet (instant)',
        onConfirm: () => cancelMutation.mutate('wallet'),
        destructive: false, // This isn't purely destructive, it's a choice. But the next one is
      });
      // Currently showDialog supports 2 buttons (cancel and confirm). 
      // If we need a 3rd option, we might have to compromise or update showDialog.
      // Let's use a standard cancel for now. 
      // Wait, let's keep the standard Alert for the 3-option dialog.
      Alert.alert(
        'Cancel Order',
        'Where would you like your refund?',
        [
          { text: 'No, keep order', style: 'cancel' },
          {
            text: 'Wallet (instant)',
            onPress: () => cancelMutation.mutate('wallet'),
          },
          {
            text: 'Bank account (5–7 days)',
            style: 'destructive',
            onPress: () => cancelMutation.mutate('bank'),
          },
        ]
      );
    } else {
      showDialog({
        title: 'Cancel Order',
        message: o?.payment_status === 'paid'
          ? 'Your order will be cancelled and the refund will be added to your wallet instantly.'
          : 'Are you sure you want to cancel this order?',
        cancelText: 'No',
        confirmText: 'Yes, Cancel',
        destructive: true,
        onConfirm: () => cancelMutation.mutate('wallet'),
      });
    }
  };

  const canCancel = !!o && ['pending_payment', 'confirmed'].includes(status);

  const customerLocation = o?.customer_lat && o?.customer_lng
    ? { lat: parseFloat(o.customer_lat), lng: parseFloat(o.customer_lng) } : null;
  const kitchenLocation = o?.kitchen_lat && o?.kitchen_lng
    ? { lat: parseFloat(o.kitchen_lat), lng: parseFloat(o.kitchen_lng) } : null;

  const subtotal       = o ? o.subtotal_paise / 100 : 0;
  const delivery       = o ? (o.delivery_fee_paise + (o.surge_paise || 0)) / 100 : 0;
  const tax            = o ? ((o.cgst_paise || 0) + (o.sgst_paise || 0)) / 100 : 0;
  const menuOfferDisc  = o ? (o.menu_offer_discount_paise || 0) / 100 : 0;
  const discount       = o ? (o.discount_paise || 0) / 100 : 0;
  const loyalty        = o ? (o.loyalty_discount_paise || 0) / 100 : 0;
  const wallet         = o ? (o.wallet_deduction_paise || 0) / 100 : 0;
  const smallOrderFee  = o ? (o.small_order_fee_paise || 0) / 100 : 0;
  const riderTip       = o ? (o.rider_tip_paise || 0) / 100 : 0;
  const total          = o ? o.total_amount_paise / 100 : 0;

  const estTime = status === 'delivered' ? 'Delivered'
    : etaMins != null ? `${etaMins} min${etaMins === 1 ? '' : 's'}`
    : status === 'out_for_delivery' ? '~10 mins'
    : status === 'ready_for_pickup' ? '~15 mins' : '~25 mins';

  return (
    <View style={styles.root}>

      {/* ── Live Map / Placeholder ── */}
      <View style={styles.mapContainer}>
        {status === 'out_for_delivery' ? (
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
        ) : (
          <View style={styles.placeholderContainer}>
            {(() => {
              let Icon = ShoppingBag;
              let title = 'Order Confirmed';
              let sub = 'Restaurant has received your order';
              if (status === 'preparing' || status === 'packing') { Icon = ChefHat; title = 'Preparing Food'; sub = 'The kitchen is preparing your order'; }
              else if (status === 'ready_for_pickup') { Icon = Package; title = 'Ready for Pickup'; sub = 'Waiting for delivery partner'; }
              else if (status === 'delivered') { Icon = CircleCheck; title = 'Order Delivered'; sub = 'Enjoy your meal!'; }
              
              return (
                <View style={styles.placeholderContent}>
                  <View style={styles.placeholderIconBox}>
                    <Icon size={36} color={tokens.colors.primary} strokeWidth={2.5} />
                  </View>
                  <Text allowFontScaling={false} style={styles.placeholderTitle}>{title}</Text>
                  <Text allowFontScaling={false} style={styles.placeholderSub}>{sub}</Text>
                </View>
              );
            })()}
          </View>
        )}
        {/* Floating back button */}
        <PressableScale
          style={[styles.backBtn, { top: insets.top + 12 }]}
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('Home');
            }
          }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ArrowLeft size={20} color={tokens.colors.textPrimary} />
        </PressableScale>
        {/* Order ID badge */}
        {o?.display_id && (
          <View style={[styles.orderIdBadge, { top: insets.top + 16 }]}>
            <Text allowFontScaling={false} style={styles.orderIdText}>#{o.display_id}</Text>
          </View>
        )}
      </View>

      {/* ── Bottom sheet ── */}
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScroll}>

          {/* Progress tracker */}
          <Animated.View entering={FadeInDown.duration(300)} style={{ marginTop: 24, marginBottom: 12 }}>
            <ProgressTracker status={status} />
          </Animated.View>

          {/* Delivery OTP */}
          {status === 'out_for_delivery' && o?.delivery_otp && (
            <View style={styles.otpCard}>
              <View style={styles.otpInstructRow}>
                <ShieldCheck size={15} color={tokens.colors.success} />
                <Text allowFontScaling={false} style={styles.otpInstructTitle}>Before sharing this code</Text>
              </View>
              <Text allowFontScaling={false} style={styles.otpInstructBody}>
                Open your package with the rider present and check all items. Sharing this code confirms your order was delivered correctly.
              </Text>
              <View style={styles.otpDivider} />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexShrink: 1, paddingRight: 10 }}>
                  <Text allowFontScaling={false} style={styles.otpLabel}>YOUR DELIVERY CODE</Text>
                  <Text allowFontScaling={false} style={styles.otpCode} numberOfLines={1} adjustsFontSizeToFit>{o.delivery_otp}</Text>
                  <Text allowFontScaling={false} style={styles.otpHint}>Share only after checking your items</Text>
                </View>
                <ShieldCheck size={28} color={tokens.colors.primary} />
              </View>
            </View>
          )}

          {/* Rider card */}
          <Animated.View entering={FadeInDown.delay(80).duration(300)}>
          {status === 'delivered' && o?.invoice_url ? (
            <View style={[styles.riderCard, styles.riderCardGreen]}>
              <View style={[styles.riderAvatar, { backgroundColor: tokens.colors.primary }]}>
                <Check size={22} color={tokens.colors.textInverse} strokeWidth={3} />
              </View>
              <View style={{ flex: 1 }}>
                <Text allowFontScaling={false} style={[styles.riderMeta, { color: tokens.colors.primary }]}>FINANCIAL RECORD</Text>
                <Text allowFontScaling={false} style={styles.riderName}>Invoice is Ready</Text>
              </View>
              <PressableScale
                style={[styles.riderAction, { backgroundColor: tokens.colors.primary, borderColor: tokens.colors.primary }]}
                onPress={() => Linking.openURL(o.invoice_url)}
                accessibilityRole="button"
                accessibilityLabel="View invoice"
              >
                <Text allowFontScaling={false} style={{ color: tokens.colors.textInverse, fontFamily: tokens.typography.family.extrabold, fontSize: 10 }}>VIEW</Text>
              </PressableScale>
            </View>
          ) : (
            <View
              style={[
                styles.riderCard,
                o?.rider_name && styles.riderCardAssigned,
                riderJustAssigned && styles.riderCardPulse,
              ]}
            >
              <View style={[styles.riderAvatar, o?.rider_name && { backgroundColor: tokens.colors.successTint }]}>
                {o?.rider_photo_url ? (
                  <Image source={{ uri: o.rider_photo_url }} style={styles.riderAvatarPhoto} />
                ) : (
                  <UserCircle size={26} color={o?.rider_name ? tokens.colors.primary : tokens.colors.textTertiary} />
                )}
              </View>
              <View style={{ flex: 1, flexShrink: 1 }}>
                <Text allowFontScaling={false} style={styles.riderMeta}>{o?.rider_name ? 'DELIVERY PARTNER' : 'FINDING PARTNER'}</Text>
                <Text allowFontScaling={false} style={[styles.riderName, !o?.rider_name && { color: tokens.colors.textSecondary, fontSize: 15 }]} numberOfLines={1}>
                  {o?.rider_name || 'Assigning...'}
                </Text>
              </View>
              {o?.rider_phone && (
                <PressableScale
                  style={[styles.riderAction, styles.riderCallBtn]}
                  onPress={() => Linking.openURL(`tel:${o.rider_phone}`)}
                  accessibilityRole="button"
                  accessibilityLabel="Call delivery partner"
                >
                  <Phone size={17} color={tokens.colors.textInverse} />
                </PressableScale>
              )}
            </View>
          )}
          </Animated.View>

          {/* Delivery address */}
          {o && (
            <Animated.View entering={FadeInDown.delay(140).duration(300)} style={styles.section}>
              <View style={styles.addressCard}>
                <View style={styles.addressIconBox}>
                  <MapPin size={15} color={tokens.colors.primary} />
                </View>
                <View style={{ flex: 1, flexShrink: 1 }}>
                  <Text allowFontScaling={false} style={styles.addressLabel}>DELIVERY ADDRESS</Text>
                  <Text allowFontScaling={false} style={styles.addressText} numberOfLines={3}>{o.delivery_address_text || o.address_text || '—'}</Text>
                  {(o.delivery_address_label || o.label) && (
                    <View style={styles.labelPill}>
                      <Text allowFontScaling={false} style={styles.labelPillText}>
                        {(o.delivery_address_label || o.label || '').toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </Animated.View>
          )}

          {/* Items */}
          {items.length > 0 && (
            <Animated.View entering={FadeInDown.delay(180).duration(300)} style={styles.section}>
              <Text allowFontScaling={false} style={styles.sectionTitle}>Items Ordered</Text>
              {items.map((item: any, i: number) => (
                <View key={i} style={styles.itemRowWrapper}>
                  <View style={styles.itemRow}>
                    <Text allowFontScaling={false} style={styles.itemQty}>{item.quantity}×</Text>
                    <Text allowFontScaling={false} style={styles.itemName} numberOfLines={1}>{item.menu_item_name || item.name}</Text>
                    <Text allowFontScaling={false} style={styles.itemPrice}>₹{((item.price_paise * item.quantity) / 100).toFixed(0)}</Text>
                  </View>
                  {item.customizations && item.customizations.length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6, marginBottom: 6, marginLeft: 30 }}>
                      {item.customizations.map((c: any, idx: number) => (
                        <View key={idx} style={{
                          flexDirection: 'row', alignItems: 'center', flexShrink: 1,
                          backgroundColor: tokens.colors.background, borderWidth: 1, borderColor: tokens.colors.border,
                          borderRadius: 8, padding: 4, paddingRight: 8
                        }}>
                          {!!c.photo_url && (
                            <Image source={{ uri: c.photo_url }} style={{ width: 18, height: 18, borderRadius: 4, marginRight: 6, backgroundColor: tokens.colors.background }} />
                          )}
                          <Text allowFontScaling={false} style={{ fontSize: 10, fontFamily: tokens.typography.family.medium, color: tokens.colors.textSecondary, flexShrink: 1 }} numberOfLines={1}>
                            {c.group}: <Text allowFontScaling={false} style={{ fontFamily: tokens.typography.family.bold, color: tokens.colors.textPrimary }}>{c.option}</Text>
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </Animated.View>
          )}

          {/* Bill */}
          {o && (
            <Animated.View entering={FadeInDown.delay(220).duration(300)} style={styles.section}>
              <View style={styles.billRow}><Text allowFontScaling={false} style={styles.billLabel}>Subtotal</Text><Text allowFontScaling={false} style={styles.billValue}>₹{subtotal.toFixed(0)}</Text></View>
              {delivery > 0 && <View style={styles.billRow}><Text allowFontScaling={false} style={styles.billLabel}>Delivery & Surge</Text><Text allowFontScaling={false} style={styles.billValue}>₹{delivery.toFixed(0)}</Text></View>}
              {tax > 0 && <View style={styles.billRow}><Text allowFontScaling={false} style={styles.billLabel}>Taxes (GST)</Text><Text allowFontScaling={false} style={styles.billValue}>₹{tax.toFixed(2)}</Text></View>}
              {smallOrderFee > 0 && <View style={styles.billRow}><Text allowFontScaling={false} style={styles.billLabel}>Small Order Fee</Text><Text allowFontScaling={false} style={styles.billValue}>₹{smallOrderFee.toFixed(0)}</Text></View>}
              {riderTip > 0 && <View style={styles.billRow}><Text allowFontScaling={false} style={styles.billLabel}>Rider Tip</Text><Text allowFontScaling={false} style={styles.billValue}>₹{riderTip.toFixed(0)}</Text></View>}
              {menuOfferDisc > 0 && <View style={styles.billRow}><Text allowFontScaling={false} style={[styles.billLabel, { color: tokens.colors.success }]}>Item Offers</Text><Text allowFontScaling={false} style={[styles.billValue, { color: tokens.colors.success }]}>−₹{menuOfferDisc.toFixed(0)}</Text></View>}
              {discount > 0 && <View style={styles.billRow}><Text allowFontScaling={false} style={[styles.billLabel, { color: tokens.colors.success }]}>Promo Discount</Text><Text allowFontScaling={false} style={[styles.billValue, { color: tokens.colors.success }]}>−₹{discount.toFixed(0)}</Text></View>}
              {loyalty > 0 && <View style={styles.billRow}><Text allowFontScaling={false} style={[styles.billLabel, { color: tokens.colors.success }]}>Loyalty Points</Text><Text allowFontScaling={false} style={[styles.billValue, { color: tokens.colors.success }]}>−₹{loyalty.toFixed(0)}</Text></View>}
              {wallet > 0 && <View style={styles.billRow}><Text allowFontScaling={false} style={[styles.billLabel, { color: tokens.colors.primary }]}>Wallet</Text><Text allowFontScaling={false} style={[styles.billValue, { color: tokens.colors.primary }]}>−₹{wallet.toFixed(2)}</Text></View>}
              <View style={styles.billDivider} />
              <View style={styles.billRow}>
                <Text allowFontScaling={false} style={styles.totalLabel}>Total</Text>
                <Text allowFontScaling={false} style={styles.totalValue}>₹{total.toFixed(2)}</Text>
              </View>
            </Animated.View>
          )}

          {/* Cancel */}
          {canCancel && (
            <View style={styles.cancelCard}>
              <View>
                <Text allowFontScaling={false} style={styles.cancelTitle}>Cancel Order</Text>
                <Text allowFontScaling={false} style={styles.cancelSub}>Refund to wallet</Text>
              </View>
              <PressableScale
                style={[styles.cancelBtn, cancelMutation.isPending && { opacity: 0.6 }]}
                onPress={handleCancel}
                disabled={cancelMutation.isPending}
                accessibilityRole="button"
                accessibilityLabel="Cancel order"
              >
                {cancelMutation.isPending
                  ? <ActivityIndicator size="small" color={tokens.colors.textInverse} />
                  : <Text allowFontScaling={false} style={styles.cancelBtnText}>Cancel</Text>}
              </PressableScale>
            </View>
          )}

          {/* Rate — show for delivered, unrated orders */}
          {status === 'delivered' && !o?.food_rating && (
            <PressableScale
              style={styles.rateCard}
              onPress={() => navigation.navigate('RateOrder', { orderId })}
              accessibilityRole="button"
              accessibilityLabel="Rate order"
            >
              <View>
                <Text allowFontScaling={false} style={styles.rateTitle}>How was your order?</Text>
                <Text allowFontScaling={false} style={styles.rateSub}>Tap to rate your experience</Text>
              </View>
              <View style={styles.rateStars}>
                {[1,2,3,4,5].map(s => (
                  <Text allowFontScaling={false} key={s} style={{ fontSize: 20, color: tokens.colors.warning }}>★</Text>
                ))}
              </View>
            </PressableScale>
          )}

          {/* Help */}
          <View style={styles.helpCard}>
            <View>
              <Text allowFontScaling={false} style={styles.helpTitle}>Need help?</Text>
              <Text allowFontScaling={false} style={styles.helpSub}>Support available 24/7</Text>
            </View>
            <PressableScale
              style={styles.helpBtn}
              onPress={() => navigation.navigate('Support')}
              accessibilityRole="button"
              accessibilityLabel="Contact support"
            >
              <MessageCircle size={14} color={tokens.colors.textPrimary} />
              <Text allowFontScaling={false} style={styles.helpBtnText}>Contact Us</Text>
            </PressableScale>
          </View>

          {/* Back to home */}
          <PressableScale
            style={styles.homeBtn}
            onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Home' }] })}
            accessibilityRole="button"
            accessibilityLabel="Back to Home"
          >
            <Text allowFontScaling={false} style={styles.homeBtnText}>Back to Home</Text>
          </PressableScale>

          {isLoading && !o && <ActivityIndicator color={tokens.colors.primary} style={{ marginVertical: 20 }} />}
        </ScrollView>
      </View>
    </View>
  );
};

export default OrderConfirmedScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0ede9' },

  // Map & Placeholder
  mapContainer: { height: '48%', backgroundColor: '#f0ede9' },
  placeholderContainer: { flex: 1, backgroundColor: tokens.colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  placeholderContent: { alignItems: 'center', marginTop: -40 },
  placeholderIconBox: { width: 80, height: 80, borderRadius: 40, backgroundColor: tokens.colors.primaryTint, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  placeholderTitle: { fontSize: 18, fontFamily: tokens.typography.family.black, color: tokens.colors.textPrimary, marginBottom: 4 },
  placeholderSub: { fontSize: 13, fontFamily: tokens.typography.family.medium, color: tokens.colors.textSecondary },

  // Floating overlays on map
  backBtn: {
    position: 'absolute', left: 20,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: tokens.colors.surface, alignItems: 'center', justifyContent: 'center',
    ...tokens.shadows.soft,
  },
  orderIdBadge: {
    position: 'absolute', alignSelf: 'center', left: 0, right: 0, marginHorizontal: 80,
    backgroundColor: tokens.colors.surface, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 9, alignItems: 'center',
    ...tokens.shadows.soft,
  },
  orderIdText: { fontSize: 13, fontFamily: tokens.typography.family.bold, color: tokens.colors.textPrimary },

  // Sheet
  sheet: {
    flex: 1, backgroundColor: tokens.colors.surface,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    marginTop: -32,
    ...tokens.shadows.soft,
  },
  sheetHandle: { width: 44, height: 4, borderRadius: 2, backgroundColor: tokens.colors.border, alignSelf: 'center', marginTop: 12, marginBottom: 2 },
  sheetScroll: { paddingHorizontal: 20, paddingBottom: 48 },

  // ETA
  etaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 16 },
  etaLabel: { fontSize: 10, fontFamily: tokens.typography.family.extrabold, color: tokens.colors.textTertiary, letterSpacing: 1.5 },
  etaValue: { fontSize: 34, fontFamily: tokens.typography.family.black, color: tokens.colors.textPrimary, letterSpacing: -1, marginTop: 2 },
  onTimeBadge: { backgroundColor: '#ECFDF5', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  onTimeText: { color: tokens.colors.primary, fontFamily: tokens.typography.family.extrabold, fontSize: 10, letterSpacing: 1 },

  // OTP
  otpCard: {
    backgroundColor: tokens.colors.successTint, borderRadius: tokens.radii.xl, padding: tokens.spacing.lg, marginVertical: tokens.spacing.md,
    borderWidth: 1.5, borderColor: tokens.colors.successTint,
  },
  otpInstructRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  otpInstructTitle: { fontSize: 12, fontFamily: tokens.typography.family.extrabold, color: tokens.colors.success },
  otpInstructBody: { fontSize: 12, fontFamily: tokens.typography.family.regular, color: '#065F46', lineHeight: 18 },
  otpDivider: { height: 1, backgroundColor: tokens.colors.successTint, marginVertical: tokens.spacing.md },
  otpLabel: { fontSize: 9, fontFamily: tokens.typography.family.extrabold, color: tokens.colors.success, letterSpacing: 1.5, marginBottom: 4 },
  otpCode: { fontSize: 34, fontFamily: tokens.typography.family.black, color: tokens.colors.textPrimary, letterSpacing: 8 },
  otpHint: { fontSize: 11, fontFamily: tokens.typography.family.regular, color: tokens.colors.textSecondary, marginTop: 4 },

  // Rider
  riderCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 20, padding: 18, marginVertical: 12,
    borderWidth: 1, borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
  },
  riderCardGreen:    { backgroundColor: tokens.colors.successTint, borderColor: tokens.colors.successTint },
  riderCardAssigned: { borderColor: tokens.colors.primary, borderWidth: 1.5 },
  riderCardPulse:    { backgroundColor: tokens.colors.successTint, borderColor: tokens.colors.primary, borderWidth: 2 },
  riderCallBtn:      { backgroundColor: tokens.colors.primary, borderColor: tokens.colors.primary },
  riderAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: tokens.colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', marginRight: 14, overflow: 'hidden' },
  riderAvatarPhoto: { width: 52, height: 52, borderRadius: 26 },
  riderMeta: { fontSize: 10, fontFamily: tokens.typography.family.extrabold, color: tokens.colors.textTertiary, letterSpacing: 1 },
  riderName: { fontSize: 17, fontFamily: tokens.typography.family.extrabold, color: tokens.colors.textPrimary, marginTop: 2 },
  riderAction: { width: 44, height: 44, borderRadius: 22, backgroundColor: tokens.colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: tokens.colors.border },

  // Sections
  section: { borderTopWidth: 1, borderTopColor: tokens.colors.background, paddingTop: 16, marginBottom: 4 },
  sectionTitle: { fontSize: 15, fontFamily: tokens.typography.family.bold, color: tokens.colors.textPrimary, marginBottom: 12 },

  // Address
  addressCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: tokens.colors.background, borderRadius: 14, padding: 14, gap: 12 },
  addressIconBox: { width: 32, height: 32, borderRadius: 9, backgroundColor: tokens.colors.primaryTint, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  addressLabel: { fontSize: 10, fontFamily: tokens.typography.family.extrabold, color: tokens.colors.textTertiary, letterSpacing: 1, marginBottom: 4 },
  addressText: { fontSize: 14, fontFamily: tokens.typography.family.semibold, color: tokens.colors.textPrimary, lineHeight: 20 },
  labelPill: { alignSelf: 'flex-start', marginTop: 6, backgroundColor: tokens.colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  labelPillText: { fontSize: 10, fontFamily: tokens.typography.family.bold, color: tokens.colors.textSecondary },

  // Items
  itemRowWrapper: { marginBottom: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start' },
  itemQty: { width: 30, fontSize: 13, fontFamily: tokens.typography.family.bold, color: tokens.colors.primary },
  itemName: { flex: 1, fontSize: 14, fontFamily: tokens.typography.family.medium, color: tokens.colors.textPrimary },
  itemCustomizations: { fontSize: 11, fontFamily: tokens.typography.family.medium, color: tokens.colors.textSecondary, marginTop: 4, marginLeft: 30, marginBottom: 4 },
  itemPrice: { fontSize: 14, fontFamily: tokens.typography.family.semibold, color: tokens.colors.textPrimary },

  // Bill
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  billLabel: { fontSize: 14, fontFamily: tokens.typography.family.regular, color: tokens.colors.textSecondary },
  billValue: { fontSize: 14, fontFamily: tokens.typography.family.medium, color: tokens.colors.textPrimary },
  billDivider: { height: 1, backgroundColor: tokens.colors.background, marginVertical: 8 },
  totalLabel: { fontSize: 15, fontFamily: tokens.typography.family.bold, color: tokens.colors.textPrimary },
  totalValue: { fontSize: 20, fontFamily: tokens.typography.family.black, color: tokens.colors.textPrimary, letterSpacing: -0.5 },

  // Cancel
  cancelCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: tokens.colors.dangerTint, borderRadius: 16, padding: 16, marginTop: 16 },
  cancelTitle: { fontSize: 14, fontFamily: tokens.typography.family.bold, color: tokens.colors.danger },
  cancelSub: { fontSize: 12, fontFamily: tokens.typography.family.regular, color: tokens.colors.danger + 'AA', marginTop: 2 },
  cancelBtn: { backgroundColor: tokens.colors.danger, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10, minWidth: 80, alignItems: 'center' },
  cancelBtnText: { fontSize: 13, fontFamily: tokens.typography.family.bold, color: tokens.colors.textInverse },

  // Help
  helpCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 16, padding: 16, marginTop: 12, borderWidth: 1, borderColor: tokens.colors.background },
  helpTitle: { fontSize: 14, fontFamily: tokens.typography.family.bold, color: tokens.colors.textPrimary },
  helpSub: { fontSize: 12, fontFamily: tokens.typography.family.regular, color: tokens.colors.textSecondary, marginTop: 2 },
  helpBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: tokens.colors.surfaceMuted, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  helpBtnText: { fontSize: 13, fontFamily: tokens.typography.family.semibold, color: tokens.colors.textPrimary },

  // Home
  homeBtn: { alignItems: 'center', paddingVertical: 20 },
  homeBtnText: { fontSize: 14, fontFamily: tokens.typography.family.semibold, color: tokens.colors.textSecondary },

  // Rate
  rateCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: tokens.radii.xxl, padding: tokens.spacing.lg, marginTop: tokens.spacing.md, backgroundColor: tokens.colors.warningTint, borderWidth: 1.5, borderColor: tokens.colors.warningTint },
  rateTitle: { fontSize: 14, fontFamily: tokens.typography.family.bold, color: tokens.colors.warning },
  rateSub: { fontSize: 12, fontFamily: tokens.typography.family.regular, color: tokens.colors.warning, marginTop: 2 },
  rateStars: { flexDirection: 'row', gap: 2 },
});
