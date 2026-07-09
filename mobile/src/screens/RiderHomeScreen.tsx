import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StatusBar, Alert,
  StyleSheet, Animated, Easing, Platform, PermissionsAndroid,
} from 'react-native';
import { LeafletMap } from '../components/LeafletMap';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { updateUser } from '../store/slices/authSlice';
import { getSocket } from '../socket/client';
import { ChevronRight, Check, X, IndianRupee, Clock } from 'lucide-react-native';
import Geolocation from '@react-native-community/geolocation';
import { startRiderLocationService, stopRiderLocationService } from '../services/locationService';
import { displayLocalNotification } from '../services/localNotif';

const S = {
  orange: '#FC8019',
  orangeLight: '#FFF3E8',
  green: '#1BA672',
  greenLight: '#E8F8F1',
  red: '#EF4444',
  redLight: '#FEF2F2',
  ink: '#282C3F',
  muted: '#93959F',
  border: '#E9E9EB',
  bg: '#F8F8F8',
  white: '#FFFFFF',
  shadow: 'rgba(0,0,0,0.10)',
};

const RiderHomeScreen = ({ navigation }: any) => {
  const { user, accessToken } = useSelector((state: RootState) => state.auth);
  const insets = useSafeAreaInsets();
  const [isOnline, setIsOnline] = useState(user?.is_online || false);
  const [currentLocation, setCurrentLocation] = useState({ latitude: 28.6139, longitude: 77.2090 });
  const [pendingOrder, setPendingOrder] = useState<any>(null);
  const [countdown, setCountdown] = useState(15);
  const [acceptingKA, setAcceptingKA] = useState(false);
  const [skippedIds, setSkippedIds] = useState<string[]>([]);
  const countdownRef = useRef<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(400)).current;
  const queryClient = useQueryClient();
  const dispatch = useDispatch();

  const { data: earnings } = useQuery({
    queryKey: ['rider-earnings'],
    queryFn: () => api.get('/riders/earnings/today'),
  });

  const { data: activeOrderData, isFetched: activeOrderFetched } = useQuery({
    queryKey: ['rider-active-order'],
    queryFn: () => api.get('/riders/orders/active'),
    enabled: isOnline,
    refetchInterval: isOnline ? 8000 : false,
  });

  const { data: poolData } = useQuery({
    queryKey: ['rider-missions-pool'],
    queryFn: () => api.get('/riders/orders/pool'),
    enabled: isOnline && (!activeOrderData?.orders || activeOrderData.orders.length === 0),
    refetchInterval: 5000,
  });

  const activeOrders = activeOrderData?.orders || [];
  const pool: any[] = (poolData?.orders || []).filter((o: any) => !skippedIds.includes(o.id));

  const toggleOnlineMutation = useMutation({
    mutationFn: (online: boolean) => api.post(online ? '/riders/online' : '/riders/offline', {}),
    onSuccess: (_, val) => {
      setIsOnline(val);
      dispatch(updateUser({ is_online: val, online_since: val ? new Date().toISOString() : null }));
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });

  const claimMutation = useMutation({
    mutationFn: (orderId: string) => api.post(`/riders/orders/${orderId}/claim`, {}),
    onSuccess: () => {
      clearTimer();
      import('react-native').then(({ Vibration }) => Vibration.cancel());
      setPendingOrder(null);
      queryClient.invalidateQueries({ queryKey: ['rider-active-order'] });
      queryClient.invalidateQueries({ queryKey: ['rider-missions-pool'] });
    },
    onError: (err: any) => {
      import('react-native').then(({ Vibration }) => Vibration.cancel());
      setPendingOrder(null);
      if (err.message === 'RIDER_BUSY') {
        queryClient.invalidateQueries({ queryKey: ['rider-active-order'] });
      } else {
        Alert.alert('Order Taken', 'This order was claimed by another rider.');
      }
    },
  });

  const unclaimMutation = useMutation({
    mutationFn: (orderId: string) => api.post(`/riders/orders/${orderId}/unclaim`, {}),
    onSettled: () => {
      hideNotification();
      queryClient.invalidateQueries({ queryKey: ['rider-active-order'] });
    },
  });

  const showNotification = (order: any, timeoutSeconds = 60) => {
    setPendingOrder(order);
    setCountdown(timeoutSeconds);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 70, friction: 10 }).start();
    import('react-native').then(({ Vibration }) => Vibration.vibrate([500, 500], true));
    displayLocalNotification('New Delivery Request', 'A new order is available. Tap to view.', { type: 'order_update' });
    startTimer(order._kitchenAssigned ? order.orderId : order.id, timeoutSeconds, order._kitchenAssigned);
  };

  const hideNotification = () => {
    import('react-native').then(({ Vibration }) => Vibration.cancel());
    Animated.timing(slideAnim, { toValue: 400, useNativeDriver: true, duration: 250, easing: Easing.in(Easing.quad) }).start(() => setPendingOrder(null));
    clearTimer();
  };

  const startTimer = (orderId: string, seconds = 60, kitchenAssigned = false) => {
    clearTimer();
    let count = seconds;
    countdownRef.current = setInterval(() => {
      count -= 1;
      setCountdown(count);
      if (count <= 0) {
        clearTimer();
        import('react-native').then(({ Vibration }) => Vibration.cancel());
        if (kitchenAssigned) unclaimMutation.mutate(orderId);
        else { setSkippedIds(prev => [...prev, orderId]); hideNotification(); }
      }
    }, 1000);
  };

  const clearTimer = () => {
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  };

  useEffect(() => {
    if (activeOrderFetched && activeOrders.length === 0 && !pendingOrder && pool.length > 0) {
      showNotification(pool[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolData, activeOrders]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = (data: { orderId: string; displayId: string; assignedBy: string; deliveryAddress?: string }) => {
      if (!isOnline) return;
      showNotification({ ...data, id: data.orderId, display_id: data.displayId, delivery_address_text: data.deliveryAddress || null, _kitchenAssigned: true }, 40);
    };
    socket.on('order_assigned', handler);
    return () => { socket.off('order_assigned', handler); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  useEffect(() => {
    if (!isOnline || activeOrders.length > 0) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.6, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isOnline, activeOrders, pulseAnim]);

  const getEstimatedEarnings = (order: any) => {
    let base = 20;
    if (order.kitchen_lat && order.customer_lat) {
      const R = 6371;
      const kLat = parseFloat(order.kitchen_lat), kLng = parseFloat(order.kitchen_lng);
      const cLat = parseFloat(order.customer_lat), cLng = parseFloat(order.customer_lng);
      if (!isNaN(kLat) && !isNaN(kLng) && !isNaN(cLat) && !isNaN(cLng)) {
        const dLat = (cLat - kLat) * (Math.PI / 180), dLng = (cLng - kLng) * (Math.PI / 180);
        const a = Math.sin(dLat/2)**2 + Math.cos(kLat*(Math.PI/180))*Math.cos(cLat*(Math.PI/180))*Math.sin(dLng/2)**2;
        const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        if (dist > 2) base += (dist - 2) * 5;
      }
    }
    return Math.floor(base * 0.9);
  };

  const latestLocationRef = useRef(currentLocation);
  useEffect(() => { latestLocationRef.current = currentLocation; }, [currentLocation]);

  useEffect(() => {
    let watchId: number;
    let interval: ReturnType<typeof setInterval>;
    const startTracking = async () => {
      if (Platform.OS === 'android') {
        try { await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION); } catch {}
      }
      if (isOnline) {
        if (accessToken) startRiderLocationService(accessToken);
        getSocket()?.emit('update_location', { lat: latestLocationRef.current.latitude, lng: latestLocationRef.current.longitude });
      } else {
        stopRiderLocationService();
      }
      watchId = Geolocation.watchPosition(
        pos => {
          const { latitude, longitude } = pos.coords;
          setCurrentLocation({ latitude, longitude });
          if (isOnline) getSocket()?.emit('update_location', { lat: latitude, lng: longitude });
        },
        () => {},
        { enableHighAccuracy: false, distanceFilter: 5, interval: 4000, timeout: 15000, maximumAge: 10000 },
      );
      interval = setInterval(() => {
        if (isOnline) getSocket()?.emit('update_location', { lat: latestLocationRef.current.latitude, lng: latestLocationRef.current.longitude });
      }, 60000);
    };
    startTracking();
    return () => {
      if (watchId !== undefined) Geolocation.clearWatch(watchId);
      if (interval !== undefined) clearInterval(interval);
    };
  }, [isOnline, accessToken]);

  useEffect(() => () => clearTimer(), []);

  const todayEarnings = ((earnings?.totalPaise || 0) / 100).toFixed(0);
  const ordersToday = earnings?.deliveriesCount || 0;

  const primaryOrder = activeOrders[0];
  let routeTo: { lat: number; lng: number } | undefined;
  if (primaryOrder) {
    const goingToKitchen = ['confirmed', 'preparing', 'ready_for_pickup'].includes(primaryOrder.status);
    const destLat = goingToKitchen ? parseFloat(primaryOrder.kitchen_lat) : parseFloat(primaryOrder.customer_lat);
    const destLng = goingToKitchen ? parseFloat(primaryOrder.kitchen_lng) : parseFloat(primaryOrder.customer_lng);
    if (!isNaN(destLat) && !isNaN(destLng)) routeTo = { lat: destLat, lng: destLng };
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Full-screen map */}
      <View style={StyleSheet.absoluteFill}>
        <LeafletMap
          latitude={currentLocation.latitude}
          longitude={currentLocation.longitude}
          zoom={15}
          routeFrom={activeOrders.length > 0 ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : undefined}
          routeTo={routeTo}
          markers={[
            { id: 'rider', lat: currentLocation.latitude, lng: currentLocation.longitude,
              iconUrl: 'https://cdn-icons-png.flaticon.com/512/3198/3198336.png' },
            ...activeOrders.flatMap((order: any) => {
              const goingToKitchen = ['confirmed', 'preparing', 'ready_for_pickup'].includes(order.status);
              if (goingToKitchen && order.kitchen_lat)
                return [{ id: `k-${order.id}`, lat: parseFloat(order.kitchen_lat), lng: parseFloat(order.kitchen_lng),
                  iconUrl: 'https://cdn-icons-png.flaticon.com/512/3448/3448609.png' }];
              if (!goingToKitchen && order.customer_lat)
                return [{ id: `c-${order.id}`, lat: parseFloat(order.customer_lat), lng: parseFloat(order.customer_lng),
                  iconUrl: 'https://cdn-icons-png.flaticon.com/512/619/619034.png' }];
              return [];
            }),
          ]}
          style={{ flex: 1 }}
        />
      </View>

      {/* ── Top header card ───────────────────────────────────────────────── */}
      <View style={[styles.topCard, { paddingTop: insets.top + 10 }]}>
        <View style={styles.topRow}>
          {/* Rider name + status */}
          <View style={styles.nameBlock}>
            <View style={[styles.statusDot, { backgroundColor: isOnline ? S.green : S.muted }]} />
            <View>
              <Text style={styles.nameText}>{user?.name?.split(' ')[0] || 'Rider'}</Text>
              <Text style={styles.statusText}>{isOnline ? 'Online' : 'Offline'}</Text>
            </View>
          </View>

          {/* Today earnings */}
          <View style={styles.earningsBlock}>
            <IndianRupee size={13} color={S.orange} />
            <Text style={styles.earningsAmt}>{todayEarnings}</Text>
            <Text style={styles.earningsLabel}>{ordersToday} orders today</Text>
          </View>

          {/* Online toggle */}
          <TouchableOpacity
            style={[styles.toggleBtn, isOnline ? styles.toggleBtnOn : styles.toggleBtnOff]}
            onPress={() => toggleOnlineMutation.mutate(!isOnline)}
            disabled={toggleOnlineMutation.isPending}
            activeOpacity={0.85}
          >
            <Text style={[styles.toggleText, { color: isOnline ? S.white : S.orange }]}>
              {isOnline ? 'ON DUTY' : 'GO ONLINE'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Waiting pulse (online, no orders) ────────────────────────────── */}
      {isOnline && activeOrders.length === 0 && !pendingOrder && (
        <View style={styles.waitingCenter}>
          <View style={styles.pulseWrap}>
            <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }], opacity: pulseAnim.interpolate({ inputRange: [1, 1.6], outputRange: [0.35, 0] }) }]} />
            <View style={styles.pulseDot} />
          </View>
          <View style={styles.waitingCard}>
            <Text style={styles.waitingTitle}>Looking for orders nearby…</Text>
            <Text style={styles.waitingSub}>You'll get a notification as soon as one arrives</Text>
          </View>
        </View>
      )}

      {/* ── Offline banner ────────────────────────────────────────────────── */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <View style={styles.offlineCard}>
            <Text style={styles.offlineTitle}>You're Offline</Text>
            <Text style={styles.offlineSub}>Go online to start receiving delivery requests</Text>
            <TouchableOpacity style={styles.goOnlineBtn} onPress={() => toggleOnlineMutation.mutate(true)} activeOpacity={0.9}>
              <Text style={styles.goOnlineText}>Go Online</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Active orders list ────────────────────────────────────────────── */}
      {activeOrders.length > 0 && !pendingOrder && (
        <View style={[styles.ordersSheet, { paddingBottom: insets.bottom + 16 }]}>
          {activeOrders.map((order: any, idx: number) => {
            const goingToKitchen = ['confirmed', 'preparing', 'ready_for_pickup'].includes(order.status);
            const dest = goingToKitchen ? (order.kitchen_name || 'Kitchen') : (order.customer_name || 'Customer');
            const label = goingToKitchen ? 'PICK UP FROM' : 'DELIVER TO';
            return (
              <TouchableOpacity
                key={order.id}
                style={styles.orderCard}
                onPress={() => navigation.navigate('AssignedOrder', { order })}
                activeOpacity={0.85}
              >
                <View style={[styles.orderCardStripe, { backgroundColor: goingToKitchen ? S.orange : S.green }]} />
                <View style={styles.orderCardBody}>
                  <View style={styles.orderCardTop}>
                    <Text style={styles.orderIdText}>{order.display_id}</Text>
                    {activeOrders.length > 1 && (
                      <View style={styles.orderIndexBadge}>
                        <Text style={styles.orderIndexText}>#{idx + 1}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.orderDestLabel}>{label}</Text>
                  <Text style={styles.orderDestText} numberOfLines={1}>{dest}</Text>
                </View>
                <ChevronRight size={20} color={S.muted} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ── Incoming order notification ───────────────────────────────────── */}
      {pendingOrder && (
        <Animated.View style={[styles.notifSheet, { paddingBottom: insets.bottom + 16, transform: [{ translateY: slideAnim }] }]}>
          {/* Orange top strip */}
          <View style={[styles.notifStrip, pendingOrder._kitchenAssigned && { backgroundColor: '#E67E22' }]}>
            <Text style={styles.notifStripLabel}>
              {pendingOrder._kitchenAssigned ? '📦  Assigned by Kitchen' : '🛵  New Delivery Request'}
            </Text>
            <View style={styles.countdownBadge}>
              <Clock size={11} color={S.white} />
              <Text style={styles.countdownText}>{countdown}s</Text>
            </View>
          </View>

          <View style={styles.notifBody}>
            <Text style={styles.notifOrderId}>{pendingOrder.display_id || pendingOrder.displayId}</Text>

            <View style={styles.notifRow}>
              <View style={styles.notifField}>
                <Text style={styles.notifFieldLabel}>DELIVER TO</Text>
                <Text style={styles.notifFieldValue} numberOfLines={2}>
                  {pendingOrder.delivery_address_text || 'Nearby location'}
                </Text>
              </View>
              {!pendingOrder._kitchenAssigned && (
                <View style={[styles.notifField, { alignItems: 'flex-end' }]}>
                  <Text style={styles.notifFieldLabel}>EST. EARNINGS</Text>
                  <Text style={[styles.notifFieldValue, { color: S.orange, fontSize: 20, fontWeight: '800' }]}>
                    ₹{getEstimatedEarnings(pendingOrder)}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.notifBtns}>
              <TouchableOpacity
                style={styles.declineBtn}
                onPress={() => {
                  if (pendingOrder._kitchenAssigned) unclaimMutation.mutate(pendingOrder.orderId || pendingOrder.id);
                  else { setSkippedIds(prev => [...prev, pendingOrder.id]); hideNotification(); }
                }}
                disabled={unclaimMutation.isPending}
                activeOpacity={0.8}
              >
                <X size={18} color={S.red} />
                <Text style={styles.declineBtnText}>Decline</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.acceptBtn, (claimMutation.isPending || acceptingKA) && { opacity: 0.6 },
                  pendingOrder._kitchenAssigned && { backgroundColor: '#E67E22' }]}
                onPress={async () => {
                  if (pendingOrder._kitchenAssigned) {
                    clearTimer();
                    setAcceptingKA(true);
                    try { await api.get('/riders/orders/active'); hideNotification(); }
                    catch { hideNotification(); queryClient.invalidateQueries({ queryKey: ['rider-active-order'] }); }
                    finally { setAcceptingKA(false); }
                  } else {
                    claimMutation.mutate(pendingOrder.id);
                  }
                }}
                disabled={claimMutation.isPending || unclaimMutation.isPending || acceptingKA}
                activeOpacity={0.9}
              >
                {acceptingKA
                  ? <Text style={styles.acceptBtnText}>Accepting…</Text>
                  : <><Check size={18} color={S.white} /><Text style={styles.acceptBtnText}>Accept</Text></>
                }
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: S.bg },

  // Top card
  topCard: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50,
    backgroundColor: S.white,
    paddingHorizontal: 16, paddingBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nameBlock: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  nameText: { fontSize: 15, fontWeight: '800', color: S.ink },
  statusText: { fontSize: 11, color: S.muted, fontWeight: '600', marginTop: 1 },
  earningsBlock: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  earningsAmt: { fontSize: 15, fontWeight: '800', color: S.ink },
  earningsLabel: { fontSize: 10, color: S.muted, fontWeight: '600', marginLeft: 4 },
  toggleBtn: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8, borderWidth: 1.5,
  },
  toggleBtnOn: { backgroundColor: S.orange, borderColor: S.orange },
  toggleBtnOff: { backgroundColor: S.white, borderColor: S.orange },
  toggleText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  // Waiting
  waitingCenter: {
    position: 'absolute', bottom: 120, left: 0, right: 0, alignItems: 'center', zIndex: 30,
  },
  pulseWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  pulseRing: {
    position: 'absolute', width: 40, height: 40, borderRadius: 20,
    backgroundColor: S.orange,
  },
  pulseDot: {
    width: 16, height: 16, borderRadius: 8, backgroundColor: S.orange,
    shadowColor: S.orange, shadowOpacity: 0.5, shadowRadius: 8, elevation: 6,
  },
  waitingCard: {
    backgroundColor: S.white, borderRadius: 16, paddingHorizontal: 24, paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 5,
  },
  waitingTitle: { color: S.ink, fontSize: 14, fontWeight: '700' },
  waitingSub: { color: S.muted, fontSize: 12, marginTop: 3, textAlign: 'center' },

  // Offline
  offlineBanner: { position: 'absolute', bottom: 100, left: 20, right: 20, zIndex: 30 },
  offlineCard: {
    backgroundColor: S.white, borderRadius: 20, padding: 28, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20, elevation: 8,
  },
  offlineTitle: { fontSize: 20, fontWeight: '800', color: S.ink, marginBottom: 6 },
  offlineSub: { fontSize: 13, color: S.muted, marginBottom: 24, textAlign: 'center', lineHeight: 18 },
  goOnlineBtn: { backgroundColor: S.orange, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40 },
  goOnlineText: { color: S.white, fontSize: 15, fontWeight: '800' },

  // Active orders
  ordersSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 40,
    backgroundColor: S.white, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 12, paddingHorizontal: 16,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: -4 },
    elevation: 12, gap: 10,
  },
  orderCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: S.white,
    borderRadius: 12, borderWidth: 1, borderColor: S.border,
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  orderCardStripe: { width: 4, alignSelf: 'stretch' },
  orderCardBody: { flex: 1, paddingHorizontal: 14, paddingVertical: 12 },
  orderCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  orderIdText: { fontSize: 16, fontWeight: '800', color: S.ink },
  orderIndexBadge: { backgroundColor: S.border, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  orderIndexText: { fontSize: 10, fontWeight: '700', color: S.muted },
  orderDestLabel: { fontSize: 10, fontWeight: '700', color: S.muted, letterSpacing: 0.5, marginBottom: 2 },
  orderDestText: { fontSize: 13, fontWeight: '600', color: S.ink },

  // Incoming notification
  notifSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 50,
    backgroundColor: S.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 24, shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  },
  notifStrip: {
    backgroundColor: S.orange, paddingHorizontal: 20, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  notifStripLabel: { color: S.white, fontSize: 13, fontWeight: '700' },
  countdownBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  countdownText: { color: S.white, fontSize: 12, fontWeight: '800' },
  notifBody: { padding: 20 },
  notifOrderId: { fontSize: 28, fontWeight: '900', color: S.ink, marginBottom: 14 },
  notifRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  notifField: { flex: 1 },
  notifFieldLabel: { fontSize: 10, fontWeight: '700', color: S.muted, letterSpacing: 0.8, marginBottom: 4 },
  notifFieldValue: { fontSize: 13, fontWeight: '600', color: S.ink, lineHeight: 18 },
  notifBtns: { flexDirection: 'row', gap: 12 },
  declineBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 15, borderRadius: 12,
    backgroundColor: S.redLight, borderWidth: 1, borderColor: '#FECACA',
  },
  declineBtnText: { color: S.red, fontSize: 15, fontWeight: '700' },
  acceptBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 15, borderRadius: 12, backgroundColor: S.orange,
    shadowColor: S.orange, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },
  acceptBtnText: { color: S.white, fontSize: 15, fontWeight: '800' },
});

export default RiderHomeScreen;
