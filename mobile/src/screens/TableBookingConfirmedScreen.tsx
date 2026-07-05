import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Share, Alert, ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { CheckCircle, Calendar, Clock, Users, Share2, ChevronRight } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { api } from '../api/client';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { BouncingButton } from '../components/ui/BouncingButton';

const pad = (n: number) => String(n).padStart(2, '0');

const formatSlot = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const TableBookingConfirmedScreen = ({ navigation, route }: any) => {
  const { bookingId } = route.params;
  const insets = useSafeAreaInsets();

  const { data: booking, isLoading } = useQuery({
    queryKey: ['table-booking', bookingId],
    queryFn: () => api.get(`/table-bookings/${bookingId}`).then((r: any) => r.booking),
  });

  const handleShare = async () => {
    if (!booking) {
      Alert.alert('Please wait', 'Booking details are still loading.');
      return;
    }
    try {
      await Share.share({
        title: `Table at ${booking.restaurant_name || 'Restaurant'}`,
        message: [
          `I've booked a table at ${booking.restaurant_name || 'the restaurant'}!`,
          `📅 ${formatSlot(booking.slot_start)}`,
          `👥 ${booking.party_size} ${booking.party_size === 1 ? 'guest' : 'guests'}`,
          `🔖 Ref: ${booking.display_id}`,
        ].join('\n'),
      });
    } catch (e: any) {
      if (e?.message !== 'User did not share' && e?.message !== 'User dismissed the dialog') {
        Alert.alert('Unable to Share', 'Could not open share dialog. Please try again.');
      }
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />
      ) : (
        <Animated.ScrollView
          entering={FadeInDown.duration(400)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Success icon */}
          <Animated.View entering={ZoomIn.delay(100).duration(450)} style={styles.successIcon}>
            <CheckCircle size={64} color={colors.primary} strokeWidth={1.5} />
          </Animated.View>

          <Text style={styles.title}>Booking Confirmed!</Text>
          <Text style={styles.subtitle}>Your table is reserved. Show the QR code at the entrance.</Text>

          {/* Booking details */}
          <View style={styles.detailCard}>
            <Text style={styles.refId}>{booking?.display_id || bookingId}</Text>
            <View style={styles.divider} />
            <DetailRow icon={<Calendar size={16} color={colors.primary} />} label={formatSlot(booking?.slot_start)} />
            <DetailRow icon={<Clock size={16} color={colors.primary} />} label={`Until ${new Date(booking?.slot_end).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`} />
            <DetailRow icon={<Users size={16} color={colors.primary} />} label={`${booking?.party_size} ${booking?.party_size === 1 ? 'guest' : 'guests'}`} />
            {booking?.occasion && (
              <View style={styles.occasionBadge}>
                <Text style={styles.occasionText}>{booking.occasion}</Text>
              </View>
            )}
          </View>

          {/* QR Code */}
          <Animated.View entering={ZoomIn.delay(200).duration(450)} style={styles.qrCard}>
            <Text style={styles.qrLabel}>Check-in QR</Text>
            <View style={styles.qrWrap}>
              <QRCode
                value={bookingId}
                size={180}
                color={colors.ink}
                backgroundColor="#fff"
              />
            </View>
            <Text style={styles.qrHint}>Staff will scan this to seat you</Text>
          </Animated.View>

          {/* Pre-order summary */}
          {booking?.pre_order_amount_paise > 0 && (
            <View style={styles.preOrderCard}>
              <Text style={styles.preOrderTitle}>Pre-Order Paid</Text>
              <Text style={styles.preOrderAmount}>₹{(booking.pre_order_amount_paise / 100).toFixed(0)}</Text>
              <Text style={styles.preOrderNote}>Your food will be ready when you arrive.</Text>
            </View>
          )}

          {/* Cancellation policy */}
          {booking?.free_cancellation_until && (
            <View style={styles.cancelNote}>
              <Text style={styles.cancelNoteText}>
                Free cancellation until {new Date(booking.free_cancellation_until).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
              <Share2 size={18} color={colors.primary} />
              <Text style={styles.shareBtnText}>Share</Text>
            </TouchableOpacity>
            <BouncingButton
              style={styles.viewBtn}
              onPress={() => navigation.replace('TableBookingDetail', { bookingId })}
            >
              <Text style={styles.viewBtnText}>View Booking</Text>
              <ChevronRight size={18} color="#fff" strokeWidth={2} />
            </BouncingButton>
          </View>

          <BouncingButton
            style={styles.homeBtn}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.homeBtnText}>Back to Home</Text>
          </BouncingButton>
        </Animated.ScrollView>
      )}
    </View>
  );
};

const DetailRow = ({ icon, label }: { icon: any; label: string }) => (
  <View style={styles.detailRow}>
    {icon}
    <Text style={styles.detailLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: spacing.lg, alignItems: 'center', paddingTop: 24, paddingBottom: 40 },
  successIcon: { marginBottom: 16 },
  title: { fontSize: 24, fontFamily: fontFamily.bold, color: colors.ink, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: colors.inkMuted, fontFamily: fontFamily.regular, textAlign: 'center', lineHeight: 20, marginBottom: 24, paddingHorizontal: 16 },
  detailCard: {
    width: '100%', backgroundColor: '#fff', borderRadius: 20, padding: 20,
    marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  refId: { fontSize: 22, fontFamily: fontFamily.bold, color: colors.ink, textAlign: 'center', letterSpacing: 1, marginBottom: 12 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#E5E7EB', marginBottom: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  detailLabel: { fontSize: 14, fontFamily: fontFamily.medium, color: colors.ink },
  occasionBadge: { alignSelf: 'flex-start', backgroundColor: colors.primary + '15', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginTop: 6 },
  occasionText: { fontSize: 12, fontFamily: fontFamily.medium, color: colors.primary },
  qrCard: {
    width: '100%', backgroundColor: '#fff', borderRadius: 20, padding: 24,
    alignItems: 'center', marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  qrLabel: { fontSize: 14, fontFamily: fontFamily.semibold, color: colors.ink, marginBottom: 16 },
  qrWrap: { padding: 12, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  qrHint: { fontSize: 12, color: colors.inkMuted, fontFamily: fontFamily.regular, marginTop: 12 },
  preOrderCard: {
    width: '100%', backgroundColor: colors.primary + '10', borderRadius: 16,
    padding: 16, alignItems: 'center', marginBottom: 16,
  },
  preOrderTitle: { fontSize: 13, fontFamily: fontFamily.medium, color: colors.primary, marginBottom: 4 },
  preOrderAmount: { fontSize: 22, fontFamily: fontFamily.bold, color: colors.primary, marginBottom: 4 },
  preOrderNote: { fontSize: 12, color: colors.primary, fontFamily: fontFamily.regular, opacity: 0.8 },
  cancelNote: { backgroundColor: '#FEF3C7', borderRadius: 12, padding: 12, marginBottom: 20, width: '100%' },
  cancelNoteText: { fontSize: 12, color: '#92400E', fontFamily: fontFamily.medium, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 12, width: '100%', marginBottom: 12 },
  shareBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: colors.primary,
  },
  shareBtnText: { fontSize: 15, fontFamily: fontFamily.semibold, color: colors.primary },
  viewBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 14, borderRadius: 14, backgroundColor: colors.primary,
  },
  viewBtnText: { fontSize: 15, fontFamily: fontFamily.semibold, color: '#fff' },
  homeBtn: {
    width: '100%', paddingVertical: 14, borderRadius: 14,
    borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center',
  },
  homeBtnText: { fontSize: 15, fontFamily: fontFamily.medium, color: colors.inkMuted },
});

export default TableBookingConfirmedScreen;
