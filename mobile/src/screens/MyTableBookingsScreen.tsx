import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronLeft, Calendar, Clock, Users, ChevronRight, UtensilsCrossed } from 'lucide-react-native';
import { api } from '../api/client';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { BouncingButton } from '../components/ui/BouncingButton';

const TABS = ['upcoming', 'past', 'cancelled'] as const;
type Tab = typeof TABS[number];

const TAB_LABELS: Record<Tab, string> = { upcoming: 'Upcoming', past: 'Past', cancelled: 'Cancelled' };

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
  confirmed: 'Confirmed',
  seated: 'Seated',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No Show',
};

const MyTableBookingsScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('upcoming');
  const [refreshing, setRefreshing] = useState(false);

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['my-table-bookings', activeTab],
    queryFn: () =>
      api.get(`/table-bookings/mine?status=${activeTab}`).then((r: any) => r.bookings as any[]),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['my-table-bookings', activeTab] });
    setRefreshing(false);
  };

  const renderItem = ({ item, index }: { item: any; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
      <BouncingButton
        style={styles.bookingCard}
        onPress={() => navigation.navigate('TableBookingDetail', { bookingId: item.id })}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.refId}>{item.display_id}</Text>
          <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[item.status] || '#6B7280') + '20' }]}>
            <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] || '#6B7280' }]}>
              {STATUS_LABELS[item.status] || item.status}
            </Text>
          </View>
        </View>

        <Text style={styles.restaurantName}>{item.restaurant_name}</Text>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Calendar size={13} color={colors.inkMuted} />
            <Text style={styles.metaText}>{formatSlot(item.slot_start)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Users size={13} color={colors.inkMuted} />
            <Text style={styles.metaText}>{item.party_size} guests</Text>
          </View>
        </View>

        {item.pre_order_amount_paise > 0 && (
          <View style={styles.preOrderNote}>
            <Text style={styles.preOrderNoteText}>
              Pre-ordered · ₹{(item.pre_order_amount_paise / 100).toFixed(0)}
            </Text>
          </View>
        )}

        <View style={styles.cardFooter}>
          <Text style={styles.viewDetail}>View Details</Text>
          <ChevronRight size={16} color={colors.primary} />
        </View>
      </BouncingButton>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={22} color={colors.ink} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Table Bookings</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {TAB_LABELS[tab]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <UtensilsCrossed size={48} color={colors.inkFaint} strokeWidth={1} />
              <Text style={styles.emptyTitle}>No {TAB_LABELS[activeTab]} Bookings</Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'upcoming'
                  ? 'Reserve a table at one of our restaurants to get started.'
                  : `Your ${TAB_LABELS[activeTab].toLowerCase()} bookings will appear here.`}
              </Text>
              {activeTab === 'upcoming' && (
                <BouncingButton
                  style={styles.browseCta}
                  onPress={() => navigation.navigate('Home')}
                >
                  <Text style={styles.browseCtaText}>Browse Restaurants</Text>
                </BouncingButton>
              )}
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: fontFamily.semibold, color: colors.ink, textAlign: 'center' },
  tabs: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: 0, marginBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: 13, fontFamily: fontFamily.medium, color: colors.inkMuted },
  tabTextActive: { color: colors.primary, fontFamily: fontFamily.semibold },
  listContent: { padding: spacing.lg, gap: 12, paddingBottom: 40 },
  bookingCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  refId: { fontSize: 15, fontFamily: fontFamily.bold, color: colors.ink },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontFamily: fontFamily.semibold },
  restaurantName: { fontSize: 14, fontFamily: fontFamily.medium, color: colors.ink, marginBottom: 10 },
  metaRow: { gap: 8, marginBottom: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 13, color: colors.inkMuted, fontFamily: fontFamily.regular },
  preOrderNote: { backgroundColor: colors.primary + '10', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 8 },
  preOrderNoteText: { fontSize: 12, fontFamily: fontFamily.medium, color: colors.primary },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F3F4F6', paddingTop: 10, marginTop: 4 },
  viewDetail: { fontSize: 13, fontFamily: fontFamily.medium, color: colors.primary },
  emptyWrap: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontFamily: fontFamily.semibold, color: colors.ink, marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 13, color: colors.inkMuted, fontFamily: fontFamily.regular, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  browseCta: { backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  browseCtaText: { color: '#fff', fontSize: 14, fontFamily: fontFamily.semibold },
});

export default MyTableBookingsScreen;
