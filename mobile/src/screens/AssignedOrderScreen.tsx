import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Linking,
  ActivityIndicator, Alert, StyleSheet, StatusBar, Platform,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, Phone, Navigation, Package,
  CreditCard, ChevronRight, Info, ExternalLink, AlertTriangle,
} from 'lucide-react-native';
import { getSocket } from '../socket/client';

const G = {
  bg: '#070F0C', surface: '#0F1F18', card: '#152318',
  accent: '#10B981', accentDim: 'rgba(16,185,129,0.12)',
  orange: '#F97316', orangeDim: 'rgba(249,115,22,0.12)',
  danger: '#EF4444', dangerDim: 'rgba(239,68,68,0.1)',
  white: '#FFFFFF', muted: '#6B9E85', border: 'rgba(16,185,129,0.15)',
};

const STEPS = [
  { key: 'kitchen', label: 'Kitchen' },
  { key: 'picked_up', label: 'Picked Up' },
  { key: 'delivered', label: 'Delivered' },
];

const statusToStep = (status: string): number => {
  if (['confirmed', 'preparing', 'ready_for_pickup'].includes(status)) return 0;
  if (status === 'out_for_delivery') return 1;
  if (status === 'delivered') return 2;
  return 0;
};

const AssignedOrderScreen = ({ route, navigation }: any) => {
  const { order } = route.params;
  const insets = useSafeAreaInsets();
  const [currentStatus, setCurrentStatus] = useState(order.status);
  const queryClient = useQueryClient();

  // Socket — live status updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('join_order', order.id);
    socket.on('order_status_update', (data: any) => {
      if (data.orderId === order.id) {
        setCurrentStatus(data.status);
        queryClient.invalidateQueries({ queryKey: ['rider-active-order'] });
      }
    });
    return () => { socket.off('order_status_update'); };
  }, [order.id, queryClient]);

  // Continuous GPS broadcast so the buyer map shows live rider position
  useEffect(() => {
    const socket = getSocket();
    const watchId = Geolocation.watchPosition(
      pos => {
        socket?.emit('update_location', {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {},
      { enableHighAccuracy: true, distanceFilter: 10, interval: 5000 },
    );
    return () => Geolocation.clearWatch(watchId);
  }, []);

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => api.patch(`/riders/orders/${order.id}/status`, { status }),
    onSuccess: (data: any) => {
      const newStatus = data.status || currentStatus;
      setCurrentStatus(newStatus);
      queryClient.invalidateQueries({ queryKey: ['rider-active-order'] });
    },
  });

  const unclaimMutation = useMutation({
    mutationFn: () => api.post(`/riders/orders/${order.id}/unclaim`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rider-active-order'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
      navigation.goBack();
    },
    onError: (err: any) => Alert.alert('Error', err.message || 'Could not release mission'),
  });

  const goingToKitchen = ['confirmed', 'preparing', 'ready_for_pickup'].includes(currentStatus);
  const canPickup = currentStatus === 'ready_for_pickup';
  const isOutForDelivery = currentStatus === 'out_for_delivery';
  const isWaiting = ['confirmed', 'preparing'].includes(currentStatus);

  const handleAction = () => {
    if (canPickup) { updateStatusMutation.mutate('out_for_delivery'); return; }
    if (isOutForDelivery) {
      // COD orders: collect payment at door first, then OTP
      if (order.payment_method === 'cod') {
        navigation.navigate('DoorPayment', {
          orderId: order.id,
          totalAmountPaise: order.total_amount_paise,
          displayId: order.display_id,
        });
      } else {
        navigation.navigate('DeliveryOTP', { orderId: order.id, isCashCod: false, displayId: order.display_id });
      }
    }
  };

  const openMaps = () => {
    const destLat = goingToKitchen ? order.kitchen_lat : order.customer_lat;
    const destLng = goingToKitchen ? order.kitchen_lng : order.customer_lng;
    if (!destLat || !destLng) { Alert.alert('Location unavailable'); return; }

    const launchNav = (originLat?: number, originLng?: number) => {
      const dest = `${destLat},${destLng}`;
      let url: string;
      if (originLat && originLng) {
        // Explicit origin from GPS — most accurate
        url = `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${dest}&travelmode=driving`;
      } else {
        // Fallback: let Google Maps use its own current-location detection
        url = Platform.OS === 'android'
          ? `google.navigation:q=${dest}`
          : `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
      }
      Linking.openURL(url);
    };

    Geolocation.getCurrentPosition(
      pos => launchNav(pos.coords.latitude, pos.coords.longitude),
      () => launchNav(),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 },
    );
  };

  const callContact = () => {
    const phone = goingToKitchen ? null : order.customer_phone;
    if (!phone) return;
    Linking.openURL(`tel:${phone}`);
  };

  const currentStep = statusToStep(currentStatus);
  const destinationName = goingToKitchen ? (order.kitchen_name || 'Kitchen') : (order.customer_name || 'Customer');
  const kitchenAddressText = (() => {
    const a = order.kitchen_address;
    if (!a || !a.includes(' ')) return order.kitchen_name || 'Kitchen';
    return a;
  })();
  const destinationAddress = goingToKitchen
    ? kitchenAddressText
    : (order.delivery_address_text || order.customer_address_text || 'Delivery address');
  const collectCash = order.payment_method?.toLowerCase() === 'cod';
  const cashAmount = order.total_amount_paise ? (order.total_amount_paise / 100).toFixed(0) : '0';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <ArrowLeft size={20} color={G.white} />
          </TouchableOpacity>
          <View style={styles.orderIdBadge}>
            <Text style={styles.orderIdText}>#{order.display_id}</Text>
          </View>
          <View style={[styles.statusBadge, isWaiting ? styles.statusWaiting : isOutForDelivery ? styles.statusDelivery : styles.statusReady]}>
            <Text style={[styles.statusBadgeText, isWaiting ? { color: G.muted } : isOutForDelivery ? { color: G.orange } : { color: G.accent }]}>
              {currentStatus.replace(/_/g, ' ')}
            </Text>
          </View>
        </View>

        {/* Step progress */}
        <View style={styles.stepRow}>
          {STEPS.map((step, idx) => (
            <React.Fragment key={step.key}>
              <View style={styles.stepItem}>
                <View style={[
                  styles.stepDot,
                  idx < currentStep && styles.stepDotDone,
                  idx === currentStep && styles.stepDotActive,
                ]}>
                  {idx < currentStep && <View style={styles.stepDotCheck} />}
                </View>
                <Text style={[styles.stepLabel, idx <= currentStep && styles.stepLabelActive]}>{step.label}</Text>
              </View>
              {idx < STEPS.length - 1 && (
                <View style={[styles.stepLine, idx < currentStep && styles.stepLineDone]} />
              )}
            </React.Fragment>
          ))}
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 20, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>

        {/* ── Destination card ─────────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.destHeader}>
            <View style={[styles.destAvatar, { backgroundColor: goingToKitchen ? G.accentDim : G.orangeDim }]}>
              <Text style={[styles.destAvatarText, { color: goingToKitchen ? G.accent : G.orange }]}>
                {destinationName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.destInfo}>
              <Text style={styles.destSubLabel}>{goingToKitchen ? 'GO TO KITCHEN' : 'DELIVER TO'}</Text>
              <Text style={styles.destName}>{destinationName}</Text>
            </View>
            {!goingToKitchen && order.customer_phone && (
              <TouchableOpacity style={styles.callBtn} onPress={callContact} activeOpacity={0.8}>
                <Phone size={18} color={G.accent} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.addressRow}>
            <Navigation size={14} color={G.muted} style={{ marginRight: 8, marginTop: 1 }} />
            <Text style={styles.addressText} numberOfLines={3}>{destinationAddress}</Text>
          </View>

          <TouchableOpacity style={styles.mapsBtn} onPress={openMaps} activeOpacity={0.9}>
            <Navigation size={16} color={G.white} />
            <Text style={styles.mapsBtnText}>Open in Google Maps</Text>
            <ExternalLink size={12} color='rgba(255,255,255,0.5)' />
          </TouchableOpacity>

          {order.special_instructions && (
            <View style={styles.instructionBox}>
              <Info size={14} color={G.orange} />
              <Text style={styles.instructionText}>{order.special_instructions}</Text>
            </View>
          )}
        </View>

        {/* ── Items ────────────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Package size={16} color={G.muted} />
            <Text style={styles.cardHeaderText}>Items in this order</Text>
          </View>
          {order.items?.map((item: any, idx: number) => (
            <View key={idx} style={styles.itemRow}>
              <View style={styles.itemQty}><Text style={styles.itemQtyText}>{item.quantity}x</Text></View>
              <Text style={styles.itemName}>{item.menu_item_name}</Text>
              <View style={styles.itemDot} />
            </View>
          ))}
          <View style={styles.paymentRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <CreditCard size={14} color={G.muted} />
              <Text style={styles.payLabel}>{order.payment_method?.toUpperCase() || 'PREPAID'}</Text>
            </View>
            {collectCash && (
              <View style={styles.cashBadge}>
                <Text style={styles.cashText}>Collect ₹{cashAmount}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Release — hidden once rider is on the way (backend rejects unclaim) ── */}
        {!isOutForDelivery && (
          <TouchableOpacity
            style={styles.releaseBtn}
            onPress={() => Alert.alert('Release Order', 'Return this order to the pool?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Release', style: 'destructive', onPress: () => unclaimMutation.mutate() },
            ])}
            activeOpacity={0.8}
          >
            <AlertTriangle size={15} color={G.danger} />
            <Text style={styles.releaseBtnText}>Release Order</Text>
          </TouchableOpacity>
        )}

      </ScrollView>

      {/* ── Footer action ──────────────────────────────────────────────────── */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {isWaiting ? (
          <View style={styles.waitingBtn}>
            <ActivityIndicator size="small" color={G.muted} style={{ marginRight: 10 }} />
            <Text style={styles.waitingBtnText}>Waiting for kitchen to finish…</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.actionBtn, updateStatusMutation.isPending && { opacity: 0.7 }]}
            onPress={handleAction}
            disabled={updateStatusMutation.isPending}
            activeOpacity={0.9}
          >
            {updateStatusMutation.isPending
              ? <ActivityIndicator color={G.white} />
              : (
                <View style={styles.actionBtnInner}>
                  <Text style={styles.actionBtnText}>
                    {canPickup ? "I've Picked Up the Order" : "Arrived at Customer"}
                  </Text>
                  <ChevronRight size={20} color={G.white} strokeWidth={3} />
                </View>
              )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: G.bg },

  header: {
    backgroundColor: G.surface, paddingHorizontal: 20, paddingBottom: 20,
    borderBottomWidth: 1, borderBottomColor: G.border,
  },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  backBtn: {
    width: 40, height: 40, borderRadius: 14, backgroundColor: G.card,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: G.border,
  },
  orderIdBadge: { flex: 1, backgroundColor: G.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center' },
  orderIdText: { color: G.white, fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  statusBadge: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1 },
  statusWaiting: { backgroundColor: 'rgba(107,158,133,0.1)', borderColor: 'rgba(107,158,133,0.2)' },
  statusReady: { backgroundColor: G.accentDim, borderColor: 'rgba(16,185,129,0.3)' },
  statusDelivery: { backgroundColor: G.orangeDim, borderColor: 'rgba(249,115,22,0.3)' },
  statusBadgeText: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },

  stepRow: { flexDirection: 'row', alignItems: 'center' },
  stepItem: { alignItems: 'center', zIndex: 1 },
  stepDot: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: G.card, borderWidth: 2, borderColor: G.border,
  },
  stepDotDone: { backgroundColor: G.accent, borderColor: G.accent },
  stepDotActive: {
    backgroundColor: G.accent, borderColor: G.white, borderWidth: 2,
    width: 18, height: 18, borderRadius: 9,
  },
  stepDotCheck: { width: 6, height: 6, borderRadius: 3, backgroundColor: G.white, alignSelf: 'center', marginTop: 2 },
  stepLabel: { color: G.muted, fontSize: 9, fontWeight: '700', marginTop: 5, letterSpacing: 0.5 },
  stepLabelActive: { color: G.white },
  stepLine: { flex: 1, height: 2, backgroundColor: G.border, marginBottom: 14 },
  stepLineDone: { backgroundColor: G.accent },

  scroll: { flex: 1 },

  card: {
    backgroundColor: G.surface, borderRadius: 20, padding: 18,
    marginBottom: 14, borderWidth: 1, borderColor: G.border,
  },
  destHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  destAvatar: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  destAvatarText: { fontSize: 22, fontWeight: '900' },
  destInfo: { flex: 1 },
  destSubLabel: { color: G.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  destName: { color: G.white, fontSize: 18, fontWeight: '800', marginTop: 2 },
  callBtn: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: G.accentDim, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: G.border,
  },
  addressRow: {
    flexDirection: 'row', alignItems: 'flex-start', backgroundColor: G.card,
    borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: G.border,
  },
  addressText: { flex: 1, color: '#CBD5E1', fontSize: 13, fontWeight: '500', lineHeight: 20 },
  mapsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: G.accent, borderRadius: 14, paddingVertical: 12,
  },
  mapsBtnText: { color: G.white, fontSize: 13, fontWeight: '800' },
  instructionBox: {
    flexDirection: 'row', gap: 10, backgroundColor: G.orangeDim,
    borderRadius: 12, padding: 12, marginTop: 12, borderWidth: 1, borderColor: 'rgba(249,115,22,0.2)',
  },
  instructionText: { flex: 1, color: G.white, fontSize: 12, fontWeight: '500', lineHeight: 18 },

  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  cardHeaderText: { color: G.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: G.card, borderRadius: 12, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: G.border,
  },
  itemQty: { width: 32, height: 32, borderRadius: 8, backgroundColor: G.accentDim, alignItems: 'center', justifyContent: 'center' },
  itemQtyText: { color: G.accent, fontSize: 12, fontWeight: '900' },
  itemName: { flex: 1, color: G.white, fontSize: 13, fontWeight: '700' },
  itemDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: G.accent },
  paymentRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 14, marginTop: 6, borderTopWidth: 1, borderTopColor: G.border,
  },
  payLabel: { color: G.muted, fontSize: 12, fontWeight: '700' },
  cashBadge: { backgroundColor: G.orangeDim, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(249,115,22,0.25)' },
  cashText: { color: G.orange, fontSize: 13, fontWeight: '800' },

  releaseBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: G.dangerDim, borderRadius: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', marginBottom: 8,
  },
  releaseBtnText: { color: G.danger, fontSize: 13, fontWeight: '800' },

  footer: {
    backgroundColor: G.surface, paddingHorizontal: 20, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: G.border,
  },
  waitingBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: G.card, borderRadius: 16, paddingVertical: 16,
    borderWidth: 1, borderColor: G.border,
  },
  waitingBtnText: { color: G.muted, fontSize: 13, fontWeight: '700' },
  actionBtn: {
    backgroundColor: G.accent, borderRadius: 16, paddingVertical: 16,
    shadowColor: G.accent, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  actionBtnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionBtnText: { color: G.white, fontSize: 15, fontWeight: '800' },
});

export default AssignedOrderScreen;
