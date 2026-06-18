import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Switch, StatusBar, ActivityIndicator, Alert, ScrollView, StyleSheet } from 'react-native';
import { LeafletMap } from '../components/LeafletMap';
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
import Geolocation from '@react-native-community/geolocation';

const RiderHomeScreen = ({ navigation }: any) => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [isOnline, setIsOnline] = useState(user?.is_online || false);
  const [currentLocation, setCurrentLocation] = useState({ latitude: 0, longitude: 0 });
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
          
          if (__DEV__) {
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
        const start = new Date(user.online_since as string).getTime();
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

  useEffect(() => {
    // 1. Initial Position Lookup on Mount
    Geolocation.getCurrentPosition(
      pos => setCurrentLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      err => console.log('Initial location lookup err', err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );

    // 2. Active Continuous Watching
    const watchId = Geolocation.watchPosition(
      pos => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCurrentLocation({ latitude: lat, longitude: lng });
        
        // Emit location via socket only if online
        if (isOnline) {
          const socket = getSocket();
          if (socket) {
             socket.emit('update_location', { lat, lng });
          }
        }
      },
      error => console.log('Continuous WatchPosition Error', error),
      { enableHighAccuracy: true, distanceFilter: 10, interval: 5000, fastestInterval: 2000 }
    );

    return () => {
      if (watchId !== undefined) Geolocation.clearWatch(watchId);
    };
  }, [isOnline]);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to go off duty?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => dispatch(logout()) }
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Map Layer */}
      <View style={styles.mapContainer}>
        <LeafletMap
          latitude={currentLocation.latitude || 20.5937}
          longitude={currentLocation.longitude || 78.9629}
          zoom={15}
          markers={[
            ...(currentLocation.latitude && currentLocation.longitude ? [{
              id: 'rider',
              lat: currentLocation.latitude,
              lng: currentLocation.longitude,
              iconUrl: 'https://cdn-icons-png.flaticon.com/512/3198/3198336.png',
            }] : []),
            ...(activeOrder ? (() => {
              const isOut = activeOrder.status === 'out_for_delivery';
              const targetLat = isOut 
                ? parseFloat(activeOrder.customer_lat || activeOrder.lat || '0') 
                : parseFloat(activeOrder.kitchen_lat || '0');
              const targetLng = isOut 
                ? parseFloat(activeOrder.customer_lng || activeOrder.lng || '0') 
                : parseFloat(activeOrder.kitchen_lng || '0');
              
              if (targetLat && targetLng) {
                return [{
                  id: 'destination',
                  lat: targetLat,
                  lng: targetLng,
                  iconUrl: isOut
                    ? 'https://cdn-icons-png.flaticon.com/512/619/619034.png' // Customer House
                    : 'https://cdn-icons-png.flaticon.com/512/3448/3448609.png', // Kitchen Store
                }];
              }
              return [];
            })() : []),
          ]}
          style={styles.map}
        />
        
        {/* Floating Header */}
        <View style={styles.floatingHeader}>
          <SafeAreaView edges={['top']} style={styles.safeArea}>
            <View style={styles.headerRow}>
              <TouchableOpacity 
                activeOpacity={0.8}
                style={styles.logoutBtn}
                onPress={handleLogout}
              >
                <LogOut size={22} color="#FF6B35" />
              </TouchableOpacity>

              <View style={styles.statusCard}>
                <View style={styles.statusInfoRow}>
                  <View style={[styles.statusIndicator, { backgroundColor: isOnline ? '#22C55E' : '#64748B' }]} />
                  <View>
                    <Text style={styles.statusLabel}>Status</Text>
                    <Text style={[styles.statusValue, { color: isOnline ? '#22C55E' : '#64748B' }]}>
                      {isOnline ? 'ON DUTY' : 'OFF DUTY'}
                    </Text>
                  </View>
                </View>
                <Switch 
                  value={isOnline}
                  onValueChange={(val) => toggleOnlineMutation.mutate(val)}
                  trackColor={{ false: '#2C2D42', true: '#FF6B35' }}
                  thumbColor="white"
                />
              </View>

              <TouchableOpacity 
                activeOpacity={0.8}
                style={styles.payoutBtn}
                onPress={() => navigation.navigate('Payouts')}
              >
                <Landmark size={22} color="#FFFFFF" />
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
                        <ChevronRight size={20} color="#FFFFFF" />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
             )}

              {/* Daily Target Progress Meter */}
              {isOnline && (
                <View style={styles.targetContainer}>
                  <View style={styles.targetHeader}>
                    <Text style={styles.targetTitle}>Daily Mission Target</Text>
                    <Text style={styles.targetRatio}>
                      {earnings?.deliveriesCount || 0} / 10 Completed
                    </Text>
                  </View>
                  <View style={styles.progressBarTrack}>
                    <View 
                      style={[
                        styles.progressBarFill, 
                        { width: `${Math.min(100, ((earnings?.deliveriesCount || 0) / 10) * 100)}%` }
                      ]} 
                    />
                  </View>
                  <Text style={styles.targetSubtext}>
                    Complete 10 deliveries to secure the ₹500 daily streak bonus.
                  </Text>
                </View>
              )}

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate('Earnings')}>
                    <RiderStatsCard 
                        label="Earnings" 
                        value={`₹${(earnings?.totalPaise || 0) / 100}`} 
                        icon={Trophy} 
                        backgroundColor="rgba(34, 197, 94, 0.15)" 
                        iconColor="#22C55E"
                    />
                  </TouchableOpacity>
                </View>
                <View style={styles.statItem}>
                  <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate('Payouts')}>
                    <RiderStatsCard 
                        label="Deposits" 
                        value={`₹${(earnings?.cashCollectedPaise || 0) / 100}`} 
                        icon={Landmark} 
                        backgroundColor="rgba(255, 107, 53, 0.15)" 
                        iconColor="#FF6B35"
                    />
                  </TouchableOpacity>
                </View>
                <View style={styles.statItem}>
                  <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate('RiderHistory')}>
                    <RiderStatsCard 
                        label="Jobs" 
                        value={earnings?.deliveriesCount || 0} 
                        icon={Bike} 
                        backgroundColor="rgba(255, 255, 255, 0.08)" 
                        iconColor="#FFFFFF"
                    />
                  </TouchableOpacity>
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
  { "elementType": "geometry", "stylers": [{ "color": "#1C1D24" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#8A8D9F" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#1C1D24" }] },
  { "featureType": "administrative", "elementType": "geometry.stroke", "stylers": [{ "color": "#2D303F" }] },
  { "featureType": "administrative.land_parcel", "elementType": "labels.text.fill", "stylers": [{ "color": "#4A4D5E" }] },
  { "featureType": "poi", "stylers": [{ "visibility": "off" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#282A36" }] },
  { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#1C1D24" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#9AA0B9" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#3D4155" }] },
  { "featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{ "color": "#1C1D24" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#0B0C10" }] }
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0C10',
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
    backgroundColor: '#FF6B35',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  riderMarkerDot: {
    width: 16,
    height: 16,
    backgroundColor: '#FF6B35',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    marginTop: -4,
  },
  kitchenMarker: {
    width: 40,
    height: 40,
    backgroundColor: '#10B981',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
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
    backgroundColor: '#161726',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  statusCard: {
    flex: 1,
    marginHorizontal: 16,
    backgroundColor: '#161726',
    borderRadius: 32,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
    color: '#94A3B8',
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
    backgroundColor: '#161726',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
    borderColor: '#161726',
  },
  controlPanel: {
    flex: 1,
    backgroundColor: '#0B0C10',
    marginTop: -64,
    borderTopLeftRadius: 48,
    borderTopRightRadius: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  controlPanelContent: {
    padding: 32,
  },
  dragHandle: {
    width: 48,
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 32,
  },
  activeMissionCard: {
    backgroundColor: '#1A1A2E',
    padding: 28,
    borderRadius: 40,
    borderWidth: 1.5,
    borderColor: '#FF6B35',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
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
    width: 8,
    height: 8,
    backgroundColor: '#22C55E',
    borderRadius: 4,
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
    color: '#FFFFFF',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 11,
  },
  poolBadge: {
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
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
    backgroundColor: '#161726',
    padding: 24,
    borderRadius: 32,
    marginBottom: 16,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderLeftColor: '#FF6B35',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
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
    color: '#FFFFFF',
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
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  poolCardAddress: {
    color: '#CCCCCC',
    fontSize: 12,
    fontWeight: '500',
  },
  poolCardArrow: {
    width: 48,
    height: 48,
    backgroundColor: '#FF6B35',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
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
    backgroundColor: '#161726',
    padding: 24,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  sessionLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 12,
    marginBottom: 4,
  },
  sessionValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  targetContainer: {
    backgroundColor: '#161726',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 32,
    padding: 24,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  targetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  targetTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontSize: 11,
  },
  targetRatio: {
    color: '#22C55E',
    fontWeight: '900',
    fontSize: 12,
  },
  progressBarTrack: {
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#22C55E',
    borderRadius: 5,
  },
  targetSubtext: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 14,
  },
});

export default RiderHomeScreen;
