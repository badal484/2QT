import { tokens } from '../theme/tokens';
import { ArrowLeft, Calendar } from 'lucide-react-native';
import React from 'react';
import { PressableScale } from '../components/ui/internal/PressableScale';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SkeletonScreenList, SkeletonListItem } from '../components/ui';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

const MyPlansScreen = ({ navigation }: any) => {
  const { data, isLoading } = useQuery({
    queryKey: ['my-plans'],
    queryFn: () => api.get('/subscriptions/me'),
  });

  if (isLoading) return (
    <View style={styles.container}>
      <ScreenHeader title="My Subscriptions" />
      <SkeletonScreenList item={<SkeletonListItem />} />
    </View>
  );

  return (
    <View style={styles.container}>
      <ScreenHeader title="My Subscriptions" />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {data?.subscriptions?.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrapper}>
              <Calendar size={48} color={tokens.colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>No active plans</Text>
            <PressableScale 
              style={styles.browseBtn}
              onPress={() => navigation.navigate('Subscription')}
            >
              <Text style={styles.browseBtnText}>Browse Plans</Text>
            </PressableScale>
          </View>
        ) : (
          data?.subscriptions?.map((sub: any) => (
            <PressableScale 
              key={sub.id}
              style={styles.planCard}
              onPress={() => navigation.navigate('SubscriptionDetail', { subscription: sub })}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.planName}>{sub.plan_name}</Text>
                <View style={[styles.statusBadge, { backgroundColor: sub.status === 'active' ? tokens.colors.successTint : tokens.colors.warningTint }]}>
                  <Text style={[styles.statusText, { color: sub.status === 'active' ? tokens.colors.success : tokens.colors.warning }]}>
                    {sub.status}
                  </Text>
                </View>
              </View>
              
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Meals Remaining</Text>
                <Text style={styles.infoValue}>{sub.remaining_meals}/{sub.total_meals}</Text>
              </View>
              
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Expires On</Text>
                <Text style={styles.infoValue}>{new Date(sub.expires_at).toLocaleDateString()}</Text>
              </View>
            </PressableScale>
          ))
        )}
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyIconWrapper: {
    width: 96,
    height: 96,
    backgroundColor: tokens.colors.background,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    color: tokens.colors.textPrimary,
    fontSize: 20,
    fontFamily: tokens.typography.family.black,
  },
  browseBtn: {
    marginTop: 24,
    backgroundColor: tokens.colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 16,
    shadowColor: tokens.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  browseBtnText: {
    color: tokens.colors.textInverse,
    fontFamily: tokens.typography.family.black,
  },
  planCard: {
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.background,
    borderRadius: 32,
    padding: 24,
    marginBottom: 16,
    ...tokens.shadows.soft,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  planName: {
    color: tokens.colors.textPrimary,
    fontSize: 20,
    fontFamily: tokens.typography.family.black,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 100,
  },
  statusText: {
    fontFamily: tokens.typography.family.black,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    color: tokens.colors.textTertiary,
    fontFamily: tokens.typography.family.bold,
  },
  infoValue: {
    color: tokens.colors.textPrimary,
    fontFamily: tokens.typography.family.black,
  },
});

export default MyPlansScreen;
