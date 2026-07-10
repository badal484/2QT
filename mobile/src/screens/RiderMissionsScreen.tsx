import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  StyleSheet, StatusBar,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { ArrowLeft, Target, Zap, TrendingUp, CheckCircle, Trophy, Star } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const R = {
  orange: '#FC8019', orangeLight: '#FFF3E8',
  green: '#1BA672', greenLight: '#E8F8F1',
  amber: '#F59E0B', amberLight: '#FFFBEB',
  ink: '#282C3F', gray: '#686B78', muted: '#93959F',
  border: '#E9E9EB', bg: '#F8F8F8', white: '#FFFFFF',
};

interface Mission {
  id: string;
  title: string;
  description: string;
  target: number;
  progress: number;
  bonusPaise: number;
  completed: boolean;
}

interface MissionsData {
  todayDeliveries: number;
  todayEarningsPaise: number;
  weekDeliveries: number;
  weekEarningsPaise: number;
  missions: Mission[];
}

const MissionCard = ({ mission }: { mission: Mission }) => {
  const pct = Math.min(Math.round((mission.progress / mission.target) * 100), 100);
  const bonusRs = (mission.bonusPaise / 100).toFixed(0);
  const isEarnings = mission.id.includes('earn');
  const progressLabel = isEarnings
    ? `₹${Math.floor(mission.progress / 100)} / ₹${Math.floor(mission.target / 100)}`
    : `${mission.progress} / ${mission.target}`;

  return (
    <View style={[mc.card, mission.completed && mc.cardDone]}>
      <View style={mc.top}>
        <View style={[mc.iconWrap, { backgroundColor: mission.completed ? R.greenLight : R.amberLight }]}>
          {mission.completed
            ? <CheckCircle size={18} color={R.green} />
            : <Target size={18} color={R.amber} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={mc.title}>{mission.title}</Text>
          <Text style={mc.desc}>{mission.description}</Text>
        </View>
        <View style={[mc.bonusBadge, { backgroundColor: mission.completed ? R.greenLight : R.amberLight }]}>
          <Star size={11} color={mission.completed ? R.green : R.amber} />
          <Text style={[mc.bonusText, { color: mission.completed ? R.green : R.amber }]}>+₹{bonusRs}</Text>
        </View>
      </View>

      {!mission.completed && (
        <View style={mc.progressWrap}>
          <View style={mc.progressTrack}>
            <View style={[mc.progressFill, { width: `${pct}%` as any }]} />
          </View>
          <Text style={mc.pctLabel}>{pct}%</Text>
        </View>
      )}

      <View style={mc.footer}>
        <Text style={mc.countText}>
          {mission.completed ? '✓ Mission completed!' : progressLabel}
        </Text>
        {mission.completed && (
          <View style={mc.completedBadge}>
            <Text style={mc.completedText}>DONE</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const mc = StyleSheet.create({
  card: {
    backgroundColor: R.white, borderRadius: 16, padding: 16, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    borderWidth: 1, borderColor: R.border,
  },
  cardDone: { borderColor: '#A7F3D0', backgroundColor: '#FAFFFE' },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '700', color: R.ink, marginBottom: 3 },
  desc: { fontSize: 12, color: R.muted, lineHeight: 17 },
  bonusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
  },
  bonusText: { fontSize: 12, fontWeight: '800' },
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: R.bg, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: R.amber, borderRadius: 3 },
  pctLabel: { color: R.muted, fontSize: 11, fontWeight: '700', minWidth: 30, textAlign: 'right' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  countText: { color: R.muted, fontSize: 12 },
  completedBadge: { backgroundColor: R.greenLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  completedText: { color: R.green, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
});

const RiderMissionsScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'daily' | 'weekly'>('daily');

  const { data, isLoading, isError, refetch } = useQuery<MissionsData>({
    queryKey: ['rider-missions'],
    queryFn: () => api.get('/riders/missions/daily'),
    refetchInterval: 60_000,
  });

  const todayRs = ((data?.todayEarningsPaise ?? 0) / 100).toFixed(0);
  const weekRs = ((data?.weekEarningsPaise ?? 0) / 100).toFixed(0);
  const missions = data?.missions ?? [];
  const dailyMissions = missions.filter(m => !m.id.startsWith('week'));
  const weeklyMissions = missions.filter(m => m.id.startsWith('week'));
  const shown = tab === 'daily' ? dailyMissions : weeklyMissions;
  const completed = shown.filter(m => m.completed).length;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={R.white} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <ArrowLeft size={20} color={R.ink} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Daily Missions</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Stats strip */}
      <View style={s.statsRow}>
        <View style={s.statBox}>
          <View style={[s.statIcon, { backgroundColor: R.orangeLight }]}>
            <Zap size={16} color={R.orange} />
          </View>
          <Text style={s.statVal}>₹{todayRs}</Text>
          <Text style={s.statLbl}>Today</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statBox}>
          <View style={[s.statIcon, { backgroundColor: R.greenLight }]}>
            <TrendingUp size={16} color={R.green} />
          </View>
          <Text style={s.statVal}>{data?.todayDeliveries ?? 0}</Text>
          <Text style={s.statLbl}>Deliveries</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statBox}>
          <View style={[s.statIcon, { backgroundColor: R.amberLight }]}>
            <Trophy size={16} color={R.amber} />
          </View>
          <Text style={s.statVal}>₹{weekRs}</Text>
          <Text style={s.statLbl}>This Week</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {(['daily', 'weekly'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[s.tab, tab === t && s.tabActive]}
            onPress={() => setTab(t)}
            activeOpacity={0.8}
          >
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t === 'daily' ? 'Daily' : 'Weekly'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={s.loader}>
          <ActivityIndicator size="large" color={R.orange} />
        </View>
      ) : isError ? (
        <View style={s.loader}>
          <Text style={s.errorText}>Couldn't load missions.</Text>
          <TouchableOpacity onPress={() => refetch()} style={s.retryBtn} activeOpacity={0.8}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {shown.length === 0 ? (
            <View style={s.emptyBox}>
              <View style={s.emptyIconWrap}>
                <CheckCircle size={40} color={R.green} />
              </View>
              <Text style={s.emptyTitle}>All missions complete!</Text>
              <Text style={s.emptySub}>Come back tomorrow for new challenges.</Text>
            </View>
          ) : (
            <>
              <View style={s.progressRow}>
                <Text style={s.progressLabel}>{completed} of {shown.length} completed</Text>
                <View style={s.progressBarWrap}>
                  <View style={[s.progressBarFill, { width: `${(completed / shown.length) * 100}%` as any }]} />
                </View>
              </View>
              {shown.map(m => <MissionCard key={m.id} mission={m} />)}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: R.bg },

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

  statsRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: R.white,
    marginHorizontal: 16, marginVertical: 12, borderRadius: 16,
    paddingVertical: 16, borderWidth: 1, borderColor: R.border,
  },
  statBox: { flex: 1, alignItems: 'center', gap: 6 },
  statIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statDivider: { width: 1, height: 40, backgroundColor: R.border },
  statVal: { color: R.ink, fontSize: 17, fontWeight: '900' },
  statLbl: { color: R.muted, fontSize: 11, fontWeight: '600' },

  tabRow: {
    flexDirection: 'row', marginHorizontal: 16, backgroundColor: R.white,
    borderRadius: 14, padding: 4, borderWidth: 1, borderColor: R.border, marginBottom: 12,
  },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 11, alignItems: 'center' },
  tabActive: { backgroundColor: R.orange },
  tabText: { color: R.muted, fontSize: 13, fontWeight: '700' },
  tabTextActive: { color: R.white },

  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { color: R.muted, fontSize: 14 },
  retryBtn: {
    paddingHorizontal: 24, paddingVertical: 11, borderRadius: 12,
    backgroundColor: R.orangeLight, borderWidth: 1, borderColor: '#FFD5A8',
  },
  retryText: { color: R.orange, fontWeight: '700' },

  scroll: { paddingHorizontal: 16, paddingTop: 4 },

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  progressLabel: { color: R.muted, fontSize: 12, fontWeight: '600' },
  progressBarWrap: {
    flex: 1, height: 5, borderRadius: 3, backgroundColor: R.border, overflow: 'hidden',
  },
  progressBarFill: { height: '100%', backgroundColor: R.orange, borderRadius: 3 },

  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 24, backgroundColor: R.greenLight,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { color: R.ink, fontSize: 20, fontWeight: '900' },
  emptySub: { color: R.muted, fontSize: 14 },
});

export default RiderMissionsScreen;
