import {
  ArrowLeft, Home, Briefcase, MapPin, Navigation, Plus, Trash2, Search, ChevronRight, CheckCircle2,
} from 'lucide-react-native';
import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
  StyleSheet, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
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

const triggerHaptic = (type = 'impactLight') =>
  ReactNativeHapticFeedback.trigger(type as any, { enableVibrateFallback: true });

type PendingLocation = {
  lat: number;
  lng: number;
  addressText: string;
  zoneId: string;
  zoneName: string | null;
};

const LABELS = ['Home', 'Work', 'Other'] as const;
type Label = typeof LABELS[number];

const LabelIcon = ({ label, active }: { label: string; active: boolean }) => {
  const color = active ? colors.white : colors.inkMuted;
  const size = 15;
  if (label === 'Home') return <Home size={size} color={color} />;
  if (label === 'Work') return <Briefcase size={size} color={color} />;
  return <MapPin size={size} color={color} />;
};

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

  const [pending, setPending] = useState<PendingLocation | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<Label>('Home');
  const [houseNo, setHouseNo] = useState('');
  const [buildingArea, setBuildingArea] = useState('');
  const [landmark, setLandmark] = useState('');
  const [saving, setSaving] = useState(false);

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
    onError: () => Alert.alert('Error', 'Could not delete address.'),
  });

  const confirmDelete = (addr: any) => {
    Alert.alert('Remove Address', `Remove "${addr.label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deleteMutation.mutate(addr.id) },
    ]);
  };

  const selectAddress = (addr: any) => {
    triggerHaptic('impactMedium');
    if (!addr.is_serviceable) {
      Alert.alert('Not Serviceable', "We don't deliver to this location yet.");
      return;
    }
    dispatch(setAddress(addr.id));
    dispatch(setZone(addr.zone_id));
    dispatch(setServiceable({ zoneId: addr.zone_id, zoneName: addr.zone_name || null }));
    queryClient.invalidateQueries({ queryKey: ['menu'] });
    navigation.goBack();
  };

  const openSaveForm = (loc: PendingLocation) => {
    setPending(loc);
    setHouseNo('');
    setBuildingArea(loc.addressText);
    setLandmark('');
    setSelectedLabel('Home');
    triggerHaptic('impactMedium');
  };

  const checkAndOpenForm = async (lat: number, lng: number, addressText: string) => {
    setGpsChecking(true);
    try {
      const res = await api.get(`/menu/zones/check?lat=${lat}&lng=${lng}`);
      if (res.serviceable && res.zone?.id) {
        openSaveForm({ lat, lng, addressText, zoneId: res.zone.id, zoneName: res.zone.name || null });
      } else {
        dispatch(setUnserviceable({ latitude: lat, longitude: lng, addressText }));
        Alert.alert('Out of Delivery Zone', "We're not delivering to that location yet. Try a nearby area.");
      }
    } catch {
      Alert.alert('Error', 'Could not check serviceability. Please try again.');
    } finally {
      setGpsChecking(false);
    }
  };

  const handleUseCurrentLocation = () => {
    triggerHaptic('impactMedium');
    setGpsChecking(true);
    Geolocation.requestAuthorization();
    
    const successCallback = async (pos: any) => {
      const { latitude, longitude } = pos.coords;
      try {
        const geo = await api.get(`/menu/geocode/reverse?lat=${latitude}&lng=${longitude}`);
        const a = geo?.address || {};
        let addressText = geo?.display_name || 'Current Location';
        if (addressText.endsWith(', India')) {
          addressText = addressText.replace(', India', '');
        }
        await checkAndOpenForm(latitude, longitude, addressText);
      } catch {
        await checkAndOpenForm(latitude, longitude, 'Current Location');
      }
    };

    Geolocation.getCurrentPosition(
      successCallback,
      (err) => {
        console.log('High accuracy GPS failed, falling back to low accuracy', err);
        Geolocation.getCurrentPosition(
          successCallback,
          () => {
            setGpsChecking(false);
            Alert.alert('Location Error', 'Could not detect your location. Please check if your GPS is enabled and try again.');
          },
          { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  };

  const handleSearchSelect = async (lat: number, lon: number, displayName: string) => {
    setSearchVisible(false);
    await checkAndOpenForm(lat, lon, displayName);
  };

  const handleSaveAndDeliver = async () => {
    if (!pending || !houseNo.trim()) {
      Alert.alert('Missing Details', 'Please enter your house / flat number.');
      return;
    }
    const parts = [
      houseNo.trim(),
      buildingArea.trim(),
      landmark.trim() ? `Near ${landmark.trim()}` : '',
    ].filter(Boolean);
    const composedAddress = parts.join(', ');
    setSaving(true);
    try {
      const res = await api.post('/customers/addresses', {
        label: selectedLabel,
        addressText: composedAddress,
        lat: pending.lat,
        lng: pending.lng,
        zoneId: pending.zoneId,
      });
      const saved = res.address;
      dispatch(setAddress(saved.id));
      dispatch(setZone(pending.zoneId));
      dispatch(setServiceable({
        zoneId: pending.zoneId,
        zoneName: pending.zoneName,
        location: { latitude: pending.lat, longitude: pending.lng, addressText: composedAddress },
      }));
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      queryClient.invalidateQueries({ queryKey: ['menu'] });
      triggerHaptic('notificationSuccess');
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Could not save address. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const savedList = addresses?.addresses || [];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.root, { paddingTop: insets.top }]}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <ArrowLeft size={20} color={colors.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{pending ? 'Add Address Details' : 'Delivery Address'}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          {!pending ? (
            <>
              {/* Search bar */}
              <TouchableOpacity style={styles.searchBar} onPress={() => setSearchVisible(true)} activeOpacity={0.8}>
                <Search size={18} color={colors.inkMuted} />
                <Text style={styles.searchPlaceholder}>Search area, street or landmark…</Text>
              </TouchableOpacity>

              {/* Use current location */}
              <TouchableOpacity
                style={styles.gpsCard}
                onPress={handleUseCurrentLocation}
                disabled={gpsChecking}
                activeOpacity={0.8}
              >
                <View style={styles.gpsIconBox}>
                  {gpsChecking
                    ? <ActivityIndicator size="small" color={colors.primary} />
                    : <Navigation size={18} color={colors.primary} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.gpsTitle}>Use current location</Text>
                  <Text style={styles.gpsSub}>Detect my location automatically</Text>
                </View>
                <ChevronRight size={16} color={colors.inkMuted} />
              </TouchableOpacity>

              {/* Saved addresses */}
              {isLoading ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
              ) : savedList.length > 0 ? (
                <>
                  <Text style={styles.sectionLabel}>SAVED ADDRESSES</Text>
                  {savedList.map((addr: any, i: number) => (
                    <Animated.View key={addr.id} entering={FadeInDown.delay(i * 40).duration(250)}>
                      <TouchableOpacity
                        style={[styles.addrCard, !addr.is_serviceable && styles.addrCardDisabled]}
                        onPress={() => selectAddress(addr)}
                        activeOpacity={0.85}
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
                          <Text style={styles.addrText} numberOfLines={2}>{addr.address_text}</Text>
                        </View>

                        <TouchableOpacity
                          onPress={() => confirmDelete(addr)}
                          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                          style={styles.deleteBtn}
                        >
                          <Trash2 size={15} color={colors.danger} />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    </Animated.View>
                  ))}
                </>
              ) : (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconBox}>
                    <MapPin size={28} color={colors.primary} />
                  </View>
                  <Text style={styles.emptyTitle}>No saved addresses</Text>
                  <Text style={styles.emptySub}>Search for your area or use current location to add one.</Text>
                </View>
              )}
            </>
          ) : (
            /* ── Address Detail Form ── */
            <Animated.View entering={FadeInDown.duration(300)} style={styles.formCard}>

              {/* Location preview */}
              <View style={styles.locationPreview}>
                <View style={styles.locationDot} />
                <Text style={styles.locationPreviewText} numberOfLines={1}>{pending.addressText}</Text>
              </View>

              {/* Label selector */}
              <Text style={styles.formSectionLabel}>Save as</Text>
              <View style={styles.labelRow}>
                {LABELS.map(lbl => (
                  <TouchableOpacity
                    key={lbl}
                    style={[styles.labelChip, selectedLabel === lbl && styles.labelChipActive]}
                    onPress={() => { setSelectedLabel(lbl); triggerHaptic(); }}
                    activeOpacity={0.8}
                  >
                    <LabelIcon label={lbl} active={selectedLabel === lbl} />
                    <Text style={[styles.labelChipText, selectedLabel === lbl && styles.labelChipTextActive]}>
                      {lbl}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* House / Flat */}
              <Text style={styles.fieldLabel}>House / Flat / Floor <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={styles.fieldInput}
                value={houseNo}
                onChangeText={setHouseNo}
                placeholder="e.g. Flat 302, House #14, Floor 2"
                placeholderTextColor={colors.inkFaint}
                returnKeyType="next"
              />

              {/* Building / Area */}
              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Building / Society / Area</Text>
              <TextInput
                style={styles.fieldInput}
                value={buildingArea}
                onChangeText={setBuildingArea}
                placeholder="e.g. Green Valley Society, SH7"
                placeholderTextColor={colors.inkFaint}
                returnKeyType="next"
              />

              {/* Landmark */}
              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Nearby Landmark <Text style={styles.optional}>(optional)</Text></Text>
              <TextInput
                style={styles.fieldInput}
                value={landmark}
                onChangeText={setLandmark}
                placeholder="e.g. Near City Mall, Opp. School"
                placeholderTextColor={colors.inkFaint}
                returnKeyType="done"
              />

              {/* Preview */}
              {houseNo.trim() && (
                <View style={styles.previewBox}>
                  <CheckCircle2 size={14} color={colors.primary} />
                  <Text style={styles.previewText} numberOfLines={2}>
                    {[houseNo.trim(), buildingArea.trim(), landmark.trim() ? `Near ${landmark.trim()}` : ''].filter(Boolean).join(', ')}
                  </Text>
                </View>
              )}

              {/* Actions */}
              <View style={styles.formActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setPending(null)} activeOpacity={0.8}>
                  <Text style={styles.cancelBtnText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, (!houseNo.trim() || saving) && styles.saveBtnDisabled]}
                  onPress={handleSaveAndDeliver}
                  disabled={!houseNo.trim() || saving}
                  activeOpacity={0.9}
                >
                  {saving
                    ? <ActivityIndicator size="small" color={colors.white} />
                    : <Text style={styles.saveBtnText}>Save & Deliver Here</Text>}
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Add new address button */}
        {!pending && (
          <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) + 4 }]}>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => { triggerHaptic(); setSearchVisible(true); }}
              activeOpacity={0.9}
            >
              <Plus size={18} color={colors.white} />
              <Text style={styles.addBtnText}>Add New Address</Text>
            </TouchableOpacity>
          </View>
        )}

        <AddressSearchModal
          visible={searchVisible}
          onClose={() => setSearchVisible(false)}
          onSelect={handleSearchSelect}
        />
      </View>
    </KeyboardAvoidingView>
  );
};

export default AddressScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 14,
    backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontFamily: fontFamily.extrabold, color: colors.ink },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.white, borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1.5, borderColor: colors.border,
    marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  searchPlaceholder: { flex: 1, fontSize: 14, fontFamily: fontFamily.medium, color: colors.inkFaint },

  // GPS card
  gpsCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.white, borderRadius: 16,
    padding: 14, marginBottom: 20,
    borderWidth: 1.5, borderColor: colors.primary + '35',
  },
  gpsIconBox: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: colors.primaryTint,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  gpsTitle: { fontSize: 14, fontFamily: fontFamily.bold, color: colors.primary },
  gpsSub: { fontSize: 12, fontFamily: fontFamily.regular, color: colors.inkMuted, marginTop: 2 },

  // Section label
  sectionLabel: {
    fontSize: 10, fontFamily: fontFamily.extrabold, color: colors.inkMuted,
    letterSpacing: 1.5, marginBottom: 10,
  },

  // Address cards
  addrCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.white, borderRadius: 16,
    padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  addrCardDisabled: { opacity: 0.5 },
  addrIconBox: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  addrInfo: { flex: 1 },
  addrTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  addrLabel: { fontSize: 15, fontFamily: fontFamily.bold, color: colors.ink },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  badgeText: { fontSize: 10, fontFamily: fontFamily.bold },
  addrText: { fontSize: 12, fontFamily: fontFamily.regular, color: colors.inkMuted, lineHeight: 17 },
  deleteBtn: { padding: 6 },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyIconBox: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.primaryTint,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontFamily: fontFamily.bold, color: colors.ink, marginBottom: 6 },
  emptySub: { fontSize: 13, fontFamily: fontFamily.regular, color: colors.inkMuted, textAlign: 'center', lineHeight: 20, paddingHorizontal: 24 },

  // Address detail form
  formCard: {
    backgroundColor: colors.white, borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  locationPreview: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.primaryTint, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 20,
  },
  locationDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.primary,
  },
  locationPreviewText: {
    flex: 1, fontSize: 13, fontFamily: fontFamily.medium, color: colors.primary,
  },

  formSectionLabel: {
    fontSize: 12, fontFamily: fontFamily.extrabold, color: colors.inkMuted,
    letterSpacing: 0.8, marginBottom: 10,
  },
  labelRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  labelChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 24, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  labelChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  labelChipText: { fontSize: 13, fontFamily: fontFamily.semibold, color: colors.inkMuted },
  labelChipTextActive: { color: colors.white },

  fieldLabel: {
    fontSize: 12, fontFamily: fontFamily.bold, color: colors.ink,
    marginBottom: 6,
  },
  required: { color: colors.danger },
  optional: { fontSize: 11, fontFamily: fontFamily.regular, color: colors.inkFaint },
  fieldInput: {
    backgroundColor: colors.surfaceMuted, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 14, fontFamily: fontFamily.regular, color: colors.ink,
    borderWidth: 1, borderColor: colors.border,
  },

  previewBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: colors.primaryTint, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, marginTop: 16,
  },
  previewText: {
    flex: 1, fontSize: 12, fontFamily: fontFamily.medium, color: colors.primary, lineHeight: 17,
  },

  formActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    backgroundColor: colors.surfaceMuted, alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, fontFamily: fontFamily.bold, color: colors.inkMuted },
  saveBtn: {
    flex: 2.5, paddingVertical: 14, borderRadius: 14,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: { fontSize: 14, fontFamily: fontFamily.bold, color: colors.white },

  // Bottom bar
  bottomBar: {
    backgroundColor: colors.white, paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  addBtn: {
    backgroundColor: colors.primary, borderRadius: 16,
    paddingVertical: 15, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  addBtnText: { fontSize: 15, fontFamily: fontFamily.bold, color: colors.white },
});
