import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, StatusBar, StyleSheet, Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../store/slices/authSlice';
import { RootState } from '../store';
import { Package, CheckSquare, Square, LogOut, Clock, CheckCircle2 } from 'lucide-react-native';
import { api } from '../api/client';
import { getSocket } from '../socket/client';

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
      {t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
    </Text>
  );
}

interface OrderItem { name: string; quantity: number; special_instructions?: string; }
interface Order {
  id: string;
  display_id: string;
  customer_name: string;
  updated_at: string;
  items: OrderItem[];
}

const OrderPackCard = ({ order, onPacked }: { order: Order; onPacked: () => void }) => {
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const totalItems = order.items.reduce((s, i) => s + i.quantity, 0);
  const checkedCount = Object.values(checked).filter(Boolean).length;
  const allChecked = checkedCount >= order.items.length;

  const toggle = (i: number) =>
    setChecked(prev => ({ ...prev, [i]: !prev[i] }));

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.orderId}>#{order.display_id}</Text>
          <Text style={styles.customerName}>{order.customer_name}</Text>
        </View>
        <View style={styles.ageChip}>
          <Clock size={10} color={G.amber} />
          <Text style={styles.ageText}>{elapsed(order.updated_at)}</Text>
        </View>
      </View>

      {/* Item checklist */}
      <View style={styles.itemsSection}>
        <Text style={styles.itemsLabel}>
          {checkedCount}/{order.items.length} ITEMS CHECKED
        </Text>
        {order.items.map((item, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.itemRow, checked[i] && styles.itemRowChecked]}
            onPress={() => toggle(i)}
            activeOpacity={0.7}
          >
            {checked[i]
              ? <CheckSquare size={18} color={G.green} />
              : <Square size={18} color={G.muted} />
            }
            <View style={styles.itemTextWrap}>
              <Text style={[styles.itemName, checked[i] && styles.itemNameChecked]}>
                {item.quantity}× {item.name}
              </Text>
              {!!item.special_instructions && (
                <Text style={styles.itemNote}>{item.special_instructions}</Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Pack button */}
      <TouchableOpacity
        style={[styles.packBtn, allChecked && styles.packBtnReady]}
        onPress={onPacked}
        activeOpacity={0.8}
      >
        <CheckCircle2 size={16} color={allChecked ? '#000' : G.muted} strokeWidth={2.5} />
        <Text style={[styles.packBtnText, allChecked && styles.packBtnTextReady]}>
          {allChecked ? 'MARK PACKED' : `CHECK ALL ITEMS FIRST (${totalItems - checkedCount} left)`}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const PackerScreen = () => {
  const queryClient = useQueryClient();
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['packer-orders'],
    queryFn: () => api.get('/kitchen/packer/orders'),
    refetchInterval: 5000,
  });

  const packMutation = useMutation({
    mutationFn: (orderId: string) => api.post(`/kitchen/orders/${orderId}/packed`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['packer-orders'] }),
    onError: () => Alert.alert('Error', 'Could not mark order as packed. Please try again.'),
  });

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onUpdate = () => queryClient.invalidateQueries({ queryKey: ['packer-orders'] });
    socket.on('order_updated', onUpdate);
    socket.on('new_order', onUpdate);
    return () => {
      socket.off('order_updated', onUpdate);
      socket.off('new_order', onUpdate);
    };
  }, [queryClient]);

  const orders: Order[] = data?.orders ?? [];

  const handlePack = useCallback((order: Order) => {
    Alert.alert(
      'Confirm Pack',
      `Mark order #${order.display_id} as packed and ready for rider?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark Packed', onPress: () => packMutation.mutate(order.id) },
      ]
    );
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
        <View style={styles.empty}>
          <Package size={48} color={G.muted} strokeWidth={1.2} />
          <Text style={styles.emptyTitle}>Queue Empty</Text>
          <Text style={styles.emptyBody}>Orders ready to pack will appear here.</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
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
  ageChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: G.amberBg, borderWidth: 1, borderColor: G.amberBorder,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20,
  },
  ageText: { color: G.amber, fontSize: 10, fontWeight: '800' },
  // Items
  itemsSection: { padding: 16, gap: 10 },
  itemsLabel: { color: G.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 2 },
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
  packBtnReady: {
    backgroundColor: G.green, borderColor: G.green,
  },
  packBtnText: { color: G.muted, fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  packBtnTextReady: { color: '#000' },
});

export default PackerScreen;
