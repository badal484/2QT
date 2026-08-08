import { tokens } from '../theme/tokens';
import React, { useCallback } from 'react';
import { BouncingButton } from '../components/ui/BouncingButton';
import {
  View, Text, ScrollView, ActivityIndicator,
  StyleSheet, StatusBar, RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Bell, CheckCheck, Bike, ShieldCheck,
  IndianRupee, CheckCircle2, XCircle, AlertTriangle, Star,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api/client';

const R = {
  orange: '#FC4603', orangeLight: '#FFF0E8',
  green: '#1BA672', greenLight: '#E8F8F1',
  red: tokens.colors.danger, redLight: '#FEF2F2',
  amber: '#F59E0B', amberLight: 'rgba(245,158,11,0.1)',
  purple: '#8B5CF6', purpleLight: 'rgba(139,92,246,0.1)',
  ink: '#1C1C1E', gray: '#6E6E73', muted: '#8E8E93',
  border: '#E5E5EA', bg: '#F2F2F7', white: tokens.colors.surface,
};

const getIcon = (type: string, read: boolean) => {
  const size = 20;
  const fade = read ? R.muted : undefined;
  if (type?.includes('suspend') || type?.includes('warn'))
    return { icon: <AlertTriangle size={size} color={fade ?? R.red} />, bg: read ? R.bg : R.redLight };
  if (type?.includes('document') || type?.includes('kyc') || type?.includes('verify'))
    return { icon: <ShieldCheck size={size} color={fade ?? R.orange} />, bg: read ? R.bg : R.orangeLight };
  if (type?.includes('payout') || type?.includes('earning') || type?.includes('payment'))
    return { icon: <IndianRupee size={size} color={fade ?? R.green} />, bg: read ? R.bg : R.greenLight };
  if (type?.includes('mission') || type?.includes('bonus') || type?.includes('incentive'))
    return { icon: <Star size={size} color={fade ?? R.amber} />, bg: read ? R.bg : R.amberLight };
  if (type?.includes('reactivat') || type?.includes('success') || type?.includes('approved'))
    return { icon: <CheckCircle2 size={size} color={fade ?? R.green} />, bg: read ? R.bg : R.greenLight };
  if (type?.includes('reject') || type?.includes('cancel') || type?.includes('fail'))
    return { icon: <XCircle size={size} color={fade ?? R.red} />, bg: read ? R.bg : R.redLight };
  return { icon: <Bike size={size} color={fade ?? R.orange} />, bg: read ? R.bg : R.orangeLight };
};

function relativeTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const RiderNotificationsScreen = ({ navigation }: any) => {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['rider-notifications'],
    queryFn: () => api.get('/notifications'),
  });

  const readMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rider-notifications'] }),
  });

  const readAllMutation = useMutation({
    mutationFn: () => api.post('/notifications/read-all', {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rider-notifications'] }),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['rider-notifications'] });
    setRefreshing(false);
  }, [queryClient]);

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

  const rawNotifications: any[] = data?.notifications ?? [];
  const groupedNotifications = React.useMemo(() => groupNotifications(rawNotifications), [rawNotifications]);
  const unreadCount = groupedNotifications.filter((n: any) => !n.is_read).length;

  const handlePress = (n: any) => {
    if (!n.is_read) {
      readMutation.mutate(n.id);
      if (n._groupedIds?.length > 0) {
        n._groupedIds.forEach((id: string) => readMutation.mutate(id));
      }
    }
    try {
      const d = n.data ? (typeof n.data === 'string' ? JSON.parse(n.data) : n.data) : {};
      const t = n.type ?? '';
      if (t.includes('document') || t.includes('kyc')) {
        navigation.navigate('RiderDocuments');
      } else if (t.includes('payout') || t.includes('earning')) {
        navigation.navigate('Payouts');
      } else if (t.includes('mission') || t.includes('bonus')) {
        navigation.navigate('RiderMissions');
      } else if (t === 'support_message' || d.ticketId || n.title?.includes('Support')) {
        navigation.navigate('RiderSupport', { ticketId: d.ticketId });
      }
    } catch (e) { console.error('[notification-nav]', e); }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={R.white} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* Header */}
        <View style={styles.header}>
          <BouncingButton style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <ArrowLeft size={20} color={R.ink} />
          </BouncingButton>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Notifications</Text>
            {unreadCount > 0 && <Text style={styles.headerSub}>{unreadCount} unread</Text>}
          </View>
          {unreadCount > 0 && (
            <BouncingButton
              style={styles.markAllBtn}
              onPress={() => readAllMutation.mutate()}
              disabled={readAllMutation.isPending}
              activeOpacity={0.8}
            >
              <CheckCheck size={16} color={R.orange} />
              <Text style={styles.markAllText}>Mark all read</Text>
            </BouncingButton>
          )}
        </View>

        {/* Content */}
        {isLoading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={R.orange} size="large" />
          </View>
        ) : groupedNotifications.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Bell size={40} color={R.orange} />
            </View>
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptySub}>Order assignments, payout updates, and document status will appear here.</Text>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={R.orange} />}
          >
            {groupedNotifications.map((n: any, i: number) => {
              const { icon, bg } = getIcon(n.type, n.is_read);
              return (
                <Animated.View key={n.id} entering={FadeInDown.delay(i * 30).duration(200)}>
                  <BouncingButton
                    style={[styles.card, !n.is_read && styles.cardUnread]}
                    onPress={() => handlePress(n)}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.iconBox, { backgroundColor: bg }]}>
                      {icon}
                    </View>
                    <View style={styles.body}>
                      <View style={styles.titleRow}>
                        <Text style={[styles.title, !n.is_read && styles.titleUnread]} numberOfLines={1}>
                          {n.title} {n._count > 1 ? `(${n._count} new)` : ''}
                        </Text>
                        <Text style={[styles.time, !n.is_read && styles.timeUnread]}>
                          {relativeTime(n.created_at)}
                        </Text>
                      </View>
                      <Text style={[styles.message, !n.is_read && styles.messageUnread]} numberOfLines={2}>
                        {n.body}
                      </Text>
                    </View>
                  </BouncingButton>
                </Animated.View>
              );
            })}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
};

export default RiderNotificationsScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: R.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 16,
    backgroundColor: R.white,
    borderBottomWidth: 1, borderBottomColor: R.border,
    gap: 12,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: R.bg, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: R.border,
  },
  headerTitle: { fontSize: 22, fontWeight: '900', color: R.ink },
  headerSub: { fontSize: 13, fontWeight: '600', color: R.orange, marginTop: 2 },
  markAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 24, backgroundColor: R.orangeLight,
  },
  markAllText: { fontSize: 13, fontWeight: '700', color: R.orange },

  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIcon: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: R.orangeLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  emptyTitle: { fontSize: 22, fontWeight: '900', color: R.ink, marginBottom: 8 },
  emptySub: { fontSize: 15, fontWeight: '500', color: R.gray, textAlign: 'center', lineHeight: 22 },

  card: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: R.white, borderRadius: 20,
    padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: R.border,
    ...tokens.shadows.soft,
  },
  cardUnread: {
    borderColor: '#FDDBB4',
    shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  iconBox: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginRight: 14, flexShrink: 0,
  },
  body: { flex: 1, justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
  title: { fontSize: 14, fontWeight: '600', color: R.ink, flex: 1, marginRight: 8 },
  titleUnread: { fontWeight: '700', color: R.ink },
  time: { fontSize: 11, fontWeight: '500', color: R.muted },
  timeUnread: { color: R.orange, fontWeight: '600' },
  message: { fontSize: 13, fontWeight: '400', color: R.gray, lineHeight: 19 },
  messageUnread: { color: R.ink, fontWeight: '500' },
});
