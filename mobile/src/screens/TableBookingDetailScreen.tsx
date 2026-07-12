import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal,
  ActivityIndicator, Alert, Image, TextInput, FlatList,
} from 'react-native';
import { SkeletonScreenList, SkeletonListItem } from '../components/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { ZoomIn } from 'react-native-reanimated';
import {
  ChevronLeft, QrCode, ShoppingBag, X, Plus, Minus,
  CheckCircle, AlertCircle, Clock, Users, Calendar, CreditCard,
} from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { api } from '../api/client';
import { getSocket } from '../socket/client';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { BouncingButton } from '../components/ui/BouncingButton';

let RazorpayCheckout: any = null;
try { RazorpayCheckout = require('react-native-razorpay').default; } catch (_) {}

const formatTime12h = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();

const formatSlot = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })} · ${formatTime12h(d)}`;
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
  const [menuSearch, setMenuSearch] = useState('');
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState<Date>(new Date());
  const [rescheduleSlot, setRescheduleSlot] = useState<any>(null);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const { data: booking, isLoading, refetch } = useQuery({
    queryKey: ['table-booking', bookingId],
    queryFn: () => api.get(`/table-bookings/${bookingId}`).then((r: any) => r.booking),
    refetchInterval: 20000,
  });

  const { data: bill } = useQuery({
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
  const filteredMenuItems = useMemo(() => {
    if (!menuSearch.trim()) return allMenuItems;
    const q = menuSearch.trim().toLowerCase();
    return allMenuItems.filter((i: any) =>
      i.name?.toLowerCase().includes(q) || i.category?.toLowerCase().includes(q)
    );
  }, [allMenuItems, menuSearch]);

  const pad = (n: number) => String(n).padStart(2, '0');
  const dateOptions = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i); return d;
  });
  const rescheduleDateStr = `${rescheduleDate.getFullYear()}-${pad(rescheduleDate.getMonth() + 1)}-${pad(rescheduleDate.getDate())}`;

  const { data: rescheduleSlots, isLoading: rescheduleSlotsLoading } = useQuery({
    queryKey: ['reschedule-slots', booking?.restaurant_id, rescheduleDateStr, booking?.party_size],
    queryFn: () => api.get(`/restaurants/${booking.restaurant_id}/availability?date=${rescheduleDateStr}&partySize=${booking.party_size}`)
      .then((r: any) => r.slots as any[]),
    enabled: showReschedule && !!booking?.restaurant_id,
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/table-bookings/${bookingId}/cancel`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['table-booking', bookingId] }); refetch(); },
    onError: (err: any) => Alert.alert('Cannot Cancel', err?.message || 'Please try again.'),
  });

  const rescheduleMutation = useMutation({
    mutationFn: (slot: any) => api.post(`/table-bookings/${bookingId}/reschedule`, { slotStart: slot.slotStart, slotEnd: slot.slotEnd }),
    onSuccess: () => {
      setShowReschedule(false);
      setRescheduleSlot(null);
      queryClient.invalidateQueries({ queryKey: ['table-booking', bookingId] });
      refetch();
      Alert.alert('Rescheduled!', 'Your booking has been moved to the new slot.');
    },
    onError: (err: any) => {
      const msg = err?.message || '';
      if (msg === 'NO_TABLE_AVAILABLE') Alert.alert('No Tables', 'No tables available for that slot. Try a different time.');
      else if (msg === 'RESCHEDULE_LIMIT') Alert.alert('Limit Reached', 'Maximum 2 reschedules allowed per booking.');
      else Alert.alert('Error', msg || 'Could not reschedule. Please try again.');
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: (data: { rating: number; comment: string }) =>
      api.post(`/table-bookings/${bookingId}/feedback`, data),
    onSuccess: () => {
      setFeedbackSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ['table-booking', bookingId] });
    },
    onError: (err: any) => Alert.alert('Error', err?.message || 'Could not submit feedback.'),
  });

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = (event: any) => {
      if (event.bookingId === bookingId) {
        queryClient.invalidateQueries({ queryKey: ['table-booking', bookingId] });
        queryClient.invalidateQueries({ queryKey: ['table-booking-bill', bookingId] });
      }
    };
    socket.on('table_booking_updated', handler);
    return () => { socket.off('table_booking_updated', handler); };
  }, [bookingId, queryClient]);

  const postOrderMutation = useMutation({
    mutationFn: (items: any[]) => api.post(`/table-bookings/${bookingId}/post-order`, { items }),
    onSuccess: () => {
      setShowOrderMore(false);
      setAddItems({});
      setMenuSearch('');
      queryClient.invalidateQueries({ queryKey: ['table-booking', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['table-booking-bill', bookingId] });
    },
    onError: (err: any) => Alert.alert('Error', err?.message || 'Failed to add items.'),
  });

  const payMutation = useMutation({
    mutationFn: (method: string) => api.post(`/table-bookings/${bookingId}/pay`, { paymentMethod: method }),
    onSuccess: (data) => {
      if (data.razorpayOrderId) openRazorpay(data.razorpayOrderId, data.amountPaise, data.razorpayKeyId);
      else { queryClient.invalidateQueries({ queryKey: ['table-booking', bookingId] }); refetch(); }
    },
    onError: (err: any) => Alert.alert('Payment Error', err?.message || 'Failed.'),
  });

  const openRazorpay = useCallback((rzpOrderId: string, amountPaise: number, rzpKey: string) => {
    if (!RazorpayCheckout) { Alert.alert('Error', 'Payment module not available.'); return; }
    RazorpayCheckout.open({
      description: `Table Bill – ${booking?.restaurant_name}`,
      currency: 'INR',
      key: rzpKey,
      amount: amountPaise,
      order_id: rzpOrderId,
      name: 'VELTO Food Palace',
      theme: { color: colors.primary },
    })
      .then((response: any) => {
        api.post(`/table-bookings/${bookingId}/verify-final-payment`, {
          razorpayOrderId: response.razorpay_order_id || rzpOrderId,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
        })
          .then(() => {
            queryClient.invalidateQueries({ queryKey: ['table-booking', bookingId] });
            refetch();
          })
          .catch((e: any) => {
            console.warn('[verify-final-payment]', e?.message);
            Alert.alert('Payment Received', 'Payment captured but confirmation is delayed. Your bill will update shortly.');
            queryClient.invalidateQueries({ queryKey: ['table-booking', bookingId] });
          });
      })
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
      .map(([itemId, quantity]) => ({ menuItemId: itemId, quantity }));
    if (!items.length) { Alert.alert('No Items', 'Please add at least one item.'); return; }
    postOrderMutation.mutate(items);
  };

  const handleWalletPay = () => payMutation.mutate('wallet');

  const handleUpiPay = () => payMutation.mutate('razorpay');

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft size={22} color={colors.ink} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Booking Detail</Text>
          <View style={{ width: 40 }} />
        </View>
        <SkeletonScreenList item={<SkeletonListItem />} />
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
          <DetailRow icon={<Clock size={15} color={colors.inkMuted} />} label={`Until ${formatTime12h(new Date(booking?.slot_end))}`} />
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
        {booking?.status === 'confirmed' && booking?.free_cancellation_until && (() => {
          const canCancelFree = new Date() < new Date(booking.free_cancellation_until);
          return canCancelFree ? (
            <View style={styles.cancelInfoCard}>
              <AlertCircle size={16} color="#92400E" />
              <Text style={styles.cancelInfoText}>
                Free cancellation until {new Date(booking.free_cancellation_until).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}, {formatTime12h(new Date(booking.free_cancellation_until))}
              </Text>
            </View>
          ) : (
            <View style={[styles.cancelInfoCard, { backgroundColor: '#FEE2E2' }]}>
              <AlertCircle size={16} color="#B91C1C" />
              <Text style={[styles.cancelInfoText, { color: '#B91C1C' }]}>
                Cancellation window has passed. Deposit will be forfeited if you cancel now.
              </Text>
            </View>
          );
        })()}

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

          {/* Reschedule button — confirmed, max 2 times */}
          {booking?.status === 'confirmed' && (booking?.reschedule_count ?? 0) < 2 && (
            <TouchableOpacity style={styles.rescheduleBtn} onPress={() => { setRescheduleDate(new Date()); setRescheduleSlot(null); setShowReschedule(true); }}>
              <Text style={styles.rescheduleBtnText}>
                Reschedule Booking{(booking?.reschedule_count ?? 0) > 0 ? ` (${2 - (booking?.reschedule_count ?? 0)} left)` : ''}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Feedback card — completed, not yet reviewed */}
        {booking?.status === 'completed' && !booking?.feedback_at && !feedbackSubmitted && (
          <View style={styles.feedbackCard}>
            <Text style={styles.feedbackTitle}>How was your experience?</Text>
            <Text style={styles.feedbackSub}>Rate your dining at {booking?.restaurant_name}</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map(star => (
                <TouchableOpacity key={star} onPress={() => setFeedbackRating(star)} style={styles.starBtn}>
                  <Text style={[styles.starIcon, feedbackRating >= star && styles.starActive]}>★</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.feedbackInput}
              placeholder="Tell us more (optional)…"
              placeholderTextColor={colors.inkFaint}
              value={feedbackComment}
              onChangeText={setFeedbackComment}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <BouncingButton
              style={[styles.feedbackSubmitBtn, feedbackRating === 0 && { opacity: 0.4 }]}
              onPress={() => { if (feedbackRating > 0) feedbackMutation.mutate({ rating: feedbackRating, comment: feedbackComment }); }}
              disabled={feedbackRating === 0 || feedbackMutation.isPending}
            >
              <Text style={styles.feedbackSubmitText}>
                {feedbackMutation.isPending ? 'Submitting…' : 'Submit Review'}
              </Text>
            </BouncingButton>
          </View>
        )}

        {booking?.status === 'completed' && (booking?.feedback_at || feedbackSubmitted) && (
          <View style={[styles.feedbackCard, { alignItems: 'center', paddingVertical: 18 }]}>
            <Text style={{ fontSize: 28 }}>🙏</Text>
            <Text style={[styles.feedbackTitle, { marginTop: 8 }]}>Thanks for your feedback!</Text>
          </View>
        )}

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

      {/* Reschedule Modal */}
      <Modal visible={showReschedule} animationType="slide" onRequestClose={() => setShowReschedule(false)}>
        <View style={[styles.rsModal, { paddingTop: insets.top }]}>
          <View style={styles.rsHeader}>
            <TouchableOpacity onPress={() => setShowReschedule(false)} style={styles.backBtn}>
              <X size={22} color={colors.ink} />
            </TouchableOpacity>
            <Text style={styles.rsTitle}>Reschedule</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
            <Text style={styles.rsSection}>Pick a new date</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rsDateScroll}>
              {dateOptions.map((d, i) => {
                const dStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                const selStr = rescheduleDateStr;
                const isSelected = dStr === selStr;
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.rsDateCard, isSelected && styles.rsDateCardActive]}
                    onPress={() => { setRescheduleDate(d); setRescheduleSlot(null); }}
                  >
                    <Text style={[styles.rsDateDay, isSelected && styles.rsDateTextActive]}>
                      {d.toLocaleDateString('en-IN', { weekday: 'short' })}
                    </Text>
                    <Text style={[styles.rsDateNum, isSelected && styles.rsDateTextActive]}>{d.getDate()}</Text>
                    <Text style={[styles.rsDateMon, isSelected && styles.rsDateTextActive]}>
                      {d.toLocaleDateString('en-IN', { month: 'short' })}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.rsSection}>Pick a time slot</Text>
            {rescheduleSlotsLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
            ) : (
              <View style={styles.rsSlotGrid}>
                {(rescheduleSlots || []).map((slot: any, i: number) => {
                  const d = new Date(slot.slotStart);
                  const label = formatTime12h(d);
                  const isActive = rescheduleSlot?.slotStart === slot.slotStart;
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[styles.rsSlot, isActive && styles.rsSlotActive, !slot.available && styles.rsSlotDisabled]}
                      disabled={!slot.available}
                      onPress={() => setRescheduleSlot(slot)}
                    >
                      <Text style={[styles.rsSlotText, isActive && styles.rsSlotTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
                {!rescheduleSlotsLoading && !(rescheduleSlots?.length) && (
                  <Text style={{ fontSize: 14, color: colors.inkMuted, padding: 16 }}>No slots available. Try another date.</Text>
                )}
              </View>
            )}
          </ScrollView>

          <View style={[styles.rsFooter, { paddingBottom: insets.bottom + 12 }]}>
            <BouncingButton
              style={[styles.rsConfirmBtn, (!rescheduleSlot || rescheduleMutation.isPending) && { opacity: 0.5 }]}
              disabled={!rescheduleSlot || rescheduleMutation.isPending}
              onPress={() => rescheduleSlot && rescheduleMutation.mutate(rescheduleSlot)}
            >
              <Text style={styles.rsConfirmText}>
                {rescheduleMutation.isPending ? 'Moving booking…' : rescheduleSlot ? `Confirm – ${formatTime12h(new Date(rescheduleSlot.slotStart))}` : 'Select a slot'}
              </Text>
            </BouncingButton>
          </View>
        </View>
      </Modal>

      {/* Order More Modal */}
      <Modal
        visible={showOrderMore}
        animationType="slide"
        onRequestClose={() => { setShowOrderMore(false); setAddItems({}); setMenuSearch(''); }}
      >
        <View style={[styles.orderMoreFull, { paddingTop: insets.top }]}>
          {/* Header */}
          <View style={styles.orderMoreHeader}>
            <TouchableOpacity onPress={() => { setShowOrderMore(false); setAddItems({}); setMenuSearch(''); }} style={styles.omCloseBtn}>
              <X size={22} color={colors.ink} />
            </TouchableOpacity>
            <Text style={styles.orderMoreTitle}>Order More</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Search */}
          <View style={styles.omSearchWrap}>
            <TextInput
              style={styles.omSearchInput}
              placeholder="Search dishes…"
              placeholderTextColor="#9CA3AF"
              value={menuSearch}
              onChangeText={setMenuSearch}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>

          {/* Items list */}
          <FlatList
            data={filteredMenuItems}
            keyExtractor={(item: any) => item.id}
            contentContainerStyle={styles.omListContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.omEmpty}>
                <Text style={styles.omEmptyText}>{menuSearch ? 'No items match your search' : 'No items available'}</Text>
              </View>
            }
            renderItem={({ item }: any) => {
              const qty = addItems[item.id] || 0;
              return (
                <View style={styles.omItemCard}>
                  {/* Image */}
                  {item.photo_url ? (
                    <Image source={{ uri: item.photo_url }} style={styles.omItemImage} resizeMode="cover" />
                  ) : (
                    <View style={[styles.omItemImage, styles.omItemImageFallback]}>
                      <Text style={styles.omItemImageEmoji}>🍽️</Text>
                    </View>
                  )}

                  {/* Info */}
                  <View style={styles.omItemInfo}>
                    <View style={styles.omItemTopRow}>
                      <View style={[styles.vegDot, { backgroundColor: item.is_veg ? '#16A34A' : '#DC2626' }]} />
                      <Text style={styles.omItemName} numberOfLines={2}>{item.name}</Text>
                    </View>
                    {item.category ? <Text style={styles.omItemCategory}>{item.category}</Text> : null}
                    <Text style={styles.omItemPrice}>₹{(item.price_paise / 100).toFixed(0)}</Text>
                  </View>

                  {/* Controls */}
                  <View style={styles.omItemControls}>
                    {qty > 0 ? (
                      <View style={styles.omQtyRow}>
                        <TouchableOpacity style={styles.omQtyBtn} onPress={() => setAddItems(p => ({ ...p, [item.id]: Math.max(0, qty - 1) }))}>
                          <Minus size={14} color={colors.primary} />
                        </TouchableOpacity>
                        <Text style={styles.omQtyText}>{qty}</Text>
                        <TouchableOpacity style={styles.omQtyBtn} onPress={() => setAddItems(p => ({ ...p, [item.id]: qty + 1 }))}>
                          <Plus size={14} color={colors.primary} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity style={styles.omAddBtn} onPress={() => setAddItems(p => ({ ...p, [item.id]: 1 }))}>
                        <Text style={styles.omAddBtnText}>Add</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            }}
          />

          {/* Place order footer */}
          {addOrderTotal > 0 && (
            <View style={[styles.omFooter, { paddingBottom: insets.bottom + 12 }]}>
              <BouncingButton style={styles.placeOrderBtn} onPress={handlePostOrder} disabled={postOrderMutation.isPending}>
                {postOrderMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.placeOrderText}>Place Order · ₹{(addOrderTotal / 100).toFixed(0)}</Text>
                )}
              </BouncingButton>
            </View>
          )}
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
  // Order More — full screen
  orderMoreFull: { flex: 1, backgroundColor: '#F9FAFB' },
  orderMoreHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB' },
  omCloseBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  orderMoreTitle: { fontSize: 17, fontFamily: fontFamily.bold, color: colors.ink },
  omSearchWrap: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB' },
  omSearchInput: { backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, fontFamily: fontFamily.regular, color: colors.ink },
  omListContent: { padding: 12, gap: 10, paddingBottom: 120 },
  omItemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 12, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  omItemImage: { width: 80, height: 80, borderRadius: 12 },
  omItemImageFallback: { backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  omItemImageEmoji: { fontSize: 28 },
  omItemInfo: { flex: 1, gap: 3 },
  omItemTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  vegDot: { width: 10, height: 10, borderRadius: 5, marginTop: 3, flexShrink: 0 },
  omItemName: { flex: 1, fontSize: 14, fontFamily: fontFamily.semibold, color: colors.ink, lineHeight: 19 },
  omItemCategory: { fontSize: 11, fontFamily: fontFamily.regular, color: colors.inkMuted },
  omItemPrice: { fontSize: 14, fontFamily: fontFamily.bold, color: colors.primary },
  omItemControls: { alignItems: 'center', justifyContent: 'center', minWidth: 80 },
  omQtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: colors.primary, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 4 },
  omQtyBtn: { width: 26, height: 26, justifyContent: 'center', alignItems: 'center' },
  omQtyText: { fontSize: 15, fontFamily: fontFamily.semibold, color: colors.ink, minWidth: 18, textAlign: 'center' },
  omAddBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: colors.primary },
  omAddBtnText: { fontSize: 13, fontFamily: fontFamily.semibold, color: colors.primary },
  omEmpty: { paddingTop: 60, alignItems: 'center' },
  omEmptyText: { fontSize: 14, color: colors.inkMuted, fontFamily: fontFamily.regular },
  omFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E7EB' },
  placeOrderBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  placeOrderText: { fontSize: 15, fontFamily: fontFamily.semibold, color: '#fff' },
  rescheduleBtn: { paddingVertical: 14, borderRadius: 14, backgroundColor: '#6366F1', alignItems: 'center' },
  rescheduleBtnText: { fontSize: 14, fontFamily: fontFamily.semibold, color: '#fff' },
  feedbackCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginHorizontal: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  feedbackTitle: { fontSize: 16, fontFamily: fontFamily.bold, color: colors.ink, textAlign: 'center', marginBottom: 4 },
  feedbackSub: { fontSize: 13, color: colors.inkMuted, fontFamily: fontFamily.regular, textAlign: 'center', marginBottom: 16 },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 14 },
  starBtn: { padding: 4 },
  starIcon: { fontSize: 36, color: '#D1D5DB' },
  starActive: { color: '#F59E0B' },
  feedbackInput: { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, fontSize: 14, fontFamily: fontFamily.regular, color: colors.ink, backgroundColor: '#FAFAFA', minHeight: 80, marginBottom: 12 },
  feedbackSubmitBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  feedbackSubmitText: { fontSize: 15, fontFamily: fontFamily.semibold, color: '#fff' },
  rsModal: { flex: 1, backgroundColor: colors.background },
  rsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB' },
  rsTitle: { fontSize: 17, fontFamily: fontFamily.bold, color: colors.ink },
  rsSection: { fontSize: 14, fontFamily: fontFamily.semibold, color: colors.ink, paddingHorizontal: 16, marginTop: 18, marginBottom: 8 },
  rsDateScroll: { paddingHorizontal: 16, paddingBottom: 4, gap: 8 },
  rsDateCard: { width: 58, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: 'transparent' },
  rsDateCardActive: { backgroundColor: colors.primary + '15', borderColor: colors.primary },
  rsDateDay: { fontSize: 11, fontFamily: fontFamily.medium, color: colors.inkMuted },
  rsDateNum: { fontSize: 20, fontFamily: fontFamily.bold, color: colors.ink, marginVertical: 2 },
  rsDateMon: { fontSize: 11, fontFamily: fontFamily.medium, color: colors.inkMuted },
  rsDateTextActive: { color: colors.primary },
  rsSlotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16 },
  rsSlot: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: 'transparent' },
  rsSlotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  rsSlotDisabled: { opacity: 0.35 },
  rsSlotText: { fontSize: 14, fontFamily: fontFamily.medium, color: colors.ink },
  rsSlotTextActive: { color: '#fff' },
  rsFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E7EB' },
  rsConfirmBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  rsConfirmText: { fontSize: 15, fontFamily: fontFamily.semibold, color: '#fff' },
});

export default TableBookingDetailScreen;
