import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  StatusBar, StyleSheet,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { ArrowLeft, Wallet, Trophy, Banknote, CalendarDays } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const R = {
  orange: '#FC4603', orangeLight: '#FFF0E8',
  green: '#1BA672', greenLight: '#E8F8F1',
  amber: '#F59E0B', amberLight: '#FFFBEB',
  ink: '#1A1F1C', gray: '#6B7570', muted: '#9CA3A0',
  border: '#F0F0F0', bg: '#F8F9FA', white: '#FFFFFF',
};

const EarningsScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['rider-earnings-history'],
    queryFn: () => api.get('/riders/earnings/history'),
  });

  if (isLoading) return (
    <View style={s.loadWrap}>
      <ActivityIndicator size="large" color={R.orange} />
    </View>
  );

  if (isError) return (
    <View style={s.loadWrap}>
      <Wallet size={40} color="#E5E7EB" />
      <Text style={{ fontSize: 16, fontWeight: '700', color: R.ink, marginTop: 16 }}>Couldn't load earnings</Text>
      <TouchableOpacity onPress={() => refetch()} style={{ marginTop: 12, backgroundColor: R.orange, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }} activeOpacity={0.85}>
        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );

  const rawEarnings = data?.earnings || [];
  const totalPaise = rawEarnings.reduce((sum: number, d: any) => sum + parseInt(d.total_paise, 10), 0);
  const totalDeliveries = rawEarnings.reduce((sum: number, d: any) => sum + parseInt(d.deliveries_count, 10), 0);
  
  // Sort by date descending
  const sortedEarnings = [...rawEarnings].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  // Chart needs oldest to newest for left-to-right
  const chartData = [...sortedEarnings].slice(0, 7).reverse();
  const maxVal = chartData.reduce((m: number, d: any) => Math.max(m, parseInt(d.total_paise, 10)), 0) || 1;

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={R.bg} />

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <ArrowLeft size={20} color={R.ink} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Earnings</Text>
        <TouchableOpacity
          style={s.payoutBtn}
          onPress={() => navigation.navigate('Payouts')}
          activeOpacity={0.7}
        >
          <Banknote size={18} color={R.orange} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

        {/* Premium Dark Hero Card */}
        <View style={s.heroCard}>
          <View style={s.heroTop}>
            <Text style={s.heroLabel}>Total Earnings</Text>
            <Wallet size={16} color={R.orange} />
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
              <CalendarDays size={14} color={R.muted} />
              <Text style={s.heroStatVal}>{sortedEarnings.length}</Text>
              <Text style={s.heroStatLbl}>Active Days</Text>
            </View>
          </View>
        </View>

        {/* Minimalist Chart */}
        {chartData.length > 0 && (
          <View style={s.chartCard}>
            <Text style={s.chartTitle}>Past 7 Days</Text>
            <View style={s.chartRow}>
              {chartData.map((day: any, idx: number) => {
                const amount = parseInt(day.total_paise, 10);
                const pct = (amount / maxVal) * 100;
                const label = new Date(day.date).toLocaleDateString('en-IN', { weekday: 'short' });
                const isPeak = amount === maxVal && amount > 0;
                return (
                  <View key={idx} style={s.chartCol}>
                    <Text style={[s.chartBarAmt, isPeak && { color: R.ink, fontWeight: '800' }]}>
                      {amount > 0 ? `₹${(amount / 100).toFixed(0)}` : ''}
                    </Text>
                    <View style={s.chartTrack}>
                      <View style={[s.chartBar, { height: `${Math.max(8, pct)}%` as any }, isPeak && s.chartBarPeak]} />
                    </View>
                    <Text style={[s.chartLbl, isPeak && { color: R.ink, fontWeight: '700' }]}>{label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Daily Breakdown List */}
        {sortedEarnings.length > 0 && (
          <View style={s.listContainer}>
            <Text style={s.sectionTitle}>Daily Breakdown</Text>
            <View style={s.listWrap}>
              {sortedEarnings.map((day: any, i: number) => {
                const dateObj = new Date(day.date);
                const isToday = new Date().toDateString() === dateObj.toDateString();
                const displayDate = isToday ? 'Today' : dateObj.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
                
                return (
                  <View key={i} style={s.dayCard}>
                    <View style={s.dayIconWrap}>
                      <CalendarDays size={18} color={R.orange} />
                    </View>
                    <View style={s.dayInfo}>
                      <Text style={s.dayDate}>{displayDate}</Text>
                      <Text style={s.dayMetaText}>{day.deliveries_count} trips</Text>
                    </View>
                    <View style={s.dayAmount}>
                      <Text style={s.dayAmountText}>₹{(parseInt(day.total_paise, 10) / 100).toFixed(0)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
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
    paddingHorizontal: 16, paddingBottom: 14, backgroundColor: R.bg,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#E5E7EB',
  },
  payoutBtn: {
    width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: R.white, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: R.ink },

  // Sleek Dark Hero card
  heroCard: {
    marginHorizontal: 16, marginTop: 4, marginBottom: 16, backgroundColor: R.ink, borderRadius: 24, padding: 24,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  heroLabel: { color: R.muted, fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
  heroAmount: { color: R.white, fontSize: 44, fontWeight: '900', letterSpacing: -1.5, marginBottom: 24 },
  heroStats: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#2A302D', borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  heroStatItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  heroStatDivider: { width: 1, height: 24, backgroundColor: '#3F4643' },
  heroStatVal: { color: R.white, fontSize: 16, fontWeight: '800' },
  heroStatLbl: { color: R.muted, fontSize: 12, fontWeight: '600' },

  // Chart
  chartCard: {
    marginHorizontal: 16, marginBottom: 24, backgroundColor: R.white, borderRadius: 24, padding: 20,
    borderWidth: 1, borderColor: R.border,
  },
  chartTitle: { fontSize: 15, fontWeight: '800', color: R.ink, marginBottom: 20 },
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', height: 120 },
  chartCol: { flex: 1, alignItems: 'center', gap: 6 },
  chartBarAmt: { fontSize: 10, color: R.muted, fontWeight: '600', height: 14 },
  chartTrack: {
    width: 14, height: 80, backgroundColor: '#F3F4F6', borderRadius: 7,
    justifyContent: 'flex-end', overflow: 'hidden',
  },
  chartBar: { width: '100%', backgroundColor: '#D1D5DB', borderRadius: 7 },
  chartBarPeak: { backgroundColor: R.orange },
  chartLbl: { fontSize: 11, color: R.muted, fontWeight: '600' },

  // List
  listContainer: { paddingHorizontal: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: R.ink, marginBottom: 12, marginLeft: 4 },
  listWrap: { gap: 10 },
  dayCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: R.white, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: R.border,
  },
  dayIconWrap: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: R.orangeLight,
    alignItems: 'center', justifyContent: 'center',
  },
  dayInfo: { flex: 1 },
  dayDate: { fontSize: 15, fontWeight: '700', color: R.ink, marginBottom: 2 },
  dayMetaText: { fontSize: 13, color: R.gray, fontWeight: '500' },
  dayAmount: { alignItems: 'flex-end', justifyContent: 'center' },
  dayAmountText: { fontSize: 18, fontWeight: '800', color: R.ink },
});

export default EarningsScreen;
