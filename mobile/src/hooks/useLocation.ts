import { useState, useCallback, useRef } from 'react';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { api } from '../api/client';

export interface LocationData {
  latitude: number;
  longitude: number;
  addressText: string;
}

export const useLocation = () => {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const isFetchingRef = useRef(false);

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'App needs your location to deliver food to you.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
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

  // Proxy through backend so the device never calls Nominatim directly.
  // Old code used axios with no timeout → connection to nominatim hung for 60-120s
  // on the emulator, keeping loadingLocation=true indefinitely.
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

  const fetchLocation = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoadingLocation(true);
    setLocationError(null);

    const hasPermission = await requestPermissions();

    if (!hasPermission) {
      setLocationError('Location permission denied');
      setLoadingLocation(false);
      isFetchingRef.current = false;
      return;
    }

    Geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const addressText = await reverseGeocode(latitude, longitude);
        setLocation({ latitude, longitude, addressText });
        setLoadingLocation(false);
        isFetchingRef.current = false;
      },
      (error) => {
        console.warn('[useLocation] GPS failed:', error.message);
        setLocationError(error.message);
        setLoadingLocation(false);
        isFetchingRef.current = false;
        Alert.alert(
          'Location Error',
          'Could not get your GPS location. Try tapping again or pick an address manually.',
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  }, []);

  return { location, loadingLocation, locationError, fetchLocation };
};
