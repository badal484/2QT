import { ArrowLeft, Star, Crown, Pizza } from 'lucide-react-native';
import React, { useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, AppState } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { getSocket } from '../socket/client';

const LoyaltyScreen = ({ navigation }: any) => {
  const queryClient = useQueryClient();
  const socket = getSocket();
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

  const { data: loyalty, isLoading } = useQuery({
    queryKey: ['loyalty'],
    queryFn: () => api.get('/customers/loyalty'),
  });

  React.useEffect(() => {
    if (socket) {
      socket.on('loyalty_updated', () => {
        queryClient.invalidateQueries({ queryKey: ['loyalty'] });
      });
    }
    return () => {
      if (socket) socket.off('loyalty_updated');
    };
  }, [socket]);

  if (isLoading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FF6B35" />
    </View>
  );

  const points = loyalty?.points || 0;
  const progress = (points % 1000) / 1000;
  const tier = points >= 5000 ? 'Platinum' : points >= 2000 ? 'Gold' : points >= 1000 ? 'Silver' : 'Bronze';

  return (
    <View style={styles.container}>
      {/* Header Card */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={24} color="#1A1A2E" />
        </TouchableOpacity>
        
        <View style={styles.headerContentRow}>
          <View>
            <Text style={styles.tierText}>2QT {tier}</Text>
            <Text style={styles.pointsValue}>{points}</Text>
            <Text style={styles.pointsLabel}>Points Balance</Text>
          </View>
          <View style={styles.tierIconWrapper}>
            {points >= 1000 ? <Crown size={48} color="#FF6B35" /> : <Star size={48} color="#FF6B35" />}
          </View>
        </View>

        {/* Tier Progress */}
        <View style={styles.progressContainer}>
          <View style={styles.progressLabelRow}>
            <Text style={styles.progressSubLabel}>Next Tier Progress</Text>
            <Text style={styles.progressValueText}>{points % 1000} / 1000</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
          </View>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.scrollContent}>
          <Text style={styles.sectionTitle}>Ways to Earn</Text>
          
          <View style={styles.earnCard}>
            <View style={styles.earnIconWrapper}>
              <Pizza size={24} color="#FF6B35" />
            </View>
            <View style={styles.earnInfo}>
              <Text style={styles.earnTitle}>Order Food</Text>
              <Text style={styles.earnSub}>Get 1 point for every ₹1 spent</Text>
            </View>
            <Text style={styles.earnBadge}>1% back</Text>
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 40 }]}>Recent Activity</Text>
          
          {loyalty?.history?.length === 0 ? (
            <Text style={styles.emptyText}>No activity yet.</Text>
          ) : (
            loyalty?.history?.map((tx: any) => (
              <View key={tx.id} style={styles.activityRow}>
                <View>
                  <Text style={styles.activityDesc}>{tx.description}</Text>
                  <Text style={styles.activityDate}>{new Date(tx.createdAt).toLocaleDateString()}</Text>
                </View>
                <Text style={[styles.activityPoints, { color: tx.type === 'earn' ? '#22C55E' : '#EF4444' }]}>
                  {tx.type === 'earn' ? '+' : '−'}{tx.points} pts
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Footer Info */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Points can be redeemed at checkout for discounts. 100 points = ₹1 discount.
        </Text>
      </View>
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
    paddingTop: 80,
    paddingHorizontal: 32,
    paddingBottom: 48,
    backgroundColor: '#1A1A2E',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 10,
  },
  backButton: {
    marginBottom: 24,
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tierText: {
    color: '#FF6B35',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 4,
    marginBottom: 8,
  },
  pointsValue: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '900',
  },
  pointsLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  tierIconWrapper: {
    width: 96,
    height: 96,
    backgroundColor: 'rgba(255, 107, 53, 0.2)',
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.3)',
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
    fontWeight: '700',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  progressValueText: {
    color: '#fff',
    fontWeight: '700',
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
    backgroundColor: '#FF6B35',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 32,
  },
  sectionTitle: {
    color: '#1A1A2E',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 24,
  },
  earnCard: {
    backgroundColor: '#f9fafb',
    padding: 24,
    borderRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  earnIconWrapper: {
    width: 48,
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  earnInfo: {
    flex: 1,
  },
  earnTitle: {
    color: '#1A1A2E',
    fontWeight: '900',
    fontSize: 16,
  },
  earnSub: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  earnBadge: {
    color: '#FF6B35',
    fontWeight: '900',
    fontSize: 12,
  },
  emptyText: {
    color: '#9ca3af',
    fontWeight: '700',
    textAlign: 'center',
    paddingTop: 32,
  },
  activityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  activityDesc: {
    color: '#1A1A2E',
    fontWeight: '700',
  },
  activityDate: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 4,
  },
  activityPoints: {
    fontWeight: '900',
  },
  footer: {
    padding: 32,
    backgroundColor: '#f9fafb',
  },
  footerText: {
    color: '#9ca3af',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 20,
  },
});

export default LoyaltyScreen;
