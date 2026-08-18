import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ENV } from '../config/env';
import { View, StyleSheet, Platform, PermissionsAndroid, AppState, NativeModules } from 'react-native';
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

const { RoleModule } = NativeModules;
const BUILD_ROLE = RoleModule?.BUILD_ROLE;

export const AppBootManager = ({ children }: { children: React.ReactNode }) => {
  const dispatch = useDispatch();
  const globalLocation = useSelector((state: RootState) => state.app.globalLocation);
  const { addressId: currentAddressId } = useSelector((state: RootState) => state.cart);
  const authRole = useSelector((state: RootState) => state.auth.user?.role);

  // This whole boot sequence — GPS fix, reverse-geocode, "is this a
  // deliverable customer zone" check, and the continuous location watcher
  // below — exists only to resolve a *customer's* delivery address. Riders,
  // kitchen staff, and admins resolve their own zone via /riders/available-zones
  // and /riders/zone/check-in inside their own screens, so running this here
  // for them just adds tens of seconds of GPS/network wait in front of the
  // splash screen, plus a redundant app-wide GPS watcher, for data nobody reads.
  const activeRole = BUILD_ROLE || authRole;
  const isCustomerApp = activeRole === 'customer' || activeRole === 'buyer';

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

  // ─── Main boot sequence ───────────────────────────────────────────────────
  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    const boot = async () => {
      // Enforce minimum splash screen duration to allow premium animations to play
      const minimumSplashTime = new Promise<void>((resolve) => setTimeout(resolve, 3000));

      // Wake Render free-tier backend immediately in background — doesn't block boot
      fetch(`${ENV.API_URL}/menu/zones`).catch(() => {});

      // Rider/Kitchen/Admin apps don't use the customer delivery-zone concept at
      // all — skip GPS + serviceability entirely and let the splash screen clear
      // as soon as its minimum duration elapses.
      if (!isCustomerApp) {
        await minimumSplashTime;
        setIsBooted(true);
        return;
      }

      // Clear stale persisted zone — will be resolved fresh via GPS or address selection
      dispatch(setZone(null));

      // Sanitize corrupted Redux-Persist state (object stored instead of string)
      if (currentAddressIdRef.current !== null && typeof currentAddressIdRef.current === 'object') {
        dispatch(setAddress(null));
        currentAddressIdRef.current = null;
      }

      if (currentAddressIdRef.current || globalLocation) {
        // Fast boot path: we still wait for minimum splash duration

        // Zone was cleared above — need to re-resolve it.
        // Signal HomeScreen to show skeleton while GPS resolves.
        dispatch(setServiceabilityChecking());

        if (globalLocation) {
          // Have cached coords — fast zone check with existing address text
          await runServiceabilityCheck(globalLocation, globalLocation.addressText);
          // Refresh stale address text in background (e.g. 'Current Location' placeholder)
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
          // Have saved addressId but no GPS coords — run GPS silently.
          // isSilent=true so GPS denial doesn't override 'checking' with an error screen
          // when the user has a real saved address.
          const gpsOk = await runGpsZoneCheck(/* isSilent= */ true);
          // If GPS failed entirely (denied, timed out, no signal), we'd be stuck on
          // 'checking' forever. Surface a retry option instead.
          if (!gpsOk) dispatch(setNetworkError());
        }
        await minimumSplashTime;
        setIsBooted(true);
        return;
      }

      // Full boot: no cached address or location — wait for GPS before showing app
      dispatch(setServiceabilityChecking());

      try {
        await runGpsZoneCheck(/* isSilent= */ false);
      } finally {
        await minimumSplashTime;
        setIsBooted(true);
      }
    };

    boot();
  }, [dispatch, runServiceabilityCheck, runGpsZoneCheck, isCustomerApp]);

  // ─── Continuous Location Observer (customer delivery-zone tracking only) ──
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isBooted || !isCustomerApp) return;

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
  }, [isBooted, isCustomerApp, currentAddressId, dispatch, runServiceabilityCheck]);

  if (!isBooted) {
    return <SplashScreen />;
  }

  return <View style={styles.container}>{children}</View>;
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8F4' },
});
