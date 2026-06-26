import { Package, RotateCcw, ArrowLeft, Bike, AlertTriangle, Download, FileText } from 'lucide-react-native';
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, Alert, Linking, Modal, Pressable } from 'react-native';
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

const SUPPORT_PHONE = '918800000000';

const OrderHistoryScreen = ({ navigation }: any) => {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState<Set<string>>(new Set());
  const [reorderLoading, setReorderLoading] = useState<Set<string>>(new Set());

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

  const callSupport = () => {
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    Linking.openURL(`tel:${SUPPORT_PHONE}`).catch(() =>
      Alert.alert('Call Support', `Please call us at +${SUPPORT_PHONE}`)
    );
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
                          <Bike size={16} color="white" style={{ marginRight: 8 }} />
                          <Text style={styles.trackBtnText}>Track Order</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.footerBtnRow}>
                        {order.status === 'delivered' && (
                          <>
                            <TouchableOpacity
                              style={styles.invoiceIconBtn}
                              onPress={() => openInvoice(order.id)}
                              disabled={invoiceLoading.has(order.id)}
                            >
                              {invoiceLoading.has(order.id)
                                ? <ActivityIndicator size="small" color="#10B981" />
                                : <Download size={18} color="#10B981" />
                              }
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.actionBtn, styles.supportBtn]}
                              onPress={callSupport}
                            >
                              <AlertTriangle size={14} color="#EF4444" style={{ marginRight: 6 }} />
                              <Text style={styles.supportBtnText} numberOfLines={1} adjustsFontSizeToFit>Support</Text>
                            </TouchableOpacity>
                          </>
                        )}
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.reorderBtn]}
                          disabled={reorderLoading.has(order.id)}
                          onPress={async () => {
                            ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
                            setReorderLoading(prev => new Set(prev).add(order.id));
                            try {
                              // Use cached menu first — avoids network round-trip on every tap
                              const cached: any = queryClient.getQueryData(['menu', order.zone_id]);
                              const menu = cached ?? await api.get(`/menu?zoneId=${order.zone_id}`);
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
                            } catch {
                              Alert.alert('Error', 'Could not validate menu availability. Please try again.');
                            } finally {
                              setReorderLoading(prev => { const s = new Set(prev); s.delete(order.id); return s; });
                            }
                          }}
                        >
                          {reorderLoading.has(order.id)
                            ? <ActivityIndicator size="small" color="#1A1A2E" style={{ marginRight: 6 }} />
                            : <RotateCcw size={14} color="#1A1A2E" style={{ marginRight: 6 }} />
                          }
                          <Text style={styles.reorderBtnText} numberOfLines={1} adjustsFontSizeToFit>Reorder</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              </Animated.View>
            ))
          )}
        </ScrollView>

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
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    loadingContainer: { flex: 1, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' },
    loadingText: { marginTop: 16, color: '#94A3B8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, fontSize: 10 },
    header: { paddingHorizontal: 24, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', zIndex: 10 },
    backBtn: { width: 44, height: 44, backgroundColor: '#FFFFFF', borderRadius: 22, alignItems: 'center', justifyContent: 'center', shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 3 },
    headerTitle: { color: '#0F172A', fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
    headerSub: { color: '#64748B', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, fontSize: 10, marginTop: 4 },
    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 10 },

    emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
    emptyIconWrapper: { width: 88, height: 88, backgroundColor: '#FFFFFF', borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 24, shadowColor: '#10B981', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 4 },
    emptyTitle: { color: '#0F172A', fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
    emptySubText: { color: '#64748B', textAlign: 'center', marginTop: 10, paddingHorizontal: 40, fontWeight: '500', fontSize: 15, lineHeight: 22 },
    browseBtn: { marginTop: 36, backgroundColor: '#10B981', paddingHorizontal: 36, paddingVertical: 18, borderRadius: 28, shadowColor: '#10B981', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
    browseBtnText: { color: '#fff', fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, fontSize: 13 },

    orderCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 22, marginBottom: 20, shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 4, borderWidth: 1, borderColor: 'rgba(226,232,240,0.5)' },
    orderCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
    orderIdText: { color: '#0F172A', fontSize: 18, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
    orderDateText: { color: '#94A3B8', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginTop: 6 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, gap: 6 },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusBadgeText: { fontWeight: '800', fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase' },
    codBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, marginTop: 6, alignSelf: 'flex-end' },
    codBadgeText: { color: '#B45309', fontWeight: '800', fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase' },

    itemsListContainer: { marginBottom: 24, backgroundColor: '#F8FAFC', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9' },
    itemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    itemBadge: { backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginRight: 12, borderWidth: 1, borderColor: '#D1FAE5' },
    itemQty: { color: '#059669', fontWeight: '900', fontSize: 12 },
    itemName: { color: '#334155', fontWeight: '700', fontSize: 14, flex: 1, letterSpacing: 0.2 },

    orderCardFooter: { flexDirection: 'column', paddingTop: 20, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
    footerTotalRow: { marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    footerBtnRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    footerLabel: { color: '#64748B', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5 },
    footerValue: { color: '#0F172A', fontWeight: '900', fontSize: 22, letterSpacing: -0.5 },

    cancelBtn: { flex: 1, borderWidth: 1.5, borderColor: '#EF4444', paddingVertical: 14, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    cancelBtnText: { color: '#EF4444', fontWeight: '800', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
    trackBtn: { flex: 2, backgroundColor: '#10B981', paddingVertical: 14, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: '#10B981', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 4 },
    trackBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.5 },
    
    invoiceIconBtn: { width: 48, height: 48, backgroundColor: '#ECFDF5', borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#A7F3D0' },
    actionBtn: { flex: 1, paddingHorizontal: 12, paddingVertical: 14, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    supportBtn: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
    supportBtnText: { color: '#DC2626', fontWeight: '800', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
    reorderBtn: { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
    reorderBtnText: { color: '#0F172A', fontWeight: '800', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },

    // Cancel modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
    modalCard: { backgroundColor: '#FFFFFF', borderRadius: 32, paddingHorizontal: 32, paddingVertical: 40, width: '100%', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 24 }, shadowOpacity: 0.2, shadowRadius: 48, elevation: 24 },
    modalIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginBottom: 24, borderWidth: 4, borderColor: '#FEE2E2' },
    modalTitle: { fontSize: 24, fontWeight: '900', color: '#0F172A', marginBottom: 12, letterSpacing: -0.5 },
    modalSub: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22, marginBottom: 32, fontWeight: '500' },
    modalBtnRow: { flexDirection: 'row', width: '100%', gap: 12 },
    modalKeepBtn: { flex: 1, backgroundColor: '#F1F5F9', paddingVertical: 16, borderRadius: 20, alignItems: 'center' },
    modalKeepText: { fontWeight: '800', fontSize: 14, color: '#334155', textTransform: 'uppercase', letterSpacing: 1 },
    modalCancelBtn: { flex: 1, backgroundColor: '#EF4444', paddingVertical: 16, borderRadius: 20, alignItems: 'center', shadowColor: '#EF4444', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4 },
    modalCancelText: { fontWeight: '900', fontSize: 14, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 1 },
  });

  export default OrderHistoryScreen;
