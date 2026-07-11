import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StatusBar, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { ArrowLeft, Package, IndianRupee, CheckCircle2, XCircle, Navigation } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const R = {
  orange: '#FC4603', orangeLight: '#FFF0E8',
  green: '#1BA672', greenLight: '#E8F8F1',
  red: '#EF4444', redLight: '#FEF2F2',
  amber: '#F59E0B', amberLight: 'rgba(245,158,11,0.1)',
  blue: '#3B82F6', blueLight: '#EFF6FF',
  ink: '#1A1F1C', gray: '#6B7570', muted: '#9CA3A0',
  border: '#E5E7EB', bg: '#F8F9FA', white: '#FFFFFF',
};

const TABS = ['All', 'Delivered', 'Cancelled'] as const;

function groupByDate(orders: any[]): { label: string; key: string; orders: any[] }[] {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const todayStr = today.toDateString();
  const yesterdayStr = yesterday.toDateString();

  const map: Record<string, any[]> = {};
  for (const o of orders) {
    const key = new Date(o.created_at).toDateString();
    if (!map[key]) map[key] = [];
    map[key].push(o);
  }

  return Object.keys(map)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
    .map(key => {
      let label: string;
      if (key === todayStr) label = 'Today';
      else if (key === yesterdayStr) label = 'Yesterday';
      else label = new Date(key).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short',
        ...(new Date(key).getFullYear() !== today.getFullYear() && { year: 'numeric' }),
      });
      return { label, key, orders: map[key] };
    });
}

const RiderHistoryScreen = ({ navigation }: any) => {
  const [tab, setTab] = useState<typeof TABS[number]>('All');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['rider-order-history'],
    queryFn: () => api.get('/riders/orders/history'),
  });

  const allOrders = data?.orders || [];

  const completed = allOrders.filter((o: any) => o.status === 'delivered');
  const totalEarningsPaise = completed.reduce((s: number, o: any) => s + (o.earnings_paise || 0), 0);
  const totalDistanceKm = completed.reduce((s: number, o: any) => s + (o.distance_km || 0), 0);

  const shown = tab === 'All' ? allOrders
    : tab === 'Delivered' ? allOrders.filter((o: any) => o.status === 'delivered')
    : allOrders.filter((o: any) => o.status === 'cancelled');

  const groups = groupByDate(shown);

  if (isLoading) return (
    <View style={s.loadingWrap}>
      <ActivityIndicator size="large" color={R.orange} />
    </View>
  );

  if (isError) return (
    <View style={s.loadingWrap}>
      <Package size={40} color={R.border} />
      <Text style={[s.emptyTitle, { marginTop: 16 }]}>Couldn't load history</Text>
      <TouchableOpacity onPress={() => refetch()} style={{ marginTop: 12, backgroundColor: R.orange, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }} activeOpacity={0.85}>
        <Text style={{ color: R.white, fontWeight: '700', fontSize: 14 }}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={R.white} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <ArrowLeft size={20} color={R.ink} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Order History</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          
          {/* Vibrant Compact Stats */}
          <View style={s.statsWrapper}>
            <View style={s.statCard}>
              <View style={[s.statIconBox, { backgroundColor: R.greenLight }]}>
                <Package size={16} color={R.green} />
              </View>
              <View>
                <Text style={s.statVal}>{completed.length}</Text>
                <Text style={s.statLbl}>Delivered</Text>
              </View>
            </View>
            
            <View style={s.statCard}>
              <View style={[s.statIconBox, { backgroundColor: R.greenLight }]}>
                <IndianRupee size={16} color={R.green} />
              </View>
              <View>
                <Text style={[s.statVal, { color: R.green }]}>₹{(totalEarningsPaise / 100).toFixed(0)}</Text>
                <Text style={s.statLbl}>Earned</Text>
              </View>
            </View>

            <View style={s.statCard}>
              <View style={[s.statIconBox, { backgroundColor: R.blueLight }]}>
                <Navigation size={16} color={R.blue} />
              </View>
              <View>
                <Text style={s.statVal}>{totalDistanceKm.toFixed(1)} <Text style={{fontSize: 12}}>km</Text></Text>
                <Text style={s.statLbl}>Distance</Text>
              </View>
            </View>
          </View>

          {/* Tabs */}
          <View style={s.tabRow}>
            {TABS.map(t => (
              <TouchableOpacity
                key={t}
                style={[s.tab, tab === t && s.tabActive]}
                onPress={() => setTab(t)}
                activeOpacity={0.8}
              >
                <Text style={[s.tabText, tab === t && s.tabTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* List — grouped by date */}
          <View style={s.list}>
            {shown.length === 0 ? (
              <View style={s.empty}>
                <Package size={40} color={R.border} />
                <Text style={s.emptyTitle}>No orders here</Text>
                <Text style={s.emptyText}>Your {tab.toLowerCase()} orders will appear here</Text>
              </View>
            ) : groups.map(group => (
              <View key={group.key}>
                {/* Date header */}
                <View style={s.dateHeader}>
                  <Text style={s.dateHeaderText}>{group.label}</Text>
                  <Text style={s.dateHeaderCount}>{group.orders.length} order{group.orders.length !== 1 ? 's' : ''}</Text>
                </View>

                {group.orders.map((order: any) => {
                  const isDelivered = order.status === 'delivered';
                  const earningsPaise: number | null = isDelivered ? (order.earnings_paise ?? null) : null;
                  const timeStr = new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  return (
                    <View key={order.id} style={s.listItem}>
                      <View style={s.itemTopRow}>
                        <View style={s.itemTopLeft}>
                          <View style={[s.iconBox, { backgroundColor: isDelivered ? R.greenLight : R.redLight }]}>
                            {isDelivered ? <CheckCircle2 size={16} color={R.green} /> : <XCircle size={16} color={R.red} />}
                          </View>
                          <View>
                            <Text style={s.orderId}>{order.display_id}</Text>
                            <Text style={s.timeText}>{timeStr}</Text>
                          </View>
                        </View>
                        <View style={s.itemTopRight}>
                          {isDelivered ? (
                            <Text style={s.earnText}>₹{((earningsPaise ?? 0) / 100).toFixed(0)}</Text>
                          ) : (
                            <Text style={s.cancelText}>Cancelled</Text>
                          )}
                        </View>
                      </View>

                      {isDelivered && (
                        <View style={s.tagsRow}>
                          {order.distance_km != null && (
                            <View style={[s.tag, { backgroundColor: R.blueLight }]}>
                              <Navigation size={12} color={R.blue} />
                              <Text style={[s.tagText, { color: R.blue }]}>{order.distance_km < 1 ? `${Math.round(order.distance_km * 1000)}m` : `${order.distance_km.toFixed(1)}km`}</Text>
                            </View>
                          )}
                          {order.payment_method?.toLowerCase() === 'cod' ? (
                            <View style={[s.tag, { backgroundColor: R.orangeLight }]}>
                              <Text style={[s.tagText, { color: R.orange }]}>COD</Text>
                            </View>
                          ) : (
                            <View style={[s.tag, { backgroundColor: R.greenLight }]}>
                              <Text style={[s.tagText, { color: R.green }]}>Online</Text>
                            </View>
                          )}
                          {parseInt(order.rider_tip_paise || '0') > 0 && (
                            <View style={[s.tag, { backgroundColor: R.amberLight }]}>
                              <Text style={[s.tagText, { color: R.amber }]}>+₹{(parseInt(order.rider_tip_paise) / 100).toFixed(0)} Tip</Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: R.bg },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: R.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: R.white,
    borderBottomWidth: 1, borderBottomColor: R.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: R.ink },

  statsWrapper: {
    flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 16, marginBottom: 16,
  },
  statCard: {
    flex: 1, backgroundColor: R.white, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: R.border, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, elevation: 1,
    flexDirection: 'column', gap: 8,
  },
  statIconBox: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statVal: { fontSize: 16, fontWeight: '800', color: R.ink },
  statLbl: { fontSize: 11, fontWeight: '600', color: R.gray, marginTop: 2 },

  tabRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  tab: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: R.white, borderWidth: 1, borderColor: R.border,
  },
  tabActive: { backgroundColor: R.orange, borderColor: R.orange },
  tabText: { fontSize: 13, fontWeight: '600', color: R.gray },
  tabTextActive: { color: R.white, fontWeight: '700' },

  list: { paddingHorizontal: 16, gap: 12 },

  dateHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, paddingHorizontal: 4, marginBottom: 4,
  },
  dateHeaderText: { fontSize: 13, fontWeight: '800', color: R.ink, letterSpacing: 0.2 },
  dateHeaderCount: { fontSize: 11, fontWeight: '600', color: R.muted },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: R.ink, marginTop: 16 },
  emptyText: { fontSize: 13, color: R.muted, marginTop: 4 },

  listItem: {
    backgroundColor: R.white, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: R.border,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 2,
  },
  itemTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  itemTopLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
  },
  orderId: { fontSize: 15, fontWeight: '800', color: R.ink, marginBottom: 2 },
  timeText: { fontSize: 12, color: R.gray, fontWeight: '500' },
  
  itemTopRight: { alignItems: 'flex-end', justifyContent: 'center' },
  earnText: { fontSize: 18, fontWeight: '900', color: R.green },
  cancelText: { fontSize: 13, fontWeight: '700', color: R.red },

  
  tagsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', borderTopWidth: 1, borderTopColor: R.border, paddingTop: 12 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  tagText: { fontSize: 12, fontWeight: '700' },
});

export default RiderHistoryScreen;
