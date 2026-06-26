import { ArrowLeft, Phone, UserCircle, Check } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet, Alert, ScrollView } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { api } from '../api/client';
import { getSocket } from '../socket/client';
import { RootState } from '../store';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import Animated, { FadeInDown, LinearTransition, SlideInDown, BounceIn } from 'react-native-reanimated';
import { TrackingLeafletMap } from '../components/TrackingLeafletMap';

const calculateBearing = (startLat: number, startLng: number, destLat: number, destLng: number) => {
  const toRad = (val: number) => (val * Math.PI) / 180;
  const toDeg = (val: number) => (val * 180) / Math.PI;
  const startLatRad = toRad(startLat);
  const destLatRad = toRad(destLat);
  const destLngRad = toRad(destLng);
  const startLngRad = toRad(startLng);
  const y = Math.sin(destLngRad - startLngRad) * Math.cos(destLatRad);
  const x = Math.cos(startLatRad) * Math.sin(destLatRad) - Math.sin(startLatRad) * Math.cos(destLatRad) * Math.cos(destLngRad - startLngRad);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
};

const hapticOptions = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };

const StatusStep = ({ title, isActive, isDone }: any) => (
  <View style={styles.statusStep}>
    <Animated.View layout={LinearTransition.springify()} style={[styles.statusIconWrapper, { backgroundColor: isDone ? '#10B981' : isActive ? '#10B981' : '#F3F4F6' }]}>
      {isDone ? <Check size={16} color="white" /> : <View style={[styles.statusDot, { backgroundColor: isActive ? 'white' : '#D1D5DB' }]} />}
    </Animated.View>
    <Text style={[styles.statusText, { color: isActive || isDone ? '#1A1A2E' : '#9CA3AF' }]}>{title}</Text>
  </View>
);

const OrderTrackingScreen = ({ route, navigation }: any) => {
  const { orderId } = route.params;
  const socket = getSocket();
  const queryClient = useQueryClient();
  const globalLocation = useSelector((state: RootState) => state.app.globalLocation);

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/orders/${orderId}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-track', orderId] });
      queryClient.invalidateQueries({ queryKey: ['order-history'] });
      Alert.alert('Order Cancelled', 'Your order has been cancelled successfully.');
    },
    onError: () => Alert.alert('Error', 'Could not cancel the order at this time.'),
  });

  const triggerHaptic = () => ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
  const triggerHapticSuccess = () => ReactNativeHapticFeedback.trigger('notificationSuccess', hapticOptions);

  const { data: orderData } = useQuery({
    queryKey: ['order-track', orderId],
    queryFn: () => api.get(`/orders/${orderId}`),
    refetchInterval: 6000, // poll so rider name + OTP update without needing socket
  });

  const o = orderData?.order;

  const [riderLocation, setRiderLocation] = useState<{ lat: number; lng: number } | null>(() => {
    if (o?.rider_lat && o?.rider_lng) {
      return { lat: parseFloat(o.rider_lat), lng: parseFloat(o.rider_lng) };
    }
    return null;
  });
  const [status, setStatus] = useState(o?.status || 'confirmed');
  const [heading, setHeading] = useState(0);

  useEffect(() => {
    if (o?.rider_lat && o?.rider_lng) {
      const lat = parseFloat(o.rider_lat);
      const lng = parseFloat(o.rider_lng);
      if (riderLocation) {
        setHeading(calculateBearing(riderLocation.lat, riderLocation.lng, lat, lng));
      }
      setRiderLocation({ lat, lng });
    }
  }, [o?.rider_lat, o?.rider_lng]);

  useEffect(() => {
    if (o?.status) {
      setStatus(o.status);
      if (['ready_for_pickup', 'out_for_delivery', 'delivered'].includes(o.status)) {
        triggerHapticSuccess();
      }
    }
  }, [o?.status]);

  useEffect(() => {
    if (!socket) return;

    socket.emit('join_order', orderId);

    socket.on('order_status_update', (data: any) => {
      if (data.orderId === orderId) {
        setStatus(data.status);
        triggerHapticSuccess();
        queryClient.invalidateQueries({ queryKey: ['order-track', orderId] });
      }
    });

    socket.on('rider_location', (data: any) => {
      setRiderLocation((prev) => {
        if (prev) {
          setHeading(calculateBearing(prev.lat, prev.lng, data.lat, data.lng));
        }
        return { lat: data.lat, lng: data.lng };
      });
    });

    return () => {
      socket.off('order_status_update');
      socket.off('rider_location');
    };
  }, [socket, orderId]);

  const customerLocation =
    o?.customer_lat && o?.customer_lng
      ? { lat: parseFloat(o.customer_lat), lng: parseFloat(o.customer_lng) }
      : null;

  const kitchenLocation =
    o?.kitchen_lat && o?.kitchen_lng
      ? { lat: parseFloat(o.kitchen_lat), lng: parseFloat(o.kitchen_lng) }
      : null;

  // When rider is out for delivery but no GPS location received yet, seed their
  // marker at the kitchen so the map isn't blank — it will snap to real GPS on first update.
  const effectiveRiderLocation = riderLocation ?? (
    status === 'out_for_delivery' && kitchenLocation ? kitchenLocation : null
  );

  return (
    <View style={styles.container}>
      {/* Map */}
      <View style={styles.mapContainer}>
        <TrackingLeafletMap
          riderLocation={effectiveRiderLocation}
          customerLocation={customerLocation}
          kitchenLocation={kitchenLocation}
          riderHeading={heading}
          initialLat={customerLocation?.lat ?? globalLocation?.latitude ?? 20.5937}
          initialLng={customerLocation?.lng ?? globalLocation?.longitude ?? 78.9629}
          initialZoom={customerLocation ? 15 : globalLocation ? 14 : 5}
          style={styles.map}
        />
        <Animated.View entering={BounceIn.delay(200)} style={styles.floatingHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => { triggerHaptic(); navigation.goBack(); }}
          >
            <ArrowLeft size={24} color="#1A1A2E" />
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Bottom sheet */}
      <Animated.View entering={SlideInDown.duration(600).springify()} style={styles.statusSheet}>
        <View style={styles.sheetHandle} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScroll}>

        <View style={styles.timeInfoRow}>
          <View>
            <Text style={styles.timeLabel}>ESTIMATED ARRIVAL</Text>
            <Animated.Text layout={LinearTransition.springify()} style={styles.timeValue}>
              {status === 'delivered' ? 'Delivered' :
               status === 'out_for_delivery' ? '10 mins' :
               status === 'ready_for_pickup' ? '15 mins' : '25 mins'}
            </Animated.Text>
          </View>
          <View style={styles.onTrackBadge}>
            <Text style={styles.onTrackText}>ON TIME</Text>
          </View>
        </View>

        <Animated.View layout={LinearTransition.springify()} style={styles.progressRow}>
          <StatusStep title="Confirmed" isDone={['confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered'].includes(status)} />
          <View style={[styles.progressLine, ['preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered'].includes(status) && { backgroundColor: '#10B981' }]} />
          <StatusStep title="Cooking" isActive={status === 'preparing'} isDone={['ready_for_pickup', 'out_for_delivery', 'delivered'].includes(status)} />
          <View style={[styles.progressLine, ['ready_for_pickup', 'out_for_delivery', 'delivered'].includes(status) && { backgroundColor: '#10B981' }]} />
          <StatusStep title="Ready" isActive={status === 'ready_for_pickup'} isDone={['out_for_delivery', 'delivered'].includes(status)} />
          <View style={[styles.progressLine, ['out_for_delivery', 'delivered'].includes(status) && { backgroundColor: '#10B981' }]} />
          <StatusStep title="Delivery" isActive={status === 'out_for_delivery'} isDone={status === 'delivered'} />
        </Animated.View>

        {/* Delivery OTP — shown to customer when rider is on the way */}
        {status === 'out_for_delivery' && o?.delivery_otp && (
          <Animated.View entering={FadeInDown} layout={LinearTransition.springify()} style={styles.otpCard}>
            <View style={styles.otpCardLeft}>
              <Text style={styles.otpCardLabel}>YOUR DELIVERY CODE</Text>
              <Text style={styles.otpCardOtp}>{o.delivery_otp}</Text>
              <Text style={styles.otpCardHint}>Share this with your delivery partner</Text>
            </View>
            <View style={styles.otpShield}>
              <Text style={{ fontSize: 28 }}>🔐</Text>
            </View>
          </Animated.View>
        )}

        {status === 'delivered' && o?.invoice_url ? (
          <Animated.View entering={FadeInDown} layout={LinearTransition.springify()} style={[styles.riderCard, { backgroundColor: '#F0FDF4', borderColor: '#D1FAE5' }]}>
            <View style={[styles.riderAvatarWrapper, { backgroundColor: '#10B981' }]}>
              <Check size={24} color="white" strokeWidth={3} />
            </View>
            <View style={styles.riderInfo}>
              <Text style={[styles.riderLabel, { color: '#059669' }]}>FINANCIAL RECORD</Text>
              <Text style={styles.riderName}>Invoice is Ready</Text>
            </View>
            <TouchableOpacity
              style={[styles.riderActionBtn, { backgroundColor: '#10B981', borderColor: '#10B981' }]}
              onPress={() => { triggerHaptic(); Linking.openURL(o.invoice_url); }}
            >
              <Text style={{ color: 'white', fontWeight: '900', fontSize: 10 }}>VIEW</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown} layout={LinearTransition.springify()} style={styles.riderCard}>
            <View style={styles.riderAvatarWrapper}>
              <UserCircle size={28} color="#10B981" />
            </View>
            <View style={styles.riderInfo}>
              <Text style={styles.riderLabel}>DELIVERY PARTNER</Text>
              <Text style={styles.riderName}>{o?.rider_name || 'Assigning...'}</Text>
            </View>
            {o?.rider_phone ? (
              <TouchableOpacity
                style={styles.riderActionBtn}
                onPress={() => { triggerHaptic(); Linking.openURL(`tel:${o.rider_phone}`); }}
              >
                <Phone size={18} color="#1A1A2E" />
              </TouchableOpacity>
            ) : (
              <View style={[styles.riderActionBtn, { borderColor: 'transparent', backgroundColor: 'transparent' }]} />
            )}
          </Animated.View>
        )}

        {['pending_payment', 'confirmed'].includes(status) && (
          <Animated.View entering={FadeInDown.delay(200)} layout={LinearTransition.springify()}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => {
                Alert.alert('Cancel Order', 'Are you sure you want to cancel this order?', [
                  { text: 'No', style: 'cancel' },
                  { text: 'Yes, Cancel', style: 'destructive', onPress: () => cancelMutation.mutate() },
                ]);
              }}
              disabled={cancelMutation.isPending}
            >
              <Text style={styles.cancelBtnText}>{cancelMutation.isPending ? 'Cancelling...' : 'Cancel Order'}</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  mapContainer: { height: '65%', backgroundColor: '#f0ede9' },
  map: { flex: 1 },

  floatingHeader: { position: 'absolute', top: 60, left: 24 },
  backButton: { width: 48, height: 48, backgroundColor: '#FFFFFF', borderRadius: 24, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 15, elevation: 5 },

  statusSheet: { flex: 1, backgroundColor: '#FFFFFF', marginTop: -32, borderTopLeftRadius: 40, borderTopRightRadius: 40, paddingHorizontal: 28, paddingTop: 16, shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.05, shadowRadius: 30, elevation: 20 },
  sheetScroll: { paddingBottom: 32 },
  sheetHandle: { width: 48, height: 5, backgroundColor: '#E5E7EB', borderRadius: 3, alignSelf: 'center', marginBottom: 24 },

  timeInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  timeLabel: { color: '#9CA3AF', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5 },
  timeValue: { color: '#1A1A2E', fontSize: 36, fontWeight: '900', marginTop: 4, letterSpacing: -1 },
  onTrackBadge: { backgroundColor: '#ECFDF5', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  onTrackText: { color: '#10B981', fontWeight: '900', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 },

  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  statusStep: { alignItems: 'center', width: 64 },
  statusIconWrapper: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 9, marginTop: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },
  progressLine: { flex: 1, height: 3, backgroundColor: '#F3F4F6', marginBottom: 16, borderRadius: 2 },

  riderCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 10, elevation: 2 },
  riderAvatarWrapper: { width: 56, height: 56, backgroundColor: '#F9FAFB', borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  riderInfo: { flex: 1 },
  riderLabel: { color: '#9CA3AF', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  riderName: { color: '#1A1A2E', fontSize: 18, fontWeight: '900', marginTop: 2 },
  riderActionBtn: { width: 48, height: 48, backgroundColor: '#F9FAFB', borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB' },

  cancelBtn: { marginTop: 24, paddingVertical: 16, borderRadius: 20, alignItems: 'center' },
  cancelBtnText: { color: '#EF4444', fontWeight: '800', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.5 },
  otpCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F0FDF4', borderRadius: 16, padding: 18, marginBottom: 12,
    borderWidth: 1.5, borderColor: '#BBF7D0',
  },
  otpCardLeft: { flex: 1 },
  otpCardLabel: { fontSize: 9, fontWeight: '800', color: '#059669', letterSpacing: 1.5, marginBottom: 4 },
  otpCardOtp: { fontSize: 36, fontWeight: '900', color: '#1A1F1C', letterSpacing: 8 },
  otpCardHint: { fontSize: 11, color: '#6B7570', marginTop: 4 },
  otpShield: { paddingLeft: 12 },
});

export default OrderTrackingScreen;
