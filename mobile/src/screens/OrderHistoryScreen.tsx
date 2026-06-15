import { Package, RotateCcw, ArrowRight, ArrowLeft } from 'lucide-react-native';
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, Alert, Linking, Platform } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useDispatch } from 'react-redux';
import { addItem } from '../store/slices/cartSlice';
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const hapticOptions = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };

const OrderHistoryScreen = ({ navigation }: any) => {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  
  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['order-history'],
    queryFn: () => api.get('/orders/mine'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.post(`/orders/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-history'] });
      Alert.alert('Cancelled', 'Order cancelled successfully.');
    },
    onError: () => Alert.alert('Error', 'Could not cancel the order.')
  });

  const orders = ordersData?.orders || [];

  if (isLoading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#10B981" />
      <Text style={styles.loadingText}>Fetching Orders...</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 16, 40) }]}>
        <TouchableOpacity 
          style={styles.backBtn}
          onPress={() => {
              ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
              navigation.goBack();
          }}
        >
          <ArrowLeft size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <View style={{ marginLeft: 16 }}>
            <Text style={styles.headerTitle}>Your Orders</Text>
            <Text style={styles.headerSub}>Past & Active Deliveries</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {orders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrapper}>
              <Package size={32} color="#10B981" />
            </View>
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptySubText}>Your delicious journey is just one tap away.</Text>
            <TouchableOpacity 
              style={styles.browseBtn}
              onPress={() => navigation.navigate('Home')}
            >
              <Text style={styles.browseBtnText}>Browse Menu</Text>
            </TouchableOpacity>
          </View>
        ) : (
          orders.map((order: any, index: number) => (
            <Animated.View key={order.id} entering={FadeInDown.delay(index * 100)} layout={Layout.springify()}>
                <TouchableOpacity 
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
                      backgroundColor: order.status === 'delivered' ? '#ECFDF5' : 
                                       order.status === 'cancelled' ? '#FEF2F2' : 
                                       '#F3F4F6'
                    }]}>
                      <Text style={[styles.statusBadgeText, { 
                        color: order.status === 'delivered' ? '#10B981' : 
                               order.status === 'cancelled' ? '#EF4444' : 
                               '#1A1A2E'
                      }]}>
                        {order.status.replace(/_/g, ' ')}
                      </Text>
                    </View>
                  </View>

                  {order.items && order.items.length > 0 && (
                      <View style={styles.itemsListContainer}>
                        {order.items.map((item: any, idx: number) => (
                          <View key={idx} style={styles.itemRow}>
                            <View style={styles.itemBadge}>
                                <Text style={styles.itemQty}>{item.quantity}x</Text>
                            </View>
                            <Text style={styles.itemName} numberOfLines={1}>{item.menu_item_name}</Text>
                          </View>
                        ))}
                      </View>
                  )}

                  <View style={styles.orderCardFooter}>
                    <View>
                      <Text style={styles.footerLabel}>Total Paid</Text>
                      <Text style={styles.footerValue}>₹{order.total_amount_paise / 100}</Text>
                    </View>
                    
                    {!['delivered', 'cancelled'].includes(order.status) ? (
                      <View style={{ flexDirection: 'row' }}>
                          {['pending_payment', 'confirmed'].includes(order.status) && (
                              <TouchableOpacity 
                                style={[styles.trackBtn, { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EF4444', marginRight: 8 }]}
                                onPress={() => {
                                    Alert.alert('Cancel Order', 'Are you sure you want to cancel?', [
                                        { text: 'No', style: 'cancel' },
                                        { text: 'Yes, Cancel', style: 'destructive', onPress: () => cancelMutation.mutate(order.id) }
                                    ]);
                                }}
                              >
                                <Text style={[styles.trackBtnText, { color: '#EF4444' }]}>Cancel</Text>
                              </TouchableOpacity>
                          )}
                          <TouchableOpacity 
                            style={styles.trackBtn}
                            onPress={() => {
                                ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
                                navigation.navigate('OrderTracking', { orderId: order.id });
                            }}
                          >
                            <Text style={styles.trackBtnText}>Track Order</Text>
                            <ArrowRight size={14} color="white" style={{ marginLeft: 6 }} />
                          </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row' }}>
                        {order.invoice_url && (
                            <TouchableOpacity 
                                style={[styles.reorderBtn, { marginRight: 8, backgroundColor: '#ECFDF5' }]}
                                onPress={() => Linking.openURL(order.invoice_url)}
                            >
                                <Text style={[styles.reorderBtnText, { color: '#10B981' }]}>Invoice</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity 
                            style={styles.reorderBtn}
                            onPress={async () => {
                              ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
                              try {
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
                                Alert.alert('Reorder', 'Add these items to your cart?', [
                                  { text: 'Cancel', style: 'cancel' },
                                  { text: 'Add to Cart', onPress: addItems }
                                ]);
                              } catch (e) {
                                Alert.alert('Error', 'Could not validate menu availability. Please try again.');
                              }
                            }}
                        >
                            <RotateCcw size={14} color="#1A1A2E" style={{ marginRight: 6 }} />
                            <Text style={styles.reorderBtnText}>Reorder</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
            </Animated.View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  loadingContainer: { flex: 1, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 16, color: '#9CA3AF', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, fontSize: 10 },
  header: { paddingHorizontal: 24, paddingBottom: 24, flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 40, height: 40, backgroundColor: '#FFFFFF', borderRadius: 20, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  headerTitle: { color: '#1A1A2E', fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  headerSub: { color: '#9CA3AF', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, fontSize: 10, marginTop: 4 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },
  
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyIconWrapper: { width: 80, height: 80, backgroundColor: '#FFFFFF', borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  emptyTitle: { color: '#1A1A2E', fontSize: 20, fontWeight: '900' },
  emptySubText: { color: '#6B7280', textAlign: 'center', marginTop: 8, paddingHorizontal: 40, fontWeight: '500' },
  browseBtn: { marginTop: 32, backgroundColor: '#10B981', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 24, shadowColor: '#10B981', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 8 },
  browseBtnText: { color: '#fff', fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, fontSize: 12 },
  
  orderCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  orderCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  orderIdText: { color: '#1A1A2E', fontSize: 16, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  orderDateText: { color: '#9CA3AF', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  statusBadgeText: { fontWeight: '900', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 },
  
  itemsListContainer: { marginBottom: 20, backgroundColor: '#F9FAFB', padding: 12, borderRadius: 16 },
  itemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  itemBadge: { backgroundColor: '#FFFFFF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginRight: 8, borderWidth: 1, borderColor: '#F3F4F6' },
  itemQty: { color: '#10B981', fontWeight: '900', fontSize: 11 },
  itemName: { color: '#4B5563', fontWeight: '600', fontSize: 13, flex: 1 },
  
  orderCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  footerLabel: { color: '#9CA3AF', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  footerValue: { color: '#1A1A2E', fontWeight: '900', fontSize: 18, marginTop: 2 },
  
  trackBtn: { backgroundColor: '#10B981', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, flexDirection: 'row', alignItems: 'center' },
  trackBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  reorderBtn: { backgroundColor: '#F3F4F6', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, flexDirection: 'row', alignItems: 'center' },
  reorderBtnText: { color: '#1A1A2E', fontWeight: '800', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
});

export default OrderHistoryScreen;
