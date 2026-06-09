import { ArrowLeft, Home, Briefcase, MapPin, Trash2, Plus, ArrowRight } from 'lucide-react-native';
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, StyleSheet } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useDispatch } from 'react-redux';
import { setAddress, setZone } from '../store/slices/cartSlice';

const AddressBookScreen = ({ navigation, route }: any) => {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState('Home');
  const [newAddress, setNewAddress] = useState('');
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [serviceable, setServiceable] = useState<boolean | null>(null);


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
      setShowAdd(false);
      setNewAddress('');
      setServiceable(null);
      setSelectedZoneId(null);
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
    },
  });

  const checkServiceability = async (lat: number, lng: number) => {
    setIsChecking(true);
    try {
      const res = await api.get(`/menu/zones/check?lat=${lat}&lng=${lng}`);
      setServiceable(res.serviceable);
      if (res.serviceable && res.zone) {
        setSelectedZoneId(res.zone.id);
      } else {
        setSelectedZoneId(null);
      }
    } catch (err) {
      console.error('Serviceability check failed:', err);
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Address Book</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {addresses?.addresses?.map((addr: any) => (
          <TouchableOpacity 
            key={addr.id} 
            disabled={!route.params?.select}
            onPress={() => {
              dispatch(setAddress(addr.id));
              dispatch(setZone(addr.zone_id));
              navigation.goBack();
            }}
            activeOpacity={0.9}
            style={styles.addressCard}
          >
            <View style={styles.addressIconWrapper}>
              {addr.label === 'Home' ? <Home size={22} color="#1A1A2E" /> : addr.label === 'Work' ? <Briefcase size={22} color="#1A1A2E" /> : <MapPin size={22} color="#1A1A2E" />}
            </View>
            <View style={styles.addressInfo}>
              <Text style={styles.addressLabelText}>{addr.label}</Text>
              <Text style={styles.addressDetailText} numberOfLines={1}>{addr.address_text}</Text>
            </View>
            {!route.params?.select ? (
              <TouchableOpacity 
                onPress={() => deleteMutation.mutate(addr.id)}
                style={styles.deleteButton}
              >
                <Trash2 size={16} color="#EF4444" />
              </TouchableOpacity>
            ) : (
                <View style={styles.selectArrowWrapper}>
                    <ArrowRight size={16} color="#FF6B35" />
                </View>
            )}
          </TouchableOpacity>
        ))}

        {!showAdd ? (
          <TouchableOpacity 
            style={styles.addBtn}
            onPress={() => setShowAdd(true)}
          >
            <Plus size={20} color="#FF6B35" style={{ marginRight: 8 }} />
            <Text style={styles.addBtnText}>Add New Address</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.addForm}>
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

            <Text style={styles.formSectionLabel}>Select Service Area</Text>
            <View style={styles.zonePickerRow}>
                {zones.map((z: any) => (
                    <TouchableOpacity 
                        key={z.id}
                        onPress={() => setSelectedZoneId(z.id)}
                        style={[styles.zoneChip, selectedZoneId === z.id ? styles.zoneChipActive : styles.zoneChipInactive]}
                    >
                        <Text style={[styles.zoneChipText, selectedZoneId === z.id ? styles.zoneChipTextActive : styles.zoneChipTextInactive]}>{z.name}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <TextInput 
                placeholder="Flat / House No. / Building / Area"
                placeholderTextColor="#A0A0A0"
                value={newAddress}
                onChangeText={setNewAddress}
                style={styles.addressInput}
                multiline
                numberOfLines={3}
            />
            <View style={styles.formActionRow}>
                <TouchableOpacity 
                    style={[styles.saveBtn, (!selectedZoneId || !newAddress || serviceable === false) ? styles.saveBtnDisabled : styles.saveBtnEnabled]}
                    disabled={!selectedZoneId || !newAddress || addMutation.isPending || serviceable === false}
                    onPress={() => {
                        // Mock coordinates based on common Bangalore areas for pilot
                        let lat = 12.9667, lng = 77.7111; // Default: Kundanahalli
                        if (newAddress.toLowerCase().includes('brookefield')) {
                            lat = 12.9654; lng = 77.7185;
                        } else if (newAddress.toLowerCase().includes('indiranagar')) {
                            lat = 12.9719; lng = 77.6412; // Far away (Not serviceable)
                        }

                        if (serviceable === null) {
                            checkServiceability(lat, lng);
                        } else {
                            addMutation.mutate({ 
                                label: newLabel, 
                                addressText: newAddress, 
                                zoneId: selectedZoneId, 
                                lat,
                                lng 
                            });
                        }
                    }}
                >
                    {addMutation.isPending || isChecking ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text style={styles.saveBtnText}>
                            {serviceable === null ? 'Check Serviceability' : 'Save Address'}
                        </Text>
                    )}
                </TouchableOpacity>
                <TouchableOpacity 
                    style={styles.cancelBtn}
                    onPress={() => {
                        setShowAdd(false);
                        setServiceable(null);
                    }}
                >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
            </View>
            {serviceable === false && (
                <Text style={styles.errorText}>Oops! We don't serve this location yet.</Text>
            )}
            {serviceable === true && (
                <Text style={styles.successText}>Great! We deliver to your area.</Text>
            )}
          </View>
        )}
      </ScrollView>
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
    backgroundColor: '#1A1A2E',
  },
  labelChipInactive: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
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
    backgroundColor: '#1A1A2E',
  },
  saveBtnDisabled: {
    backgroundColor: '#e5e7eb',
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 12,
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
});

export default AddressBookScreen;
