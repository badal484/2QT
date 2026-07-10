import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  StatusBar, StyleSheet,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { ArrowLeft, Wallet, Trophy, Clock } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const R = {
  orange: '#FC4603', orangeLight: '#FFF0E8',
  green: '#1BA672', greenLight: '#E8F8F1',
  amber: '#F59E0B', amberLight: '#FFFBEB',
  ink: '#282C3F', gray: '#686B78', muted: '#93959F',
  border: '#E9E9EB', bg: '#F8F8F8', white: '#FFFFFF',
};

const EarningsScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();

  const { data, isLoading } = useQuery({
    queryKey: ['rider-earnings-history'],
    queryFn: () => api.get('/riders/earnings/history'),
  });

  if (isLoading) return (
    <View style={s.loadWrap}>
      <ActivityIndicator size="large" color={R.orange} />
    </View>
  );

  const rawEarnings = data?.earnings || [];
  const totalPaise = rawEarnings.reduce((sum: number, d: any) => sum + parseInt(d.total_paise, 10), 0);
  const totalDeliveries = rawEarnings.reduce((sum: number, d: any) => sum + parseInt(d.deliveries_count, 10), 0);
  const chartData = [...rawEarnings].slice(0, 7).reverse();
  const maxVal = chartData.reduce((m: number, d: any) => Math.max(m, parseInt(d.total_paise, 10)), 0) || 1;
  const dailyAvg = rawEarnings.length > 0 ? totalPaise / rawEarnings.length : 0;

  const weekPaise = rawEarnings.slice(0, 7).reduce((s: number, d: any) => s + parseInt(d.total_paise, 10), 0);
  const prevWeekPaise = rawEarnings.slice(7, 14).reduce((s: number, d: any) => s + parseInt(d.total_paise, 10), 0);
  const weekDeliveries = rawEarnings.slice(0, 7).reduce((s: number, d: any) => s + parseInt(d.deliveries_count, 10), 0);
  const weekPct = prevWeekPaise > 0 ? Math.round(((weekPaise - prevWeekPaise) / prevWeekPaise) * 100) : 0;

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={R.white} />

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <ArrowLeft size={20} color={R.ink} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Earnings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

        {/* Hero card */}
        <View style={s.heroCard}>
          <View style={s.heroTop}>
            <Wallet size={18} color={R.orange} />
            <Text style={s.heroLabel}>TOTAL EARNINGS</Text>
          </View>
          <Text style={s.heroAmount}>₹{(totalPaise / 100).toFixed(2)}</Text>
          <View style={s.heroStats}>
            <View style={s.heroStatItem}>
              <Trophy size={14} color={R.green} />
              <Text style={s.heroStatVal}>{totalDeliveries}</Text>
              <Text style={s.heroStatLbl}>Deliveries</Text>
            </View>
            <View style={s.heroStatDivider} />
            <View style={s.heroStatItem}>
              <Clock size={14} color={R.muted} />
              <Text style={s.heroStatVal}>₹{(dailyAvg / 100).toFixed(0)}</Text>
              <Text style={s.heroStatLbl}>Daily Avg</Text>
            </View>
          </View>
        </View>

        {/* Weekly chart */}
        {chartData.length > 0 && (
          <View style={s.chartCard}>
            <Text style={s.chartTitle}>This Week</Text>
            <View style={s.chartRow}>
              {chartData.map((day: any, idx: number) => {
                const amount = parseInt(day.total_paise, 10);
                const pct = (amount / maxVal) * 100;
                const label = new Date(day.date).toLocaleDateString('en-IN', { weekday: 'short' });
                const isPeak = amount === maxVal && amount > 0;
                return (
                  <View key={idx} style={s.chartCol}>
                    <Text style={[s.chartBarAmt, isPeak && { color: R.orange }]}>
                      {amount > 0 ? `₹${(amount / 100).toFixed(0)}` : ''}
                    </Text>
                    <View style={s.chartTrack}>
                      <View style={[s.chartBar, { height: `${Math.max(6, pct)}%` as any }, isPeak && s.chartBarPeak]} />
                    </View>
                    <Text style={[s.chartLbl, isPeak && { color: R.orange, fontWeight: '700' }]}>{label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Weekly summary */}
        {rawEarnings.length > 0 && (
          <View style={s.weekCard}>
            <View style={s.weekTop}>
              <Trophy size={14} color={R.amber} />
              <Text style={s.weekLabel}>THIS WEEK</Text>
              {weekPct !== 0 && (
                <View style={[s.weekPctBadge, { backgroundColor: weekPct > 0 ? R.greenLight : '#FEF2F2' }]}>
                  <Text style={[s.weekPctText, { color: weekPct > 0 ? R.green : '#EF4444' }]}>
                    {weekPct > 0 ? '+' : ''}{weekPct}%
                  </Text>
                </View>
              )}
            </View>
            <Text style={s.weekAmount}>₹{(weekPaise / 100).toFixed(0)}</Text>
            <Text style={s.weekSub}>{weekDeliveries} deliveries this week</Text>
          </View>
        )}

      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: R.bg },
  loadWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: R.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14, backgroundColor: R.white,
    borderBottomWidth: 1, borderBottomColor: R.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: R.bg,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: R.ink },

  // Hero card
  heroCard: {
    margin: 16, backgroundColor: R.orange, borderRadius: 20, padding: 24,
    shadowColor: R.orange, shadowOpacity: 0.25, shadowRadius: 16, elevation: 6,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  heroLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  heroAmount: { color: R.white, fontSize: 42, fontWeight: '900', letterSpacing: -1, marginBottom: 20 },
  heroStats: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.12)', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  heroStatItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  heroStatDivider: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.25)' },
  heroStatVal: { color: R.white, fontSize: 15, fontWeight: '800' },
  heroStatLbl: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' },

  // Chart
  chartCard: {
    marginHorizontal: 16, marginBottom: 12, backgroundColor: R.white, borderRadius: 20, padding: 20,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  chartTitle: { fontSize: 13, fontWeight: '700', color: R.muted, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', height: 110 },
  chartCol: { flex: 1, alignItems: 'center', gap: 4 },
  chartBarAmt: { fontSize: 8, color: R.muted, fontWeight: '600', height: 12 },
  chartTrack: {
    width: 10, height: 70, backgroundColor: R.bg, borderRadius: 5,
    justifyContent: 'flex-end', overflow: 'hidden',
  },
  chartBar: { width: '100%', backgroundColor: R.border, borderRadius: 5 },
  chartBarPeak: { backgroundColor: R.orange },
  chartLbl: { fontSize: 9, color: R.muted, fontWeight: '600' },

  // Week card
  weekCard: {
    marginHorizontal: 16, marginBottom: 12, backgroundColor: R.amberLight, borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  weekTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  weekLabel: { color: R.amber, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, flex: 1 },
  weekPctBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  weekPctText: { fontSize: 11, fontWeight: '800' },
  weekAmount: { fontSize: 32, fontWeight: '900', color: R.ink, letterSpacing: -1 },
  weekSub: { fontSize: 12, color: R.gray, marginTop: 4 },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, marginBottom: 12, marginTop: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: R.muted, textTransform: 'uppercase', letterSpacing: 0.5 },

  listWrap: { paddingHorizontal: 16, gap: 10 },

  empty: {
    alignItems: 'center', paddingVertical: 60, backgroundColor: R.white,
    borderRadius: 20, margin: 16,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: R.ink, marginTop: 16 },
  emptyText: { fontSize: 13, color: R.muted, marginTop: 4, textAlign: 'center', paddingHorizontal: 24 },

  dayCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: R.white, borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  dayIconWrap: {
    width: 42, height: 42, borderRadius: 12, backgroundColor: R.orangeLight,
    alignItems: 'center', justifyContent: 'center',
  },
  dayInfo: { flex: 1 },
  dayDate: { fontSize: 14, fontWeight: '700', color: R.ink },
  dayMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3, flexWrap: 'wrap' },
  dayMetaText: { fontSize: 11, color: R.muted },
  dayMetaDot: { color: R.border, fontSize: 11 },
  dayAmount: { alignItems: 'flex-end', gap: 4 },
  dayAmountText: { fontSize: 18, fontWeight: '900', color: R.ink },
});

export default EarningsScreen;
