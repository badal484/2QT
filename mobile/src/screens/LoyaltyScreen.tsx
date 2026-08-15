import { useFocusEffect } from '@react-navigation/native';
import { tokens } from '../theme/tokens';
import { ArrowLeft, Star, Crown, Pizza } from 'lucide-react-native';
import React, { useEffect, useRef } from 'react';
import { PressableScale } from '../components/ui/internal/PressableScale';
import { View, Text, StyleSheet, AppState, FlatList, RefreshControl } from 'react-native';
import { SkeletonScreenList, SkeletonStatCard } from '../components/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

const LoyaltyScreen = ({ navigation }: any) => {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        queryClient.invalidateQueries({ queryKey: ['loyalty'] });
        queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [queryClient]);

  const [refreshing, setRefreshing] = React.useState(false);

  const { data: loyaltyData, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = useInfiniteQuery({
    queryKey: ['loyalty', 'history'],
    queryFn: ({ pageParam = 0 }) => api.get(`/customers/loyalty?offset=${pageParam}&limit=20`),
    initialPageParam: 0,
    getNextPageParam: (lastPage: any, allPages: any) => {
      if (!lastPage || !Array.isArray(lastPage?.history)) return undefined;
      if ((lastPage.history?.length ?? 0) < 20) return undefined;
      return (Array.isArray(allPages) ? allPages.length : 1) * 20;
    },
  });

  useFocusEffect(
    React.useCallback(() => {
      refetch();
    }, [refetch])
  );

  const loyalty = loyaltyData?.pages?.[0];
  const history = Array.isArray(loyaltyData?.pages)
    ? loyaltyData.pages.flatMap((p: any) => (Array.isArray(p?.history) ? p.history : []))
    : [];

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);



  if (isLoading) return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 16, 48) }]}>
        <PressableScale onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={24} color={tokens.colors.textPrimary} />
        </PressableScale>
      </View>
      <SkeletonScreenList item={<SkeletonStatCard />} count={4} />
    </View>
  );

  const points = loyalty?.points || 0;
  const progress = (points % 1000) / 1000;
  const tier = points >= 5000 ? 'Platinum' : points >= 2000 ? 'Gold' : points >= 1000 ? 'Silver' : 'Bronze';

  return (
    <View style={styles.container}>
      {/* Header Card */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 16, 48) }]}>
        <PressableScale onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={24} color={tokens.colors.textPrimary} />
        </PressableScale>
        
        <View style={styles.headerContentRow}>
          <View>
            <Text allowFontScaling={false} style={styles.tierText}>2QT {tier}</Text>
            <Text allowFontScaling={false} style={styles.pointsValue}>{points}</Text>
            <Text allowFontScaling={false} style={styles.pointsLabel}>Points Balance</Text>
          </View>
          <View style={styles.tierIconWrapper}>
            {points >= 1000 ? <Crown size={48} color={tokens.colors.primary} /> : <Star size={48} color={tokens.colors.primary} />}
          </View>
        </View>

        {/* Tier Progress */}
        <View style={styles.progressContainer}>
          <View style={styles.progressLabelRow}>
            <Text allowFontScaling={false} style={styles.progressSubLabel}>Next Tier Progress</Text>
            <Text allowFontScaling={false} style={styles.progressValueText}>{points % 1000} / 1000</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
          </View>
        </View>
      </View>

      <FlatList
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.colors.primary} />}
        data={history}
        keyExtractor={(tx: any) => tx.id}
        initialNumToRender={8}
        windowSize={5}
        removeClippedSubviews={true}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View style={styles.scrollContent}>
            <Text allowFontScaling={false} style={styles.sectionTitle}>Ways to Earn</Text>
            
            <View style={styles.earnCard}>
              <View style={styles.earnIconWrapper}>
                <Pizza size={24} color={tokens.colors.primary} />
              </View>
              <View style={styles.earnInfo}>
                <Text allowFontScaling={false} style={styles.earnTitle}>Order Food</Text>
                <Text allowFontScaling={false} style={styles.earnSub}>Get 1 point for every ₹1 spent</Text>
              </View>
              <Text allowFontScaling={false} style={styles.earnBadge}>1% back</Text>
            </View>

            <Text allowFontScaling={false} style={[styles.sectionTitle, { marginTop: 40 }]}>Recent Activity</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.scrollContent}>
            <Text allowFontScaling={false} style={styles.emptyText}>No activity yet.</Text>
          </View>
        }
        renderItem={({ item: tx }: any) => (
          <View style={[styles.scrollContent, { paddingTop: 0, paddingBottom: 0 }]}>
            <View style={styles.activityRow}>
              <View>
                <Text allowFontScaling={false} style={styles.activityDesc}>{tx.description || (tx.type === 'earn' ? 'Order Points' : 'Points Redeemed')}</Text>
                <Text allowFontScaling={false} style={styles.activityDate}>{new Date(tx.createdAt).toLocaleDateString()}</Text>
              </View>
              <Text allowFontScaling={false} style={[styles.activityPoints, { color: tx.type === 'earn' ? tokens.colors.success : tokens.colors.danger }]}>
                {tx.type === 'earn' ? '+' : '−'}{tx.points} pts
              </Text>
            </View>
          </View>
        )}
      />

      {/* Footer Info */}
      <View style={styles.footer}>
        <Text allowFontScaling={false} style={styles.footerText}>
          Points can be redeemed at checkout for discounts. 100 points = ₹1 discount.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: 32,
    paddingBottom: 48,
    backgroundColor: tokens.colors.textPrimary,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    ...tokens.shadows.soft,
  },
  backButton: {
    marginBottom: 24,
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tierText: {
    color: tokens.colors.primary,
    fontSize: 10,
    fontFamily: tokens.typography.family.black,
    textTransform: 'uppercase',
    letterSpacing: 4,
    marginBottom: 8,
  },
  pointsValue: {
    color: tokens.colors.textInverse,
    fontSize: 48,
    fontFamily: tokens.typography.family.black,
  },
  pointsLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontFamily: tokens.typography.family.bold,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  tierIconWrapper: {
    width: 96,
    height: 96,
    backgroundColor: 'rgba(252, 70, 3, 0.2)',
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(252, 70, 3, 0.3)',
  },
  progressContainer: {
    marginTop: 40,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressSubLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontFamily: tokens.typography.family.bold,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  progressValueText: {
    color: tokens.colors.textInverse,
    fontFamily: tokens.typography.family.bold,
    fontSize: 10,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: tokens.colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 32,
  },
  sectionTitle: {
    color: tokens.colors.textPrimary,
    fontSize: 20,
    fontFamily: tokens.typography.family.black,
    marginBottom: 24,
  },
  earnCard: {
    backgroundColor: tokens.colors.background,
    padding: 24,
    borderRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.background,
  },
  earnIconWrapper: {
    width: 48,
    height: 48,
    backgroundColor: tokens.colors.surface,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    ...tokens.shadows.soft,
  },
  earnInfo: {
    flex: 1,
  },
  earnTitle: {
    color: tokens.colors.textPrimary,
    fontFamily: tokens.typography.family.black,
    fontSize: 16,
  },
  earnSub: {
    color: tokens.colors.textTertiary,
    fontSize: 12,
    marginTop: 4,
    fontFamily: tokens.typography.family.medium,
  },
  earnBadge: {
    color: tokens.colors.primary,
    fontFamily: tokens.typography.family.black,
    fontSize: 12,
  },
  emptyText: {
    color: tokens.colors.textTertiary,
    fontFamily: tokens.typography.family.bold,
    textAlign: 'center',
    paddingTop: 32,
  },
  activityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.background,
  },
  activityDesc: {
    color: tokens.colors.textPrimary,
    fontFamily: tokens.typography.family.bold,
  },
  activityDate: {
    color: tokens.colors.textTertiary,
    fontSize: 12,
    marginTop: 4,
  },
  activityPoints: {
    fontFamily: tokens.typography.family.black,
  },
  footer: {
    padding: 32,
    backgroundColor: tokens.colors.background,
  },
  footerText: {
    color: tokens.colors.textTertiary,
    textAlign: 'center',
    fontSize: 12,
    fontFamily: tokens.typography.family.bold,
    lineHeight: 20,
  },
});

export default LoyaltyScreen;
