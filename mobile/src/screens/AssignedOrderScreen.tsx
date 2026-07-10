import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Linking, Modal,
  ActivityIndicator, Alert, StyleSheet, StatusBar, Platform, AppState,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, Phone, Navigation, Package,
  CreditCard, ChevronRight, Info, AlertTriangle,
  UserX, X, MapPin, Check,
  ShieldAlert, RefreshCw, DoorOpen, RotateCcw,
} from 'lucide-react-native';
import { getSocket } from '../socket/client';

const R = {
  orange: '#FC4603', orangeLight: '#FFF0E8',
  green: '#1BA672', greenLight: '#E8F8F1',
  red: '#EF4444', redLight: '#FEF2F2',
  blue: '#3B82F6', blueLight: '#EFF6FF',
  ink: '#282C3F', gray: '#686B78', muted: '#93959F',
  border: '#E9E9EB', bg: '#F8F8F8', white: '#FFFFFF',
};

// Haversine distance in metres
function distanceMetres(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const STEPS = [
  { key: 'kitchen', label: 'At Kitchen' },
  { key: 'picked_up', label: 'Picked Up' },
  { key: 'delivered', label: 'Delivered' },
];

const statusToStep = (status: string): number => {
  if (['confirmed', 'preparing', 'ready_for_pickup'].includes(status)) return 0;
  if (status === 'out_for_delivery') return 1;
  if (status === 'delivered') return 2;
  return 0;
};

const ISSUE_TYPES = [
  { key: 'damaged_packaging', label: 'Damaged Packaging', desc: 'Order packaging is broken or leaking' },
  { key: 'wrong_order', label: 'Wrong Order', desc: "Items don't match what was ordered" },
  { key: 'missing_items', label: 'Missing Items', desc: 'Some items are missing from the order' },
  { key: 'unsafe_location', label: 'Unsafe Location', desc: 'Cannot safely reach delivery address' },
  { key: 'other', label: 'Other Issue', desc: 'Something else went wrong' },
];

const AssignedOrderScreen = ({ route, navigation }: any) => {
  const { order } = route.params;
  const insets = useSafeAreaInsets();
  const [currentStatus, setCurrentStatus] = useState(order.status);
  const [showUnreachableModal, setShowUnreachableModal] = useState(false);
  const [showSosModal, setShowSosModal] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const [sosHolding, setSosHolding] = useState(false);
  const sosHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentLocationRef = useRef({ lat: 0, lng: 0 });
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

  // Geolocation — share location
  useEffect(() => {
    const socket = getSocket();
    const watchId = Geolocation.watchPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        currentLocationRef.current = { lat, lng };
        socket?.emit('update_location', { lat, lng });
      },
      () => {},
      { enableHighAccuracy: true, distanceFilter: 5, interval: 4000 },
    );
    return () => Geolocation.clearWatch(watchId);
  }, []);

  // AppState — re-emit location when foregrounded
  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        const socket = getSocket();
        Geolocation.getCurrentPosition(
          pos => socket?.emit('update_location', { lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => {},
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 },
        );
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, []);

  // Reset checklist each time the order becomes ready for pickup
  useEffect(() => { setCheckedItems(new Set()); }, [currentStatus]);

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => api.patch(`/riders/orders/${order.id}/status`, { status }),
    onSuccess: (data: any) => {
      setCurrentStatus(data.status || currentStatus);
      queryClient.invalidateQueries({ queryKey: ['rider-active-order'] });
    },
  });

  const unreachableMutation = useMutation({
    mutationFn: (action: 'retry' | 'leave_at_door' | 'return') =>
      api.post(`/riders/orders/${order.id}/customer-unreachable`, { action }),
    onSuccess: (_, action) => {
      setShowUnreachableModal(false);
      if (action === 'retry') Alert.alert('Notification Sent', 'Customer has been notified. Wait a moment and try again.');
      else if (action === 'leave_at_door') Alert.alert('Confirmed', 'Leave the order at the door and take a photo as proof.');
      else { Alert.alert('Return Order', 'Please return the order to the kitchen.'); navigation.goBack(); }
    },
  });


  const sosMutation = useMutation({
    mutationFn: (alertType: string) => api.post('/riders/sos', {
      alertType,
      orderId: order.id,
      lat: currentLocationRef.current.lat || null,
      lng: currentLocationRef.current.lng || null,
    }),
    onSuccess: (_, alertType) => {
      setShowSosModal(false);
      if (alertType === 'emergency') {
        Alert.alert('🚨 Emergency Alert Sent', 'Our ops team has been notified with your location. Calling emergency services now.', [
          { text: 'Call 112', onPress: () => Linking.openURL('tel:112') },
          { text: 'OK' },
        ]);
      } else {
        Alert.alert('Alert Sent', 'Your location has been shared with our safety team. We will contact you shortly.');
      }
    },
    onError: () => Alert.alert('Error', 'Could not send SOS. Please call 112 directly.'),
  });

  const goingToKitchen = ['confirmed', 'preparing', 'ready_for_pickup'].includes(currentStatus);
  const canPickup = currentStatus === 'ready_for_pickup';
  const isOutForDelivery = currentStatus === 'out_for_delivery';
  const isWaiting = ['confirmed', 'preparing'].includes(currentStatus);
  const currentStep = statusToStep(currentStatus);
  const totalItems = order.items?.length || 0;
  const allItemsChecked = totalItems === 0 || checkedItems.size === totalItems;

  const handleAction = () => {
    if (canPickup) { updateStatusMutation.mutate('out_for_delivery'); return; }
    if (isOutForDelivery) {
      if (order.payment_method === 'cod') {
        navigation.navigate('DoorPayment', { orderId: order.id, totalAmountPaise: order.total_amount_paise, displayId: order.display_id });
      } else {
        navigation.navigate('DeliveryOTP', { orderId: order.id, isCashCod: false, displayId: order.display_id });
      }
    }
  };

  const openMaps = () => {
    const destLat = goingToKitchen ? order.kitchen_lat : order.customer_lat;
    const destLng = goingToKitchen ? order.kitchen_lng : order.customer_lng;
    if (!destLat || !destLng) { Alert.alert('Location unavailable'); return; }
    Geolocation.getCurrentPosition(
      pos => {
        const url = Platform.OS === 'android'
          ? `google.navigation:q=${destLat},${destLng}`
          : `https://www.google.com/maps/dir/?api=1&origin=${pos.coords.latitude},${pos.coords.longitude}&destination=${destLat},${destLng}&travelmode=driving`;
        Linking.openURL(url);
      },
      () => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=driving`),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 },
    );
  };

  // SOS hold-to-activate (2 seconds)
  const onSosHoldStart = () => {
    setSosHolding(true);
    sosHoldTimer.current = setTimeout(() => { setSosHolding(false); setShowSosModal(true); }, 2000);
  };
  const onSosHoldEnd = () => {
    setSosHolding(false);
    if (sosHoldTimer.current) clearTimeout(sosHoldTimer.current);
  };

  const destinationName = goingToKitchen ? (order.kitchen_name || 'Kitchen') : (order.customer_name || 'Customer');
  const destinationAddress = goingToKitchen
    ? (order.kitchen_address || order.kitchen_name || 'Kitchen')
    : (order.delivery_address_text || 'Delivery address');
  const collectCash = order.payment_method?.toLowerCase() === 'cod';
  const cashAmount = order.total_amount_paise ? (order.total_amount_paise / 100).toFixed(0) : '0';
  const destInitial = destinationName.charAt(0).toUpperCase();

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={R.white} />

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <View style={s.headerTop}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <ArrowLeft size={20} color={R.ink} />
          </TouchableOpacity>
          <View style={s.orderIdWrap}>
            <Text style={s.orderId}>{order.display_id}</Text>
          </View>
          <View style={s.headerRight}>
            <View style={[s.statusChip,
              isWaiting && { backgroundColor: '#F0F0F0' },
              canPickup && { backgroundColor: R.greenLight },
              isOutForDelivery && { backgroundColor: R.orangeLight },
            ]}>
              <Text style={[s.statusChipText,
                isWaiting && { color: R.muted },
                canPickup && { color: R.green },
                isOutForDelivery && { color: R.orange },
              ]}>
                {currentStatus.replace(/_/g, ' ')}
              </Text>
            </View>
            {/* SOS hold button */}
            <TouchableOpacity
              style={[s.sosBtn, sosHolding && s.sosBtnHolding]}
              onPressIn={onSosHoldStart}
              onPressOut={onSosHoldEnd}
              activeOpacity={0.85}
            >
              <ShieldAlert size={14} color={sosHolding ? R.white : R.red} />
              <Text style={[s.sosBtnLabel, sosHolding && { color: R.white }]}>SOS</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Progress steps */}
        <View style={s.stepRow}>
          {STEPS.map((step, idx) => (
            <React.Fragment key={step.key}>
              <View style={s.stepItem}>
                <View style={[
                  s.stepDot,
                  idx < currentStep && s.stepDotDone,
                  idx === currentStep && s.stepDotActive,
                ]}>
                  {idx < currentStep && <View style={s.stepCheck} />}
                </View>
                <Text style={[s.stepLabel, idx <= currentStep && s.stepLabelActive]}>{step.label}</Text>
              </View>
              {idx < STEPS.length - 1 && (
                <View style={[s.stepLine, idx < currentStep && s.stepLineDone]} />
              )}
            </React.Fragment>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>

        {/* Destination card */}
        <View style={s.card}>
          <View style={s.destRow}>
            <View style={[s.destAvatar, { backgroundColor: goingToKitchen ? R.orangeLight : R.greenLight }]}>
              <Text style={[s.destAvatarText, { color: goingToKitchen ? R.orange : R.green }]}>{destInitial}</Text>
            </View>
            <View style={s.destInfo}>
              <Text style={s.destSubLabel}>{goingToKitchen ? 'PICK UP FROM' : 'DELIVER TO'}</Text>
              <Text style={s.destName}>{destinationName}</Text>
            </View>
            {!goingToKitchen && order.customer_phone && (
              <TouchableOpacity
                style={s.callBtn}
                onPress={() => Linking.openURL(`tel:${order.customer_phone}`)}
                activeOpacity={0.8}
              >
                <Phone size={18} color={R.green} />
              </TouchableOpacity>
            )}
          </View>

          <View style={s.addressBox}>
            <MapPin size={14} color={R.muted} />
            <Text style={s.addressText} numberOfLines={3}>{destinationAddress}</Text>
          </View>

          <TouchableOpacity style={s.mapsBtn} onPress={openMaps} activeOpacity={0.9}>
            <Navigation size={16} color={R.white} />
            <Text style={s.mapsBtnText}>Open in Google Maps</Text>
          </TouchableOpacity>

          {order.special_instructions && (
            <View style={s.instructionBox}>
              <Info size={14} color={R.orange} />
              <Text style={s.instructionText}>{order.special_instructions}</Text>
            </View>
          )}
        </View>

        {/* Items */}
        <View style={s.card}>
          <View style={s.sectionHeader}>
            <Package size={16} color={R.muted} />
            <Text style={s.sectionTitle}>Order Items</Text>
          </View>
          {order.items?.map((item: any, idx: number) => (
            <View key={idx} style={s.itemRow}>
              <View style={s.itemQtyBox}>
                <Text style={s.itemQtyText}>{item.quantity}×</Text>
              </View>
              <Text style={s.itemName}>{item.menu_item_name}</Text>
            </View>
          ))}
          <View style={s.payRow}>
            <View style={s.payLeft}>
              <CreditCard size={14} color={R.muted} />
              <Text style={s.payLabel}>{order.payment_method?.toUpperCase() || 'PREPAID'}</Text>
            </View>
            {collectCash && (
              <View style={s.cashBadge}>
                <Text style={s.cashText}>Collect ₹{cashAmount} cash</Text>
              </View>
            )}
          </View>
        </View>

        {/* Item verification checklist — appears when order is ready for pickup */}
        {canPickup && order.items && order.items.length > 0 && (
          <View style={s.verifyCard}>
            <View style={s.verifyHeader}>
              <Package size={16} color={R.orange} />
              <Text style={s.verifyTitle}>Check items before pickup</Text>
              <Text style={s.verifyProgress}>{checkedItems.size}/{order.items.length}</Text>
            </View>
            {order.items.map((item: any, idx: number) => {
              const checked = checkedItems.has(idx);
              return (
                <TouchableOpacity
                  key={idx}
                  style={[s.verifyRow, checked && s.verifyRowDone]}
                  onPress={() => setCheckedItems(prev => {
                    const next = new Set(prev);
                    if (next.has(idx)) next.delete(idx); else next.add(idx);
                    return next;
                  })}
                  activeOpacity={0.7}
                >
                  <View style={[s.checkbox, checked && s.checkboxChecked]}>
                    {checked && <Check size={12} color={R.white} strokeWidth={3} />}
                  </View>
                  <Text style={[s.verifyItemQty, checked && s.verifyTextDone]}>{item.quantity}×</Text>
                  <Text style={[s.verifyItemName, checked && s.verifyTextDone]}>{item.menu_item_name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Customer not responding */}
        {isOutForDelivery && (
          <TouchableOpacity style={s.warnBtn} onPress={() => setShowUnreachableModal(true)} activeOpacity={0.8}>
            <UserX size={16} color={R.orange} />
            <Text style={s.warnBtnText}>Customer Not Responding</Text>
          </TouchableOpacity>
        )}



      </ScrollView>

      {/* SOS Modal */}
      <Modal visible={showSosModal} transparent animationType="slide" onRequestClose={() => setShowSosModal(false)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <View style={s.sosTitleRow}>
                <ShieldAlert size={20} color={R.red} />
                <Text style={[s.sheetTitle, { color: R.red }]}>Emergency Safety</Text>
              </View>
              <TouchableOpacity onPress={() => setShowSosModal(false)}>
                <X size={22} color={R.muted} />
              </TouchableOpacity>
            </View>
            <Text style={s.sheetSub}>Your location will be shared with our safety team instantly.</Text>
            {[
              { type: 'emergency', label: '🚨 Call Emergency (112)', desc: 'Calls police + alerts our ops team with your live location', color: R.red, bg: R.redLight },
              { type: 'share_location', label: '📍 Share Location with Ops', desc: 'Silent alert — ops will call you within 2 minutes', color: R.orange, bg: R.orangeLight },
              { type: 'silent', label: '🤫 Silent Alert', desc: 'No sound, no call — discreet notification to safety team', color: R.blue, bg: R.blueLight },
            ].map(opt => (
              <TouchableOpacity
                key={opt.type}
                style={[s.optionRow, { backgroundColor: opt.bg, borderColor: opt.color, borderWidth: 1 }]}
                onPress={() => sosMutation.mutate(opt.type)}
                disabled={sosMutation.isPending}
                activeOpacity={0.85}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[s.optionLabel, { color: opt.color }]}>{opt.label}</Text>
                  <Text style={s.optionDesc}>{opt.desc}</Text>
                </View>
                <ChevronRight size={16} color={opt.color} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Customer Unreachable Modal */}
      <Modal visible={showUnreachableModal} transparent animationType="slide" onRequestClose={() => setShowUnreachableModal(false)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Customer Not Responding</Text>
              <TouchableOpacity onPress={() => setShowUnreachableModal(false)}>
                <X size={22} color={R.muted} />
              </TouchableOpacity>
            </View>
            <Text style={s.sheetSub}>How would you like to proceed?</Text>
            {[
              { action: 'retry' as const, icon: <RefreshCw size={20} color={R.green} />, bg: R.greenLight, label: 'Notify & Retry', desc: 'Alert the customer and wait 3 more minutes' },
              { action: 'leave_at_door' as const, icon: <DoorOpen size={20} color={R.orange} />, bg: R.orangeLight, label: 'Leave at Door', desc: 'Leave order and capture photo as proof' },
              { action: 'return' as const, icon: <RotateCcw size={20} color={R.red} />, bg: R.redLight, label: 'Return Order', desc: 'Return the order to the kitchen' },
            ].map(opt => (
              <TouchableOpacity key={opt.action} style={s.optionRow} onPress={() => unreachableMutation.mutate(opt.action)} disabled={unreachableMutation.isPending} activeOpacity={0.8}>
                <View style={[s.optionIcon, { backgroundColor: opt.bg }]}>{opt.icon}</View>
                <View style={{ flex: 1 }}>
                  <Text style={s.optionLabel}>{opt.label}</Text>
                  <Text style={s.optionDesc}>{opt.desc}</Text>
                </View>
                <ChevronRight size={16} color={R.border} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>


      {/* Footer action */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        {isWaiting ? (
          <View style={s.waitingRow}>
            <ActivityIndicator size="small" color={R.orange} />
            <Text style={s.waitingText}>Waiting for kitchen to prepare order…</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[s.actionBtn, (updateStatusMutation.isPending || (canPickup && !allItemsChecked)) && { opacity: 0.45 }]}
            onPress={handleAction}
            disabled={updateStatusMutation.isPending || (canPickup && !allItemsChecked)}
            activeOpacity={0.9}
          >
            {updateStatusMutation.isPending
              ? <ActivityIndicator color={R.white} />
              : (
                <View style={s.actionBtnRow}>
                  <Text style={s.actionBtnText}>
                    {canPickup
                      ? allItemsChecked
                        ? "I've Picked Up the Order"
                        : `Verify items (${checkedItems.size}/${totalItems})`
                      : 'Arrived at Customer'}
                  </Text>
                  <ChevronRight size={20} color={R.white} strokeWidth={2.5} />
                </View>
              )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: R.bg },

  header: {
    backgroundColor: R.white, paddingHorizontal: 16, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: R.border,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: R.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  orderIdWrap: { flex: 1, alignItems: 'center' },
  orderId: { fontSize: 16, fontWeight: '800', color: R.ink },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusChip: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  statusChipText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  sosBtn: {
    width: 44, borderRadius: 10, paddingVertical: 5,
    backgroundColor: R.redLight, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: R.red, gap: 2,
  },
  sosBtnHolding: { backgroundColor: R.red },
  sosBtnLabel: { fontSize: 8, fontWeight: '800', color: R.red, letterSpacing: 0.5 },

  stepRow: { flexDirection: 'row', alignItems: 'center' },
  stepItem: { alignItems: 'center' },
  stepDot: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: R.bg, borderWidth: 2, borderColor: R.border,
  },
  stepDotDone: { backgroundColor: R.orange, borderColor: R.orange },
  stepDotActive: { backgroundColor: R.orange, borderColor: R.white, width: 18, height: 18, borderRadius: 9, borderWidth: 2.5 },
  stepCheck: { width: 6, height: 6, borderRadius: 3, backgroundColor: R.white, alignSelf: 'center', marginTop: 2 },
  stepLabel: { color: R.muted, fontSize: 10, fontWeight: '600', marginTop: 4 },
  stepLabelActive: { color: R.ink, fontWeight: '700' },
  stepLine: { flex: 1, height: 2, backgroundColor: R.border, marginBottom: 18 },
  stepLineDone: { backgroundColor: R.orange },

  // Kitchen arrival
  atKitchenBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: R.orangeLight, borderRadius: 14, padding: 14, marginBottom: 12,
    borderWidth: 1.5, borderColor: '#FFD4A8',
  },
  atKitchenText: { fontSize: 15, fontWeight: '800', color: R.orange, flex: 1 },
  atKitchenHint: { fontSize: 10, color: R.muted, position: 'absolute', bottom: 6, right: 14 },
  arrivedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: R.greenLight, borderRadius: 14, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: '#B6EDD8',
  },
  arrivedBannerText: { fontSize: 14, fontWeight: '700', color: R.green },

  card: {
    backgroundColor: R.white, borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  destRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  destAvatar: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  destAvatarText: { fontSize: 22, fontWeight: '900' },
  destInfo: { flex: 1 },
  destSubLabel: { fontSize: 10, fontWeight: '700', color: R.muted, letterSpacing: 0.8 },
  destName: { fontSize: 17, fontWeight: '800', color: R.ink, marginTop: 2 },
  callBtn: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: R.greenLight,
    alignItems: 'center', justifyContent: 'center',
  },
  addressBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: R.bg, borderRadius: 12, padding: 12, marginBottom: 12,
  },
  addressText: { flex: 1, fontSize: 13, color: R.gray, lineHeight: 20 },
  mapsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: R.orange, borderRadius: 12, paddingVertical: 13,
    shadowColor: R.orange, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  mapsBtnText: { color: R.white, fontSize: 14, fontWeight: '700' },
  instructionBox: {
    flexDirection: 'row', gap: 8, backgroundColor: R.orangeLight,
    borderRadius: 10, padding: 12, marginTop: 10,
  },
  instructionText: { flex: 1, color: R.orange, fontSize: 12, lineHeight: 18 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: R.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  itemQtyBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: R.orangeLight, alignItems: 'center', justifyContent: 'center' },
  itemQtyText: { color: R.orange, fontSize: 12, fontWeight: '800' },
  itemName: { flex: 1, fontSize: 14, color: R.ink, fontWeight: '500' },
  payRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 12, marginTop: 8, borderTopWidth: 1, borderTopColor: R.border,
  },
  payLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  payLabel: { fontSize: 12, color: R.muted, fontWeight: '600' },
  cashBadge: { backgroundColor: R.orangeLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  cashText: { color: R.orange, fontSize: 13, fontWeight: '700' },

  warnBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: R.orangeLight, borderRadius: 14, paddingVertical: 14, marginBottom: 10,
  },
  warnBtnText: { color: R.orange, fontSize: 14, fontWeight: '700' },
  ghostBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: R.white, borderRadius: 14, paddingVertical: 13, marginBottom: 10,
    borderWidth: 1, borderColor: R.border,
  },
  ghostBtnText: { color: R.muted, fontSize: 13, fontWeight: '600' },
  dangerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: R.redLight, borderRadius: 14, paddingVertical: 14, marginBottom: 8,
  },
  dangerBtnText: { color: R.red, fontSize: 14, fontWeight: '700' },

  // Modals
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: R.white, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20, paddingBottom: 36,
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: R.border, alignSelf: 'center', marginBottom: 20 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  sosTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: R.ink },
  sheetSub: { fontSize: 13, color: R.muted, marginBottom: 16 },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: R.bg, borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: 'transparent',
  },
  optionRowSelected: { borderColor: R.red, backgroundColor: R.redLight },
  optionIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  optionLabel: { fontSize: 15, fontWeight: '700', color: R.ink },
  optionDesc: { fontSize: 12, color: R.muted, marginTop: 2 },
  submitBtn: {
    backgroundColor: R.red, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 4,
  },
  submitBtnText: { color: R.white, fontSize: 15, fontWeight: '800' },

  // Footer
  footer: {
    backgroundColor: R.white, paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: R.border,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: -2 },
  },
  waitingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  waitingText: { fontSize: 14, color: R.muted, fontWeight: '600' },
  actionBtn: {
    backgroundColor: R.orange, borderRadius: 14, paddingVertical: 17,
    shadowColor: R.orange, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  actionBtnRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionBtnText: { color: R.white, fontSize: 15, fontWeight: '800' },

  // Item verification checklist
  verifyCard: {
    backgroundColor: R.white, borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1.5, borderColor: '#FFD4A8',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  verifyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  verifyTitle: { flex: 1, fontSize: 13, fontWeight: '800', color: R.orange, textTransform: 'uppercase', letterSpacing: 0.5 },
  verifyProgress: { fontSize: 13, fontWeight: '800', color: R.orange },
  verifyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: R.border,
  },
  verifyRowDone: { opacity: 0.6 },
  checkbox: {
    width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: R.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: R.bg,
  },
  checkboxChecked: { backgroundColor: R.green, borderColor: R.green },
  verifyItemQty: { fontSize: 14, fontWeight: '800', color: R.orange, width: 28 },
  verifyItemName: { flex: 1, fontSize: 14, fontWeight: '500', color: R.ink },
  verifyTextDone: { textDecorationLine: 'line-through', color: R.muted },
});

export default AssignedOrderScreen;
