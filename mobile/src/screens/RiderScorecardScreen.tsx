import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, StatusBar, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BouncingButton } from '../components/ui/BouncingButton';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  ArrowLeft, Package, IndianRupee, Star, CheckCircle2,
} from 'lucide-react-native';

const R = {
  orange: '#FC4603', orangeLight: '#FFF0E8',
  green: '#1BA672', greenLight: '#E8F8F1',
  red: '#EF4444', redLight: '#FEF2F2',
  amber: '#F59E0B', amberLight: 'rgba(245,158,11,0.1)',
  ink: '#282C3F', gray: '#686B78', muted: '#93959F',
  border: '#E9E9EB', bg: '#F8F8F8', white: '#FFFFFF',
};

const StatCard = ({ icon, label, value, sub, color = R.ink, delay = 0 }: any) => (
  <Animated.View entering={FadeInDown.delay(delay).duration(300)} style={s.statCard}>
    <View style={s.statCardHeader}>
      <View style={[s.statIcon, { backgroundColor: color + '15' }]}>{icon}</View>
    </View>
    <Text style={s.statVal}>{value}</Text>
    <Text style={s.statLabel}>{label}</Text>
    {sub ? <Text style={s.statSub}>{sub}</Text> : null}
  </Animated.View>
);

const RiderScorecardScreen = ({ navigation }: any) => {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['rider-scorecard'],
    queryFn: () => api.get('/riders/scorecard'),
  });

  const tw = data?.thisWeek;

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
        ) : isError ? (
          <View style={s.loader}>
            <Package size={40} color={R.border} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: R.ink, marginTop: 16 }}>Couldn't load scorecard</Text>
            <TouchableOpacity onPress={() => refetch()} style={{ marginTop: 12, backgroundColor: R.orange, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }} activeOpacity={0.85}>
              <Text style={{ color: R.white, fontWeight: '700', fontSize: 14 }}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>


            {/* Main stats grid */}
            <View style={s.grid}>
              <StatCard
                delay={50}
                icon={<Package size={20} color={R.orange} />}
                label="Deliveries"
                value={tw?.deliveries ?? 0}
                color={R.orange}
              />
              <StatCard
                delay={100}
                icon={<IndianRupee size={20} color={R.green} />}
                label="Earnings"
                value={`₹${((tw?.earningsPaise ?? 0) / 100).toFixed(0)}`}
                color={R.green}
              />
              <StatCard
                delay={150}
                icon={<Star size={20} color={R.amber} />}
                label="Avg Rating"
                value={`${(tw?.avgRating ?? 5.0).toFixed(1)}★`}
                color={R.amber}
              />
              <StatCard
                delay={200}
                icon={<CheckCircle2 size={20} color={R.green} />}
                label="Acceptance"
                value={`${tw?.acceptanceRate ?? 100}%`}
                sub={(tw?.acceptanceRate ?? 100) >= 80 ? 'Healthy' : 'Needs Work'}
                color={(tw?.acceptanceRate ?? 100) >= 80 ? R.green : R.red}
              />
            </View>



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

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  statCard: {
    width: '48%', borderRadius: 24, padding: 18,
    backgroundColor: R.white,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2,
    borderWidth: 1, borderColor: '#F0F0F0',
  },
  statCardHeader: { flexDirection: 'row', marginBottom: 14 },
  statIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  statVal: { fontSize: 28, fontWeight: '800', color: R.ink, marginBottom: 4, letterSpacing: -0.5 },
  statLabel: { fontSize: 13, fontWeight: '600', color: R.gray },
  statSub: { fontSize: 12, fontWeight: '500', color: R.muted, marginTop: 6 },
});
