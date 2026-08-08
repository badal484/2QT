import { tokens } from '../theme/tokens';
import { Package, RotateCcw, Bike, AlertTriangle, Download, Star, ChevronRight } from 'lucide-react-native';
import React, { useState, useCallback, useMemo } from 'react';
import { PressableScale } from '../components/ui/internal/PressableScale';
import { View, Text, ActivityIndicator, StyleSheet, Linking, Pressable } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useFeedback } from '../context/FeedbackContext';
import { SkeletonScreenList, SkeletonOrderCard, ScreenError } from '../components/ui';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { ENV } from '../config/env';
import { useDispatch } from 'react-redux';
import { addItem } from '../store/slices/cartSlice';
import { haptics } from '../utils/haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';


const STATUS_META: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  pending_payment:  { bg: '#FFF7ED', text: '#C2410C', dot: '#F97316', label: 'Pending Payment' },
  confirmed:        { bg: '#EFF6FF', text: '#1D4ED8', dot: '#3B82F6', label: 'Confirmed' },
  preparing:        { bg: '#FFFBEB', text: '#B45309', dot: '#F59E0B', label: 'Preparing' },
  ready_for_pickup: { bg: '#FFF7ED', text: '#EA580C', dot: '#F97316', label: 'Ready for Pickup' },
  out_for_delivery: { bg: '#ECFEFF', text: '#0E7490', dot: '#06B6D4', label: 'On the Way' },
  delivered:        { bg: '#F0FDF4', text: '#15803D', dot: '#22C55E', label: 'Delivered' },
  cancelled:        { bg: tokens.colors.dangerTint, text: '#DC2626', dot: tokens.colors.danger, label: 'Cancelled' },
};

const getStatusMeta = (s: string) =>
  STATUS_META[s] ?? { bg: '#F3F4F6', text: '#374151', dot: tokens.colors.textTertiary, label: s.replace(/_/g, ' ') };

const BACKEND_URL = ENV.API_URL.replace('/api/v1', '');
const SUPPORT_PHONE = '918800000000';

const OrderHistoryScreen = ({ navigation }: any) => {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [invoiceLoadingId, setInvoiceLoadingId] = useState<string | null>(null);
  const [reorderLoadingId, setReorderLoadingId] = useState<string | null>(null);
  const { showDialog } = useFeedback();
  const LIMIT = 20;

  const handleOpenInvoice = useCallback(async (orderId: string) => {
    setInvoiceLoadingId(orderId);
    try {
      const res = await api.get(`/orders/${orderId}/invoice`);
      const url = res.invoiceUrl?.startsWith('http')
        ? res.invoiceUrl
        : `${BACKEND_URL}${res.invoiceUrl}`;
      await Linking.openURL(url);
    } catch {
      showDialog({
        title: 'Error',
        message: 'Could not generate invoice. Please try again.',
        confirmText: 'Okay',
        type: 'error'
      });
    } finally {
      setInvoiceLoadingId(null);
    }
  }, [showDialog]);

  const callSupport = useCallback(() => {
    Linking.openURL(`tel:${SUPPORT_PHONE}`).catch(() =>
      showDialog({
        title: 'Call Support',
        message: `Please call us at +${SUPPORT_PHONE}`,
        confirmText: 'Got it',
        type: 'info'
      })
    );
  }, [showDialog]);

  const handleTrack = useCallback((orderId: string) => {
    navigation.navigate('OrderConfirmed', { orderId });
  }, [navigation]);

  const handleCancel = useCallback((orderId: string) => {
    haptics.warning();
    showDialog({
      title: 'Cancel Order?',
      message: 'This action cannot be undone. Your order will be cancelled immediately.',
      confirmText: 'Yes, Cancel',
      cancelText: 'Keep Order',
      type: 'warning',
      onConfirm: () => cancelMutation.mutate(orderId)
    });
  }, [showDialog]);

  const handleRate = useCallback((orderId: string) => {
    navigation.navigate('RateOrder', { orderId });
  }, [navigation]);

  const handleReorder = useCallback(async (order: any) => {
    setReorderLoadingId(order.id);
    try {
      const cached: any = queryClient.getQueryData(['menu', order.zone_id]);
      const menu = cached ?? await api.get(`/menu?zoneId=${order.zone_id}`);
      const currentItems = menu.items || [];
      const availableItems = order.items.filter((oldItem: any) =>
        currentItems.find((ci: any) => ci.id === oldItem.menu_item_id && ci.available)
      );
      if (availableItems.length === 0) {
        showDialog({ title: 'Unavailable', message: 'None of the items are available today.', confirmText: 'Okay', type: 'error' });
        return;
      }
      showDialog({
        title: 'Reorder',
        message: 'Add these items to your cart?',
        confirmText: 'Add to Cart',
        cancelText: 'Cancel',
        type: 'info',
        onConfirm: () => {
          availableItems.forEach((item: any) => {
            const menuItem = currentItems.find((ci: any) => ci.id === item.menu_item_id);
            dispatch(addItem({ menuItemId: item.menu_item_id, name: item.menu_item_name, pricePaise: menuItem.price_paise, quantity: item.quantity, photoUrl: menuItem.photo_url, isVeg: menuItem.is_veg, kitchenId: order.kitchen_id }));
          });
          if (availableItems.length < order.items.length) {
            showDialog({ title: 'Partial Reorder', message: 'Some items were sold out and skipped.', confirmText: 'Okay', type: 'warning' });
          }
          navigation.navigate('Cart');
        }
      });
    } catch {
      showDialog({ title: 'Error', message: 'Could not validate menu. Please try again.', confirmText: 'Okay', type: 'error' });
    }
    finally { setReorderLoadingId(null); }
  }, [dispatch, navigation, queryClient, showDialog]);

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['order-history'],
    queryFn: async ({ pageParam }) => {
      const res = await api.get(`/orders/mine?limit=${LIMIT}&offset=${pageParam}`);
      return res;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const fetched = lastPage.orders || [];
      if (fetched.length < LIMIT) return undefined;
      return allPages.length * LIMIT;
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const allOrders = data ? data.pages.flatMap((page: any) => page.orders || []) : [];

  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.post(`/orders/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-history'] });
      showDialog({ title: 'Order Cancelled', message: 'Your order was successfully cancelled.', confirmText: 'Okay', type: 'success' });
    },
    onError: () => {
      showDialog({ title: 'Error', message: 'Could not cancel the order.', confirmText: 'Okay', type: 'error' });
    },
  });

  const active = useMemo(() => allOrders.filter((o: any) => !['delivered', 'cancelled'].includes(o.status)), [allOrders]);
  const past   = useMemo(() => allOrders.filter((o: any) => ['delivered', 'cancelled'].includes(o.status)), [allOrders]);
  const deliveredCount = useMemo(() => allOrders.filter((o: any) => o.status === 'delivered').length, [allOrders]);

  const listData = useMemo(() => {
    const items: any[] = [];
    if (active.length > 0) {
      items.push({ type: 'header', label: 'Active', key: 'h-active' });
      active.forEach((order: any, i: number) => items.push({ type: 'order', order, delay: i * 60, key: order.id }));
    }
    if (past.length > 0) {
      items.push({ type: 'header', label: 'Past Orders', key: 'h-past' });
      past.forEach((order: any, i: number) => items.push({ type: 'order', order, delay: i * 50, key: order.id }));
    }
    if (allOrders.length === 0) items.push({ type: 'empty', key: 'empty' });
    return items;
  }, [active, past, allOrders.length]);

  const renderOrderItem = useCallback(({ item }: { item: any }) => {
    if (item.type === 'header') {
      return <View style={styles.sectionHeaderWrap}><Text allowFontScaling={false} style={styles.sectionLabel}>{item.label}</Text></View>;
    }
    if (item.type === 'empty') {
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrapper}><Package size={36} color={tokens.colors.primary} /></View>
          <Text allowFontScaling={false} style={styles.emptyTitle}>No orders yet</Text>
          <Text allowFontScaling={false} style={styles.emptySubText}>Your delicious journey is just one tap away.</Text>
          <PressableScale style={styles.browseBtn} onPress={() => navigation.navigate('Home')} accessibilityRole="button" accessibilityLabel="Browse Menu">
            <Text allowFontScaling={false} style={styles.browseBtnText}>Browse Menu</Text>
          </PressableScale>
        </View>
      );
    }
    const { order, delay } = item;
    return (
      <View style={styles.orderItemWrap}>
        <Animated.View entering={FadeInDown.delay(delay)}>
          <OrderCard
            order={order}
            onTrack={handleTrack}
            onCancel={handleCancel}
            onInvoice={handleOpenInvoice}
            onSupport={callSupport}
            onRate={handleRate}
            onReorder={handleReorder}
            invoiceLoading={invoiceLoadingId === order.id}
            reorderLoading={reorderLoadingId === order.id}
          />
        </Animated.View>
      </View>
    );
  }, [handleTrack, handleCancel, handleOpenInvoice, callSupport, handleRate, handleReorder, invoiceLoadingId, reorderLoadingId, navigation]);

  if (isLoading) return (
    <View style={styles.container}>
      <ScreenHeader title="Your Orders" variant="large" />
      <SkeletonScreenList item={<SkeletonOrderCard />} />
    </View>
  );

  if (isError) return (
    <View style={styles.container}>
      <ScreenHeader title="Your Orders" variant="large" />
      <ScreenError onRetry={refetch} />
    </View>
  );

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Your Orders"
        subtitle={`${allOrders.length} orders · ${deliveredCount} delivered`}
        variant="large"
      />

      <FlashList
        data={listData}
        keyExtractor={(item: any) => item.key}
        renderItem={renderOrderItem}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        // @ts-ignore
        estimatedItemSize={250}
        ListFooterComponent={hasNextPage && allOrders.length > 0 ? (
          <PressableScale hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={styles.loadMoreBtn} onPress={loadMore} disabled={isFetchingNextPage} accessibilityRole="button" accessibilityLabel="Load more orders">
            {isFetchingNextPage
              ? <ActivityIndicator size="small" color={tokens.colors.primary} />
              : <Text allowFontScaling={false} style={styles.loadMoreText}>Load more orders</Text>}
          </PressableScale>
        ) : null}
      />
    </View>
  );
};

/* ─── Order Card Component ─── */
const OrderCard = React.memo(({ order, onTrack, onCancel, onInvoice, onSupport, onRate, onReorder, invoiceLoading, reorderLoading }: any) => {
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
          <Text allowFontScaling={false} style={card.orderId}>{order.display_id}</Text>
          <Text allowFontScaling={false} style={card.date}>
            {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            {'  ·  '}
            {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        <View style={[card.statusBadge, { backgroundColor: meta.bg }]}>
          <View style={[card.statusDot, { backgroundColor: meta.dot }]} />
          <Text allowFontScaling={false} style={[card.statusText, { color: meta.text }]}>{meta.label}</Text>
        </View>
      </View>

      {/* Items */}
      {order.items && order.items.length > 0 && (
        <View style={card.itemsWrap}>
          {order.items.slice(0, 3).map((item: any, i: number) => (
            <View key={i} style={card.itemRow}>
              <View style={card.qtyBadge}>
                <Text allowFontScaling={false} style={card.qtyText}>{item.quantity}×</Text>
              </View>
              <Text allowFontScaling={false} style={card.itemName} numberOfLines={1}>{item.menu_item_name}</Text>
            </View>
          ))}
          {order.items.length > 3 && (
            <Text allowFontScaling={false} style={card.moreItems}>+{order.items.length - 3} more items</Text>
          )}
        </View>
      )}

      {/* Amount row */}
      <View style={card.amountRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={[card.payChip, { backgroundColor: isCOD ? tokens.colors.warningTint : tokens.colors.successTint }]}>
            <Text allowFontScaling={false} style={[card.payChipText, { color: isCOD ? tokens.colors.warning : tokens.colors.success }]}>
              {isCOD ? 'COD' : 'Online'}
            </Text>
          </View>
          {tipPaise > 0 && (
            <View style={card.tipChip}>
              <Text allowFontScaling={false} style={card.tipChipText}>+₹{(tipPaise / 100).toFixed(0)} tip</Text>
            </View>
          )}
        </View>
        <Text allowFontScaling={false} style={[card.amountText, isCOD && isPending && { color: '#EA580C' }]}>
          ₹{totalRupees}
        </Text>
      </View>

      {/* Actions */}
      <View style={card.actions}>
        {isActive && (
          <>
            {['pending_payment', 'confirmed'].includes(order.status) && (
              <PressableScale style={card.cancelBtn} onPress={() => onCancel(order.id)} accessibilityRole="button" accessibilityLabel="Cancel Order">
                <Text allowFontScaling={false} style={card.cancelBtnText}>Cancel</Text>
              </PressableScale>
            )}
            <PressableScale style={card.trackBtn} onPress={() => onTrack(order.id)} accessibilityRole="button" accessibilityLabel="Track Order">
              <Bike size={14} color={tokens.colors.textInverse} />
              <Text allowFontScaling={false} style={card.trackBtnText}>Track Order</Text>
              <ChevronRight size={14} color={tokens.colors.textInverse} />
            </PressableScale>
          </>
        )}

        {isDelivered && (
          <>
            <PressableScale style={card.iconBtn} onPress={() => onInvoice(order.id)} disabled={invoiceLoading} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button" accessibilityLabel="Download Invoice">
              {invoiceLoading
                ? <ActivityIndicator size="small" color={tokens.colors.primary} />
                : <Download size={16} color={tokens.colors.primary} />}
            </PressableScale>
            {!order.has_feedback && (
              <PressableScale style={[card.iconBtn, { backgroundColor: tokens.colors.warningTint, borderColor: tokens.colors.warningTint }]} onPress={() => onRate(order.id)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button" accessibilityLabel="Rate Order">
                <Star size={16} color={tokens.colors.warning} />
              </PressableScale>
            )}
            <PressableScale style={card.supportBtn} onPress={onSupport} accessibilityRole="button" accessibilityLabel="Get Help">
              <AlertTriangle size={13} color="#DC2626" />
              <Text allowFontScaling={false} style={card.supportBtnText}>Help</Text>
            </PressableScale>
            <PressableScale style={card.reorderBtn} onPress={() => onReorder(order)} disabled={reorderLoading} accessibilityRole="button" accessibilityLabel="Reorder">
              {reorderLoading
                ? <ActivityIndicator size="small" color={tokens.colors.textPrimary} />
                : <RotateCcw size={13} color={tokens.colors.textPrimary} />}
              <Text allowFontScaling={false} style={card.reorderBtnText}>Reorder</Text>
            </PressableScale>
          </>
        )}

        {isCancelled && (
          <PressableScale style={[card.reorderBtn, { flex: 1 }]} onPress={() => onReorder(order)} disabled={reorderLoading} accessibilityRole="button" accessibilityLabel="Try Again">
            {reorderLoading
              ? <ActivityIndicator size="small" color={tokens.colors.textPrimary} />
              : <RotateCcw size={13} color={tokens.colors.textPrimary} />}
            <Text allowFontScaling={false} style={card.reorderBtnText}>Try Again</Text>
          </PressableScale>
        )}
      </View>
    </View>
  );
});

/* ─── Styles ─── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.background },
  loadingContainer: { flex: 1, backgroundColor: tokens.colors.background, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, color: tokens.colors.textTertiary, fontFamily: tokens.typography.family.bold, fontSize: 13 },

  scrollContent: { paddingBottom: 40 },

  section: { paddingHorizontal: tokens.spacing.lg, paddingTop: tokens.spacing.xl },
  sectionHeaderWrap: { paddingHorizontal: tokens.spacing.lg, paddingTop: tokens.spacing.xl },
  orderItemWrap: { paddingHorizontal: tokens.spacing.lg },
  sectionLabel: { fontSize: 11, fontFamily: tokens.typography.family.black, color: tokens.colors.textTertiary, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: tokens.spacing.md },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: tokens.spacing.xxxl },
  emptyIconWrapper: { width: 88, height: 88, backgroundColor: tokens.colors.surface, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 24, shadowColor: tokens.colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 4 },
  emptyTitle: { fontSize: 18, fontFamily: tokens.typography.family.black, color: tokens.colors.textPrimary, letterSpacing: -0.2 },
  emptySubText: { color: tokens.colors.textTertiary, textAlign: 'center', marginTop: 8, fontFamily: tokens.typography.family.medium, fontSize: 14, lineHeight: 22 },
  browseBtn: { marginTop: 28, backgroundColor: tokens.colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 24 },
  browseBtnText: { color: tokens.colors.textInverse, fontFamily: tokens.typography.family.bold, letterSpacing: 1, fontSize: 13, textTransform: 'uppercase' },

  loadMoreBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 14, marginHorizontal: 16, marginTop: 12, marginBottom: 12, borderRadius: 14, borderWidth: 1.5, borderColor: tokens.colors.primary },
  loadMoreText: { fontFamily: tokens.typography.family.bold, fontSize: 13, color: tokens.colors.primary },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  modalCard: { backgroundColor: tokens.colors.surface, borderRadius: 24, paddingHorizontal: 24, paddingVertical: 32, width: '100%', alignItems: 'center' },
  modalIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: tokens.colors.dangerTint, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontFamily: tokens.typography.family.black, color: tokens.colors.textPrimary, marginBottom: 8, letterSpacing: -0.2 },
  modalSub: { fontSize: 13, color: tokens.colors.textTertiary, textAlign: 'center', lineHeight: 20, marginBottom: 24, fontFamily: tokens.typography.family.medium },
  modalBtnRow: { flexDirection: 'row', width: '100%', gap: 12 },
  modalKeepBtn: { flex: 1, backgroundColor: tokens.colors.background, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  modalKeepText: { fontFamily: tokens.typography.family.bold, fontSize: 13, color: tokens.colors.textPrimary, textTransform: 'uppercase', letterSpacing: 0.5 },
  modalCancelBtn: { flex: 1, backgroundColor: tokens.colors.danger, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  modalCancelText: { fontFamily: tokens.typography.family.bold, fontSize: 13, color: tokens.colors.textInverse, textTransform: 'uppercase', letterSpacing: 0.5 },
});

const card = StyleSheet.create({
  wrap: {
    backgroundColor: tokens.colors.surface, borderRadius: tokens.radii.xxl, padding: tokens.spacing.lg, marginBottom: tokens.spacing.md,
    ...tokens.shadows.soft,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: tokens.spacing.lg },
  orderId: { fontSize: 16, fontFamily: tokens.typography.family.black, color: tokens.colors.textPrimary, letterSpacing: 0.2 },
  date: { fontSize: 11, fontFamily: tokens.typography.family.bold, color: tokens.colors.textTertiary, marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontFamily: tokens.typography.family.black, letterSpacing: 0.3, textTransform: 'uppercase' },

  itemsWrap: { backgroundColor: tokens.colors.background, borderRadius: 14, padding: 12, marginBottom: 14 },
  itemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  qtyBadge: { backgroundColor: '#FFE8DF', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, marginRight: 10 },
  qtyText: { color: tokens.colors.primary, fontFamily: tokens.typography.family.black, fontSize: 11 },
  itemName: { flex: 1, fontSize: 13, fontFamily: tokens.typography.family.bold, color: tokens.colors.textPrimary },
  moreItems: { fontSize: 11, color: tokens.colors.primary, fontFamily: tokens.typography.family.bold, marginTop: 2 },

  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: tokens.spacing.lg, paddingBottom: tokens.spacing.lg, borderBottomWidth: 1, borderBottomColor: tokens.colors.border },
  payChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  payChipText: { fontSize: 11, fontFamily: tokens.typography.family.black, letterSpacing: 0.3 },
  tipChip: { backgroundColor: tokens.colors.warningTint, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  tipChipText: { fontSize: 11, fontFamily: tokens.typography.family.bold, color: tokens.colors.warning },
  amountText: { fontSize: 20, fontFamily: tokens.typography.family.black, color: tokens.colors.textPrimary, letterSpacing: -0.5 },

  actions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, borderColor: tokens.colors.danger, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { color: tokens.colors.danger, fontFamily: tokens.typography.family.bold, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  trackBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: tokens.colors.primary, paddingVertical: 11, borderRadius: 14 },
  trackBtnText: { color: tokens.colors.textInverse, fontFamily: tokens.typography.family.bold, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  iconBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: tokens.colors.successTint, borderWidth: 1, borderColor: tokens.colors.successTint, alignItems: 'center', justifyContent: 'center' },
  supportBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, backgroundColor: tokens.colors.dangerTint, borderWidth: 1, borderColor: tokens.colors.dangerTint },
  supportBtnText: { color: '#DC2626', fontFamily: tokens.typography.family.bold, fontSize: 12 },
  reorderBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, backgroundColor: tokens.colors.background, borderWidth: 1, borderColor: tokens.colors.border, justifyContent: 'center' },
  reorderBtnText: { color: tokens.colors.textPrimary, fontFamily: tokens.typography.family.bold, fontSize: 12 },
});

export default OrderHistoryScreen;
