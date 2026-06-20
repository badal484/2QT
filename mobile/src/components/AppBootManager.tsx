import React, { useEffect, useState, useRef, useCallback } from 'react';
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
import { setAddress } from '../store/slices/cartSlice';
import { RootState } from '../store';
import SplashScreen from '../screens/SplashScreen';
import { api } from '../api/client';
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
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 },
      ),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    );
  });

const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  try {
    const data = await api.get(`/menu/geocode/reverse?lat=${lat}&lng=${lng}`);
    if (data && data.display_name) {
      let addressText = data.display_name;
      if (addressText.endsWith(', India')) {
        addressText = addressText.replace(', India', '');
      }
      return addressText;
    }
  } catch { /* non-critical */ }
  return 'Current Location';
};

export const AppBootManager = ({ children }: { children: React.ReactNode }) => {
  const dispatch = useDispatch();
  const globalLocation = useSelector((state: RootState) => state.app.globalLocation);
  // Only needed to track current addressId for the foreground recheck
  const { addressId: currentAddressId } = useSelector((state: RootState) => state.cart);

  const [isBooted, setIsBooted] = useState(false);
  const [minSplashDone, setMinSplashDone] = useState(false);
  const hasStartedRef = useRef(false);
  const isRecheckingRef = useRef(false);
  // Ref so the foreground recheck always sees the latest addressId without stale closure
  const currentAddressIdRef = useRef(currentAddressId);
  useEffect(() => {
    currentAddressIdRef.current = currentAddressId;
  }, [currentAddressId]);

  // Minimum splash duration — short enough to feel fast
  useEffect(() => {
    const timer = setTimeout(() => setMinSplashDone(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  const runServiceabilityCheck = useCallback(
    async (coords: { latitude: number; longitude: number }, addressText?: string) => {
      // Render free tier cold-starts in 30-60s — retry up to 3x with 40s timeout each
      const MAX_ATTEMPTS = 3;
      const ATTEMPT_TIMEOUT = 40000;
      let lastErr: any;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          console.log(`[AppBoot] Zone check attempt ${attempt}/${MAX_ATTEMPTS}`);
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
                  addressText: addressText || 'Current Location',
                },
              }),
            );
          } else {
            dispatch(
              setUnserviceable({
                latitude: coords.latitude,
                longitude: coords.longitude,
                addressText: addressText || 'Current Location',
              }),
            );
          }
          return; // success — exit retry loop
        } catch (err) {
          lastErr = err;
          console.warn(`[AppBoot] Zone check attempt ${attempt} failed:`, err);
          if (attempt < MAX_ATTEMPTS) {
            await new Promise<void>(r => setTimeout(r, 2000)); // 2s gap between retries
          }
        }
      }

      console.warn('[AppBoot] All zone check attempts failed:', lastErr);
      dispatch(setNetworkError());
    },
    [dispatch],
  );

  // ─── Main boot sequence ───────────────────────────────────────────────────
  // GPS is ALWAYS the primary source on launch. Any previously persisted
  // addressId is cleared so the zone reflects the user's actual current location.
  // The user can switch to a saved delivery address via AddressScreen after boot.
  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    const boot = async () => {
      console.log('[AppBoot] ▶ Starting boot sequence...');

      // 1. FAST BOOT: If user already has a saved address OR we have cached GPS coords,
      // boot instantly without forcing a blocking location check.
      if (currentAddressIdRef.current || globalLocation) {
        console.log('[AppBoot] ⚡ Fast boot: Using cached location/address');
        setIsBooted(true);

        // If relying purely on cached GPS (no explicit address selected), 
        // do a silent background check to ensure the zone is still valid.
        if (!currentAddressIdRef.current && globalLocation) {
          runServiceabilityCheck(globalLocation, globalLocation.addressText);
        }
        return;
      }

      // 2. COLD BOOT: No saved location, force a check before letting them in
      dispatch(setServiceabilityChecking());

      try {
        const hasPermission = await requestLocationPermission();
        if (!hasPermission) {
          console.log('[AppBoot] ⚠ Location permission denied');
          dispatch(setNoLocation());
          return;
        }

        const coords = await getGpsCoords();
        if (!coords) {
          console.log('[AppBoot] ⚠ GPS unavailable — user must select address');
          dispatch(setNoLocation());
          return;
        }

        console.log('[AppBoot] ✅ GPS:', coords.latitude, coords.longitude);
        // Dispatch placeholder coords immediately so the header has something to show
        dispatch(setGlobalLocation({ ...coords, addressText: 'Detecting...' }));

        const addressText = await reverseGeocode(coords.latitude, coords.longitude);
        console.log('[AppBoot] Address text:', addressText);

        await runServiceabilityCheck(coords, addressText);

      } catch (err) {
        console.warn('[AppBoot] ❌ Boot error:', err);
        dispatch(setNetworkError());
      } finally {
        console.log('[AppBoot] ✅ Boot complete');
        setIsBooted(true);
      }
    };

    boot();
  }, [dispatch, runServiceabilityCheck]);

  // ─── Foreground re-check ──────────────────────────────────────────────────
  // When the app comes back to foreground:
  //   • Always update the GPS location text for the header.
  //   • Only re-run the zone check when the user has NOT explicitly selected a
  //     delivery address — if they chose "Home", GPS must not override their zone.
  useEffect(() => {
    if (!isBooted) return;

    const subscription = AppState.addEventListener('change', async (nextState) => {
      if (nextState !== 'active') return;
      if (isRecheckingRef.current) return;
      if (!globalLocation) return;

      isRecheckingRef.current = true;

      try {
        const freshCoords = await getGpsCoords();
        const coords = freshCoords || globalLocation;

        const addressText = await reverseGeocode(coords.latitude, coords.longitude);
        dispatch(setGlobalLocation({ ...coords, addressText }));

        // If user explicitly selected a delivery address in this session, respect it
        if (!currentAddressIdRef.current) {
          dispatch(setServiceabilityChecking());
          await runServiceabilityCheck(coords, addressText);
        }
      } finally {
        isRecheckingRef.current = false;
      }
    });

    return () => subscription.remove();
  }, [isBooted, globalLocation, dispatch, runServiceabilityCheck]);

  if (!isBooted || !minSplashDone) {
    return <SplashScreen />;
  }

  return <View style={styles.container}>{children}</View>;
};

const styles = StyleSheet.create({
  container: { flex: 1 },
});
