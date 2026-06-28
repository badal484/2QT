import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, StatusBar, StyleSheet, Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../store/slices/authSlice';
import { RootState } from '../store';
import { ChefHat, LogOut, ClipboardCheck, Zap, Clock } from 'lucide-react-native';
import { getSocket } from '../socket/client';

const G = {
  bg: '#070707',
  card: '#111111',
  cardHi: '#161616',
  border: 'rgba(255,255,255,0.07)',
  green: '#00D084',
  greenBg: 'rgba(0,208,132,0.08)',
  greenBorder: 'rgba(0,208,132,0.18)',
  amber: G.primary,
  amberBg: 'rgba(245,158,11,0.08)',
  amberBorder: 'rgba(245,158,11,0.18)',
  red: '#EF4444',
  redBg: 'rgba(239,68,68,0.08)',
  redBorder: 'rgba(239,68,68,0.18)',
  white: '#FFFFFF',
  dim: 'rgba(255,255,255,0.45)',
  muted: 'rgba(255,255,255,0.18)',
  faint: 'rgba(255,255,255,0.05)',
};

function elapsed(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function LiveClock() {
  const [t, setT] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <Text style={styles.clock}>
      {t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </Text>
  );
}

const KitchenBoardScreen = ({ navigation }: any) => {
  const queryClient = useQueryClient();
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);



  const { data: menuData } = useQuery({
    queryKey: ['kitchen-menu'],
    queryFn: () => api.get('/kitchen/menu'),
  });

  const pauseMutation = useMutation({
    mutationFn: (paused: boolean) => api.patch('/kitchen/status', { paused, reason: 'Chef paused.' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kitchen-menu'] }),
  });

  const toggleItemMutation = useMutation({
    mutationFn: ({ itemId, available }: { itemId: string; available: boolean }) =>
      api.patch(`/kitchen/menu/${itemId}/availability`, { available }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kitchen-menu'] }),
  });

  const { data: orders, isLoading } = useQuery({
    queryKey: ['kitchen-orders'],
    queryFn: () => api.get('/kitchen/orders'),
    refetchInterval: 30000,
  });

  const claimMutation = useMutation({
    mutationFn: (orderId: string) => api.post(`/kitchen/orders/${orderId}/claim`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] }),
    onError: () => Alert.alert('Error', 'Could not accept this order. It may have been claimed already.'),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: string }) =>
      api.patch(`/kitchen/orders/${orderId}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] }),
    onError: () => Alert.alert('Error', 'Could not update order status.'),
  });

  const paused = menuData?.kitchenPaused;
  const incoming = orders?.orders?.filter((o: any) => o.status === 'confirmed') || [];
  const cooking = orders?.orders?.filter((o: any) =>
    ['preparing', 'at_kitchen'].includes(o.status)
  ) || [];
  const ready = orders?.orders?.filter((o: any) => o.status === 'ready_for_pickup') || [];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={G.bg} />

      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <View>
            <View style={styles.liveRow}>
              <View style={[styles.liveDot, { backgroundColor: paused ? G.red : G.green, shadowColor: paused ? G.red : G.green }]} />
              <Text style={styles.liveLabel}>{paused ? 'PAUSED' : 'LIVE'}</Text>
            </View>
            <LiveClock />
            {user?.kitchenName ? (
              <Text style={styles.kitchenName}>{user.kitchenName}</Text>
            ) : null}
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[styles.pill, {
                backgroundColor: paused ? G.greenBg : G.redBg,
                borderColor: paused ? G.greenBorder : G.redBorder,
              }]}
              onPress={() => pauseMutation.mutate(!paused)}
              activeOpacity={0.7}
            >
              <Text style={[styles.pillText, { color: paused ? G.green : G.red }]}>
                {paused ? 'RESUME' : 'PAUSE'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('ShiftHandover')}>
              <ClipboardCheck size={20} color={G.muted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => dispatch(logout())}>
              <LogOut size={20} color={G.muted} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={G.green} size="large" />
          <Text style={styles.loaderText}>SYNCING KITCHEN</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={[styles.statNum, incoming.length > 0 && { color: G.white }]}>{incoming.length}</Text>
              <Text style={styles.statLabel}>INCOMING</Text>
            </View>
            <View style={[styles.statCard, styles.statMiddle]}>
              <Text style={[styles.statNum, cooking.length > 0 && { color: G.amber }]}>{cooking.length}</Text>
              <Text style={styles.statLabel}>COOKING</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statNum, ready.length > 0 && { color: G.green }]}>{ready.length}</Text>
              <Text style={styles.statLabel}>READY</Text>
            </View>
          </View>

          {/* 86 Items */}
          {menuData?.items?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>86 ITEMS</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                {menuData.items.map((item: any) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.chip, !item.available && styles.chipOff]}
                    onPress={() => toggleItemMutation.mutate({ itemId: item.id, available: !item.available })}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.chipDot, { backgroundColor: item.available ? G.green : G.red }]} />
                    <Text style={[styles.chipText, !item.available && { color: G.red }]}>{item.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Incoming Orders */}
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionLabel}>NEW ORDERS</Text>
              {incoming.length > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{incoming.length}</Text>
                </View>
              )}
            </View>

            {incoming.length === 0 ? (
              <View style={styles.emptyCard}>
                <Zap size={22} color={G.muted} strokeWidth={1.5} />
                <Text style={styles.emptyText}>Awaiting orders</Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 4 }}>
                {incoming.map((order: any) => (
                  <View key={order.id} style={styles.newCard}>
                    <View style={styles.newCardTop}>
                      <Text style={styles.newCardId}>{order.display_id}</Text>
                      <View style={styles.ageChip}>
                        <Clock size={9} color={G.amber} />
                        <Text style={styles.ageText}>{elapsed(order.created_at)}</Text>
                      </View>
                    </View>

                    <View style={styles.newCardItems}>
                      {order.items?.map((item: any, i: number) => (
                        <View key={i} style={styles.newItemRow}>
                          <Text style={styles.newItemQty}>{item.quantity}×</Text>
                          <Text style={styles.newItemName} numberOfLines={1}>{item.name}</Text>
                        </View>
                      ))}
                    </View>

                    {order.special_instructions ? (
                      <View style={styles.newNoteBox}>
                        <Text style={styles.newNoteText} numberOfLines={2}>{order.special_instructions}</Text>
                      </View>
                    ) : null}

                    <TouchableOpacity
                      style={styles.acceptBtn}
                      onPress={() => claimMutation.mutate(order.id)}
                      activeOpacity={0.8}
                    >
                      <ChefHat size={15} color="#000" strokeWidth={2.5} />
                      <Text style={styles.acceptBtnText}>ACCEPT</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Cooking */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>IN KITCHEN</Text>

            {[...cooking, ...ready].length === 0 ? (
              <View style={styles.emptyCard}>
                <ChefHat size={22} color={G.muted} strokeWidth={1.5} />
                <Text style={styles.emptyText}>Kitchen floor clear</Text>
              </View>
            ) : (
              [...cooking, ...ready].map((order: any) => {
                const isReady = order.status === 'ready_for_pickup';
                return (
                  <View key={order.id} style={[styles.activeCard, isReady && styles.activeCardReady]}>
                    {/* Top row */}
                    <View style={styles.activeTop}>
                      <View>
                        <Text style={styles.activeId}>{order.display_id}</Text>
                        <View style={[styles.statusPill, {
                          backgroundColor: isReady ? G.greenBg : G.amberBg,
                          borderColor: isReady ? G.greenBorder : G.amberBorder,
                        }]}>
                          <View style={[styles.statusDot, { backgroundColor: isReady ? G.green : G.amber }]} />
                          <Text style={[styles.statusPillText, { color: isReady ? G.green : G.amber }]}>
                            {isReady ? 'READY FOR PICKUP' : 'COOKING'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.ageChipDark}>
                        <Clock size={10} color={G.muted} />
                        <Text style={styles.ageTextDark}>{elapsed(order.created_at)}</Text>
                      </View>
                    </View>

                    <View style={styles.divider} />

                    {/* Items */}
                    <View style={styles.itemsList}>
                      {order.items?.map((item: any, i: number) => (
                        <View key={i} style={styles.activeItemRow}>
                          <Text style={styles.activeItemQty}>{item.quantity}</Text>
                          <Text style={styles.activeItemName}>{item.name}</Text>
                        </View>
                      ))}
                    </View>

                    {/* Note */}
                    {order.special_instructions && (
                      <View style={styles.alertBox}>
                        <Text style={styles.alertLabel}>NOTE</Text>
                        <Text style={styles.alertText}>{order.special_instructions}</Text>
                      </View>
                    )}

                    {/* CTA */}
                    {isReady ? (
                      <View style={styles.waitingBar}>
                        <Text style={styles.waitingText}>WAITING FOR RIDER PICKUP</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.readyBtn}
                        onPress={() => updateStatusMutation.mutate({ orderId: order.id, status: 'ready_for_pickup' })}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.readyBtnText}>MARK READY</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: G.bg },
  safeTop: { backgroundColor: G.bg },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loaderText: { color: G.muted, fontSize: 10, fontWeight: '900', letterSpacing: 4 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingTop: 16, paddingBottom: 20,
    borderBottomWidth: 1, borderBottomColor: G.faint,
  },
  liveRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  liveDot: {
    width: 7, height: 7, borderRadius: 4, marginRight: 7,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 6, elevation: 4,
  },
  liveLabel: { color: G.muted, fontSize: 9, fontWeight: '900', letterSpacing: 3 },
  clock: { color: G.white, fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  kitchenName: { color: G.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginTop: 3, textTransform: 'uppercase' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pill: {
    paddingHorizontal: 16, height: 40, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  pillText: { fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  iconBtn: {
    width: 44, height: 44, backgroundColor: G.faint, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: G.border,
  },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: 8 },

  statsRow: {
    flexDirection: 'row', marginHorizontal: 20, marginBottom: 8,
    backgroundColor: G.card, borderRadius: 20, borderWidth: 1, borderColor: G.border,
    overflow: 'hidden',
  },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: 20 },
  statMiddle: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: G.border },
  statNum: { color: G.muted, fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  statLabel: { color: G.muted, fontSize: 8, fontWeight: '900', letterSpacing: 3, marginTop: 2 },

  section: { marginTop: 28, paddingHorizontal: 20 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  sectionLabel: { color: G.muted, fontSize: 9, fontWeight: '900', letterSpacing: 4, marginBottom: 14 },
  countBadge: {
    marginLeft: 10, marginBottom: 14, backgroundColor: G.red, borderRadius: 10,
    minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  countBadgeText: { color: '#fff', fontSize: 11, fontWeight: '900' },

  chipScroll: { gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: G.faint, borderRadius: 12, borderWidth: 1, borderColor: G.border,
  },
  chipOff: { backgroundColor: G.redBg, borderColor: G.redBorder },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { color: G.dim, fontSize: 11, fontWeight: '700' },

  emptyCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: G.faint, borderRadius: 18, borderWidth: 1, borderColor: G.border,
    paddingHorizontal: 20, paddingVertical: 20,
  },
  emptyText: { color: G.muted, fontSize: 13, fontWeight: '700' },

  newCard: {
    backgroundColor: G.card, borderRadius: 24, padding: 20, marginRight: 14,
    borderWidth: 1, borderColor: G.border, width: 270,
  },
  newCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  newCardId: { color: G.white, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  ageChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: G.amberBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: G.amberBorder,
  },
  ageText: { color: G.amber, fontSize: 10, fontWeight: '900' },
  newCardItems: { marginBottom: 14, minHeight: 70 },
  newItemRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 6, gap: 8 },
  newItemQty: { color: G.green, fontSize: 16, fontWeight: '900', width: 24 },
  newItemName: { color: G.dim, fontSize: 14, fontWeight: '600', flex: 1 },
  newNoteBox: {
    backgroundColor: G.redBg, borderRadius: 10, borderWidth: 1, borderColor: G.redBorder,
    padding: 10, marginBottom: 14,
  },
  newNoteText: { color: G.red, fontSize: 11, fontWeight: '600', lineHeight: 16 },
  acceptBtn: {
    backgroundColor: G.green, borderRadius: 14, height: 52,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  acceptBtnText: { color: '#000', fontSize: 12, fontWeight: '900', letterSpacing: 2 },

  activeCard: {
    backgroundColor: G.card, borderRadius: 24, padding: 22,
    marginBottom: 16, borderWidth: 1, borderColor: G.border,
  },
  activeCardReady: { borderColor: G.greenBorder },
  activeTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  activeId: { color: G.white, fontSize: 28, fontWeight: '900', letterSpacing: -1, marginBottom: 8 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1,
    alignSelf: 'flex-start',
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  ageChipDark: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ageTextDark: { color: G.muted, fontSize: 11, fontWeight: '700' },
  divider: { height: 1, backgroundColor: G.faint, marginVertical: 16 },
  itemsList: { gap: 10, marginBottom: 16 },
  activeItemRow: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  activeItemQty: {
    color: G.white, fontSize: 22, fontWeight: '900', width: 28,
    letterSpacing: -0.5,
  },
  activeItemName: { color: G.dim, fontSize: 16, fontWeight: '600', flex: 1 },
  alertBox: {
    backgroundColor: G.redBg, borderRadius: 14, borderWidth: 1, borderColor: G.redBorder,
    padding: 14, marginBottom: 16,
  },
  alertLabel: { color: G.red, fontSize: 8, fontWeight: '900', letterSpacing: 3, marginBottom: 4 },
  alertText: { color: G.white, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  readyBtn: {
    backgroundColor: G.green, borderRadius: 16, height: 56,
    alignItems: 'center', justifyContent: 'center',
  },
  readyBtnText: { color: '#000', fontSize: 13, fontWeight: '900', letterSpacing: 2 },
  waitingBar: {
    height: 56, borderRadius: 16, borderWidth: 1, borderColor: G.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: G.faint,
  },
  waitingText: { color: G.muted, fontSize: 10, fontWeight: '900', letterSpacing: 3 },
});

export default KitchenBoardScreen;
