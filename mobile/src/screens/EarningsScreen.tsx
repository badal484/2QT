import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StatusBar, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { ArrowLeft, Wallet, TrendingUp, Calendar, Trophy, Zap, Clock } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const EarningsScreen = ({ navigation }: any) => {
  const { data, isLoading } = useQuery({
    queryKey: ['rider-earnings-history'],
    queryFn: () => api.get('/riders/earnings/history'),
  });

  if (isLoading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FF6B35" />
    </View>
  );

  const rawEarnings = data?.earnings || [];
  const totalEarnings = rawEarnings.reduce((sum: number, day: any) => sum + parseInt(day.total_paise, 10), 0) || 0;
  const totalDeliveries = rawEarnings.reduce((sum: number, day: any) => sum + parseInt(day.deliveries_count, 10), 0) || 0;

  // Calculate chart velocity data (last 7 days)
  const chartData = [...rawEarnings].slice(0, 7).reverse();
  const maxVal = chartData.reduce((max, d) => Math.max(max, parseInt(d.total_paise, 10)), 0) || 1;
  const avgVal = chartData.length > 0 ? (totalEarnings / rawEarnings.length) : 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.content} edges={['top']}>
        {/* Premium Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            activeOpacity={0.7}
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <ArrowLeft size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.terminalLabel}>MISSIONS // EARNINGS</Text>
            <Text style={styles.headerTitle}>Earnings Ledger</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Total Performance Header Card */}
          <View style={styles.headlineCard}>
            <View style={styles.perfLabelRow}>
              <TrendingUp size={14} color="#FF6B35" style={{ marginRight: 6 }} />
              <Text style={styles.perfLabelText}>CUMULATIVE REVENUE</Text>
            </View>
            <Text style={styles.totalAmountText}>₹{(totalEarnings / 100).toFixed(2)}</Text>
            
            <View style={styles.metricsRow}>
              <View style={styles.metricItem}>
                <Trophy size={14} color="#22C55E" style={{ marginRight: 6 }} />
                <Text style={styles.metricValue}>{totalDeliveries}</Text>
                <Text style={styles.metricLabel}>DELIVERIES</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.metricItem}>
                <Clock size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.metricValue}>₹{(avgVal / 100).toFixed(0)}</Text>
                <Text style={styles.metricLabel}>DAILY AVG</Text>
              </View>
            </View>
          </View>

          {/* Weekly Velocity Chart */}
          {chartData.length > 0 && (
            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>Weekly Velocity</Text>
              
              <View style={styles.chartWrapper}>
                {/* Horizontal Guide Grid Lines */}
                <View style={styles.gridLine} />
                <View style={[styles.gridLine, { top: '50%' }]} />
                <View style={[styles.gridLine, { top: '20%' }]} />

                <View style={styles.chartRow}>
                  {chartData.map((day: any, idx: number) => {
                    const dayAmount = parseInt(day.total_paise, 10);
                    const pct = (dayAmount / maxVal) * 100;
                    const dayLabel = new Date(day.date).toLocaleDateString('en-IN', { weekday: 'short' });
                    const isPeak = dayAmount === maxVal && dayAmount > 0;

                    return (
                      <View key={day.id || idx} style={styles.chartCol}>
                        <View style={styles.chartTrack}>
                          <View 
                            style={[
                              styles.chartBar, 
                              { height: `${Math.max(8, pct)}%` },
                              isPeak && styles.chartBarPeak
                            ]} 
                          />
                        </View>
                        <Text style={[styles.chartLabel, isPeak && styles.chartLabelPeak]}>{dayLabel}</Text>
                        <Text style={[styles.chartValue, isPeak && styles.chartValuePeak]}>₹{(dayAmount / 100).toFixed(0)}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          )}

          {/* Daily Breakdown List Header */}
          <View style={styles.sectionHeader}>
            <Calendar size={16} color="#FF6B35" style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>DAILY BREAKDOWN</Text>
          </View>
          
          {/* Breakdown Items */}
          {rawEarnings.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Wallet size={36} color="#475569" />
              <Text style={styles.emptyText}>No historical earnings records found.</Text>
            </View>
          ) : (
            rawEarnings.map((day: any) => (
              <View key={day.id} style={styles.earningsCard}>
                <View style={styles.cardLeft}>
                  <View style={styles.dateIconWrapper}>
                    <Calendar size={18} color="#FFFFFF" />
                  </View>
                  <View>
                    <Text style={styles.cardDate}>
                      {new Date(day.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                    <View style={styles.cardInfoRow}>
                      <Zap size={10} color="#FF6B35" style={{ marginRight: 4 }} />
                      <Text style={styles.cardInfoText}>{day.deliveries_count} DELIVERIES COMPLETED</Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.cardAmountText}>₹{day.total_paise / 100}</Text>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0C10',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0B0C10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    backgroundColor: '#0D0E15',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  backButton: {
    width: 40,
    height: 40,
    backgroundColor: '#161726',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  terminalLabel: {
    color: '#FF6B35',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 2,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  headlineCard: {
    backgroundColor: '#161726',
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  perfLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  perfLabelText: {
    color: '#FF6B35',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  totalAmountText: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -1,
    marginBottom: 20,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D0E15',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  metricItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    marginRight: 6,
  },
  metricLabel: {
    color: '#64748B',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  divider: {
    width: 1.5,
    height: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  chartContainer: {
    backgroundColor: '#161726',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 28,
    padding: 20,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
  },
  chartTitle: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 20,
  },
  chartWrapper: {
    height: 150,
    position: 'relative',
    justifyContent: 'flex-end',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderStyle: 'dashed',
  },
  chartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
    paddingHorizontal: 4,
    zIndex: 10,
  },
  chartCol: {
    alignItems: 'center',
    flex: 1,
  },
  chartTrack: {
    width: 8,
    height: 84,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartBar: {
    width: '100%',
    backgroundColor: '#334155',
    borderRadius: 4,
  },
  chartBarPeak: {
    backgroundColor: '#FF6B35',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },
  chartLabel: {
    color: '#64748B',
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginTop: 8,
  },
  chartLabelPeak: {
    color: '#FF6B35',
  },
  chartValue: {
    color: '#475569',
    fontSize: 8,
    fontWeight: '800',
    marginTop: 2,
  },
  chartValuePeak: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    color: '#FF6B35',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },
  emptyContainer: {
    paddingVertical: 64,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#161726',
    borderRadius: 24,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  emptyText: {
    color: '#64748B',
    fontWeight: '700',
    fontSize: 13,
    marginTop: 12,
  },
  earningsCard: {
    backgroundColor: '#161726',
    padding: 20,
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateIconWrapper: {
    width: 38,
    height: 38,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  cardDate: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  cardInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  cardInfoText: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardAmountText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: -0.5,
  },
});

export default EarningsScreen;
