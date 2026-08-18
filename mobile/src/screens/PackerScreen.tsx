import { tokens } from '../theme/tokens';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, StatusBar, StyleSheet, Alert, RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../store/slices/authSlice';
import { RootState } from '../store';
import { Package, CheckSquare, Square, LogOut, Clock, CheckCircle2 } from 'lucide-react-native';
import { api } from '../api/client';
import { getSocket } from '../socket/client';
import { useFeedback } from '../context/FeedbackContext';

const G = {
  bg: '#070707',
  card: '#111111',
  border: 'rgba(255,255,255,0.07)',
  green: '#00D084',
  greenBg: 'rgba(0,208,132,0.08)',
  greenBorder: 'rgba(0,208,132,0.18)',
  amber: '#F59E0B',
  amberBg: 'rgba(245,158,11,0.08)',
  amberBorder: 'rgba(245,158,11,0.18)',
  white: tokens.colors.surface,
  dim: 'rgba(255,255,255,0.45)',
  muted: 'rgba(255,255,255,0.18)',
  faint: 'rgba(255,255,255,0.05)',
};

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
}

interface Order {
  id: string;
  display_id: string;
  customer_name: string;
  created_at: string;
  items: OrderItem[];
}

const LiveClock = () => {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );
  useEffect(() => {
    const t = setInterval(() => {
      setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 1000);
    return () => clearInterval(t);
  }, []);
  return <Text style={styles.clock}>{time}</Text>;
};

const OrderPackCard = ({ order, onPacked }: { order: Order; onPacked: () => void }) => {
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  const toggle = (idx: number) => {
    setChecked(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const totalItems = order.items.length;
  const checkedCount = order.items.filter((_, idx) => checked[idx]).length;
  const isAllChecked = totalItems > 0 && checkedCount === totalItems;

  const elapsedMins = Math.max(0, Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000));

  return (
    <View style={[styles.card, isAllChecked ? styles.cardReady : null]}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.orderId}>#{order.display_id}</Text>
          <Text style={styles.customerName}>{order.customer_name}</Text>
        </View>
        <View style={styles.badge}>
          <Clock size={12} color={G.amber} />
          <Text style={styles.badgeText}>{elapsedMins}m</Text>
        </View>
      </View>

      {/* Checklist */}
      <View style={styles.itemList}>
        <Text style={styles.checkProgress}>
          {checkedCount}/{totalItems} ITEMS CHECKED
        </Text>

        {order.items.map((item, idx) => {
          const isDone = !!checked[idx];
          const itemKey = `item-${order.id}-${idx}`;
          return (
            <TouchableOpacity
              key={itemKey}
              activeOpacity={0.7}
              onPress={() => toggle(idx)}
              style={[styles.itemRow, isDone ? styles.itemRowChecked : null]}
            >
              {isDone ? (
                <CheckSquare size={20} color={G.green} />
              ) : (
                <Square size={20} color={G.dim} />
              )}
              <Text style={[styles.itemName, isDone ? styles.itemNameChecked : null]}>
                {item.quantity}× {item.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Action Button */}
      <TouchableOpacity
        activeOpacity={0.8}
        disabled={!isAllChecked}
        onPress={onPacked}
        style={[styles.packBtn, isAllChecked ? styles.packBtnActive : styles.packBtnDisabled]}
      >
        <CheckCircle2 size={18} color={isAllChecked ? G.bg : G.muted} />
        <Text style={[styles.packBtnText, isAllChecked ? styles.packBtnTextActive : null]}>
          MARK PACKED
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export const PackerScreen = () => {
  const queryClient = useQueryClient();
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  const { showDialog } = useFeedback();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['packer-orders'],
    queryFn: () => api.get('/kitchen/packer/orders'),
    refetchInterval: 10000,
  });

  const packMutation = useMutation({
    mutationFn: (orderId: string) => api.post(`/kitchen/orders/${orderId}/packed`, {}),
    onSuccess: () => {
      showDialog({ title: 'Success', message: 'Order packed successfully', confirmText: 'Okay', type: 'success' });
      queryClient.invalidateQueries({ queryKey: ['packer-orders'] });
    },
    onError: () => showDialog({ title: 'Error', message: 'Could not mark order as packed. Please try again.', confirmText: 'Okay', type: 'error' }),
  });

  useEffect(() => {
    const onUpdate = () => queryClient.invalidateQueries({ queryKey: ['packer-orders'] });

    const attach = (socket: ReturnType<typeof getSocket>) => {
      if (!socket) return;
      socket.on('order_updated', onUpdate);
      socket.on('new_order', onUpdate);
      socket.on('connect', onUpdate);
    };
    const detach = (socket: ReturnType<typeof getSocket>) => {
      if (!socket) return;
      socket.off('order_updated', onUpdate);
      socket.off('new_order', onUpdate);
      socket.off('connect', onUpdate);
    };

    // getSocket() can still be null on first render here — RootNavigator (this
    // effect's parent) connects the socket in its own effect, which React runs
    // AFTER this one on mount. Without a retry, a null socket on that first
    // check meant this screen's real-time updates never attached for its whole
    // lifetime, silently falling back to the 10s poll only.
    let attachedSocket: ReturnType<typeof getSocket> = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    const tryAttach = () => {
      if (attachedSocket) return;
      const s = getSocket();
      if (s) {
        attach(s);
        attachedSocket = s;
        if (timer) clearInterval(timer);
      }
    };
    tryAttach();
    if (!attachedSocket) timer = setInterval(tryAttach, 1000);

    return () => {
      if (timer) clearInterval(timer);
      detach(attachedSocket);
    };
  }, [queryClient]);

  const orders: Order[] = data?.orders ?? [];

  const handlePack = useCallback((order: Order) => {
    packMutation.mutate(order.id);
  }, [packMutation]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={G.bg} />

      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <View>
            <View style={styles.liveRow}>
              <View style={[styles.liveDot, { backgroundColor: G.amber, shadowColor: G.amber }]} />
              <Text style={styles.liveLabel}>PACKING STATION</Text>
            </View>
            <LiveClock />
            {user?.kitchenName ? (
              <Text style={styles.kitchenName}>{user.kitchenName}</Text>
            ) : null}
          </View>
          <TouchableOpacity style={styles.iconBtn} onPress={() => dispatch(logout())}>
            <LogOut size={20} color={G.muted} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={G.amber} size="large" />
          <Text style={styles.loaderText}>LOADING QUEUE</Text>
        </View>
      ) : orders.length === 0 ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { flexGrow: 1, justifyContent: 'center' }]}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={[G.amber]} tintColor={G.amber} />
          }
        >
          <View style={styles.empty}>
            <Package size={48} color={G.muted} strokeWidth={1.2} />
            <Text style={styles.emptyTitle}>Queue Empty</Text>
            <Text style={styles.emptyBody}>Orders ready to pack will appear here.</Text>
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={[G.amber]} tintColor={G.amber} />
          }
        >
          <View style={styles.queueHeader}>
            <Text style={styles.queueCount}>{orders.length} ORDER{orders.length !== 1 ? 'S' : ''} TO PACK</Text>
          </View>
          {orders.map(order => (
            <OrderPackCard
              key={order.id}
              order={order}
              onPacked={() => handlePack(order)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: G.bg },
  safeTop: { backgroundColor: G.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: G.border,
  },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  liveDot: {
    width: 7, height: 7, borderRadius: 4,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 4, elevation: 4,
  },
  liveLabel: { color: G.amber, fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  clock: { color: G.white, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  kitchenName: { color: G.dim, fontSize: 11, fontWeight: '600', letterSpacing: 1, marginTop: 1 },
  iconBtn: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: G.faint, borderWidth: 1, borderColor: G.border,
    alignItems: 'center', justifyContent: 'center',
  },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loaderText: { color: G.dim, fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyTitle: { color: G.white, fontSize: 18, fontWeight: '800' },
  emptyBody: { color: G.dim, fontSize: 13, textAlign: 'center', maxWidth: 240 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 14 },
  queueHeader: { marginBottom: 6 },
  queueCount: { color: G.amber, fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  // Card
  card: {
    backgroundColor: G.card, borderRadius: 16,
    borderWidth: 1, borderColor: G.amberBorder,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: 16, borderBottomWidth: 1, borderBottomColor: G.border,
  },
  orderId: { color: G.white, fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  customerName: { color: G.dim, fontSize: 12, fontWeight: '600', marginTop: 2 },
  cardReady: { borderColor: G.greenBorder, backgroundColor: G.greenBg },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: G.amberBg, borderWidth: 1, borderColor: G.amberBorder,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20,
  },
  badgeText: { color: G.amber, fontSize: 10, fontWeight: '800' },
  // Items
  itemList: { padding: 16, gap: 10 },
  checkProgress: { color: G.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 2 },
  itemRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: 10, borderRadius: 10,
    backgroundColor: G.faint, borderWidth: 1, borderColor: 'transparent',
  },
  itemRowChecked: {
    backgroundColor: G.greenBg, borderColor: G.greenBorder,
  },
  itemTextWrap: { flex: 1 },
  itemName: { color: G.white, fontSize: 14, fontWeight: '700' },
  itemNameChecked: { color: G.green, textDecorationLine: 'line-through' },
  itemNote: { color: G.amber, fontSize: 11, fontWeight: '500', marginTop: 2 },
  // Pack button
  packBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    margin: 12, marginTop: 4, padding: 14, borderRadius: 12,
    backgroundColor: G.faint, borderWidth: 1, borderColor: G.border,
  },
  packBtnActive: {
    backgroundColor: G.green, borderColor: G.green,
  },
  packBtnDisabled: { opacity: 0.6 },
  packBtnText: { color: G.muted, fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  packBtnTextActive: { color: '#000' },
});

export default PackerScreen;
