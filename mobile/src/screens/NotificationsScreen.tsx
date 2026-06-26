import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  StyleSheet, RefreshControl, Switch,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Bell, BellOff, Check, CheckCheck, Package, Bike, Tag, Gift, Info, AlertCircle, CheckCircle2, XCircle, Sparkles, Megaphone, Wallet } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const haptic = () => ReactNativeHapticFeedback.trigger('impactLight', { enableVibrateFallback: true });

// ── Icon per notification type ──────────────────────────────────────────────
const NotifIcon = ({ type, read }: { type: string; read: boolean }) => {
  const size = 20;
  if (read) return <Bell size={size} color={colors.inkFaint} />;
  if (type?.includes('alert') || type?.includes('cancel') || type?.includes('fail'))
    return <XCircle size={size} color="#EF4444" />;
  if (type?.includes('confirm') || type?.includes('deliver') || type?.includes('success'))
    return <CheckCircle2 size={size} color="#10B981" />;
  if (type?.includes('promo') || type?.includes('discount') || type?.includes('campaign') || type?.includes('offer'))
    return <Sparkles size={size} color="#F59E0B" />;
  if (type?.includes('wallet') || type?.includes('payout') || type?.includes('reward') || type?.includes('loyalty'))
    return <Wallet size={size} color="#8B5CF6" />;
  if (type?.includes('order') || type?.includes('preparing'))
    return <Package size={size} color={colors.primary} />;
  if (type?.includes('rider') || type?.includes('pickup'))
    return <Bike size={size} color="#3B82F6" />;
  return <Bell size={size} color={colors.primary} />;
};

const iconBg = (type: string, read: boolean) => {
  if (read) return colors.surfaceMuted;
  if (type?.includes('alert') || type?.includes('cancel') || type?.includes('fail')) return '#FEE2E2';
  if (type?.includes('confirm') || type?.includes('deliver') || type?.includes('success')) return '#DCFCE7';
  if (type?.includes('promo') || type?.includes('discount') || type?.includes('campaign') || type?.includes('offer')) return '#FEF3C7';
  if (type?.includes('wallet') || type?.includes('payout') || type?.includes('reward') || type?.includes('loyalty')) return '#EDE9FE';
  if (type?.includes('rider') || type?.includes('pickup')) return '#DBEAFE';
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
  { key: 'payouts', label: 'Payout Alerts', desc: 'Rider and kitchen payout notifications' },
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
          value={p['push_enabled'] !== false}
          onValueChange={(val) => {
            haptic();
            patchMutation.mutate({ push_enabled: val });
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
                  
                  // Deep linking logic
                  try {
                    const parsedData = n.data ? JSON.parse(n.data) : {};
                    if (parsedData.orderId) {
                      navigation.navigate('OrderConfirmed', { orderId: parsedData.orderId });
                    }
                  } catch (err) {}
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
    backgroundColor: colors.white, borderRadius: 20,
    padding: 16, marginBottom: 12,
    borderWidth: 0,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  notifCardUnread: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1, borderColor: colors.primary + '20',
  },
  notifIconBox: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 14,
  },
  notifBody: { flex: 1 },
  notifTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  notifTitle: { fontSize: 14, fontFamily: fontFamily.bold, color: colors.ink, flex: 1, marginRight: 8 },
  notifTitleUnread: { fontFamily: fontFamily.black, color: colors.ink },
  notifTime: { fontSize: 11, fontFamily: fontFamily.medium, color: colors.inkFaint },
  notifMessage: { fontSize: 13, fontFamily: fontFamily.medium, color: colors.inkMuted, lineHeight: 18 },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.primary, marginLeft: 10, marginTop: 6,
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
