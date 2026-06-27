import { useState, useCallback, useRef } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { reverseGeocode } from '../utils/geocode';

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

    const onSuccess = async (position: any) => {
      const { latitude, longitude } = position.coords;

      // Move the map IMMEDIATELY — don't wait for address text
      setLocation({ latitude, longitude, addressText: '' });
      setLoadingLocation(false);
      isFetchingRef.current = false;

      // Fetch address in background — updates label once ready
      const addressText = await reverseGeocode(latitude, longitude);
      setLocation({ latitude, longitude, addressText });
    };

    const onError = (error: any) => {
      console.warn('[useLocation] GPS failed:', error.message);
      setLocationError(error.message);
      setLoadingLocation(false);
      isFetchingRef.current = false;
    };

    // Try fast network-based first, retry with GPS if it fails
    Geolocation.getCurrentPosition(
      onSuccess,
      () => {
        Geolocation.getCurrentPosition(onSuccess, onError, {
          enableHighAccuracy: true, timeout: 20000, maximumAge: 10000,
        });
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 10000 },
    );
  }, []);

  return { location, loadingLocation, locationError, fetchLocation };
};
