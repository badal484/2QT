import { ArrowLeft, Home, Briefcase, MapPin, Trash2, Plus, ArrowRight, Navigation, Search } from 'lucide-react-native';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, StyleSheet, Dimensions, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LeafletMap } from '../components/LeafletMap';
import { api } from '../api/client';
import { useDispatch } from 'react-redux';
import { setAddress, setZone } from '../store/slices/cartSlice';
import { useLocation } from '../hooks/useLocation';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { AddressSearchModal } from '../components/AddressSearchModal';

const { width, height } = Dimensions.get('window');

const AddressBookScreen = ({ navigation, route }: any) => {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const [newLabel, setNewLabel] = useState('Home');
  const [newAddress, setNewAddress] = useState('');
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [serviceable, setServiceable] = useState<boolean | null>(null);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  
  const [mapRegion, setMapRegion] = useState({
    latitude: 20.5937,
    longitude: 78.9629,
  });
  
  const [isDragging, setIsDragging] = useState(false);
  const { location, loadingLocation, fetchLocation } = useLocation();

  const pinTranslateY = useSharedValue(0);

  const animatedPinStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: pinTranslateY.value }]
    };
  });

  useEffect(() => {
    fetchLocation();
  }, []);

  useEffect(() => {
    if (location) {
      setMapRegion({
        latitude: location.latitude,
        longitude: location.longitude,
      });
      setNewAddress(location.addressText);
    }
  }, [location]);

  const onRegionChange = () => {
    if (!isDragging) {
      setIsDragging(true);
      ReactNativeHapticFeedback.trigger('impactLight');
      pinTranslateY.value = withSpring(-20, { damping: 10, stiffness: 200 });
    }
  };

  const onRegionChangeComplete = async (region: any) => {
    setMapRegion(region);
    setIsDragging(false);
    ReactNativeHapticFeedback.trigger('impactMedium');
    pinTranslateY.value = withSpring(0, { damping: 12, stiffness: 300 });

    try {
      const data = await api.get(`/menu/geocode/reverse?lat=${region.latitude}&lng=${region.longitude}`);
      if (data?.display_name) {
        setNewAddress(data.display_name);
      }
    } catch (e) {
      // non-critical — address text stays as-is
    }
  };


  const { data: addresses, isLoading } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => api.get('/customers/addresses'),
  });

  const { data: zonesData } = useQuery({
    queryKey: ['active-zones'],
    queryFn: () => api.get('/menu/zones'),
  });

  const zones = zonesData?.zones || [];

  const addMutation = useMutation({
    mutationFn: (data: any) => api.post('/customers/addresses', data),
    onSuccess: () => {
      ReactNativeHapticFeedback.trigger('notificationSuccess');
      setNewAddress('');
      setServiceable(null);
      setSelectedZoneId(null);
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      navigation.goBack();
    },
  });

  const checkServiceability = async (lat: number, lng: number): Promise<{ zoneId: string | null; networkError: boolean }> => {
    setIsChecking(true);
    try {
      const res = await api.get(`/menu/zones/check?lat=${lat}&lng=${lng}`);
      setServiceable(res.serviceable);
      if (res.serviceable && res.zone) {
        setSelectedZoneId(res.zone.id);
        return { zoneId: res.zone.id, networkError: false };
      } else {
        setSelectedZoneId(null);
        return { zoneId: null, networkError: false };
      }
    } catch (err) {
      return { zoneId: null, networkError: true };
    } finally {
      setIsChecking(false);
    }
  };


  if (isLoading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FF6B35" />
    </View>
  );

  return (
    <View style={styles.container}>
        <View style={styles.mapFullscreenContainer}>
          <LeafletMap
            style={styles.map}
            latitude={mapRegion.latitude}
            longitude={mapRegion.longitude}
            zoom={16}
            onRegionChange={onRegionChange}
            onRegionChangeComplete={onRegionChangeComplete}
          />
          
          {/* Animated Center Pin */}
          <View style={styles.mapCenterMarker} pointerEvents="none">
            <Animated.View style={[styles.pinWrapper, animatedPinStyle]}>
              <View style={styles.pinBubble}>
                <MapPin size={24} color="#FFFFFF" fill="#10B981" />
              </View>
              <View style={styles.pinTail} />
            </Animated.View>
            <View style={styles.centerPinDot} />
          </View>
          
          {/* Top Actions: Back & Search */}
          <View style={styles.topActionsContainer}>
            <TouchableOpacity 
              style={styles.actionCircleBtn}
              onPress={() => {
                ReactNativeHapticFeedback.trigger('impactLight');
                navigation.goBack();
              }}
            >
              <ArrowLeft size={24} color="#1A1A2E" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.searchBarContainer}
              onPress={() => {
                ReactNativeHapticFeedback.trigger('impactLight');
                setIsSearchVisible(true);
              }}
            >
              <Search size={20} color="#9CA3AF" style={{ marginRight: 8 }} />
              <Text style={styles.searchBarText}>Search area or street name...</Text>
            </TouchableOpacity>
          </View>

          {/* Floating Locate Me */}
          <TouchableOpacity 
            style={styles.floatingLocateBtn}
            onPress={() => {
              ReactNativeHapticFeedback.trigger('impactLight');
              fetchLocation();
            }}
          >
            {loadingLocation ? <ActivityIndicator size="small" color="#10B981" /> : <Navigation size={24} color="#10B981" />}
          </TouchableOpacity>

          {/* Premium Bottom Sheet */}
          <View style={styles.premiumBottomCard}>
            <View style={styles.dragHandle} />
            
            <View style={styles.locationHeaderRow}>
              <MapPin size={24} color="#FF6B35" style={{ marginRight: 12 }} />
              <View style={styles.locationHeaderTextContainer}>
                <Text style={styles.locationHeaderTitle}>Select delivery location</Text>
                <Text style={styles.locationHeaderSubtitle} numberOfLines={1}>
                  {newAddress || "Locating..."}
                </Text>
              </View>
            </View>

            <Text style={styles.formSectionLabel}>Save Address As</Text>
            <View style={styles.labelPickerRow}>
                {['Home', 'Work', 'Other'].map(l => (
                    <TouchableOpacity 
                        key={l}
                        onPress={() => {
                          ReactNativeHapticFeedback.trigger('selection');
                          setNewLabel(l);
                        }}
                        style={[styles.labelChip, newLabel === l ? styles.labelChipActive : styles.labelChipInactive]}
                    >
                        <Text style={[styles.labelChipText, newLabel === l ? styles.labelChipTextActive : styles.labelChipTextInactive]}>{l}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <View style={styles.inputWrapper}>
              <TextInput 
                  placeholder="Flat / House No. / Building / Area"
                  placeholderTextColor="#9CA3AF"
                  value={newAddress}
                  onChangeText={setNewAddress}
                  style={styles.premiumInput}
                  multiline
                  numberOfLines={2}
              />
            </View>

            <TouchableOpacity 
                style={[styles.premiumSaveBtn, (!newAddress || isDragging) ? styles.premiumSaveBtnDisabled : styles.premiumSaveBtnEnabled]}
                disabled={!newAddress || isDragging || addMutation.isPending || isChecking}
                onPress={async () => {
                  ReactNativeHapticFeedback.trigger('impactHeavy');
                  if (newAddress.trim().length < 5) {
                    Alert.alert('Invalid Address', 'Please provide a more detailed address.');
                    return;
                  }
                  const { zoneId: currentZoneId, networkError } = await checkServiceability(mapRegion.latitude, mapRegion.longitude);
                  if (currentZoneId) {
                    addMutation.mutate({
                        label: newLabel,
                        addressText: newAddress.trim(),
                        zoneId: currentZoneId,
                        lat: mapRegion.latitude,
                        lng: mapRegion.longitude
                    });
                  } else if (networkError) {
                    Alert.alert('Connection Error', 'Could not verify delivery availability. Please check your connection and try again.');
                  }
                }}
            >
                {addMutation.isPending || isChecking ? (
                    <ActivityIndicator color="white" />
                ) : (
                    <Text style={styles.premiumSaveBtnText}>
                        Save Address
                    </Text>
                )}
            </TouchableOpacity>
            {serviceable === false && (
                <Text style={styles.errorText}>Oops! We don't serve this location yet.</Text>
            )}
          </View>
        </View>

        <AddressSearchModal 
          visible={isSearchVisible}
          onClose={() => setIsSearchVisible(false)}
          onSelect={(lat, lon, name) => {
            setIsSearchVisible(false);
            setMapRegion({ latitude: lat, longitude: lon });
            setNewAddress(name);
          }}
        />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapFullscreenContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  
  // --- Floating UI Elements ---
  topActionsContainer: {
    position: 'absolute',
    top: 64,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  actionCircleBtn: {
    width: 48,
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    marginRight: 12,
  },
  searchBarContainer: {
    flex: 1,
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  searchBarText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '600',
  },
  floatingLocateBtn: {
    position: 'absolute',
    bottom: 340, // Just above the bottom card
    right: 16,
    width: 48,
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    zIndex: 10,
  },

  // --- Map Pin Animations ---
  mapCenterMarker: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -160, 
    marginLeft: -20,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: 40,
    height: 80,
  },
  pinWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinBubble: {
    backgroundColor: '#10B981',
    borderRadius: 20,
    padding: 6,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  pinTail: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#10B981',
    marginTop: -1,
  },
  centerPinDot: {
    width: 8,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 4,
    position: 'absolute',
    bottom: 0,
    transform: [{ scaleY: 0.5 }],
  },

  // --- Premium Bottom Sheet ---
  premiumBottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 15,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  locationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  locationHeaderTextContainer: {
    flex: 1,
  },
  locationHeaderTitle: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  locationHeaderSubtitle: {
    fontSize: 16,
    color: '#1A1A2E',
    fontWeight: '800',
  },
  formSectionLabel: {
    color: '#1A1A2E',
    fontWeight: '900',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontSize: 11,
  },
  labelPickerRow: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  labelChip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 100,
    marginRight: 10,
  },
  labelChipActive: {
    backgroundColor: '#10B981',
  },
  labelChipInactive: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  labelChipText: {
    fontWeight: '800',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  labelChipTextActive: {
    color: '#fff',
  },
  labelChipTextInactive: {
    color: '#6B7280',
  },
  inputWrapper: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginBottom: 24,
  },
  premiumInput: {
    padding: 16,
    fontWeight: '600',
    color: '#1A1A2E',
    fontSize: 14,
    textAlignVertical: 'top',
  },
  premiumSaveBtn: {
    height: 56,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  premiumSaveBtnEnabled: {
    backgroundColor: '#10B981',
  },
  premiumSaveBtnDisabled: {
    backgroundColor: '#E5E7EB',
    shadowOpacity: 0,
    elevation: 0,
  },
  premiumSaveBtnText: {
    color: '#fff',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 14,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center',
  },
});

export default AddressBookScreen;
