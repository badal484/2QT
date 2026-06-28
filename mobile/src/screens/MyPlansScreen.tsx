import { ArrowLeft, Calendar } from 'lucide-react-native';
import React from 'react';
import { BouncingButton } from '../components/ui/BouncingButton';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

const MyPlansScreen = ({ navigation }: any) => {
  const { data, isLoading } = useQuery({
    queryKey: ['my-plans'],
    queryFn: () => api.get('/subscriptions/me'),
  });

  if (isLoading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FF6B35" />
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BouncingButton onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={24} color="#1A1A2E" />
        </BouncingButton>
        <Text style={styles.headerTitle}>My Subscriptions</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {data?.subscriptions?.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrapper}>
              <Calendar size={48} color="#9CA3AF" />
            </View>
            <Text style={styles.emptyTitle}>No active plans</Text>
            <BouncingButton 
              style={styles.browseBtn}
              onPress={() => navigation.navigate('Subscription')}
            >
              <Text style={styles.browseBtnText}>Browse Plans</Text>
            </BouncingButton>
          </View>
        ) : (
          data?.subscriptions?.map((sub: any) => (
            <BouncingButton 
              key={sub.id}
              activeOpacity={0.8}
              style={styles.planCard}
              onPress={() => navigation.navigate('SubscriptionDetail', { subscription: sub })}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.planName}>{sub.plan_name}</Text>
                <View style={[styles.statusBadge, { backgroundColor: sub.status === 'active' ? '#F0FDF4' : '#FFFBEB' }]}>
                  <Text style={[styles.statusText, { color: sub.status === 'active' ? '#166534' : '#D97706' }]}>
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
            </BouncingButton>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingTop: 64,
    paddingHorizontal: 32,
    paddingBottom: 24,
    backgroundColor: '#f9fafb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backButton: {
    width: 48,
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  headerTitle: {
    color: '#1A1A2E',
    fontSize: 20,
    fontWeight: '900',
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
    backgroundColor: '#f9fafb',
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    color: '#1A1A2E',
    fontSize: 20,
    fontWeight: '900',
  },
  browseBtn: {
    marginTop: 24,
    backgroundColor: '#FF6B35',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 16,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  browseBtnText: {
    color: '#fff',
    fontWeight: '900',
  },
  planCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    borderRadius: 32,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  planName: {
    color: '#1A1A2E',
    fontSize: 20,
    fontWeight: '900',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 100,
  },
  statusText: {
    fontWeight: '900',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    color: '#9ca3af',
    fontWeight: '700',
  },
  infoValue: {
    color: '#1A1A2E',
    fontWeight: '900',
  },
});

export default MyPlansScreen;
