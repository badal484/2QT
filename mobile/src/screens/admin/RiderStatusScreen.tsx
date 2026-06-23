import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Modal, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Truck, 
  Phone, 
  MapPin, 
  ShieldCheck, 
  Navigation,
  Circle,
  Search,
  X,
  Zap
} from 'lucide-react-native';
import MapView, { Marker as MapMarker, UrlTile } from 'react-native-maps';

const RiderStatusScreen = ({ navigation }: any) => {
  const [trackingRiderId, setTrackingRiderId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-riders'],
    queryFn: () => api.get('/admin/riders'),
    refetchInterval: 10000,
  });

  const riders = data?.riders || [];
  const trackingRider = riders.find((r: any) => r.id === trackingRiderId) ?? null;

  if (isLoading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FF6B35" />
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <View style={styles.liveIndicator}>
             <View style={styles.liveDot} />
             <Text style={styles.liveText}>Fleet Live</Text>
          </View>
          <Text style={styles.headerTitle}>Pilot Center</Text>
        </View>
        <View style={styles.onlineBadge}>
          <Text style={styles.onlineCount}>{riders.filter((r: any) => r.is_online).length} ONLINE</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {riders.map((rider: any) => (
          <View key={rider.id} style={styles.riderCard}>
            <View style={styles.cardHeader}>
              <View style={styles.riderInfoLeft}>
                <View style={styles.iconWrapper}>
                  <Truck size={28} color="#FF6B35" />
                </View>
                <View>
                  <Text style={styles.riderName}>{rider.name}</Text>
                  <View style={styles.verifiedBadge}>
                     <ShieldCheck size={10} color="#00D084" />
                     <Text style={styles.verifiedText}>Verified Pilot</Text>
                  </View>
                </View>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: rider.is_online ? 'rgba(0, 208, 132, 0.1)' : '#f9fafb', borderColor: rider.is_online ? 'rgba(0, 208, 132, 0.2)' : '#f3f4f6' }]}>
                <View style={styles.statusInner}>
                   <Circle size={6} color={rider.is_online ? "#00D084" : "#9CA3AF"} fill={rider.is_online ? "#00D084" : "#9CA3AF"} />
                   <Text style={[styles.statusLabel, { color: rider.is_online ? '#00D084' : '#9CA3AF' }]}>
                      {rider.is_online ? 'Active' : 'Offline'}
                   </Text>
                </View>
              </View>
            </View>

            <View style={styles.missionCard}>
              <View style={styles.missionInfo}>
                <View>
                  <Text style={styles.missionLabel}>Operational Load</Text>
                  <View style={styles.missionStatus}>
                     <Navigation size={12} color={rider.current_order_id ? "#1A1A2E" : "#D1D5DB"} />
                     <Text style={[styles.missionText, { color: rider.current_order_id ? '#1A1A2E' : '#D1D5DB' }]}>
                        {rider.current_order_id ? `Active Job: ${rider.active_order_display_id}` : 'Holding Position'}
                     </Text>
                  </View>
                </View>
                {rider.current_order_id && (
                  <View style={styles.transitBadge}>
                    <Text style={styles.transitText}>In Transit</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity 
                activeOpacity={0.7}
                onPress={() => Linking.openURL(`tel:${rider.phone}`)}
                style={styles.contactButton}
              >
                <Phone size={18} color="#1A1A2E" />
                <Text style={styles.buttonText}>Contact</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                activeOpacity={0.7}
                onPress={() => setTrackingRiderId(rider.id)}
                style={styles.trackButton}
              >
                <MapPin size={18} color="white" />
                <Text style={[styles.buttonText, { color: 'white' }]}>Track GPS</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {riders.length === 0 && (
          <View style={styles.emptyContainer}>
             <Search size={60} color="#D1D5DB" strokeWidth={1} />
             <Text style={styles.emptyText}>Searching for Registered Fleet...</Text>
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* GPS Map Modal */}
      <Modal
        visible={!!trackingRider}
        animationType="slide"
        transparent={false}
      >
        <View style={styles.modalContainer}>
           <View style={styles.modalHeader}>
              <View>
                 <Text style={styles.modalSub}>GPS Satellite Link</Text>
                 <Text style={styles.modalTitle}>Live Tracking</Text>
              </View>
              <TouchableOpacity
               onPress={() => setTrackingRiderId(null)}
               style={styles.closeButton}
              >
                 <X size={24} color="#999" />
              </TouchableOpacity>
           </View>

           <MapView
             style={styles.map}
             mapType="none"
             initialRegion={{
               latitude: trackingRider?.location?.lat || 20.5937,
               longitude: trackingRider?.location?.lng || 78.9629,
               latitudeDelta: trackingRider ? 0.01 : 15.0,
               longitudeDelta: trackingRider ? 0.01 : 15.0,
             }}
           >
             <UrlTile
               urlTemplate="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
               maximumZ={19}
               zIndex={100}
             />
             {trackingRider?.location && (
               <MapMarker
                 coordinate={{
                   latitude: trackingRider.location.lat,
                   longitude: trackingRider.location.lng,
                 }}
               >
                  <View style={styles.markerContainer}>
                     <Truck size={16} color="white" />
                  </View>
               </MapMarker>
             )}
           </MapView>

           <View style={styles.modalFooter}>
             <Text style={styles.footerSyncText}>Real-time coordinates synchronized</Text>
           </View>
        </View>
      </Modal>
    </SafeAreaView>
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
    paddingHorizontal: 32,
    paddingTop: 16,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00D084',
    marginRight: 8,
  },
  liveText: {
    color: '#9ca3af',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 3,
  },
  headerTitle: {
    color: '#1A1A2E',
    fontSize: 32,
    fontWeight: '900',
    marginTop: 4,
  },
  onlineBadge: {
    backgroundColor: '#1A1A2E',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  onlineCount: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  riderCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    borderRadius: 32,
    padding: 32,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  riderInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrapper: {
    width: 64,
    height: 64,
    backgroundColor: '#f9fafb',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 20,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  riderName: {
    color: '#1A1A2E',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  verifiedText: {
    color: '#9ca3af',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginLeft: 4,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusLabel: {
    fontWeight: '900',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginLeft: 8,
  },
  missionCard: {
    backgroundColor: '#f9fafb',
    padding: 24,
    borderRadius: 24,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(243, 244, 246, 0.5)',
  },
  missionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  missionLabel: {
    color: '#9ca3af',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 8,
  },
  missionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  missionText: {
    fontWeight: '900',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: -0.2,
    marginLeft: 8,
  },
  transitBadge: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  transitText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  contactButton: {
    flex: 1,
    backgroundColor: '#fff',
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    marginRight: 12,
  },
  trackButton: {
    flex: 1,
    backgroundColor: '#1A1A2E',
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonText: {
    color: '#1A1A2E',
    fontWeight: '900',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginLeft: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    opacity: 0.3,
  },
  emptyText: {
    color: '#9ca3af',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 4,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 24,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 32,
    paddingTop: 64,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  modalSub: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 3,
  },
  modalTitle: {
    color: '#1A1A2E',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 4,
  },
  closeButton: {
    width: 48,
    height: 48,
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    backgroundColor: '#1A1A2E',
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
  },
  modalFooter: {
    padding: 32,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f9fafb',
    paddingBottom: 48,
  },
  footerSyncText: {
    color: '#9ca3af',
    textAlign: 'center',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 4,
  },
});

export default RiderStatusScreen;
