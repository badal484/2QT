import React, { useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  StyleSheet, StatusBar, RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import {
  ArrowLeft, Zap, TrendingUp, Trophy, Target, Star,
  Flame, CheckCircle, Clock,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const C = {
  orange: '#FC4603', orangeLight: '#FFF0E8', orangeMid: '#FF6B35',
  green: '#1BA672', greenLight: '#E8F5EF',
  amber: '#F59E0B', amberLight: '#FFFBEB',
  purple: '#7C3AED', purpleLight: '#F5F3FF',
  ink: '#111827', gray: '#6B7280', muted: '#9CA3AF',
  border: '#F3F4F6', bg: '#F9FAFB', white: '#FFFFFF',
  card: '#FFFFFF',
};

// Icon map
const ICONS: Record<string, any> = {
  zap: Zap, target: Target, 'trending-up': TrendingUp,
  trophy: Trophy, star: Star, flame: Flame,
};

// Reset time helpers
function getResetLabel(windowType: string): string {
  const now = new Date();
  if (windowType === 'daily') {
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const diffH = Math.ceil((tomorrow.getTime() - now.getTime()) / 3600000);
    return `Resets in ${diffH}h`;
  }
  // weekly — next Monday
  const day = now.getDay();
  const daysToMon = day === 0 ? 1 : 8 - day;
  return `Resets in ${daysToMon}d`;
}

// ─── Tier progress bar ────────────────────────────────────────────────────────
const TierBar = ({ tiers, progress, color }: {
  tiers: Array<{ target: number; reward_paise: number; label: string }>;
  progress: number;
  color: string;
}) => {
  if (!tiers.length) return null;
  const maxTarget = tiers[tiers.length - 1].target;
  const pct = Math.min((progress / maxTarget) * 100, 100);

  return (
    <View style={tb.wrap}>
      {/* Track */}
      <View style={tb.track}>
        <View style={[tb.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
        {/* Tier markers */}
        {tiers.slice(0, -1).map((t, i) => {
          const markerPct = (t.target / maxTarget) * 100;
          const reached   = progress >= t.target;
          return (
            <View key={i} style={[tb.marker, { left: `${markerPct}%` as any }]}>
              <View style={[tb.markerDot, reached && { backgroundColor: color, borderColor: color }]} />
            </View>
          );
        })}
      </View>
      {/* Tier chips */}
      <View style={tb.chipsRow}>
        {tiers.map((t, i) => {
          const reached = progress >= t.target;
          return (
            <View key={i} style={[tb.chip, reached && { backgroundColor: color + '22', borderColor: color }]}>
              <Star size={9} color={reached ? color : C.muted} />
              <Text style={[tb.chipText, reached && { color }]}>
                +₹{(t.reward_paise / 100).toFixed(0)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const tb = StyleSheet.create({
  wrap:      { marginTop: 12, gap: 8 },
  track:     { height: 6, backgroundColor: C.border, borderRadius: 3, position: 'relative', overflow: 'visible' },
  fill:      { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 3 },
  marker:    { position: 'absolute', top: -4, width: 1, alignItems: 'center' },
  markerDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: C.white, borderWidth: 2, borderColor: C.border },
  chipsRow:  { flexDirection: 'row', justifyContent: 'space-around', marginTop: 4 },
  chip:      { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.bg },
  chipText:  { fontSize: 10, fontWeight: '700', color: C.muted },
});

// ─── Single mission card ──────────────────────────────────────────────────────
const MissionCard = ({ m }: { m: any }) => {
  const tiers  = m.tiers || [];
  const isDone = m.status === 'completed';
  const color  = isDone ? C.green : m.color;

  const maxTarget   = tiers[tiers.length - 1]?.target || 1;
  const topTierPct  = Math.min(Math.round((m.progress / maxTarget) * 100), 100);

  const isEarnings    = m.type === 'earnings_amount';
  const progressLabel = isEarnings
    ? `₹${Math.floor(m.progress / 100)} / ₹${Math.floor(maxTarget / 100)}`
    : `${m.progress} / ${maxTarget}`;

  const IconComp = ICONS[m.icon] || Zap;
  const totalBonus = tiers.reduce((s: number, t: any) => s + t.reward_paise, 0);

  return (
    <View style={[mc.card, isDone && mc.cardDone]}>
      {/* Header row */}
      <View style={mc.header}>
        <View style={[mc.iconCircle, { backgroundColor: color + '18' }]}>
          <IconComp size={20} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={mc.title}>{m.title}</Text>
          <Text style={mc.desc}>{m.description}</Text>
        </View>
        {isDone
          ? <View style={mc.doneBadge}><Text style={mc.doneText}>DONE</Text></View>
          : (
            <View style={[mc.bonusBadge, { backgroundColor: color + '15' }]}>
              <Star size={10} color={color} />
              <Text style={[mc.bonusText, { color }]}>+₹{(totalBonus / 100).toFixed(0)}</Text>
            </View>
          )
        }
      </View>

      {/* Tier progress bar */}
      <TierBar tiers={tiers} progress={m.progress} color={color} />

      {/* Progress label + reset */}
      <View style={mc.footer}>
        <Text style={[mc.progress, isDone && { color: C.green }]}>
          {isDone ? '✓ All tiers completed!' : progressLabel}
        </Text>
        <View style={mc.resetRow}>
          <Clock size={10} color={C.muted} />
          <Text style={mc.resetText}>{getResetLabel(m.windowType)}</Text>
        </View>
      </View>

      {/* Tier badge strip */}
      {!isDone && tiers.length > 0 && (
        <View style={mc.tierStrip}>
          {tiers.map((t: any, i: number) => {
            const reached = m.progress >= t.target;
            const current = m.tierReached === i && m.progress < t.target;
            return (
              <View key={i} style={[
                mc.tierPill,
                reached  && { backgroundColor: color, borderColor: color },
                current  && { borderColor: color },
                !reached && !current && { opacity: 0.45 },
              ]}>
                {reached && <CheckCircle size={9} color={C.white} />}
                <Text style={[mc.tierPillText, reached && { color: C.white }]}>
                  {t.label}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

const mc = StyleSheet.create({
  card: {
    backgroundColor: C.card, borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  cardDone:   { borderColor: '#A7F3D0', backgroundColor: '#FAFFFE' },
  header:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconCircle: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  title:      { fontSize: 15, fontWeight: '800', color: C.ink, lineHeight: 20 },
  desc:       { fontSize: 12, color: C.gray, marginTop: 2, lineHeight: 17 },
  doneBadge:  { backgroundColor: C.greenLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  doneText:   { color: C.green, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  bonusBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  bonusText:  { fontSize: 12, fontWeight: '800' },
  footer:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  progress:   { color: C.gray, fontSize: 12, fontWeight: '600' },
  resetRow:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  resetText:  { color: C.muted, fontSize: 10, fontWeight: '600' },
  tierStrip:  { flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap' },
  tierPill:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bg },
  tierPillText: { fontSize: 10, fontWeight: '700', color: C.gray },
});

// ─── Streak card ──────────────────────────────────────────────────────────────
const StreakCard = ({ current, longest }: { current: number; longest: number }) => (
  <View style={sk.card}>
    <View style={sk.left}>
      <Text style={sk.fire}>🔥</Text>
      <View>
        <Text style={sk.count}>{current} day streak</Text>
        <Text style={sk.sub}>Best: {longest} days</Text>
      </View>
    </View>
    <View style={sk.right}>
      {[1, 2, 3, 4, 5, 6, 7].map(d => (
        <View key={d} style={[sk.dot, d <= current % 7 || current >= 7 ? sk.dotActive : null]} />
      ))}
    </View>
  </View>
);

const sk = StyleSheet.create({
  card:      { backgroundColor: '#FFF8F5', borderRadius: 20, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#FFD5B8' },
  left:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fire:      { fontSize: 32 },
  count:     { fontSize: 16, fontWeight: '900', color: C.orange },
  sub:       { fontSize: 11, color: C.gray, marginTop: 2 },
  right:     { flexDirection: 'row', gap: 5 },
  dot:       { width: 10, height: 10, borderRadius: 5, backgroundColor: C.border },
  dotActive: { backgroundColor: C.orange },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
const RiderMissionsScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['rider-missions-v2'],
    queryFn:  () => api.get('/missions/rider'),
    refetchInterval: 5000,
  });

  const onRefresh = useCallback(() => { refetch(); }, [refetch]);

  const missions       = data?.missions ?? [];
  const daily          = missions.filter((m: any) => m.windowType === 'daily');
  const weekly         = missions.filter((m: any) => m.windowType === 'weekly');
  const dailyDone      = daily.filter((m: any)  => m.status === 'completed').length;
  const todayRs        = ((data?.todayEarningsPaise ?? 0) / 100).toFixed(0);
  const weekRs         = ((data?.weekEarningsPaise  ?? 0) / 100).toFixed(0);
  const currentStreak  = data?.currentStreak  ?? 0;
  const longestStreak  = data?.longestStreak  ?? 0;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <ArrowLeft size={20} color={C.ink} />
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>Missions</Text>
          {!isLoading && (
            <Text style={s.headerSub}>{dailyDone}/{daily.length} today · {data?.todayDeliveries ?? 0} deliveries</Text>
          )}
        </View>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={s.loader}><ActivityIndicator size="large" color={C.orange} /></View>
      ) : isError ? (
        <View style={s.loader}>
          <Text style={s.errText}>Couldn't load missions</Text>
          <TouchableOpacity onPress={() => refetch()} style={s.retryBtn} activeOpacity={0.8}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          refreshControl={<RefreshControl refreshing={isFetching} onRefresh={onRefresh} tintColor={C.orange} />}
        >
          {/* Stats strip */}
          <View style={s.statsRow}>
            <View style={s.statBox}>
              <View style={[s.statIcon, { backgroundColor: C.orangeLight }]}><Zap size={16} color={C.orange} /></View>
              <Text style={s.statVal}>₹{todayRs}</Text>
              <Text style={s.statLbl}>Today</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statBox}>
              <View style={[s.statIcon, { backgroundColor: C.greenLight }]}><TrendingUp size={16} color={C.green} /></View>
              <Text style={s.statVal}>{data?.todayDeliveries ?? 0}</Text>
              <Text style={s.statLbl}>Deliveries</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statBox}>
              <View style={[s.statIcon, { backgroundColor: C.amberLight }]}><Trophy size={16} color={C.amber} /></View>
              <Text style={s.statVal}>₹{weekRs}</Text>
              <Text style={s.statLbl}>This Week</Text>
            </View>
          </View>

          {/* Streak */}
          <StreakCard current={currentStreak} longest={longestStreak} />

          {/* Daily missions */}
          {daily.length > 0 && (
            <>
              <View style={s.sectionHeader}>
                <View style={[s.sectionDot, { backgroundColor: C.orange }]} />
                <Text style={s.sectionTitle}>TODAY'S MISSIONS</Text>
                <View style={s.sectionPill}>
                  <Text style={s.sectionPillText}>{dailyDone}/{daily.length}</Text>
                </View>
              </View>
              {daily.map((m: any) => <MissionCard key={m.id} m={m} />)}
            </>
          )}

          {/* Weekly missions */}
          {weekly.length > 0 && (
            <>
              <View style={[s.sectionHeader, { marginTop: 8 }]}>
                <View style={[s.sectionDot, { backgroundColor: C.amber }]} />
                <Text style={s.sectionTitle}>WEEKLY CHALLENGE</Text>
              </View>
              {weekly.map((m: any) => <MissionCard key={m.id} m={m} />)}
            </>
          )}

          {missions.length === 0 && (
            <View style={s.emptyBox}>
              <Text style={s.emptyEmoji}>🎯</Text>
              <Text style={s.emptyTitle}>No missions yet</Text>
              <Text style={s.emptyText}>Your admin will add missions soon. Check back later!</Text>
            </View>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  loader:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  errText: { color: C.muted, fontSize: 14, fontWeight: '600' },
  retryBtn:  { paddingHorizontal: 24, paddingVertical: 11, borderRadius: 14, backgroundColor: C.orangeLight, borderWidth: 1, borderColor: '#FFD5A8' },
  retryText: { color: C.orange, fontWeight: '700', fontSize: 13 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn:    { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  headerTitle:{ fontSize: 18, fontWeight: '900', color: C.ink },
  headerSub:  { fontSize: 11, color: C.muted, marginTop: 2, fontWeight: '600' },

  scroll: { padding: 16, gap: 12 },

  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.white, borderRadius: 20, paddingVertical: 16,
    borderWidth: 1, borderColor: C.border,
  },
  statBox:     { flex: 1, alignItems: 'center', gap: 6 },
  statIcon:    { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statDivider: { width: 1, height: 40, backgroundColor: C.border },
  statVal:     { color: C.ink, fontSize: 17, fontWeight: '900' },
  statLbl:     { color: C.muted, fontSize: 11, fontWeight: '600' },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 4 },
  sectionDot:    { width: 6, height: 6, borderRadius: 3 },
  sectionTitle:  { fontSize: 11, fontWeight: '900', color: C.gray, letterSpacing: 1 },
  sectionPill:   { backgroundColor: C.orangeLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  sectionPillText: { fontSize: 10, fontWeight: '800', color: C.orange },

  emptyBox:  { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyEmoji:{ fontSize: 48 },
  emptyTitle:{ fontSize: 18, fontWeight: '900', color: C.ink },
  emptyText: { fontSize: 13, color: C.muted, textAlign: 'center', paddingHorizontal: 32, lineHeight: 20 },
});

export default RiderMissionsScreen;
