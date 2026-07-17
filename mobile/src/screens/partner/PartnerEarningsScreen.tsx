import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  IndianRupee, TrendingUp, Percent, Banknote, Clock, CheckCircle,
  AlertCircle, ChevronDown, ChevronUp,
} from 'lucide-react-native';
import { api } from '../../api/client';
import { colors } from '../../theme/colors';
import { fontFamily } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

const pad = (n: number) => String(n).padStart(2, '0');
const formatDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`;
};

const PAYOUT_STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  processing: '#3B82F6',
  paid: '#10B981',
  failed: '#EF4444',
};

const PartnerEarningsScreen = () => {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const { data: earnings, isLoading } = useQuery({
    queryKey: ['partner-earnings'],
    queryFn: () => api.get('/partner/earnings') as Promise<any>,
    refetchInterval: 30000,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['partner-earnings'] });
    setRefreshing(false);
  };

  const payouts: any[] = earnings?.payoutHistory || [];

  // Compute current billing week (Mon–Sun) for period display
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const diffToMon = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + diffToMon);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Earnings</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Current period summary */}
          {earnings && (
            <Animated.View entering={FadeInDown.duration(350)} style={styles.summaryCard}>
              <Text style={styles.summaryPeriod}>
                {formatDate(weekStart.toISOString())} – {formatDate(weekEnd.toISOString())}
              </Text>
              <Text style={styles.summaryLabel}>Current Period · {earnings.completedBookings ?? 0} booking{earnings.completedBookings !== 1 ? 's' : ''}</Text>

              <View style={styles.bigAmountRow}>
                <IndianRupee size={28} color={colors.primary} strokeWidth={2.5} />
                <Text style={styles.bigAmount}>{((earnings.netPendingPaise || 0) / 100).toFixed(0)}</Text>
              </View>
              <Text style={styles.bigAmountLabel}>Net Payout (estimated)</Text>

              {/* Breakdown toggle */}
              <TouchableOpacity style={styles.breakdownToggle} onPress={() => setShowBreakdown(v => !v)}>
                <Text style={styles.breakdownToggleText}>See breakdown</Text>
                {showBreakdown ? <ChevronUp size={16} color={colors.primary} /> : <ChevronDown size={16} color={colors.primary} />}
              </TouchableOpacity>

              {showBreakdown && (
                <View style={styles.breakdown}>
                  <BreakdownRow icon={<TrendingUp size={15} color="#10B981" />} label="Gross Revenue" value={`₹${((earnings.grossRevenuePaise || 0) / 100).toFixed(0)}`} color="#10B981" />
                  <BreakdownRow icon={<Percent size={15} color="#EF4444" />} label={`Commission (${earnings.commissionPercent ?? 0}%)`} value={`-₹${((earnings.commissionPaise || 0) / 100).toFixed(0)}`} color="#EF4444" />
                  <BreakdownRow icon={<Banknote size={15} color="#F59E0B" />} label="Cash collected" value={`-₹${((earnings.cashCollectedPaise || 0) / 100).toFixed(0)}`} color="#F59E0B" />
                  <View style={styles.breakdownDivider} />
                  <BreakdownRow icon={<IndianRupee size={15} color={colors.primary} />} label="Net payout" value={`₹${((earnings.netPendingPaise || 0) / 100).toFixed(0)}`} color={colors.primary} bold />
                </View>
              )}

              <View style={styles.infoNote}>
                <AlertCircle size={13} color="#6B7280" />
                <Text style={styles.infoNoteText}>
                  Payouts are processed every Monday. Cash you collect at the restaurant is deducted since you already have it.
                </Text>
              </View>
            </Animated.View>
          )}

          {/* Payout history */}
          <Animated.View entering={FadeInDown.delay(100).duration(350)}>
            <Text style={styles.sectionTitle}>Payout History</Text>
            {payouts.length === 0 ? (
              <View style={styles.emptyPayouts}>
                <Clock size={32} color={colors.inkFaint} strokeWidth={1} />
                <Text style={styles.emptyPayoutsText}>No payouts yet</Text>
                <Text style={styles.emptyPayoutsSub}>Your first payout will appear after the first Monday following your bookings.</Text>
              </View>
            ) : (
              payouts.map((p: any, i: number) => (
                <Animated.View key={p.id} entering={FadeInDown.delay(i * 40).duration(260)}>
                  <View style={styles.payoutRow}>
                    <View style={[styles.payoutStatus, { backgroundColor: (PAYOUT_STATUS_COLORS[p.status] || '#6B7280') + '18' }]}>
                      {p.status === 'paid'
                        ? <CheckCircle size={16} color="#10B981" />
                        : p.status === 'failed'
                        ? <AlertCircle size={16} color="#EF4444" />
                        : <Clock size={16} color="#F59E0B" />
                      }
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.payoutPeriod}>{formatDate(p.period_start)} – {formatDate(p.period_end)}</Text>
                      <View style={styles.payoutMeta}>
                        <View style={[styles.payoutBadge, { backgroundColor: (PAYOUT_STATUS_COLORS[p.status] || '#6B7280') + '15' }]}>
                          <Text style={[styles.payoutBadgeText, { color: PAYOUT_STATUS_COLORS[p.status] || '#6B7280' }]}>
                            {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                          </Text>
                        </View>
                        {p.utr_number && <Text style={styles.payoutUtr}>UTR: {p.utr_number}</Text>}
                      </View>
                      {p.notes && <Text style={styles.payoutNote}>{p.notes}</Text>}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.payoutAmount}>₹{(p.net_payout_paise / 100).toFixed(0)}</Text>
                      <Text style={styles.payoutGross}>Gross ₹{(p.gross_revenue_paise / 100).toFixed(0)}</Text>
                    </View>
                  </View>
                </Animated.View>
              ))
            )}
          </Animated.View>

          {/* Commission explanation */}
          <Animated.View entering={FadeInDown.delay(200).duration(350)} style={styles.commissionCard}>
            <Text style={styles.commissionTitle}>How Payouts Work</Text>
            <Text style={styles.commissionText}>
              Every Monday, VELTO calculates your previous week's earnings from platform bookings, subtracts the commission and any cash you collected at the restaurant, and transfers the balance to your bank via UPI.
            </Text>
            <Text style={[styles.commissionText, { marginTop: 8 }]}>
              Walk-in revenue is always 100% yours — VELTO only earns commission on bookings that came through the platform.
            </Text>
          </Animated.View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
};

const BreakdownRow = ({ icon, label, value, color, bold }: { icon: any; label: string; value: string; color: string; bold?: boolean }) => (
  <View style={styles.breakdownRow}>
    {icon}
    <Text style={[styles.breakdownLabel, bold && styles.breakdownLabelBold]}>{label}</Text>
    <Text style={[styles.breakdownValue, { color }, bold && styles.breakdownValueBold]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingVertical: 14 },
  headerTitle: { fontSize: 22, fontFamily: fontFamily.bold, color: colors.ink },
  scrollContent: { padding: spacing.lg, gap: 16 },
  summaryCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  summaryPeriod: { fontSize: 12, color: colors.inkMuted, fontFamily: fontFamily.regular, marginBottom: 2 },
  summaryLabel: { fontSize: 13, fontFamily: fontFamily.medium, color: colors.ink, marginBottom: 12 },
  bigAmountRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginBottom: 4 },
  bigAmount: { fontSize: 42, fontFamily: fontFamily.bold, color: colors.primary, lineHeight: 48 },
  bigAmountLabel: { fontSize: 13, color: colors.inkMuted, fontFamily: fontFamily.regular, marginBottom: 16 },
  breakdownToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  breakdownToggleText: { fontSize: 13, fontFamily: fontFamily.medium, color: colors.primary },
  breakdown: { backgroundColor: '#F9FAFB', borderRadius: 14, padding: 14, marginTop: 8, marginBottom: 12, gap: 8 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  breakdownLabel: { flex: 1, fontSize: 13, color: colors.ink, fontFamily: fontFamily.regular },
  breakdownLabelBold: { fontFamily: fontFamily.semibold },
  breakdownValue: { fontSize: 13, fontFamily: fontFamily.medium },
  breakdownValueBold: { fontFamily: fontFamily.bold, fontSize: 15 },
  breakdownDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#E5E7EB', marginVertical: 4 },
  infoNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#F3F4F6', borderRadius: 10, padding: 10 },
  infoNoteText: { flex: 1, fontSize: 12, color: '#6B7280', fontFamily: fontFamily.regular, lineHeight: 18 },
  sectionTitle: { fontSize: 16, fontFamily: fontFamily.semibold, color: colors.ink, marginBottom: 10 },
  payoutRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  payoutStatus: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  payoutPeriod: { fontSize: 13, fontFamily: fontFamily.medium, color: colors.ink, marginBottom: 4 },
  payoutMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  payoutBadge: { borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2 },
  payoutBadgeText: { fontSize: 11, fontFamily: fontFamily.semibold },
  payoutUtr: { fontSize: 11, color: colors.inkMuted, fontFamily: fontFamily.regular },
  payoutNote: { fontSize: 11, color: '#F59E0B', fontFamily: fontFamily.regular, marginTop: 2 },
  payoutAmount: { fontSize: 16, fontFamily: fontFamily.bold, color: colors.ink },
  payoutGross: { fontSize: 11, color: colors.inkMuted, fontFamily: fontFamily.regular },
  emptyPayouts: { alignItems: 'center', padding: 32, gap: 8, backgroundColor: '#fff', borderRadius: 16 },
  emptyPayoutsText: { fontSize: 16, fontFamily: fontFamily.semibold, color: colors.ink },
  emptyPayoutsSub: { fontSize: 13, color: colors.inkMuted, textAlign: 'center', fontFamily: fontFamily.regular, lineHeight: 20 },
  commissionCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 4 },
  commissionTitle: { fontSize: 14, fontFamily: fontFamily.semibold, color: colors.ink, marginBottom: 4 },
  commissionText: { fontSize: 13, color: colors.inkMuted, fontFamily: fontFamily.regular, lineHeight: 20 },
});

export default PartnerEarningsScreen;
