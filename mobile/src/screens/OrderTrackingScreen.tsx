import { ArrowLeft, Bike, Home, Phone, MessageSquare, UserCircle, Check, MapPin, Navigation } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet, Alert, Dimensions, Platform } from 'react-native';
import MapView, { Marker, Polyline, AnimatedRegion, PROVIDER_GOOGLE } from 'react-native-maps';
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
    <Animated.View layout={Layout.springify()} style={[styles.statusIconWrapper, { backgroundColor: isDone ? '#10B981' : isActive ? '#10B981' : '#F3F4F6' }]}>
      {isDone ? <Check size={16} color="white" /> : <View style={[styles.statusDot, { backgroundColor: isActive ? 'white' : '#D1D5DB' }]} />}
    </Animated.View>
    <Text style={[styles.statusText, { color: isActive || isDone ? '#1A1A2E' : '#9CA3AF' }]}>{title}</Text>
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
            latitude: riderLocation ? riderLocation.lat : (parseFloat(o?.customer_lat) || 12.9716),
            longitude: riderLocation ? riderLocation.lng : (parseFloat(o?.customer_lng) || 77.5946),
            latitudeDelta: riderLocation ? 0.01 : 15.0,
            longitudeDelta: riderLocation ? 0.01 : 15.0,
          }}
          region={{
            latitude: riderLocation ? riderLocation.lat : (parseFloat(o?.customer_lat) || 12.9716),
            longitude: riderLocation ? riderLocation.lng : (parseFloat(o?.customer_lng) || 77.5946),
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
                <Navigation size={20} color="#FFFFFF" style={{ transform: [{ rotate: '45deg' }] }} />
              </View>
            </Marker.Animated>
          )}
          {o && o.customer_lat && o.customer_lng && (
            <>
              <Marker 
                coordinate={{ latitude: parseFloat(o.customer_lat), longitude: parseFloat(o.customer_lng) }}
                title="Delivery Location"
              >
                <View style={styles.homeMarker}>
                  <MapPin size={24} color="#FFFFFF" />
                </View>
              </Marker>
              {riderLocation && (
                <Polyline
                  coordinates={[
                    { latitude: riderLocation.lat, longitude: riderLocation.lng },
                    { latitude: parseFloat(o.customer_lat), longitude: parseFloat(o.customer_lng) }
                  ]}
                  strokeColor="#10B981"
                  strokeWidth={4}
                  lineDashPattern={[0]}
                />
              )}
            </>
          )}
        </MapView>
        
        {/* Sleek Floating Back Button */}
        <Animated.View entering={BounceIn.delay(200)} style={styles.floatingHeader}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => { triggerHaptic(); navigation.goBack(); }}
          >
            <ArrowLeft size={24} color="#1A1A2E" />
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Premium Bottom Sheet */}
      <Animated.View 
        entering={SlideInDown.duration(600).springify()} 
        style={styles.statusSheet}
      >
        <View style={styles.sheetHandle} />
        
        <View style={styles.timeInfoRow}>
          <View>
            <Text style={styles.timeLabel}>ESTIMATED ARRIVAL</Text>
            <Animated.Text layout={Layout.springify()} style={styles.timeValue}>
                {status === 'delivered' ? 'Delivered' : 
                 status === 'out_for_delivery' ? '10 mins' : 
                 status === 'ready_for_pickup' ? '15 mins' : '25 mins'}
            </Animated.Text>
          </View>

          <View style={styles.onTrackBadge}>
            <Text style={styles.onTrackText}>On Time</Text>
          </View>
        </View>

        {/* Dynamic Progress Bar */}
        <Animated.View layout={Layout.springify()} style={styles.progressRow}>
          <StatusStep title="Confirmed" isDone={['confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered'].includes(status)} />
          <View style={[styles.progressLine, ['preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered'].includes(status) && { backgroundColor: '#10B981' }]} />
          <StatusStep title="Cooking" isActive={status === 'preparing'} isDone={['ready_for_pickup', 'out_for_delivery', 'delivered'].includes(status)} />
          <View style={[styles.progressLine, ['ready_for_pickup', 'out_for_delivery', 'delivered'].includes(status) && { backgroundColor: '#10B981' }]} />
          <StatusStep title="Ready" isActive={status === 'ready_for_pickup'} isDone={['out_for_delivery', 'delivered'].includes(status)} />
          <View style={[styles.progressLine, ['out_for_delivery', 'delivered'].includes(status) && { backgroundColor: '#10B981' }]} />
          <StatusStep title="Delivery" isActive={status === 'out_for_delivery'} isDone={status === 'delivered'} />
        </Animated.View>

        {/* Minimalist Rider Card */}
        {status === 'delivered' && o?.invoice_url ? (
          <Animated.View entering={FadeInDown} layout={Layout.springify()} style={[styles.riderCard, { backgroundColor: '#F0FDF4', borderColor: '#D1FAE5' }]}>
            <View style={[styles.riderAvatarWrapper, { backgroundColor: '#10B981' }]}>
              <Check size={24} color="white" strokeWidth={3} />
            </View>
            <View style={styles.riderInfo}>
              <Text style={[styles.riderLabel, { color: '#059669' }]}>FINANCIAL RECORD</Text>
              <Text style={styles.riderName}>Invoice is Ready</Text>
            </View>
            <TouchableOpacity 
              style={[styles.riderActionBtn, { backgroundColor: '#10B981', borderColor: '#10B981' }]}
              onPress={() => { triggerHaptic(); Linking.openURL(o.invoice_url); }}
            >
              <Text style={{ color: 'white', fontWeight: '900', fontSize: 10 }}>VIEW</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown} layout={Layout.springify()} style={styles.riderCard}>
            <View style={styles.riderAvatarWrapper}>
              <UserCircle size={28} color="#10B981" />
            </View>
            <View style={styles.riderInfo}>
              <Text style={styles.riderLabel}>DELIVERY PARTNER</Text>
              <Text style={styles.riderName}>{o?.rider_name || 'Assigning Rider...'}</Text>
            </View>
            <TouchableOpacity 
              style={styles.riderActionBtn}
              onPress={() => { triggerHaptic(); Linking.openURL(`tel:${o?.rider_phone || '919999999999'}`); }}
            >
              <Phone size={18} color="#1A1A2E" />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Minimal Cancel Button */}
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
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  mapContainer: { height: '55%', backgroundColor: '#F3F4F6' },
  map: { ...StyleSheet.absoluteFillObject },
  
  riderMarker: { width: 44, height: 44, backgroundColor: '#1A1A2E', borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#FFFFFF', shadowColor: '#10B981', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 10 },
  homeMarker: { width: 44, height: 44, backgroundColor: '#10B981', borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#FFFFFF', shadowColor: '#10B981', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 10 },
  
  floatingHeader: { position: 'absolute', top: 60, left: 24 },
  backButton: { width: 48, height: 48, backgroundColor: '#FFFFFF', borderRadius: 24, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 15, elevation: 5 },
  
  statusSheet: { flex: 1, backgroundColor: '#FFFFFF', marginTop: -32, borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 32, paddingTop: 16, shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.05, shadowRadius: 30, elevation: 20 },
  sheetHandle: { width: 48, height: 5, backgroundColor: '#E5E7EB', borderRadius: 3, alignSelf: 'center', marginBottom: 24 },
  
  timeInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 },
  timeLabel: { color: '#9CA3AF', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5 },
  timeValue: { color: '#1A1A2E', fontSize: 36, fontWeight: '900', marginTop: 4, letterSpacing: -1 },
  onTrackBadge: { backgroundColor: '#ECFDF5', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  onTrackText: { color: '#10B981', fontWeight: '900', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 },
  
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 48 },
  statusStep: { alignItems: 'center', width: 64 },
  statusIconWrapper: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 9, marginTop: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },
  progressLine: { flex: 1, height: 3, backgroundColor: '#F3F4F6', marginBottom: 16, borderRadius: 2 },
  
  riderCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 10, elevation: 2 },
  riderAvatarWrapper: { width: 56, height: 56, backgroundColor: '#F9FAFB', borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  riderInfo: { flex: 1 },
  riderLabel: { color: '#9CA3AF', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  riderName: { color: '#1A1A2E', fontSize: 18, fontWeight: '900', marginTop: 2 },
  riderActionBtn: { width: 48, height: 48, backgroundColor: '#F9FAFB', borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  
  cancelBtn: {
      marginTop: 24,
      paddingVertical: 16,
      borderRadius: 20,
      alignItems: 'center',
  },
  cancelBtnText: {
      color: '#EF4444',
      fontWeight: '800',
      fontSize: 12,
      textTransform: 'uppercase',
      letterSpacing: 1.5,
  }
});

export default OrderTrackingScreen;
