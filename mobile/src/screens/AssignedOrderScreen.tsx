import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking, ActivityIndicator, Alert, StyleSheet, StatusBar } from 'react-native';
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
  ExternalLink,
  ShieldAlert,
  Clock
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
    const lat = isGoingToKitchen ? (order.kitchen_lat || order.lat) : (order.lat);
    const lng = isGoingToKitchen ? (order.kitchen_lng || order.lng) : (order.lng);
    
    if (!lat || !lng) {
      Alert.alert('Location Error', 'Target location is missing');
      return;
    }
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    Linking.openURL(url);
  };

  // Render high-tech order progress steps indicator
  const renderStepper = () => {
    const steps = [
      { key: 'preparing', label: 'PREP' },
      { key: 'ready_for_pickup', label: 'PICKUP' },
      { key: 'out_for_delivery', label: 'TRANSIT' },
      { key: 'delivered', label: 'DONE' }
    ];

    const currentIdx = steps.findIndex(s => s.key === currentStatus);
    
    return (
      <View style={styles.stepperContainer}>
        {steps.map((step, idx) => {
          const isActive = idx <= currentIdx;
          const isCurrent = idx === currentIdx;
          return (
            <React.Fragment key={step.key}>
              <View style={styles.stepDotContainer}>
                <View style={[
                  styles.stepDot,
                  isActive && styles.stepDotActive,
                  isCurrent && styles.stepDotCurrent
                ]} />
                <Text style={[
                  styles.stepLabel,
                  isActive && styles.stepLabelActive
                ]}>
                  {step.label}
                </Text>
              </View>
              {idx < steps.length - 1 && (
                <View style={[
                  styles.stepLine,
                  idx < currentIdx && styles.stepLineActive
                ]} />
              )}
            </React.Fragment>
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      {/* Premium Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity 
            activeOpacity={0.7}
            onPress={() => navigation.goBack()} 
            style={styles.backButton}
          >
            <ArrowLeft size={20} color="white" />
          </TouchableOpacity>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>{currentStatus.replace(/_/g, ' ')}</Text>
          </View>
        </View>
        
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerLabelText}>Active Mission</Text>
            <Text style={styles.headerOrderId}>{order.display_id}</Text>
          </View>
        </View>
        
        {renderStepper()}
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Destination Card */}
        <View style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <View style={styles.destIconWrapper}>
              <MapPin size={24} color="#FF6B35" />
            </View>
            <View style={styles.destLabelCol}>
              <Text style={styles.destSubLabel}>
                {['confirmed', 'preparing', 'ready_for_pickup'].includes(currentStatus) 
                  ? 'Pickup Location' 
                  : 'Customer Destination'}
              </Text>
              <Text style={styles.destTitle} numberOfLines={1}>
                {['confirmed', 'preparing', 'ready_for_pickup'].includes(currentStatus)
                  ? (order.kitchen_name || 'Kitchen Hub')
                  : (order.customer_name || 'Premium Customer')}
              </Text>
            </View>
            <TouchableOpacity 
              onPress={() => Linking.openURL(`tel:${order.customer_phone || '919999999999'}`)}
              style={styles.phoneBtn}
            >
              <Phone size={18} color="#FF6B35" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.addressBox}>
             <Text style={styles.addressText}>
                {['confirmed', 'preparing', 'ready_for_pickup'].includes(currentStatus)
                  ? (order.kitchen_address || 'Kitchen Address Not Specified')
                  : (order.customer_address_text || order.address_text || 'Delivery Address Not Provided')}
             </Text>
          </View>

          <TouchableOpacity 
            activeOpacity={0.8}
            style={styles.navBtn}
            onPress={openDirections}
          >
            <Navigation size={18} color="white" style={{ marginRight: 8 }} />
            <Text style={styles.navBtnText}>Launch HUD Navigation</Text>
            <ExternalLink size={12} color="white" style={{ marginLeft: 8, opacity: 0.5 }} />
          </TouchableOpacity>

          {order.special_instructions && (
            <View style={styles.instructionCard}>
              <Info size={16} color="#FF6B35" style={{ marginRight: 12, marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.instructionLabel}>Customer Dispatch Note</Text>
                <Text style={styles.instructionText}>{order.special_instructions}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Order Contents */}
        <View style={styles.contentsCard}>
          <View style={styles.contentsHeader}>
            <Package size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
            <Text style={styles.contentsHeaderText}>Cargo Inventory</Text>
          </View>
          
          {order.items?.map((item: any, idx: number) => (
            <View key={idx} style={styles.itemRow}>
              <View style={styles.itemQtyWrapper}>
                <Text style={styles.itemQtyText}>{item.quantity}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemNameText}>{item.menu_item_name}</Text>
                <Text style={styles.itemSubText}>SEALED CONTAINER</Text>
              </View>
              <View style={styles.itemStatusDot} />
            </View>
          ))}

          <View style={styles.paymentSummaryRow}>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <CreditCard size={12} color="#94A3B8" style={{ marginRight: 6 }} />
                <Text style={styles.paymentLabel}>Method</Text>
              </View>
              <Text style={styles.paymentValue}>{order.payment_method || 'PREPAID'}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.paymentLabel}>Collect Amount</Text>
              <Text style={styles.cashValue}>₹{order.payment_method?.toLowerCase() === 'cod' ? order.total_amount_paise / 100 : '0.00'}</Text>
            </View>
          </View>
        </View>

        {/* Release Order */}
        <TouchableOpacity 
          activeOpacity={0.8}
          style={styles.releaseBtn}
          onPress={() => {
            Alert.alert('Release Mission', 'Are you sure you want to drop this delivery? It will be returned to the pool for another rider.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Release Delivery', style: 'destructive', onPress: () => unclaimMutation.mutate() }
            ]);
          }}
        >
          <ShieldAlert size={16} color="#EF4444" style={{ marginRight: 8 }} />
          <Text style={styles.releaseBtnText}>Release Mission / Decline</Text>
        </TouchableOpacity>
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
    backgroundColor: '#0B0C10',
  },
  header: {
    paddingTop: 64,
    paddingHorizontal: 24,
    paddingBottom: 28,
    backgroundColor: '#0D0E15',
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    backgroundColor: '#161726',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  headerContent: {
    marginBottom: 20,
  },
  headerLabelText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 4,
  },
  headerOrderId: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  statusBadge: {
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusBadgeText: {
    color: '#FF6B35',
    fontWeight: '900',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  // Stepper Visual UI
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  stepDotContainer: {
    alignItems: 'center',
    zIndex: 10,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2C2D42',
    borderWidth: 2,
    borderColor: '#0D0E15',
  },
  stepDotActive: {
    backgroundColor: '#FF6B35',
  },
  stepDotCurrent: {
    borderColor: '#FFFFFF',
    backgroundColor: '#FF6B35',
    transform: [{ scale: 1.25 }],
  },
  stepLabel: {
    color: '#64748B',
    fontSize: 8,
    fontWeight: '900',
    marginTop: 6,
    letterSpacing: 0.5,
  },
  stepLabelActive: {
    color: '#FFFFFF',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#2C2D42',
    marginHorizontal: -4,
    marginTop: -14, // align with dot vertical center
  },
  stepLineActive: {
    backgroundColor: '#FF6B35',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 160,
  },
  detailCard: {
    backgroundColor: '#161726',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 28,
    padding: 24,
    marginBottom: 24,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  destIconWrapper: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  destLabelCol: {
    flex: 1,
  },
  destSubLabel: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  destTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  phoneBtn: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.15)',
  },
  addressBox: {
    backgroundColor: '#0D0E15',
    padding: 18,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  addressText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 22,
  },
  navBtn: {
    width: '100%',
    height: 60,
    backgroundColor: '#FF6B35',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  navBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  instructionCard: {
    marginTop: 20,
    backgroundColor: 'rgba(255, 107, 53, 0.06)',
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.12)',
    flexDirection: 'row',
  },
  instructionLabel: {
    color: '#FF6B35',
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  instructionText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
    lineHeight: 18,
  },
  contentsCard: {
    backgroundColor: '#161726',
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 24,
  },
  contentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  contentsHeaderText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#0D0E15',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  itemQtyWrapper: {
    width: 32,
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  itemQtyText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
  },
  itemNameText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  itemSubText: {
    color: '#64748B',
    fontSize: 8,
    fontWeight: '900',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  itemStatusDot: {
    width: 6,
    height: 6,
    backgroundColor: '#22C55E',
    borderRadius: 3,
  },
  paymentSummaryRow: {
    marginTop: 16,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentLabel: {
    color: '#94A3B8',
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  paymentValue: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  cashValue: {
    color: '#22C55E',
    fontWeight: '900',
    fontSize: 22,
    marginTop: 2,
  },
  releaseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 20,
    height: 56,
    marginBottom: 16,
  },
  releaseBtnText: {
    color: '#EF4444',
    fontWeight: '900',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 24,
    right: 24,
  },
  actionBtn: {
    height: 80,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  actionBtnEnabled: {
    backgroundColor: '#FF6B35',
  },
  actionBtnDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  actionBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 3,
  },
});

export default AssignedOrderScreen;
