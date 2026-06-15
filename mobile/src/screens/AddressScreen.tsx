import { ArrowLeft, Home, Briefcase, MapPin } from 'lucide-react-native';
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { api } from '../api/client';
import { setAddress, setZone } from '../store/slices/cartSlice';
import { useLocation } from '../hooks/useLocation';

const AddressScreen = ({ navigation }: any) => {
  const dispatch = useDispatch();
  const { location, loadingLocation, fetchLocation } = useLocation();

  const { data: addresses, isLoading } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => api.get('/customers/addresses'),
  });

  const selectAddress = (address: any) => {
    if (!address.is_serviceable) {
      Alert.alert('Not Serviceable', 'Sorry, we do not deliver to this location yet.');
      return;
    }
    dispatch(setAddress(address.id));
    dispatch(setZone(address.zone_id));
    navigation.goBack();
  };

  if (isLoading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#10B981" />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Addresses</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        
        <TouchableOpacity 
          style={styles.currentLocationBtn}
          onPress={fetchLocation}
          disabled={loadingLocation}
        >
          {loadingLocation ? (
            <ActivityIndicator size="small" color="#10B981" />
          ) : (
            <MapPin size={24} color="#10B981" />
          )}
          <View style={{ marginLeft: 16, flex: 1 }}>
            <Text style={styles.currentLocationTitle}>Use Current Location</Text>
            <Text style={styles.currentLocationSubtitle} numberOfLines={1}>
              {location ? location.addressText : 'Using GPS'}
            </Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>Saved Locations</Text>

        {addresses?.addresses?.map((addr: any) => (
          <TouchableOpacity 
            key={addr.id}
            activeOpacity={0.8}
            style={[styles.addressCard, !addr.is_serviceable && styles.disabledCard]}
            onPress={() => selectAddress(addr)}
          >
            <View style={styles.iconWrapper}>
              {addr.label === 'Home' ? <Home size={24} color={addr.is_serviceable ? "#10B981" : "#9ca3af"} /> : addr.label === 'Work' ? <Briefcase size={24} color={addr.is_serviceable ? "#10B981" : "#9ca3af"} /> : <MapPin size={24} color={addr.is_serviceable ? "#10B981" : "#9ca3af"} />}
            </View>
            <View style={styles.addressInfo}>
              <Text style={[styles.addressLabel, !addr.is_serviceable && styles.disabledText]}>{addr.label}</Text>
              <Text style={styles.addressText} numberOfLines={2}>{addr.address_text}</Text>
              {!addr.is_serviceable && (
                <Text style={styles.nonServiceableWarning}>Out of delivery range</Text>
              )}
            </View>
            {addr.is_serviceable && (
              <View style={styles.serviceableBadge}>
                <Text style={styles.serviceableText}>Serviceable</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}

        <TouchableOpacity 
          style={styles.addBtn}
          onPress={() => navigation.navigate('AddressBook')}
        >
          <Text style={styles.addIcon}>+</Text>
          <Text style={styles.addText}>Add New Address</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          We only serve Kundanahalli and Brookefield at the moment.
        </Text>
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
    paddingHorizontal: 32,
    paddingBottom: 24,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    width: 48,
    height: 48,
    backgroundColor: '#F9FAFB',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  headerTitle: {
    color: '#1A1A2E',
    fontSize: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  sectionLabel: {
    color: '#9ca3af',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 10,
    marginBottom: 24,
    marginLeft: 8,
  },
  currentLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    padding: 24,
    borderRadius: 24,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  currentLocationTitle: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  currentLocationSubtitle: {
    color: '#059669',
    fontSize: 14,
    marginTop: 4,
    fontWeight: '500',
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
  },
  iconWrapper: {
    width: 48,
    height: 48,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  addressInfo: {
    flex: 1,
  },
  addressLabel: {
    color: '#1A1A2E',
    fontSize: 20,
    fontWeight: '900',
  },
  addressText: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 4,
    fontWeight: '500',
  },
  serviceableBadge: {
    marginLeft: 8,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 100,
  },
  serviceableText: {
    color: '#166534',
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    padding: 24,
    borderRadius: 24,
    marginTop: 16,
  },
  addIcon: {
    color: '#10B981',
    fontSize: 24,
    fontWeight: '900',
    marginRight: 8,
  },
  addText: {
    color: '#1A1A2E',
    fontSize: 16,
    fontWeight: '900',
  },
  footer: {
    padding: 32,
    paddingBottom: 48,
  },
  footerText: {
    color: '#9ca3af',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '700',
    paddingHorizontal: 32,
    lineHeight: 18,
  },
  disabledCard: {
    opacity: 0.6,
    backgroundColor: '#F3F4F6',
  },
  disabledText: {
    color: '#9CA3AF',
  },
  nonServiceableWarning: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
    textTransform: 'uppercase',
  },
});

export default AddressScreen;
