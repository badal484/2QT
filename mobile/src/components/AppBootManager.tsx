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
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 },
    );
  });

// Covers both urban (road/suburb/city) and rural India (hamlet/village/county/state_district).
// Falls back to display_name which Nominatim always populates.
const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  try {
    const data = await api.get(`/menu/geocode/reverse?lat=${lat}&lng=${lng}`);
    if (data) {
      const addr = data.address || {};
      const street =
        addr.road || addr.suburb || addr.neighbourhood || addr.hamlet || addr.quarter || '';
      const locality =
        addr.city || addr.town || addr.village || addr.county || addr.state_district || '';
      if (street || locality) {
        return [street, locality].filter(Boolean).join(', ');
      }
      if (data.display_name) {
        const parts = (data.display_name as string)
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean);
        return parts.slice(0, 2).join(', ') || data.display_name;
      }
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

  // Keep at least 2.5 s of splash so the animation plays out
  useEffect(() => {
    const timer = setTimeout(() => setMinSplashDone(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  const runServiceabilityCheck = useCallback(
    async (coords: { latitude: number; longitude: number }, addressText?: string) => {
      try {
        const res = await api.get(
          `/menu/zones/check?lat=${coords.latitude}&lng=${coords.longitude}`,
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
      } catch {
        dispatch(setNetworkError());
      }
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
      dispatch(setServiceabilityChecking());
      // GPS is primary — clear any stale persisted delivery address
      dispatch(setAddress(null));

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
