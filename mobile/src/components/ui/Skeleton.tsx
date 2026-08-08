import React, { useEffect } from 'react';
import { DimensionValue, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { tokens } from '../../theme/tokens';

// ── Base shimmer box ──────────────────────────────────────────────────────────
interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%', height = 16, borderRadius = tokens.radii.sm, style,
}) => {
  const opacity = useSharedValue(0.35);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.75, { duration: 900 }), -1, true);
  }, [opacity]);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[{ width, height, borderRadius, backgroundColor: tokens.colors.background }, animStyle, style]}
    />
  );
};

// ── Original SkeletonRow (image + text lines) ─────────────────────────────────
interface SkeletonRowProps { imageSize?: number }
export const SkeletonRow: React.FC<SkeletonRowProps> = ({ imageSize = 100 }) => (
  <View style={s.row}>
    <Skeleton width={imageSize} height={imageSize} borderRadius={tokens.radii.lg} />
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
    <Skeleton width={48} height={14} borderRadius={tokens.radii.sm} />
  </View>
);

// ── Order card (used in RiderHome, OrderHistory, Kitchen) ─────────────────────
export const SkeletonOrderCard: React.FC = () => (
  <View style={s.orderCard}>
    <View style={s.orderCardTop}>
      <Skeleton width={36} height={36} borderRadius={tokens.radii.sm} />
      <View style={s.orderCardMid}>
        <Skeleton width="55%" height={14} style={s.mb6} />
        <Skeleton width="35%" height={11} />
      </View>
      <Skeleton width={52} height={20} borderRadius={tokens.radii.sm} />
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
    <Skeleton width={36} height={36} borderRadius={tokens.radii.sm} style={s.mb12} />
    <Skeleton width="60%" height={22} style={s.mb6} />
    <Skeleton width="80%" height={11} />
  </View>
);

// ── Stat row (horizontal: icon + label + value) ───────────────────────────────
export const SkeletonStatRow: React.FC = () => (
  <View style={s.statRow}>
    <Skeleton width={40} height={40} borderRadius={tokens.radii.sm} />
    <View style={s.statRowText}>
      <Skeleton width="50%" height={13} style={s.mb6} />
      <Skeleton width="30%" height={11} />
    </View>
    <Skeleton width={56} height={18} borderRadius={tokens.radii.sm} />
  </View>
);

// ── Notification item ─────────────────────────────────────────────────────────
export const SkeletonNotification: React.FC = () => (
  <View style={s.notification}>
    <Skeleton width={40} height={40} borderRadius={tokens.radii.full} style={s.mr12} />
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
  count = 5, item = <SkeletonListItem />, gap = tokens.spacing.md,
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

const baseCardStyle = {
  backgroundColor: tokens.colors.surface,
  borderRadius: tokens.radii.lg,
  padding: tokens.spacing.md,
  borderWidth: 1.5,
  borderColor: tokens.colors.border,
  shadowColor: tokens.shadows.sm.shadowColor,
  shadowOffset: tokens.shadows.sm.shadowOffset,
  shadowOpacity: tokens.shadows.sm.shadowOpacity,
  shadowRadius: tokens.shadows.sm.shadowRadius,
  elevation: tokens.shadows.sm.elevation,
};

const s = StyleSheet.create({
  // SkeletonRow
  row: { flexDirection: 'row', paddingVertical: tokens.spacing.md },
  col: { flex: 1, marginLeft: tokens.spacing.lg, justifyContent: 'center' },
  gapSm: { marginBottom: tokens.spacing.sm },
  gapMd: { marginBottom: tokens.spacing.md },
  gapXs: { marginBottom: tokens.spacing.xs },

  // SkeletonListItem
  listItem: {
    ...baseCardStyle,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: { marginRight: tokens.spacing.md },
  listLines: { flex: 1, marginRight: tokens.spacing.md },
  mb8: { marginBottom: tokens.spacing.sm },

  // SkeletonOrderCard
  orderCard: {
    ...baseCardStyle,
  },
  orderCardTop: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.md },
  orderCardMid: { flex: 1 },
  mb6: { marginBottom: 6 },
  orderCardDivider: { height: 1, backgroundColor: tokens.colors.border, marginVertical: tokens.spacing.sm },
  orderCardBottom: { flexDirection: 'row', justifyContent: 'space-between' },

  // SkeletonStatCard
  statCard: {
    ...baseCardStyle,
  },
  mb12: { marginBottom: tokens.spacing.md },

  // SkeletonStatRow
  statRow: {
    ...baseCardStyle,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
  },
  statRowText: { flex: 1 },

  // SkeletonNotification
  notification: {
    ...baseCardStyle,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  mr12: { marginRight: tokens.spacing.md },
  mb4: { marginBottom: tokens.spacing.xs },

  // SkeletonScreenList
  screenList: { paddingHorizontal: tokens.spacing.lg, paddingTop: tokens.spacing.lg },

  // SkeletonDashboard
  dashPad: { padding: tokens.spacing.lg, gap: tokens.spacing.md },
  dashStatRow: { flexDirection: 'row', gap: tokens.spacing.sm, marginBottom: tokens.spacing.xs },
  dashStat: { flex: 1 },
  dashDivider: { opacity: 0.4, marginVertical: tokens.spacing.xs },
});
