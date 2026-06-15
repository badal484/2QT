import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import axios from 'axios';

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
            message: 'App needs access to your location to deliver your food.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    // iOS permissions are handled by Geolocation implicitly or via Geolocation.requestAuthorization()
    Geolocation.requestAuthorization();
    return true;
  };

  const reverseGeocode = async (lat: number, lon: number): Promise<string> => {
    try {
      // Using OpenStreetMap Nominatim API (Free, no API key required)
      const res = await axios.get('https://nominatim.openstreetmap.org/reverse', {
        params: {
          lat,
          lon,
          format: 'json',
          addressdetails: 1,
        },
        headers: {
          // Nominatim requires a User-Agent identifying the app
          'User-Agent': 'VeltoFoodPalaceApp/1.0',
        }
      });
      
      if (res.data && res.data.address) {
        const addr = res.data.address;
        const street = addr.road || addr.suburb || addr.neighbourhood || '';
        const city = addr.city || addr.town || addr.village || '';
        return [street, city].filter(Boolean).join(', ') || 'Unknown Location';
      }
      return 'Unknown Location';
    } catch (e) {
      console.log('Reverse Geocode error:', e);
      return 'Selected Location';
    }
  };

  const fetchLocation = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoadingLocation(true);
    setLocationError(null);

    const fallbackToIp = async () => {
      try {
        const ipRes = await axios.get('https://freeipapi.com/api/json');
        if (ipRes.data && ipRes.data.cityName) {
          const { latitude, longitude, cityName, regionName } = ipRes.data;
          setLocation({
            latitude,
            longitude,
            addressText: `${cityName}, ${regionName}`
          });
          setLoadingLocation(false);
          isFetchingRef.current = false;
          return true;
        }
      } catch (e) {
        console.log('IP fallback failed', e);
      }
      return false;
    };

    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      const ipSuccess = await fallbackToIp();
      if (!ipSuccess) {
        setLocationError('Location permission denied');
        setLoadingLocation(false);
        isFetchingRef.current = false;
      }
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
      async (error) => {
        const ipSuccess = await fallbackToIp();
        if (!ipSuccess) {
          setLocationError(error.message);
          setLoadingLocation(false);
          isFetchingRef.current = false;
          Alert.alert('Location Error', 'Could not fetch your location. Please check your GPS settings.');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  }, []);

  return { location, loadingLocation, locationError, fetchLocation };
};
