import { tokens } from '../theme/tokens';
import { MapPin, Navigation, Search, Home, Briefcase, Building } from 'lucide-react-native';
import React, { useState, useEffect, useRef } from 'react';
import { PressableScale } from '../components/ui/internal/PressableScale';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import {
  View, Text, ActivityIndicator, TextInput,
  StyleSheet, Alert, ScrollView,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { api } from '../api/client';
import { useDispatch, useSelector } from 'react-redux';
import { setAddress, setZone } from '../store/slices/cartSlice';
import { setServiceable, setUnserviceable } from '../store/slices/appSlice';
import { useLocation } from '../hooks/useLocation';
import { haptics } from "../utils/haptics";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { AddressSearchModal } from '../components/AddressSearchModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { reverseGeocodeDetailed } from '../utils/geocode';
import { RootState } from '../store';
import { useFeedback } from '../context/FeedbackContext';

const LABELS = [
  { key: 'Home',   Icon: Home },
  { key: 'Office', Icon: Briefcase },
  { key: 'PG',     Icon: Building },
  { key: 'Hostel', Icon: Building },
  { key: 'Other',  Icon: MapPin },
];

const AddressBookScreen = ({ navigation, route }: any) => {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { showDialog } = useFeedback();

  const { initialLat, initialLng, initialAddress, returnToCart } = route?.params || {};

  // Use Redux globalLocation as initial fallback — avoids black map / India center problem
  const savedLocation = useSelector((state: RootState) => state.app.globalLocation);

  const startLat = initialLat || savedLocation?.latitude || 20.5937;
  const startLng = initialLng || savedLocation?.longitude || 78.9629;

  const [label, setLabel] = useState('Home');
  const [addressText, setAddressText] = useState(
    initialAddress || savedLocation?.addressText || ''
  );
  const [addressFull, setAddressFull] = useState('');
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
  // Tracks whether user has manually moved the map — prevents GPS stage 2 from overriding their pin
  const userDraggedRef = useRef(false);

  const { location, loadingLocation, fetchLocation } = useLocation();

  const pinY = useSharedValue(0);
  const animatedPin = useAnimatedStyle(() => ({ transform: [{ translateY: pinY.value }] }));

  // If no initial coords from search, get GPS
  useEffect(() => {
    if (!initialLat && !initialLng) fetchLocation();
  }, []);

  // When GPS resolves, animate map to it — but not if the user already manually moved the pin
  useEffect(() => {
    if (location && !initialLat && !userDraggedRef.current) {
      mapRef.current?.animateToRegion({
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 800);
      // Always run a fresh geocode so addressFull is populated from Google
      reverseGeocodeDetailed(location.latitude, location.longitude).then(result => {
        setAddressText(result.name);
        setAddressFull(result.address);
      }).catch(() => {});
    }
  }, [location]);

  // onPanDrag fires ONLY on real user touch-drags — NOT on programmatic animateToRegion
  const onPanDrag = () => {
    userDraggedRef.current = true; // prevent GPS stage 2 from re-centering their pin
    if (!isDraggingRef.current) {
      isDraggingRef.current = true;
      setIsDragging(true);
      haptics.selection();
      pinY.value = withTiming(-20, { duration: 150 });
    }
  };

  const onRegionChangeComplete = async (r: any) => {
    const coords = { latitude: r.latitude, longitude: r.longitude };
    setMapRegion(coords);

    if (!isDraggingRef.current) return; // programmatic animation — ignore
    isDraggingRef.current = false;
    setIsDragging(false);
    pinY.value = withTiming(0, { duration: 200 });

    const result = await reverseGeocodeDetailed(coords.latitude, coords.longitude);
    setAddressText(result.name);
    setAddressFull(result.address);
  };

  const addMutation = useMutation({
    mutationFn: (data: any) => api.post('/customers/addresses', data),
    onSuccess: (res, variables) => {
      haptics.success();

      // Immediately seed the addresses cache so Cart shows the address the
      // instant it re-renders, without waiting for a network refetch.
      if (res?.address?.id) {
        queryClient.setQueryData(['addresses'], (old: any) => {
          const existing: any[] = old?.addresses ?? [];
          const withoutDupe = existing.filter((a: any) => a.id !== res.address.id);
          const newEntry = {
            ...res.address,
            is_serviceable: !!variables.zoneId,
            zone_name: null,
          };
          return { addresses: [...withoutDupe, newEntry] };
        });
        dispatch(setAddress(res.address.id));
      }

      // Background refetch to get server-computed is_serviceable from the JOIN
      queryClient.invalidateQueries({ queryKey: ['addresses'] });

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

      returnToCart ? navigation.goBack() : navigation.pop(2);
    },
    onError: () => {
      showDialog({
        title: 'Error',
        message: 'Could not save address. Please try again.',
        confirmText: 'Okay',
        type: 'error'
      });
    },
  });

  const handleConfirm = () => {
    haptics.selection();
    setShowDetails(true);
  };

  const handleSave = async () => {
    if (!flatNumber.trim()) {
      showDialog({
        title: 'Missing Details',
        message: 'Please enter your House / Flat number.',
        confirmText: 'Okay',
        type: 'warning'
      });
      return;
    }
    setIsChecking(true);
    let zoneId: string | null = null;
    try {
      const res = await api.get(`/menu/zones/check?lat=${mapRegion.latitude}&lng=${mapRegion.longitude}`);
      if (res.serviceable && res.zone?.id) zoneId = res.zone.id;
    } catch (e) { console.warn('[AddressBook] zone check failed — address saved without zone:', e); }

    const baseAddress = addressFull || addressText;
    const fullAddress = buildingName.trim()
      ? `${flatNumber.trim()}, ${buildingName.trim()}, ${baseAddress}`
      : `${flatNumber.trim()}, ${baseAddress}`;

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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <ScreenHeader
          title={showDetails ? 'Add address details' : 'Add delivery location'}
          style={{ paddingHorizontal: 0, paddingBottom: 12 }}
        />

        {!showDetails && (
          <PressableScale 
            style={styles.searchBar} 
            onPress={() => setIsSearchVisible(true)}
            accessibilityRole="search"
            accessibilityLabel="Search delivery location"
          >
            <Search size={20} color={tokens.colors.primary} style={{ marginRight: 12 }} />
            <Text allowFontScaling={false} style={styles.searchBarText}>Search delivery location</Text>
          </PressableScale>
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
              <MapPin size={28} color={tokens.colors.textInverse} fill={tokens.colors.danger} />
            </View>
          </View>

          {/* Confirmed address row */}
          <View style={styles.confirmedRow}>
            <Navigation size={18} color={tokens.colors.primary} fill={tokens.colors.primary} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text allowFontScaling={false} style={styles.confirmedStreet} numberOfLines={1}>
                {addressText || 'Selected Location'}
              </Text>
              <Text allowFontScaling={false} style={styles.confirmedFull} numberOfLines={2}>{addressFull || addressText}</Text>
            </View>
            <PressableScale
              onPress={() => { haptics.selection(); setShowDetails(false); }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Change selected location"
            >
              <Text allowFontScaling={false} style={styles.changeText}>Change</Text>
            </PressableScale>
          </View>

          <View style={styles.divider} />

          <Text allowFontScaling={false} style={styles.sectionTitle}>Add Address</Text>
          <TextInput
            style={styles.input}
            placeholder="House No / Flat / Floor"
            placeholderTextColor={tokens.colors.textTertiary}
            value={flatNumber}
            onChangeText={setFlatNumber}
            autoFocus
            accessibilityLabel="House or flat number"
          />
          <TextInput
            style={styles.input}
            placeholder="Building & Block No. (Optional)"
            placeholderTextColor={tokens.colors.textTertiary}
            value={buildingName}
            onChangeText={setBuildingName}
            accessibilityLabel="Building and block number"
          />

          <Text allowFontScaling={false} style={styles.sectionTitle}>Add Label</Text>
          <View style={styles.labelRow}>
            {LABELS.map(l => {
              const active = label === l.key;
              return (
                <PressableScale
                  key={l.key}
                  onPress={() => { haptics.selection(); setLabel(l.key); }}
                  style={[styles.chip, active && styles.chipActive]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={l.key}
                >
                  <l.Icon size={16} color={active ? tokens.colors.textInverse : tokens.colors.textSecondary} />
                  <Text allowFontScaling={false} style={[styles.chipText, active && styles.chipTextActive]}>{l.key}</Text>
                </PressableScale>
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
            userInterfaceStyle="light"
            customMapStyle={[]}
          />

          {/* Center pin — animates up on drag */}
          <View style={styles.centerPin} pointerEvents="none">
            <Animated.View style={animatedPin}>
              <View style={styles.pinShadow}>
                <MapPin size={32} color={tokens.colors.textInverse} fill={tokens.colors.danger} />
              </View>
            </Animated.View>
          </View>

          {/* Locate Me button */}
          <PressableScale
            style={[styles.locateBtn, { bottom: 16 }]}
            onPress={() => {
              userDraggedRef.current = false; // allow GPS to re-center when user explicitly asks
              haptics.selection();
              fetchLocation();
            }}
            accessibilityRole="button"
            accessibilityLabel="Locate me using GPS"
          >
            {loadingLocation
              ? <ActivityIndicator size="small" color={tokens.colors.primary} />
              : <><Navigation size={18} color={tokens.colors.primary} style={{ marginRight: 6 }} /><Text allowFontScaling={false} style={styles.locateText}>LOCATE ME</Text></>
            }
          </PressableScale>
        </View>
      )}

      {/* Bottom bar — always visible */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        {!showDetails && (
          <View style={styles.addressPreview}>
            <Navigation size={20} color={tokens.colors.primary} fill={tokens.colors.primary} style={{ marginRight: 14, marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text allowFontScaling={false} style={styles.addressPreviewStreet} numberOfLines={1}>
                {isDragging ? 'Moving…' : (addressText || (loadingLocation ? 'Locating…' : 'Drop pin on map'))}
              </Text>
              <Text allowFontScaling={false} style={styles.addressPreviewFull} numberOfLines={2}>
                {isDragging ? '' : (addressFull || addressText)}
              </Text>
            </View>
          </View>
        )}

        <PressableScale
          style={[styles.btn, (!addressText || isDragging || isBusy) && styles.btnDisabled]}
          disabled={!addressText || isDragging || isBusy}
          onPress={showDetails ? handleSave : handleConfirm}
          accessibilityRole="button"
          accessibilityLabel={showDetails ? 'Save Address' : 'Confirm address location'}
        >
          {isBusy
            ? <ActivityIndicator color={tokens.colors.textInverse} />
            : <Text allowFontScaling={false} style={styles.btnText}>{showDetails ? 'Save Address' : 'Confirm'}</Text>
          }
        </PressableScale>
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
  container: { flex: 1, backgroundColor: tokens.colors.surface },

  header: {
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.md,
    zIndex: 10,
    ...tokens.shadows.soft,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    height: 48, backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.full, paddingHorizontal: tokens.spacing.lg,
    borderWidth: 1, borderColor: tokens.colors.border,
  },
  searchBarText: { color: tokens.colors.textTertiary, fontSize: 15, fontFamily: tokens.typography.family.medium },

  // ── Map step ──
  mapContainer: { flex: 1 },
  centerPin: {
    position: 'absolute', top: '50%', left: '50%',
    marginTop: -40, marginLeft: -14, zIndex: 2,
  },
  pinShadow: {
    shadowColor: tokens.colors.danger, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 8,
  },
  locateBtn: {
    position: 'absolute', alignSelf: 'center',
    flexDirection: 'row', backgroundColor: tokens.colors.surface,
    paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 100, alignItems: 'center',
    ...tokens.shadows.soft,
    borderWidth: 1, borderColor: tokens.colors.border, zIndex: 10,
  },
  locateText: { color: tokens.colors.primary, fontFamily: tokens.typography.family.bold, fontSize: 13, letterSpacing: 0.5 },

  // ── Details step ──
  detailsScroll: { paddingHorizontal: tokens.spacing.xl, paddingTop: 0, paddingBottom: 40 },
  mapPreview: {
    width: '100%', height: 160,
    borderRadius: tokens.radii.xl, overflow: 'hidden',
    marginBottom: tokens.spacing.xl,
    backgroundColor: tokens.colors.border,
  },
  mapPreviewPin: {
    position: 'absolute', top: '50%', left: '50%',
    marginTop: -28, marginLeft: -14, zIndex: 2,
  },
  confirmedRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 4, marginBottom: tokens.spacing.xl,
  },
  confirmedStreet: { fontSize: 16, fontFamily: tokens.typography.family.bold, color: tokens.colors.textPrimary, marginBottom: 2 },
  confirmedFull: { fontSize: 13, fontFamily: tokens.typography.family.regular, color: tokens.colors.textSecondary, lineHeight: 18 },
  changeText: { fontSize: 14, fontFamily: tokens.typography.family.bold, color: tokens.colors.primary, marginLeft: 12 },
  divider: { height: 1, backgroundColor: tokens.colors.background, marginBottom: tokens.spacing.xl },
  sectionTitle: { fontSize: 16, fontFamily: tokens.typography.family.bold, color: tokens.colors.textPrimary, marginBottom: tokens.spacing.md },
  input: {
    backgroundColor: tokens.colors.background, borderWidth: 1, borderColor: tokens.colors.border,
    borderRadius: tokens.radii.xl, paddingHorizontal: tokens.spacing.lg, paddingVertical: 14,
    fontSize: 15, fontFamily: tokens.typography.family.medium, color: tokens.colors.textPrimary,
    marginBottom: tokens.spacing.md,
  },
  labelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 100, borderWidth: 1, borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
  },
  chipActive: { backgroundColor: tokens.colors.primary, borderColor: tokens.colors.primary },
  chipIcon: { fontSize: 14 },
  chipText: { fontFamily: tokens.typography.family.bold, fontSize: 13, color: tokens.colors.textSecondary },
  chipTextActive: { color: tokens.colors.textInverse },

  // ── Bottom bar ──
  bottomBar: {
    backgroundColor: tokens.colors.surface, paddingHorizontal: tokens.spacing.xl, paddingTop: tokens.spacing.lg,
    ...tokens.shadows.soft,
  },
  addressPreview: {
    flexDirection: 'row', alignItems: 'flex-start', marginBottom: tokens.spacing.lg,
  },
  addressPreviewStreet: { fontSize: 17, fontFamily: tokens.typography.family.bold, color: tokens.colors.textPrimary, marginBottom: 2 },
  addressPreviewFull: { fontSize: 13, fontFamily: tokens.typography.family.regular, color: tokens.colors.textSecondary, lineHeight: 18 },
  btn: {
    height: 54, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: tokens.colors.primary,
  },
  btnDisabled: { backgroundColor: tokens.colors.border },
  btnText: { color: tokens.colors.textInverse, fontFamily: tokens.typography.family.bold, fontSize: 16 },
});
