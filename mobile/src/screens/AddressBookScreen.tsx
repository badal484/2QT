import { ArrowLeft, MapPin, Navigation, Search } from 'lucide-react-native';
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, TextInput,
  StyleSheet, Alert, ScrollView,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { api } from '../api/client';
import { useDispatch, useSelector } from 'react-redux';
import { setAddress, setZone } from '../store/slices/cartSlice';
import { setServiceable, setUnserviceable } from '../store/slices/appSlice';
import { useLocation } from '../hooks/useLocation';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { AddressSearchModal } from '../components/AddressSearchModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import { reverseGeocode } from '../utils/geocode';
import { RootState } from '../store';

const LABELS = [
  { key: 'Home',   icon: '🏠' },
  { key: 'Office', icon: '💼' },
  { key: 'PG',     icon: '🛏' },
  { key: 'Hostel', icon: '🏨' },
  { key: 'Other',  icon: '📍' },
];

const AddressBookScreen = ({ navigation, route }: any) => {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const { initialLat, initialLng, initialAddress } = route?.params || {};

  // Use Redux globalLocation as initial fallback — avoids black map / India center problem
  const savedLocation = useSelector((state: RootState) => state.app.globalLocation);

  const startLat = initialLat || savedLocation?.latitude || 20.5937;
  const startLng = initialLng || savedLocation?.longitude || 78.9629;

  const [label, setLabel] = useState('Home');
  const [addressText, setAddressText] = useState(
    initialAddress || savedLocation?.addressText || ''
  );
  const [flatNumber, setFlatNumber] = useState('');
  const [buildingName, setBuildingName] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);

  const [mapRegion, setMapRegion] = useState({ latitude: startLat, longitude: startLng });
  const mapRef = useRef<MapView>(null);
  // Ref prevents stale closure in onRegionChangeComplete
  const isDraggingRef = useRef(false);

  const { location, loadingLocation, fetchLocation } = useLocation();

  const pinY = useSharedValue(0);
  const animatedPin = useAnimatedStyle(() => ({ transform: [{ translateY: pinY.value }] }));

  // If no initial coords from search, get GPS
  useEffect(() => {
    if (!initialLat && !initialLng) fetchLocation();
  }, []);

  // When GPS resolves, animate map to it — programmatic animation, no onPanDrag, no haptics
  useEffect(() => {
    if (location && !initialLat) {
      mapRef.current?.animateToRegion({
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 800);
      if (location.addressText && location.addressText !== 'Current Location') {
        setAddressText(location.addressText);
      }
    }
  }, [location]);

  // onPanDrag fires ONLY on real user touch-drags — NOT on programmatic animateToRegion
  const onPanDrag = () => {
    if (!isDraggingRef.current) {
      isDraggingRef.current = true;
      setIsDragging(true);
      ReactNativeHapticFeedback.trigger('impactLight');
      pinY.value = withSpring(-20, { damping: 10, stiffness: 200 });
    }
  };

  const onRegionChangeComplete = async (r: any) => {
    const coords = { latitude: r.latitude, longitude: r.longitude };
    setMapRegion(coords);

    if (!isDraggingRef.current) return; // programmatic animation — ignore
    isDraggingRef.current = false;
    setIsDragging(false);
    pinY.value = withSpring(0, { damping: 12, stiffness: 300 });

    const text = await reverseGeocode(coords.latitude, coords.longitude);
    if (text) setAddressText(text);
  };

  const addMutation = useMutation({
    mutationFn: (data: any) => api.post('/customers/addresses', data),
    onSuccess: (res, variables) => {
      ReactNativeHapticFeedback.trigger('notificationSuccess');
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      if (res?.address?.id) dispatch(setAddress(res.address.id));
      if (variables.zoneId) {
        dispatch(setZone(variables.zoneId));
        dispatch(setServiceable({ zoneId: variables.zoneId, zoneName: null }));
        queryClient.invalidateQueries({ queryKey: ['menu'] });
      } else {
        dispatch(setZone(null));
        dispatch(setUnserviceable({
          latitude: variables.lat,
          longitude: variables.lng,
          addressText: variables.addressText,
        }));
      }
      navigation.pop(2);
    },
    onError: () => Alert.alert('Error', 'Could not save address. Please try again.'),
  });

  const handleConfirm = () => {
    ReactNativeHapticFeedback.trigger('impactMedium');
    setShowDetails(true);
  };

  const handleSave = async () => {
    if (!flatNumber.trim()) {
      Alert.alert('Missing Details', 'Please enter your House / Flat number.');
      return;
    }
    setIsChecking(true);
    let zoneId: string | null = null;
    try {
      const res = await api.get(`/menu/zones/check?lat=${mapRegion.latitude}&lng=${mapRegion.longitude}`);
      if (res.serviceable && res.zone?.id) zoneId = res.zone.id;
    } catch {}

    const fullAddress = buildingName.trim()
      ? `${flatNumber.trim()}, ${buildingName.trim()}, ${addressText}`
      : `${flatNumber.trim()}, ${addressText}`;

    addMutation.mutate({
      label,
      addressText: fullAddress,
      lat: mapRegion.latitude,
      lng: mapRegion.longitude,
      zoneId,
      flatNumber: flatNumber.trim(),
      buildingName: buildingName.trim() || null,
    });
    setIsChecking(false);
  };

  const isBusy = addMutation.isPending || isChecking;

  const addressLine1 = addressText.split(',')[0]?.trim() || '';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <ArrowLeft size={22} color="#1A1A2E" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {showDetails ? 'Add address details' : 'Add delivery location'}
          </Text>
        </View>

        {!showDetails && (
          <TouchableOpacity style={styles.searchBar} onPress={() => setIsSearchVisible(true)} activeOpacity={0.9}>
            <Search size={20} color={colors.primary} style={{ marginRight: 12 }} />
            <Text style={styles.searchBarText}>Search delivery location</Text>
          </TouchableOpacity>
        )}
      </View>

      {showDetails ? (
        /* ── Step 2: Address Details ── */
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.detailsScroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Mini map preview — non-interactive */}
          <View style={styles.mapPreview} pointerEvents="none">
            <MapView
              provider={PROVIDER_GOOGLE}
              style={StyleSheet.absoluteFill}
              region={{
                latitude: mapRegion.latitude,
                longitude: mapRegion.longitude,
                latitudeDelta: 0.002,
                longitudeDelta: 0.002,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
              pitchEnabled={false}
              rotateEnabled={false}
            />
            <View style={styles.mapPreviewPin} pointerEvents="none">
              <MapPin size={28} color="#FFFFFF" fill="#EF4444" />
            </View>
          </View>

          {/* Confirmed address row */}
          <View style={styles.confirmedRow}>
            <Navigation size={18} color={colors.primary} fill={colors.primary} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.confirmedStreet} numberOfLines={1}>
                {addressLine1 || 'Selected Location'}
              </Text>
              <Text style={styles.confirmedFull} numberOfLines={2}>{addressText}</Text>
            </View>
            <TouchableOpacity
              onPress={() => { ReactNativeHapticFeedback.trigger('impactLight'); setShowDetails(false); }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.changeText}>Change</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Add Address</Text>
          <TextInput
            style={styles.input}
            placeholder="House No / Flat / Floor"
            placeholderTextColor="#9CA3AF"
            value={flatNumber}
            onChangeText={setFlatNumber}
            autoFocus
          />
          <TextInput
            style={styles.input}
            placeholder="Building & Block No. (Optional)"
            placeholderTextColor="#9CA3AF"
            value={buildingName}
            onChangeText={setBuildingName}
          />

          <Text style={styles.sectionTitle}>Add Label</Text>
          <View style={styles.labelRow}>
            {LABELS.map(l => {
              const active = label === l.key;
              return (
                <TouchableOpacity
                  key={l.key}
                  onPress={() => { ReactNativeHapticFeedback.trigger('selection'); setLabel(l.key); }}
                  style={[styles.chip, active && styles.chipActive]}
                  activeOpacity={0.8}
                >
                  <Text style={styles.chipIcon}>{l.icon}</Text>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{l.key}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>
      ) : (
        /* ── Step 1: Map Pin Picker ── */
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={StyleSheet.absoluteFill}
            initialRegion={{
              latitude: startLat,
              longitude: startLng,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            }}
            onPanDrag={onPanDrag}
            onRegionChangeComplete={r => onRegionChangeComplete(r)}
            showsUserLocation
            showsMyLocationButton={false}
            pitchEnabled={false}
            toolbarEnabled={false}
          />

          {/* Center pin — animates up on drag */}
          <View style={styles.centerPin} pointerEvents="none">
            <Animated.View style={animatedPin}>
              <View style={styles.pinShadow}>
                <MapPin size={32} color="#FFFFFF" fill="#EF4444" />
              </View>
            </Animated.View>
          </View>

          {/* Locate Me button */}
          <TouchableOpacity
            style={[styles.locateBtn, { bottom: 200 }]}
            onPress={() => {
              ReactNativeHapticFeedback.trigger('impactMedium');
              fetchLocation();
            }}
            activeOpacity={0.8}
          >
            {loadingLocation
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <><Navigation size={18} color={colors.primary} style={{ marginRight: 6 }} /><Text style={styles.locateText}>LOCATE ME</Text></>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* Bottom bar — always visible */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        {!showDetails && (
          <View style={styles.addressPreview}>
            <Navigation size={20} color={colors.primary} fill={colors.primary} style={{ marginRight: 14, marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.addressPreviewStreet} numberOfLines={1}>
                {isDragging ? 'Moving…' : (addressLine1 || (loadingLocation ? 'Locating…' : 'Drop pin on map'))}
              </Text>
              <Text style={styles.addressPreviewFull} numberOfLines={2}>
                {isDragging ? '' : addressText}
              </Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.btn, (!addressText || isDragging || isBusy) && styles.btnDisabled]}
          disabled={!addressText || isDragging || isBusy}
          onPress={showDetails ? handleSave : handleConfirm}
          activeOpacity={0.9}
        >
          {isBusy
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>{showDetails ? 'Save Address' : 'Confirm'}</Text>
          }
        </TouchableOpacity>
      </View>

      <AddressSearchModal
        visible={isSearchVisible}
        onClose={() => setIsSearchVisible(false)}
        onSelect={(lat, lon, name) => {
          setIsSearchVisible(false);
          // Animate map to searched location — doesn't trigger onPanDrag
          mapRef.current?.animateToRegion({
            latitude: lat,
            longitude: lon,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }, 500);
          setAddressText(name);
          setMapRegion({ latitude: lat, longitude: lon });
        }}
      />
    </View>
  );
};

export default AddressBookScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  headerTitle: { fontSize: 16, fontFamily: fontFamily.bold, color: '#1A1A2E' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    height: 48, backgroundColor: '#fff',
    borderRadius: 12, paddingHorizontal: 16,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  searchBarText: { color: '#9CA3AF', fontSize: 15, fontFamily: fontFamily.medium },

  // ── Map step ──
  mapContainer: { flex: 1 },
  centerPin: {
    position: 'absolute', top: '50%', left: '50%',
    marginTop: -40, marginLeft: -14, zIndex: 2,
  },
  pinShadow: {
    shadowColor: '#EF4444', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  locateBtn: {
    position: 'absolute', alignSelf: 'center',
    flexDirection: 'row', backgroundColor: '#fff',
    paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 100, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 6,
    borderWidth: 1, borderColor: '#E5E7EB', zIndex: 10,
  },
  locateText: { color: colors.primary, fontFamily: fontFamily.bold, fontSize: 13, letterSpacing: 0.5 },

  // ── Details step ──
  detailsScroll: { paddingHorizontal: 20, paddingTop: 0, paddingBottom: 40 },
  mapPreview: {
    width: '100%', height: 160,
    borderRadius: 16, overflow: 'hidden',
    marginBottom: 20,
    backgroundColor: '#E5E7EB',
  },
  mapPreviewPin: {
    position: 'absolute', top: '50%', left: '50%',
    marginTop: -28, marginLeft: -14, zIndex: 2,
  },
  confirmedRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 4, marginBottom: 20,
  },
  confirmedStreet: { fontSize: 16, fontFamily: fontFamily.bold, color: '#1A1A2E', marginBottom: 2 },
  confirmedFull: { fontSize: 13, fontFamily: fontFamily.regular, color: '#6B7280', lineHeight: 18 },
  changeText: { fontSize: 14, fontFamily: fontFamily.bold, color: colors.primary, marginLeft: 12 },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontFamily: fontFamily.bold, color: '#1A1A2E', marginBottom: 12 },
  input: {
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, fontFamily: fontFamily.medium, color: '#1A1A2E',
    marginBottom: 12,
  },
  labelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 100, borderWidth: 1, borderColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipIcon: { fontSize: 14 },
  chipText: { fontFamily: fontFamily.bold, fontSize: 13, color: '#6B7280' },
  chipTextActive: { color: '#fff' },

  // ── Bottom bar ──
  bottomBar: {
    backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 10,
  },
  addressPreview: {
    flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16,
  },
  addressPreviewStreet: { fontSize: 17, fontFamily: fontFamily.bold, color: '#1A1A2E', marginBottom: 2 },
  addressPreviewFull: { fontSize: 13, fontFamily: fontFamily.regular, color: '#6B7280', lineHeight: 18 },
  btn: {
    height: 54, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  btnDisabled: { backgroundColor: '#D1D5DB' },
  btnText: { color: '#fff', fontFamily: fontFamily.bold, fontSize: 16 },
});
