import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { ArrowLeft, Wallet, TrendingUp, Calendar } from 'lucide-react-native';

const EarningsScreen = ({ navigation }: any) => {
  const { data, isLoading } = useQuery({
    queryKey: ['rider-earnings-history'],
    queryFn: () => api.get('/riders/earnings'),
  });

  if (isLoading) return (
    <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
    </View>
  );

  const totalEarnings = data?.earnings?.reduce((sum: number, day: any) => sum + parseInt(day.total_paise, 10), 0) || 0;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity 
          activeOpacity={0.7}
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
        >
          <ArrowLeft size={24} color="#1A1A2E" />
        </TouchableOpacity>

        <View style={styles.perfLabelRow}>
            <TrendingUp size={16} color="#FF6B35" style={{ marginRight: 8 }} />
            <Text style={styles.perfLabelText}>Total Performance</Text>
        </View>
        <Text style={styles.totalAmountText}>₹{totalEarnings / 100}</Text>

        <View style={styles.sectionHeader}>
            <Calendar size={20} color="#1A1A2E" style={{ marginRight: 12 }} />
            <Text style={styles.sectionTitle}>Daily Breakdown</Text>
        </View>
        
        {data?.earnings?.length === 0 ? (
          <View style={styles.emptyContainer}>
             <Wallet size={48} color="#D1D5DB" />
             <Text style={styles.emptyText}>No earnings record yet.</Text>
          </View>
        ) : (
          data?.earnings?.map((day: any) => (
            <View key={day.id} style={styles.earningsCard}>
              <View>
                <Text style={styles.cardDate}>{new Date(day.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                <View style={styles.cardInfoRow}>
                    <View style={styles.dot} />
                    <Text style={styles.cardInfoText}>{day.deliveries_count} Deliveries</Text>
                </View>
              </View>
              <Text style={styles.cardAmountText}>₹{day.total_paise / 100}</Text>
            </View>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 32,
    paddingTop: 64,
    paddingBottom: 40,
  },
  backButton: {
    width: 48,
    height: 48,
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  perfLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  perfLabelText: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  totalAmountText: {
    color: '#1A1A2E',
    fontSize: 64,
    fontWeight: '900',
    marginBottom: 48,
    letterSpacing: -2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  sectionTitle: {
    color: '#1A1A2E',
    fontSize: 20,
    fontWeight: '900',
  },
  emptyContainer: {
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 40,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#e5e7eb',
  },
  emptyText: {
    color: '#9ca3af',
    fontWeight: '700',
    marginTop: 16,
  },
  earningsCard: {
    backgroundColor: '#fff',
    padding: 28,
    borderRadius: 32,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardDate: {
    color: '#1A1A2E',
    fontWeight: '900',
    fontSize: 18,
  },
  cardInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  dot: {
    width: 6,
    height: 6,
    backgroundColor: '#FF6B35',
    borderRadius: 3,
    marginRight: 8,
  },
  cardInfoText: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  cardAmountText: {
    color: '#1A1A2E',
    fontWeight: '900',
    fontSize: 24,
  },
});

export default EarningsScreen;
