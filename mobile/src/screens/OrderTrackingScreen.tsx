import { ArrowLeft, Bike, Home, Phone, MessageSquare, UserCircle, Check } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet, Alert, Dimensions, Platform } from 'react-native';
import MapView, { Marker, Polyline, AnimatedRegion } from 'react-native-maps';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { getSocket } from '../socket/client';
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import Animated, { FadeInDown, Layout, SlideInDown, BounceIn } from 'react-native-reanimated';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

const StatusStep = ({ title, isActive, isDone }: any) => (
  <View style={styles.statusStep}>
    <Animated.View layout={Layout.springify()} style={[styles.statusIconWrapper, { backgroundColor: isDone ? '#22C55E' : isActive ? '#FF6B35' : '#e5e7eb' }]}>
      {isDone ? <Check size={16} color="white" /> : <View style={[styles.statusDot, { backgroundColor: isActive ? 'white' : '#9ca3af' }]} />}
    </Animated.View>
    <Text style={[styles.statusText, { color: isActive || isDone ? '#1A1A2E' : '#9ca3af' }]}>{title}</Text>
  </View>
);

const OrderTrackingScreen = ({ route, navigation }: any) => {
  const { orderId } = route.params;
  const socket = getSocket();
  const queryClient = useQueryClient();

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/orders/${orderId}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-track', orderId] });
      queryClient.invalidateQueries({ queryKey: ['order-history'] });
      Alert.alert('Order Cancelled', 'Your order has been cancelled successfully.');
    },
    onError: () => Alert.alert('Error', 'Could not cancel the order at this time.')
  });

  const triggerHaptic = () => ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
  const triggerHapticSuccess = () => ReactNativeHapticFeedback.trigger("notificationSuccess", hapticOptions);

  const { data: orderData } = useQuery({
    queryKey: ['order-track', orderId],
    queryFn: () => api.get(`/orders/${orderId}`)
  });
  
  const o = orderData?.order;
  const [riderLocation, setRiderLocation] = useState<{lat: number, lng: number} | null>(() => {
    if (o?.rider_lat && o?.rider_lng) {
      return { lat: parseFloat(o.rider_lat), lng: parseFloat(o.rider_lng) };
    }
    return null;
  });
  
  const [animatedRiderLocation] = useState(new AnimatedRegion({
    latitude: riderLocation?.lat || 0,
    longitude: riderLocation?.lng || 0,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  }));
  const [status, setStatus] = useState(o?.status || 'confirmed');

  useEffect(() => {
    if (o?.rider_lat && o?.rider_lng) {
      const lat = parseFloat(o.rider_lat);
      const lng = parseFloat(o.rider_lng);
      setRiderLocation({ lat, lng });
      if (Platform.OS === 'android') {
        (animatedRiderLocation as any).timing({ latitude: lat, longitude: lng, duration: 1000, useNativeDriver: false }).start();
      } else {
        (animatedRiderLocation as any).spring({ latitude: lat, longitude: lng, useNativeDriver: false }).start();
      }
    }
  }, [o?.rider_lat, o?.rider_lng]);

  useEffect(() => {
    if (o?.status && o.status !== status) {
      setStatus(o.status);
      if (['ready_for_pickup', 'out_for_delivery', 'delivered'].includes(o.status)) {
        triggerHapticSuccess();
      }
    }
  }, [o?.status]);

  useEffect(() => {
    if (socket) {
      socket.emit('join_order', orderId);

      socket.on('order_status_update', (data) => {
        if (data.orderId === orderId) {
          setStatus(data.status);
          triggerHapticSuccess();
          queryClient.invalidateQueries({ queryKey: ['order-track', orderId] });
        }
      });

      socket.on('rider_location', (data) => {
        setRiderLocation({ lat: data.lat, lng: data.lng });
        if (Platform.OS === 'android') {
            (animatedRiderLocation as any).timing({ latitude: data.lat, longitude: data.lng, duration: 1000, useNativeDriver: false }).start();
        } else {
            (animatedRiderLocation as any).spring({ latitude: data.lat, longitude: data.lng, useNativeDriver: false }).start();
        }
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
            latitude: riderLocation ? riderLocation.lat : (parseFloat(o?.lat) || 20.5937),
            longitude: riderLocation ? riderLocation.lng : (parseFloat(o?.lng) || 78.9629),
            latitudeDelta: riderLocation ? 0.01 : 15.0,
            longitudeDelta: riderLocation ? 0.01 : 15.0,
          }}
          region={{
            latitude: riderLocation ? riderLocation.lat : (parseFloat(o?.lat) || 20.5937),
            longitude: riderLocation ? riderLocation.lng : (parseFloat(o?.lng) || 78.9629),
            latitudeDelta: riderLocation ? 0.01 : 15.0,
            longitudeDelta: riderLocation ? 0.01 : 15.0,
          }}
        >
          {riderLocation && (
            <Marker.Animated 
              coordinate={animatedRiderLocation as any}
              title="Rider"
            >
              <View style={styles.riderMarker}>
                <Bike size={24} color="#FF6B35" />
              </View>
            </Marker.Animated>
          )}
          {o && o.lat && o.lng && (
            <>
              <Marker 
                coordinate={{ latitude: parseFloat(o.lat), longitude: parseFloat(o.lng) }}
                title="Delivery Location"
              >
                <View style={styles.homeMarker}>
                  <Home size={24} color="#1A1A2E" />
                </View>
              </Marker>
              {riderLocation && (
                <Polyline
                  coordinates={[
                    { latitude: riderLocation.lat, longitude: riderLocation.lng },
                    { latitude: parseFloat(o.lat), longitude: parseFloat(o.lng) }
                  ]}
                  strokeColor="#1A1A2E"
                  strokeWidth={3}
                  lineDashPattern={[5, 5]}
                />
              )}
            </>
          )}
        </MapView>
        
        <Animated.View entering={BounceIn.delay(200)} style={{ position: 'absolute', top: 64, left: 24 }}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => { triggerHaptic(); navigation.goBack(); }}
          >
            <ArrowLeft size={24} color="#1A1A2E" />
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Bottom Status Sheet */}
      <Animated.View 
        entering={SlideInDown.duration(600).springify()} 
        style={styles.statusSheet}
      >
        <View style={styles.sheetHandle} />
        <View style={styles.timeInfoRow}>
          <View>
            <Text style={styles.timeLabel}>Arriving in</Text>
            <Animated.Text layout={Layout.springify()} style={styles.timeValue}>
                {status === 'delivered' ? 'DELIVERED' : 
                 status === 'out_for_delivery' ? '5-10 MINS' : 
                 status === 'ready_for_pickup' ? '15-20 MINS' : '25-30 MINS'}
            </Animated.Text>
          </View>

          <View style={styles.onTrackBadge}>
            <Text style={styles.onTrackText}>On Track</Text>
          </View>
        </View>

        {/* Progress Bar */}
        <Animated.View layout={Layout.springify()} style={styles.progressRow}>
          <StatusStep title="Confirmed" isDone={['confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered'].includes(status)} />
          <View style={styles.progressLine} />
          <StatusStep title="Cooking" isActive={status === 'preparing'} isDone={['ready_for_pickup', 'out_for_delivery', 'delivered'].includes(status)} />
          <View style={styles.progressLine} />
          <StatusStep title="Ready" isActive={status === 'ready_for_pickup'} isDone={['out_for_delivery', 'delivered'].includes(status)} />
          <View style={styles.progressLine} />
          <StatusStep title="Delivery" isActive={status === 'out_for_delivery'} isDone={status === 'delivered'} />
        </Animated.View>

        {/* Rider Info / Invoice Section */}
        {status === 'delivered' && o?.invoice_url ? (
          <Animated.View entering={FadeInDown} layout={Layout.springify()} style={[styles.riderCard, { backgroundColor: '#F0FDF4', borderColor: '#DCFCE7' }]}>
            <View style={[styles.riderAvatarWrapper, { backgroundColor: '#22C55E' }]}>
              <Check size={24} color="white" strokeWidth={3} />
            </View>
            <View style={styles.riderInfo}>
              <Text style={[styles.riderLabel, { color: '#166534' }]}>Financial Record</Text>
              <Text style={styles.riderName}>Invoice is Ready</Text>
            </View>
            <TouchableOpacity 
              style={[styles.riderActionBtn, { backgroundColor: '#166534' }]}
              onPress={() => { triggerHaptic(); Linking.openURL(o.invoice_url); }}
            >
              <Text style={{ color: 'white', fontWeight: '900', fontSize: 10 }}>VIEW</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.riderActionBtn, { marginLeft: 8, backgroundColor: '#1A1A2E' }]}
              onPress={() => {
                triggerHaptic();
                Alert.alert('Share', 'Systematic Receipt Shared via WhatsApp.');
              }}
            >
              <MessageSquare size={18} color="white" />
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown} layout={Layout.springify()} style={styles.riderCard}>
            <View style={styles.riderAvatarWrapper}>
              <UserCircle size={24} color="#9CA3AF" />
            </View>
            <View style={styles.riderInfo}>
              <Text style={styles.riderLabel}>Your Rider</Text>
              <Text style={styles.riderName}>{o?.rider_name || 'Rider Assigned'}</Text>
            </View>
            <TouchableOpacity 
              style={styles.riderActionBtn}
              onPress={() => { triggerHaptic(); Linking.openURL(`tel:${o?.rider_phone || '919999999999'}`); }}
            >
              <Phone size={20} color="#FF6B35" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.riderActionBtn, { marginLeft: 8 }]}
              onPress={() => { triggerHaptic(); navigation.navigate('Help'); }}
            >
              <MessageSquare size={20} color="#1A1A2E" />
            </TouchableOpacity>
          </Animated.View>
        )}

        {['pending_payment', 'confirmed'].includes(status) && (
            <Animated.View entering={FadeInDown.delay(200)} layout={Layout.springify()}>
                <TouchableOpacity 
                    style={styles.cancelBtn}
                    onPress={() => {
                        Alert.alert('Cancel Order', 'Are you sure you want to cancel this order?', [
                            { text: 'No', style: 'cancel' },
                            { text: 'Yes, Cancel', style: 'destructive', onPress: () => cancelMutation.mutate() }
                        ]);
                    }}
                    disabled={cancelMutation.isPending}
                >
                    <Text style={styles.cancelBtnText}>{cancelMutation.isPending ? 'Cancelling...' : 'Cancel Order'}</Text>
                </TouchableOpacity>
            </Animated.View>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  mapContainer: { height: '65%' },
  map: { ...StyleSheet.absoluteFill },
  riderMarker: { width: 44, height: 44, backgroundColor: '#1A1A2E', borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8 },
  homeMarker: { width: 44, height: 44, backgroundColor: '#FF6B35', borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8 },
  backButton: { width: 48, height: 48, backgroundColor: '#fff', borderRadius: 24, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 8 },
  statusSheet: { flex: 1, backgroundColor: '#fff', marginTop: -40, borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 32, paddingTop: 16, shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  sheetHandle: { width: 40, height: 5, backgroundColor: '#E5E7EB', borderRadius: 3, alignSelf: 'center', marginBottom: 24 },
  timeInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
  timeLabel: { color: '#9ca3af', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2 },
  timeValue: { color: '#1A1A2E', fontSize: 32, fontWeight: '900' },
  onTrackBadge: { backgroundColor: 'rgba(34, 197, 94, 0.1)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 24 },
  onTrackText: { color: '#166534', fontWeight: '900', fontSize: 10, textTransform: 'uppercase' },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 },
  statusStep: { alignItems: 'center', width: 64 },
  statusIconWrapper: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 9, marginTop: 8, fontWeight: '900', textTransform: 'uppercase', letterSpacing: -0.2, textAlign: 'center' },
  progressLine: { flex: 1, height: 2, backgroundColor: '#f3f4f6', marginBottom: 16 },
  riderCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', padding: 16, borderRadius: 24, borderWidth: 1, borderColor: '#f3f4f6' },
  riderAvatarWrapper: { width: 48, height: 48, backgroundColor: '#fff', borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginRight: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  riderInfo: { flex: 1 },
  riderLabel: { color: '#9ca3af', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  riderName: { color: '#1A1A2E', fontSize: 17, fontWeight: '900' },
  riderActionBtn: { width: 48, height: 48, backgroundColor: '#fff', borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#f3f4f6', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  cancelBtn: {
      marginTop: 16,
      borderWidth: 1,
      borderColor: '#EF4444',
      paddingVertical: 14,
      borderRadius: 16,
      alignItems: 'center',
  },
  cancelBtnText: {
      color: '#EF4444',
      fontWeight: '900',
      fontSize: 12,
      textTransform: 'uppercase',
      letterSpacing: 1.5,
  }
});

export default OrderTrackingScreen;
