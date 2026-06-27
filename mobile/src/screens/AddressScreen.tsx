import {
  ArrowLeft, Home, Briefcase, MapPin, Navigation, Plus, Trash2, Search, ChevronRight, CheckCircle2,
} from 'lucide-react-native';
import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
  StyleSheet, TextInput, KeyboardAvoidingView, Platform, Dimensions
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDispatch, useSelector } from 'react-redux';
import Geolocation from '@react-native-community/geolocation';
import { api } from '../api/client';
import { setAddress, setZone } from '../store/slices/cartSlice';
import { setServiceable, setUnserviceable } from '../store/slices/appSlice';
import { AddressSearchModal } from '../components/AddressSearchModal';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

const triggerHaptic = (type = 'impactLight') =>
  ReactNativeHapticFeedback.trigger(type as any, { enableVibrateFallback: true });

const AddressIcon = ({ label, serviceable }: { label: string; serviceable: boolean }) => {
  const color = serviceable ? colors.primary : colors.inkFaint;
  if (label === 'Home') return <Home size={20} color={color} />;
  if (label === 'Work') return <Briefcase size={20} color={color} />;
  return <MapPin size={20} color={color} />;
};

const AddressScreen = ({ navigation }: any) => {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [searchVisible, setSearchVisible] = useState(false);
  const [gpsChecking, setGpsChecking] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const currentAddressId = useSelector((state: any) => state.cart.addressId);

  const { data: addresses, isLoading } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => api.get('/customers/addresses'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/customers/addresses/${id}`),
    onSuccess: () => {
      triggerHaptic('notificationSuccess');
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
    },
  });

  const confirmDelete = (addr: any) => {
    Alert.alert('Remove Address', `Remove "${addr.label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deleteMutation.mutate(addr.id) },
    ]);
  };

  const selectAddress = async (addr: any) => {
    triggerHaptic('impactMedium');
    setSelectingId(addr.id);
    try {
      // Always re-verify zone by coordinates — stored zone_id may be stale or wrong
      const res = await api.get(`/menu/zones/check?lat=${addr.lat}&lng=${addr.lng}`);
      dispatch(setAddress(addr.id));
      if (res.serviceable && res.zone?.id) {
        dispatch(setZone(res.zone.id));
        dispatch(setServiceable({ zoneId: res.zone.id, zoneName: res.zone.name || null }));
        queryClient.invalidateQueries({ queryKey: ['menu'] });
      } else {
        dispatch(setZone(null));
        dispatch(setUnserviceable({ latitude: addr.lat, longitude: addr.lng, addressText: addr.address_text }));
      }
    } catch {
      // Network error — fall back to stored zone
      dispatch(setAddress(addr.id));
      if (addr.zone_id) {
        dispatch(setZone(addr.zone_id));
        dispatch(setServiceable({ zoneId: addr.zone_id, zoneName: addr.zone_name || null }));
        queryClient.invalidateQueries({ queryKey: ['menu'] });
      } else {
        dispatch(setZone(null));
        dispatch(setUnserviceable({ latitude: addr.lat, longitude: addr.lng, addressText: addr.address_text }));
      }
    } finally {
      setSelectingId(null);
      navigation.goBack();
    }
  };

  const handleUseCurrentLocation = () => {
    triggerHaptic('impactMedium');
    setGpsChecking(true);
    Geolocation.requestAuthorization();
    
    Geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await api.get(`/menu/zones/check?lat=${latitude}&lng=${longitude}`);
          if (res.serviceable && res.zone?.id) {
            dispatch(setZone(res.zone.id));
            dispatch(setServiceable({ zoneId: res.zone.id, zoneName: res.zone.name || null }));
            queryClient.invalidateQueries({ queryKey: ['menu'] });
          } else {
            dispatch(setZone(null));
            dispatch(setUnserviceable({ latitude, longitude, addressText: 'Current Location' }));
          }
          dispatch(setAddress('gps'));
          navigation.goBack();
        } catch {
           Alert.alert('Error', 'Could not verify location.');
        } finally {
          setGpsChecking(false);
        }
      },
      () => {
        setGpsChecking(false);
        Alert.alert('Location Error', 'Could not detect your location. Please check if your GPS is enabled.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  };

  const savedList = addresses?.addresses || [];
  const selectedAddr = savedList.find((a: any) => a.id === currentAddressId);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.root, { paddingTop: Math.max(insets.top, 20) }]}>

        {/* Clean Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <ArrowLeft size={22} color={colors.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select a location</Text>
        </View>

        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          {/* Search bar matching Screenshot 3 */}
          <TouchableOpacity style={styles.searchBar} onPress={() => setSearchVisible(true)} activeOpacity={0.9}>
            <Search size={20} color={colors.primary} />
            <Text style={styles.searchPlaceholder}>Search location</Text>
          </TouchableOpacity>

          {/* Selected Address Display */}
          <View style={styles.selectedAddressSection}>
            <Text style={styles.selectedAddressTitle}>Selected Address</Text>
            <Text style={styles.selectedAddressText} numberOfLines={2}>
              {currentAddressId === 'gps' ? 'Current GPS Location' : (selectedAddr?.address_text || "Choose a location below")}
            </Text>
            
            <TouchableOpacity
              style={styles.useCurrentLocationBtn}
              onPress={handleUseCurrentLocation}
              disabled={gpsChecking}
              activeOpacity={0.8}
            >
              {gpsChecking ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />
              ) : (
                <Navigation size={18} color={colors.primary} style={{ marginRight: 8 }} />
              )}
              <Text style={styles.useCurrentLocationText}>Use current location</Text>
            </TouchableOpacity>
          </View>

          {/* Saved addresses */}
          {isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
          ) : savedList.length > 0 && (
            <View style={styles.savedAddressesContainer}>
              <Text style={styles.sectionLabel}>SAVED ADDRESSES</Text>
              {savedList.map((addr: any, i: number) => (
                <Animated.View key={addr.id} entering={FadeInDown.delay(i * 40).duration(250)}>
                  <TouchableOpacity
                    style={[styles.addrCard, !addr.is_serviceable && styles.addrCardDisabled]}
                    onPress={() => selectAddress(addr)}
                    activeOpacity={0.85}
                    disabled={selectingId !== null}
                  >
                    <View style={[
                      styles.addrIconBox,
                      { backgroundColor: addr.is_serviceable ? colors.primaryTint : colors.surfaceMuted },
                    ]}>
                      <AddressIcon label={addr.label} serviceable={addr.is_serviceable} />
                    </View>

                    <View style={styles.addrInfo}>
                      <View style={styles.addrTopRow}>
                        <Text style={styles.addrLabel}>{addr.label}</Text>
                        <View style={[
                          styles.badge,
                          { backgroundColor: addr.is_serviceable ? colors.primaryTint : colors.surfaceMuted },
                        ]}>
                          <Text style={[
                            styles.badgeText,
                            { color: addr.is_serviceable ? colors.primary : colors.inkMuted },
                          ]}>
                            {addr.is_serviceable ? '✓ Deliverable' : 'Out of zone'}
                          </Text>
                        </View>
                      </View>
                      {(addr.flat_number || addr.building_name) && (
                        <Text style={styles.addrDetail} numberOfLines={1}>
                          {[addr.flat_number, addr.building_name].filter(Boolean).join(', ')}
                        </Text>
                      )}
                      <Text style={styles.addrText} numberOfLines={2}>{addr.address_text}</Text>
                    </View>

                    {selectingId === addr.id ? (
                      <ActivityIndicator size="small" color={colors.primary} style={styles.deleteBtn} />
                    ) : (
                      <TouchableOpacity
                        onPress={() => confirmDelete(addr)}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        style={styles.deleteBtn}
                      >
                        <Trash2 size={18} color={colors.danger} />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>
          )}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Add new address button at bottom */}
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => { 
              triggerHaptic(); 
              // Navigate to the new map picker
              navigation.navigate('AddressBook'); 
            }}
            activeOpacity={0.9}
          >
            <Plus size={20} color={colors.white} />
            <Text style={styles.addBtnText}>Add new address</Text>
          </TouchableOpacity>
        </View>

        <AddressSearchModal
          visible={searchVisible}
          onClose={() => setSearchVisible(false)}
          onSelect={(lat, lon, name) => {
            setSearchVisible(false);
            setTimeout(() => {
              navigation.navigate('AddressBook', { initialLat: lat, initialLng: lon, initialAddress: name });
            }, 100);
          }}
        />
      </View>
    </KeyboardAvoidingView>
  );
};

export default AddressScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },

  header: {
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingBottom: 16,
    backgroundColor: '#fff',
  },
  backBtn: {
    width: 36, 
    height: 36, 
    borderRadius: 18,
    backgroundColor: '#F9FAFB', 
    alignItems: 'center', 
    justifyContent: 'center',
    marginRight: 16,
  },
  headerTitle: { 
    fontSize: 18, 
    fontFamily: fontFamily.bold, 
    color: '#1A1A2E' 
  },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16 },

  // Search matching Screenshot 3
  searchBar: {
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12,
    backgroundColor: '#fff', 
    borderRadius: 12,
    paddingHorizontal: 16, 
    paddingVertical: 14,
    borderWidth: 1, 
    borderColor: '#E5E7EB',
    marginBottom: 24,
  },
  searchPlaceholder: { 
    flex: 1, 
    fontSize: 15, 
    fontFamily: fontFamily.medium, 
    color: '#9CA3AF' 
  },

  // Selected Address Section
  selectedAddressSection: {
    marginBottom: 32,
  },
  selectedAddressTitle: {
    fontSize: 16,
    fontFamily: fontFamily.bold,
    color: '#1A1A2E',
    marginBottom: 6,
  },
  selectedAddressText: {
    fontSize: 14,
    fontFamily: fontFamily.medium,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 16,
  },
  useCurrentLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary + '40',
    backgroundColor: colors.white,
  },
  useCurrentLocationText: {
    color: colors.primary,
    fontSize: 15,
    fontFamily: fontFamily.bold,
  },

  savedAddressesContainer: {
    marginTop: 8,
  },
  sectionLabel: {
    fontSize: 11, 
    fontFamily: fontFamily.extrabold, 
    color: '#9CA3AF',
    letterSpacing: 1.2, 
    marginBottom: 16,
  },

  // Address cards
  addrCard: {
    flexDirection: 'row', 
    alignItems: 'center',
    backgroundColor: '#fff', 
    borderRadius: 16,
    padding: 16, 
    marginBottom: 12,
    borderWidth: 1, 
    borderColor: '#F3F4F6',
  },
  addrCardDisabled: { opacity: 0.6 },
  addrIconBox: {
    width: 44, 
    height: 44, 
    borderRadius: 12,
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: 14,
  },
  addrInfo: { flex: 1 },
  addrTopRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    marginBottom: 4 
  },
  addrLabel: { 
    fontSize: 15, 
    fontFamily: fontFamily.bold, 
    color: '#1A1A2E' 
  },
  badge: { 
    paddingHorizontal: 8, 
    paddingVertical: 3, 
    borderRadius: 20 
  },
  badgeText: { 
    fontSize: 10, 
    fontFamily: fontFamily.bold 
  },
  addrDetail: {
    fontSize: 13,
    fontFamily: fontFamily.semibold,
    color: '#374151',
    marginBottom: 2,
  },
  addrText: {
    fontSize: 13,
    fontFamily: fontFamily.regular,
    color: '#6B7280',
    lineHeight: 18
  },
  deleteBtn: { padding: 8 },

  // Bottom bar
  bottomBar: {
    backgroundColor: '#fff', 
    paddingHorizontal: 20, 
    paddingTop: 16,
  },
  addBtn: {
    backgroundColor: colors.primary, 
    borderRadius: 14,
    paddingVertical: 16, 
    flexDirection: 'row',
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 8,
  },
  addBtnText: { 
    fontSize: 16, 
    fontFamily: fontFamily.bold, 
    color: colors.white 
  },
});
