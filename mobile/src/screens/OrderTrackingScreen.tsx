import { ArrowLeft, Bike, Home, Phone, MessageSquare, UserCircle, Check } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { getSocket } from '../socket/client';

const StatusStep = ({ title, isActive, isDone }: any) => (
  <View style={styles.statusStep}>
    <View style={[styles.statusIconWrapper, { backgroundColor: isDone ? '#22C55E' : isActive ? '#FF6B35' : '#e5e7eb' }]}>
      {isDone ? <Check size={16} color="white" /> : <View style={[styles.statusDot, { backgroundColor: isActive ? 'white' : '#9ca3af' }]} />}
    </View>
    <Text style={[styles.statusText, { color: isActive || isDone ? '#1A1A2E' : '#9ca3af' }]}>{title}</Text>
  </View>
);

const OrderTrackingScreen = ({ route, navigation }: any) => {
  const { orderId } = route.params;
  const socket = getSocket();
  const queryClient = useQueryClient();

  const { data: orderData } = useQuery({
    queryKey: ['order-track', orderId],
    queryFn: () => api.get(`/orders/${orderId}`)
  });
  
  const o = orderData?.order;
  const [riderLocation, setRiderLocation] = useState({ 
    lat: o?.rider_lat || 12.9716, 
    lng: o?.rider_lng || 77.5946 
  });
  const [status, setStatus] = useState(o?.status || 'confirmed');

  // Update rider location when order data changes initially
  useEffect(() => {
    if (o?.rider_lat && o?.rider_lng) {
      setRiderLocation({ lat: parseFloat(o.rider_lat), lng: parseFloat(o.rider_lng) });
    }
  }, [o?.rider_lat, o?.rider_lng]);


  useEffect(() => {
    if (o?.status) setStatus(o.status);
  }, [o?.status]);

  useEffect(() => {
    if (socket) {
      socket.emit('join_order', orderId);

      socket.on('order_status_update', (data) => {
        if (data.orderId === orderId) {
          setStatus(data.status);
          queryClient.invalidateQueries({ queryKey: ['order-track', orderId] });
        }
      });

      socket.on('rider_location', (data) => {
        setRiderLocation({ lat: data.lat, lng: data.lng });
      });
    }

    return () => {
      if (socket) {
        socket.off('order_status_update');
        socket.off('rider_location');
      }
    };
  }, [socket, orderId]);

  return (
    <View style={styles.container}>
      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: riderLocation.lat,
            longitude: riderLocation.lng,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
        >
          <Marker 
            coordinate={{ latitude: riderLocation.lat, longitude: riderLocation.lng }}
            title="Rider"
          >
            <View style={styles.riderMarker}>
              <Bike size={24} color="#FF6B35" />
            </View>
          </Marker>
          {o && o.lat && o.lng && (
            <Marker 
              coordinate={{ latitude: parseFloat(o.lat), longitude: parseFloat(o.lng) }}
              title="Delivery Location"
            >
              <View style={styles.homeMarker}>
                <Home size={24} color="#1A1A2E" />
              </View>
            </Marker>
          )}
        </MapView>
        
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={24} color="#1A1A2E" />
        </TouchableOpacity>
      </View>

      {/* Bottom Status Sheet */}
      <View style={styles.statusSheet}>
        <View style={styles.timeInfoRow}>
          <View>
            <Text style={styles.timeLabel}>Arriving in</Text>
            <Text style={styles.timeValue}>
                {status === 'delivered' ? 'DELIVERED' : 
                 status === 'out_for_delivery' ? '5-10 MINS' : 
                 status === 'ready_for_pickup' ? '15-20 MINS' : '25-30 MINS'}
            </Text>
          </View>

          <View style={styles.onTrackBadge}>
            <Text style={styles.onTrackText}>On Track</Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressRow}>
          <StatusStep title="Confirmed" isDone={['confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered'].includes(status)} />
          <View style={styles.progressLine} />
          <StatusStep title="Cooking" isActive={status === 'preparing'} isDone={['ready_for_pickup', 'out_for_delivery', 'delivered'].includes(status)} />
          <View style={styles.progressLine} />
          <StatusStep title="Ready" isActive={status === 'ready_for_pickup'} isDone={['out_for_delivery', 'delivered'].includes(status)} />
          <View style={styles.progressLine} />
          <StatusStep title="Delivery" isActive={status === 'out_for_delivery'} isDone={status === 'delivered'} />
        </View>

        {/* Rider Info / Invoice Section */}
        {status === 'delivered' && o?.invoice_url ? (
          <View style={[styles.riderCard, { backgroundColor: '#F0FDF4', borderColor: '#DCFCE7' }]}>
            <View style={[styles.riderAvatarWrapper, { backgroundColor: '#22C55E' }]}>
              <Check size={24} color="white" strokeWidth={3} />
            </View>
            <View style={styles.riderInfo}>
              <Text style={[styles.riderLabel, { color: '#166534' }]}>Financial Record</Text>
              <Text style={styles.riderName}>Invoice is Ready</Text>
            </View>
            <TouchableOpacity 
              style={[styles.riderActionBtn, { backgroundColor: '#166534' }]}
              onPress={() => Linking.openURL(o.invoice_url)}
            >
              <Text style={{ color: 'white', fontWeight: '900', fontSize: 10 }}>VIEW</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.riderActionBtn, { marginLeft: 8, backgroundColor: '#1A1A2E' }]}
              onPress={() => {
                // Systematic Share Simulation (Native Share logic would go here)
                Alert.alert('Share', 'Systematic Receipt Shared via WhatsApp.');
              }}
            >
              <MessageSquare size={18} color="white" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.riderCard}>
            <View style={styles.riderAvatarWrapper}>
              <UserCircle size={24} color="#9CA3AF" />
            </View>
            <View style={styles.riderInfo}>
              <Text style={styles.riderLabel}>Your Rider</Text>
              <Text style={styles.riderName}>{o?.rider_name || 'Rider Assigned'}</Text>
            </View>
            <TouchableOpacity 
              style={styles.riderActionBtn}
              onPress={() => Linking.openURL(`tel:${o?.rider_phone || '919999999999'}`)}
            >
              <Phone size={20} color="#FF6B35" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.riderActionBtn, { marginLeft: 8 }]}
              onPress={() => navigation.navigate('Help')}
            >
              <MessageSquare size={20} color="#1A1A2E" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mapContainer: {
    height: '60%',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  riderMarker: {
    width: 40,
    height: 40,
    backgroundColor: '#1A1A2E',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  homeMarker: {
    width: 40,
    height: 40,
    backgroundColor: '#FF6B35',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  backButton: {
    position: 'absolute',
    top: 64,
    left: 24,
    backgroundColor: '#fff',
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  statusSheet: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: -40,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  timeInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  timeLabel: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  timeValue: {
    color: '#1A1A2E',
    fontSize: 32,
    fontWeight: '900',
  },
  onTrackBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
  },
  onTrackText: {
    color: '#166534',
    fontWeight: '900',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
  },
  statusStep: {
    alignItems: 'center',
    width: 64,
  },
  statusIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 9,
    marginTop: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#f3f4f6',
    marginBottom: 16,
  },
  riderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  riderAvatarWrapper: {
    width: 48,
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  riderInfo: {
    flex: 1,
  },
  riderLabel: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  riderName: {
    color: '#1A1A2E',
    fontSize: 17,
    fontWeight: '900',
  },
  riderActionBtn: {
    width: 48,
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
});

export default OrderTrackingScreen;
