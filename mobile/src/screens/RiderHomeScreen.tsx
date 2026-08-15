import { useFocusEffect } from '@react-navigation/native';
import { tokens } from '../theme/tokens';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StatusBar, Alert, Linking, Modal,
  StyleSheet, Animated, Platform, PermissionsAndroid, Vibration,
} from 'react-native';
import { LeafletMap } from '../components/LeafletMap';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { updateUser } from '../store/slices/authSlice';
import { getSocket } from '../socket/client';
import { ChevronRight, Check, X, IndianRupee, Navigation, MapPin, Banknote } from 'lucide-react-native';
import Geolocation from '@react-native-community/geolocation';
import { startRiderLocationService, stopRiderLocationService } from '../services/locationService';
import { displayLocalNotification } from '../services/localNotif';
import { Card } from '../components/ui/Card';
import { useFeedback } from '../context/FeedbackContext';

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
  red: tokens.colors.danger,
  redLight: '#FEF2F2',
  ink: '#282C3F',
  muted: '#93959F',
  border: '#E9E9EB',
  bg: '#F8F8F8',
  white: tokens.colors.surface,
  shadow: 'rgba(0,0,0,0.10)',
};

const RiderHomeScreen = ({ navigation }: any) => {
  const { user, accessToken } = useSelector((state: RootState) => state.auth);
  const insets = useSafeAreaInsets();
  const { showDialog } = useFeedback();
  const [isOnline, setIsOnline] = useState(user?.is_online || false);
  const isOnlineRef = useRef(user?.is_online || false);
  const [currentLocation, setCurrentLocation] = useState({
    latitude: user?.current_lat ? parseFloat(user.current_lat) : 28.6139,
    longitude: user?.current_lng ? parseFloat(user.current_lng) : 77.2090
  });

  useEffect(() => {
    if (user?.current_lat && user?.current_lng) {
      const lat = parseFloat(user.current_lat);
      const lng = parseFloat(user.current_lng);
      if (!isNaN(lat) && !isNaN(lng) && currentLocation.latitude === 28.6139) {
        setCurrentLocation({ latitude: lat, longitude: lng });
      }
    }
  }, [user?.current_lat, user?.current_lng]);

  const latestLocationRef = useRef({ latitude: 0, longitude: 0 });
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const queryClient = useQueryClient();
  const dispatch = useDispatch();

  // Auto-assign overlay state
  const [autoAssignedOrder, setAutoAssignedOrder] = useState<{ orderId: string; displayId: string; batchDisplayId?: string } | null>(null);
  const autoAssignedOrderRef = useRef<{ orderId: string; displayId: string; batchDisplayId?: string } | null>(null);
  const [autoAssignCountdown, setAutoAssignCountdown] = useState(30);
  const autoAssignTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sheetSlide = useRef(new Animated.Value(600)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;
  const flashLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const { data: earnings } = useQuery({
    queryKey: ['rider-earnings'],
    queryFn: () => api.get('/riders/earnings/today'),
  });

  const { data: cashData } = useQuery({
    queryKey: ['cash-in-hand'],
    queryFn: () => api.get('/riders/cash-in-hand'),
    enabled: isOnline,
    staleTime: 30_000,
  });
  const cashInHandPaise: number = cashData?.totalPaise || 0;
  const cashOverLimit: boolean = cashData?.overLimit || false;

  const { data: activeOrderData, isFetched: activeOrderFetched } = useQuery({
    queryKey: ['rider-active-order'],
    queryFn: () => api.get('/riders/orders/active'),
    enabled: isOnline,
    refetchInterval: isOnline ? 30000 : false,
  });

  // No zone = rider is online but zone_id is not yet assigned
  const noZone = isOnline && !user?.zoneId;
  const { data: zonesData } = useQuery({
    queryKey: ['available-zones'],
    queryFn: () => api.get('/riders/available-zones'),
    enabled: noZone,
    staleTime: 5 * 60 * 1000,
  });

  // Sync: if DB already has a zone but Redux is stale (persisted from before assignment), fix it now
  useEffect(() => {
    if (zonesData?.currentZoneId && !user?.zoneId) {
      dispatch(updateUser({ zoneId: zonesData.currentZoneId }));
    }
  }, [zonesData?.currentZoneId]);

  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['rider-active-orders'] });
      queryClient.invalidateQueries({ queryKey: ['rider-earnings'] });
      queryClient.invalidateQueries({ queryKey: ['rider-zones'] });
    }, [queryClient])
  );

  const [checkingIn, setCheckingIn] = useState(false);
  const checkingInRef = useRef(false);
  const checkInMutation = useMutation({
    mutationFn: (coords: { lat: number; lng: number }) =>
      api.post('/riders/zone/check-in', coords),
    onSuccess: (data: any) => {
      if (data?.zoneId) dispatch(updateUser({ zoneId: data.zoneId }));
      queryClient.invalidateQueries({ queryKey: ['me'] });
      if (data?.zoneName) {
        showDialog({ title: 'Zone assigned!', message: `You've been checked in to ${data.zoneName}. Orders will start appearing now.`, confirmText: 'Okay', type: 'success' });
      }
    },
    onError: (err: any) => {
      // API client throws plain Error — message is the backend's verbose message
      const msg: string = err?.message || '';
      if (msg.toLowerCase().includes('not close enough') || msg === 'NOT_IN_RANGE') {
        showDialog({ title: 'Not in range yet', message: 'You need to be closer to the kitchen hub. Keep moving and the app will check again automatically.', confirmText: 'Got it', type: 'info' });
      }
      // other errors (network etc.) surfaced by the settled spinner disappearing — no extra alert needed
    },
    onSettled: () => { setCheckingIn(false); checkingInRef.current = false; },
  });

  // Auto proximity check every 5 s — uses ref so the interval doesn't reset on every GPS ping
  useEffect(() => {
    if (!noZone) return;
    const zones: any[] = zonesData?.zones || [];
    if (!zones.length) return;
    const timer = setInterval(() => {
      if (checkingInRef.current) return;
      const { latitude: lat, longitude: lng } = latestLocationRef.current;
      // Skip until we have a real GPS fix (default is 0,0)
      if (lat === 0 && lng === 0) return;
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

  const toggleOnlineMutation = useMutation({
    mutationFn: (online: boolean) => api.post(online ? '/riders/online' : '/riders/offline', {}),
    onSuccess: (_, val) => {
      setIsOnline(val);
      dispatch(updateUser({ is_online: val, online_since: val ? new Date().toISOString() : null }));
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to change duty status';
      showDialog({ title: 'Cannot change status', message: msg, confirmText: 'Okay', type: 'error' });
    }
  });

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
    // 3-burst vibration on arrival
    Vibration.vibrate([0, 500, 150, 500, 150, 500], false);
    displayLocalNotification('🚴 New Order Assigned!', `${data.displayId} — tap to view. You have 30s to opt out.`, { type: 'order_update' });

    if (autoAssignTimerRef.current) clearInterval(autoAssignTimerRef.current);
    let remaining = 30;
    autoAssignTimerRef.current = setInterval(() => {
      remaining -= 1;
      setAutoAssignCountdown(remaining);
      // Reminder vibrations so rider doesn't miss it
      if (remaining === 20 || remaining === 10) Vibration.vibrate([0, 300, 100, 300], false);
      if (remaining <= 0) {
        clearInterval(autoAssignTimerRef.current!);
        autoAssignTimerRef.current = null;
        autoAssignedOrderRef.current = null;
        setAutoAssignedOrder(null);
        setAutoAssignCountdown(30);
        queryClient.invalidateQueries({ queryKey: ['rider-active-order'] });
      }
    }, 1000);
  }, [queryClient]);

  // Animate sheet in + flash strip whenever a new order arrives
  useEffect(() => {
    if (autoAssignedOrder) {
      sheetSlide.setValue(600);
      Animated.spring(sheetSlide, { toValue: 0, useNativeDriver: true, tension: 70, friction: 12 }).start();
      flashLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(flashAnim, { toValue: 1, duration: 350, useNativeDriver: false }),
          Animated.timing(flashAnim, { toValue: 0, duration: 350, useNativeDriver: false }),
        ]),
      );
      flashLoopRef.current.start();
    } else {
      flashLoopRef.current?.stop();
      flashLoopRef.current = null;
    }
  }, [autoAssignedOrder]);

  // Keep isOnlineRef in sync so socket handlers always see the latest value
  useEffect(() => { isOnlineRef.current = isOnline; }, [isOnline]);

  // Listen for finance confirming cash submission — clear badge immediately
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ['cash-in-hand'] });
    };
    socket.on('cash_confirmed', handler);
    return () => { socket.off('cash_confirmed', handler); };
  }, [queryClient]);

  // Register socket listener for auto-assign events
  useEffect(() => {
    let retryInterval: ReturnType<typeof setInterval> | null = null;

    const autoAssignedHandler = (data: { orderId: string; displayId: string; batchDisplayId?: string; optOutWindowMs: number }) => {
      if (!isOnlineRef.current) return;
      showAutoAssign({ orderId: data.orderId, displayId: data.displayId, batchDisplayId: data.batchDisplayId });
    };

    const register = () => {
      const socket = getSocket();
      if (!socket) return false;
      socket.off('order_auto_assigned', autoAssignedHandler);
      socket.on('order_auto_assigned', autoAssignedHandler);
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



  useEffect(() => { latestLocationRef.current = currentLocation; }, [currentLocation]);

  useEffect(() => {
    let watchId: number;
    let interval: ReturnType<typeof setInterval>;
    const startTracking = async () => {
      if (Platform.OS === 'android') {
        try {
          await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
          ]);
        } catch {}
      }
      if (isOnline) {
        if (accessToken) startRiderLocationService(accessToken);
      } else {
        stopRiderLocationService();
      }

      // Fast location fix with GPS -> Network fallback
      const getFix = (highAcc: boolean) => {
        Geolocation.getCurrentPosition(
          pos => {
            const { latitude, longitude } = pos.coords;
            setCurrentLocation({ latitude, longitude });
            if (isOnline) getSocket()?.emit('update_location', { lat: latitude, lng: longitude });
          },
          () => {
            if (highAcc) getFix(false); // Retry with Network provider if GPS times out
          },
          { enableHighAccuracy: highAcc, timeout: highAcc ? 6000 : 15000, maximumAge: 10000 },
        );
      };
      getFix(true);

      const setupWatch = (highAcc: boolean) => {
        watchId = Geolocation.watchPosition(
          pos => {
            const { latitude, longitude } = pos.coords;
            setCurrentLocation({ latitude, longitude });
            if (isOnline) getSocket()?.emit('update_location', { lat: latitude, lng: longitude });
          },
          (err) => {
            console.log('[Geolocation Error]', err);
            if (highAcc) {
              setupWatch(false); // Fallback to network watch
            } else {
              showDialog({ title: 'Location Error', message: 'Unable to get your real location. Please check that GPS/Location is enabled in phone settings.', confirmText: 'Okay', type: 'error' });
            }
          },
          { enableHighAccuracy: highAcc, distanceFilter: 5, interval: 4000, timeout: 15000, maximumAge: 10000 },
        );
      };
      setupWatch(true);

      interval = setInterval(() => {
        if (isOnline && latestLocationRef.current.latitude !== 28.6139) {
          getSocket()?.emit('update_location', { lat: latestLocationRef.current.latitude, lng: latestLocationRef.current.longitude });
        }
      }, 30000);
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
      <Card variant="standard" padded={true} style={{ paddingTop: insets.top + 10, marginBottom: 16 }}>
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
      </Card>




      {/* ── Cash-in-hand badge ───────────────────────────────────────────── */}
      {cashInHandPaise > 0 && (
        <TouchableOpacity
          style={[styles.cashBadge, { top: insets.top + 78 }, cashOverLimit && styles.cashBadgeUrgent]}
          onPress={() => navigation.navigate('CashSubmit')}
          activeOpacity={0.85}
        >
          <Banknote size={16} color={cashOverLimit ? '#DC2626' : '#F59E0B'} />
          <Text style={[styles.cashBadgeText, cashOverLimit && styles.cashBadgeTextUrgent]}>
            Cash in hand: ₹{(cashInHandPaise / 100).toFixed(0)}
            {cashOverLimit ? ' · LIMIT REACHED' : ''}
          </Text>
          <Text style={styles.cashBadgeAction}>Submit →</Text>
        </TouchableOpacity>
      )}

      {/* ── No zone: head to nearest kitchen hub ─────────────────────────── */}
      {isOnline && noZone && activeOrders.length === 0 && (
        <View style={styles.zoneCard}>
          <View style={styles.zoneHeader}>
            <MapPin size={18} color={S.orange} />
            <Text style={styles.zoneTitle}>Report to your delivery zone</Text>
          </View>
          {nearestZone ? (
            nearestZone.dist > 200 ? (
              // Zone is very far — rider is in a region without a configured zone
              <>
                <Text style={styles.zoneKitchen}>No zone assigned nearby</Text>
                <Text style={styles.zoneAddress}>
                  Your delivery zone has not been set up in your area yet.
                </Text>
                <View style={styles.zoneDistRow}>
                  <Navigation size={13} color={S.muted} />
                  <Text style={styles.zoneDist}>Nearest zone: {nearestZone.dist.toFixed(0)} km away</Text>
                </View>
                <TouchableOpacity
                  style={[styles.navigateBtn, { backgroundColor: S.ink }]}
                  onPress={() => Linking.openURL('https://wa.me/919999999999?text=Hi%2C%20I%20am%20a%20rider%20and%20my%20delivery%20zone%20has%20not%20been%20set%20up.')}
                  activeOpacity={0.85}
                >
                  <MapPin size={16} color={S.white} />
                  <Text style={styles.navigateBtnText}>Contact Fleet Manager</Text>
                </TouchableOpacity>
                <Text style={styles.zoneHint}>
                  Ask your fleet manager to assign you to a delivery zone.
                </Text>
              </>
            ) : (
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
            )
          ) : (
            <Text style={styles.zoneDist}>Loading zone info…</Text>
          )}
        </View>
      )}

      {/* ── Waiting pulse (online, no orders) ────────────────────────────── */}
      {isOnline && !noZone && activeOrders.length === 0 && (
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
      {activeOrders.length > 0 && (
        <View style={[styles.ordersSheet, { paddingBottom: insets.bottom + 12, maxHeight: '55%' }]}>
          {activeOrders.length > 1 && (
            <View style={styles.batchBanner}>
              <Text style={styles.batchBannerText}>📦 BATCH · {activeOrders.length} orders · pick up all from kitchen</Text>
            </View>
          )}
          <ScrollView
            showsVerticalScrollIndicator={true}
            contentContainerStyle={{ gap: 10, paddingBottom: 8 }}
            nestedScrollEnabled={true}
          >
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
                          <Text style={styles.orderIndexText}>{idx + 1}/{activeOrders.length}</Text>
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
          </ScrollView>
        </View>
      )}

      {/* ── Auto-assigned modal (rider has 30s to opt out) ─────────────────── */}
      <Modal visible={!!autoAssignedOrder} transparent animationType="none" statusBarTranslucent onRequestClose={() => {}}>
        <View style={styles.modalBackdrop}>
          <Animated.View style={[styles.autoAssignSheet, { paddingBottom: insets.bottom + 20, transform: [{ translateY: sheetSlide }] }]}>
            {/* Flashing strip */}
            <Animated.View style={[styles.autoAssignStrip, { backgroundColor: flashAnim.interpolate({ inputRange: [0, 1], outputRange: ['#5B21B6', '#FC4603'] }) }]}>
              <Text style={styles.autoAssignStripLabel}>⚡  New Order Assigned!</Text>
              <View style={[styles.autoAssignCountdownBadge, autoAssignCountdown <= 10 && styles.autoAssignCountdownUrgent]}>
                <Text style={styles.autoAssignCountdownText}>{autoAssignCountdown}s</Text>
              </View>
            </Animated.View>

            <View style={styles.notifBody}>
              <Text style={styles.notifOrderId}>{autoAssignedOrder?.displayId}</Text>
              {autoAssignedOrder?.batchDisplayId ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <View style={{ backgroundColor: '#EDE9FE', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ color: '#5B21B6', fontSize: 11, fontWeight: '800' }}>
                      📦 BATCH · {autoAssignedOrder.batchDisplayId}
                    </Text>
                  </View>
                </View>
              ) : null}
              <Text style={{ color: S.muted, fontSize: 13, marginBottom: 20, lineHeight: 19 }}>
                {autoAssignedOrder?.batchDisplayId
                  ? 'Two orders from the same kitchen — pick up both in one trip.'
                  : 'This order is yours. It locks in automatically when the timer hits zero.'}
              </Text>
              <View style={styles.notifBtns}>
                <TouchableOpacity
                  style={styles.declineBtn}
                  onPress={async () => {
                    const orderId = autoAssignedOrder!.orderId;
                    clearAutoAssign();
                    try { await api.post(`/riders/orders/${orderId}/mark-unavailable`, {}); }
                    catch { showDialog({ title: 'Error', message: 'Could not update status. Please try again.', confirmText: 'Okay', type: 'error' }); }
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
          </Animated.View>
        </View>
      </Modal>

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
    ...tokens.shadows.soft,
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
    ...tokens.shadows.soft, gap: 10,
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
  batchBanner: {
    backgroundColor: '#EDE9FE', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: '#DDD6FE',
  },
  batchBannerText: { fontSize: 12, fontWeight: '800', color: '#5B21B6' },
  orderDestLabel: { fontSize: 10, fontWeight: '700', color: S.muted, letterSpacing: 0.5, marginBottom: 2 },
  orderDestText: { fontSize: 13, fontWeight: '600', color: S.ink },

  // Auto-assign notification sheet (shared styles)
  notifBody: { padding: 20 },
  notifOrderId: { fontSize: 28, fontWeight: '900', color: S.ink, marginBottom: 8 },
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

  // Auto-assign modal
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end',
  },
  autoAssignSheet: {
    backgroundColor: S.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    overflow: 'hidden',
    ...tokens.shadows.soft,
  },
  autoAssignStrip: {
    paddingHorizontal: 20, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  autoAssignStripLabel: { color: S.white, fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
  autoAssignCountdownBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5,
  },
  autoAssignCountdownUrgent: { backgroundColor: 'rgba(239,68,68,0.45)' },
  autoAssignCountdownText: { color: S.white, fontSize: 15, fontWeight: '900' },

  // Cash-in-hand badge
  cashBadge: {
    position: 'absolute', top: 130, left: 16, right: 16, zIndex: 45,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFBEB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: '#FDE68A',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 4,
  },
  cashBadgeUrgent: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  cashBadgeText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#92400E' },
  cashBadgeTextUrgent: { color: '#DC2626' },
  cashBadgeAction: { fontSize: 12, fontWeight: '800', color: S.orange },
});

export default RiderHomeScreen;
