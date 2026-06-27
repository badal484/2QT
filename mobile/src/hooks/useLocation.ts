import { useState, useCallback, useRef } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { reverseGeocodeDetailed } from '../utils/geocode';

export interface LocationData {
  latitude: number;
  longitude: number;
  addressText: string;  // short name for HomeScreen header
  addressFull: string;  // full formatted_address for map picker subtitle
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

      // Move map immediately — don't wait for address
      setLocation({ latitude, longitude, addressText: '', addressFull: '' });
      setLoadingLocation(false);
      isFetchingRef.current = false;

      // Fetch both name + full address in background
      const result = await reverseGeocodeDetailed(latitude, longitude);
      setLocation({ latitude, longitude, addressText: result.name, addressFull: result.address });
    };

    const onError = (error: any) => {
      console.warn('[useLocation] GPS failed:', error.message);
      setLocationError(error.message);
      setLoadingLocation(false);
      isFetchingRef.current = false;
    };

    // High-accuracy GPS only — network location is 500m+ off in rural areas
    Geolocation.getCurrentPosition(onSuccess, onError, {
      enableHighAccuracy: true, timeout: 20000, maximumAge: 5000,
    });
  }, []);

  return { location, loadingLocation, locationError, fetchLocation };
};
