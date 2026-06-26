import { ArrowLeft, Home, Briefcase, MapPin, Trash2, Plus, ArrowRight, Navigation, Search } from 'lucide-react-native';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, StyleSheet, Dimensions, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MapView, { PROVIDER_GOOGLE, UrlTile } from 'react-native-maps';
import { api } from '../api/client';
import { useDispatch } from 'react-redux';
import { setAddress, setZone } from '../store/slices/cartSlice';
import { useLocation } from '../hooks/useLocation';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, FadeInDown } from 'react-native-reanimated';
import { AddressSearchModal } from '../components/AddressSearchModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

const AddressBookScreen = ({ navigation, route }: any) => {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  
  const [newLabel, setNewLabel] = useState('Home');
  const [newAddress, setNewAddress] = useState('');
  const [houseNo, setHouseNo] = useState('');
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  
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
      setShowDetails(false); // Hide details when moving map
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
      // non-critical
    }
  };

  const addMutation = useMutation({
    mutationFn: (data: any) => api.post('/customers/addresses', data),
    onSuccess: () => {
      ReactNativeHapticFeedback.trigger('notificationSuccess');
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      // Go back to the select screen or home
      navigation.goBack();
    },
  });

  const checkServiceability = async (lat: number, lng: number): Promise<string | null> => {
    try {
      const res = await api.get(`/menu/zones/check?lat=${lat}&lng=${lng}`);
      if (res.serviceable && res.zone) {
        return res.zone.id;
      }
    } catch (err) {}
    return null;
  };

  const handleSave = async () => {
    if (!showDetails) {
      setShowDetails(true);
      return;
    }

    if (!houseNo.trim()) {
      Alert.alert('Missing Details', 'Please provide a house or flat number.');
      return;
    }

    setIsChecking(true);
    ReactNativeHapticFeedback.trigger('impactHeavy');
    
    // Check zone but DO NOT BLOCK if unserviceable
    const zoneId = await checkServiceability(mapRegion.latitude, mapRegion.longitude);
    
    const fullAddress = `${houseNo.trim()}, ${newAddress}`;

    addMutation.mutate({
        label: newLabel,
        addressText: fullAddress,
        zoneId: zoneId, // Might be null if unserviceable, which is now supported!
        lat: mapRegion.latitude,
        lng: mapRegion.longitude
    });
    
    setIsChecking(false);
  };

  return (
    <View style={styles.container}>
        {/* Clean White Header matching Screenshot 2 */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity 
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <ArrowLeft size={22} color="#1A1A2E" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Add delivery location</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.searchBarContainer}
            onPress={() => {
              ReactNativeHapticFeedback.trigger('impactLight');
              setIsSearchVisible(true);
            }}
            activeOpacity={0.9}
          >
            <Search size={20} color="#10B981" style={{ marginRight: 12 }} />
            <Text style={styles.searchBarText}>Search delivery location</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.mapContainer}>
          <MapView
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            region={{
              latitude: mapRegion.latitude,
              longitude: mapRegion.longitude,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            }}
            onRegionChange={onRegionChange}
            onRegionChangeComplete={(region) => onRegionChangeComplete({ latitude: region.latitude, longitude: region.longitude })}
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
          
          {/* Animated Center Pin (Red) */}
          <View style={styles.mapCenterMarker} pointerEvents="none">
            <Animated.View style={[styles.pinWrapper, animatedPinStyle]}>
              <View style={styles.pinBubble}>
                <MapPin size={28} color="#FFFFFF" fill="#EF4444" />
              </View>
            </Animated.View>
          </View>
          
          {/* Floating LOCATE ME */}
          <TouchableOpacity 
            style={[styles.floatingLocateBtn, { bottom: showDetails ? 380 : 180 }]}
            onPress={() => {
              ReactNativeHapticFeedback.trigger('impactMedium');
              fetchLocation();
            }}
            activeOpacity={0.8}
          >
            {loadingLocation ? (
              <ActivityIndicator size="small" color="#10B981" />
            ) : (
              <>
                <Navigation size={18} color="#10B981" style={{ marginRight: 6 }} />
                <Text style={styles.locateMeText}>LOCATE ME</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Bottom Sheet */}
        <View style={styles.bottomSheet}>
          <View style={styles.locationHeaderRow}>
            <Navigation size={22} color="#10B981" fill="#10B981" style={{ marginRight: 16, marginTop: 4 }} />
            <View style={styles.locationHeaderTextContainer}>
              <Text style={styles.locationHeaderTitle} numberOfLines={1}>
                {newAddress.split(',')[0] || "Locating..."}
              </Text>
              <Text style={styles.locationHeaderSubtitle} numberOfLines={2}>
                {newAddress}
              </Text>
            </View>
          </View>

          {showDetails && (
            <Animated.View entering={FadeInDown.duration(300)}>
              <TextInput 
                  placeholder="House / Flat / Block No."
                  placeholderTextColor="#9CA3AF"
                  value={houseNo}
                  onChangeText={setHouseNo}
                  style={styles.detailInput}
                  autoFocus
              />
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
            </Animated.View>
          )}

          <TouchableOpacity 
              style={[styles.saveBtn, (!newAddress || isDragging) ? styles.saveBtnDisabled : styles.saveBtnEnabled]}
              disabled={!newAddress || isDragging || addMutation.isPending || isChecking}
              onPress={handleSave}
              activeOpacity={0.9}
          >
              {addMutation.isPending || isChecking ? (
                  <ActivityIndicator color="white" />
              ) : (
                  <Text style={styles.saveBtnText}>
                      {showDetails ? "Save Address" : "Enter complete address"}
                  </Text>
              )}
          </TouchableOpacity>
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
    backgroundColor: '#F3F4F6',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingBottom: 16,
    zIndex: 10,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A1A2E',
  },
  searchBarContainer: {
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchBarText: {
    color: '#9CA3AF',
    fontSize: 15,
    fontWeight: '500',
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  mapCenterMarker: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -40, 
    marginLeft: -14,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  pinWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinBubble: {
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  floatingLocateBtn: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    zIndex: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  locateMeText: {
    color: '#10B981',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  bottomSheet: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.05,
    shadowRadius: 24,
    elevation: 15,
  },
  locationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  locationHeaderTextContainer: {
    flex: 1,
  },
  locationHeaderTitle: {
    fontSize: 18,
    color: '#1A1A2E',
    fontWeight: '800',
    marginBottom: 4,
  },
  locationHeaderSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
    lineHeight: 18,
  },
  detailInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    fontWeight: '500',
    color: '#1A1A2E',
    marginBottom: 16,
  },
  labelPickerRow: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  labelChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100,
    marginRight: 10,
  },
  labelChipActive: {
    backgroundColor: '#10B981',
  },
  labelChipInactive: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  labelChipText: {
    fontWeight: '700',
    fontSize: 13,
  },
  labelChipTextActive: {
    color: '#fff',
  },
  labelChipTextInactive: {
    color: '#6B7280',
  },
  saveBtn: {
    height: 54,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnEnabled: {
    backgroundColor: '#10B981',
  },
  saveBtnDisabled: {
    backgroundColor: '#D1D5DB',
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
});

export default AddressBookScreen;
