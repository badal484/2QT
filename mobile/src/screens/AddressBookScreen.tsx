import { ArrowLeft, Home, Briefcase, MapPin, Trash2, Plus, ArrowRight, Navigation } from 'lucide-react-native';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, StyleSheet, Dimensions, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MapView, { Region } from 'react-native-maps';
import { api } from '../api/client';
import { useDispatch } from 'react-redux';
import { setAddress, setZone } from '../store/slices/cartSlice';
import { useLocation } from '../hooks/useLocation';

const { width, height } = Dimensions.get('window');

const AddressBookScreen = ({ navigation, route }: any) => {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const [newLabel, setNewLabel] = useState('Home');
  const [newAddress, setNewAddress] = useState('');
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [serviceable, setServiceable] = useState<boolean | null>(null);
  const [mapRegion, setMapRegion] = useState<Region>({
    latitude: 20.5937,
    longitude: 78.9629,
    latitudeDelta: 15.0,
    longitudeDelta: 15.0,
  });
  const mapRef = useRef<MapView>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { location, loadingLocation, fetchLocation } = useLocation();

  useEffect(() => {
    fetchLocation();
  }, []);

  useEffect(() => {
    if (location) {
      const newRegion = {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      };
      setMapRegion(newRegion);
      mapRef.current?.animateToRegion(newRegion, 1000);
      setNewAddress(location.addressText);
    }
  }, [location]);

  // Reverse geocode on pan complete
  const onRegionChangeComplete = async (region: Region) => {
    setMapRegion(region);
    setIsDragging(false);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${region.latitude}&lon=${region.longitude}&format=json`, {
        headers: { 'User-Agent': 'VeltoFoodApp/1.0' }
      });
      const data = await response.json();
      if (data && data.display_name) {
        setNewAddress(data.display_name);
      }
    } catch (e) {
      console.log('Reverse geocode failed', e);
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
      setNewAddress('');
      setServiceable(null);
      setSelectedZoneId(null);
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      navigation.goBack();
    },
  });

  const checkServiceability = async (lat: number, lng: number) => {
    setIsChecking(true);
    try {
      const res = await api.get(`/menu/zones/check?lat=${lat}&lng=${lng}`);
      setServiceable(res.serviceable);
      if (res.serviceable && res.zone) {
        setSelectedZoneId(res.zone.id);
        return res.zone.id;
      } else {
        setSelectedZoneId(null);
        return null;
      }
    } catch (err) {
      console.error('Serviceability check failed:', err);
      return null;
    } finally {
      setIsChecking(false);
    }
  };


  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/customers/addresses/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['addresses'] }),
  });

  if (isLoading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FF6B35" />
    </View>
  );

  return (
    <View style={styles.container}>
        <View style={styles.mapFullscreenContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={mapRegion}
            onRegionChange={() => setIsDragging(true)}
            onRegionChangeComplete={onRegionChangeComplete}
            showsUserLocation={true}
          />
          <View style={styles.mapCenterMarker} pointerEvents="none">
            <View style={styles.centerPinDot} />
            <MapPin size={40} color="#10B981" />
          </View>
          
          <TouchableOpacity 
            style={styles.mapBackButton}
            onPress={() => navigation.goBack()}
          >
            <ArrowLeft size={24} color="#1A1A2E" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.locateMeButton}
            onPress={() => fetchLocation()}
          >
            {loadingLocation ? <ActivityIndicator size="small" color="#10B981" /> : <Navigation size={24} color="#10B981" />}
          </TouchableOpacity>

          <View style={styles.mapBottomCard}>
            <Text style={styles.formSectionLabel}>Label</Text>
            <View style={styles.labelPickerRow}>
                {['Home', 'Work', 'Other'].map(l => (
                    <TouchableOpacity 
                        key={l}
                        onPress={() => setNewLabel(l)}
                        style={[styles.labelChip, newLabel === l ? styles.labelChipActive : styles.labelChipInactive]}
                    >
                        <Text style={[styles.labelChipText, newLabel === l ? styles.labelChipTextActive : styles.labelChipTextInactive]}>{l}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <TextInput 
                placeholder="Flat / House No. / Building / Area"
                placeholderTextColor="#A0A0A0"
                value={newAddress}
                onChangeText={setNewAddress}
                style={styles.addressInputMap}
                multiline
                numberOfLines={2}
            />

            <TouchableOpacity 
                style={[styles.saveBtn, (!newAddress || isDragging) ? styles.saveBtnDisabled : styles.saveBtnEnabled]}
                disabled={!newAddress || isDragging || addMutation.isPending || isChecking}
                onPress={async () => {
                  if (newAddress.trim().length < 5) {
                    Alert.alert('Invalid Address', 'Please provide a more detailed address.');
                    return;
                  }
                  const currentZoneId = await checkServiceability(mapRegion.latitude, mapRegion.longitude);
                  if (currentZoneId) {
                    addMutation.mutate({ 
                        label: newLabel, 
                        addressText: newAddress.trim(), 
                        zoneId: currentZoneId, 
                        lat: mapRegion.latitude,
                        lng: mapRegion.longitude 
                    });
                  }
                }}
            >
                {addMutation.isPending || isChecking ? (
                    <ActivityIndicator color="white" />
                ) : (
                    <Text style={styles.saveBtnText}>
                        Save Address
                    </Text>
                )}
            </TouchableOpacity>
            {serviceable === false && (
                <Text style={styles.errorText}>Oops! We don't serve this location yet.</Text>
            )}
          </View>
        </View>
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
  header: {
    paddingTop: 64,
    paddingHorizontal: 24,
    paddingBottom: 24,
    backgroundColor: '#f9fafb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#1A1A2E',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  addressCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    borderRadius: 32,
    padding: 24,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  addressIconWrapper: {
    width: 48,
    height: 48,
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  addressInfo: {
    flex: 1,
  },
  addressLabelText: {
    color: '#1A1A2E',
    fontWeight: '900',
    fontSize: 16,
  },
  addressDetailText: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  deleteButton: {
    width: 40,
    height: 40,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectArrowWrapper: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#e5e7eb',
    padding: 24,
    borderRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  addBtnText: {
    color: '#FF6B35',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 12,
  },
  addForm: {
    backgroundColor: '#f9fafb',
    padding: 24,
    borderRadius: 32,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  formSectionLabel: {
    color: '#1A1A2E',
    fontWeight: '900',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontSize: 10,
  },
  labelPickerRow: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  labelChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    marginRight: 8,
  },
  labelChipActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
    borderWidth: 1,
  },
  labelChipInactive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  labelChipText: {
    fontWeight: '900',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  labelChipTextActive: {
    color: '#fff',
  },
  labelChipTextInactive: {
    color: '#9ca3af',
  },
  zonePickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  zoneChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  zoneChipActive: {
    backgroundColor: '#FF6B35',
  },
  zoneChipInactive: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  zoneChipText: {
    fontWeight: '900',
    fontSize: 9,
    textTransform: 'uppercase',
  },
  zoneChipTextActive: {
    color: '#fff',
  },
  zoneChipTextInactive: {
    color: '#9ca3af',
  },
  addressInput: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 24,
    fontWeight: '700',
    color: '#1A1A2E',
    textAlignVertical: 'top',
  },
  formActionRow: {
    flexDirection: 'row',
  },
  saveBtn: {
    flex: 1,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  saveBtnEnabled: {
    backgroundColor: '#10B981',
  },
  saveBtnDisabled: {
    backgroundColor: '#F3F4F6',
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 14,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#fff',
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cancelBtnText: {
    color: '#9ca3af',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 12,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center',
  },
  successText: {
    color: '#22C55E',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center',
  },
  mapFullscreenContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  mapCenterMarker: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -80, // Offset for the top half of map view minus bottom card height approx
    marginLeft: -20,
    zIndex: 2,
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  centerPinDot: {
    width: 8,
    height: 8,
    backgroundColor: '#1A1A2E',
    borderRadius: 4,
    position: 'absolute',
    bottom: -4,
  },
  mapBackButton: {
    position: 'absolute',
    top: 64,
    left: 24,
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
    elevation: 4,
    zIndex: 10,
  },
  locateMeButton: {
    position: 'absolute',
    top: 64,
    right: 24,
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
    elevation: 4,
    zIndex: 10,
  },
  mapBottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 10,
  },
  addressInputMap: {
    backgroundColor: '#F9FAFB',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginBottom: 24,
    fontWeight: '700',
    color: '#1A1A2E',
    textAlignVertical: 'top',
  },
});

export default AddressBookScreen;
