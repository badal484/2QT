import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StatusBar, Alert, Linking,
  StyleSheet, Animated, Easing, Platform, PermissionsAndroid,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LeafletMap } from '../components/LeafletMap';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { updateUser } from '../store/slices/authSlice';
import { getSocket } from '../socket/client';
import { ChevronRight, Check, X, IndianRupee, Navigation, MapPin } from 'lucide-react-native';
import Geolocation from '@react-native-community/geolocation';
import { startRiderLocationService, stopRiderLocationService } from '../services/locationService';
import { displayLocalNotification } from '../services/localNotif';

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const S = {
  orange: '#FC4603',
  orangeLight: '#FFF0E8',
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
  const isOnlineRef = useRef(user?.is_online || false);
  const [currentLocation, setCurrentLocation] = useState({ latitude: 28.6139, longitude: 77.2090 });
  const [pendingOrder, setPendingOrder] = useState<any>(null);
  const pendingOrderRef = useRef<any>(null);
  const [acceptingKA] = useState(false);
  const [skippedIds, setSkippedIds] = useState<string[]>([]);
  const skippedIdsRef = useRef<string[]>([]);

  // Load persisted declines on mount (4-hour TTL)
  useEffect(() => {
    AsyncStorage.getItem('rider_skipped_orders').then(raw => {
      if (!raw) return;
      try {
        const map: Record<string, number> = JSON.parse(raw);
        const cutoff = Date.now() - 4 * 60 * 60 * 1000;
        const ids = Object.entries(map).filter(([, ts]) => ts > cutoff).map(([id]) => id);
        if (ids.length > 0) {
          skippedIdsRef.current = ids;
          setSkippedIds(ids);
        }
      } catch {}
    }).catch(() => {});
  }, []);
  const latestLocationRef = useRef({ latitude: 0, longitude: 0 });
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(400)).current;
  const queryClient = useQueryClient();
  const dispatch = useDispatch();

  // Auto-assign overlay state
  const [autoAssignedOrder, setAutoAssignedOrder] = useState<{ orderId: string; displayId: string; batchDisplayId?: string } | null>(null);
  const autoAssignedOrderRef = useRef<{ orderId: string; displayId: string; batchDisplayId?: string } | null>(null);
  const [autoAssignCountdown, setAutoAssignCountdown] = useState(30);
  const autoAssignTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    enabled: isOnline && (!activeOrderData?.orders || activeOrderData.orders.length < 3),
    refetchInterval: 5000,
  });

  // Available zones — fetched only when rider has no zone assigned
  const noZone = !!poolData?.noZone;
  const { data: zonesData } = useQuery({
    queryKey: ['available-zones'],
    queryFn: () => api.get('/riders/available-zones'),
    enabled: noZone,
    staleTime: 5 * 60 * 1000,
  });

  const [checkingIn, setCheckingIn] = useState(false);
  const checkingInRef = useRef(false);
  const checkInMutation = useMutation({
    mutationFn: (coords: { lat: number; lng: number }) =>
      api.post('/riders/zone/check-in', coords),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.invalidateQueries({ queryKey: ['rider-missions-pool'] });
      if (data?.zoneName) Alert.alert('Zone assigned!', `You've been checked in to ${data.zoneName}. Orders will start appearing now.`);
    },
    onError: (err: any) => {
      // API client throws plain Error — message is the backend's verbose message
      const msg: string = err?.message || '';
      if (msg.toLowerCase().includes('not close enough') || msg === 'NOT_IN_RANGE') {
        Alert.alert('Not in range yet', 'You need to be closer to the kitchen hub. Keep moving and the app will check again automatically.');
      }
      // other errors (network etc.) surfaced by the settled spinner disappearing — no extra alert needed
    },
    onSettled: () => { setCheckingIn(false); checkingInRef.current = false; },
  });

  // Auto proximity check every 30 s — uses ref so the interval doesn't reset on every GPS ping
  useEffect(() => {
    if (!noZone) return;
    const zones: any[] = zonesData?.zones || [];
    if (!zones.length) return;
    const timer = setInterval(() => {
      if (checkingInRef.current) return;
      const { latitude: lat, longitude: lng } = latestLocationRef.current;
      const inRange = zones.some(z =>
        haversineKm(lat, lng, parseFloat(z.kitchen_lat), parseFloat(z.kitchen_lng))
        <= parseFloat(z.radius_km) + 1,
      );
      if (inRange) {
        checkingInRef.current = true;
        setCheckingIn(true);
        checkInMutation.mutate({ lat, lng });
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [noZone, zonesData]);

  // Nearest zone for display
  const nearestZone = (() => {
    const zones: any[] = zonesData?.zones || [];
    if (!zones.length) return null;
    const { latitude: lat, longitude: lng } = currentLocation;
    return zones.reduce((best: any, z: any) => {
      const dist = haversineKm(lat, lng, parseFloat(z.kitchen_lat), parseFloat(z.kitchen_lng));
      return !best || dist < best.dist ? { ...z, dist } : best;
    }, null as any);
  })();

  const openMaps = (z: any) => {
    const label = encodeURIComponent(z.kitchen_name || z.name);
    const url = Platform.OS === 'ios'
      ? `maps://?daddr=${z.kitchen_lat},${z.kitchen_lng}&q=${label}`
      : `google.navigation:q=${z.kitchen_lat},${z.kitchen_lng}`;
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${z.kitchen_lat},${z.kitchen_lng}`),
    );
  };

  const activeOrders = activeOrderData?.orders || [];
  const pool: any[] = (poolData?.orders || []).filter((o: any) => !skippedIds.includes(o.id));

  const toggleOnlineMutation = useMutation({
    mutationFn: (online: boolean) => api.post(online ? '/riders/online' : '/riders/offline', {}),
    onSuccess: (_, val) => {
      setIsOnline(val);
      dispatch(updateUser({ is_online: val, online_since: val ? new Date().toISOString() : null }));
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to change duty status';
      Alert.alert('Cannot change status', msg);
    }
  });

  const claimMutation = useMutation({
    mutationFn: (orderId: string) => api.post(`/riders/orders/${orderId}/claim`, {}),
    onSuccess: () => {
      import('react-native').then(({ Vibration }) => Vibration.cancel());
      pendingOrderRef.current = null;
      setPendingOrder(null);
      queryClient.invalidateQueries({ queryKey: ['rider-active-order'] });
      queryClient.invalidateQueries({ queryKey: ['rider-missions-pool'] });
    },
    onError: (err: any) => {
      import('react-native').then(({ Vibration }) => Vibration.cancel());
      pendingOrderRef.current = null;
      setPendingOrder(null);
      if (err.message === 'RIDER_BUSY') {
        queryClient.invalidateQueries({ queryKey: ['rider-active-order'] });
      } else {
        Alert.alert('Order Taken', 'This order was claimed by another rider.');
      }
    },
  });


  const showNotification = (order: any) => {
    pendingOrderRef.current = order;
    setPendingOrder(order);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 70, friction: 10 }).start();
    import('react-native').then(({ Vibration }) => Vibration.vibrate([500, 500], true));
    displayLocalNotification('New Delivery Request', 'A new order is available. Tap to view.', { type: 'order_update' });
  };

  const persistDecline = useCallback((orderId: string) => {
    AsyncStorage.getItem('rider_skipped_orders').then(raw => {
      const map: Record<string, number> = raw ? JSON.parse(raw) : {};
      const cutoff = Date.now() - 4 * 60 * 60 * 1000;
      // Prune expired entries while we're here
      for (const id of Object.keys(map)) { if (map[id] < cutoff) delete map[id]; }
      map[orderId] = Date.now();
      AsyncStorage.setItem('rider_skipped_orders', JSON.stringify(map)).catch(() => {});
    }).catch(() => {});
  }, []);

  const hideNotification = () => {
    pendingOrderRef.current = null;
    import('react-native').then(({ Vibration }) => Vibration.cancel());
    Animated.timing(slideAnim, { toValue: 400, useNativeDriver: true, duration: 250, easing: Easing.in(Easing.quad) }).start(() => setPendingOrder(null));
  };

  const clearAutoAssign = useCallback(() => {
    if (autoAssignTimerRef.current) {
      clearInterval(autoAssignTimerRef.current);
      autoAssignTimerRef.current = null;
    }
    autoAssignedOrderRef.current = null;
    setAutoAssignedOrder(null);
    setAutoAssignCountdown(30);
  }, []);

  const showAutoAssign = useCallback((data: { orderId: string; displayId: string; batchDisplayId?: string }) => {
    autoAssignedOrderRef.current = data;
    setAutoAssignedOrder(data);
    setAutoAssignCountdown(30);
    import('react-native').then(({ Vibration }) => Vibration.vibrate([300, 200, 300], false));
    displayLocalNotification("You've been assigned an order", `Order ${data.displayId} - tap to view.`, { type: 'order_update' });

    if (autoAssignTimerRef.current) clearInterval(autoAssignTimerRef.current);
    let remaining = 30;
    autoAssignTimerRef.current = setInterval(() => {
      remaining -= 1;
      setAutoAssignCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(autoAssignTimerRef.current!);
        autoAssignTimerRef.current = null;
        // Window closed — dismiss overlay and refresh active orders
        autoAssignedOrderRef.current = null;
        setAutoAssignedOrder(null);
        setAutoAssignCountdown(30);
        queryClient.invalidateQueries({ queryKey: ['rider-active-order'] });
      }
    }, 1000);
  }, [queryClient]);

  // Keep isOnlineRef in sync so socket handlers always see the latest value
  useEffect(() => { isOnlineRef.current = isOnline; }, [isOnline]);

  // Direct polling loop — bypasses React Query enabled/effect chain entirely.
  // Runs every 4s when online; shows the alert immediately when a new order appears.
  useEffect(() => {
    if (!isOnline) return;

    const checkPool = async () => {
      if (pendingOrderRef.current) return;
      if (autoAssignedOrderRef.current) return; // auto-assign overlay is showing
      try {
        const data = await api.get('/riders/orders/pool');
        queryClient.setQueryData(['rider-missions-pool'], data);
        const orders: any[] = data?.orders || [];
        console.log('[RIDER_POOL] polled —', orders.length, 'orders, noZone:', data?.noZone);
        const first = orders.find((o: any) => !skippedIdsRef.current.includes(o.id));
        if (first) showNotification(first);
      } catch (e) { console.warn('[RIDER_POOL] error', e); }
    };

    checkPool(); // immediate check on going online
    const interval = setInterval(checkPool, 4000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  // Register socket listeners — retries every 200ms until the socket is ready
  // (child effects run before parent effects, so socket may not exist yet on first render)
  useEffect(() => {
    let retryInterval: ReturnType<typeof setInterval> | null = null;

    const missionHandler = async (socketData?: any) => {
      console.log('[RIDER_SOCKET] new_available_mission received, online:', isOnlineRef.current, 'socketData:', socketData);
      if (!isOnlineRef.current) return;
      if (pendingOrderRef.current) return; // already showing an alert
      if (autoAssignedOrderRef.current) return; // auto-assign overlay takes priority
      try {
        const data = await api.get('/riders/orders/pool');
        queryClient.setQueryData(['rider-missions-pool'], data);
        const orders: any[] = data?.orders || [];
        console.log('[RIDER_SOCKET] pool returned', orders.length, 'orders, noZone:', data?.noZone);
        const skipped: string[] = skippedIdsRef.current;
        const first = orders.find((o: any) => !skipped.includes(o.id));
        if (first) showNotification(first);
      } catch (e) { console.warn('[RIDER_SOCKET] pool fetch error', e); }
    };

    const assignedHandler = (data: { orderId: string; displayId: string; assignedBy: string; deliveryAddress?: string }) => {
      if (!isOnlineRef.current) return;
      if (autoAssignedOrderRef.current) return; // auto-assign overlay takes priority
      showNotification({ ...data, id: data.orderId, display_id: data.displayId, delivery_address_text: data.deliveryAddress || null, _kitchenAssigned: true });
    };

    const autoAssignedHandler = (data: { orderId: string; displayId: string; batchDisplayId?: string; optOutWindowMs: number }) => {
      if (!isOnlineRef.current) return;
      showAutoAssign({ orderId: data.orderId, displayId: data.displayId, batchDisplayId: data.batchDisplayId });
    };

    const dispatcherAlertHandler = async (data: { orderId: string; displayId: string }) => {
      if (!isOnlineRef.current) return;
      if (pendingOrderRef.current) return;
      if (autoAssignedOrderRef.current) return; // auto-assign overlay takes priority
      // Remove from skipped so the rider sees it even if they dismissed it before
      skippedIdsRef.current = skippedIdsRef.current.filter(id => id !== data.orderId);
      setSkippedIds(prev => prev.filter(id => id !== data.orderId));
      try {
        const poolRes = await api.get('/riders/orders/pool');
        queryClient.setQueryData(['rider-missions-pool'], poolRes);
        const orders: any[] = poolRes?.orders || [];
        const target = orders.find((o: any) => o.id === data.orderId) || orders.find((o: any) => !skippedIdsRef.current.includes(o.id));
        if (target) showNotification(target);
      } catch (e) { console.warn('[DISPATCHER_ALERT] pool fetch error', e); }
    };

    const register = () => {
      const socket = getSocket();
      if (!socket) return false;

      // Off first to prevent duplicate listeners on reconnect
      socket.off('new_available_mission', missionHandler);
      socket.off('order_assigned', assignedHandler);
      socket.off('dispatcher_order_alert', dispatcherAlertHandler);
      socket.off('order_auto_assigned', autoAssignedHandler);
      socket.on('new_available_mission', missionHandler);
      socket.on('order_assigned', assignedHandler);
      socket.on('dispatcher_order_alert', dispatcherAlertHandler);
      socket.on('order_auto_assigned', autoAssignedHandler);
      // Re-register after every reconnect
      socket.off('connect', register);
      socket.on('connect', register);
      return true;
    };

    if (!register()) {
      retryInterval = setInterval(() => {
        if (register()) { clearInterval(retryInterval!); retryInterval = null; }
      }, 200);
    }

    return () => {
      if (retryInterval) clearInterval(retryInterval);
      const socket = getSocket();
      if (socket) {
        socket.off('new_available_mission', missionHandler);
        socket.off('order_assigned', assignedHandler);
        socket.off('dispatcher_order_alert', dispatcherAlertHandler);
        socket.off('order_auto_assigned', autoAssignedHandler);
        socket.off('connect', register);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const basePaise = order.rider_base_pay_paise ?? 2000;
    const perKmPaise = order.rider_per_km_paise ?? 500;
    const freeKm = parseFloat(order.rider_free_km ?? '2');
    const distanceKm = (order.delivery_distance_metres != null && order.delivery_distance_metres > 0)
      ? order.delivery_distance_metres / 1000
      : 0;
    const distanceBonus = distanceKm > freeKm ? Math.floor((distanceKm - freeKm) * perKmPaise) : 0;
    const platformFee = Math.floor(basePaise * 0.1);
    return Math.floor((basePaise + distanceBonus - platformFee) / 100);
  };


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
        (err) => {
          console.log('[Geolocation Error]', err);
          Alert.alert('GPS Error', 'Failed to get location: ' + err.message);
        },
        { enableHighAccuracy: true, distanceFilter: 5, interval: 4000, timeout: 15000, maximumAge: 10000 },
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
          <TouchableOpacity 
            style={styles.nameBlock}
            onPress={() => navigation.navigate('ProfileTab')}
            activeOpacity={0.8}
          >
            <View style={styles.avatarWrap}>
              <Text style={styles.avatarText}>{user?.name?.charAt(0)?.toUpperCase() || 'R'}</Text>
              <View style={[styles.statusDot, { backgroundColor: isOnline ? S.green : S.muted }]} />
            </View>
            <View>
              <Text style={styles.nameText}>{user?.name?.split(' ')[0] || 'Rider'}</Text>
              <Text style={styles.statusText}>{isOnline ? 'Online' : 'Offline'}</Text>
            </View>
          </TouchableOpacity>

          {/* Today earnings */}
          <View style={styles.earningsBlock}>
            <View style={styles.earningsAmtRow}>
              <IndianRupee size={14} color={S.ink} />
              <Text style={styles.earningsAmt}>{todayEarnings}</Text>
            </View>
            <Text style={styles.earningsLabel}>{ordersToday} orders today</Text>
          </View>

          {/* Online toggle */}
          <TouchableOpacity
            style={[styles.togglePill, isOnline ? styles.togglePillOn : styles.togglePillOff]}
            onPress={() => toggleOnlineMutation.mutate(!isOnline)}
            disabled={toggleOnlineMutation.isPending}
            activeOpacity={0.9}
          >
            <View style={[styles.toggleThumb, isOnline ? styles.toggleThumbOn : styles.toggleThumbOff]} />
            <Text style={[styles.toggleText, isOnline ? styles.toggleTextOn : styles.toggleTextOff]}>
              {isOnline ? 'ON DUTY' : 'OFF DUTY'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>




      {/* ── No zone: head to nearest kitchen hub ─────────────────────────── */}
      {isOnline && noZone && activeOrders.length === 0 && !pendingOrder && (
        <View style={styles.zoneCard}>
          <View style={styles.zoneHeader}>
            <MapPin size={18} color={S.orange} />
            <Text style={styles.zoneTitle}>Report to your delivery zone</Text>
          </View>
          {nearestZone ? (
            <>
              <Text style={styles.zoneKitchen}>{nearestZone.kitchen_name || nearestZone.name}</Text>
              <Text style={styles.zoneAddress} numberOfLines={2}>{nearestZone.kitchen_address || 'Kitchen location'}</Text>
              <View style={styles.zoneDistRow}>
                <Navigation size={13} color={S.muted} />
                <Text style={styles.zoneDist}>
                  {nearestZone.dist < 1
                    ? `${Math.round(nearestZone.dist * 1000)} m away`
                    : `${nearestZone.dist.toFixed(1)} km away`}
                </Text>
                {nearestZone.dist <= parseFloat(nearestZone.radius_km) + 1 && (
                  <View style={styles.inRangeBadge}>
                    <Text style={styles.inRangeText}>In range</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={styles.navigateBtn}
                onPress={() => openMaps(nearestZone)}
                activeOpacity={0.85}
              >
                <Navigation size={16} color={S.white} />
                <Text style={styles.navigateBtnText}>Navigate to Zone</Text>
              </TouchableOpacity>
              <Text style={styles.zoneHint}>
                You will be auto-assigned once you enter the zone boundary.
              </Text>
            </>
          ) : (
            <Text style={styles.zoneDist}>Loading zone info…</Text>
          )}
        </View>
      )}

      {/* ── Waiting pulse (online, no orders) ────────────────────────────── */}
      {isOnline && !poolData?.noZone && activeOrders.length === 0 && !pendingOrder && (
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

      {/* Skipped pool banner removed as per True Decline logic */}
      {/* ── Incoming order notification ───────────────────────────────────── */}
      {/* ── Auto-assigned overlay (rider has 30s to opt out) ───────────────── */}
      {autoAssignedOrder && (
        <View style={[styles.autoAssignSheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.autoAssignStrip}>
            <Text style={styles.autoAssignStripLabel}>⚡  Auto-Assigned to You</Text>
            <View style={styles.autoAssignCountdownBadge}>
              <Text style={styles.autoAssignCountdownText}>{autoAssignCountdown}s</Text>
            </View>
          </View>
          <View style={styles.notifBody}>
            <Text style={styles.notifOrderId}>{autoAssignedOrder.displayId}</Text>
            {autoAssignedOrder.batchDisplayId ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <View style={{ backgroundColor: '#EDE9FE', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ color: '#5B21B6', fontSize: 11, fontWeight: '800' }}>
                    📦 BATCH · {autoAssignedOrder.batchDisplayId}
                  </Text>
                </View>
              </View>
            ) : null}
            <Text style={{ color: S.muted, fontSize: 13, marginBottom: 16, lineHeight: 18 }}>
              {autoAssignedOrder.batchDisplayId
                ? 'Two orders from the same kitchen — pick up both in one trip.'
                : 'This order has been assigned directly to you. It will lock in when the timer expires.'}
            </Text>
            <View style={styles.notifBtns}>
              <TouchableOpacity
                style={styles.declineBtn}
                onPress={async () => {
                  const orderId = autoAssignedOrder.orderId;
                  clearAutoAssign();
                  try { await api.post(`/riders/orders/${orderId}/mark-unavailable`, {}); } catch {}
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.declineBtnText}>I'm Unavailable</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.acceptBtn, { backgroundColor: '#5B21B6' }]}
                onPress={() => {
                  clearAutoAssign();
                  queryClient.invalidateQueries({ queryKey: ['rider-active-order'] });
                }}
                activeOpacity={0.9}
              >
                <Check size={18} color={S.white} />
                <Text style={styles.acceptBtnText}>Got It</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {pendingOrder && (
        <Animated.View style={[styles.notifSheet, { paddingBottom: insets.bottom + 16, transform: [{ translateY: slideAnim }] }]}>
          {/* Orange top strip */}
          <View style={[styles.notifStrip, pendingOrder._kitchenAssigned && { backgroundColor: '#E67E22' }]}>
            <Text style={styles.notifStripLabel}>
              {pendingOrder._kitchenAssigned
                ? '📦  Assigned by Kitchen'
                : pendingOrder.status === 'preparing'
                  ? '🍳  Preparing Now — Head to Kitchen'
                  : '✅  Ready for Pickup'}
            </Text>
          </View>

          <View style={styles.notifBody}>
            <Text style={styles.notifOrderId}>{pendingOrder.display_id || pendingOrder.displayId}</Text>

            {/* Items preview */}
            {pendingOrder.items && pendingOrder.items.length > 0 && (
              <View style={styles.notifItemsWrap}>
                {pendingOrder.items.map((item: any, i: number) => (
                  <View key={i} style={styles.notifItemChip}>
                    <Text style={styles.notifItemChipQty}>{item.quantity}×</Text>
                    <Text style={styles.notifItemChipName}>{item.menu_item_name}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.notifRow}>
              <View style={styles.notifField}>
                <Text style={styles.notifFieldLabel}>DISTANCE</Text>
                {pendingOrder.delivery_distance_metres != null && pendingOrder.delivery_distance_metres > 0 ? (() => {
                  const km = pendingOrder.delivery_distance_metres / 1000;
                  const label = km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
                  return (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
                      <Navigation size={14} color={S.orange} />
                      <Text style={[styles.notifFieldValue, { color: S.orange, fontSize: 18, fontWeight: '800' }]}>{label}</Text>
                    </View>
                  );
                })() : (
                  <Text style={[styles.notifFieldValue, { color: S.muted }]}>—</Text>
                )}
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
              {/* Pool orders: rider can decline. Kitchen-assigned: no hiding — it's mandatory */}
              {!pendingOrder._kitchenAssigned && (
                <TouchableOpacity
                  style={styles.declineBtn}
                  onPress={() => {
                    const id = pendingOrder.id;
                    setSkippedIds(prev => { const next = [...prev, id]; skippedIdsRef.current = next; return next; });
                    persistDecline(id);
                    hideNotification();
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.declineBtnText}>Decline</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.acceptBtn,
                  (claimMutation.isPending || acceptingKA) && { opacity: 0.6 },
                  pendingOrder._kitchenAssigned && { backgroundColor: '#E67E22', flex: 1 },
                ]}
                onPress={async () => {
                  if (pendingOrder._kitchenAssigned) {
                    // Order already assigned — just acknowledge and dismiss
                    hideNotification();
                    queryClient.invalidateQueries({ queryKey: ['rider-active-order'] });
                  } else {
                    claimMutation.mutate(pendingOrder.id);
                  }
                }}
                disabled={claimMutation.isPending || acceptingKA}
                activeOpacity={0.9}
              >
                {pendingOrder._kitchenAssigned
                  ? <><ChevronRight size={18} color={S.white} /><Text style={styles.acceptBtnText}>Go to Order</Text></>
                  : claimMutation.isPending
                    ? <Text style={styles.acceptBtnText}>Claiming…</Text>
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
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  nameBlock: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarWrap: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: S.orangeLight,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: S.orange,
  },
  avatarText: { color: S.orange, fontSize: 16, fontWeight: '900' },
  statusDot: { position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: S.white },
  nameText: { fontSize: 16, fontWeight: '800', color: S.ink, marginBottom: 2 },
  statusText: { fontSize: 11, color: S.muted, fontWeight: '600' },
  earningsBlock: { alignItems: 'center' },
  earningsAmtRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  earningsAmt: { fontSize: 18, fontWeight: '900', color: S.ink },
  earningsLabel: { fontSize: 10, color: S.muted, fontWeight: '600', marginTop: 2 },
  
  togglePill: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 24, paddingVertical: 4, paddingHorizontal: 4, width: 105,
    borderWidth: 1.5,
  },
  togglePillOn: { backgroundColor: S.orange, borderColor: S.orange },
  togglePillOff: { backgroundColor: S.white, borderColor: S.border },
  toggleThumb: { width: 24, height: 24, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  toggleThumbOn: { backgroundColor: S.white, transform: [{ translateX: 70 }] },
  toggleThumbOff: { backgroundColor: S.muted, transform: [{ translateX: 0 }] },
  toggleText: { position: 'absolute', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  toggleTextOn: { color: S.white, left: 12 },
  toggleTextOff: { color: S.muted, right: 12 },

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

  // Zone check-in card
  zoneCard: {
    position: 'absolute', bottom: 100, left: 16, right: 16, zIndex: 30,
    backgroundColor: S.white, borderRadius: 20, padding: 20,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 20, elevation: 10,
    borderWidth: 1, borderColor: '#FFE0C2',
  },
  zoneHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  zoneTitle: { fontSize: 13, fontWeight: '800', color: S.orange, textTransform: 'uppercase', letterSpacing: 0.5 },
  zoneKitchen: { fontSize: 18, fontWeight: '900', color: S.ink, marginBottom: 3 },
  zoneAddress: { fontSize: 13, color: S.muted, lineHeight: 18, marginBottom: 12 },
  zoneDistRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  zoneDist: { fontSize: 13, fontWeight: '600', color: S.muted },
  inRangeBadge: { backgroundColor: '#E8F8F1', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  inRangeText: { fontSize: 11, fontWeight: '800', color: '#1BA672' },
  navigateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: S.orange, borderRadius: 13, paddingVertical: 13, marginBottom: 10,
  },
  navigateBtnText: { fontSize: 15, fontWeight: '800', color: S.white },
  checkInBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 13, paddingVertical: 12, marginBottom: 10,
    borderWidth: 1.5, borderColor: S.orange,
  },
  checkInBtnDisabled: { opacity: 0.5 },
  checkInBtnText: { fontSize: 14, fontWeight: '700', color: S.orange },
  zoneHint: { fontSize: 11, color: S.muted, textAlign: 'center', lineHeight: 16 },

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
  notifOrderId: { fontSize: 28, fontWeight: '900', color: S.ink, marginBottom: 8 },
  prepTimeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: S.orangeLight, marginBottom: 14,
  },
  prepTimeText: { fontSize: 12, fontWeight: '700' },
  notifRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  notifField: { flex: 1 },
  notifFieldLabel: { fontSize: 10, fontWeight: '700', color: S.muted, letterSpacing: 0.8, marginBottom: 4 },
  notifFieldValue: { fontSize: 13, fontWeight: '600', color: S.ink, lineHeight: 18 },
  notifBtns: { flexDirection: 'row', gap: 10 },
  declineBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 16, borderRadius: 14,
    backgroundColor: S.redLight, borderWidth: 1.5, borderColor: S.red,
  },
  declineBtnText: { color: S.red, fontSize: 15, fontWeight: '700' },
  acceptBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: 14, backgroundColor: S.orange,
    shadowColor: S.orange, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  acceptBtnText: { color: S.white, fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },

  notifItemsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  notifItemChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: S.bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: S.border,
  },
  notifItemChipQty: { fontSize: 12, fontWeight: '800', color: S.orange },
  notifItemChipName: { fontSize: 12, fontWeight: '600', color: S.ink },

  // Auto-assign overlay
  autoAssignSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 55,
    backgroundColor: S.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: -4 },
    elevation: 18,
  },
  autoAssignStrip: {
    backgroundColor: '#5B21B6', paddingHorizontal: 20, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  autoAssignStripLabel: { color: S.white, fontSize: 13, fontWeight: '700' },
  autoAssignCountdownBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4,
  },
  autoAssignCountdownText: { color: S.white, fontSize: 14, fontWeight: '900' },
});

export default RiderHomeScreen;
