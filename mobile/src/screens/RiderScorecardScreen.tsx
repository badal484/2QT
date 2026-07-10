import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, StatusBar, ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BouncingButton } from '../components/ui/BouncingButton';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  ArrowLeft, TrendingUp, TrendingDown, Package,
  IndianRupee, Star, CheckCircle2, Flame, Award,
} from 'lucide-react-native';

const R = {
  orange: '#FC8019', orangeLight: '#FFF3E8',
  green: '#1BA672', greenLight: '#E8F8F1',
  red: '#EF4444', redLight: '#FEF2F2',
  amber: '#F59E0B', amberLight: 'rgba(245,158,11,0.1)',
  ink: '#282C3F', gray: '#686B78', muted: '#93959F',
  border: '#E9E9EB', bg: '#F8F8F8', white: '#FFFFFF',
};

const StatCard = ({ icon, label, value, sub, color = R.ink, bg = R.bg, delay = 0 }: any) => (
  <Animated.View entering={FadeInDown.delay(delay).duration(300)} style={[s.statCard, { backgroundColor: bg }]}>
    <View style={[s.statIcon, { backgroundColor: color + '18' }]}>{icon}</View>
    <Text style={[s.statVal, { color }]}>{value}</Text>
    <Text style={s.statLabel}>{label}</Text>
    {sub ? <Text style={s.statSub}>{sub}</Text> : null}
  </Animated.View>
);

const RiderScorecardScreen = ({ navigation }: any) => {
  const { data, isLoading } = useQuery({
    queryKey: ['rider-scorecard'],
    queryFn: () => api.get('/riders/scorecard'),
  });

  const tw = data?.thisWeek;
  const lw = data?.lastWeek;
  const deliveriesChange: number = data?.deliveriesChange ?? 0;
  const earningsChange: number = data?.earningsChange ?? 0;

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={R.white} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* Header */}
        <View style={s.header}>
          <BouncingButton style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <ArrowLeft size={20} color={R.ink} />
          </BouncingButton>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Weekly Scorecard</Text>
            <Text style={s.headerSub}>Your performance this week</Text>
          </View>
        </View>

        {isLoading ? (
          <View style={s.loader}><ActivityIndicator color={R.orange} size="large" /></View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>

            {/* vs Last Week banner */}
            <Animated.View entering={FadeInDown.duration(300)} style={s.vsBanner}>
              <Text style={s.vsBannerLabel}>vs last week</Text>
              <View style={s.vsRow}>
                <View style={s.vsItem}>
                  {deliveriesChange >= 0
                    ? <TrendingUp size={14} color={R.green} />
                    : <TrendingDown size={14} color={R.red} />}
                  <Text style={[s.vsVal, { color: deliveriesChange >= 0 ? R.green : R.red }]}>
                    {deliveriesChange >= 0 ? '+' : ''}{deliveriesChange}% trips
                  </Text>
                </View>
                <View style={s.vsDivider} />
                <View style={s.vsItem}>
                  {earningsChange >= 0
                    ? <TrendingUp size={14} color={R.green} />
                    : <TrendingDown size={14} color={R.red} />}
                  <Text style={[s.vsVal, { color: earningsChange >= 0 ? R.green : R.red }]}>
                    {earningsChange >= 0 ? '+' : ''}{earningsChange}% earnings
                  </Text>
                </View>
              </View>
            </Animated.View>

            {/* Main stats grid */}
            <View style={s.grid}>
              <StatCard
                delay={50}
                icon={<Package size={18} color={R.orange} />}
                label="Deliveries"
                value={tw?.deliveries ?? 0}
                sub={`Last week: ${lw?.deliveries ?? 0}`}
                color={R.orange}
                bg={R.orangeLight}
              />
              <StatCard
                delay={100}
                icon={<IndianRupee size={18} color={R.green} />}
                label="Earnings"
                value={`₹${((tw?.earningsPaise ?? 0) / 100).toFixed(0)}`}
                sub={`Last week: ₹${((lw?.earningsPaise ?? 0) / 100).toFixed(0)}`}
                color={R.green}
                bg={R.greenLight}
              />
              <StatCard
                delay={150}
                icon={<Star size={18} color={R.amber} />}
                label="Avg Rating"
                value={`${(tw?.avgRating ?? 5.0).toFixed(1)}★`}
                color={R.amber}
                bg={R.amberLight}
              />
              <StatCard
                delay={200}
                icon={<CheckCircle2 size={18} color={R.green} />}
                label="Acceptance"
                value={`${tw?.acceptanceRate ?? 100}%`}
                sub={(tw?.acceptanceRate ?? 100) >= 80 ? '✓ Healthy' : '⚠ Low'}
                color={(tw?.acceptanceRate ?? 100) >= 80 ? R.green : R.red}
                bg={(tw?.acceptanceRate ?? 100) >= 80 ? R.greenLight : R.redLight}
              />
            </View>

            {/* Bonus earned */}
            {(tw?.bonusPaise ?? 0) > 0 && (
              <Animated.View entering={FadeInDown.delay(250).duration(300)} style={s.bonusCard}>
                <Award size={20} color={R.amber} />
                <View style={{ flex: 1 }}>
                  <Text style={s.bonusTitle}>Mission & Streak Bonuses</Text>
                  <Text style={s.bonusSub}>You earned extra this week</Text>
                </View>
                <Text style={s.bonusAmt}>+₹{((tw.bonusPaise) / 100).toFixed(0)}</Text>
              </Animated.View>
            )}

            {/* Best day */}
            {tw?.bestDay && (
              <Animated.View entering={FadeInDown.delay(300).duration(300)} style={s.bestDayCard}>
                <View style={s.bestDayHeader}>
                  <Flame size={16} color={R.orange} />
                  <Text style={s.bestDayTitle}>Best Day This Week</Text>
                </View>
                <View style={s.bestDayRow}>
                  <Text style={s.bestDayDate}>
                    {new Date(tw.bestDay.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
                  </Text>
                  <View style={s.bestDayStats}>
                    <Text style={s.bestDayStat}>{tw.bestDay.deliveries_count} trips</Text>
                    <Text style={s.bestDayStat}>₹{(parseInt(tw.bestDay.total_paise) / 100).toFixed(0)} earned</Text>
                  </View>
                </View>
              </Animated.View>
            )}

            {/* Tips on acceptance rate */}
            {(tw?.acceptanceRate ?? 100) < 80 && (
              <Animated.View entering={FadeInDown.delay(350).duration(300)} style={s.tipCard}>
                <Text style={s.tipTitle}>⚠️ Low Acceptance Rate</Text>
                <Text style={s.tipBody}>
                  Your acceptance rate is below 80% this week. Riders with consistently low acceptance may receive fewer order assignments or be temporarily suspended after warnings.
                </Text>
              </Animated.View>
            )}

          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
};

export default RiderScorecardScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: R.bg },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 14,
    backgroundColor: R.white, borderBottomWidth: 1, borderBottomColor: R.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: R.bg, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: R.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '900', color: R.ink },
  headerSub: { fontSize: 12, color: R.muted, marginTop: 2 },

  vsBanner: {
    backgroundColor: R.white, borderRadius: 16, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: R.border,
  },
  vsBannerLabel: { fontSize: 10, fontWeight: '700', color: R.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  vsRow: { flexDirection: 'row', alignItems: 'center' },
  vsItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  vsVal: { fontSize: 14, fontWeight: '700' },
  vsDivider: { width: 1, height: 20, backgroundColor: R.border, marginHorizontal: 12 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  statCard: {
    width: '47.5%', borderRadius: 16, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statVal: { fontSize: 22, fontWeight: '900', marginBottom: 2 },
  statLabel: { fontSize: 12, fontWeight: '600', color: R.gray },
  statSub: { fontSize: 11, color: R.muted, marginTop: 4 },

  bonusCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: R.amberLight, borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#FCD34D',
  },
  bonusTitle: { fontSize: 14, fontWeight: '700', color: R.ink },
  bonusSub: { fontSize: 12, color: R.muted, marginTop: 2 },
  bonusAmt: { fontSize: 18, fontWeight: '900', color: R.amber },

  bestDayCard: {
    backgroundColor: R.white, borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: R.border,
  },
  bestDayHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  bestDayTitle: { fontSize: 13, fontWeight: '700', color: R.ink },
  bestDayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bestDayDate: { fontSize: 15, fontWeight: '800', color: R.ink },
  bestDayStats: { alignItems: 'flex-end', gap: 2 },
  bestDayStat: { fontSize: 13, fontWeight: '600', color: R.gray },

  tipCard: {
    backgroundColor: R.redLight, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#FECACA',
  },
  tipTitle: { fontSize: 14, fontWeight: '800', color: R.red, marginBottom: 6 },
  tipBody: { fontSize: 13, color: '#7F1D1D', lineHeight: 20 },
});
