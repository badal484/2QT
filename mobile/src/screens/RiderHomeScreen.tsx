import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Switch, StatusBar, ActivityIndicator, Alert, ScrollView, StyleSheet } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { logout, updateUser } from '../store/slices/authSlice';
import { getSocket } from '../socket/client';
import { 
  Bike, 
  LogOut, 
  Trophy, 
  ChevronRight, 
  Clock, 
  ChefHat,
  Landmark
} from 'lucide-react-native';
import RiderStatsCard from '../components/RiderStatsCard';

const RiderHomeScreen = ({ navigation }: any) => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [isOnline, setIsOnline] = useState(user?.is_online || false);
  const [currentLocation, setCurrentLocation] = useState({ latitude: 12.9716, longitude: 77.5946 });
  const [sessionTime, setSessionTime] = useState('00h 00m');
  const queryClient = useQueryClient();
  const dispatch = useDispatch();

  const { data: earnings } = useQuery({
    queryKey: ['rider-earnings'],
    queryFn: () => api.get('/riders/earnings/today'),
    enabled: isOnline,
  });

  const { data: activeOrderData } = useQuery({
    queryKey: ['rider-active-order'],
    queryFn: () => api.get('/riders/orders/active'),
    enabled: isOnline,
  });

  const { data: poolData } = useQuery({
    queryKey: ['rider-missions-pool'],
    queryFn: () => api.get('/riders/orders/pool'),
    enabled: isOnline && !activeOrderData?.order,
    refetchInterval: 5000,
  });

  const activeOrder = activeOrderData?.order;
  const pool = poolData?.orders || [];

  const toggleOnlineMutation = useMutation({
    mutationFn: (online: boolean) => {
      return api.post(online ? '/riders/online' : '/riders/offline', {});
    },
    onSuccess: (_, variables) => {
      setIsOnline(variables);
      dispatch(updateUser({ 
          is_online: variables, 
          online_since: variables ? new Date().toISOString() : null 
      }));
      queryClient.invalidateQueries({ queryKey: ['me'] });
    }
  });

  const claimMissionMutation = useMutation({
    mutationFn: (orderId: string) => api.post(`/riders/orders/${orderId}/claim`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rider-active-order'] });
      queryClient.invalidateQueries({ queryKey: ['rider-missions-pool'] });
    },
    onError: (err: any) => {
      Alert.alert('Claim Failed', err.message || 'This mission is no longer available.');
    }
  });

  // Socket Integration
  useEffect(() => {
    const socket = getSocket();
    if (socket && isOnline) {
      socket.on('new_order_assigned', (data: any) => {
        Alert.alert('New Mission!', `Order #${data.display_id} assigned to you.`, [
          { text: 'View Details', onPress: () => queryClient.invalidateQueries({ queryKey: ['rider-active-order'] }) }
        ]);
      });

      socket.on('order_status_update', () => {
        queryClient.invalidateQueries({ queryKey: ['rider-active-order'] });
      });

      socket.on('new_available_mission', () => {
        queryClient.invalidateQueries({ queryKey: ['rider-missions-pool'] });
      });

      return () => {
        socket.off('new_order_assigned');
        socket.off('order_status_update');
        socket.off('new_available_mission');
      };
    }
  }, [isOnline, queryClient]);

  // Systematic Location Heartbeat
  useEffect(() => {
    let interval: any;
    if (isOnline) {
      interval = setInterval(async () => {
        try {
          // In a real device, we would use Geolocation.getCurrentPosition here
          // For now, we systematically sync the state to the backend
          await api.post('/riders/location', { 
            lat: currentLocation.latitude, 
            lng: currentLocation.longitude,
            timestamp: new Date().toISOString()
          });
          
          if (process.env.NODE_ENV === 'development') {
            console.log(`--- SYSTEMATIC LOCATION SYNC: ${currentLocation.latitude}, ${currentLocation.longitude} ---`);
          }
        } catch (err) {
          console.error('--- SYSTEMATIC SYNC FAILURE ---', err);
          // If sync fails repeatedly, the Captain should be alerted
        }
      }, 20000); // 20-second precision for Bengaluru traffic
    }
    return () => clearInterval(interval);
  }, [isOnline, currentLocation]);

  // Session Timer
  useEffect(() => {
    let timer: any;
    if (isOnline && user?.online_since) {
      const updateTimer = () => {
        const start = new Date(user.online_since).getTime();
        const now = new Date().getTime();
        const diff = Math.max(0, now - start);
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setSessionTime(`${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m`);
      };
      updateTimer();
      timer = setInterval(updateTimer, 60000);
    } else {
      setSessionTime('00h 00m');
    }
    return () => clearInterval(timer);
  }, [isOnline, user?.online_since]);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to go off duty?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => dispatch(logout()) }
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Map Layer */}
      <View style={styles.mapContainer}>
        <MapView
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          region={{
            ...currentLocation,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          customMapStyle={mapStyle}
        >
          <Marker coordinate={currentLocation}>
            <View style={styles.riderMarkerContainer}>
              <View style={styles.riderMarkerCircle}>
                <Bike size={24} color="white" strokeWidth={2.5} />
              </View>
              <View style={styles.riderMarkerDot} />
            </View>
          </Marker>
          
          {activeOrder && (
             <Marker coordinate={{ latitude: 12.9725, longitude: 77.5960 }}>
                <View style={styles.kitchenMarker}>
                    <ChefHat size={20} color="white" />
                </View>
             </Marker>
          )}
        </MapView>
        
        {/* Floating Header */}
        <View style={styles.floatingHeader}>
          <SafeAreaView edges={['top']} style={styles.safeArea}>
            <View style={styles.headerRow}>
              <TouchableOpacity 
                activeOpacity={0.8}
                style={styles.logoutBtn}
                onPress={handleLogout}
              >
                <LogOut size={22} color="#1A1A2E" />
              </TouchableOpacity>

              <View style={styles.statusCard}>
                <View style={styles.statusInfoRow}>
                  <View style={[styles.statusIndicator, { backgroundColor: isOnline ? '#22C55E' : '#D1D5DB' }]} />
                  <View>
                    <Text style={styles.statusLabel}>Status</Text>
                    <Text style={[styles.statusValue, { color: isOnline ? '#1A1A2E' : '#9CA3AF' }]}>
                      {isOnline ? 'ON DUTY' : 'OFF DUTY'}
                    </Text>
                  </View>
                </View>
                <Switch 
                  value={isOnline}
                  onValueChange={(val) => toggleOnlineMutation.mutate(val)}
                  trackColor={{ false: '#F3F4F6', true: '#FF6B35' }}
                  thumbColor="white"
                />
              </View>

              <TouchableOpacity 
                activeOpacity={0.8}
                style={styles.payoutBtn}
                onPress={() => navigation.navigate('Payouts')}
              >
                <Landmark size={22} color="#1A1A2E" />
                {activeOrder && <View style={styles.activeOrderDot} />}
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </View>

      {/* Control Panel */}
      <ScrollView style={styles.controlPanel} contentContainerStyle={styles.controlPanelContent}>
        <View style={styles.dragHandle} />

        {activeOrder ? (
          <TouchableOpacity 
            activeOpacity={0.95}
            style={styles.activeMissionCard}
            onPress={() => navigation.navigate('AssignedOrder', { order: activeOrder })}
          >
            <View style={styles.missionHeaderRow}>
              <View>
                <View style={styles.missionLabelRow}>
                    <View style={styles.missionActiveDot} />
                    <Text style={styles.missionLabelText}>Mission Assigned</Text>
                </View>
                <Text style={styles.missionIdText}>{activeOrder.display_id}</Text>
              </View>
              <View style={styles.missionStatusBadge}>
                <Text style={styles.missionStatusText}>{activeOrder.status.replace(/_/g, ' ')}</Text>
              </View>
            </View>
            
            <View style={styles.missionNextStopCard}>
              <View style={styles.missionNextStopInfo}>
                <Text style={styles.nextStopLabel}>Next Stop</Text>
                <Text style={styles.nextStopValue} numberOfLines={1}>
                  {activeOrder.status === 'confirmed' || activeOrder.status === 'at_kitchen' || activeOrder.status === 'ready_for_pickup' 
                    ? (activeOrder.kitchen_name || 'Kitchen Hub') 
                    : (activeOrder.customer_name || 'Customer')}
                </Text>
              </View>
              <View style={styles.missionNextStopArrow}>
                <ChevronRight size={24} color="white" strokeWidth={3} />
              </View>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.poolSection}>
             {isOnline && pool.length > 0 && (
               <View style={styles.missionsPool}>
                  <View style={styles.poolHeaderRow}>
                    <Text style={styles.poolHeaderTitle}>Available Missions</Text>
                    <View style={styles.poolBadge}>
                      <Text style={styles.poolBadgeText}>{pool.length} ACTIVE</Text>
                    </View>
                  </View>
                  
                  {pool.map((mission: any) => (
                    <TouchableOpacity 
                      key={mission.id}
                      activeOpacity={0.9}
                      style={styles.poolCard}
                      onPress={() => claimMissionMutation.mutate(mission.id)}
                    >
                      <View style={styles.poolCardInfo}>
                        <View style={styles.poolCardTitleRow}>
                          <Text style={styles.poolCardId}>{mission.display_id}</Text>
                          <View style={styles.poolCardDot} />
                          <Text style={styles.poolCardStatus}>{mission.status.replace(/_/g, ' ')}</Text>
                        </View>
                        <Text style={styles.poolCardAddress} numberOfLines={1}>{mission.delivery_address || 'Central Kitchen'}</Text>
                      </View>
                      <View style={styles.poolCardArrow}>
                        <ChevronRight size={20} color="#1A1A2E" />
                      </View>
                    </TouchableOpacity>
                  ))}
               </View>
             )}

             <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <RiderStatsCard 
                      label="Earnings" 
                      value={`₹${(earnings?.totalPaise || 0) / 100}`} 
                      icon={Trophy} 
                      backgroundColor="#FF6B35" 
                  />
                </View>
                <View style={styles.statItem}>
                  <RiderStatsCard 
                      label="Deposits" 
                      value={`₹${(earnings?.cashCollectedPaise || 0) / 100}`} 
                      icon={Landmark} 
                      backgroundColor="#1A1A2E" 
                  />
                </View>
                <View style={styles.statItem}>
                  <RiderStatsCard 
                      label="Jobs" 
                      value={earnings?.deliveriesCount || 0} 
                      icon={Bike} 
                      backgroundColor="#f3f4f6" 
                      iconColor="#1A1A2E"
                  />
                </View>
             </View>
          </View>
        )}

        {!activeOrder && (
            <View style={styles.sessionCard}>
                <Clock size={24} color="#9CA3AF" />
                <Text style={styles.sessionLabel}>Current Session</Text>
                <Text style={styles.sessionValue}>{sessionTime}</Text>
            </View>
        )}
      </ScrollView>
    </View>
  );
};

const mapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#f5f5f5" }] },
  { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#f5f5f5" }] },
  { "featureType": "administrative.land_parcel", "elementType": "labels.text.fill", "stylers": [{ "color": "#bdbdbd" }] },
  { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#eeeeee" }] },
  { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#ffffff" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#e9e9e9" }] }
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mapContainer: {
    height: '60%',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  riderMarkerContainer: {
    alignItems: 'center',
  },
  riderMarkerCircle: {
    width: 48,
    height: 48,
    backgroundColor: '#1A1A2E',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  riderMarkerDot: {
    width: 16,
    height: 16,
    backgroundColor: '#1A1A2E',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
    marginTop: -4,
  },
  kitchenMarker: {
    width: 40,
    height: 40,
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
  },
  safeArea: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoutBtn: {
    width: 56,
    height: 56,
    backgroundColor: '#fff',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  statusCard: {
    flex: 1,
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 32,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  statusInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  statusLabel: {
    color: '#9ca3af',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '900',
  },
  payoutBtn: {
    width: 56,
    height: 56,
    backgroundColor: '#fff',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  activeOrderDot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 12,
    height: 12,
    backgroundColor: '#EF4444',
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  controlPanel: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: -64,
    borderTopLeftRadius: 48,
    borderTopRightRadius: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -20 },
    shadowOpacity: 0.1,
    shadowRadius: 30,
    elevation: 20,
    borderTopWidth: 1,
    borderTopColor: '#f9fafb',
  },
  controlPanelContent: {
    padding: 32,
  },
  dragHandle: {
    width: 48,
    height: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 32,
  },
  activeMissionCard: {
    backgroundColor: '#1A1A2E',
    padding: 28,
    borderRadius: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 10,
    marginBottom: 32,
  },
  missionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  missionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  missionActiveDot: {
    width: 6,
    height: 6,
    backgroundColor: '#22C55E',
    borderRadius: 3,
    marginRight: 8,
  },
  missionLabelText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 3,
  },
  missionIdText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  missionStatusBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  missionStatusText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  missionNextStopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 16,
    borderRadius: 24,
  },
  missionNextStopInfo: {
    flex: 1,
  },
  nextStopLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  nextStopValue: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 18,
  },
  missionNextStopArrow: {
    width: 48,
    height: 48,
    backgroundColor: '#FF6B35',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  poolSection: {
    marginBottom: 40,
  },
  missionsPool: {
    marginBottom: 32,
  },
  poolHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  poolHeaderTitle: {
    color: '#1A1A2E',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 11,
  },
  poolBadge: {
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  poolBadgeText: {
    color: '#FF6B35',
    fontWeight: '900',
    fontSize: 10,
  },
  poolCard: {
    backgroundColor: '#f9fafb',
    padding: 24,
    borderRadius: 32,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  poolCardInfo: {
    flex: 1,
  },
  poolCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  poolCardId: {
    color: '#1A1A2E',
    fontWeight: '900',
    fontSize: 18,
  },
  poolCardDot: {
    width: 6,
    height: 6,
    backgroundColor: '#10B981',
    borderRadius: 3,
    marginHorizontal: 12,
  },
  poolCardStatus: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  poolCardAddress: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '500',
  },
  poolCardArrow: {
    width: 48,
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: -4,
  },
  statItem: {
    flex: 1,
    paddingHorizontal: 4,
  },
  sessionCard: {
    backgroundColor: 'rgba(249, 250, 251, 0.5)',
    padding: 24,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    alignItems: 'center',
  },
  sessionLabel: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 12,
    marginBottom: 4,
  },
  sessionValue: {
    color: '#1A1A2E',
    fontSize: 20,
    fontWeight: '900',
  },
});

export default RiderHomeScreen;
