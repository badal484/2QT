import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ENV } from '../config/env';
import { View, StyleSheet, Platform, PermissionsAndroid, AppState } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import {
  setGlobalLocation,
  setServiceabilityChecking,
  setServiceable,
  setUnserviceable,
  setNoLocation,
  setNetworkError,
} from '../store/slices/appSlice';
import { setAddress, setZone } from '../store/slices/cartSlice';
import { RootState } from '../store';
import SplashScreen from '../screens/SplashScreen';
import { api } from '../api/client';
import { reverseGeocode } from '../utils/geocode';
import Geolocation from '@react-native-community/geolocation';
import { useQueryClient } from '@tanstack/react-query';

const requestLocationPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: '2QT Needs Your Location',
          message:
            'We use your location to find the nearest kitchen and deliver food to you.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'Allow',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  }
  Geolocation.requestAuthorization();
  return true;
};

const getGpsCoords = (): Promise<{ latitude: number; longitude: number } | null> =>
  new Promise((resolve) => {
    Geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => Geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 },
      ),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 },
    );
  });


export const AppBootManager = ({ children }: { children: React.ReactNode }) => {
  const dispatch = useDispatch();
  const globalLocation = useSelector((state: RootState) => state.app.globalLocation);
  const { addressId: currentAddressId } = useSelector((state: RootState) => state.cart);

  const [isBooted, setIsBooted] = useState(false);
  const hasStartedRef = useRef(false);

  const currentAddressIdRef = useRef(currentAddressId);
  useEffect(() => {
    currentAddressIdRef.current = currentAddressId;
  }, [currentAddressId]);

  const globalLocRef = useRef(globalLocation);
  useEffect(() => {
    globalLocRef.current = globalLocation;
  }, [globalLocation]);

  const runServiceabilityCheck = useCallback(
    async (coords: { latitude: number; longitude: number }, addressText?: string) => {
      const MAX_ATTEMPTS = 2;
      const ATTEMPT_TIMEOUT = 25000; // Increased to 25s for Render free-tier cold start
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          const res = await api.get(
            `/menu/zones/check?lat=${coords.latitude}&lng=${coords.longitude}`,
            { timeout: ATTEMPT_TIMEOUT },
          );
          if (res.serviceable && res.zone?.id) {
            dispatch(
              setServiceable({
                zoneId: res.zone.id,
                zoneName: res.zone.name || null,
                location: {
                  latitude: coords.latitude,
                  longitude: coords.longitude,
                  addressText: addressText || globalLocRef.current?.addressText || 'Current Location',
                },
              }),
            );
          } else {
            dispatch(
              setUnserviceable({
                latitude: coords.latitude,
                longitude: coords.longitude,
                addressText: addressText || globalLocRef.current?.addressText || 'Current Location',
              }),
            );
          }
          return;
        } catch {
          if (attempt < MAX_ATTEMPTS) {
            await new Promise<void>(r => setTimeout(r, 2000));
          }
        }
      }

      dispatch(setNetworkError());
    },
    [dispatch],
  );

  const runGpsZoneCheck = useCallback(async (isSilent: boolean): Promise<boolean> => {
    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        if (!isSilent) dispatch(setNoLocation());
        return false;
      }
      const coords = await getGpsCoords();
      if (!coords) {
        if (!isSilent) dispatch(setNoLocation());
        return false;
      }
      dispatch(setGlobalLocation({ ...coords, addressText: 'Detecting...' }));
      const addressText = await reverseGeocode(coords.latitude, coords.longitude);
      await runServiceabilityCheck(coords, addressText);
      return true;
    } catch {
      if (!isSilent) dispatch(setNetworkError());
      return false;
    }
  }, [dispatch, runServiceabilityCheck]);

  const queryClient = useQueryClient();
  const activeZoneId = useSelector((state: RootState) => state.app.activeZoneId);
  const activeZoneIdRef = useRef(activeZoneId);
  useEffect(() => {
    activeZoneIdRef.current = activeZoneId;
  }, [activeZoneId]);

  // ─── Main boot sequence ───────────────────────────────────────────────────
  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    const boot = async () => {
      // Smooth splash screen animation duration
      const minimumSplashTime = new Promise<void>((resolve) => setTimeout(resolve, 600));

      // Wake backend immediately in background
      fetch(`${ENV.API_URL}/menu/zones`).catch(() => {});

      // Sanitize corrupted Redux-Persist state (object stored instead of string)
      if (currentAddressIdRef.current !== null && typeof currentAddressIdRef.current === 'object') {
        dispatch(setAddress(null));
        currentAddressIdRef.current = null;
      }

      // Ensure activeZoneId is never null on boot by resolving available active zones
      let zoneToPrefetch = activeZoneIdRef.current;
      if (!zoneToPrefetch) {
        try {
          const zonesRes = await api.get('/menu/zones');
          if (zonesRes.zones && zonesRes.zones.length > 0) {
            zoneToPrefetch = zonesRes.zones[0].id;
            dispatch(setServiceable({
              zoneId: zonesRes.zones[0].id,
              zoneName: zonesRes.zones[0].name,
            }));
          }
        } catch (_) {}
      }
      zoneToPrefetch = zoneToPrefetch || 'zone_velto_main';

      // Prefetch home data during splash screen so HomeScreen mounts with 100% complete data
      const prefetchPromise = Promise.all([
        queryClient.prefetchQuery({
          queryKey: ['banners'],
          queryFn: () => api.get('/banners'),
          staleTime: 10 * 60 * 1000,
        }),
        queryClient.prefetchQuery({
          queryKey: ['campaigns', zoneToPrefetch],
          queryFn: () => api.get(`/campaigns/active?zoneId=${zoneToPrefetch}`),
          staleTime: 5 * 60 * 1000,
        }),
        queryClient.prefetchQuery({
          queryKey: ['menu-categories', zoneToPrefetch],
          queryFn: () => api.get(`/categories?zoneId=${zoneToPrefetch}`),
          staleTime: 5 * 60 * 1000,
        }),
        queryClient.prefetchQuery({
          queryKey: ['menu', zoneToPrefetch],
          queryFn: () => api.get(`/menu?zoneId=${zoneToPrefetch}`),
          staleTime: 5 * 60 * 1000,
        }),
      ]).catch(() => {});

      const prefetchWithTimeout = Promise.race([
        prefetchPromise,
        new Promise<void>((resolve) => setTimeout(resolve, 900)),
      ]);

      // Fast Optimistic Boot: wait for prefetch/splash
      if (zoneToPrefetch || globalLocation || currentAddressIdRef.current) {
        await Promise.all([minimumSplashTime, prefetchWithTimeout]);
        setIsBooted(true);

        // Run GPS / Zone revalidation silently in the background
        if (globalLocation) {
          runServiceabilityCheck(globalLocation, globalLocation.addressText);
          const isStale =
            !globalLocation.addressText ||
            globalLocation.addressText === 'Current Location' ||
            globalLocation.addressText === 'Detecting...';
          if (isStale) {
            reverseGeocode(globalLocation.latitude, globalLocation.longitude).then(addressText => {
              dispatch(setGlobalLocation({ ...globalLocation, addressText }));
            });
          }
        } else {
          runGpsZoneCheck(/* isSilent= */ true);
        }
        return;
      }

      // First-time install: no cached zone — wait for initial GPS check before dismissing splash
      dispatch(setServiceabilityChecking());

      const gpsCheckWithTimeout = Promise.race([
        runGpsZoneCheck(/* isSilent= */ false),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2500)),
      ]);

      try {
        await Promise.all([gpsCheckWithTimeout, minimumSplashTime, prefetchWithTimeout]);
      } finally {
        setIsBooted(true);
      }
    };

    boot();
  }, [dispatch, runServiceabilityCheck, runGpsZoneCheck, globalLocation, queryClient]);

  // ─── Continuous Location Observer ────────────────────────────────────────
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isBooted) return;

    const startWatching = () => {
      if (watchIdRef.current !== null) return;
      if (currentAddressIdRef.current) return; // Explicit address overrides GPS watcher
      if (AppState.currentState !== 'active') return;

      watchIdRef.current = Geolocation.watchPosition(
        async (pos) => {
          const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          await runServiceabilityCheck(coords);
          reverseGeocode(coords.latitude, coords.longitude).then((addressText) => {
            dispatch(setGlobalLocation({ ...coords, addressText }));
          });
        },
        () => {},
        { enableHighAccuracy: true, distanceFilter: 50, maximumAge: 10000, timeout: 30000 }
      );
    };

    const stopWatching = () => {
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') startWatching();
      else stopWatching();
    });

    startWatching();

    return () => {
      subscription.remove();
      stopWatching();
    };
  }, [isBooted, currentAddressId, dispatch, runServiceabilityCheck]);

  if (!isBooted) {
    return <SplashScreen />;
  }

  return <View style={styles.container}>{children}</View>;
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8F4' },
});
