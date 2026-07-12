import React, { useEffect } from 'react';
import { DimensionValue, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/spacing';

// ── Base shimmer box ──────────────────────────────────────────────────────────
interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%', height = 16, borderRadius = radius.sm, style,
}) => {
  const opacity = useSharedValue(0.35);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.75, { duration: 900 }), -1, true);
  }, [opacity]);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[{ width, height, borderRadius, backgroundColor: colors.surfaceMuted }, animStyle, style]}
    />
  );
};

// ── Original SkeletonRow (image + text lines) ─────────────────────────────────
interface SkeletonRowProps { imageSize?: number }
export const SkeletonRow: React.FC<SkeletonRowProps> = ({ imageSize = 100 }) => (
  <View style={s.row}>
    <Skeleton width={imageSize} height={imageSize} borderRadius={radius.lg} />
    <View style={s.col}>
      <Skeleton width="70%" height={16} style={s.gapSm} />
      <Skeleton width="40%" height={13} style={s.gapMd} />
      <Skeleton width="90%" height={10} style={s.gapXs} />
      <Skeleton width="60%" height={10} />
    </View>
  </View>
);

// ── Generic list item (two text lines + optional left box) ────────────────────
export const SkeletonListItem: React.FC<{ avatar?: boolean }> = ({ avatar = false }) => (
  <View style={s.listItem}>
    {avatar && <Skeleton width={44} height={44} borderRadius={22} style={s.avatar} />}
    <View style={s.listLines}>
      <Skeleton width="65%" height={14} style={s.mb8} />
      <Skeleton width="40%" height={11} />
    </View>
    <Skeleton width={48} height={14} borderRadius={6} />
  </View>
);

// ── Order card (used in RiderHome, OrderHistory, Kitchen) ─────────────────────
export const SkeletonOrderCard: React.FC = () => (
  <View style={s.orderCard}>
    <View style={s.orderCardTop}>
      <Skeleton width={36} height={36} borderRadius={10} />
      <View style={s.orderCardMid}>
        <Skeleton width="55%" height={14} style={s.mb6} />
        <Skeleton width="35%" height={11} />
      </View>
      <Skeleton width={52} height={20} borderRadius={8} />
    </View>
    <View style={s.orderCardDivider} />
    <View style={s.orderCardBottom}>
      <Skeleton width="45%" height={11} />
      <Skeleton width="30%" height={11} />
    </View>
  </View>
);

// ── Stat card (used in Earnings, Dashboard, Wallet) ───────────────────────────
export const SkeletonStatCard: React.FC = () => (
  <View style={s.statCard}>
    <Skeleton width={36} height={36} borderRadius={10} style={s.mb12} />
    <Skeleton width="60%" height={22} style={s.mb6} />
    <Skeleton width="80%" height={11} />
  </View>
);

// ── Stat row (horizontal: icon + label + value) ───────────────────────────────
export const SkeletonStatRow: React.FC = () => (
  <View style={s.statRow}>
    <Skeleton width={40} height={40} borderRadius={10} />
    <View style={s.statRowText}>
      <Skeleton width="50%" height={13} style={s.mb6} />
      <Skeleton width="30%" height={11} />
    </View>
    <Skeleton width={56} height={18} borderRadius={8} />
  </View>
);

// ── Notification item ─────────────────────────────────────────────────────────
export const SkeletonNotification: React.FC = () => (
  <View style={s.notification}>
    <Skeleton width={40} height={40} borderRadius={20} style={s.mr12} />
    <View style={{ flex: 1 }}>
      <Skeleton width="75%" height={13} style={s.mb6} />
      <Skeleton width="55%" height={11} style={s.mb4} />
      <Skeleton width="30%" height={10} />
    </View>
  </View>
);

// ── Full-screen list skeleton — renders N copies of a given skeleton ───────────
interface SkeletonListProps {
  count?: number;
  item?: React.ReactNode;
  gap?: number;
}
export const SkeletonScreenList: React.FC<SkeletonListProps> = ({
  count = 5, item = <SkeletonListItem />, gap = 12,
}) => (
  <View style={[s.screenList, { gap }]}>
    {Array.from({ length: count }).map((_, i) => (
      <React.Fragment key={i}>{item}</React.Fragment>
    ))}
  </View>
);

// ── Dashboard stats row ───────────────────────────────────────────────────────
export const SkeletonDashboard: React.FC = () => (
  <View style={s.dashPad}>
    <View style={s.dashStatRow}>
      {[1, 2, 3].map(i => <View key={i} style={s.dashStat}><SkeletonStatCard /></View>)}
    </View>
    <Skeleton width="100%" height={1} style={s.dashDivider} />
    {[1, 2, 3, 4].map(i => <SkeletonOrderCard key={i} />)}
  </View>
);

const s = StyleSheet.create({
  // SkeletonRow
  row: { flexDirection: 'row', paddingVertical: 12 },
  col: { flex: 1, marginLeft: 16, justifyContent: 'center' },
  gapSm: { marginBottom: 8 },
  gapMd: { marginBottom: 12 },
  gapXs: { marginBottom: 4 },

  // SkeletonListItem
  listItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#F0F0F0',
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  avatar: { marginRight: 12 },
  listLines: { flex: 1, marginRight: 12 },
  mb8: { marginBottom: 8 },

  // SkeletonOrderCard
  orderCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#F0F0F0',
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  orderCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  orderCardMid: { flex: 1 },
  mb6: { marginBottom: 6 },
  orderCardDivider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 10 },
  orderCardBottom: { flexDirection: 'row', justifyContent: 'space-between' },

  // SkeletonStatCard
  statCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#F0F0F0',
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  mb12: { marginBottom: 12 },

  // SkeletonStatRow
  statRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#F0F0F0', gap: 12,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  statRowText: { flex: 1 },

  // SkeletonNotification
  notification: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#F0F0F0',
  },
  mr12: { marginRight: 12 },
  mb4: { marginBottom: 4 },

  // SkeletonScreenList
  screenList: { paddingHorizontal: 16, paddingTop: 16 },

  // SkeletonDashboard
  dashPad: { padding: 16, gap: 12 },
  dashStatRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  dashStat: { flex: 1 },
  dashDivider: { opacity: 0.4, marginVertical: 4 },
});
