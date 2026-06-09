import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ArrowLeft, 
  MapPin, 
  Phone, 
  Navigation, 
  Package, 
  CreditCard, 
  ChevronRight,
  Info,
  ExternalLink
} from 'lucide-react-native';

import { getSocket } from '../socket/client';

const AssignedOrderScreen = ({ route, navigation }: any) => {
  const { order } = route.params;
  const [currentStatus, setCurrentStatus] = useState(order.status);
  const queryClient = useQueryClient();
  const socket = getSocket();

  React.useEffect(() => {
    if (socket) {
      socket.emit('join_order', order.id);
      socket.on('order_status_update', (data: any) => {
          if (data.orderId === order.id) {
              setCurrentStatus(data.status);
              queryClient.invalidateQueries({ queryKey: ['rider-active-order'] });
          }
      });
      return () => {
          socket.off('order_status_update');
      };
    }
  }, [socket, order.id]);

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => api.patch(`/riders/orders/${order.id}/status`, { status }),
    onSuccess: (data: any) => {
      setCurrentStatus(data.status || data.success ? data.status : currentStatus);
      queryClient.invalidateQueries({ queryKey: ['rider-active-order'] });
      if (data.status === 'out_for_delivery') {
        Alert.alert('Delivery Started', 'Proceed to the customer location.');
      }
    },
  });

  const unclaimMutation = useMutation({
    mutationFn: () => api.post(`/riders/orders/${order.id}/unclaim`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rider-active-order'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
      Alert.alert('Mission Released', 'The order has been returned to the pool.');
      navigation.goBack();
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Could not release mission');
    }
  });

  const handleAction = () => {
    switch (currentStatus) {
      case 'ready_for_pickup':
        updateStatusMutation.mutate('out_for_delivery');
        break;
      case 'out_for_delivery':
        navigation.navigate('DeliveryOTP', { orderId: order.id });
        break;
      default:
        break;
    }
  };

  const getButtonText = () => {
    if (['confirmed', 'preparing'].includes(currentStatus)) return 'WAITING FOR KITCHEN';
    if (currentStatus === 'ready_for_pickup') return 'START DELIVERY';
    if (currentStatus === 'out_for_delivery') return 'ARRIVED AT CUSTOMER';
    return 'VERIFY DELIVERY';
  };

  const openDirections = () => {
    const isGoingToKitchen = ['confirmed', 'preparing', 'ready_for_pickup'].includes(currentStatus);
    const lat = isGoingToKitchen ? (order.kitchen_lat || '12.9725') : (order.lat || '12.9716');
    const lng = isGoingToKitchen ? (order.kitchen_lng || '77.5960') : (order.lng || '77.5946');
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    Linking.openURL(url);
  };

  return (
    <View style={styles.container}>
      {/* Premium Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          activeOpacity={0.7}
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
        >
          <ArrowLeft size={24} color="white" />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <View>
            <View style={styles.headerLabelRow}>
                <View style={styles.headerDot} />
                <Text style={styles.headerLabelText}>Mission Control</Text>
            </View>
            <Text style={styles.headerOrderId}>{order.display_id}</Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>{currentStatus.replace(/_/g, ' ')}</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Customer Detail Card */}
        <View style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <View style={styles.destIconWrapper}>
              <MapPin size={28} color="#FF6B35" />
            </View>
            <View style={styles.destLabelCol}>
              <Text style={styles.destSubLabel}>Delivery Destination</Text>
              <Text style={styles.destTitle}>{order.customer_name || 'Premium Customer'}</Text>
            </View>
            <TouchableOpacity 
              onPress={() => Linking.openURL(`tel:${order.customer_phone || '919999999999'}`)}
              style={styles.phoneBtn}
            >
              <Phone size={20} color="#1A1A2E" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.addressBox}>
             <Text style={styles.addressText}>
                {order.customer_address_text || order.address_text || 'Delivery address not provided'}
             </Text>
          </View>

          <TouchableOpacity 
            activeOpacity={0.8}
            style={styles.navBtn}
            onPress={openDirections}
          >
            <Navigation size={20} color="white" style={{ marginRight: 12 }} />
            <Text style={styles.navBtnText}>Open Navigation</Text>
            <ExternalLink size={14} color="white" style={{ marginLeft: 8, opacity: 0.5 }} />
          </TouchableOpacity>

          {order.special_instructions && (
            <View style={styles.instructionCard}>
              <Info size={18} color="#FF6B35" style={{ marginRight: 16, marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.instructionLabel}>Customer Note</Text>
                <Text style={styles.instructionText}>{order.special_instructions}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Order Contents */}
        <View style={styles.contentsCard}>
          <View style={styles.contentsHeader}>
            <Package size={20} color="#9CA3AF" style={{ marginRight: 12 }} />
            <Text style={styles.contentsHeaderText}>Package Contents</Text>
          </View>
          
          {order.items?.map((item: any, idx: number) => (
            <View key={idx} style={styles.itemRow}>
              <View style={styles.itemQtyWrapper}>
                <Text style={styles.itemQtyText}>{item.quantity}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemNameText}>{item.menu_item_name}</Text>
                <Text style={styles.itemSubText}>PREPARED BY KITCHEN</Text>
              </View>
              <View style={styles.itemStatusDot} />
            </View>
          ))}

          <View style={styles.paymentSummaryRow}>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <CreditCard size={14} color="#9CA3AF" style={{ marginRight: 8 }} />
                <Text style={styles.paymentLabel}>Payment</Text>
              </View>
              <Text style={styles.paymentValue}>{order.payment_method || 'PREPAID'}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.paymentLabel}>Collect Cash</Text>
              <Text style={styles.cashValue}>₹{order.payment_method?.toLowerCase() === 'cod' ? order.total_amount_paise / 100 : '0.00'}</Text>
            </View>
          </View>
        </View>

        {/* Safety & Help */}
        <View style={styles.helpRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Info size={14} color="#D1D5DB" />
            <Text style={styles.helpText}>Contact Velto Support for assistance</Text>
          </View>
          <TouchableOpacity 
            onPress={() => {
              Alert.alert('Release Mission', 'Are you sure you want to drop this delivery? It will be returned to the pool for another rider.', [
                { text: 'Back', style: 'cancel' },
                { text: 'Release Delivery', style: 'destructive', onPress: () => unclaimMutation.mutate() }
              ]);
            }}
          >
            <Text style={styles.cancelLinkText}>Report Issue / Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Action Footer */}
      <View style={styles.footer}>
        <TouchableOpacity 
          activeOpacity={0.9}
          style={[styles.actionBtn, (updateStatusMutation.isPending || ['confirmed', 'preparing'].includes(currentStatus)) ? styles.actionBtnDisabled : styles.actionBtnEnabled]}
          onPress={handleAction}
          disabled={updateStatusMutation.isPending || ['confirmed', 'preparing'].includes(currentStatus)}
        >
          {updateStatusMutation.isPending ? (
            <ActivityIndicator color="white" />
          ) : (
            <View style={styles.actionBtnContent}>
                <Text style={styles.actionBtnText}>{getButtonText()}</Text>
                {!['confirmed', 'preparing'].includes(currentStatus) && (
                  <ChevronRight size={20} color="white" strokeWidth={3} style={{ marginLeft: 8 }} />
                )}
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingTop: 64,
    paddingHorizontal: 32,
    paddingBottom: 48,
    backgroundColor: '#1A1A2E',
    borderBottomLeftRadius: 56,
    borderBottomRightRadius: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 10,
  },
  backButton: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerDot: {
    width: 8,
    height: 8,
    backgroundColor: '#FF6B35',
    borderRadius: 4,
    marginRight: 8,
  },
  headerLabelText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 3,
  },
  headerOrderId: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: -1,
  },
  statusBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  statusBadgeText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 160,
  },
  detailCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    borderRadius: 40,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    marginBottom: 32,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  destIconWrapper: {
    width: 56,
    height: 56,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 20,
  },
  destLabelCol: {
    flex: 1,
  },
  destSubLabel: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  destTitle: {
    color: '#1A1A2E',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 4,
  },
  phoneBtn: {
    width: 48,
    height: 48,
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  addressBox: {
    backgroundColor: '#f9fafb',
    padding: 24,
    borderRadius: 24,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  addressText: {
    color: '#4B5563',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 24,
  },
  navBtn: {
    width: '100%',
    height: 72,
    backgroundColor: '#1A1A2E',
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
  },
  navBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  instructionCard: {
    marginTop: 32,
    backgroundColor: 'rgba(255, 107, 53, 0.05)',
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.1)',
    flexDirection: 'row',
  },
  instructionLabel: {
    color: '#FF6B35',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 4,
  },
  instructionText: {
    color: '#1A1A2E',
    fontWeight: '700',
    fontSize: 12,
    lineHeight: 20,
  },
  contentsCard: {
    backgroundColor: 'rgba(249, 250, 251, 0.3)',
    borderRadius: 40,
    padding: 32,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    marginBottom: 32,
  },
  contentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  contentsHeaderText: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#f9fafb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  itemQtyWrapper: {
    width: 40,
    height: 40,
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 20,
  },
  itemQtyText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 14,
  },
  itemNameText: {
    color: '#1A1A2E',
    fontWeight: '900',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  itemSubText: {
    color: '#9ca3af',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },
  itemStatusDot: {
    width: 8,
    height: 8,
    backgroundColor: '#22C55E',
    borderRadius: 4,
  },
  paymentSummaryRow: {
    marginTop: 24,
    paddingTop: 32,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentLabel: {
    color: '#9ca3af',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  paymentValue: {
    color: '#1A1A2E',
    fontWeight: '900',
    fontSize: 14,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cashValue: {
    color: '#1A1A2E',
    fontWeight: '900',
    fontSize: 24,
    marginTop: 4,
  },
  helpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  helpText: {
    color: '#d1d5db',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontSize: 9,
    marginLeft: 8,
  },
  cancelLinkText: {
    color: '#EF4444',
    fontWeight: '900',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 48,
    left: 24,
    right: 24,
  },
  actionBtn: {
    height: 96,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  actionBtnEnabled: {
    backgroundColor: '#FF6B35',
  },
  actionBtnDisabled: {
    backgroundColor: '#e5e7eb',
  },
  actionBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 4,
  },
});

export default AssignedOrderScreen;
