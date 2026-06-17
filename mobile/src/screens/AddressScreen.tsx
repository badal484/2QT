import {
  ArrowLeft, Home, Briefcase, MapPin, Search, Navigation, Plus, MoreVertical,
} from 'lucide-react-native';
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  Alert, StyleSheet, Platform, PermissionsAndroid,
} from 'react-native';
import Animated, { useSharedValue, withSpring, useAnimatedStyle } from 'react-native-reanimated';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDispatch, useSelector } from 'react-redux';
import { api } from '../api/client';
import { setAddress, setZone } from '../store/slices/cartSlice';
import { setServiceable, setUnserviceable } from '../store/slices/appSlice';
import { RootState } from '../store';
import { AddressSearchModal } from '../components/AddressSearchModal';
import { LeafletMap } from '../components/LeafletMap';
import Geolocation from '@react-native-community/geolocation';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import { radius, spacing } from '../theme/spacing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const triggerHaptic = (type = 'impactLight') =>
  ReactNativeHapticFeedback.trigger(type as any, { enableVibrateFallback: true });

const buildAddressText = (data: any): string => {
  if (!data) return '';
  const addr = data.address || {};
  const street =
    addr.road || addr.suburb || addr.neighbourhood || addr.hamlet || addr.quarter || '';
  const locality =
    addr.city || addr.town || addr.village || addr.county || addr.state_district || '';
  if (street || locality) return [street, locality].filter(Boolean).join(', ');
  if (data.display_name) {
    const parts = (data.display_name as string)
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);
    return parts.slice(0, 2).join(', ') || data.display_name;
  }
  return '';
};

const AddressScreen = ({ navigation }: any) => {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const globalLocation = useSelector((state: RootState) => state.app.globalLocation);

  const [gpsLoading, setGpsLoading] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);

  // ── Map state ──────────────────────────────────────────────────────────────
  const [mapRegion, setMapRegion] = useState({
    latitude: globalLocation?.latitude ?? 24.0,
    longitude: globalLocation?.longitude ?? 85.3,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [mapAddress, setMapAddress] = useState(globalLocation?.addressText || '');
  const [mapServiceable, setMapServiceable] = useState<boolean | null>(null);
  const [mapZoneId, setMapZoneId] = useState<string | null>(null);
  const [mapChecking, setMapChecking] = useState(false);

  const pinTranslateY = useSharedValue(0);
  const pinAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pinTranslateY.value }],
  }));

  // Run zone check immediately on mount using the current map position (globalLocation).
  // This shows the serviceability badge without requiring user to tap or drag.
  useEffect(() => {
    if (globalLocation) {
      onMapRegionChangeComplete({ latitude: globalLocation.latitude, longitude: globalLocation.longitude });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onMapRegionChange = useCallback(() => {
    if (!isDragging) {
      setIsDragging(true);
      triggerHaptic('impactLight');
      pinTranslateY.value = withSpring(-14, { damping: 10, stiffness: 200 });
    }
  }, [isDragging, pinTranslateY]);

  const onMapRegionChangeComplete = useCallback(async (region: { latitude: number; longitude: number }) => {
    setMapRegion(region);
    setIsDragging(false);
    pinTranslateY.value = withSpring(0, { damping: 12, stiffness: 300 });
    triggerHaptic('impactMedium');

    setMapChecking(true);
    setMapServiceable(null);
    setMapZoneId(null);

    try {
      const [geoData, zoneRes] = await Promise.all([
        api.get(`/menu/geocode/reverse?lat=${region.latitude}&lng=${region.longitude}`),
        api.get(`/menu/zones/check?lat=${region.latitude}&lng=${region.longitude}`),
      ]);
      const addrText = buildAddressText(geoData) || 'Selected location';
      setMapAddress(addrText);
      setMapServiceable(zoneRes.serviceable === true);
      if (zoneRes.serviceable && zoneRes.zone?.id) {
        setMapZoneId(zoneRes.zone.id);
      }
    } catch {
      setMapServiceable(null);
    } finally {
      setMapChecking(false);
    }
  }, [pinTranslateY]);

  const handleConfirmMapLocation = () => {
    if (!mapZoneId || !mapServiceable) return;
    triggerHaptic('notificationSuccess');
    dispatch(setServiceable({
      zoneId: mapZoneId,
      zoneName: null,
      location: { latitude: mapRegion.latitude, longitude: mapRegion.longitude, addressText: mapAddress || 'Current Location' },
    }));
    dispatch(setAddress(null));
    dispatch(setZone(mapZoneId));
    queryClient.invalidateQueries({ queryKey: ['menu'] });
    navigation.goBack();
  };

  // ── Saved addresses query ──────────────────────────────────────────────────
  const { data: addresses, isLoading } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => api.get('/customers/addresses'),
  });

  // ── Select a saved address ─────────────────────────────────────────────────
  const selectAddress = (address: any) => {
    triggerHaptic('impactMedium');
    if (!address.is_serviceable) {
      Alert.alert('Not Serviceable', "We don't deliver to this location yet.");
      return;
    }
    dispatch(setAddress(address.id));
    dispatch(setZone(address.zone_id));
    dispatch(setServiceable({ zoneId: address.zone_id, zoneName: address.zone_name || null }));
    queryClient.invalidateQueries({ queryKey: ['menu'] });
    navigation.goBack();
  };

  // ── Use current GPS location ───────────────────────────────────────────────
  const handleUseCurrentLocation = async () => {
    triggerHaptic();
    setGpsLoading(true);
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          { title: 'Location Permission', message: 'Needed to check delivery availability.', buttonPositive: 'Allow', buttonNegative: 'Cancel' },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permission Denied', 'Enable location in device settings.');
          return;
        }
      } else {
        Geolocation.requestAuthorization();
      }

      const coords = await new Promise<{ latitude: number; longitude: number }>((resolve, reject) =>
        Geolocation.getCurrentPosition(
          (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          (err) => reject(err),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
        ),
      );

      const [geoData, res] = await Promise.all([
        api.get(`/menu/geocode/reverse?lat=${coords.latitude}&lng=${coords.longitude}`),
        api.get(`/menu/zones/check?lat=${coords.latitude}&lng=${coords.longitude}`),
      ]);

      const addressText = buildAddressText(geoData) || 'Current Location';

      if (res.serviceable && res.zone?.id) {
        dispatch(setServiceable({ zoneId: res.zone.id, zoneName: res.zone.name || null, location: { latitude: coords.latitude, longitude: coords.longitude, addressText } }));
        dispatch(setAddress(null));
        dispatch(setZone(res.zone.id));
        queryClient.invalidateQueries({ queryKey: ['menu'] });
        triggerHaptic('notificationSuccess');
        navigation.goBack();
      } else {
        dispatch(setUnserviceable({ latitude: coords.latitude, longitude: coords.longitude, addressText }));
        // Move map to real GPS location and show "Out of zone" badge — no alert needed
        setMapRegion({ latitude: coords.latitude, longitude: coords.longitude });
        setMapAddress(addressText);
        setMapServiceable(false);
        setMapZoneId(null);
      }
    } catch {
      Alert.alert('Location Error', 'Could not get GPS. Try again or select an address.');
    } finally {
      setGpsLoading(false);
    }
  };

  // ── Search result selected ─────────────────────────────────────────────────
  const handleSearchSelect = async (lat: number, lon: number, displayName: string) => {
    setSearchVisible(false);
    try {
      const res = await api.get(`/menu/zones/check?lat=${lat}&lng=${lon}`);
      if (res.serviceable && res.zone?.id) {
        dispatch(setServiceable({ zoneId: res.zone.id, zoneName: res.zone.name || null, location: { latitude: lat, longitude: lon, addressText: displayName } }));
        dispatch(setAddress(null));
        dispatch(setZone(res.zone.id));
        queryClient.invalidateQueries({ queryKey: ['menu'] });
        navigation.goBack();
      } else {
        dispatch(setUnserviceable({ latitude: lat, longitude: lon, addressText: displayName }));
        navigation.goBack();
      }
    } catch {
      Alert.alert('Error', 'Could not verify delivery for that location.');
    }
  };

  const renderAddressIcon = (label: string, serviceable: boolean) => {
    const color = serviceable ? colors.primary : colors.inkFaint;
    if (label === 'Home') return <Home size={20} color={color} />;
    if (label === 'Work') return <Briefcase size={20} color={color} />;
    return <MapPin size={20} color={color} />;
  };

  const mapPinColor = mapServiceable === false ? colors.danger : colors.primary;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { triggerHaptic(); navigation.goBack(); }} style={styles.backBtn}>
          <ArrowLeft size={22} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select a location</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* ── Search bar ──────────────────────────────────────────────────── */}
      <TouchableOpacity style={styles.searchBar} activeOpacity={0.8} onPress={() => { triggerHaptic(); setSearchVisible(true); }}>
        <Search size={18} color={colors.primary} style={{ marginRight: spacing.md }} />
        <Text style={styles.searchPlaceholder}>Search location</Text>
      </TouchableOpacity>

      {/* ── Interactive map ─────────────────────────────────────────────── */}
      {globalLocation && (
        <View style={styles.mapSection}>
          <View style={styles.mapContainer}>
            <LeafletMap
              latitude={mapRegion.latitude}
              longitude={mapRegion.longitude}
              zoom={15}
              onRegionChange={onMapRegionChange}
              onRegionChangeComplete={onMapRegionChangeComplete}
              style={{ flex: 1 }}
            />
            {/* Fixed crosshair pin at map center */}
            <View style={styles.mapPinWrap} pointerEvents="none">
              <Animated.View style={[pinAnimStyle, { transform: [{ translateY: -18 }] }]}>
                <MapPin size={36} color={mapPinColor} fill={mapPinColor} />
              </Animated.View>
              <View style={[styles.mapPinShadow, { backgroundColor: mapPinColor }]} />
            </View>
          </View>

          {/* Address + serviceability below map */}
          <View style={styles.mapInfo}>
            {mapChecking ? (
              <View style={styles.mapInfoRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.mapInfoText}>Checking delivery...</Text>
              </View>
            ) : (
              <View style={styles.mapInfoRow}>
                <MapPin size={14} color={colors.inkMuted} style={{ marginRight: 6, flexShrink: 0 }} />
                <Text style={styles.mapInfoText} numberOfLines={2}>
                  {mapAddress || (isDragging ? 'Move map to set location' : globalLocation.addressText)}
                </Text>
                {mapServiceable === true && (
                  <View style={styles.serviceableBadge}>
                    <Text style={styles.serviceableBadgeText}>Deliverable</Text>
                  </View>
                )}
                {mapServiceable === false && (
                  <View style={styles.unserviceableBadge}>
                    <Text style={styles.unserviceableBadgeText}>Out of zone</Text>
                  </View>
                )}
              </View>
            )}
            {mapServiceable === true && mapZoneId && (
              <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirmMapLocation} activeOpacity={0.9}>
                <Text style={styles.confirmBtnText}>Confirm this location</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* ── Scrollable list ─────────────────────────────────────────────── */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Use current location */}
        <TouchableOpacity style={styles.useLocationBtn} activeOpacity={0.8} onPress={handleUseCurrentLocation} disabled={gpsLoading}>
          {gpsLoading
            ? <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: spacing.md }} />
            : <Navigation size={18} color={colors.primary} style={{ marginRight: spacing.md }} />}
          <Text style={styles.useLocationText}>
            {gpsLoading ? 'Detecting location...' : 'Use current location'}
          </Text>
        </TouchableOpacity>

        {/* Saved addresses */}
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />
        ) : (
          addresses?.addresses?.map((addr: any) => (
            <TouchableOpacity
              key={addr.id}
              style={[styles.addressCard, !addr.is_serviceable && styles.addressCardDisabled]}
              onPress={() => selectAddress(addr)}
              activeOpacity={0.85}
            >
              <View style={[styles.addressIconWrap, !addr.is_serviceable && styles.addressIconWrapDisabled]}>
                {renderAddressIcon(addr.label, addr.is_serviceable)}
              </View>
              <View style={styles.addressInfo}>
                <View style={styles.addressTitleRow}>
                  <Text style={[styles.addressLabel, !addr.is_serviceable && styles.addressLabelDisabled]}>
                    {addr.label}
                  </Text>
                  {addr.is_serviceable
                    ? <View style={styles.serviceablePill}><Text style={styles.serviceablePillText}>Deliverable</Text></View>
                    : <View style={styles.unserviceablePill}><Text style={styles.unserviceablePillText}>Out of zone</Text></View>}
                </View>
                <Text style={styles.addressText} numberOfLines={2}>{addr.address_text}</Text>
              </View>
              <MoreVertical size={18} color={colors.border} />
            </TouchableOpacity>
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Fixed bottom: Add new address ─────────────────────────────────── */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) + 4 }]}>
        <TouchableOpacity
          style={styles.addAddrBtn}
          onPress={() => { triggerHaptic(); navigation.navigate('AddressBook'); }}
          activeOpacity={0.9}
        >
          <Plus size={20} color={colors.white} style={{ marginRight: spacing.sm }} />
          <Text style={styles.addAddrBtnText}>Add new address</Text>
        </TouchableOpacity>
      </View>

      {/* ── Address search modal ───────────────────────────────────────────── */}
      <AddressSearchModal
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        onSelect={handleSearchSelect}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: fontFamily.extrabold,
    color: colors.ink,
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: 15,
    fontFamily: fontFamily.medium,
    color: colors.inkFaint,
  },

  // ── Map section
  mapSection: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  mapContainer: {
    height: 220,
    position: 'relative',
  },
  mapPinWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPinShadow: {
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.25,
    marginTop: 2,
  },
  mapInfo: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  mapInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  mapInfoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: fontFamily.medium,
    color: colors.inkMuted,
    lineHeight: 18,
  },
  serviceableBadge: {
    backgroundColor: 'rgba(16,185,129,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    flexShrink: 0,
  },
  serviceableBadgeText: {
    fontSize: 10,
    fontFamily: fontFamily.extrabold,
    color: '#10B981',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  unserviceableBadge: {
    backgroundColor: colors.dangerTint,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    flexShrink: 0,
  },
  unserviceableBadgeText: {
    fontSize: 10,
    fontFamily: fontFamily.extrabold,
    color: colors.danger,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  confirmBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 14,
    fontFamily: fontFamily.extrabold,
    color: colors.white,
  },

  // ── Scroll list
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },

  useLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: 16,
    marginBottom: spacing.xl,
    borderWidth: 1.5,
    borderColor: colors.primaryTint,
  },
  useLocationText: {
    fontSize: 15,
    fontFamily: fontFamily.bold,
    color: colors.primary,
  },

  // Saved address cards
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  addressCardDisabled: { opacity: 0.55, backgroundColor: colors.surfaceMuted },
  addressIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  addressIconWrapDisabled: { backgroundColor: colors.surfaceMuted },
  addressInfo: { flex: 1 },
  addressTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs, gap: spacing.sm },
  addressLabel: { fontSize: 15, fontFamily: fontFamily.extrabold, color: colors.ink },
  addressLabelDisabled: { color: colors.inkMuted },
  addressText: { fontSize: 12, fontFamily: fontFamily.medium, color: colors.inkMuted, lineHeight: 18 },
  serviceablePill: { backgroundColor: 'rgba(16,185,129,0.1)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  serviceablePillText: { fontSize: 9, fontFamily: fontFamily.extrabold, color: '#10B981', textTransform: 'uppercase', letterSpacing: 0.5 },
  unserviceablePill: { backgroundColor: colors.dangerTint, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  unserviceablePillText: { fontSize: 9, fontFamily: fontFamily.extrabold, color: colors.danger, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Fixed bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  addAddrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 16,
  },
  addAddrBtnText: {
    fontSize: 16,
    fontFamily: fontFamily.extrabold,
    color: colors.white,
  },
});

export default AddressScreen;
