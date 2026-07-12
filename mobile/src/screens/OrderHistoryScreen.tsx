import { Package, RotateCcw, ArrowLeft, Bike, AlertTriangle, Download, Star, ChevronRight } from 'lucide-react-native';
import React, { useState } from 'react';
import { BouncingButton } from '../components/ui/BouncingButton';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, Alert, Linking, Modal, Pressable } from 'react-native';
import { SkeletonScreenList, SkeletonOrderCard, ScreenError } from '../components/ui';
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

const STATUS_META: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  pending_payment:  { bg: '#FFF7ED', text: '#C2410C', dot: '#F97316', label: 'Pending Payment' },
  confirmed:        { bg: '#EFF6FF', text: '#1D4ED8', dot: '#3B82F6', label: 'Confirmed' },
  preparing:        { bg: '#FFFBEB', text: '#B45309', dot: '#F59E0B', label: 'Preparing' },
  ready_for_pickup: { bg: '#FFF7ED', text: '#EA580C', dot: '#F97316', label: 'Ready for Pickup' },
  out_for_delivery: { bg: '#ECFEFF', text: '#0E7490', dot: '#06B6D4', label: 'On the Way' },
  delivered:        { bg: '#F0FDF4', text: '#15803D', dot: '#22C55E', label: 'Delivered' },
  cancelled:        { bg: '#FEF2F2', text: '#DC2626', dot: '#EF4444', label: 'Cancelled' },
};

const getStatusMeta = (s: string) =>
  STATUS_META[s] ?? { bg: '#F3F4F6', text: '#374151', dot: '#9CA3AF', label: s.replace(/_/g, ' ') };

const BACKEND_URL = ENV.API_URL.replace('/api/v1', '');
const SUPPORT_PHONE = '918800000000';

const OrderHistoryScreen = ({ navigation }: any) => {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState<Set<string>>(new Set());
  const [reorderLoading, setReorderLoading] = useState<Set<string>>(new Set());
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const LIMIT = 20;

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

  const { isLoading, isError, refetch } = useQuery({
    queryKey: ['order-history'],
    queryFn: async () => {
      const res = await api.get(`/orders/mine?limit=${LIMIT}&offset=0`);
      const fetched: any[] = res.orders || [];
      setAllOrders(fetched);
      setOffset(LIMIT);
      setHasMore(fetched.length === LIMIT);
      return res;
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const loadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await api.get(`/orders/mine?limit=${LIMIT}&offset=${offset}`);
      const fetched: any[] = res.orders || [];
      setAllOrders(prev => [...prev, ...fetched]);
      setOffset(prev => prev + LIMIT);
      setHasMore(fetched.length === LIMIT);
    } catch {
      Alert.alert('Error', 'Could not load more orders.');
    } finally {
      setLoadingMore(false);
    }
  };

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

  if (isLoading) return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 12, 36) }]}>
        <BouncingButton style={styles.backBtn} onPress={() => { ReactNativeHapticFeedback.trigger("impactLight", hapticOptions); navigation.goBack(); }}>
          <ArrowLeft size={20} color="#1A1A2E" />
        </BouncingButton>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.headerTitle}>Your Orders</Text>
        </View>
      </View>
      <SkeletonScreenList item={<SkeletonOrderCard />} />
    </View>
  );

  if (isError) return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 12, 36) }]}>
        <BouncingButton style={styles.backBtn} onPress={() => { ReactNativeHapticFeedback.trigger("impactLight", hapticOptions); navigation.goBack(); }}>
          <ArrowLeft size={20} color="#1A1A2E" />
        </BouncingButton>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.headerTitle}>Your Orders</Text>
        </View>
      </View>
      <ScreenError onRetry={refetch} />
    </View>
  );

  const delivered = allOrders.filter(o => o.status === 'delivered');
  const active    = allOrders.filter(o => !['delivered', 'cancelled'].includes(o.status));

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 12, 36) }]}>
        <BouncingButton style={styles.backBtn} onPress={() => { ReactNativeHapticFeedback.trigger("impactLight", hapticOptions); navigation.goBack(); }}>
          <ArrowLeft size={20} color="#1A1A2E" />
        </BouncingButton>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.headerTitle}>Your Orders</Text>
          <Text style={styles.headerSub}>{allOrders.length} orders · {delivered.length} delivered</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Active orders strip */}
        {active.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Active</Text>
            {active.map((order, index) => (
              <Animated.View key={order.id} entering={FadeInDown.delay(index * 60)}>
                <OrderCard
                  order={order}
                  onTrack={() => navigation.navigate('OrderConfirmed', { orderId: order.id })}
                  onCancel={() => { ReactNativeHapticFeedback.trigger("impactLight", hapticOptions); setCancelTargetId(order.id); }}
                  onInvoice={() => openInvoice(order.id)}
                  onSupport={callSupport}
                  onRate={() => navigation.navigate('RateOrder', { orderId: order.id })}
                  onReorder={async () => {
                    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
                    setReorderLoading(prev => new Set(prev).add(order.id));
                    try {
                      const cached: any = queryClient.getQueryData(['menu', order.zone_id]);
                      const menu = cached ?? await api.get(`/menu?zoneId=${order.zone_id}`);
                      const currentItems = menu.items || [];
                      const availableItems = order.items.filter((oldItem: any) =>
                        currentItems.find((ci: any) => ci.id === oldItem.menu_item_id && ci.available)
                      );
                      if (availableItems.length === 0) { Alert.alert('Unavailable', 'None of the items are available today.'); return; }
                      Alert.alert('Reorder', 'Add these items to your cart?', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Add to Cart', onPress: () => {
                          availableItems.forEach((item: any) => {
                            const menuItem = currentItems.find((ci: any) => ci.id === item.menu_item_id);
                            dispatch(addItem({ menuItemId: item.menu_item_id, name: item.menu_item_name, pricePaise: menuItem.price_paise, quantity: item.quantity, photoUrl: menuItem.photo_url, isVeg: menuItem.is_veg, kitchenId: order.kitchen_id }));
                          });
                          if (availableItems.length < order.items.length) Alert.alert('Partial Reorder', 'Some items were sold out and skipped.');
                          navigation.navigate('Cart');
                        }},
                      ]);
                    } catch { Alert.alert('Error', 'Could not validate menu. Please try again.'); }
                    finally { setReorderLoading(prev => { const s = new Set(prev); s.delete(order.id); return s; }); }
                  }}
                  invoiceLoading={invoiceLoading.has(order.id)}
                  reorderLoading={reorderLoading.has(order.id)}
                />
              </Animated.View>
            ))}
          </View>
        )}

        {/* Past orders */}
        {allOrders.filter(o => ['delivered', 'cancelled'].includes(o.status)).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Past Orders</Text>
            {allOrders.filter(o => ['delivered', 'cancelled'].includes(o.status)).map((order, index) => (
              <Animated.View key={order.id} entering={FadeInDown.delay(index * 50)}>
                <OrderCard
                  order={order}
                  onTrack={() => navigation.navigate('OrderConfirmed', { orderId: order.id })}
                  onCancel={() => { ReactNativeHapticFeedback.trigger("impactLight", hapticOptions); setCancelTargetId(order.id); }}
                  onInvoice={() => openInvoice(order.id)}
                  onSupport={callSupport}
                  onRate={() => navigation.navigate('RateOrder', { orderId: order.id })}
                  onReorder={async () => {
                    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
                    setReorderLoading(prev => new Set(prev).add(order.id));
                    try {
                      const cached: any = queryClient.getQueryData(['menu', order.zone_id]);
                      const menu = cached ?? await api.get(`/menu?zoneId=${order.zone_id}`);
                      const currentItems = menu.items || [];
                      const availableItems = order.items.filter((oldItem: any) =>
                        currentItems.find((ci: any) => ci.id === oldItem.menu_item_id && ci.available)
                      );
                      if (availableItems.length === 0) { Alert.alert('Unavailable', 'None of the items are available today.'); return; }
                      Alert.alert('Reorder', 'Add these items to your cart?', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Add to Cart', onPress: () => {
                          availableItems.forEach((item: any) => {
                            const menuItem = currentItems.find((ci: any) => ci.id === item.menu_item_id);
                            dispatch(addItem({ menuItemId: item.menu_item_id, name: item.menu_item_name, pricePaise: menuItem.price_paise, quantity: item.quantity, photoUrl: menuItem.photo_url, isVeg: menuItem.is_veg, kitchenId: order.kitchen_id }));
                          });
                          if (availableItems.length < order.items.length) Alert.alert('Partial Reorder', 'Some items were sold out and skipped.');
                          navigation.navigate('Cart');
                        }},
                      ]);
                    } catch { Alert.alert('Error', 'Could not validate menu. Please try again.'); }
                    finally { setReorderLoading(prev => { const s = new Set(prev); s.delete(order.id); return s; }); }
                  }}
                  invoiceLoading={invoiceLoading.has(order.id)}
                  reorderLoading={reorderLoading.has(order.id)}
                />
              </Animated.View>
            ))}
          </View>
        )}

        {allOrders.length === 0 && (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrapper}>
              <Package size={36} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptySubText}>Your delicious journey is just one tap away.</Text>
            <BouncingButton style={styles.browseBtn} onPress={() => navigation.navigate('Home')}>
              <Text style={styles.browseBtnText}>Browse Menu</Text>
            </BouncingButton>
          </View>
        )}

        {hasMore && allOrders.length > 0 && (
          <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMore} disabled={loadingMore} activeOpacity={0.7}>
            {loadingMore
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Text style={styles.loadMoreText}>Load more orders</Text>}
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Cancel Modal */}
      <Modal visible={!!cancelTargetId} transparent animationType="fade" onRequestClose={() => setCancelTargetId(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setCancelTargetId(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalIconWrap}>
              <AlertTriangle size={28} color="#EF4444" strokeWidth={2} />
            </View>
            <Text style={styles.modalTitle}>Cancel Order?</Text>
            <Text style={styles.modalSub}>This action cannot be undone. Your order will be cancelled immediately.</Text>
            <View style={styles.modalBtnRow}>
              <BouncingButton style={styles.modalKeepBtn} onPress={() => setCancelTargetId(null)} activeOpacity={0.8}>
                <Text style={styles.modalKeepText}>Keep Order</Text>
              </BouncingButton>
              <BouncingButton style={styles.modalCancelBtn}
                onPress={() => cancelTargetId && cancelMutation.mutate(cancelTargetId)}
                activeOpacity={0.8} disabled={cancelMutation.isPending}>
                {cancelMutation.isPending
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.modalCancelText}>Yes, Cancel</Text>}
              </BouncingButton>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

/* ─── Order Card Component ─── */
const OrderCard = ({ order, onTrack, onCancel, onInvoice, onSupport, onRate, onReorder, invoiceLoading, reorderLoading }: any) => {
  const meta = getStatusMeta(order.status);
  const isDelivered = order.status === 'delivered';
  const isCancelled = order.status === 'cancelled';
  const isActive    = !isDelivered && !isCancelled;
  const isCOD       = order.payment_method === 'cod';
  const isPending   = order.payment_status === 'cod_pending';
  const tipPaise    = parseInt(order.rider_tip_paise || '0', 10);
  const totalRupees = (order.total_amount_paise / 100).toFixed(0);

  return (
    <View style={card.wrap}>
      {/* Top: ID + status */}
      <View style={card.top}>
        <View>
          <Text style={card.orderId}>{order.display_id}</Text>
          <Text style={card.date}>
            {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            {'  ·  '}
            {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        <View style={[card.statusBadge, { backgroundColor: meta.bg }]}>
          <View style={[card.statusDot, { backgroundColor: meta.dot }]} />
          <Text style={[card.statusText, { color: meta.text }]}>{meta.label}</Text>
        </View>
      </View>

      {/* Items */}
      {order.items && order.items.length > 0 && (
        <View style={card.itemsWrap}>
          {order.items.slice(0, 3).map((item: any, i: number) => (
            <View key={i} style={card.itemRow}>
              <View style={card.qtyBadge}>
                <Text style={card.qtyText}>{item.quantity}×</Text>
              </View>
              <Text style={card.itemName} numberOfLines={1}>{item.menu_item_name}</Text>
            </View>
          ))}
          {order.items.length > 3 && (
            <Text style={card.moreItems}>+{order.items.length - 3} more items</Text>
          )}
        </View>
      )}

      {/* Amount row */}
      <View style={card.amountRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={[card.payChip, { backgroundColor: isCOD ? '#FFF7ED' : '#F0FDF4' }]}>
            <Text style={[card.payChipText, { color: isCOD ? '#EA580C' : '#16A34A' }]}>
              {isCOD ? 'COD' : 'Online'}
            </Text>
          </View>
          {tipPaise > 0 && (
            <View style={card.tipChip}>
              <Text style={card.tipChipText}>+₹{(tipPaise / 100).toFixed(0)} tip</Text>
            </View>
          )}
        </View>
        <Text style={[card.amountText, isCOD && isPending && { color: '#EA580C' }]}>
          ₹{totalRupees}
        </Text>
      </View>

      {/* Actions */}
      <View style={card.actions}>
        {isActive && (
          <>
            {['pending_payment', 'confirmed'].includes(order.status) && (
              <BouncingButton style={card.cancelBtn} onPress={onCancel}>
                <Text style={card.cancelBtnText}>Cancel</Text>
              </BouncingButton>
            )}
            <BouncingButton style={card.trackBtn} onPress={onTrack}>
              <Bike size={14} color="#fff" />
              <Text style={card.trackBtnText}>Track Order</Text>
              <ChevronRight size={14} color="#fff" />
            </BouncingButton>
          </>
        )}

        {isDelivered && (
          <>
            <BouncingButton style={card.iconBtn} onPress={onInvoice} disabled={invoiceLoading}>
              {invoiceLoading
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <Download size={16} color={colors.primary} />}
            </BouncingButton>
            {!order.has_feedback && (
              <BouncingButton style={[card.iconBtn, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]} onPress={onRate}>
                <Star size={16} color="#D97706" />
              </BouncingButton>
            )}
            <BouncingButton style={card.supportBtn} onPress={onSupport}>
              <AlertTriangle size={13} color="#DC2626" />
              <Text style={card.supportBtnText}>Help</Text>
            </BouncingButton>
            <BouncingButton style={card.reorderBtn} onPress={onReorder} disabled={reorderLoading}>
              {reorderLoading
                ? <ActivityIndicator size="small" color="#1A1A2E" />
                : <RotateCcw size={13} color="#1A1A2E" />}
              <Text style={card.reorderBtnText}>Reorder</Text>
            </BouncingButton>
          </>
        )}

        {isCancelled && (
          <BouncingButton style={[card.reorderBtn, { flex: 1 }]} onPress={onReorder} disabled={reorderLoading}>
            {reorderLoading
              ? <ActivityIndicator size="small" color="#1A1A2E" />
              : <RotateCcw size={13} color="#1A1A2E" />}
            <Text style={card.reorderBtnText}>Try Again</Text>
          </BouncingButton>
        )}
      </View>
    </View>
  );
};

/* ─── Styles ─── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  loadingContainer: { flex: 1, backgroundColor: '#F5F5F7', alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, color: '#9CA3AF', fontFamily: fontFamily.bold, fontSize: 13 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#F1F1F1',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F5F5F7', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontFamily: fontFamily.black, color: '#1A1A2E', letterSpacing: -0.3 },
  headerSub: { fontSize: 12, fontFamily: fontFamily.bold, color: '#9CA3AF', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },

  scrollContent: { paddingBottom: 40 },

  section: { paddingHorizontal: 16, paddingTop: 20 },
  sectionLabel: { fontSize: 11, fontFamily: fontFamily.black, color: '#9CA3AF', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIconWrapper: { width: 88, height: 88, backgroundColor: '#fff', borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 24, shadowColor: colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 4 },
  emptyTitle: { fontSize: 18, fontFamily: fontFamily.black, color: '#1A1A2E', letterSpacing: -0.2 },
  emptySubText: { color: '#9CA3AF', textAlign: 'center', marginTop: 8, fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 22 },
  browseBtn: { marginTop: 28, backgroundColor: colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 24 },
  browseBtnText: { color: '#fff', fontFamily: fontFamily.bold, letterSpacing: 1, fontSize: 13, textTransform: 'uppercase' },

  loadMoreBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 14, marginHorizontal: 16, marginTop: 12, marginBottom: 12, borderRadius: 14, borderWidth: 1.5, borderColor: colors.primary },
  loadMoreText: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.primary },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  modalCard: { backgroundColor: '#fff', borderRadius: 24, paddingHorizontal: 24, paddingVertical: 32, width: '100%', alignItems: 'center' },
  modalIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontFamily: fontFamily.black, color: '#1A1A2E', marginBottom: 8, letterSpacing: -0.2 },
  modalSub: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 20, marginBottom: 24, fontFamily: fontFamily.medium },
  modalBtnRow: { flexDirection: 'row', width: '100%', gap: 12 },
  modalKeepBtn: { flex: 1, backgroundColor: '#F1F5F9', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  modalKeepText: { fontFamily: fontFamily.bold, fontSize: 13, color: '#1A1A2E', textTransform: 'uppercase', letterSpacing: 0.5 },
  modalCancelBtn: { flex: 1, backgroundColor: '#EF4444', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  modalCancelText: { fontFamily: fontFamily.bold, fontSize: 13, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 },
});

const card = StyleSheet.create({
  wrap: {
    backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  orderId: { fontSize: 16, fontFamily: fontFamily.black, color: '#1A1A2E', letterSpacing: 0.2 },
  date: { fontSize: 11, fontFamily: fontFamily.bold, color: '#9CA3AF', marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontFamily: fontFamily.black, letterSpacing: 0.3, textTransform: 'uppercase' },

  itemsWrap: { backgroundColor: '#F8F9FA', borderRadius: 14, padding: 12, marginBottom: 14 },
  itemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  qtyBadge: { backgroundColor: '#FFE8DF', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, marginRight: 10 },
  qtyText: { color: colors.primary, fontFamily: fontFamily.black, fontSize: 11 },
  itemName: { flex: 1, fontSize: 13, fontFamily: fontFamily.bold, color: '#1A1A2E' },
  moreItems: { fontSize: 11, color: colors.primary, fontFamily: fontFamily.bold, marginTop: 2 },

  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F1F1' },
  payChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  payChipText: { fontSize: 11, fontFamily: fontFamily.black, letterSpacing: 0.3 },
  tipChip: { backgroundColor: '#FFFBEB', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  tipChipText: { fontSize: 11, fontFamily: fontFamily.bold, color: '#D97706' },
  amountText: { fontSize: 20, fontFamily: fontFamily.black, color: '#1A1A2E', letterSpacing: -0.5 },

  actions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, borderColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { color: '#EF4444', fontFamily: fontFamily.bold, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  trackBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.primary, paddingVertical: 11, borderRadius: 14 },
  trackBtnText: { color: '#fff', fontFamily: fontFamily.bold, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  iconBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center' },
  supportBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  supportBtnText: { color: '#DC2626', fontFamily: fontFamily.bold, fontSize: 12 },
  reorderBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, backgroundColor: '#F5F5F7', borderWidth: 1, borderColor: '#E5E5EA', justifyContent: 'center' },
  reorderBtnText: { color: '#1A1A2E', fontFamily: fontFamily.bold, fontSize: 12 },
});

export default OrderHistoryScreen;
