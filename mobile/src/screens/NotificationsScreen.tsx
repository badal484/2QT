import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  StyleSheet, RefreshControl, Switch,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Bell, BellOff, Check, CheckCheck, Package, Bike, Tag, Gift, Info, AlertCircle } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const haptic = () => ReactNativeHapticFeedback.trigger('impactLight', { enableVibrateFallback: true });

// ── Icon per notification type ──────────────────────────────────────────────
const NotifIcon = ({ type, read }: { type: string; read: boolean }) => {
  const tint = read ? colors.inkFaint : colors.primary;
  const size = 18;
  if (type?.includes('order') || type?.includes('confirmed') || type?.includes('preparing') || type?.includes('delivered'))
    return <Package size={size} color={tint} />;
  if (type?.includes('rider') || type?.includes('delivery') || type?.includes('pickup'))
    return <Bike size={size} color={tint} />;
  if (type?.includes('promo') || type?.includes('discount') || type?.includes('campaign'))
    return <Tag size={size} color={tint} />;
  if (type?.includes('wallet') || type?.includes('reward') || type?.includes('loyalty'))
    return <Gift size={size} color={tint} />;
  if (type?.includes('alert') || type?.includes('cancel') || type?.includes('fail'))
    return <AlertCircle size={size} color={read ? colors.inkFaint : colors.danger} />;
  return <Info size={size} color={tint} />;
};

const iconBg = (type: string, read: boolean) => {
  if (read) return colors.surfaceMuted;
  if (type?.includes('alert') || type?.includes('cancel') || type?.includes('fail'))
    return '#FEE2E2';
  return colors.primaryTint;
};

function relativeTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// ── Preferences section ──────────────────────────────────────────────────────
const PREF_ITEMS = [
  { key: 'order_updates', label: 'Order Updates', desc: 'Confirmed, preparing, delivered' },
  { key: 'promotions', label: 'Promotions & Offers', desc: 'Deals, coupons and campaigns' },
  { key: 'wallet', label: 'Wallet Activity', desc: 'Credits, debits and cashback' },
  { key: 'loyalty', label: 'Loyalty Rewards', desc: 'Points earned and redeemed' },
];

const PreferencesTab = () => {
  const queryClient = useQueryClient();

  const { data: prefs, isLoading } = useQuery({
    queryKey: ['notif-prefs'],
    queryFn: () => api.get('/notifications/preferences'),
  });

  const patchMutation = useMutation({
    mutationFn: (body: Record<string, boolean>) => api.patch('/notifications/preferences', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notif-prefs'] }),
  });

  if (isLoading) return (
    <View style={{ flex: 1, alignItems: 'center', paddingTop: 60 }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );

  const p = prefs?.preferences ?? {};

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <Text style={styles.prefNote}>
        Control which notifications you receive. Order updates are always on for safety.
      </Text>

      {PREF_ITEMS.map((item, i) => (
        <Animated.View key={item.key} entering={FadeInDown.delay(i * 50).duration(220)} style={styles.prefRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.prefLabel}>{item.label}</Text>
            <Text style={styles.prefDesc}>{item.desc}</Text>
          </View>
          <Switch
            value={item.key === 'order_updates' ? true : (p[item.key] !== false)}
            disabled={item.key === 'order_updates'}
            onValueChange={(val) => {
              haptic();
              patchMutation.mutate({ [item.key]: val });
            }}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.white}
          />
        </Animated.View>
      ))}

      <View style={styles.prefDivider} />

      <View style={styles.prefRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.prefLabel}>Push Notifications</Text>
          <Text style={styles.prefDesc}>Receive alerts even when app is closed</Text>
        </View>
        <Switch
          value={p['push'] !== false}
          onValueChange={(val) => {
            haptic();
            patchMutation.mutate({ push: val });
          }}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.white}
        />
      </View>
    </ScrollView>
  );
};

// ── Main Screen ──────────────────────────────────────────────────────────────
const NotificationsScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'inbox' | 'settings'>('inbox');
  const [refreshing, setRefreshing] = useState(false);

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

  const notifications: any[] = data?.notifications ?? [];
  const unreadCount = notifications.filter((n: any) => !n.is_read).length;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <ArrowLeft size={20} color={colors.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <Text style={styles.headerSub}>{unreadCount} unread</Text>
          )}
        </View>
        {tab === 'inbox' && unreadCount > 0 && (
          <TouchableOpacity
            style={styles.markAllBtn}
            onPress={() => readAllMutation.mutate()}
            disabled={readAllMutation.isPending}
            activeOpacity={0.8}
          >
            <CheckCheck size={15} color={colors.primary} />
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'inbox' && styles.tabBtnActive]}
          onPress={() => { haptic(); setTab('inbox'); }}
          activeOpacity={0.8}
        >
          <Bell size={14} color={tab === 'inbox' ? colors.primary : colors.inkMuted} />
          <Text style={[styles.tabText, tab === 'inbox' && styles.tabTextActive]}>Inbox</Text>
          {unreadCount > 0 && tab !== 'inbox' && (
            <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{unreadCount}</Text></View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'settings' && styles.tabBtnActive]}
          onPress={() => { haptic(); setTab('settings'); }}
          activeOpacity={0.8}
        >
          <BellOff size={14} color={tab === 'settings' ? colors.primary : colors.inkMuted} />
          <Text style={[styles.tabText, tab === 'settings' && styles.tabTextActive]}>Settings</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {tab === 'settings' ? (
        <PreferencesTab />
      ) : isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Bell size={32} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>All caught up!</Text>
          <Text style={styles.emptySub}>No notifications yet. We'll let you know about your orders, offers and wallet activity.</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {notifications.map((n: any, i: number) => (
            <Animated.View key={n.id} entering={FadeInDown.delay(i * 30).duration(200)}>
              <TouchableOpacity
                style={[styles.notifCard, !n.is_read && styles.notifCardUnread]}
                onPress={() => {
                  if (!n.is_read) {
                    haptic();
                    readMutation.mutate(n.id);
                  }
                }}
                activeOpacity={0.85}
              >
                {/* Icon */}
                <View style={[styles.notifIconBox, { backgroundColor: iconBg(n.type, n.is_read) }]}>
                  <NotifIcon type={n.type} read={n.is_read} />
                </View>

                {/* Body */}
                <View style={styles.notifBody}>
                  <View style={styles.notifTitleRow}>
                    <Text style={[styles.notifTitle, !n.is_read && styles.notifTitleUnread]} numberOfLines={1}>
                      {n.title}
                    </Text>
                    <Text style={styles.notifTime}>{relativeTime(n.created_at)}</Text>
                  </View>
                  <Text style={styles.notifMessage} numberOfLines={2}>{n.body}</Text>
                </View>

                {/* Unread dot */}
                {!n.is_read && <View style={styles.unreadDot} />}
              </TouchableOpacity>
            </Animated.View>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

export default NotificationsScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    gap: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontFamily: fontFamily.extrabold, color: colors.ink },
  headerSub: { fontSize: 11, fontFamily: fontFamily.medium, color: colors.inkMuted, marginTop: 1 },
  markAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, backgroundColor: colors.primaryTint,
  },
  markAllText: { fontSize: 11, fontFamily: fontFamily.bold, color: colors.primary },

  tabRow: {
    flexDirection: 'row', backgroundColor: colors.white,
    paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4,
    borderBottomWidth: 1, borderBottomColor: colors.border, gap: 8,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
  },
  tabBtnActive: { backgroundColor: colors.primaryTint },
  tabText: { fontSize: 13, fontFamily: fontFamily.semibold, color: colors.inkMuted },
  tabTextActive: { color: colors.primary },
  tabBadge: {
    backgroundColor: colors.primary, width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  tabBadgeText: { fontSize: 9, fontFamily: fontFamily.bold, color: colors.white },

  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primaryTint,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  emptyTitle: { fontSize: 20, fontFamily: fontFamily.bold, color: colors.ink, marginBottom: 8 },
  emptySub: { fontSize: 14, fontFamily: fontFamily.regular, color: colors.inkMuted, textAlign: 'center', lineHeight: 21 },

  notifCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: colors.white, borderRadius: 16,
    padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  notifCardUnread: {
    borderColor: colors.primary + '30',
    backgroundColor: colors.primaryTint + '50',
  },
  notifIconBox: {
    width: 42, height: 42, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  notifBody: { flex: 1 },
  notifTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  notifTitle: { fontSize: 13, fontFamily: fontFamily.semibold, color: colors.inkMuted, flex: 1, marginRight: 8 },
  notifTitleUnread: { fontFamily: fontFamily.bold, color: colors.ink },
  notifTime: { fontSize: 10, fontFamily: fontFamily.medium, color: colors.inkFaint },
  notifMessage: { fontSize: 13, fontFamily: fontFamily.regular, color: colors.inkMuted, lineHeight: 18 },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.primary, marginLeft: 8, marginTop: 4,
  },

  // Preferences
  prefNote: {
    fontSize: 13, fontFamily: fontFamily.regular, color: colors.inkMuted,
    lineHeight: 19, marginBottom: 20, paddingHorizontal: 4,
  },
  prefRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.white, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8,
    borderWidth: 1, borderColor: colors.border,
  },
  prefLabel: { fontSize: 14, fontFamily: fontFamily.semibold, color: colors.ink, marginBottom: 2 },
  prefDesc: { fontSize: 12, fontFamily: fontFamily.regular, color: colors.inkMuted },
  prefDivider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
});
