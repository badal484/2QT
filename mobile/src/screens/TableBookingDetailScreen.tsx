import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal,
  ActivityIndicator, Alert, Dimensions,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import {
  ChevronLeft, QrCode, Receipt, ShoppingBag, X, Plus, Minus,
  CheckCircle, AlertCircle, Clock, Users, Calendar, CreditCard,
} from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { api } from '../api/client';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { BouncingButton } from '../components/ui/BouncingButton';

let RazorpayCheckout: any = null;
try { RazorpayCheckout = require('react-native-razorpay').default; } catch (_) {}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const pad = (n: number) => String(n).padStart(2, '0');

const formatSlot = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const STATUS_COLORS: Record<string, string> = {
  pending_payment: '#F59E0B',
  confirmed: '#10B981',
  seated: '#3B82F6',
  completed: '#6B7280',
  cancelled: '#EF4444',
  no_show: '#EF4444',
};

const STATUS_LABELS: Record<string, string> = {
  pending_payment: 'Payment Pending',
  confirmed: 'Confirmed – Awaiting Arrival',
  seated: 'Seated',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No Show',
};

const ITEM_STATUS_LABELS: Record<string, string> = { pending: 'Preparing', preparing: 'Preparing', served: 'Served' };

const TableBookingDetailScreen = ({ navigation, route }: any) => {
  const { bookingId } = route.params;
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [showQR, setShowQR] = useState(false);
  const [showOrderMore, setShowOrderMore] = useState(false);
  const [addItems, setAddItems] = useState<Record<string, number>>({});

  const { data: booking, isLoading, refetch } = useQuery({
    queryKey: ['table-booking', bookingId],
    queryFn: () => api.get(`/table-bookings/${bookingId}`).then((r: any) => r.booking),
    refetchInterval: 20000,
  });

  const { data: bill, refetch: refetchBill } = useQuery({
    queryKey: ['table-booking-bill', bookingId],
    queryFn: () => api.get(`/table-bookings/${bookingId}/bill`),
    enabled: booking?.status === 'seated',
  });

  const { data: menuItems } = useQuery({
    queryKey: ['restaurant-menu-items', booking?.restaurant_id],
    queryFn: () => api.get(`/restaurants/${booking.restaurant_id}/menu`).then((r: any) => r.items as any[]),
    enabled: showOrderMore && !!booking?.restaurant_id,
  });
  const allMenuItems: any[] = menuItems || [];

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/table-bookings/${bookingId}/cancel`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['table-booking', bookingId] }); refetch(); },
    onError: (err: any) => Alert.alert('Cannot Cancel', err?.response?.data?.error || 'Please try again.'),
  });

  const postOrderMutation = useMutation({
    mutationFn: (items: any[]) => api.post(`/table-bookings/${bookingId}/post-order`, { items }),
    onSuccess: () => {
      setShowOrderMore(false);
      setAddItems({});
      queryClient.invalidateQueries({ queryKey: ['table-booking', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['table-booking-bill', bookingId] });
    },
    onError: (err: any) => Alert.alert('Error', err?.response?.data?.error || 'Failed to add items.'),
  });

  const payMutation = useMutation({
    mutationFn: (method: string) => api.post(`/table-bookings/${bookingId}/pay`, { paymentMethod: method }),
    onSuccess: (data) => {
      if (data.razorpayOrderId) openRazorpay(data.razorpayOrderId, data.amountPaise);
      else { queryClient.invalidateQueries({ queryKey: ['table-booking', bookingId] }); refetch(); }
    },
    onError: (err: any) => Alert.alert('Payment Error', err?.response?.data?.error || 'Failed.'),
  });

  const openRazorpay = useCallback((rzpOrderId: string, amountPaise: number) => {
    if (!RazorpayCheckout) { Alert.alert('Error', 'Payment module not available.'); return; }
    RazorpayCheckout.open({
      description: `Table Bill – ${booking?.restaurant_name}`,
      currency: 'INR',
      key: 'rzp_test_placeholder',
      amount: amountPaise,
      order_id: rzpOrderId,
      name: 'VELTO Food Palace',
      theme: { color: colors.primary },
    })
      .then(() => { queryClient.invalidateQueries({ queryKey: ['table-booking', bookingId] }); refetch(); })
      .catch(() => {});
  }, [booking?.restaurant_name, bookingId, queryClient, refetch]);

  const handleCancel = () => {
    Alert.alert(
      'Cancel Booking',
      booking?.free_cancellation_until && new Date() < new Date(booking.free_cancellation_until)
        ? 'You will receive a full refund to your wallet.'
        : 'Deposit will be forfeited. Pre-order amount will be refunded to wallet.',
      [
        { text: 'Keep Booking', style: 'cancel' },
        { text: 'Cancel Booking', style: 'destructive', onPress: () => cancelMutation.mutate() },
      ]
    );
  };

  const handlePostOrder = () => {
    const items = Object.entries(addItems)
      .filter(([, qty]) => qty > 0)
      .map(([itemId, quantity]) => ({ itemId, quantity }));
    if (!items.length) { Alert.alert('No Items', 'Please add at least one item.'); return; }
    postOrderMutation.mutate(items);
  };

  const handleWalletPay = () => payMutation.mutate('wallet');

  const handleUpiPay = () => payMutation.mutate('razorpay');

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />
      </View>
    );
  }

  const canCancel = booking?.status === 'confirmed' || booking?.status === 'pending_payment';
  const canOrderMore = booking?.status === 'seated';
  const canPay = booking?.status === 'seated' && (bill?.outstandingPaise || 0) > 0;
  const preOrderItems = booking?.items?.filter((i: any) => i.type === 'pre_order') || [];
  const postOrderItems = booking?.items?.filter((i: any) => i.type === 'post_order') || [];
  const statusColor = STATUS_COLORS[booking?.status] || '#6B7280';
  const addOrderTotal = allMenuItems.reduce((sum, item) => sum + (addItems[item.id] || 0) * item.price_paise, 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={22} color={colors.ink} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{booking?.display_id}</Text>
        <TouchableOpacity style={styles.qrBtn} onPress={() => setShowQR(true)}>
          <QrCode size={22} color={colors.ink} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Status banner */}
        <View style={[styles.statusBanner, { backgroundColor: statusColor + '18' }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusLabel, { color: statusColor }]}>{STATUS_LABELS[booking?.status] || booking?.status}</Text>
        </View>

        {/* Booking details */}
        <View style={styles.card}>
          <Text style={styles.restaurantName}>{booking?.restaurant_name}</Text>
          <DetailRow icon={<Calendar size={15} color={colors.inkMuted} />} label={formatSlot(booking?.slot_start)} />
          <DetailRow icon={<Clock size={15} color={colors.inkMuted} />} label={`Until ${new Date(booking?.slot_end).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`} />
          <DetailRow icon={<Users size={15} color={colors.inkMuted} />} label={`${booking?.party_size} guests`} />
          {booking?.occasion && (
            <DetailRow icon={<CheckCircle size={15} color={colors.inkMuted} />} label={booking.occasion} />
          )}
          {booking?.special_requests && (
            <View style={styles.requestNote}>
              <Text style={styles.requestLabel}>Special Requests</Text>
              <Text style={styles.requestText}>{booking.special_requests}</Text>
            </View>
          )}
        </View>

        {/* Pre-order items */}
        {preOrderItems.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Pre-Order</Text>
            {preOrderItems.map((item: any) => (
              <View key={item.id} style={styles.itemRow}>
                <Text style={styles.itemName}>{item.name} × {item.quantity}</Text>
                <View style={[styles.itemStatusBadge, { backgroundColor: item.status === 'served' ? '#10B98120' : '#F59E0B20' }]}>
                  <Text style={[styles.itemStatusText, { color: item.status === 'served' ? '#10B981' : '#D97706' }]}>
                    {ITEM_STATUS_LABELS[item.status] || item.status}
                  </Text>
                </View>
                <Text style={styles.itemPrice}>₹{(item.price_paise * item.quantity / 100).toFixed(0)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Post-order items */}
        {postOrderItems.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Additional Orders</Text>
            {postOrderItems.map((item: any) => (
              <View key={item.id} style={styles.itemRow}>
                <Text style={styles.itemName}>{item.name} × {item.quantity}</Text>
                <View style={[styles.itemStatusBadge, { backgroundColor: item.status === 'served' ? '#10B98120' : '#F59E0B20' }]}>
                  <Text style={[styles.itemStatusText, { color: item.status === 'served' ? '#10B981' : '#D97706' }]}>
                    {ITEM_STATUS_LABELS[item.status] || item.status}
                  </Text>
                </View>
                <Text style={styles.itemPrice}>₹{(item.price_paise * item.quantity / 100).toFixed(0)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Bill summary (when seated) */}
        {booking?.status === 'seated' && bill && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Bill Summary</Text>
            <BillRow label="Pre-order" value={`₹${((bill.preOrderAmountPaise || 0) / 100).toFixed(0)}`} />
            <BillRow label="Additional orders" value={`₹${((bill.postOrderAmountPaise || 0) / 100).toFixed(0)}`} />
            <BillRow label={`GST (${bill.gstPercent || 5}%)`} value={`₹${((bill.gstAmountPaise || 0) / 100).toFixed(0)}`} />
            <BillRow label="Total" value={`₹${((bill.grandTotalPaise || 0) / 100).toFixed(0)}`} bold />
            <BillRow label="Paid" value={`-₹${((bill.totalPaidPaise || 0) / 100).toFixed(0)}`} color="#10B981" />
            <View style={styles.outstandingRow}>
              <Text style={styles.outstandingLabel}>Outstanding</Text>
              <Text style={styles.outstandingAmount}>₹{((bill.outstandingPaise || 0) / 100).toFixed(0)}</Text>
            </View>
          </View>
        )}

        {/* Completed summary */}
        {booking?.status === 'completed' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Payment</Text>
            <BillRow label="Grand Total" value={`₹${((booking.pre_order_amount_paise + booking.post_order_amount_paise + booking.gst_amount_paise) / 100).toFixed(0)}`} bold />
            <BillRow label="Paid" value={`₹${(booking.total_paid_paise / 100).toFixed(0)}`} color="#10B981" />
            <BillRow label="Method" value={booking.final_payment_method?.replace('_', ' ') || 'Mixed'} />
          </View>
        )}

        {/* Cancellation info */}
        {booking?.status === 'confirmed' && booking?.free_cancellation_until && (
          <View style={styles.cancelInfoCard}>
            <AlertCircle size={16} color="#92400E" />
            <Text style={styles.cancelInfoText}>
              Free cancellation until {new Date(booking.free_cancellation_until).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.actionsWrap}>
          {canPay && (
            <View style={styles.payActions}>
              <Text style={styles.payTitle}>Pay Outstanding: ₹{((bill?.outstandingPaise || 0) / 100).toFixed(0)}</Text>
              <View style={styles.payBtnRow}>
                <BouncingButton style={styles.payBtn} onPress={handleWalletPay} disabled={payMutation.isPending}>
                  <CreditCard size={16} color="#fff" />
                  <Text style={styles.payBtnText}>Wallet</Text>
                </BouncingButton>
                <BouncingButton style={[styles.payBtn, { backgroundColor: '#6366F1' }]} onPress={handleUpiPay} disabled={payMutation.isPending}>
                  <CreditCard size={16} color="#fff" />
                  <Text style={styles.payBtnText}>UPI / Card</Text>
                </BouncingButton>
              </View>
            </View>
          )}

          {canOrderMore && (
            <BouncingButton style={styles.orderMoreBtn} onPress={() => setShowOrderMore(true)}>
              <ShoppingBag size={18} color={colors.primary} />
              <Text style={styles.orderMoreText}>Order More</Text>
            </BouncingButton>
          )}

          {canCancel && (
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} disabled={cancelMutation.isPending}>
              <Text style={styles.cancelBtnText}>
                {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Booking'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* QR Modal */}
      <Modal visible={showQR} animationType="fade" transparent>
        <View style={styles.qrModalOverlay}>
          <Animated.View entering={ZoomIn.duration(300)} style={styles.qrModal}>
            <TouchableOpacity style={styles.qrClose} onPress={() => setShowQR(false)}>
              <X size={22} color={colors.ink} />
            </TouchableOpacity>
            <Text style={styles.qrModalTitle}>Check-in QR</Text>
            <Text style={styles.qrModalRef}>{booking?.display_id}</Text>
            <View style={styles.qrModalCode}>
              <QRCode value={bookingId} size={220} color={colors.ink} backgroundColor="#fff" />
            </View>
            <Text style={styles.qrModalHint}>Show this to staff at the entrance</Text>
          </Animated.View>
        </View>
      </Modal>

      {/* Order More Modal */}
      <Modal visible={showOrderMore} animationType="slide" transparent>
        <View style={styles.orderMoreOverlay}>
          <View style={[styles.orderMoreSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.orderMoreHeader}>
              <Text style={styles.orderMoreTitle}>Order More</Text>
              <TouchableOpacity onPress={() => { setShowOrderMore(false); setAddItems({}); }}>
                <X size={22} color={colors.ink} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
              {allMenuItems.map((item: any) => {
                const qty = addItems[item.id] || 0;
                return (
                  <View key={item.id} style={styles.addItemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.addItemName}>{item.name}</Text>
                      <Text style={styles.addItemPrice}>₹{(item.price_paise / 100).toFixed(0)}</Text>
                    </View>
                    <View style={styles.addItemControls}>
                      {qty > 0 ? (
                        <>
                          <TouchableOpacity style={styles.addItemBtn} onPress={() => setAddItems(p => ({ ...p, [item.id]: Math.max(0, qty - 1) }))}>
                            <Minus size={14} color={colors.primary} />
                          </TouchableOpacity>
                          <Text style={styles.addItemQty}>{qty}</Text>
                          <TouchableOpacity style={styles.addItemBtn} onPress={() => setAddItems(p => ({ ...p, [item.id]: qty + 1 }))}>
                            <Plus size={14} color={colors.primary} />
                          </TouchableOpacity>
                        </>
                      ) : (
                        <TouchableOpacity style={styles.addItemAddBtn} onPress={() => setAddItems(p => ({ ...p, [item.id]: 1 }))}>
                          <Text style={styles.addItemAddText}>Add</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
            {addOrderTotal > 0 && (
              <BouncingButton
                style={styles.placeOrderBtn}
                onPress={handlePostOrder}
                disabled={postOrderMutation.isPending}
              >
                {postOrderMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.placeOrderText}>Place Order · ₹{(addOrderTotal / 100).toFixed(0)}</Text>
                )}
              </BouncingButton>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const DetailRow = ({ icon, label }: { icon: any; label: string }) => (
  <View style={styles.detailRow}>
    {icon}
    <Text style={styles.detailLabel}>{label}</Text>
  </View>
);

const BillRow = ({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) => (
  <View style={styles.billRow}>
    <Text style={[styles.billLabel, bold && styles.billLabelBold]}>{label}</Text>
    <Text style={[styles.billValue, bold && styles.billValueBold, color ? { color } : {}]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: fontFamily.semibold, color: colors.ink, textAlign: 'center' },
  qrBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end' },
  scrollContent: { padding: spacing.lg, gap: 12 },
  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, marginBottom: 4 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { fontSize: 14, fontFamily: fontFamily.semibold },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardTitle: { fontSize: 14, fontFamily: fontFamily.semibold, color: colors.ink, marginBottom: 10 },
  restaurantName: { fontSize: 16, fontFamily: fontFamily.bold, color: colors.ink, marginBottom: 10 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  detailLabel: { fontSize: 14, color: colors.ink, fontFamily: fontFamily.regular },
  requestNote: { marginTop: 10, backgroundColor: '#F9FAFB', borderRadius: 10, padding: 10 },
  requestLabel: { fontSize: 11, fontFamily: fontFamily.medium, color: colors.inkMuted, marginBottom: 4 },
  requestText: { fontSize: 13, color: colors.ink, fontFamily: fontFamily.regular },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F3F4F6' },
  itemName: { flex: 1, fontSize: 13, fontFamily: fontFamily.regular, color: colors.ink },
  itemStatusBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  itemStatusText: { fontSize: 11, fontFamily: fontFamily.medium },
  itemPrice: { fontSize: 13, fontFamily: fontFamily.medium, color: colors.ink, minWidth: 50, textAlign: 'right' },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  billLabel: { fontSize: 13, color: colors.inkMuted, fontFamily: fontFamily.regular },
  billLabelBold: { fontFamily: fontFamily.semibold, color: colors.ink },
  billValue: { fontSize: 13, color: colors.ink, fontFamily: fontFamily.medium },
  billValueBold: { fontFamily: fontFamily.bold },
  outstandingRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, marginTop: 6, borderTopWidth: 1.5, borderTopColor: colors.primary + '40' },
  outstandingLabel: { fontSize: 15, fontFamily: fontFamily.bold, color: colors.ink },
  outstandingAmount: { fontSize: 18, fontFamily: fontFamily.bold, color: colors.primary },
  cancelInfoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#FEF3C7', borderRadius: 12, padding: 12 },
  cancelInfoText: { flex: 1, fontSize: 12, fontFamily: fontFamily.medium, color: '#92400E', lineHeight: 18 },
  actionsWrap: { gap: 10 },
  payActions: { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  payTitle: { fontSize: 14, fontFamily: fontFamily.semibold, color: colors.ink, marginBottom: 12, textAlign: 'center' },
  payBtnRow: { flexDirection: 'row', gap: 10 },
  payBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 13 },
  payBtnText: { color: '#fff', fontSize: 14, fontFamily: fontFamily.semibold },
  orderMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 15, borderRadius: 16, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.primary + '08' },
  orderMoreText: { fontSize: 15, fontFamily: fontFamily.semibold, color: colors.primary },
  cancelBtn: { paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: '#FCA5A5', alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontFamily: fontFamily.medium, color: '#EF4444' },
  // QR Modal
  qrModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  qrModal: { backgroundColor: '#fff', borderRadius: 24, padding: 28, alignItems: 'center', width: '100%' },
  qrClose: { position: 'absolute', top: 16, right: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  qrModalTitle: { fontSize: 18, fontFamily: fontFamily.bold, color: colors.ink, marginBottom: 4 },
  qrModalRef: { fontSize: 13, fontFamily: fontFamily.medium, color: colors.inkMuted, marginBottom: 20 },
  qrModalCode: { padding: 16, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 16 },
  qrModalHint: { fontSize: 12, color: colors.inkMuted, fontFamily: fontFamily.regular },
  // Order More sheet
  orderMoreOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  orderMoreSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  orderMoreHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  orderMoreTitle: { fontSize: 17, fontFamily: fontFamily.bold, color: colors.ink },
  addItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F3F4F6' },
  addItemName: { fontSize: 14, fontFamily: fontFamily.medium, color: colors.ink, marginBottom: 2 },
  addItemPrice: { fontSize: 13, color: colors.inkMuted, fontFamily: fontFamily.regular },
  addItemControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  addItemBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary + '15', justifyContent: 'center', alignItems: 'center' },
  addItemQty: { fontSize: 15, fontFamily: fontFamily.semibold, color: colors.ink, minWidth: 20, textAlign: 'center' },
  addItemAddBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, borderWidth: 1.5, borderColor: colors.primary },
  addItemAddText: { fontSize: 13, fontFamily: fontFamily.semibold, color: colors.primary },
  placeOrderBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  placeOrderText: { fontSize: 15, fontFamily: fontFamily.semibold, color: '#fff' },
});

export default TableBookingDetailScreen;
