import { tokens } from '../theme/tokens';
import { PermissionsAndroid } from 'react-native';
import {
  Home, Briefcase, MapPin, Navigation, Plus, Trash2, Search,
} from 'lucide-react-native';
import React, { useState } from 'react';
import { Button } from '../components/ui/Button';
import { ListItem } from '../components/ui/ListItem';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { PressableScale } from '../components/ui/internal/PressableScale';
import {
  View, Text, ScrollView, ActivityIndicator, Alert,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDispatch, useSelector } from 'react-redux';
import Geolocation from '@react-native-community/geolocation';
import { api } from '../api/client';
import { setAddress, setZone } from '../store/slices/cartSlice';
import { setServiceable, setUnserviceable, setGlobalLocation } from '../store/slices/appSlice';
import { reverseGeocode } from '../utils/geocode';
import { AddressSearchModal } from '../components/AddressSearchModal';
import { haptics } from '../utils/haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFeedback } from '../context/FeedbackContext';

const AddressIcon = ({ label, serviceable }: { label: string; serviceable: boolean }) => {
  const color = serviceable ? tokens.colors.primary : tokens.colors.textTertiary;
  if (label === 'Home') return <Home size={20} color={color} />;
  if (label === 'Work') return <Briefcase size={20} color={color} />;
  return <MapPin size={20} color={color} />;
};

const AddressScreen = ({ navigation, route }: any) => {
  const isFromCheckout = route?.params?.fromCheckout;
  const returnToCart = route?.params?.returnToCart;
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const { showDialog } = useFeedback();
  const insets = useSafeAreaInsets();

  const [searchVisible, setSearchVisible] = useState(false);
  const [gpsChecking, setGpsChecking] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const currentAddressId = useSelector((state: any) => state.cart.addressId);

  const { data: addresses, isLoading, isError, refetch } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => api.get('/customers/addresses'),
    staleTime: 0,       // always re-fetch on mount so zone status is current
    gcTime: 0,          // don't serve inactive-zone data from cache
    retry: 1,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/customers/addresses/${id}`),
    onSuccess: () => {
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
    },
  });

  const handleDelete = (addr: any) => {
    showDialog({
      title: 'Remove Address',
      message: `Remove "${addr.label}"?`,
      confirmText: 'Remove',
      cancelText: 'Cancel',
      type: 'warning',
      onConfirm: () => deleteMutation.mutate(addr.id)
    });
  };

  const selectAddress = async (addr: any) => {
    // Haptic now fires from ListItem's own `haptic="selection"` prop, not here.
    setSelectingId(addr.id);
    const addrLocation = { latitude: addr.lat, longitude: addr.lng, addressText: addr.address_text };
    try {
      // Always re-verify zone by coordinates — stored zone_id may be stale
      const res = await api.get(`/menu/zones/check?lat=${addr.lat}&lng=${addr.lng}`);
      dispatch(setAddress(addr.id));
      if (res.serviceable && res.zone?.id) {
        dispatch(setZone(res.zone.id));
        // Pass location so globalLocation is updated to this address — fixes cold-boot zone check
        dispatch(setServiceable({ zoneId: res.zone.id, zoneName: res.zone.name || null, location: addrLocation }));
        queryClient.invalidateQueries({ queryKey: ['menu'] });
      } else {
        dispatch(setZone(null));
        dispatch(setUnserviceable(addrLocation));
      }
    } catch {
      // Network error — cannot verify zone status, so treat as unserviceable.
      // Stored zone_id may be stale (zone could have been deactivated since save).
      dispatch(setAddress(addr.id));
      dispatch(setZone(null));
      dispatch(setUnserviceable(addrLocation));
    } finally {
      setSelectingId(null);
      if (navigation.canGoBack?.()) {
        navigation.goBack();
      }
    }
  };

  const handleUseCurrentLocation = async () => {
    haptics.selection(); // a real, deliberate choice — not a plain nav tap

    if (isFromCheckout) {
      // Redirect to map pin picker to enforce a real address entry for checkout
      navigation.push('AddressBook', { returnToCart: returnToCart || true });
      return;
    }

    setGpsChecking(true);
    
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          setGpsChecking(false);
          showDialog({ title: 'Permission Denied', message: 'Location permission is required.', confirmText: 'Okay', type: 'error' });
          return;
        }
      } catch (err) {
        setGpsChecking(false);
        return;
      }
    } else {
      Geolocation.requestAuthorization();
    }

    let timeoutId: any;
    const explicitTimeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('TIMEOUT')), 15000);
    });

    const gpsPromise = new Promise((resolve, reject) => {
      // Changed enableHighAccuracy to false to prevent timeouts indoors on Android
      Geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 });
    });

    Promise.race([gpsPromise, explicitTimeout])
      .then(async (pos: any) => {
        clearTimeout(timeoutId);
        const { latitude, longitude } = pos.coords;
        try {
          const [addressText, res] = await Promise.all([
            reverseGeocode(latitude, longitude),
            api.get(`/menu/zones/check?lat=${latitude}&lng=${longitude}`),
          ]);
          const location = { latitude, longitude, addressText };
          dispatch(setGlobalLocation(location));
          if (res.serviceable && res.zone?.id) {
            dispatch(setZone(res.zone.id));
            dispatch(setServiceable({ zoneId: res.zone.id, zoneName: res.zone.name || null, location }));
            queryClient.invalidateQueries({ queryKey: ['menu'] });
          } else {
            dispatch(setZone(null));
            dispatch(setUnserviceable(location));
          }
          dispatch(setAddress('gps'));
          if (navigation.canGoBack?.()) {
            navigation.goBack();
          }
        } catch (e: any) {
          console.warn('[AddressScreen] server check error:', e);
          showDialog({ title: 'Error', message: 'Could not verify location with server.', confirmText: 'Okay', type: 'error' });
        } finally {
          setGpsChecking(false);
        }
      })
      .catch(() => {
        clearTimeout(timeoutId);
        setGpsChecking(false);
        showDialog({ title: 'Location Error', message: 'Could not detect your location in time. Please check if your GPS is enabled.', confirmText: 'Okay', type: 'error' });
      });
  };

  const savedList = addresses?.addresses || [];
  const selectedAddr = savedList.find((a: any) => a.id === currentAddressId);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.root}>

        <ScreenHeader title="Select a location" />

        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          {/* Search bar — custom pill shape, PressableScale used directly (Button's fixed
              variants don't fit this affordance) */}
          <PressableScale 
            style={styles.searchBar} 
            onPress={() => setSearchVisible(true)}
            accessibilityRole="search"
            accessibilityLabel="Search location"
          >
            <Search size={20} color={tokens.colors.primary} />
            <Text style={styles.searchPlaceholder} allowFontScaling maxFontSizeMultiplier={1.4}>Search location</Text>
          </PressableScale>

          {/* Selected Address Display */}
          <View style={styles.selectedAddressSection}>
            <Text style={styles.selectedAddressTitle} allowFontScaling maxFontSizeMultiplier={1.4}>Selected Address</Text>
            <Text style={styles.selectedAddressText} numberOfLines={2} allowFontScaling maxFontSizeMultiplier={1.4}>
              {currentAddressId === 'gps' ? 'Current GPS Location' : (selectedAddr?.address_text || "Choose a location below")}
            </Text>

            <PressableScale
              style={styles.useCurrentLocationBtn}
              onPress={handleUseCurrentLocation}
              disabled={gpsChecking}
              accessibilityRole="button"
              accessibilityLabel="Use current location"
            >
              {gpsChecking ? (
                <ActivityIndicator size="small" color={tokens.colors.primary} style={{ marginRight: tokens.spacing.sm }} />
              ) : (
                <Navigation size={18} color={tokens.colors.primary} style={{ marginRight: tokens.spacing.sm }} />
              )}
              <Text style={styles.useCurrentLocationText} allowFontScaling maxFontSizeMultiplier={1.4}>Use current location</Text>
            </PressableScale>
          </View>

          {/* Saved addresses */}
          {isLoading ? (
            <ActivityIndicator color={tokens.colors.primary} style={{ marginTop: tokens.spacing.xxxl }} />
          ) : isError ? (
            <View style={{ alignItems: 'center', marginTop: tokens.spacing.xxxl, gap: tokens.spacing.md }}>
              <Text style={{ fontSize: 14, color: tokens.colors.textSecondary, textAlign: 'center' }} allowFontScaling maxFontSizeMultiplier={1.4}>
                Could not load saved addresses.
              </Text>
              <Button
                label="Retry"
                variant="outline"
                size="sm"
                fullWidth={false}
                onPress={() => refetch()}
              />
            </View>
          ) : savedList.length > 0 && (
            <View style={styles.savedAddressesContainer}>
              <Text style={styles.sectionLabel} allowFontScaling maxFontSizeMultiplier={1.4}>SAVED ADDRESSES</Text>
              {savedList.map((addr: any, i: number) => (
                <Animated.View key={addr.id} entering={FadeInDown.delay(i * 40).duration(250)}>
                  <ListItem
                    title={addr.label}
                    subtitle={[addr.flat_number, addr.building_name, addr.address_text].filter(Boolean).join(', ')}
                    onPress={() => selectAddress(addr)}
                    haptic="selection" // a real selection commit — keep
                    disabled={selectingId !== null || !addr.is_serviceable}
                    style={{ marginBottom: tokens.spacing.md, borderRadius: tokens.radii.lg, borderWidth: 1.5, borderColor: tokens.colors.border }}
                    leftAdornment={
                      <View style={[styles.addrIconBox, { backgroundColor: addr.is_serviceable ? tokens.colors.primaryTint : tokens.colors.surface }]}>
                        <AddressIcon label={addr.label} serviceable={addr.is_serviceable} />
                      </View>
                    }
                    rightAdornment={
                      selectingId === addr.id ? (
                        <ActivityIndicator size="small" color={tokens.colors.primary} />
                      ) : (
                        <PressableScale
                          onPress={() => handleDelete(addr)}
                          disabled={selectingId !== null}
                          style={styles.deleteBtn}
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${addr.label}`}
                          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        >
                          <Trash2 size={20} color={tokens.colors.danger} />
                        </PressableScale>
                      )
                    }
                  />
                </Animated.View>
              ))}
            </View>
          )}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Add new address button at bottom — pure navigation, no haptic */}
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <Button
            label="Add new address"
            icon={<Plus size={20} color={tokens.colors.textInverse} />}
            onPress={() => navigation.push('AddressBook')}
            variant="primary"
            size="lg"
          />
        </View>

        <AddressSearchModal
          visible={searchVisible}
          onClose={() => setSearchVisible(false)}
          onSelect={(lat, lon, name) => {
            setSearchVisible(false);
            setTimeout(() => {
              navigation.push('AddressBook', { initialLat: lat, initialLng: lon, initialAddress: name });
            }, 100);
          }}
        />
      </View>
    </KeyboardAvoidingView>
  );
};

export default AddressScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.colors.background },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: tokens.spacing.xl, paddingTop: tokens.spacing.lg },

  // Search matching Screenshot 3
  searchBar: {
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: tokens.spacing.md,
    backgroundColor: tokens.colors.background, 
    borderRadius: tokens.radii.full,
    paddingHorizontal: tokens.spacing.lg, 
    paddingVertical: tokens.spacing.lg,
    borderWidth: 1, 
    borderColor: tokens.colors.border,
    marginBottom: tokens.spacing.xxl,
  },
  searchPlaceholder: { 
    flex: 1, 
    fontSize: tokens.typography.size.body, 
    fontFamily: tokens.typography.family.medium, 
    color: tokens.colors.textTertiary 
  },

  // Selected Address Section
  selectedAddressSection: {
    marginBottom: tokens.spacing.xxxl,
  },
  selectedAddressTitle: {
    fontSize: tokens.typography.size.bodyLarge,
    fontFamily: tokens.typography.family.bold,
    color: tokens.colors.textPrimary,
    marginBottom: tokens.spacing.sm,
  },
  selectedAddressText: {
    fontSize: tokens.typography.size.body,
    fontFamily: tokens.typography.family.medium,
    color: tokens.colors.textSecondary,
    lineHeight: 20,
    marginBottom: tokens.spacing.lg,
  },
  useCurrentLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.spacing.lg,
    borderRadius: tokens.radii.full,
    borderWidth: 1,
    borderColor: tokens.colors.primaryTint,
    backgroundColor: tokens.colors.background,
  },
  useCurrentLocationText: {
    color: tokens.colors.primary,
    fontSize: tokens.typography.size.body,
    fontFamily: tokens.typography.family.bold,
  },

  savedAddressesContainer: {
    marginTop: tokens.spacing.sm,
  },
  sectionLabel: {
    fontSize: 11, 
    fontFamily: tokens.typography.family.extrabold, 
    color: tokens.colors.textTertiary,
    letterSpacing: 1.2, 
    marginBottom: tokens.spacing.lg,
  },

  addrIconBox: {
    width: 44, 
    height: 44, 
    borderRadius: tokens.radii.full,
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: tokens.spacing.lg,
  },
  deleteBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Bottom bar
  bottomBar: {
    backgroundColor: tokens.colors.background,
    paddingHorizontal: tokens.spacing.xl,
    paddingTop: tokens.spacing.lg,
  },
});
