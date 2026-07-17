import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, ScrollView, Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  Calendar, ChevronLeft, ChevronRight, Users, Clock,
  X, CheckCircle, QrCode,
} from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { api } from '../../api/client';
import { getSocket } from '../../socket/client';
import { colors } from '../../theme/colors';
import { fontFamily } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { BouncingButton } from '../../components/ui/BouncingButton';

const pad = (n: number) => String(n).padStart(2, '0');
const formatDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const formatDateLabel = (d: Date) =>
  d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const formatTime = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const STATUS_COLORS: Record<string, string> = {
  pending_payment: '#F59E0B', confirmed: '#10B981',
  seated: '#3B82F6', completed: '#6B7280',
  cancelled: '#EF4444', no_show: '#EF4444',
};
const STATUS_LABELS: Record<string, string> = {
  pending_payment: 'Pending', confirmed: 'Confirmed',
  seated: 'Seated', completed: 'Completed',
  cancelled: 'Cancelled', no_show: 'No Show',
};

const PartnerBookingsScreen = () => {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDetail, setShowDetail] = useState<any>(null);
  const [showQR, setShowQR] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const dateStr = formatDate(selectedDate);

  const { data: restaurant } = useQuery({
    queryKey: ['partner-restaurant'],
    queryFn: () => api.get('/partner/restaurant').then((r: any) => r.restaurant),
  });

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['partner-bookings', dateStr],
    queryFn: () =>
      restaurant?.id
        ? api.get(`/table-bookings/restaurant/${restaurant.id}?date=${dateStr}`).then((r: any) => r.bookings as any[])
        : [],
    enabled: !!restaurant?.id,
    refetchInterval: 30000,
  });

  const checkinMutation = useMutation({
    mutationFn: (bookingId: string) => api.post(`/table-bookings/${bookingId}/checkin`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-bookings'] });
      Alert.alert('Checked In', 'Guest has been seated successfully.');
      setShowDetail(null);
    },
    onError: (err: any) => Alert.alert('Error', err?.message || 'Check-in failed.'),
  });

  const noShowMutation = useMutation({
    mutationFn: (bookingId: string) => api.post(`/table-bookings/${bookingId}/no-show`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-bookings'] });
      setShowDetail(null);
    },
    onError: (err: any) => Alert.alert('Error', err?.message || 'Failed.'),
  });

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['partner-bookings'] });
    socket.on('table_booking_updated', refresh);
    socket.on('table_order', refresh);
    socket.on('table_checkin', refresh);
    socket.on('table_checkout', refresh);
    return () => {
      socket.off('table_booking_updated', refresh);
      socket.off('table_order', refresh);
      socket.off('table_checkin', refresh);
      socket.off('table_checkout', refresh);
    };
  }, [queryClient]);

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['partner-bookings'] });
    setRefreshing(false);
  };

  const prevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d);
  };
  const nextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d);
  };

  const handleNoShow = (b: any) => {
    Alert.alert(
      'Mark No Show',
      `Mark ${b.display_id} as no-show? Pre-order will be refunded, deposit forfeited.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark No Show', style: 'destructive', onPress: () => noShowMutation.mutate(b.id) },
      ]
    );
  };

  const renderItem = ({ item: b, index }: { item: any; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 40).duration(280)}>
      <TouchableOpacity
        style={styles.bookingCard}
        onPress={() => setShowDetail(b)}
        activeOpacity={0.8}
      >
        <View style={styles.cardLeft}>
          <Text style={styles.timeText}>{formatTime(b.slot_start)}</Text>
          <Text style={styles.timeEnd}>{formatTime(b.slot_end)}</Text>
        </View>
        <View style={styles.cardInfo}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.refId}>{b.display_id}</Text>
            <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[b.status] || '#6B7280') + '18' }]}>
              <Text style={[styles.statusText, { color: STATUS_COLORS[b.status] || '#6B7280' }]}>
                {STATUS_LABELS[b.status] || b.status}
              </Text>
            </View>
          </View>
          <Text style={styles.guestName}>{b.customer_name || 'Guest'}</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaChip}>
              <Users size={11} color={colors.inkMuted} />
              <Text style={styles.metaText}>{b.party_size} guests</Text>
            </View>
            {b.pre_order_amount_paise > 0 && (
              <View style={[styles.metaChip, { backgroundColor: colors.primary + '12' }]}>
                <Text style={[styles.metaText, { color: colors.primary }]}>Pre-order ₹{(b.pre_order_amount_paise / 100).toFixed(0)}</Text>
              </View>
            )}
            {b.occasion && (
              <View style={[styles.metaChip, { backgroundColor: '#FEF3C7' }]}>
                <Text style={[styles.metaText, { color: '#92400E' }]}>{b.occasion}</Text>
              </View>
            )}
          </View>
        </View>
        <ChevronRight size={16} color={colors.inkFaint} />
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bookings</Text>
      </View>

      {/* Date navigator */}
      <View style={styles.dateNav}>
        <TouchableOpacity style={styles.navBtn} onPress={prevDay}>
          <ChevronLeft size={20} color={colors.ink} />
        </TouchableOpacity>
        <View style={styles.dateCenter}>
          <Calendar size={16} color={colors.primary} />
          <Text style={styles.dateLabel}>{formatDateLabel(selectedDate)}</Text>
          {formatDate(selectedDate) === formatDate(new Date()) && (
            <View style={styles.todayBadge}>
              <Text style={styles.todayText}>Today</Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={styles.navBtn} onPress={nextDay}>
          <ChevronRight size={20} color={colors.ink} />
        </TouchableOpacity>
      </View>

      {/* Count summary */}
      {!isLoading && bookings.length > 0 && (
        <View style={styles.countRow}>
          <Text style={styles.countText}>{bookings.length} booking{bookings.length !== 1 ? 's' : ''}</Text>
          {['confirmed', 'seated'].map(s => {
            const n = bookings.filter((b: any) => b.status === s).length;
            if (!n) return null;
            return (
              <View key={s} style={[styles.countBadge, { backgroundColor: STATUS_COLORS[s] + '15' }]}>
                <Text style={[styles.countBadgeText, { color: STATUS_COLORS[s] }]}>{n} {STATUS_LABELS[s]}</Text>
              </View>
            );
          })}
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(b: any) => b.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Calendar size={40} color={colors.inkFaint} strokeWidth={1} />
              <Text style={styles.emptyText}>No bookings for {formatDateLabel(selectedDate)}</Text>
            </View>
          }
        />
      )}

      {/* Booking detail modal */}
      <Modal visible={!!showDetail} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.detailSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>{showDetail?.display_id}</Text>
              <TouchableOpacity onPress={() => setShowDetail(null)}>
                <X size={22} color={colors.ink} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={[styles.detailStatus, { backgroundColor: (STATUS_COLORS[showDetail?.status] || '#6B7280') + '15' }]}>
                <Text style={[styles.detailStatusText, { color: STATUS_COLORS[showDetail?.status] || '#6B7280' }]}>
                  {STATUS_LABELS[showDetail?.status] || showDetail?.status}
                </Text>
              </View>

              <DetailRow label="Customer" value={showDetail?.customer_name || 'Guest'} />
              <DetailRow label="Phone" value={showDetail?.customer_phone || '–'} />
              <DetailRow label="Time" value={showDetail ? `${formatTime(showDetail.slot_start)} – ${formatTime(showDetail.slot_end)}` : ''} />
              <DetailRow label="Guests" value={`${showDetail?.party_size}`} />
              {showDetail?.occasion && <DetailRow label="Occasion" value={showDetail.occasion} />}
              {showDetail?.special_requests && <DetailRow label="Requests" value={showDetail.special_requests} />}

              {showDetail?.pre_order_amount_paise > 0 && (
                <View style={styles.amountCard}>
                  <Text style={styles.amountLabel}>Pre-order (paid by customer)</Text>
                  <Text style={styles.amountValue}>₹{(showDetail.pre_order_amount_paise / 100).toFixed(0)}</Text>
                </View>
              )}

              {showDetail?.status === 'confirmed' && (
                <TouchableOpacity style={styles.qrButton} onPress={() => setShowQR(true)}>
                  <QrCode size={18} color={colors.primary} />
                  <Text style={styles.qrButtonText}>View Check-in QR</Text>
                </TouchableOpacity>
              )}

              {showDetail?.status === 'confirmed' && (
                <TouchableOpacity
                  style={styles.checkinBtn}
                  onPress={() => Alert.alert(
                    'Check In Guest',
                    `Seat ${showDetail.display_id} for ${showDetail.party_size} guests?`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Check In', onPress: () => checkinMutation.mutate(showDetail.id) },
                    ]
                  )}
                  disabled={checkinMutation.isPending}
                >
                  <Text style={styles.checkinBtnText}>
                    {checkinMutation.isPending ? 'Checking in…' : 'Check In Guest'}
                  </Text>
                </TouchableOpacity>
              )}

              {showDetail?.status === 'confirmed' && (
                <TouchableOpacity
                  style={styles.noShowBtn}
                  onPress={() => handleNoShow(showDetail)}
                  disabled={noShowMutation.isPending}
                >
                  <Text style={styles.noShowBtnText}>Mark No Show</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* QR Modal */}
      <Modal visible={showQR} animationType="fade" transparent>
        <View style={styles.qrOverlay}>
          <View style={styles.qrCard}>
            <TouchableOpacity style={styles.qrClose} onPress={() => setShowQR(false)}>
              <X size={22} color={colors.ink} />
            </TouchableOpacity>
            <Text style={styles.qrTitle}>Check-in QR</Text>
            {showDetail?.id && (
              <View style={styles.qrCodeWrap}>
                <QRCode value={showDetail.id} size={200} color={colors.ink} backgroundColor="#fff" />
              </View>
            )}
            <Text style={styles.qrHint}>Customer scans this at entrance</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailRowLabel}>{label}</Text>
    <Text style={styles.detailRowValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingVertical: 14 },
  headerTitle: { fontSize: 22, fontFamily: fontFamily.bold, color: colors.ink },
  dateNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB' },
  navBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  dateCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateLabel: { fontSize: 16, fontFamily: fontFamily.semibold, color: colors.ink },
  todayBadge: { backgroundColor: colors.primary + '15', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  todayText: { fontSize: 11, fontFamily: fontFamily.semibold, color: colors.primary },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.lg, paddingVertical: 8 },
  countText: { fontSize: 13, fontFamily: fontFamily.medium, color: colors.inkMuted },
  countBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  countBadgeText: { fontSize: 11, fontFamily: fontFamily.semibold },
  listContent: { padding: spacing.lg, gap: 8, paddingBottom: 40 },
  bookingCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  cardLeft: { width: 52, alignItems: 'center', marginRight: 12 },
  timeText: { fontSize: 14, fontFamily: fontFamily.bold, color: colors.ink },
  timeEnd: { fontSize: 11, color: colors.inkMuted, fontFamily: fontFamily.regular },
  cardInfo: { flex: 1 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  refId: { fontSize: 13, fontFamily: fontFamily.semibold, color: colors.ink },
  statusBadge: { borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2 },
  statusText: { fontSize: 10, fontFamily: fontFamily.semibold },
  guestName: { fontSize: 14, fontFamily: fontFamily.medium, color: colors.ink, marginBottom: 6 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F3F4F6', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  metaText: { fontSize: 11, color: colors.inkMuted, fontFamily: fontFamily.medium },
  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15, color: colors.inkMuted, fontFamily: fontFamily.regular },
  // Detail modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  detailSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  detailTitle: { fontSize: 20, fontFamily: fontFamily.bold, color: colors.ink },
  detailStatus: { borderRadius: 10, padding: 10, alignItems: 'center', marginBottom: 16 },
  detailStatusText: { fontSize: 14, fontFamily: fontFamily.semibold },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F3F4F6' },
  detailRowLabel: { fontSize: 13, color: colors.inkMuted, fontFamily: fontFamily.regular },
  detailRowValue: { fontSize: 13, fontFamily: fontFamily.medium, color: colors.ink, flex: 1, textAlign: 'right' },
  amountCard: { backgroundColor: colors.primary + '10', borderRadius: 12, padding: 14, marginTop: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amountLabel: { fontSize: 13, fontFamily: fontFamily.medium, color: colors.primary },
  amountValue: { fontSize: 18, fontFamily: fontFamily.bold, color: colors.primary },
  qrButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14, paddingVertical: 13, borderRadius: 12, borderWidth: 1.5, borderColor: colors.primary },
  qrButtonText: { fontSize: 14, fontFamily: fontFamily.semibold, color: colors.primary },
  checkinBtn: { marginTop: 14, paddingVertical: 13, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  checkinBtnText: { fontSize: 14, fontFamily: fontFamily.semibold, color: '#fff' },
  noShowBtn: { marginTop: 10, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: '#FCA5A5', alignItems: 'center' },
  noShowBtnText: { fontSize: 14, fontFamily: fontFamily.medium, color: '#EF4444' },
  // QR modal
  qrOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  qrCard: { backgroundColor: '#fff', borderRadius: 24, padding: 28, alignItems: 'center', width: '100%' },
  qrClose: { position: 'absolute', top: 16, right: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  qrTitle: { fontSize: 18, fontFamily: fontFamily.bold, color: colors.ink, marginBottom: 20 },
  qrCodeWrap: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 14 },
  qrHint: { fontSize: 12, color: colors.inkMuted, fontFamily: fontFamily.regular },
});

export default PartnerBookingsScreen;
