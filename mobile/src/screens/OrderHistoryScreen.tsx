import { Package, RotateCcw, ArrowRight } from 'lucide-react-native';
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image, StyleSheet, Alert, Linking } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useDispatch } from 'react-redux';
import { addItem } from '../store/slices/cartSlice';

const OrderHistoryScreen = ({ navigation }: any) => {
  const dispatch = useDispatch();
  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['order-history'],
    queryFn: () => api.get('/orders/mine'),
  });

  const orders = ordersData?.orders || [];

  if (isLoading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FF6B35" />
      <Text style={styles.loadingText}>Fetching History</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Orders</Text>
        <Text style={styles.headerSub}>Past & Active Journeys</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {orders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrapper}>
              <Package size={32} color="#1A1A2E" />
            </View>
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptySubText}>Your delicious journey is just one click away!</Text>
            <TouchableOpacity 
              style={styles.browseBtn}
              onPress={() => navigation.navigate('MenuTab')}
            >
              <Text style={styles.browseBtnText}>Browse Menu</Text>
            </TouchableOpacity>
          </View>
        ) : (
          orders.map((order: any) => (
            <TouchableOpacity 
              key={order.id}
              activeOpacity={0.9}
              style={styles.orderCard}
              onPress={() => ['delivered', 'cancelled'].includes(order.status) ? null : navigation.navigate('OrderTracking', { orderId: order.id })}
            >
              <View style={styles.orderCardHeader}>
                <View>
                  <Text style={styles.orderIdText}>{order.display_id}</Text>
                  <Text style={styles.orderDateText}>
                    {new Date(order.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} • {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { 
                  backgroundColor: order.status === 'delivered' ? '#F0FDF4' : 
                                   order.status === 'cancelled' ? '#FEF2F2' : 
                                   '#FFF7ED'
                }]}>
                  <Text style={[styles.statusBadgeText, { 
                    color: order.status === 'delivered' ? '#166534' : 
                           order.status === 'cancelled' ? '#991B1B' : 
                           '#FF6B35'
                  }]}>
                    {order.status.replace(/_/g, ' ')}
                  </Text>
                </View>
              </View>

              <View style={styles.itemsListContainer}>
                {order.items?.map((item: any, idx: number) => (
                  <View key={idx} style={styles.itemRow}>
                    <Text style={styles.itemQty}>{item.quantity}x</Text>
                    <Text style={styles.itemName} numberOfLines={1}>{item.menu_item_name}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.orderCardFooter}>
                <View>
                  <Text style={styles.footerLabel}>Total Paid</Text>
                  <Text style={styles.footerValue}>₹{order.total_amount_paise / 100}</Text>
                </View>
                
                {!['delivered', 'cancelled'].includes(order.status) ? (
                  <TouchableOpacity 
                    style={styles.trackBtn}
                    onPress={() => navigation.navigate('OrderTracking', { orderId: order.id })}
                  >
                    <Text style={styles.trackBtnText}>Track Now</Text>
                    <ArrowRight size={14} color="white" style={{ marginLeft: 8 }} />
                  </TouchableOpacity>
                ) : (
                  <View style={{ flexDirection: 'row' }}>
                    {order.invoice_url && (
                        <TouchableOpacity 
                            style={[styles.reorderBtn, { marginRight: 8, backgroundColor: 'rgba(255, 107, 53, 0.05)', borderColor: 'rgba(255, 107, 53, 0.1)', borderWidth: 1 }]}
                            onPress={() => Linking.openURL(order.invoice_url)}
                        >
                            <Text style={[styles.reorderBtnText, { color: '#FF6B35' }]}>Invoice</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity 
                        style={styles.reorderBtn}
                        onPress={async () => {
                          try {
                            // 1. Fetch current menu to validate availability
                            const menu = await api.get(`/menu?zoneId=${order.zone_id}`);
                            const currentItems = menu.items || [];
                            
                            const availableItems = order.items.filter((oldItem: any) => 
                              currentItems.find((ci: any) => ci.id === oldItem.menu_item_id && ci.available)
                            );

                            if (availableItems.length === 0) {
                              Alert.alert('Unavailable', 'None of the items from this past order are available today.');
                              return;
                            }

                            const addItems = () => {
                              availableItems.forEach((item: any) => {
                                const menuItem = currentItems.find((ci: any) => ci.id === item.menu_item_id);
                                dispatch(addItem({
                                  menuItemId: item.menu_item_id,
                                  name: item.menu_item_name,
                                  pricePaise: menuItem.price_paise,
                                  quantity: item.quantity,
                                  photoUrl: menuItem.photo_url,
                                  isVeg: menuItem.is_veg,
                                  kitchenId: order.kitchen_id
                                }));
                              });
                              
                              if (availableItems.length < order.items.length) {
                                Alert.alert('Partial Reorder', 'Some items were sold out and were skipped.');
                              }
                              navigation.navigate('Cart');
                            };

                            Alert.alert(
                              'Reorder',
                              'Would you like to add these items to your cart?',
                              [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Add to Cart', onPress: addItems }
                              ]
                            );
                          } catch (e) {
                            Alert.alert('Error', 'Could not validate menu availability. Please try again.');
                          }
                        }}
                    >
                        <RotateCcw size={14} color="#9CA3AF" style={{ marginRight: 8 }} />
                        <Text style={styles.reorderBtnText}>Reorder</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </TouchableOpacity>
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
  loadingText: {
    marginTop: 16,
    color: '#9ca3af',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 10,
  },
  header: {
    paddingTop: 64,
    paddingHorizontal: 32,
    paddingBottom: 32,
    backgroundColor: 'rgba(249, 250, 251, 0.5)',
  },
  headerTitle: {
    color: '#1A1A2E',
    fontSize: 40,
    fontWeight: '900',
  },
  headerSub: {
    color: '#9ca3af',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 10,
    marginTop: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
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
  emptySubText: {
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
    fontWeight: '500',
  },
  browseBtn: {
    marginTop: 32,
    backgroundColor: '#1A1A2E',
    paddingHorizontal: 40,
    paddingVertical: 20,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  browseBtnText: {
    color: '#fff',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 12,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    borderRadius: 32,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  orderIdText: {
    color: '#1A1A2E',
    fontSize: 18,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  orderDateText: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontWeight: '900',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  itemsListContainer: {
    marginBottom: 24,
    backgroundColor: 'rgba(249, 250, 251, 0.5)',
    padding: 16,
    borderRadius: 16,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemQty: {
    color: '#1A1A2E',
    fontWeight: '900',
    fontSize: 12,
    marginRight: 8,
  },
  itemName: {
    color: '#4B5563',
    fontWeight: '500',
    fontSize: 12,
    flex: 1,
  },
  orderCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  footerLabel: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  footerValue: {
    color: '#1A1A2E',
    fontWeight: '900',
    fontSize: 20,
    marginTop: 4,
  },
  trackBtn: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  trackBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  reorderBtn: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  reorderBtnText: {
    color: '#9ca3af',
    fontWeight: '900',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
});

export default OrderHistoryScreen;
