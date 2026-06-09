import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Linking, Modal, StyleSheet } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { 
  ArrowLeft, 
  MapPin, 
  User, 
  Phone, 
  Package, 
  CreditCard, 
  XCircle,
  Truck,
  ChevronRight,
  ShieldCheck,
  X
} from 'lucide-react-native';

const AdminOrderDetailScreen = ({ route, navigation }: any) => {
  const { orderId } = route.params;
  const queryClient = useQueryClient();
  const [isRiderModalVisible, setRiderModalVisible] = useState(false);

  const { data: order, isLoading } = useQuery({
    queryKey: ['admin-order-detail', orderId],
    queryFn: () => api.get(`/orders/${orderId}`),
  });

  const { data: ridersData } = useQuery({
    queryKey: ['admin-online-riders'],
    queryFn: () => api.get('/admin/riders'),
    enabled: !!orderId,
  });

  const onlineRiders = ridersData?.riders?.filter((r: any) => r.is_online && !r.current_order_id) || [];

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/orders/${orderId}/cancel`, {}),
    onSuccess: () => {
      Alert.alert('Cancelled', 'Order cancelled and refunded successfully.');
      queryClient.invalidateQueries({ queryKey: ['admin-live-orders'] });
      navigation.goBack();
    },
  });

  const assignRiderMutation = useMutation({
    mutationFn: (riderId: string) => api.post(`/admin/orders/${orderId}/assign`, { riderId }),
    onSuccess: () => {
      setRiderModalVisible(false);
      Alert.alert('Assigned', 'Pilot has been notified of the mission.');
      queryClient.invalidateQueries({ queryKey: ['admin-order-detail', orderId] });
      queryClient.invalidateQueries({ queryKey: ['admin-live-orders'] });
    },
    onError: (err: any) => {
      Alert.alert('Assignment Failed', err.message || 'Could not assign rider.');
    }
  });

  if (isLoading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FF6B35" />
    </View>
  );

  const o = order?.order;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
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
                   <View style={styles.statusDot} />
                   <Text style={styles.headerLabel}>Order Protocol</Text>
                </View>
                <Text style={styles.orderId}>{o.display_id}</Text>
             </View>
             <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{o.status.replace(/_/g, ' ')}</Text>
             </View>
          </View>
        </View>

        <View style={styles.content}>
          {/* Customer Intelligence Card */}
          <View style={styles.infoCard}>
             <View style={styles.cardHeader}>
                <View style={styles.customerInfo}>
                   <View style={styles.iconWrapper}>
                      <User size={22} color="#1A1A2E" />
                   </View>
                   <View style={styles.labelCol}>
                      <Text style={styles.labelSub}>Customer</Text>
                      <Text style={styles.labelMain}>{o.customer_name || 'Premium User'}</Text>
                   </View>
                </View>
                <TouchableOpacity 
                  onPress={() => Linking.openURL(`tel:${o.customer_phone || '91'}`)}
                  style={styles.phoneBtn}
                >
                   <Phone size={20} color="#FF6B35" />
                </TouchableOpacity>
             </View>

             <View style={styles.addressBox}>
                <View style={styles.addressLabelRow}>
                   <MapPin size={14} color="#9CA3AF" style={{ marginRight: 8 }} />
                   <Text style={styles.addressLabel}>Delivery Address</Text>
                </View>
                <Text style={styles.addressText}>
                   {o.address_text || 'Address details missing'}
                </Text>
             </View>
          </View>

          {/* Cargo Details */}
          <View style={styles.cargoSection}>
              <View style={styles.sectionTitleRow}>
                 <Package size={16} color="#1A1A2E" />
                 <Text style={styles.sectionTitle}>Cargo Inventory</Text>
              </View>
              <View style={styles.inventoryCard}>
                  {o.items?.map((item: any, idx: number) => (
                      <View key={item.id || `item-${idx}`} style={[styles.itemRow, idx !== 0 && styles.itemRowBorder]}>
                          <View style={styles.itemMain}>
                             <View style={styles.qtyBadge}>
                                <Text style={styles.qtyText}>{item.quantity}x</Text>
                             </View>
                             <Text style={styles.itemName} numberOfLines={1}>{item.menu_item_name}</Text>
                          </View>
                          <Text style={styles.itemPrice}>₹{item.price_paise / 100}</Text>
                      </View>
                  ))}
                  
                  <View style={styles.totalRow}>
                      <View>
                         <View style={styles.totalLabelRow}>
                            <CreditCard size={14} color="#9CA3AF" />
                            <Text style={styles.totalLabel}>Total Value</Text>
                         </View>
                         <Text style={styles.totalValue}>₹{o.total_amount_paise / 100}</Text>
                      </View>
                      <View style={styles.paymentCol}>
                         <Text style={styles.paymentMethod}>{o.payment_method || 'PREPAID'}</Text>
                         <Text style={styles.paymentStatus}>Status: Paid</Text>
                      </View>
                  </View>
              </View>
          </View>

          {/* Tactical Actions */}
          <View style={styles.actionRow}>
             <TouchableOpacity 
                activeOpacity={0.9}
                style={[styles.actionBtn, o.rider_id ? styles.actionBtnDark : styles.actionBtnOrange]}
                onPress={() => setRiderModalVisible(true)}
                disabled={assignRiderMutation.isPending}
             >
                {assignRiderMutation.isPending ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Truck size={20} color="white" />
                    <Text style={styles.actionBtnText}>
                        {o.rider_id ? 'Change Pilot' : 'Dispatch Rider'}
                    </Text>
                  </>
                )}
             </TouchableOpacity>

             <TouchableOpacity 
                activeOpacity={0.9}
                style={styles.cancelBtn}
                onPress={() => {
                    Alert.alert('protocol Critical', 'Decommission this order and initiate immediate refund?', [
                        { text: 'Abort' },
                        { text: 'Decommission', style: 'destructive', onPress: () => cancelMutation.mutate() }
                    ]);
                }}
             >
                <XCircle size={20} color="#FF4B4B" />
                <Text style={styles.cancelBtnText}>Decommission Order</Text>
             </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Rider Assignment Modal */}
      <Modal
        visible={isRiderModalVisible}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
             <View style={styles.modalHeader}>
                <View>
                   <Text style={styles.modalSub}>Fleet Available</Text>
                   <Text style={styles.modalTitle}>Select Pilot</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => setRiderModalVisible(false)}
                  style={styles.modalCloseBtn}
                >
                   <X size={24} color="#999" />
                </TouchableOpacity>
             </View>

             <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
                {onlineRiders.length === 0 ? (
                  <View style={styles.emptyFleet}>
                     <Truck size={60} color="#D1D5DB" strokeWidth={1} />
                     <Text style={styles.emptyFleetText}>No Online Pilots Available</Text>
                  </View>
                ) : (
                  onlineRiders.map((rider: any, rIdx: number) => (
                    <TouchableOpacity 
                      key={rider.id || `rider-${rIdx}`}
                      onPress={() => assignRiderMutation.mutate(rider.id)}
                      style={styles.riderCard}
                    >
                      <View style={styles.riderInfo}>
                         <View style={styles.riderIconWrapper}>
                            <Truck size={20} color="#FF6B35" />
                         </View>
                         <View>
                            <Text style={styles.riderName}>{rider.name}</Text>
                            <View style={styles.riderBadge}>
                               <ShieldCheck size={10} color="#00D084" />
                               <Text style={styles.riderBadgeText}>Elite Fleet</Text>
                            </View>
                         </View>
                      </View>
                      <ChevronRight size={20} color="#D1D5DB" />
                    </TouchableOpacity>
                  ))
                )}
             </ScrollView>
          </View>
        </View>
      </Modal>
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
  scrollView: {
    flex: 1,
  },
  header: {
    paddingTop: 64,
    paddingHorizontal: 32,
    paddingBottom: 40,
    backgroundColor: '#1A1A2E',
    borderBottomLeftRadius: 48,
    borderBottomRightRadius: 48,
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
    marginBottom: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    backgroundColor: '#FF6B35',
    borderRadius: 4,
    marginRight: 8,
  },
  headerLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 3,
  },
  orderId: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -1,
  },
  statusBadge: {
    backgroundColor: '#00D084',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  statusText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  content: {
    padding: 32,
  },
  infoCard: {
    backgroundColor: '#f9fafb',
    padding: 32,
    borderRadius: 40,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrapper: {
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
  labelCol: {
    marginLeft: 16,
  },
  labelSub: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  labelMain: {
    color: '#1A1A2E',
    fontSize: 18,
    fontWeight: '900',
  },
  phoneBtn: {
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
  addressBox: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  addressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  addressLabel: {
    color: '#9ca3af',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  addressText: {
    color: '#4B5563',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 22,
  },
  cargoSection: {
    marginBottom: 32,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  sectionTitle: {
    color: '#1A1A2E',
    fontWeight: '900',
    textTransform: 'uppercase',
    fontSize: 11,
    letterSpacing: 2,
    marginLeft: 12,
  },
  inventoryCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    borderRadius: 32,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  itemRowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#f9fafb',
  },
  itemMain: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  qtyBadge: {
    width: 32,
    height: 32,
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  qtyText: {
    color: '#1A1A2E',
    fontWeight: '900',
    fontSize: 12,
  },
  itemName: {
    color: '#1A1A2E',
    fontWeight: '900',
    fontSize: 12,
    flex: 1,
  },
  itemPrice: {
    color: '#9ca3af',
    fontWeight: '700',
    fontSize: 12,
  },
  totalRow: {
    backgroundColor: '#f9fafb',
    padding: 24,
    borderRadius: 24,
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  totalLabel: {
    color: '#9ca3af',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginLeft: 8,
  },
  totalValue: {
    color: '#1A1A2E',
    fontWeight: '900',
    fontSize: 24,
    marginTop: 4,
    letterSpacing: -1,
  },
  paymentCol: {
    alignItems: 'flex-end',
  },
  paymentMethod: {
    color: '#FF6B35',
    fontWeight: '900',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  paymentStatus: {
    color: '#00D084',
    fontWeight: '900',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },
  actionRow: {
    gap: 16,
    marginBottom: 80,
  },
  actionBtn: {
    height: 80,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  actionBtnDark: {
    backgroundColor: '#1A1A2E',
  },
  actionBtnOrange: {
    backgroundColor: '#FF6B35',
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 3,
    marginLeft: 16,
  },
  cancelBtn: {
    backgroundColor: '#FEF2F2',
    height: 80,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  cancelBtnText: {
    color: '#EF4444',
    fontWeight: '900',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 3,
    marginLeft: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 48,
    borderTopRightRadius: 48,
    padding: 32,
    minHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
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
  modalCloseBtn: {
    width: 48,
    height: 48,
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    paddingBottom: 40,
  },
  emptyFleet: {
    paddingVertical: 80,
    alignItems: 'center',
    opacity: 0.3,
  },
  emptyFleetText: {
    color: '#9ca3af',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 4,
    fontSize: 10,
    marginTop: 24,
    textAlign: 'center',
  },
  riderCard: {
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
  riderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  riderIconWrapper: {
    width: 48,
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  riderName: {
    color: '#1A1A2E',
    fontWeight: '900',
    fontSize: 18,
  },
  riderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  riderBadgeText: {
    color: '#9ca3af',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginLeft: 4,
  },
});

export default AdminOrderDetailScreen;
