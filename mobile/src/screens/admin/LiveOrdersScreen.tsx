import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ShoppingBag, 
  Clock, 
  User, 
  Truck, 
  ChevronRight, 
  Filter,
  MapPin,
  CheckCircle2
} from 'lucide-react-native';

const StatusChip = ({ status }: { status: string }) => {
  const colors: Record<string, { bg: string, text: string, border: string }> = {
    confirmed: { bg: '#fffbeb', text: '#d97706', border: '#fef3c7' },
    preparing: { bg: 'rgba(0, 208, 132, 0.1)', text: '#00D084', border: 'rgba(0, 208, 132, 0.2)' },
    ready_for_pickup: { bg: '#eff6ff', text: '#2563eb', border: '#dbeafe' },
    out_for_delivery: { bg: '#f5f3ff', text: '#7c3aed', border: '#ddd6fe' },
  };

  const style = colors[status] || { bg: '#f9fafb', text: '#9ca3af', border: '#f3f4f6' };

  return (
    <View style={[styles.statusChip, { backgroundColor: style.bg, borderColor: style.border }]}>
      <Text style={[styles.statusChipText, { color: style.text }]}>
        {status.replace(/_/g, ' ')}
      </Text>
    </View>
  );
};

const LiveOrdersScreen = ({ navigation }: any) => {
  const [filter, setFilter] = useState('all');
  const { data, isLoading } = useQuery({
    queryKey: ['admin-live-orders'],
    queryFn: () => api.get('/admin/orders/live'),
    refetchInterval: 10000,
  });

  const orders = data?.orders || [];
  
  const fMappings = {
    'all': 'all',
    'new': 'confirmed',
    'prep': 'preparing',
    'ready': 'ready_for_pickup',
    'ship': 'out_for_delivery'
  };

  const filteredOrders = filter === 'all' ? orders : orders.filter((o: any) => o.status === fMappings[filter as keyof typeof fMappings]);


  if (isLoading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FF6B35" />
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <View style={styles.statusIndicator}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Pipeline Active</Text>
            </View>
            <Text style={styles.headerTitle}>Live Monitor</Text>
          </View>
          <View style={styles.orderCountBadge}>
            <Text style={styles.orderCountText}>{orders.length} ORDERS</Text>
          </View>
        </View>

        {/* Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {Object.keys(fMappings).map((f) => (
            <TouchableOpacity 
              key={f}
              onPress={() => setFilter(f)}
              style={[styles.filterButton, { backgroundColor: filter === f ? '#FF6B35' : '#f9fafb', borderColor: filter === f ? '#FF6B35' : '#f3f4f6' }]}
            >
              <Text style={[styles.filterButtonText, { color: filter === f ? '#fff' : '#9ca3af' }]}>
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {filteredOrders.map((order: any) => (
          <TouchableOpacity 
            key={order.id}
            activeOpacity={0.9}
            style={styles.orderCard}
            onPress={() => navigation.navigate('AdminOrderDetail', { orderId: order.id })}
          >
            <View style={styles.cardHeader}>
              <View>
                <View style={styles.idRow}>
                  <Text style={styles.displayId}>{order.display_id}</Text>
                  <StatusChip status={order.status} />
                </View>
                <View style={styles.timeRow}>
                   <Clock size={10} color="#9CA3AF" />
                   <Text style={styles.timeText}>
                      {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Received
                   </Text>
                </View>
              </View>
              <View style={styles.amountContainer}>
                 <Text style={styles.amountText}>₹{order.total_amount_paise / 100}</Text>
                 <Text style={styles.paymentMethod}>{order.payment_method || 'PREPAID'}</Text>
              </View>
            </View>
            
            <View style={styles.itemsContainer}>
              <View style={styles.itemsHeader}>
                 <ShoppingBag size={12} color="#999" style={{ marginRight: 8 }} />
                 <Text style={styles.itemsHeaderText}>Order Details</Text>
              </View>
              {order.items?.map((item: any, idx: number) => (
                <View key={idx} style={styles.itemRow}>
                  <View style={styles.quantityBadge}>
                    <Text style={styles.quantityText}>{item.quantity}x</Text>
                  </View>
                  <Text style={styles.itemName} numberOfLines={1}>{item.menu_item_name}</Text>
                </View>
              ))}
            </View>

            <View style={styles.cardFooter}>
              <View style={styles.riderSection}>
                <View style={styles.riderIconWrapper}>
                  <Truck size={18} color={order.rider_name ? "#1A1A2E" : "#FF6B35"} />
                </View>
                <View>
                   <Text style={styles.riderLabel}>Assigned Pilot</Text>
                   <Text style={[styles.riderName, { color: order.rider_name ? '#1A1A2E' : '#FF6B35' }]}>
                      {order.rider_name || 'Searching...'}
                   </Text>
                </View>
              </View>
              <View style={styles.chevronWrapper}>
                <ChevronRight size={18} color="#D1D5DB" />
              </View>
            </View>
          </TouchableOpacity>
        ))}

        {filteredOrders.length === 0 && (
          <View style={styles.emptyContainer}>
            <CheckCircle2 size={60} color="#D1D5DB" strokeWidth={1} />
            <Text style={styles.emptyText}>Pipeline Clear</Text>
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
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
    paddingHorizontal: 32,
    paddingTop: 16,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00D084',
    marginRight: 8,
  },
  statusText: {
    color: '#9ca3af',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 3,
  },
  headerTitle: {
    color: '#1A1A2E',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
  },
  orderCountBadge: {
    backgroundColor: '#1A1A2E',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  orderCountText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
  },
  filterScroll: {
    paddingRight: 40,
  },
  filterButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 12,
  },
  filterButtonText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  orderCard: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 32,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#f3f4f6',
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
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  displayId: {
    color: '#1A1A2E',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -1,
    marginRight: 12,
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusChipText: {
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amountText: {
    color: '#1A1A2E',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -1,
  },
  paymentMethod: {
    color: '#9ca3af',
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 4,
  },
  itemsContainer: {
    backgroundColor: '#f9fafb',
    padding: 20,
    borderRadius: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(243, 244, 246, 0.5)',
  },
  itemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemsHeaderText: {
    color: '#9ca3af',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  quantityBadge: {
    width: 20,
    height: 20,
    backgroundColor: '#fff',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  quantityText: {
    color: '#FF6B35',
    fontWeight: '900',
    fontSize: 9,
  },
  itemName: {
    color: '#1A1A2E',
    fontWeight: '900',
    fontSize: 12,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#f9fafb',
  },
  riderSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  riderIconWrapper: {
    width: 40,
    height: 40,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  riderLabel: {
    color: '#9ca3af',
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 4,
  },
  riderName: {
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: -0.2,
  },
  chevronWrapper: {
    width: 40,
    height: 40,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    opacity: 0.3,
  },
  emptyText: {
    color: '#9ca3af',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 4,
    fontSize: 10,
    marginTop: 24,
  },
});

export default LiveOrdersScreen;
