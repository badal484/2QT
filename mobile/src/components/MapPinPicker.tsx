import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Animated, Dimensions
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, UrlTile } from 'react-native-maps';
import { ArrowLeft, Navigation, MapPin, Search } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Geolocation from '@react-native-community/geolocation';
import { api } from '../api/client';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const BOTTOM_SHEET_HEIGHT = 160;

interface Props {
  initialLat?: number;
  initialLng?: number;
  onConfirm: (lat: number, lng: number, address: string) => void;
  onBack: () => void;
  onSearchPress?: () => void;
}

export const MapPinPicker: React.FC<Props> = ({
  initialLat = 23.637,
  initialLng = 85.52,
  onConfirm,
  onBack,
  onSearchPress,
}) => {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  const [center, setCenter] = useState({ lat: initialLat, lng: initialLng });
  const [address, setAddress] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [moving, setMoving] = useState(false);
  const [locating, setLocating] = useState(false);

  // Pin bounce animation — lifts when moving, drops when stopped
  const pinY = useRef(new Animated.Value(0)).current;
  const shadowScale = useRef(new Animated.Value(1)).current;

  const animatePin = useCallback((up: boolean) => {
    Animated.parallel([
      Animated.spring(pinY, {
        toValue: up ? -14 : 0,
        useNativeDriver: true,
        tension: 120,
        friction: 8,
      }),
      Animated.spring(shadowScale, {
        toValue: up ? 0.6 : 1,
        useNativeDriver: true,
        tension: 120,
        friction: 8,
      }),
    ]).start();
  }, [pinY, shadowScale]);

  const geocodeAndSet = useCallback(async (lat: number, lng: number) => {
    setGeocoding(true);
    setCenter({ lat, lng });
    try {
      const data = await api.get(`/menu/geocode/reverse?lat=${lat}&lng=${lng}`);
      setAddress(data?.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } catch {
      setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    }
    setGeocoding(false);
  }, []);

  useEffect(() => {
    Geolocation.requestAuthorization();
    Geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        mapRef.current?.animateToRegion({
          latitude, longitude, latitudeDelta: 0.005, longitudeDelta: 0.005
        }, 800);
        geocodeAndSet(latitude, longitude);
      },
      () => {
        geocodeAndSet(initialLat, initialLng);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const handleRegionChange = () => {
    if (!moving) {
      setMoving(true);
      animatePin(true);
    }
  };

  const handleRegionChangeComplete = useCallback(async (region: any) => {
    setCenter({ lat: region.latitude, lng: region.longitude });
    setMoving(false);
    animatePin(false);
    
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    geocodeTimer.current = setTimeout(() => {
      geocodeAndSet(region.latitude, region.longitude);
    }, 400);
  }, [animatePin, geocodeAndSet]);

  const flyToGPS = useCallback(() => {
    setLocating(true);
    Geolocation.getCurrentPosition(
      pos => {
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        mapRef.current?.animateToRegion({
          latitude, longitude, latitudeDelta: 0.005, longitudeDelta: 0.005
        }, 800);
        geocodeAndSet(latitude, longitude);
      },
      () => {
        setLocating(false);
        mapRef.current?.animateToRegion({
          latitude: initialLat, longitude: initialLng, latitudeDelta: 0.005, longitudeDelta: 0.005
        }, 800);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }, [geocodeAndSet, initialLat, initialLng]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude: initialLat,
          longitude: initialLng,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }}
        onRegionChange={handleRegionChange}
        onRegionChangeComplete={handleRegionChangeComplete}
        showsUserLocation={true}
        showsMyLocationButton={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        mapType="none"
      >
        <UrlTile
          urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maximumZ={19}
          flipY={false}
        />
      </MapView>

      {/* Fixed center pin */}
      <View style={styles.pinContainer} pointerEvents="none">
        <Animated.View style={{ transform: [{ translateY: pinY }] }}>
          <View style={styles.pinCircle}>
            <MapPin size={22} color="#fff" fill="#fff" />
          </View>
          <View style={styles.pinTail} />
        </Animated.View>
        <Animated.View style={[styles.pinShadow, { transform: [{ scaleX: shadowScale }] }]} />
      </View>

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 20) }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.85}>
          <ArrowLeft size={20} color={colors.ink} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.searchBar} onPress={onSearchPress} activeOpacity={0.85}>
          <Search size={15} color={colors.inkMuted} />
          <Text style={styles.searchPlaceholder}>Search area, street or landmark…</Text>
        </TouchableOpacity>
      </View>

      {/* GPS button */}
      <TouchableOpacity
        style={[styles.gpsBtn, { bottom: BOTTOM_SHEET_HEIGHT + 16 }]}
        onPress={flyToGPS}
        disabled={locating}
        activeOpacity={0.85}
      >
        {locating
          ? <ActivityIndicator size="small" color={colors.primary} />
          : <Navigation size={18} color={colors.primary} />
        }
      </TouchableOpacity>

      {/* Bottom sheet */}
      <View style={[styles.bottomSheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <View style={styles.dragHandle} />

        <View style={styles.locationRow}>
          <View style={styles.locationDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.locationLabel}>
              {moving ? 'Move the map to your location…' : 'Delivering to'}
            </Text>
            {geocoding ? (
              <View style={styles.skeletonRow}>
                <View style={[styles.skeleton, { width: '80%' }]} />
                <View style={[styles.skeleton, { width: '55%', marginTop: 5 }]} />
              </View>
            ) : (
              <Text style={styles.addressText} numberOfLines={2}>{address || 'Detecting address…'}</Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.confirmBtn, (moving || geocoding) && styles.confirmBtnDisabled]}
          onPress={() => onConfirm(center.lat, center.lng, address)}
          activeOpacity={0.9}
          disabled={moving || geocoding}
        >
          {geocoding
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.confirmBtnText}>Confirm Location</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0ede8' },

  // Pin
  pinContainer: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: BOTTOM_SHEET_HEIGHT,
    alignItems: 'center', justifyContent: 'center',
  },
  pinCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  pinTail: {
    width: 3, height: 10,
    backgroundColor: colors.primary,
    alignSelf: 'center',
    borderBottomLeftRadius: 2, borderBottomRightRadius: 2,
  },
  pinShadow: {
    width: 16, height: 6, borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.18)',
    alignSelf: 'center', marginTop: 2,
  },

  // Top bar
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingBottom: 12,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  searchBar: {
    flex: 1, height: 40, borderRadius: 20,
    backgroundColor: '#fff',
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, gap: 8,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  searchPlaceholder: {
    fontSize: 13, color: colors.inkMuted,
    fontFamily: fontFamily.medium, flex: 1,
  },

  // GPS
  gpsBtn: {
    position: 'absolute', right: 16,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },

  // Bottom sheet
  bottomSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: -4 },
    elevation: 20, minHeight: BOTTOM_SHEET_HEIGHT,
  },
  dragHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#e0ddd8', alignSelf: 'center', marginBottom: 16,
  },
  locationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  locationDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: colors.primary, marginTop: 5,
  },
  locationLabel: { fontSize: 11, color: colors.inkMuted, fontFamily: fontFamily.medium, marginBottom: 3 },
  addressText: { fontSize: 14, color: colors.ink, fontFamily: fontFamily.semibold, lineHeight: 20 },
  skeletonRow: { gap: 4 },
  skeleton: { height: 12, borderRadius: 6, backgroundColor: '#ece9e4' },

  // Confirm button
  confirmBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14, height: 50,
    alignItems: 'center', justifyContent: 'center',
  },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmBtnText: { color: '#fff', fontSize: 15, fontFamily: fontFamily.bold },
});
