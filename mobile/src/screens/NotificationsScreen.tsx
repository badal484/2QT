import React, { useCallback } from 'react';
import { BouncingButton } from '../components/ui/BouncingButton';
import {
  View, Text, ScrollView, ActivityIndicator,
  StyleSheet, RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Bell, CheckCheck, Package, Bike, Sparkles, Wallet, CheckCircle2, XCircle } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const haptic = () => ReactNativeHapticFeedback.trigger('impactLight', { enableVibrateFallback: true });

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

  const notifications: any[] = data?.notifications ?? [];
  const unreadCount = notifications.filter((n: any) => !n.is_read).length;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <BouncingButton style={styles.backBtn} onPress={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate('Home');
          }
        }} activeOpacity={0.7}>
          <ArrowLeft size={20} color={colors.ink} />
        </BouncingButton>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <Text style={styles.headerSub}>{unreadCount} unread</Text>
          )}
        </View>
        {unreadCount > 0 && (
          <BouncingButton
            style={styles.markAllBtn}
            onPress={() => readAllMutation.mutate()}
            disabled={readAllMutation.isPending}
            activeOpacity={0.8}
          >
            <CheckCheck size={16} color={colors.primary} />
            <Text style={styles.markAllText}>Mark all read</Text>
          </BouncingButton>
        )}
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Bell size={40} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>You're all caught up!</Text>
          <Text style={styles.emptySub}>When you get updates about your orders or exclusive offers, they'll show up here.</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {notifications.map((n: any, i: number) => (
            <Animated.View key={n.id} entering={FadeInDown.delay(i * 30).duration(200)}>
              <BouncingButton
                style={[styles.notifCard, !n.is_read && styles.notifCardUnread]}
                onPress={() => {
                  if (!n.is_read) {
                    haptic();
                    readMutation.mutate(n.id);
                  }
                  
                  // Proper Deep Linking
                  try {
                    const parsedData = n.data ? (typeof n.data === 'string' ? JSON.parse(n.data) : n.data) : {};
                    
                    if (n.type.includes('table_booking') || n.type === 'booking_reminder') {
                      navigation.navigate('MyTableBookings');
                    } else if (n.type.includes('wallet') || n.type.includes('reward')) {
                      navigation.navigate('Wallet');
                    } else if (n.type.includes('promo')) {
                      navigation.navigate('Home');
                    } else if (parsedData.orderId) {
                      navigation.navigate('OrderConfirmed', { orderId: parsedData.orderId });
                    }
                  } catch (err) {
                     console.log('Deep link error', err);
                  }
                }}
                activeOpacity={0.85}
              >
                <View style={[styles.notifIconBox, { backgroundColor: iconBg(n.type, n.is_read) }]}>
                  <NotifIcon type={n.type} read={n.is_read} />
                </View>

                <View style={styles.notifBody}>
                  <View style={styles.notifTitleRow}>
                    <Text style={[styles.notifTitle, !n.is_read && styles.notifTitleUnread]} numberOfLines={1}>
                      {n.title}
                    </Text>
                    <Text style={[styles.notifTime, !n.is_read && styles.notifTimeUnread]}>{relativeTime(n.created_at)}</Text>
                  </View>
                  <Text style={[styles.notifMessage, !n.is_read && styles.notifMessageUnread]} numberOfLines={2}>{n.body}</Text>
                </View>
              </BouncingButton>
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
    paddingHorizontal: 16, paddingBottom: 16,
    backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    gap: 12,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 22, fontFamily: fontFamily.bold, color: colors.ink },
  headerSub: { fontSize: 13, fontFamily: fontFamily.medium, color: colors.primary, marginTop: 2 },
  markAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 24, backgroundColor: colors.primaryTint,
  },
  markAllText: { fontSize: 13, fontFamily: fontFamily.bold, color: colors.primary },

  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIcon: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: colors.primaryTint,
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  emptyTitle: { fontSize: 22, fontFamily: fontFamily.bold, color: colors.ink, marginBottom: 8 },
  emptySub: { fontSize: 15, fontFamily: fontFamily.medium, color: colors.inkMuted, textAlign: 'center', lineHeight: 22 },

  notifCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: colors.white, borderRadius: 24,
    padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  notifCardUnread: {
    backgroundColor: '#FAFAFA',
    borderColor: colors.primary + '30',
    shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  notifIconBox: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 16,
  },
  notifBody: { flex: 1, justifyContent: 'center' },
  notifTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  notifTitle: { fontSize: 15, fontFamily: fontFamily.bold, color: colors.ink, flex: 1, marginRight: 8 },
  notifTitleUnread: { fontFamily: fontFamily.black, color: colors.primaryDark },
  notifTime: { fontSize: 12, fontFamily: fontFamily.medium, color: colors.inkFaint },
  notifTimeUnread: { color: colors.primary, fontFamily: fontFamily.bold },
  notifMessage: { fontSize: 14, fontFamily: fontFamily.medium, color: colors.inkMuted, lineHeight: 20 },
  notifMessageUnread: { color: colors.ink, fontFamily: fontFamily.semibold },
});
