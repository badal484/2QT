import React, { useCallback } from 'react';
import { BouncingButton } from '../components/ui/BouncingButton';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Bell, CheckCheck, Package, Bike,
  Sparkles, Wallet, CheckCircle2, XCircle, MessageCircle,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SkeletonListItem } from '../components/ui';
import { api } from '../api/client';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const haptic = () => ReactNativeHapticFeedback.trigger('impactLight', { enableVibrateFallback: true });

// Strip any unicode emoji from strings coming from the backend
const stripEmoji = (str: string) =>
  str?.replace(/[\u{1F300}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}]/gu, '').trim() ?? '';

function relativeTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)      return 'Just now';
  if (diff < 3600)    return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)   return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800)  return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const TYPE_META: Record<string, { Icon: any; iconColor: string; bg: string; accentColor: string }> = {
  alert:   { Icon: XCircle,      iconColor: '#EF4444', bg: '#FEF2F2', accentColor: '#EF4444' },
  cancel:  { Icon: XCircle,      iconColor: '#EF4444', bg: '#FEF2F2', accentColor: '#EF4444' },
  fail:    { Icon: XCircle,      iconColor: '#EF4444', bg: '#FEF2F2', accentColor: '#EF4444' },
  deliver: { Icon: CheckCircle2, iconColor: '#10B981', bg: '#ECFDF5', accentColor: '#10B981' },
  confirm: { Icon: CheckCircle2, iconColor: '#10B981', bg: '#ECFDF5', accentColor: '#10B981' },
  success: { Icon: CheckCircle2, iconColor: '#10B981', bg: '#ECFDF5', accentColor: '#10B981' },
  promo:   { Icon: Sparkles,     iconColor: '#F59E0B', bg: '#FFFBEB', accentColor: '#F59E0B' },
  offer:   { Icon: Sparkles,     iconColor: '#F59E0B', bg: '#FFFBEB', accentColor: '#F59E0B' },
  wallet:  { Icon: Wallet,       iconColor: '#8B5CF6', bg: '#F5F3FF', accentColor: '#8B5CF6' },
  payout:  { Icon: Wallet,       iconColor: '#8B5CF6', bg: '#F5F3FF', accentColor: '#8B5CF6' },
  reward:  { Icon: Wallet,       iconColor: '#8B5CF6', bg: '#F5F3FF', accentColor: '#8B5CF6' },
  order:   { Icon: Package,      iconColor: colors.primary, bg: colors.primaryTint, accentColor: colors.primary },
  rider:   { Icon: Bike,         iconColor: '#3B82F6', bg: '#EFF6FF', accentColor: '#3B82F6' },
  pickup:  { Icon: Bike,         iconColor: '#3B82F6', bg: '#EFF6FF', accentColor: '#3B82F6' },
  support: { Icon: MessageCircle, iconColor: '#3B82F6', bg: '#EFF6FF', accentColor: '#3B82F6' },
};

const FALLBACK_META = { Icon: Bell, iconColor: colors.primary, bg: colors.primaryTint, accentColor: colors.primary };
const READ_META     = { Icon: Bell, iconColor: colors.inkFaint, bg: colors.surfaceMuted, accentColor: 'transparent' };

function getTypeMeta(type: string, read: boolean, title?: string) {
  if (read) return READ_META;
  const t = (type || '').toLowerCase();
  const tt = (title || '').toLowerCase();
  if (tt.includes('support')) return TYPE_META.support;
  const key = Object.keys(TYPE_META).find(k => t.includes(k));
  return key ? TYPE_META[key] : FALLBACK_META;
}

function groupNotifications(notifs: any[]) {
  const grouped: any[] = [];
  const map = new Map();

  for (const n of notifs) {
    let key = n.id;
    try {
      const d = n.data ? (typeof n.data === 'string' ? JSON.parse(n.data) : n.data) : {};
      if (d.ticketId) {
        key = `ticket_${d.ticketId}`;
      } else if (n.title?.includes('Support Team Replied') || n.type === 'support_message') {
        key = `support_replies`;
      }
    } catch {}

    if (key === n.id) {
      grouped.push({ ...n, _count: 1, _groupedIds: [] });
    } else {
      if (map.has(key)) {
        const existing = map.get(key);
        existing._count += 1;
        if (!n.is_read) {
          existing.is_read = false;
          existing._groupedIds.push(n.id);
        }
      } else {
        const newGroup = { ...n, _count: 1, _groupedIds: !n.is_read ? [n.id] : [] };
        grouped.push(newGroup);
        map.set(key, newGroup);
      }
    }
  }
  return grouped;
}

function NotifCard({ n, onPress }: { n: any; onPress: () => void }) {
  const meta = getTypeMeta(n.type, n.is_read, n.title);
  const { Icon, iconColor, bg, accentColor } = meta;

  return (
    <BouncingButton
      style={[styles.card, !n.is_read && styles.cardUnread]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Left accent stripe for unread */}
      {!n.is_read && <View style={[styles.accentStripe, { backgroundColor: accentColor }]} />}

      <View style={[styles.iconBox, { backgroundColor: bg }]}>
        <Icon size={20} color={iconColor} />
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text
            style={[styles.title, !n.is_read && styles.titleUnread]}
            numberOfLines={1}
          >
            {stripEmoji(n.title)} {n._count > 1 ? `(${n._count} new)` : ''}
          </Text>
          <Text style={[styles.time, !n.is_read && styles.timeUnread]}>
            {relativeTime(n.created_at)}
          </Text>
        </View>
        <Text
          style={[styles.message, !n.is_read && styles.messageUnread]}
          numberOfLines={2}
        >
          {n.body}
        </Text>
      </View>

      {/* Unread dot */}
      {!n.is_read && <View style={[styles.dot, { backgroundColor: accentColor }]} />}
    </BouncingButton>
  );
}

const NotificationsScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications'),
  });

  const readMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const readAllMutation = useMutation({
    mutationFn: () => api.post('/notifications/read-all', {}),
    onSuccess: () => {
      haptic();
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    setRefreshing(false);
  }, [queryClient]);

  const rawNotifications: any[] = data?.notifications ?? [];
  const groupedNotifications = React.useMemo(() => groupNotifications(rawNotifications), [rawNotifications]);
  const unread  = groupedNotifications.filter((n: any) => !n.is_read);
  const earlier = groupedNotifications.filter((n: any) => n.is_read);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <BouncingButton
          style={styles.backBtn}
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home')}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={colors.ink} />
        </BouncingButton>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unread.length > 0 && (
            <Text style={styles.headerSub}>{unread.length} unread</Text>
          )}
        </View>

        {unread.length > 0 && (
          <BouncingButton
            style={styles.markAllBtn}
            onPress={() => readAllMutation.mutate()}
            disabled={readAllMutation.isPending}
            activeOpacity={0.8}
          >
            <CheckCheck size={14} color={colors.primary} />
            <Text style={styles.markAllText}>Mark all read</Text>
          </BouncingButton>
        )}
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={{ padding: 16, gap: 12 }}>
          {Array.from({ length: 5 }).map((_, i) => <SkeletonListItem key={i} />)}
        </View>
      ) : groupedNotifications.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Bell size={36} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>All caught up</Text>
          <Text style={styles.emptySub}>
            Order updates, offers and wallet activity will appear here.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {/* Unread section */}
          {unread.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>UNREAD</Text>
              {unread.map((n: any, i: number) => (
                <Animated.View key={n.id} entering={FadeInDown.delay(i * 30).duration(200)}>
                  <NotifCard
                    n={n}
                    onPress={() => {
                      haptic();
                      readMutation.mutate(n.id);
                      if (n._groupedIds?.length > 0) {
                        n._groupedIds.forEach((id: string) => readMutation.mutate(id));
                      }
                      deepLink(n, navigation);
                    }}
                  />
                </Animated.View>
              ))}
            </>
          )}

          {/* Earlier section */}
          {earlier.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, unread.length > 0 && { marginTop: 20 }]}>EARLIER</Text>
              {earlier.map((n: any, i: number) => (
                <Animated.View key={n.id} entering={FadeInDown.delay(i * 20).duration(200)}>
                  <NotifCard
                    n={n}
                    onPress={() => deepLink(n, navigation)}
                  />
                </Animated.View>
              ))}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
};

function deepLink(n: any, navigation: any) {
  try {
    const d = n.data ? (typeof n.data === 'string' ? JSON.parse(n.data) : n.data) : {};
    
    // Support messages deep link
    if (n.type === 'support_message' || d.ticketId || n.title?.includes('Support')) {
      navigation.navigate('Support', { ticketId: d.ticketId });
    }
    // Table booking
    else if (n.type?.includes('table_booking') || n.type === 'booking_reminder') {
      navigation.navigate('MyTableBookings');
    } 
    // Wallet
    else if (n.type?.includes('wallet') || n.type?.includes('reward')) {
      navigation.navigate('Wallet');
    } 
    // Promos
    else if (n.type?.includes('promo')) {
      navigation.navigate('Home');
    } 
    // Orders
    else if (d.orderId) {
      navigation.navigate('OrderConfirmed', { orderId: d.orderId });
    }
  } catch {}
}

export default NotificationsScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F6F8' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    gap: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontFamily: fontFamily.black, color: colors.ink },
  headerSub: { fontSize: 12, fontFamily: fontFamily.medium, color: colors.primary, marginTop: 1 },
  markAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, backgroundColor: colors.primaryTint,
    borderWidth: 1, borderColor: colors.primary + '30',
  },
  markAllText: { fontSize: 12, fontFamily: fontFamily.bold, color: colors.primary },

  // Section labels
  sectionLabel: {
    fontSize: 11, fontFamily: fontFamily.extrabold,
    color: colors.inkFaint, letterSpacing: 1.2,
    marginBottom: 10, marginTop: 8,
  },

  // Card
  card: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: colors.white,
    borderRadius: 16, marginBottom: 8,
    borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.04,
    shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardUnread: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    shadowOpacity: 0.07, elevation: 4,
  },
  accentStripe: {
    width: 3, alignSelf: 'stretch',
    borderTopLeftRadius: 16, borderBottomLeftRadius: 16,
  },
  iconBox: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 12, marginVertical: 14, marginRight: 12,
  },
  body: { flex: 1, paddingVertical: 14, paddingRight: 32 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
  title: { fontSize: 14, fontWeight: '600', color: colors.ink, flex: 1, marginRight: 8 },
  titleUnread: { fontWeight: '700', color: colors.ink },
  time: { fontSize: 11, fontWeight: '500', color: colors.inkFaint },
  timeUnread: { color: colors.primary, fontWeight: '600' },
  message: { fontSize: 13, fontWeight: '400', color: colors.inkMuted, lineHeight: 19 },
  messageUnread: { color: colors.ink, fontWeight: '500', fontFamily: fontFamily.medium },
  dot: {
    position: 'absolute', top: 14, right: 12,
    width: 8, height: 8, borderRadius: 4,
  },

  // Empty state
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primaryTint,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  emptyTitle: { fontSize: 20, fontFamily: fontFamily.black, color: colors.ink, marginBottom: 8 },
  emptySub: {
    fontSize: 14, fontFamily: fontFamily.regular,
    color: colors.inkMuted, textAlign: 'center', lineHeight: 21,
  },
});
