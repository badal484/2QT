import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StatusBar, Alert,
  StyleSheet, Animated, Easing,
} from 'react-native';
import { LeafletMap } from '../components/LeafletMap';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { logout, updateUser } from '../store/slices/authSlice';
import { getSocket } from '../socket/client';
import { LogOut, ChevronRight, Check, X, Wallet, History } from 'lucide-react-native';
import Geolocation from '@react-native-community/geolocation';

const G = {
  bg: '#070F0C',
  surface: '#0F1F18',
  card: '#152318',
  primary: '#1B5E46',
  accent: '#10B981',
  accentDim: 'rgba(16,185,129,0.15)',
  orange: '#F97316',
  orangeDim: 'rgba(249,115,22,0.15)',
  danger: '#EF4444',
  white: '#FFFFFF',
  muted: '#6B9E85',
  border: 'rgba(16,185,129,0.15)',
};

const RiderHomeScreen = ({ navigation }: any) => {
  const { user } = useSelector((state: RootState) => state.auth);
  const insets = useSafeAreaInsets();
  const [isOnline, setIsOnline] = useState(user?.is_online || false);
  const [currentLocation, setCurrentLocation] = useState({ latitude: 23.7, longitude: 85.1 });
  const [pendingOrder, setPendingOrder] = useState<any>(null);
  const [countdown, setCountdown] = useState(15);
  const [skippedIds, setSkippedIds] = useState<string[]>([]);
  const countdownRef = useRef<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(300)).current;
  const queryClient = useQueryClient();
  const dispatch = useDispatch();

  // ── Queries ──────────────────────────────────────────────────────────────
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
    enabled: isOnline && !activeOrderData?.order,
    refetchInterval: 5000,
  });

  const activeOrder = activeOrderData?.order;
  const pool: any[] = (poolData?.orders || []).filter((o: any) => !skippedIds.includes(o.id));

  // ── Mutations ─────────────────────────────────────────────────────────────
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
      setPendingOrder(null);
      queryClient.invalidateQueries({ queryKey: ['rider-active-order'] });
      queryClient.invalidateQueries({ queryKey: ['rider-missions-pool'] });
    },
    onError: (err: any) => {
      setPendingOrder(null);
      if (err.message === 'RIDER_BUSY') {
        queryClient.invalidateQueries({ queryKey: ['rider-active-order'] });
      } else {
        Alert.alert('Order Taken', 'This order was claimed by another rider.');
      }
    },
  });

  // ── Incoming order notification slide ─────────────────────────────────────
  const showNotification = (order: any) => {
    setPendingOrder(order);
    setCountdown(15);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80 }).start();
    startTimer(order.id);
  };

  const hideNotification = () => {
    Animated.timing(slideAnim, { toValue: 400, useNativeDriver: true, duration: 250, easing: Easing.in(Easing.quad) }).start(() => {
      setPendingOrder(null);
    });
    clearTimer();
  };

  const startTimer = (orderId: string) => {
    clearTimer();
    let count = 15;
    countdownRef.current = setInterval(() => {
      count -= 1;
      setCountdown(count);
      if (count <= 0) {
        clearTimer();
        setSkippedIds(prev => [...prev, orderId]);
        hideNotification();
      }
    }, 1000);
  };

  const clearTimer = () => {
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  };

  // Show notification only after active order query has resolved (avoids RIDER_BUSY on startup)
  useEffect(() => {
    if (activeOrderFetched && !activeOrder && !pendingOrder && pool.length > 0) {
      showNotification(pool[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolData, activeOrder]);

  // ── Pulsing dot animation ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isOnline || activeOrder) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isOnline, activeOrder, pulseAnim]);

  // ── Socket ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !isOnline) return;
    socket.on('new_order_assigned', () => {
      queryClient.invalidateQueries({ queryKey: ['rider-active-order'] });
    });
    socket.on('order_status_update', () => {
      queryClient.invalidateQueries({ queryKey: ['rider-active-order'] });
    });
    socket.on('new_available_mission', () => {
      queryClient.invalidateQueries({ queryKey: ['rider-missions-pool'] });
    });
    return () => {
      socket.off('new_order_assigned');
      socket.off('order_status_update');
      socket.off('new_available_mission');
    };
  }, [isOnline, queryClient]);

  // ── GPS location heartbeat ─────────────────────────────────────────────────
  useEffect(() => {
    const watchId = Geolocation.watchPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        setCurrentLocation({ latitude, longitude });
        if (isOnline) {
          const socket = getSocket();
          socket?.emit('update_location', { lat: latitude, lng: longitude });
        }
      },
      () => {},
      { enableHighAccuracy: false, distanceFilter: 20, interval: 8000 },
    );
    return () => Geolocation.clearWatch(watchId);
  }, [isOnline]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => () => clearTimer(), []);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Go off duty and sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => dispatch(logout()) },
    ]);
  };

  const todayEarnings = ((earnings?.totalPaise || 0) / 100).toFixed(0);
  const ordersToday = earnings?.deliveriesCount || 0;
  const isGoingToKitchen = activeOrder && ['confirmed', 'preparing', 'ready_for_pickup'].includes(activeOrder.status);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Full screen map */}
      <View style={StyleSheet.absoluteFill}>
        <LeafletMap
          latitude={currentLocation.latitude}
          longitude={currentLocation.longitude}
          zoom={15}
          markers={[
            { id: 'rider', lat: currentLocation.latitude, lng: currentLocation.longitude,
              iconUrl: 'https://cdn-icons-png.flaticon.com/512/3198/3198336.png' },
            ...(activeOrder && isGoingToKitchen && activeOrder.kitchen_lat ? [{
              id: 'dest', lat: parseFloat(activeOrder.kitchen_lat), lng: parseFloat(activeOrder.kitchen_lng),
              iconUrl: 'https://cdn-icons-png.flaticon.com/512/3448/3448609.png',
            }] : []),
            ...(activeOrder && !isGoingToKitchen && activeOrder.customer_lat ? [{
              id: 'dest', lat: parseFloat(activeOrder.customer_lat), lng: parseFloat(activeOrder.customer_lng),
              iconUrl: 'https://cdn-icons-png.flaticon.com/512/619/619034.png',
            }] : []),
          ]}
          style={{ flex: 1 }}
        />
      </View>

      {/* ── Top header ─────────────────────────────────────────────────────── */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        {/* Rider info pill */}
        <View style={styles.riderPill}>
          <View style={[styles.onlineDot, { backgroundColor: isOnline ? G.accent : '#64748B' }]} />
          <Text style={styles.riderPillName}>{user?.name || 'Rider'}</Text>
        </View>

        {/* Earnings pill */}
        <TouchableOpacity style={styles.earningsPill} onPress={() => navigation.navigate('Earnings')} activeOpacity={0.8}>
          <Wallet size={14} color={G.orange} />
          <Text style={styles.earningsPillText}>₹{todayEarnings}</Text>
          <Text style={styles.earningsPillSub}>{ordersToday} orders</Text>
        </TouchableOpacity>

        {/* Online toggle */}
        <TouchableOpacity
          style={[styles.onlineToggle, isOnline ? styles.onlineToggleOn : styles.onlineToggleOff]}
          onPress={() => toggleOnlineMutation.mutate(!isOnline)}
          disabled={toggleOnlineMutation.isPending}
          activeOpacity={0.9}
        >
          <Text style={[styles.onlineToggleText, { color: isOnline ? G.accent : '#64748B' }]}>
            {isOnline ? 'ON DUTY' : 'GO ONLINE'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <TouchableOpacity style={[styles.logoutBtn, { top: insets.top + 12 + 52 }]} onPress={handleLogout} activeOpacity={0.8}>
        <LogOut size={18} color={G.muted} />
      </TouchableOpacity>

      {/* History */}
      <TouchableOpacity style={[styles.historyBtn, { top: insets.top + 12 + 52 }]} onPress={() => navigation.navigate('RiderHistory')} activeOpacity={0.8}>
        <History size={18} color={G.muted} />
      </TouchableOpacity>

      {/* ── Waiting pulse (online, no order) ───────────────────────────────── */}
      {isOnline && !activeOrder && !pendingOrder && (
        <View style={styles.waitingWrapper}>
          <Animated.View style={[styles.pulseDot, { transform: [{ scale: pulseAnim }] }]} />
          <View style={styles.waitingCard}>
            <Text style={styles.waitingTitle}>Waiting for orders…</Text>
            <Text style={styles.waitingSubtitle}>You'll be notified when one is nearby</Text>
          </View>
        </View>
      )}

      {/* ── Offline state ──────────────────────────────────────────────────── */}
      {!isOnline && (
        <View style={styles.offlineCard}>
          <Text style={styles.offlineTitle}>You're offline</Text>
          <Text style={styles.offlineSub}>Go online to start accepting deliveries</Text>
          <TouchableOpacity
            style={styles.goOnlineBtn}
            onPress={() => toggleOnlineMutation.mutate(true)}
            activeOpacity={0.9}
          >
            <Text style={styles.goOnlineBtnText}>Go Online</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Active order pill ──────────────────────────────────────────────── */}
      {activeOrder && !pendingOrder && (
        <TouchableOpacity
          style={[styles.activeOrderPill, { bottom: insets.bottom + 24 }]}
          onPress={() => navigation.navigate('AssignedOrder', { order: activeOrder })}
          activeOpacity={0.9}
        >
          <View style={styles.activeOrderLeft}>
            <View style={styles.activeOrderDot} />
            <View>
              <Text style={styles.activeOrderLabel}>ACTIVE ORDER</Text>
              <Text style={styles.activeOrderId}>{activeOrder.display_id}</Text>
            </View>
          </View>
          <View style={styles.activeOrderRight}>
            <Text style={styles.activeOrderNext} numberOfLines={1}>
              {isGoingToKitchen ? `→ ${activeOrder.kitchen_name || 'Kitchen'}` : `→ ${activeOrder.customer_name || 'Customer'}`}
            </Text>
            <ChevronRight size={20} color={G.accent} />
          </View>
        </TouchableOpacity>
      )}

      {/* ── Incoming order notification card ──────────────────────────────── */}
      {pendingOrder && (
        <Animated.View
          style={[styles.notifCard, { bottom: insets.bottom + 16, transform: [{ translateY: slideAnim }] }]}
        >
          {/* Header */}
          <View style={styles.notifHeader}>
            <View style={styles.notifHeaderLeft}>
              <View style={styles.notifDot} />
              <Text style={styles.notifLabel}>NEW ORDER</Text>
            </View>
            <View style={styles.countdownCircle}>
              <Text style={[styles.countdownText, { color: countdown <= 5 ? G.danger : G.accent }]}>{countdown}</Text>
            </View>
          </View>

          <Text style={styles.notifOrderId}>{pendingOrder.display_id}</Text>

          {/* Details row */}
          <View style={styles.notifDetailsRow}>
            <View style={styles.notifDetail}>
              <Text style={styles.notifDetailLabel}>DELIVER TO</Text>
              <Text style={styles.notifDetailValue} numberOfLines={1}>{pendingOrder.delivery_address_text || 'Nearby'}</Text>
            </View>
            <View style={[styles.notifDetail, { alignItems: 'flex-end' }]}>
              <Text style={styles.notifDetailLabel}>EARNINGS</Text>
              <Text style={[styles.notifDetailValue, { color: G.orange }]}>
                ₹{pendingOrder.delivery_fee_paise ? Math.round(pendingOrder.delivery_fee_paise / 100) : '—'}
              </Text>
            </View>
          </View>

          {/* Buttons */}
          <View style={styles.notifBtns}>
            <TouchableOpacity
              style={styles.skipBtn}
              onPress={() => {
                setSkippedIds(prev => [...prev, pendingOrder.id]);
                hideNotification();
              }}
              activeOpacity={0.8}
            >
              <X size={18} color='#EF4444' />
              <Text style={styles.skipBtnText}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.acceptBtn, claimMutation.isPending && { opacity: 0.7 }]}
              onPress={() => claimMutation.mutate(pendingOrder.id)}
              disabled={claimMutation.isPending}
              activeOpacity={0.9}
            >
              <Check size={18} color={G.white} />
              <Text style={styles.acceptBtnText}>Accept</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: G.bg },

  topBar: {
    position: 'absolute', top: 0, left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 50,
  },
  riderPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: G.surface, borderRadius: 24, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: G.border,
  },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  riderPillName: { color: G.white, fontSize: 13, fontWeight: '700' },
  earningsPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: G.surface, borderRadius: 24, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: G.border,
  },
  earningsPillText: { color: G.orange, fontSize: 13, fontWeight: '800' },
  earningsPillSub: { color: G.muted, fontSize: 10, fontWeight: '600' },
  onlineToggle: {
    flex: 1, borderRadius: 24, paddingVertical: 10, alignItems: 'center',
    borderWidth: 1.5,
  },
  onlineToggleOn: { backgroundColor: G.accentDim, borderColor: G.accent },
  onlineToggleOff: { backgroundColor: G.surface, borderColor: 'rgba(100,116,139,0.3)' },
  onlineToggleText: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },

  logoutBtn: {
    position: 'absolute', left: 16, width: 38, height: 38, borderRadius: 19,
    backgroundColor: G.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: G.border, zIndex: 50,
  },
  historyBtn: {
    position: 'absolute', right: 16, width: 38, height: 38, borderRadius: 19,
    backgroundColor: G.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: G.border, zIndex: 50,
  },

  // Waiting
  waitingWrapper: { position: 'absolute', bottom: 120, alignSelf: 'center', alignItems: 'center', zIndex: 40 },
  pulseDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: G.accent, marginBottom: 12,
    shadowColor: G.accent, shadowOpacity: 0.6, shadowRadius: 10, elevation: 6 },
  waitingCard: {
    backgroundColor: G.surface, borderRadius: 20, paddingHorizontal: 24, paddingVertical: 14,
    alignItems: 'center', borderWidth: 1, borderColor: G.border,
  },
  waitingTitle: { color: G.white, fontSize: 14, fontWeight: '700' },
  waitingSubtitle: { color: G.muted, fontSize: 11, marginTop: 3 },

  // Offline
  offlineCard: {
    position: 'absolute', bottom: 48, left: 24, right: 24, zIndex: 40,
    backgroundColor: G.surface, borderRadius: 24, padding: 28,
    alignItems: 'center', borderWidth: 1, borderColor: G.border,
  },
  offlineTitle: { color: G.white, fontSize: 20, fontWeight: '800', marginBottom: 6 },
  offlineSub: { color: G.muted, fontSize: 13, marginBottom: 20, textAlign: 'center' },
  goOnlineBtn: {
    backgroundColor: G.accent, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 40,
  },
  goOnlineBtnText: { color: G.white, fontSize: 15, fontWeight: '800' },

  // Active order pill
  activeOrderPill: {
    position: 'absolute', left: 16, right: 16, zIndex: 40,
    backgroundColor: G.surface, borderRadius: 20, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: G.accent,
    shadowColor: G.accent, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8,
  },
  activeOrderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  activeOrderDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: G.accent },
  activeOrderLabel: { color: G.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  activeOrderId: { color: G.white, fontSize: 17, fontWeight: '900', marginTop: 1 },
  activeOrderRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  activeOrderNext: { color: G.accent, fontSize: 12, fontWeight: '700', maxWidth: 140 },

  // Incoming order notification
  notifCard: {
    position: 'absolute', left: 16, right: 16, zIndex: 50,
    backgroundColor: G.surface, borderRadius: 24, padding: 20,
    borderWidth: 1.5, borderColor: G.accent,
    shadowColor: G.accent, shadowOpacity: 0.25, shadowRadius: 20, elevation: 12,
  },
  notifHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  notifHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notifDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: G.accent },
  notifLabel: { color: G.accent, fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  countdownCircle: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 2, borderColor: G.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  countdownText: { fontSize: 13, fontWeight: '900' },
  notifOrderId: { color: G.white, fontSize: 26, fontWeight: '900', marginBottom: 12 },
  notifDetailsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  notifDetail: { flex: 1 },
  notifDetailLabel: { color: G.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginBottom: 3 },
  notifDetailValue: { color: G.white, fontSize: 13, fontWeight: '700' },
  notifBtns: { flexDirection: 'row', gap: 12 },
  skipBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 14, borderRadius: 14,
    backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
  },
  skipBtnText: { color: '#EF4444', fontSize: 14, fontWeight: '800' },
  acceptBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14, backgroundColor: G.accent,
    shadowColor: G.accent, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  acceptBtnText: { color: G.white, fontSize: 15, fontWeight: '800' },
});

export default RiderHomeScreen;
