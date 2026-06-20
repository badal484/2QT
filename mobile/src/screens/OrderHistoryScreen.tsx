import { Package, RotateCcw, ArrowLeft, Bike, AlertTriangle, Download, FileText } from 'lucide-react-native';
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, Alert, Linking, Modal, Pressable, TextInput } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { ENV } from '../config/env';
import { useDispatch } from 'react-redux';
import { addItem } from '../store/slices/cartSlice';
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const hapticOptions = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };

const STATUS_META: Record<string, { bg: string; text: string; label: string }> = {
  pending_payment:  { bg: '#FFF7ED', text: '#C2410C', label: 'Pending Payment' },
  confirmed:        { bg: '#EFF6FF', text: '#1D4ED8', label: 'Confirmed' },
  preparing:        { bg: '#FFFBEB', text: '#B45309', label: 'Preparing' },
  ready_for_pickup: { bg: '#FFF7ED', text: '#EA580C', label: 'Ready for Pickup' },
  out_for_delivery: { bg: '#ECFEFF', text: '#0E7490', label: 'On the Way' },
  delivered:        { bg: '#F0FDF4', text: '#15803D', label: 'Delivered' },
  cancelled:        { bg: '#FEF2F2', text: '#DC2626', label: 'Cancelled' },
};

const getStatusMeta = (s: string) =>
  STATUS_META[s] ?? { bg: '#F3F4F6', text: '#374151', label: s.replace(/_/g, ' ') };

const BACKEND_URL = ENV.API_URL.replace('/api/v1', '');

const COMPLAINT_TYPES = [
  { key: 'wrong_item',     label: 'Wrong item delivered' },
  { key: 'missing_item',   label: 'Item was missing' },
  { key: 'quality_issue',  label: 'Quality was bad' },
  { key: 'late_delivery',  label: 'Very late delivery' },
  { key: 'rude_rider',     label: 'Rude delivery rider' },
  { key: 'other',          label: 'Other issue' },
];

const OrderHistoryScreen = ({ navigation }: any) => {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState<Set<string>>(new Set());
  const [complaintOrderId, setComplaintOrderId] = useState<string | null>(null);
  const [complaintType, setComplaintType] = useState('wrong_item');
  const [complaintDesc, setComplaintDesc] = useState('');
  const [complaintLoading, setComplaintLoading] = useState(false);

  const openInvoice = async (orderId: string) => {
    setInvoiceLoading(prev => new Set(prev).add(orderId));
    try {
      const res = await api.get(`/orders/${orderId}/invoice`);
      const url = res.invoiceUrl?.startsWith('http')
        ? res.invoiceUrl
        : `${BACKEND_URL}${res.invoiceUrl}`;
      await Linking.openURL(url);
    } catch {
      Alert.alert('Error', 'Could not generate invoice. Please try again.');
    } finally {
      setInvoiceLoading(prev => { const s = new Set(prev); s.delete(orderId); return s; });
    }
  };

  const submitComplaint = async () => {
    if (!complaintOrderId || !complaintDesc.trim()) {
      Alert.alert('Missing info', 'Please describe your issue.');
      return;
    }
    setComplaintLoading(true);
    try {
      await api.post('/complaints', {
        order_id: complaintOrderId,
        type: complaintType,
        description: complaintDesc.trim(),
      });
      setComplaintOrderId(null);
      setComplaintDesc('');
      setComplaintType('wrong_item');
      Alert.alert('Submitted', 'We have received your complaint and will respond within 2 hours.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not submit complaint. Please try again.');
    } finally {
      setComplaintLoading(false);
    }
  };

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['order-history'],
    queryFn: () => api.get('/orders/mine'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.post(`/orders/${id}/cancel`),
    onSuccess: () => {
      setCancelTargetId(null);
      queryClient.invalidateQueries({ queryKey: ['order-history'] });
    },
    onError: () => {
      setCancelTargetId(null);
      Alert.alert('Error', 'Could not cancel the order.');
    },
  });

  const orders = ordersData?.orders || [];

  if (isLoading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#10B981" />
      <Text style={styles.loadingText}>Fetching Orders...</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 16, 40) }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
            navigation.goBack();
          }}
        >
          <ArrowLeft size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <View style={{ marginLeft: 16 }}>
          <Text style={styles.headerTitle}>Your Orders</Text>
          <Text style={styles.headerSub}>Past & Active Deliveries</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {orders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrapper}>
              <Package size={32} color="#10B981" />
            </View>
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptySubText}>Your delicious journey is just one tap away.</Text>
            <TouchableOpacity
              style={styles.browseBtn}
              onPress={() => navigation.navigate('Home')}
            >
              <Text style={styles.browseBtnText}>Browse Menu</Text>
            </TouchableOpacity>
          </View>
        ) : (
          orders.map((order: any, index: number) => (
            <Animated.View key={order.id} entering={FadeInDown.delay(index * 80)}>
              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.orderCard}
                onPress={() => ['delivered', 'cancelled'].includes(order.status) ? null : navigation.navigate('OrderConfirmed', { orderId: order.id })}
              >
                <View style={styles.orderCardHeader}>
                  <View>
                    <Text style={styles.orderIdText}>{order.display_id}</Text>
                    <Text style={styles.orderDateText}>
                      {new Date(order.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} • {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusMeta(order.status).bg }]}>
                      <View style={[styles.statusDot, { backgroundColor: getStatusMeta(order.status).text }]} />
                      <Text style={[styles.statusBadgeText, { color: getStatusMeta(order.status).text }]}>
                        {getStatusMeta(order.status).label}
                      </Text>
                    </View>
                    {order.payment_method === 'cod' && order.payment_status === 'cod_pending' && (
                      <View style={styles.codBadge}>
                        <Text style={styles.codBadgeText}>Pay at Door</Text>
                      </View>
                    )}
                  </View>
                </View>

                {order.items && order.items.length > 0 && (
                  <View style={styles.itemsListContainer}>
                    {order.items.map((item: any, idx: number) => (
                      <View key={idx} style={styles.itemRow}>
                        <View style={styles.itemBadge}>
                          <Text style={styles.itemQty}>{item.quantity}x</Text>
                        </View>
                        <Text style={styles.itemName} numberOfLines={1}>{item.menu_item_name}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.orderCardFooter}>
                  <View style={styles.footerTotalRow}>
                    <Text style={styles.footerLabel}>
                      {order.payment_method === 'cod' && order.payment_status === 'cod_pending'
                        ? 'Pay at Door'
                        : 'Total Paid'}
                    </Text>
                    <Text style={[
                      styles.footerValue,
                      order.payment_method === 'cod' && order.payment_status === 'cod_pending' && { color: '#F59E0B' }
                    ]}>
                      ₹{(order.total_amount_paise / 100).toFixed(2)}
                    </Text>
                  </View>

                  {!['delivered', 'cancelled'].includes(order.status) ? (
                    <View style={styles.footerBtnRow}>
                      {['pending_payment', 'confirmed'].includes(order.status) && (
                        <TouchableOpacity
                          style={styles.cancelBtn}
                          onPress={() => {
                            ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
                            setCancelTargetId(order.id);
                          }}
                        >
                          <Text style={styles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.trackBtn}
                        onPress={() => {
                          ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
                          navigation.navigate('OrderConfirmed', { orderId: order.id });
                        }}
                      >
                        <Bike size={14} color="white" style={{ marginRight: 6 }} />
                        <Text style={styles.trackBtnText}>Track Order</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row' }}>
                      {order.status === 'delivered' && (
                        <>
                          <TouchableOpacity
                            style={[styles.reorderBtn, styles.invoiceBtn]}
                            onPress={() => openInvoice(order.id)}
                            disabled={invoiceLoading.has(order.id)}
                          >
                            {invoiceLoading.has(order.id)
                              ? <ActivityIndicator size="small" color="#10B981" />
                              : <>
                                  <Download size={13} color="#10B981" style={{ marginRight: 6 }} />
                                  <Text style={[styles.reorderBtnText, { color: '#10B981' }]}>Invoice</Text>
                                </>
                            }
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.reorderBtn, { backgroundColor: '#FEF2F2', marginLeft: 6 }]}
                            onPress={() => {
                              ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
                              setComplaintOrderId(order.id);
                            }}
                          >
                            <AlertTriangle size={13} color="#EF4444" style={{ marginRight: 6 }} />
                            <Text style={[styles.reorderBtnText, { color: '#EF4444' }]}>Issue</Text>
                          </TouchableOpacity>
                        </>
                      )}
                      <TouchableOpacity
                        style={styles.reorderBtn}
                        onPress={async () => {
                          ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
                          try {
                            const menu = await api.get(`/menu?zoneId=${order.zone_id}`);
                            const currentItems = menu.items || [];
                            const availableItems = order.items.filter((oldItem: any) =>
                              currentItems.find((ci: any) => ci.id === oldItem.menu_item_id && ci.available)
                            );
                            if (availableItems.length === 0) {
                              Alert.alert('Unavailable', 'None of the items from this past order are available today.');
                              return;
                            }
                            const addItems = () => {
                              availableItems.forEach((item: any) => {
                                const menuItem = currentItems.find((ci: any) => ci.id === item.menu_item_id);
                                dispatch(addItem({
                                  menuItemId: item.menu_item_id,
                                  name: item.menu_item_name,
                                  pricePaise: menuItem.price_paise,
                                  quantity: item.quantity,
                                  photoUrl: menuItem.photo_url,
                                  isVeg: menuItem.is_veg,
                                  kitchenId: order.kitchen_id
                                }));
                              });
                              if (availableItems.length < order.items.length) {
                                Alert.alert('Partial Reorder', 'Some items were sold out and were skipped.');
                              }
                              navigation.navigate('Cart');
                            };
                            Alert.alert('Reorder', 'Add these items to your cart?', [
                              { text: 'Cancel', style: 'cancel' },
                              { text: 'Add to Cart', onPress: addItems }
                            ]);
                          } catch (e) {
                            Alert.alert('Error', 'Could not validate menu availability. Please try again.');
                          }
                        }}
                      >
                        <RotateCcw size={14} color="#1A1A2E" style={{ marginRight: 6 }} />
                        <Text style={styles.reorderBtnText}>Reorder</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </Animated.View>
          ))
        )}
      </ScrollView>

      {/* Complaint Modal */}
      <Modal
        visible={!!complaintOrderId}
        transparent
        animationType="slide"
        onRequestClose={() => setComplaintOrderId(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setComplaintOrderId(null)}>
          <Pressable style={[styles.modalCard, { maxHeight: '80%' }]} onPress={() => {}}>
            <Text style={styles.modalTitle}>Report an Issue</Text>
            <Text style={styles.modalSub}>We'll review this and respond within 2 hours.</Text>

            <Text style={[styles.modalSub, { fontWeight: '700', color: '#1A1A2E', marginTop: 16, marginBottom: 8 }]}>What went wrong?</Text>
            {COMPLAINT_TYPES.map(ct => (
              <TouchableOpacity
                key={ct.key}
                onPress={() => setComplaintType(ct.key)}
                style={{
                  flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
                  paddingHorizontal: 14, borderRadius: 12, marginBottom: 6,
                  backgroundColor: complaintType === ct.key ? '#FFF7ED' : '#F9FAFB',
                  borderWidth: 1.5,
                  borderColor: complaintType === ct.key ? '#FF6B35' : '#F3F4F6',
                }}
              >
                <View style={{
                  width: 16, height: 16, borderRadius: 8, borderWidth: 2,
                  borderColor: complaintType === ct.key ? '#FF6B35' : '#D1D5DB',
                  backgroundColor: complaintType === ct.key ? '#FF6B35' : 'transparent',
                  marginRight: 10,
                }} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#1A1A2E' }}>{ct.label}</Text>
              </TouchableOpacity>
            ))}

            <Text style={[styles.modalSub, { fontWeight: '700', color: '#1A1A2E', marginTop: 12, marginBottom: 6 }]}>Describe the issue</Text>
            <TextInput
              style={{
                borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14,
                paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#F9FAFB',
                fontSize: 13, color: '#1A1A2E', minHeight: 80, textAlignVertical: 'top',
                marginBottom: 16,
              }}
              placeholder="e.g. I received biryani instead of pasta..."
              placeholderTextColor="#9CA3AF"
              multiline
              value={complaintDesc}
              onChangeText={setComplaintDesc}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalKeepBtn} onPress={() => setComplaintOrderId(null)} activeOpacity={0.8}>
                <Text style={styles.modalKeepText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { backgroundColor: '#EF4444' }]}
                onPress={submitComplaint}
                disabled={complaintLoading}
                activeOpacity={0.8}
              >
                {complaintLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.modalCancelText}>Submit</Text>
                }
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Cancel Confirmation Modal */}
      <Modal
        visible={!!cancelTargetId}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelTargetId(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setCancelTargetId(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalIconWrap}>
              <AlertTriangle size={28} color="#EF4444" strokeWidth={2} />
            </View>
            <Text style={styles.modalTitle}>Cancel Order?</Text>
            <Text style={styles.modalSub}>This action cannot be undone. Your order will be cancelled immediately.</Text>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalKeepBtn}
                onPress={() => setCancelTargetId(null)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalKeepText}>Keep Order</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => cancelTargetId && cancelMutation.mutate(cancelTargetId)}
                activeOpacity={0.8}
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.modalCancelText}>Yes, Cancel</Text>
                }
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  loadingContainer: { flex: 1, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 16, color: '#9CA3AF', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, fontSize: 10 },
  header: { paddingHorizontal: 24, paddingBottom: 24, flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 40, height: 40, backgroundColor: '#FFFFFF', borderRadius: 20, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  headerTitle: { color: '#1A1A2E', fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  headerSub: { color: '#9CA3AF', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, fontSize: 10, marginTop: 4 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyIconWrapper: { width: 80, height: 80, backgroundColor: '#FFFFFF', borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  emptyTitle: { color: '#1A1A2E', fontSize: 20, fontWeight: '900' },
  emptySubText: { color: '#6B7280', textAlign: 'center', marginTop: 8, paddingHorizontal: 40, fontWeight: '500' },
  browseBtn: { marginTop: 32, backgroundColor: '#10B981', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 24, shadowColor: '#10B981', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 8 },
  browseBtnText: { color: '#fff', fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, fontSize: 12 },

  orderCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  orderCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  orderIdText: { color: '#1A1A2E', fontSize: 16, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  orderDateText: { color: '#9CA3AF', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, gap: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusBadgeText: { fontWeight: '800', fontSize: 10, letterSpacing: 0.2 },
  codBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  codBadgeText: { color: '#B45309', fontWeight: '800', fontSize: 9, letterSpacing: 0.3 },

  itemsListContainer: { marginBottom: 20, backgroundColor: '#F9FAFB', padding: 12, borderRadius: 16 },
  itemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  itemBadge: { backgroundColor: '#FFFFFF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginRight: 8, borderWidth: 1, borderColor: '#F3F4F6' },
  itemQty: { color: '#10B981', fontWeight: '900', fontSize: 11 },
  itemName: { color: '#4B5563', fontWeight: '600', fontSize: 13, flex: 1 },

  orderCardFooter: { flexDirection: 'column', paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  footerTotalRow: { marginBottom: 12 },
  footerBtnRow: { flexDirection: 'row' },
  footerLabel: { color: '#9CA3AF', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  footerValue: { color: '#1A1A2E', fontWeight: '900', fontSize: 18, marginTop: 2 },

  cancelBtn: { flex: 1, borderWidth: 1.5, borderColor: '#EF4444', paddingVertical: 12, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  cancelBtnText: { color: '#EF4444', fontWeight: '800', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  trackBtn: { flex: 1, backgroundColor: '#10B981', paddingVertical: 12, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  trackBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  reorderBtn: { flex: 1, backgroundColor: '#F3F4F6', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  invoiceBtn: { backgroundColor: '#ECFDF5', marginRight: 8, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)' },
  reorderBtnText: { color: '#1A1A2E', fontWeight: '800', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },

  // Cancel modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: 28, paddingHorizontal: 28, paddingVertical: 32, width: '100%', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.15, shadowRadius: 40, elevation: 24 },
  modalIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#1A1A2E', marginBottom: 8 },
  modalSub: { fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 20, marginBottom: 28, paddingHorizontal: 8 },
  modalBtnRow: { flexDirection: 'row', width: '100%' },
  modalKeepBtn: { flex: 1, backgroundColor: '#F3F4F6', paddingVertical: 15, borderRadius: 16, alignItems: 'center', marginRight: 10 },
  modalKeepText: { fontWeight: '800', fontSize: 13, color: '#374151' },
  modalCancelBtn: { flex: 1, backgroundColor: '#EF4444', paddingVertical: 15, borderRadius: 16, alignItems: 'center' },
  modalCancelText: { fontWeight: '800', fontSize: 13, color: '#FFFFFF' },
});

export default OrderHistoryScreen;
