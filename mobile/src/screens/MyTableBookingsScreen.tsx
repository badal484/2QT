import { tokens } from '../theme/tokens';
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSocket } from '../socket/client';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Calendar, Users, ChevronRight, UtensilsCrossed } from 'lucide-react-native';
import { api } from '../api/client';
import { PressableScale } from '../components/ui/internal/PressableScale';
import { ScreenHeader } from '../components/ui/ScreenHeader';

const TABS = ['upcoming', 'past', 'cancelled'] as const;
type Tab = typeof TABS[number];

const TAB_LABELS: Record<Tab, string> = { upcoming: 'Upcoming', past: 'Past', cancelled: 'Cancelled' };

const pad = (n: number) => String(n).padStart(2, '0');

const formatSlot = (iso: string) => {
  const d = new Date(iso);
  const timeStr = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} · ${timeStr}`;
};

const STATUS_COLORS: Record<string, string> = {
  pending_payment: '#F59E0B',
  confirmed: tokens.colors.success,
  seated: '#3B82F6',
  completed: '#6B7280',
  cancelled: tokens.colors.danger,
  no_show: tokens.colors.danger,
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
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('upcoming');
  const [refreshing, setRefreshing] = useState(false);

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['my-table-bookings', activeTab],
    queryFn: () =>
      api.get(`/table-bookings/mine?status=${activeTab}`).then((r: any) => r.bookings as any[]),
  });

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['my-table-bookings'] });
    socket.on('table_booking_updated', refresh);
    socket.on('new_table_booking', refresh);
    return () => {
      socket.off('table_booking_updated', refresh);
      socket.off('new_table_booking', refresh);
    };
  }, [queryClient]);

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['my-table-bookings', activeTab] });
    setRefreshing(false);
  };

  const renderItem = ({ item, index }: { item: any; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
      <PressableScale
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
            <Calendar size={13} color={tokens.colors.textSecondary} />
            <Text style={styles.metaText}>{formatSlot(item.slot_start)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Users size={13} color={tokens.colors.textSecondary} />
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
          <ChevronRight size={16} color={tokens.colors.primary} />
        </View>
      </PressableScale>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <ScreenHeader title="My Table Bookings" />

      {/* Tabs */}
      <View style={styles.tabs}>
        {TABS.map(tab => (
          <PressableScale
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {TAB_LABELS[tab]}
            </Text>
          </PressableScale>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator color={tokens.colors.primary} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.colors.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <UtensilsCrossed size={48} color={tokens.colors.textTertiary} strokeWidth={1} />
              <Text style={styles.emptyTitle}>No {TAB_LABELS[activeTab]} Bookings</Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'upcoming'
                  ? 'Reserve a table at one of our restaurants to get started.'
                  : `Your ${TAB_LABELS[activeTab].toLowerCase()} bookings will appear here.`}
              </Text>
              {activeTab === 'upcoming' && (
                <PressableScale
                  style={styles.browseCta}
                  onPress={() => navigation.navigate('Home')}
                >
                  <Text style={styles.browseCtaText}>Browse Restaurants</Text>
                </PressableScale>
              )}
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.background },
  tabs: { flexDirection: 'row', paddingHorizontal: tokens.spacing.lg, gap: 0, marginBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tokens.colors.border },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: tokens.colors.primary },
  tabText: { fontSize: 13, fontFamily: tokens.typography.family.medium, color: tokens.colors.textSecondary },
  tabTextActive: { color: tokens.colors.primary, fontFamily: tokens.typography.family.semibold },
  listContent: { padding: tokens.spacing.lg, gap: 12, paddingBottom: 40 },
  bookingCard: {
    backgroundColor: tokens.colors.surface, borderRadius: 16, padding: 16,
    ...tokens.shadows.soft,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  refId: { fontSize: 15, fontFamily: tokens.typography.family.bold, color: tokens.colors.textPrimary },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontFamily: tokens.typography.family.semibold },
  restaurantName: { fontSize: 14, fontFamily: tokens.typography.family.medium, color: tokens.colors.textPrimary, marginBottom: 10 },
  metaRow: { gap: 8, marginBottom: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 13, color: tokens.colors.textSecondary, fontFamily: tokens.typography.family.regular },
  preOrderNote: { backgroundColor: tokens.colors.primary + '10', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 8 },
  preOrderNoteText: { fontSize: 12, fontFamily: tokens.typography.family.medium, color: tokens.colors.primary },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.colors.background, paddingTop: 10, marginTop: 4 },
  viewDetail: { fontSize: 13, fontFamily: tokens.typography.family.medium, color: tokens.colors.primary },
  emptyWrap: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontFamily: tokens.typography.family.semibold, color: tokens.colors.textPrimary, marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 13, color: tokens.colors.textSecondary, fontFamily: tokens.typography.family.regular, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  browseCta: { backgroundColor: tokens.colors.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  browseCtaText: { color: tokens.colors.textInverse, fontSize: 14, fontFamily: tokens.typography.family.semibold },
});

export default MyTableBookingsScreen;
