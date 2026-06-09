import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { ArrowLeft, Package, Clock, CheckCircle2, XCircle } from 'lucide-react-native';

const RiderHistoryScreen = ({ navigation }: any) => {
  const { data, isLoading } = useQuery({
    queryKey: ['rider-order-history'],
    queryFn: () => api.get('/riders/orders/history'),
  });

  const orders = data?.orders || [];

  if (isLoading) return (
    <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          activeOpacity={0.7}
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mission Log</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {orders.length === 0 ? (
          <View style={styles.emptyContainer}>
             <Package size={48} color="#D1D5DB" />
             <Text style={styles.emptyText}>No completed missions yet.</Text>
          </View>
        ) : (
          orders.map((order: any) => (
            <View key={order.id} style={styles.missionCard}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.missionId}>{order.display_id}</Text>
                  <Text style={styles.missionDate}>
                    {new Date(order.created_at).toLocaleDateString()} • {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: order.status === 'delivered' ? '#F0FDF4' : '#FEF2F2' }]}>
                  {order.status === 'delivered' ? <CheckCircle2 size={10} color="#059669" /> : <XCircle size={10} color="#DC2626" />}
                  <Text style={[styles.statusText, { color: order.status === 'delivered' ? '#166534' : '#991B1B' }]}>
                    {order.status}
                  </Text>
                </View>
              </View>

              <View style={styles.itemsBox}>
                {order.items?.map((item: any, idx: number) => (
                  <Text key={idx} style={styles.itemText}>
                    {item.quantity}x {item.menu_item_name}
                  </Text>
                ))}
              </View>

              <View style={styles.cardFooter}>
                <View style={styles.timeInfo}>
                  <Clock size={12} color="#9CA3AF" />
                  <Text style={styles.timeText}>
                    {order.delivered_at ? `Delivered in ${Math.round((new Date(order.delivered_at).getTime() - new Date(order.created_at).getTime()) / 60000)}m` : 'Cancelled'}
                  </Text>
                </View>
                <Text style={styles.priceText}>₹{order.total_amount_paise / 100}</Text>
              </View>
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
  header: {
    paddingTop: 64,
    paddingHorizontal: 32,
    paddingBottom: 40,
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
    shadowRadius: 5,
    elevation: 2,
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
    padding: 32,
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
  missionCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    borderRadius: 32,
    padding: 28,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  missionId: {
    color: '#1A1A2E',
    fontWeight: '900',
    fontSize: 18,
  },
  missionDate: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontWeight: '900',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: 6,
  },
  itemsBox: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
  },
  itemText: {
    color: '#6b7280',
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f9fafb',
    paddingTop: 16,
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    color: '#9ca3af',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginLeft: 8,
  },
  priceText: {
    color: '#1A1A2E',
    fontWeight: '900',
    fontSize: 14,
  },
});

export default RiderHistoryScreen;
