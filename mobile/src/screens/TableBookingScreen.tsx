import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import {
  ChevronLeft, ChevronRight, Calendar, Clock, Users,
  ShoppingBag, CheckCircle, Minus, Plus, MessageSquare,
} from 'lucide-react-native';
import { api } from '../api/client';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import { spacing, radius } from '../theme/spacing';
import { BouncingButton } from '../components/ui/BouncingButton';

let RazorpayCheckout: any = null;
try { RazorpayCheckout = require('react-native-razorpay').default; } catch (_) {}

const STEPS = ['Date & Guests', 'Time Slot', 'Pre-Order', 'Requests', 'Confirm'];

const pad = (n: number) => String(n).padStart(2, '0');

const formatDateLabel = (d: Date) =>
  `${d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}`;

const formatTime = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const TableBookingScreen = ({ navigation, route }: any) => {
  const { restaurantId, restaurantName } = route.params;
  const insets = useSafeAreaInsets();

  // Step state
  const [step, setStep] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [partySize, setPartySize] = useState(2);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [preOrderItems, setPreOrderItems] = useState<Record<string, number>>({}); // itemId → qty
  const [specialRequests, setSpecialRequests] = useState('');
  const [occasion, setOccasion] = useState('');

  // Build 7 date options from today
  const dateOptions = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  const dateStr = `${selectedDate.getFullYear()}-${pad(selectedDate.getMonth() + 1)}-${pad(selectedDate.getDate())}`;

  // Fetch availability
  const { data: slots, isLoading: slotsLoading, refetch: refetchSlots } = useQuery({
    queryKey: ['slots', restaurantId, dateStr, partySize],
    queryFn: () =>
      api.get(`/restaurants/${restaurantId}/availability?date=${dateStr}&partySize=${partySize}`)
        .then((r: any) => r.slots as any[]),
    enabled: step === 1,
  });

  // Fetch menu for pre-order
  const { data: menuData, isLoading: menuLoading } = useQuery({
    queryKey: ['restaurant-menu', restaurantId],
    queryFn: () => api.get(`/restaurants/${restaurantId}/menu`).then((r: any) => r.items as any[]),
    enabled: step === 2,
  });

  const allMenuItems: any[] = menuData || [];

  const preOrderTotal = allMenuItems.reduce((sum, item) => {
    const qty = preOrderItems[item.id] || 0;
    return sum + qty * item.price_paise;
  }, 0);

  // Create booking mutation
  const createBooking = useMutation({
    mutationFn: (payload: any) => api.post('/table-bookings', payload),
    onSuccess: (data) => {
      if (data.razorpayOrderId) {
        openRazorpay(data.razorpayOrderId, data.bookingId, data.amountPaise);
      } else {
        navigation.replace('TableBookingConfirmed', { bookingId: data.bookingId });
      }
    },
    onError: (err: any) => {
      Alert.alert('Booking Failed', err?.response?.data?.error || 'Please try again.');
    },
  });

  const openRazorpay = useCallback((rzpOrderId: string, bookingId: string, amountPaise: number) => {
    if (!RazorpayCheckout) {
      Alert.alert('Error', 'Payment module not available.');
      return;
    }
    const options = {
      description: `Table Booking – ${restaurantName}`,
      currency: 'INR',
      key: 'rzp_test_placeholder',
      amount: amountPaise,
      order_id: rzpOrderId,
      name: 'VELTO Food Palace',
      theme: { color: colors.primary },
    };
    RazorpayCheckout.open(options)
      .then(() => {
        // webhook confirms; also call verify endpoint as fallback
        api.post('/table-bookings/verify-payment', { bookingId, razorpayOrderId: rzpOrderId })
          .catch(() => {});
        navigation.replace('TableBookingConfirmed', { bookingId });
      })
      .catch(() => {
        Alert.alert('Payment Cancelled', 'Your booking is saved. Complete payment from My Bookings.');
        navigation.replace('TableBookingConfirmed', { bookingId });
      });
  }, [restaurantName, navigation]);

  const handleConfirm = () => {
    if (!selectedSlot) return;
    const items = Object.entries(preOrderItems)
      .filter(([, qty]) => qty > 0)
      .map(([menuItemId, quantity]) => ({ menuItemId, quantity }));

    createBooking.mutate({
      restaurantId,
      slotStart: selectedSlot.slotStart,
      slotEnd: selectedSlot.slotEnd,
      partySize,
      preOrderItems: items,
      specialRequests: specialRequests.trim() || undefined,
      occasion: occasion.trim() || undefined,
      paymentMethod: preOrderTotal > 0 ? 'razorpay' : 'wallet',
    });
  };

  const canProceed = () => {
    if (step === 0) return partySize >= 1 && partySize <= 20;
    if (step === 1) return !!selectedSlot;
    return true;
  };

  const nextStep = () => {
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else handleConfirm();
  };

  const occasions = ['Birthday', 'Anniversary', 'Date Night', 'Business', 'Family Gathering', 'Other'];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => step > 0 ? setStep(s => s - 1) : navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={22} color={colors.ink} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{restaurantName || 'Book a Table'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Progress bar */}
      <View style={styles.progressWrap}>
        {STEPS.map((label, i) => (
          <React.Fragment key={label}>
            <View style={[styles.progressDot, i <= step && styles.progressDotActive]}>
              {i < step ? <CheckCircle size={14} color="#fff" /> : <Text style={styles.progressDotNum}>{i + 1}</Text>}
            </View>
            {i < STEPS.length - 1 && <View style={[styles.progressLine, i < step && styles.progressLineActive]} />}
          </React.Fragment>
        ))}
      </View>
      <Text style={styles.stepLabel}>{STEPS[step]}</Text>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── Step 0: Date & Guests ── */}
        {step === 0 && (
          <Animated.View entering={FadeInRight.duration(280)}>
            <Text style={styles.sectionTitle}>Select Date</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateScroll}>
              {dateOptions.map((d, i) => {
                const dStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                const selStr = `${selectedDate.getFullYear()}-${pad(selectedDate.getMonth() + 1)}-${pad(selectedDate.getDate())}`;
                const isSelected = dStr === selStr;
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.dateCard, isSelected && styles.dateCardActive]}
                    onPress={() => { setSelectedDate(d); setSelectedSlot(null); }}
                  >
                    <Text style={[styles.dateDay, isSelected && styles.dateTextActive]}>
                      {d.toLocaleDateString('en-IN', { weekday: 'short' })}
                    </Text>
                    <Text style={[styles.dateNum, isSelected && styles.dateTextActive]}>
                      {d.getDate()}
                    </Text>
                    <Text style={[styles.dateMonth, isSelected && styles.dateTextActive]}>
                      {d.toLocaleDateString('en-IN', { month: 'short' })}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.sectionTitle}>Number of Guests</Text>
            <View style={styles.counterRow}>
              <TouchableOpacity
                style={styles.counterBtn}
                onPress={() => setPartySize(p => Math.max(1, p - 1))}
              >
                <Minus size={20} color={partySize <= 1 ? colors.inkFaint : colors.ink} />
              </TouchableOpacity>
              <View style={styles.counterDisplay}>
                <Users size={18} color={colors.primary} />
                <Text style={styles.counterNum}>{partySize}</Text>
                <Text style={styles.counterLabel}>{partySize === 1 ? 'Guest' : 'Guests'}</Text>
              </View>
              <TouchableOpacity
                style={styles.counterBtn}
                onPress={() => setPartySize(p => Math.min(20, p + 1))}
              >
                <Plus size={20} color={partySize >= 20 ? colors.inkFaint : colors.ink} />
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* ── Step 1: Time Slot ── */}
        {step === 1 && (
          <Animated.View entering={FadeInRight.duration(280)}>
            <Text style={styles.sectionTitle}>
              Available Slots for {formatDateLabel(selectedDate)} · {partySize} guests
            </Text>
            {slotsLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
            ) : !slots?.length ? (
              <Text style={styles.emptyText}>No slots available for this date. Try another date.</Text>
            ) : (
              <View style={styles.slotGrid}>
                {slots.map((slot: any, i: number) => (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.slotPill,
                      selectedSlot?.slotStart === slot.slotStart && styles.slotPillActive,
                      !slot.available && styles.slotPillDisabled,
                    ]}
                    disabled={!slot.available}
                    onPress={() => setSelectedSlot(slot)}
                  >
                    <Clock size={13} color={
                      !slot.available ? colors.inkFaint :
                      selectedSlot?.slotStart === slot.slotStart ? '#fff' : colors.ink
                    } />
                    <Text style={[
                      styles.slotTime,
                      selectedSlot?.slotStart === slot.slotStart && styles.slotTimeActive,
                      !slot.available && styles.slotTimeDisabled,
                    ]}>
                      {formatTime(slot.slotStart)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {selectedSlot && (
              <View style={styles.slotSelectedBanner}>
                <CheckCircle size={16} color={colors.primary} />
                <Text style={styles.slotSelectedText}>
                  {formatTime(selectedSlot.slotStart)} – {formatTime(selectedSlot.slotEnd)} selected
                </Text>
              </View>
            )}
          </Animated.View>
        )}

        {/* ── Step 2: Pre-Order ── */}
        {step === 2 && (
          <Animated.View entering={FadeInRight.duration(280)}>
            <Text style={styles.sectionTitle}>Pre-Order Food (Optional)</Text>
            <Text style={styles.sectionSub}>Items will be ready when you arrive.</Text>
            {menuLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
            ) : allMenuItems.length === 0 ? (
              <Text style={styles.emptyText}>No menu items available for pre-order.</Text>
            ) : (
              allMenuItems.map((item: any) => {
                const qty = preOrderItems[item.id] || 0;
                return (
                  <View key={item.id} style={styles.preOrderRow}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.vegIndicator}>
                        <View style={[styles.vegDot, { backgroundColor: item.is_veg ? '#10B981' : '#EF4444' }]} />
                        <Text style={styles.preOrderName}>{item.name}</Text>
                      </View>
                      <Text style={styles.preOrderPrice}>₹{(item.price_paise / 100).toFixed(0)}</Text>
                    </View>
                    <View style={styles.qtyControls}>
                      {qty > 0 ? (
                        <>
                          <TouchableOpacity
                            style={styles.qtyBtn}
                            onPress={() => setPreOrderItems(prev => ({ ...prev, [item.id]: Math.max(0, qty - 1) }))}
                          >
                            <Minus size={14} color={colors.primary} />
                          </TouchableOpacity>
                          <Text style={styles.qtyNum}>{qty}</Text>
                          <TouchableOpacity
                            style={styles.qtyBtn}
                            onPress={() => setPreOrderItems(prev => ({ ...prev, [item.id]: qty + 1 }))}
                          >
                            <Plus size={14} color={colors.primary} />
                          </TouchableOpacity>
                        </>
                      ) : (
                        <TouchableOpacity
                          style={styles.addBtn}
                          onPress={() => setPreOrderItems(prev => ({ ...prev, [item.id]: 1 }))}
                        >
                          <Text style={styles.addBtnText}>Add</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })
            )}
            {preOrderTotal > 0 && (
              <View style={styles.preOrderTotalRow}>
                <ShoppingBag size={16} color={colors.primary} />
                <Text style={styles.preOrderTotal}>Pre-order total: ₹{(preOrderTotal / 100).toFixed(0)}</Text>
              </View>
            )}
          </Animated.View>
        )}

        {/* ── Step 3: Special Requests ── */}
        {step === 3 && (
          <Animated.View entering={FadeInRight.duration(280)}>
            <Text style={styles.sectionTitle}>Special Requests</Text>
            <Text style={styles.sectionSub}>Let the restaurant know about dietary needs, seating preferences, or arrangements.</Text>

            <Text style={styles.fieldLabel}>Occasion (optional)</Text>
            <View style={styles.occasionGrid}>
              {occasions.map(occ => (
                <TouchableOpacity
                  key={occ}
                  style={[styles.occasionPill, occasion === occ && styles.occasionPillActive]}
                  onPress={() => setOccasion(prev => prev === occ ? '' : occ)}
                >
                  <Text style={[styles.occasionText, occasion === occ && styles.occasionTextActive]}>{occ}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Special Requests</Text>
            <TextInput
              style={styles.textarea}
              placeholder="e.g. Window seat, nut allergy, high chair needed..."
              placeholderTextColor={colors.inkFaint}
              value={specialRequests}
              onChangeText={setSpecialRequests}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </Animated.View>
        )}

        {/* ── Step 4: Confirm ── */}
        {step === 4 && (
          <Animated.View entering={FadeInRight.duration(280)}>
            <Text style={styles.sectionTitle}>Booking Summary</Text>

            <View style={styles.summaryCard}>
              <SummaryRow icon={<Calendar size={16} color={colors.primary} />} label="Date" value={formatDateLabel(selectedDate)} />
              <SummaryRow icon={<Clock size={16} color={colors.primary} />} label="Time"
                value={selectedSlot ? `${formatTime(selectedSlot.slotStart)} – ${formatTime(selectedSlot.slotEnd)}` : '-'} />
              <SummaryRow icon={<Users size={16} color={colors.primary} />} label="Guests" value={`${partySize} ${partySize === 1 ? 'person' : 'people'}`} />
              {occasion ? <SummaryRow icon={<MessageSquare size={16} color={colors.primary} />} label="Occasion" value={occasion} /> : null}
              {specialRequests ? <SummaryRow icon={<MessageSquare size={16} color={colors.primary} />} label="Requests" value={specialRequests} /> : null}
            </View>

            {preOrderTotal > 0 && (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryCardTitle}>Pre-Order</Text>
                {allMenuItems
                  .filter(item => (preOrderItems[item.id] || 0) > 0)
                  .map(item => (
                    <View key={item.id} style={styles.summaryItem}>
                      <Text style={styles.summaryItemName}>{item.name} × {preOrderItems[item.id]}</Text>
                      <Text style={styles.summaryItemPrice}>₹{((item.price_paise * (preOrderItems[item.id] || 0)) / 100).toFixed(0)}</Text>
                    </View>
                  ))}
                <View style={[styles.summaryItem, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E7EB', marginTop: 6, paddingTop: 8 }]}>
                  <Text style={[styles.summaryItemName, { fontFamily: fontFamily.semibold }]}>Total</Text>
                  <Text style={[styles.summaryItemPrice, { fontFamily: fontFamily.bold }]}>₹{(preOrderTotal / 100).toFixed(0)}</Text>
                </View>
              </View>
            )}

            <Text style={styles.paymentNote}>
              {preOrderTotal > 0
                ? 'Payment for pre-order will be collected now. Remaining bill paid at restaurant.'
                : 'No advance payment required. Bill settled at the restaurant.'}
            </Text>
          </Animated.View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom CTA */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <BouncingButton
          style={[styles.ctaBtn, !canProceed() && styles.ctaBtnDisabled]}
          onPress={nextStep}
          disabled={!canProceed() || createBooking.isPending}
        >
          {createBooking.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.ctaBtnText}>
                {step === STEPS.length - 1
                  ? preOrderTotal > 0 ? `Pay ₹${(preOrderTotal / 100).toFixed(0)} & Confirm` : 'Confirm Booking'
                  : 'Continue'}
              </Text>
              <ChevronRight size={18} color="#fff" strokeWidth={2} />
            </>
          )}
        </BouncingButton>
      </View>
    </View>
  );
};

const SummaryRow = ({ icon, label, value }: { icon: any; label: string; value: string }) => (
  <View style={styles.summaryRow}>
    {icon}
    <Text style={styles.summaryLabel}>{label}</Text>
    <Text style={styles.summaryValue} numberOfLines={2}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: fontFamily.semibold, color: colors.ink, textAlign: 'center' },
  progressWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, marginBottom: 4 },
  progressDot: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: '#E5E7EB',
    justifyContent: 'center', alignItems: 'center',
  },
  progressDotActive: { backgroundColor: colors.primary },
  progressDotNum: { fontSize: 11, fontFamily: fontFamily.semibold, color: '#9CA3AF' },
  progressLine: { flex: 1, height: 2, backgroundColor: '#E5E7EB' },
  progressLineActive: { backgroundColor: colors.primary },
  stepLabel: { fontSize: 12, color: colors.inkMuted, fontFamily: fontFamily.medium, textAlign: 'center', marginBottom: 8 },
  scroll: { flex: 1, paddingHorizontal: spacing.lg },
  sectionTitle: { fontSize: 16, fontFamily: fontFamily.semibold, color: colors.ink, marginTop: 16, marginBottom: 6 },
  sectionSub: { fontSize: 13, color: colors.inkMuted, fontFamily: fontFamily.regular, marginBottom: 14, lineHeight: 18 },
  // Date picker
  dateScroll: { paddingBottom: 8, gap: 8 },
  dateCard: {
    width: 60, paddingVertical: 12, borderRadius: 14, alignItems: 'center',
    backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: 'transparent',
  },
  dateCardActive: { backgroundColor: colors.primary + '15', borderColor: colors.primary },
  dateDay: { fontSize: 11, fontFamily: fontFamily.medium, color: colors.inkMuted },
  dateNum: { fontSize: 20, fontFamily: fontFamily.bold, color: colors.ink, marginVertical: 2 },
  dateMonth: { fontSize: 11, fontFamily: fontFamily.medium, color: colors.inkMuted },
  dateTextActive: { color: colors.primary },
  // Counter
  counterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginTop: 8, marginBottom: 24 },
  counterBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  counterDisplay: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 100, justifyContent: 'center' },
  counterNum: { fontSize: 28, fontFamily: fontFamily.bold, color: colors.ink },
  counterLabel: { fontSize: 14, color: colors.inkMuted, fontFamily: fontFamily.regular },
  // Slots
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  slotPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: 'transparent',
  },
  slotPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  slotPillDisabled: { opacity: 0.4 },
  slotTime: { fontSize: 14, fontFamily: fontFamily.medium, color: colors.ink },
  slotTimeActive: { color: '#fff' },
  slotTimeDisabled: { color: colors.inkFaint },
  slotSelectedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.primary + '12', borderRadius: 10,
    padding: 12, marginTop: 16,
  },
  slotSelectedText: { fontSize: 14, fontFamily: fontFamily.medium, color: colors.primary },
  emptyText: { fontSize: 14, color: colors.inkMuted, textAlign: 'center', marginTop: 40, fontFamily: fontFamily.regular },
  // Pre-order
  preOrderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB',
  },
  vegIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  vegDot: { width: 8, height: 8, borderRadius: 4 },
  preOrderName: { fontSize: 14, fontFamily: fontFamily.medium, color: colors.ink, flex: 1 },
  preOrderPrice: { fontSize: 13, color: colors.inkMuted, fontFamily: fontFamily.regular },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primary + '15', justifyContent: 'center', alignItems: 'center' },
  qtyNum: { fontSize: 15, fontFamily: fontFamily.semibold, color: colors.ink, minWidth: 20, textAlign: 'center' },
  addBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8, borderWidth: 1.5, borderColor: colors.primary },
  addBtnText: { fontSize: 13, fontFamily: fontFamily.semibold, color: colors.primary },
  preOrderTotalRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, padding: 12, backgroundColor: colors.primary + '10', borderRadius: 10 },
  preOrderTotal: { fontSize: 14, fontFamily: fontFamily.semibold, color: colors.primary },
  // Requests
  fieldLabel: { fontSize: 13, fontFamily: fontFamily.medium, color: colors.ink, marginBottom: 8, marginTop: 16 },
  occasionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  occasionPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: 'transparent' },
  occasionPillActive: { backgroundColor: colors.primary + '15', borderColor: colors.primary },
  occasionText: { fontSize: 13, fontFamily: fontFamily.medium, color: colors.inkMuted },
  occasionTextActive: { color: colors.primary },
  textarea: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
    padding: 14, fontSize: 14, fontFamily: fontFamily.regular, color: colors.ink,
    backgroundColor: '#FAFAFA', minHeight: 100,
  },
  // Summary
  summaryCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  summaryCardTitle: { fontSize: 14, fontFamily: fontFamily.semibold, color: colors.ink, marginBottom: 10 },
  summaryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F3F4F6' },
  summaryLabel: { fontSize: 13, fontFamily: fontFamily.medium, color: colors.inkMuted, width: 70 },
  summaryValue: { flex: 1, fontSize: 13, fontFamily: fontFamily.medium, color: colors.ink },
  summaryItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  summaryItemName: { fontSize: 13, fontFamily: fontFamily.regular, color: colors.ink },
  summaryItemPrice: { fontSize: 13, fontFamily: fontFamily.medium, color: colors.ink },
  paymentNote: { fontSize: 12, color: colors.inkMuted, fontFamily: fontFamily.regular, textAlign: 'center', lineHeight: 18, paddingHorizontal: 16 },
  // Bottom
  bottomBar: {
    paddingHorizontal: spacing.lg, paddingTop: 12,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E7EB',
  },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 16 },
  ctaBtnDisabled: { opacity: 0.5 },
  ctaBtnText: { color: '#fff', fontSize: 16, fontFamily: fontFamily.semibold },
});

export default TableBookingScreen;
