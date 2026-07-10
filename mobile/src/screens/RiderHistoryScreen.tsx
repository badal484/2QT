import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StatusBar, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { ArrowLeft, Package, Clock, IndianRupee, CheckCircle2, XCircle } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const R = {
  orange: '#FC8019', orangeLight: '#FFF3E8',
  green: '#1BA672', greenLight: '#E8F8F1',
  red: '#EF4444', redLight: '#FEF2F2',
  amber: '#F59E0B', amberLight: 'rgba(245,158,11,0.1)',
  ink: '#282C3F', gray: '#686B78', muted: '#93959F',
  border: '#E9E9EB', bg: '#F8F8F8', white: '#FFFFFF',
};

const TABS = ['All', 'Delivered', 'Cancelled'] as const;

const RiderHistoryScreen = ({ navigation }: any) => {
  const [tab, setTab] = useState<typeof TABS[number]>('All');

  const { data, isLoading } = useQuery({
    queryKey: ['rider-order-history'],
    queryFn: () => api.get('/riders/orders/history'),
  });

  const allOrders = data?.orders || [];

  const completed = allOrders.filter((o: any) => o.status === 'delivered');
  const totalTipsPaise = completed.reduce((s: number, o: any) => s + parseInt(o.rider_tip_paise || '0', 10), 0);
  const totalTipsRupees = (totalTipsPaise / 100).toFixed(0);
  const avgMin = completed.length > 0
    ? Math.round(completed.reduce((s: number, o: any) => {
        if (o.delivered_at && o.created_at)
          return s + (new Date(o.delivered_at).getTime() - new Date(o.created_at).getTime()) / 60000;
        return s;
      }, 0) / completed.length)
    : 0;

  const shown = tab === 'All' ? allOrders
    : tab === 'Delivered' ? allOrders.filter((o: any) => o.status === 'delivered')
    : allOrders.filter((o: any) => o.status === 'cancelled');

  if (isLoading) return (
    <View style={s.loadingWrap}>
      <ActivityIndicator size="large" color={R.orange} />
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

          {/* Stats */}
          <View style={s.statsRow}>
            <View style={s.statCard}>
              <View style={[s.statIcon, { backgroundColor: R.greenLight }]}>
                <Package size={18} color={R.green} />
              </View>
              <Text style={s.statVal}>{completed.length}</Text>
              <Text style={s.statLbl}>Delivered</Text>
            </View>
            <View style={s.statCard}>
              <View style={[s.statIcon, { backgroundColor: R.orangeLight }]}>
                <IndianRupee size={18} color={R.orange} />
              </View>
              <Text style={s.statVal}>+₹{totalTipsRupees}</Text>
              <Text style={s.statLbl}>Tips</Text>
            </View>
            <View style={s.statCard}>
              <View style={[s.statIcon, { backgroundColor: '#EFF6FF' }]}>
                <Clock size={18} color="#3B82F6" />
              </View>
              <Text style={s.statVal}>{avgMin}m</Text>
              <Text style={s.statLbl}>Avg Time</Text>
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

          {/* List */}
          <View style={s.list}>
            {shown.length === 0 ? (
              <View style={s.empty}>
                <Package size={40} color={R.border} />
                <Text style={s.emptyTitle}>No orders here</Text>
                <Text style={s.emptyText}>Your {tab.toLowerCase()} orders will appear here</Text>
              </View>
            ) : shown.map((order: any) => {
              const isDelivered = order.status === 'delivered';
              const isCOD = order.payment_method?.toLowerCase() === 'cod';
              const duration = order.delivered_at && order.created_at
                ? Math.round((new Date(order.delivered_at).getTime() - new Date(order.created_at).getTime()) / 60000)
                : null;
              const tipPaise = isDelivered ? parseInt(order.rider_tip_paise || '0', 10) : 0;

              return (
                <View key={order.id} style={s.card}>
                  {/* Top row */}
                  <View style={s.cardTop}>
                    <View>
                      <Text style={s.orderId}>{order.display_id}</Text>
                      <Text style={s.orderDate}>
                        {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        {' · '}
                        {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    <View style={[s.badge, { backgroundColor: isDelivered ? R.greenLight : R.redLight }]}>
                      {isDelivered
                        ? <CheckCircle2 size={12} color={R.green} />
                        : <XCircle size={12} color={R.red} />}
                      <Text style={[s.badgeText, { color: isDelivered ? R.green : R.red }]}>
                        {isDelivered ? 'Delivered' : 'Cancelled'}
                      </Text>
                    </View>
                  </View>

                  {/* Address */}
                  <View style={s.addressRow}>
                    <View style={s.addressDot} />
                    <Text style={s.addressText} numberOfLines={1}>
                      {order.delivery_address_text || 'Customer Location'}
                    </Text>
                  </View>

                  {/* Items */}
                  {order.items?.slice(0, 2).map((item: any, i: number) => (
                    <Text key={i} style={s.itemText} numberOfLines={1}>
                      {item.quantity}× {item.menu_item_name}
                    </Text>
                  ))}
                  {(order.items?.length || 0) > 2 && (
                    <Text style={s.itemMore}>+{order.items.length - 2} more</Text>
                  )}

                  {/* Footer */}
                  <View style={s.cardFooter}>
                    <View style={[s.payBadge, { backgroundColor: isCOD ? R.orangeLight : R.greenLight }]}>
                      <Text style={[s.payText, { color: isCOD ? R.orange : R.green }]}>
                        {isCOD ? 'COD' : 'Online'}
                      </Text>
                    </View>
                    {duration && <Text style={s.durText}><Clock size={11} color={R.muted} /> {duration} min</Text>}
                    {tipPaise > 0 && <Text style={s.tipText}>+₹{(tipPaise / 100).toFixed(0)} tip</Text>}
                  </View>
                </View>
              );
            })}
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
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: R.white,
    borderBottomWidth: 1, borderBottomColor: R.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: R.bg,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: R.ink },

  statsRow: { flexDirection: 'row', gap: 12, padding: 16 },
  statCard: {
    flex: 1, backgroundColor: R.white, borderRadius: 16, padding: 16, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  statIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statVal: { fontSize: 18, fontWeight: '800', color: R.ink },
  statLbl: { fontSize: 11, color: R.muted, fontWeight: '600', marginTop: 2 },

  tabRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 16 },
  tab: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: R.white, borderWidth: 1, borderColor: R.border,
  },
  tabActive: { backgroundColor: R.orange, borderColor: R.orange },
  tabText: { fontSize: 13, fontWeight: '600', color: R.gray },
  tabTextActive: { color: R.white, fontWeight: '700' },

  list: { paddingHorizontal: 16, gap: 12 },

  empty: { alignItems: 'center', paddingVertical: 60, backgroundColor: R.white, borderRadius: 20, marginTop: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: R.ink, marginTop: 16 },
  emptyText: { fontSize: 13, color: R.muted, marginTop: 4 },

  card: {
    backgroundColor: R.white, borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  orderId: { fontSize: 15, fontWeight: '800', color: R.ink },
  orderDate: { fontSize: 12, color: R.muted, marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  addressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: R.orange },
  addressText: { flex: 1, fontSize: 13, color: R.gray },

  itemText: { fontSize: 12, color: R.muted, marginBottom: 2 },
  itemMore: { fontSize: 12, color: R.orange, fontWeight: '600', marginTop: 2 },

  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: R.border },
  payBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  payText: { fontSize: 11, fontWeight: '700' },
  durText: { fontSize: 12, color: R.muted, flex: 1 },
  earnText: { fontSize: 14, fontWeight: '800', color: R.green },
  tipText: { fontSize: 13, fontWeight: '700', color: R.amber },
});

export default RiderHistoryScreen;
