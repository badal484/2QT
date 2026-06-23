import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StatusBar, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { ArrowLeft, Package, Clock, Trophy, CreditCard, Compass } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const RiderHistoryScreen = ({ navigation }: any) => {
  const { data, isLoading } = useQuery({
    queryKey: ['rider-order-history'],
    queryFn: () => api.get('/riders/orders/history'),
  });

  const orders = data?.orders || [];
  const completedOrders = orders.filter((o: any) => o.status === 'delivered');
  const completedCount = completedOrders.length;
  
  // Calculate stats dynamically
  const totalEarnings = orders.reduce((sum: number, o: any) => {
    if (o.status === 'delivered') {
      return sum + parseInt(o.total_amount_paise || '0', 10);
    }
    return sum;
  }, 0) / 100;

  const avgDuration = completedCount > 0
    ? Math.round(completedOrders.reduce((sum: number, o: any) => {
        if (o.delivered_at && o.created_at) {
          const diffMin = (new Date(o.delivered_at).getTime() - new Date(o.created_at).getTime()) / 60000;
          return sum + Math.max(0, diffMin);
        }
        return sum;
      }, 0) / completedCount)
    : 0;

  if (isLoading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FF6B35" />
    </View>
  );

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
            <Text style={styles.terminalLabel}>MISSIONS // LOGBOOK</Text>
            <Text style={styles.headerTitle}>Captain Logbook</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Dashboard Summary Panels */}
          <View style={styles.statsPanel}>
            <View style={styles.statBox}>
              <View style={[styles.statIconWrapper, { backgroundColor: 'rgba(34, 197, 94, 0.08)' }]}>
                <Compass size={16} color="#22C55E" />
              </View>
              <Text style={styles.statValue}>{completedCount}</Text>
              <Text style={styles.statLabel}>COMPLETED</Text>
            </View>

            <View style={styles.statBox}>
              <View style={[styles.statIconWrapper, { backgroundColor: 'rgba(255, 107, 53, 0.08)' }]}>
                <Trophy size={16} color="#FF6B35" />
              </View>
              <Text style={styles.statValue}>₹{totalEarnings.toFixed(0)}</Text>
              <Text style={styles.statLabel}>REVENUE</Text>
            </View>

            <View style={styles.statBox}>
              <View style={[styles.statIconWrapper, { backgroundColor: 'rgba(255, 255, 255, 0.06)' }]}>
                <Clock size={16} color="#FFFFFF" />
              </View>
              <Text style={styles.statValue}>{avgDuration}m</Text>
              <Text style={styles.statLabel}>AVG TIME</Text>
            </View>
          </View>

          {/* History Label */}
          <Text style={styles.historyTitle}>FLIGHT ARCHIVE</Text>

          {orders.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Package size={44} color="#475569" />
              <Text style={styles.emptyText}>No historical missions logged.</Text>
            </View>
          ) : (
            orders.map((order: any) => {
              const isDelivered = order.status === 'delivered';
              const isCOD = order.payment_method?.toLowerCase() === 'cod';
              const duration = order.delivered_at && order.created_at
                ? Math.round((new Date(order.delivered_at).getTime() - new Date(order.created_at).getTime()) / 60000)
                : null;

              return (
                <View 
                  key={order.id} 
                  style={[
                    styles.missionCard, 
                    isDelivered 
                      ? { borderLeftColor: '#22C55E' } 
                      : { borderLeftColor: '#EF4444' }
                  ]}
                >
                  {/* Card Top Row */}
                  <View style={styles.cardHeader}>
                    <View>
                      <Text style={styles.missionId}>{order.display_id}</Text>
                      <Text style={styles.missionDate}>
                        {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} • {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    <View style={[
                      styles.statusBadge, 
                      { 
                        backgroundColor: isDelivered ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                        borderColor: isDelivered ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      }
                    ]}>
                      <View style={[styles.statusDot, { backgroundColor: isDelivered ? '#22C55E' : '#EF4444' }]} />
                      <Text style={[styles.statusText, { color: isDelivered ? '#22C55E' : '#EF4444' }]}>
                        {order.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {/* Destination Details */}
                  <View style={styles.locationsBox}>
                    <Text style={styles.locationLabel}>DESTINATION</Text>
                    <Text style={styles.locationValue} numberOfLines={1}>
                      {order.delivery_address_text || 'Customer Location'}
                    </Text>
                  </View>

                  {/* Itemized Cargo Container */}
                  <View style={styles.cargoBox}>
                    {order.items?.map((item: any, idx: number) => (
                      <View key={idx} style={styles.cargoRow}>
                        <View style={styles.cargoQtyBadge}>
                          <Text style={styles.cargoQty}>{item.quantity}x</Text>
                        </View>
                        <Text style={styles.cargoName} numberOfLines={1}>
                          {item.menu_item_name.toUpperCase()}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Card Bottom Row */}
                  <View style={styles.cardFooter}>
                    <View style={styles.footerInfoRow}>
                      <Clock size={13} color="#64748B" style={{ marginRight: 6 }} />
                      <Text style={styles.footerInfoText}>
                        {duration ? `EVAL: ${duration} MINS` : 'TERMINATED'}
                      </Text>
                    </View>

                    <View style={styles.footerPaymentRow}>
                      <View style={[styles.payMethodBadge, isCOD ? styles.badgeCod : styles.badgePrepaid]}>
                        <CreditCard size={10} color={isCOD ? '#FF6B35' : '#22C55E'} style={{ marginRight: 4 }} />
                        <Text style={[styles.payMethodText, isCOD ? styles.textCod : styles.textPrepaid]}>
                          {isCOD ? 'COD' : 'PREPAID'}
                        </Text>
                      </View>
                      <Text style={[styles.priceText, isDelivered ? styles.priceTextGreen : styles.priceTextRed]}>
                        ₹{parseInt(order.total_amount_paise || '0', 10) / 100}
                      </Text>
                    </View>
                  </View>

                </View>
              );
            })
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
  statsPanel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#161726',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 18,
    paddingHorizontal: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
  },
  statIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  statLabel: {
    color: '#64748B',
    fontSize: 8,
    fontWeight: '900',
    marginTop: 4,
    letterSpacing: 1,
  },
  historyTitle: {
    color: '#FF6B35',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 20,
    paddingHorizontal: 4,
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
  missionCard: {
    backgroundColor: '#161726',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderLeftWidth: 4,
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  missionId: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: -0.5,
  },
  missionDate: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginTop: 3,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontWeight: '900',
    fontSize: 8,
    letterSpacing: 1,
  },
  locationsBox: {
    backgroundColor: '#0D0E15',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  locationLabel: {
    color: '#64748B',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  locationValue: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  cargoBox: {
    gap: 6,
    marginBottom: 16,
  },
  cargoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cargoQtyBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  cargoQty: {
    color: '#FF6B35',
    fontSize: 9,
    fontWeight: '900',
  },
  cargoName: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 14,
  },
  footerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerInfoText: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  footerPaymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  payMethodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  badgeCod: {
    backgroundColor: 'rgba(255, 107, 53, 0.08)',
    borderColor: 'rgba(255, 107, 53, 0.15)',
  },
  badgePrepaid: {
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    borderColor: 'rgba(34, 197, 94, 0.15)',
  },
  payMethodText: {
    fontSize: 8,
    fontWeight: '900',
  },
  textCod: {
    color: '#FF6B35',
  },
  textPrepaid: {
    color: '#22C55E',
  },
  priceText: {
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: -0.5,
  },
  priceTextGreen: {
    color: '#22C55E',
  },
  priceTextRed: {
    color: '#EF4444',
  },
});

export default RiderHistoryScreen;
