import { Package, RotateCcw, ArrowLeft, Bike, AlertTriangle, Download, FileText } from 'lucide-react-native';
import React, { useState } from 'react';
import { BouncingButton } from '../components/ui/BouncingButton';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, Alert, Linking, Modal, Pressable } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { ENV } from '../config/env';
import { useDispatch } from 'react-redux';
import { addItem } from '../store/slices/cartSlice';
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontFamily } from '../theme/typography';
import { colors } from '../theme/colors';

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
        <BouncingButton
          style={styles.backBtn}
          onPress={() => {
            ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
            navigation.goBack();
          }}
        >
          <ArrowLeft size={24} color="#1A1A2E" />
        </BouncingButton>
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
            <BouncingButton
              style={styles.browseBtn}
              onPress={() => navigation.navigate('Home')}
            >
              <Text style={styles.browseBtnText}>Browse Menu</Text>
            </BouncingButton>
          </View>
        ) : (
          orders.map((order: any, index: number) => (
            <Animated.View key={order.id} entering={FadeInDown.delay(index * 80)}>
              <View style={styles.orderCard}>
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
                        order.payment_method === 'cod' && order.payment_status === 'cod_pending' && { color: '#1B5E46' }
                      ]}>
                        ₹{(order.total_amount_paise / 100).toFixed(2)}
                      </Text>
                    </View>

                    {!['delivered', 'cancelled'].includes(order.status) ? (
                      <View style={styles.footerBtnRow}>
                        {['pending_payment', 'confirmed'].includes(order.status) && (
                          <BouncingButton
                            style={styles.cancelBtn}
                            onPress={() => {
                              ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
                              setCancelTargetId(order.id);
                            }}
                          >
                            <Text style={styles.cancelBtnText}>Cancel</Text>
                          </BouncingButton>
                        )}
                        <BouncingButton
                          style={styles.trackBtn}
                          onPress={() => {
                            ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
                            navigation.navigate('OrderConfirmed', { orderId: order.id });
                          }}
                        >
                          <Bike size={16} color="white" style={{ marginRight: 8 }} />
                          <Text style={styles.trackBtnText}>Track Order</Text>
                        </BouncingButton>
                      </View>
                    ) : (
                      <View style={styles.footerBtnRow}>
                        {order.status === 'delivered' && (
                          <>
                            <BouncingButton
                              style={styles.invoiceIconBtn}
                              onPress={() => openInvoice(order.id)}
                              disabled={invoiceLoading.has(order.id)}
                            >
                              {invoiceLoading.has(order.id)
                                ? <ActivityIndicator size="small" color="#10B981" />
                                : <Download size={18} color="#10B981" />
                              }
                            </BouncingButton>
                            <BouncingButton
                              style={[styles.actionBtn, styles.supportBtn]}
                              onPress={callSupport}
                            >
                              <AlertTriangle size={14} color="#EF4444" style={{ marginRight: 6 }} />
                              <Text style={styles.supportBtnText} numberOfLines={1} adjustsFontSizeToFit>Support</Text>
                            </BouncingButton>
                          </>
                        )}
                        <BouncingButton
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
                        </BouncingButton>
                      </View>
                    )}
                  </View>
                </View>
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
                <BouncingButton
                  style={styles.modalKeepBtn}
                  onPress={() => setCancelTargetId(null)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalKeepText}>Keep Order</Text>
                </BouncingButton>
                <BouncingButton
                  style={styles.modalCancelBtn}
                  onPress={() => cancelTargetId && cancelMutation.mutate(cancelTargetId)}
                  activeOpacity={0.8}
                  disabled={cancelMutation.isPending}
                >
                  {cancelMutation.isPending
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.modalCancelText}>Yes, Cancel</Text>
                  }
                </BouncingButton>
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
    loadingText: { marginTop: 16, color: colors.inkMuted, fontFamily: fontFamily.bold, textTransform: 'uppercase', letterSpacing: 1.5, fontSize: 11 },
    header: { paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', zIndex: 10 },
    backBtn: { width: 44, height: 44, backgroundColor: '#FFFFFF', borderRadius: 22, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 4 },
    headerTitle: { color: colors.ink, fontSize: 20, fontFamily: fontFamily.black, letterSpacing: -0.2 },
    headerSub: { color: colors.inkMuted, fontFamily: fontFamily.bold, textTransform: 'uppercase', letterSpacing: 1.5, fontSize: 10, marginTop: 4 },
    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 10 },

    emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
    emptyIconWrapper: { width: 88, height: 88, backgroundColor: '#FFFFFF', borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 24, shadowColor: '#10B981', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 4 },
    emptyTitle: { color: colors.ink, fontSize: 18, fontFamily: fontFamily.black, letterSpacing: -0.2 },
    emptySubText: { color: colors.inkMuted, textAlign: 'center', marginTop: 10, paddingHorizontal: 40, fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 22 },
    browseBtn: { marginTop: 32, backgroundColor: '#10B981', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 24, shadowColor: '#10B981', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
    browseBtnText: { color: '#fff', fontFamily: fontFamily.bold, textTransform: 'uppercase', letterSpacing: 1, fontSize: 13 },

    orderCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 4 },
    orderCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
    orderIdText: { color: colors.ink, fontSize: 16, fontFamily: fontFamily.black, letterSpacing: 0.5 },
    orderDateText: { color: colors.inkMuted, fontSize: 11, fontFamily: fontFamily.bold, textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, gap: 6 },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusBadgeText: { fontFamily: fontFamily.bold, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase' },
    codBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, marginTop: 6, alignSelf: 'flex-end' },
    codBadgeText: { color: '#B45309', fontFamily: fontFamily.bold, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase' },

    itemsListContainer: { marginBottom: 16, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 20, borderWidth: 1, borderColor: '#F1F5F9' },
    itemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    itemBadge: { backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 16, marginRight: 12, borderWidth: 1, borderColor: '#D1FAE5' },
    itemQty: { color: '#059669', fontFamily: fontFamily.black, fontSize: 12 },
    itemName: { color: colors.ink, fontFamily: fontFamily.bold, fontSize: 13, flex: 1 },

    orderCardFooter: { flexDirection: 'column', paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
    footerTotalRow: { marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    footerBtnRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    footerLabel: { color: colors.inkMuted, fontSize: 11, fontFamily: fontFamily.bold, textTransform: 'uppercase', letterSpacing: 1.5 },
    footerValue: { color: colors.ink, fontFamily: fontFamily.black, fontSize: 18, letterSpacing: -0.2 },

    cancelBtn: { flex: 1, borderWidth: 1, borderColor: '#EF4444', paddingVertical: 12, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    cancelBtnText: { color: '#EF4444', fontFamily: fontFamily.bold, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
    trackBtn: { flex: 2, backgroundColor: '#10B981', paddingVertical: 12, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4 },
    trackBtnText: { color: '#FFFFFF', fontFamily: fontFamily.bold, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
    
    invoiceIconBtn: { width: 44, height: 44, backgroundColor: '#ECFDF5', borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#A7F3D0' },
    actionBtn: { flex: 1, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    supportBtn: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
    supportBtnText: { color: '#DC2626', fontFamily: fontFamily.bold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
    reorderBtn: { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
    reorderBtnText: { color: colors.ink, fontFamily: fontFamily.bold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },

    // Cancel modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
    modalCard: { backgroundColor: '#FFFFFF', borderRadius: 24, paddingHorizontal: 24, paddingVertical: 32, width: '100%', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 12 },
    modalIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderWidth: 4, borderColor: '#FEE2E2' },
    modalTitle: { fontSize: 20, fontFamily: fontFamily.black, color: colors.ink, marginBottom: 8, letterSpacing: -0.2 },
    modalSub: { fontSize: 13, color: colors.inkMuted, textAlign: 'center', lineHeight: 20, marginBottom: 24, fontFamily: fontFamily.medium },
    modalBtnRow: { flexDirection: 'row', width: '100%', gap: 12 },
    modalKeepBtn: { flex: 1, backgroundColor: '#F1F5F9', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
    modalKeepText: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.ink, textTransform: 'uppercase', letterSpacing: 0.5 },
    modalCancelBtn: { flex: 1, backgroundColor: '#EF4444', paddingVertical: 14, borderRadius: 14, alignItems: 'center', shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4 },
    modalCancelText: { fontFamily: fontFamily.bold, fontSize: 13, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 0.5 },
  });

  export default OrderHistoryScreen;
