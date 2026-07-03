import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  CalendarCheck, Users, IndianRupee, TrendingUp,
  Clock, CheckCircle, UtensilsCrossed, AlertCircle,
} from 'lucide-react-native';
import { api } from '../../api/client';
import { colors } from '../../theme/colors';
import { fontFamily } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

const pad = (n: number) => String(n).padStart(2, '0');
const formatTime = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const STATUS_COLORS: Record<string, string> = {
  confirmed: '#10B981',
  seated: '#3B82F6',
  completed: '#6B7280',
  cancelled: '#EF4444',
  no_show: '#EF4444',
  pending_payment: '#F59E0B',
};
const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confirmed',
  seated: 'Seated',
  completed: 'Done',
  cancelled: 'Cancelled',
  no_show: 'No Show',
  pending_payment: 'Pending',
};

const PartnerDashboardScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data: todayData, isLoading: statsLoading } = useQuery({
    queryKey: ['partner-today'],
    queryFn: () => api.get('/partner/bookings/today') as Promise<{ bookings: any[]; summary: any }>,
    refetchInterval: 30000,
  });
  const stats = todayData?.summary;
  const todayBookings: any[] = todayData?.bookings || [];

  const { data: restaurant } = useQuery({
    queryKey: ['partner-restaurant'],
    queryFn: () => api.get('/partner/restaurant').then((r: any) => r.restaurant),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['partner'] });
    setRefreshing(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good {getTimeOfDay()}</Text>
          <Text style={styles.restaurantName} numberOfLines={1}>{restaurant?.name || 'Your Restaurant'}</Text>
        </View>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Live</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Stats cards */}
        {statsLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
        ) : (
          <Animated.View entering={FadeInDown.duration(350)} style={styles.statsGrid}>
            <StatCard icon={<CalendarCheck size={20} color={colors.primary} />} label="Confirmed" value={stats?.confirmed ?? 0} color={colors.primary} />
            <StatCard icon={<Users size={20} color="#3B82F6" />} label="Seated" value={stats?.seated ?? 0} color="#3B82F6" />
            <StatCard icon={<CheckCircle size={20} color="#10B981" />} label="Completed" value={stats?.completed ?? 0} color="#10B981" />
            <StatCard
              icon={<IndianRupee size={20} color="#8B5CF6" />}
              label="Revenue"
              value={`₹${(((stats?.totalRevenuePaise) ?? 0) / 100).toFixed(0)}`}
              color="#8B5CF6"
              isStr
            />
          </Animated.View>
        )}

        {/* Today's timeline */}
        <Animated.View entering={FadeInDown.delay(80).duration(350)}>
          <Text style={styles.sectionTitle}>Today's Schedule</Text>
          {todayBookings.length === 0 ? (
            <View style={styles.emptyCard}>
              <UtensilsCrossed size={36} color={colors.inkFaint} strokeWidth={1} />
              <Text style={styles.emptyTitle}>No bookings today</Text>
              <Text style={styles.emptySubtitle}>Bookings made through VELTO will appear here.</Text>
            </View>
          ) : (
            todayBookings.map((b: any, i: number) => (
              <Animated.View key={b.id} entering={FadeInDown.delay(i * 40).duration(280)}>
                <TouchableOpacity
                  style={styles.bookingRow}
                  onPress={() => navigation.navigate('PartnerBookingDetail', { bookingId: b.id })}
                  activeOpacity={0.75}
                >
                  <View style={styles.timeCol}>
                    <Text style={styles.timeText}>{formatTime(b.slot_start)}</Text>
                    <Text style={styles.timeEnd}>{formatTime(b.slot_end)}</Text>
                  </View>
                  <View style={styles.bookingInfo}>
                    <Text style={styles.bookingGuest}>{b.customer_name || 'Guest'}</Text>
                    <View style={styles.bookingMeta}>
                      <View style={styles.metaChip}>
                        <Users size={11} color={colors.inkMuted} />
                        <Text style={styles.metaText}>{b.party_size}</Text>
                      </View>
                      {b.occasion && (
                        <View style={[styles.metaChip, { backgroundColor: '#FEF3C7' }]}>
                          <Text style={[styles.metaText, { color: '#92400E' }]}>{b.occasion}</Text>
                        </View>
                      )}
                      {b.pre_order_amount_paise > 0 && (
                        <View style={[styles.metaChip, { backgroundColor: colors.primary + '12' }]}>
                          <Text style={[styles.metaText, { color: colors.primary }]}>Pre-ordered</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: (STATUS_COLORS[b.status] || '#6B7280') + '18' }]}>
                    <Text style={[styles.statusText, { color: STATUS_COLORS[b.status] || '#6B7280' }]}>
                      {STATUS_LABELS[b.status] || b.status}
                    </Text>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            ))
          )}
        </Animated.View>

        {/* Commission notice */}
        {restaurant?.commission_percent && (
          <Animated.View entering={FadeInDown.delay(200).duration(350)} style={styles.commissionCard}>
            <AlertCircle size={16} color="#6B7280" />
            <Text style={styles.commissionText}>
              VELTO earns {restaurant.commission_percent}% commission on platform bookings. Walk-in revenue is 100% yours.
            </Text>
          </Animated.View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
};

const getTimeOfDay = () => {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
};

const StatCard = ({ icon, label, value, color, isStr }: { icon: any; label: string; value: number | string; color: string; isStr?: boolean }) => (
  <View style={styles.statCard}>
    <View style={[styles.statIcon, { backgroundColor: color + '14' }]}>{icon}</View>
    <Text style={[styles.statValue, { color }]}>{isStr ? value : String(value)}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 14 },
  greeting: { fontSize: 12, color: colors.inkMuted, fontFamily: fontFamily.regular },
  restaurantName: { fontSize: 20, fontFamily: fontFamily.bold, color: colors.ink, maxWidth: 240 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#10B98115', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#10B981' },
  liveText: { fontSize: 12, fontFamily: fontFamily.semibold, color: '#10B981' },
  scrollContent: { padding: spacing.lg, gap: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: '#fff', borderRadius: 16, padding: 14, alignItems: 'flex-start', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  statIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  statValue: { fontSize: 22, fontFamily: fontFamily.bold, marginBottom: 2 },
  statLabel: { fontSize: 12, color: colors.inkMuted, fontFamily: fontFamily.regular },
  sectionTitle: { fontSize: 16, fontFamily: fontFamily.semibold, color: colors.ink, marginBottom: 10 },
  bookingRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  timeCol: { width: 48, alignItems: 'center', marginRight: 12 },
  timeText: { fontSize: 14, fontFamily: fontFamily.bold, color: colors.ink },
  timeEnd: { fontSize: 11, color: colors.inkMuted, fontFamily: fontFamily.regular },
  bookingInfo: { flex: 1 },
  bookingGuest: { fontSize: 14, fontFamily: fontFamily.semibold, color: colors.ink, marginBottom: 4 },
  bookingMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F3F4F6', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  metaText: { fontSize: 11, color: colors.inkMuted, fontFamily: fontFamily.medium },
  statusPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 11, fontFamily: fontFamily.semibold },
  emptyCard: { backgroundColor: '#fff', borderRadius: 16, padding: 32, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: fontFamily.semibold, color: colors.ink },
  emptySubtitle: { fontSize: 13, color: colors.inkMuted, fontFamily: fontFamily.regular, textAlign: 'center' },
  commissionCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12 },
  commissionText: { flex: 1, fontSize: 12, color: colors.inkMuted, fontFamily: fontFamily.regular, lineHeight: 18 },
});

export default PartnerDashboardScreen;
