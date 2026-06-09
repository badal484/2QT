import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StatusBar, StyleSheet } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { logout } from '../store/slices/authSlice';
import { Timer, ChefHat, Bell, LogOut, Info, CheckCircle2 } from 'lucide-react-native';
import { getSocket } from '../socket/client';
import { useEffect } from 'react';

const KitchenBoardScreen = () => {
  const queryClient = useQueryClient();
  const dispatch = useDispatch();

  useEffect(() => {
    const socket = getSocket();
    if (socket) {
      socket.on('new_order', () => {
        queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] });
      });
      socket.on('order_updated', () => {
        queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] });
      });
      return () => {
        socket.off('new_order');
        socket.off('order_updated');
      };
    }
  }, [queryClient]);

  const { data: menuData } = useQuery({
    queryKey: ['kitchen-menu'],
    queryFn: () => api.get('/kitchen/menu'),
  });

  const pauseMutation = useMutation({
    mutationFn: (paused: boolean) => api.patch('/kitchen/status', { paused, reason: 'Chef decided to take a break.' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kitchen-menu'] }),
  });

  const toggleItemMutation = useMutation({
    mutationFn: ({ itemId, available }: { itemId: string; available: boolean }) => 
      api.patch(`/kitchen/menu/${itemId}/availability`, { available }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kitchen-menu'] }),
  });

  if (isLoading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FF6B35" />
      <Text style={styles.loadingText}>Synchronizing Command</Text>
    </View>
  );

  const incomingOrders = orders?.orders?.filter((o: any) => o.status === 'confirmed') || [];
  const activeOrders = orders?.orders?.filter((o: any) => o.status === 'preparing' || o.status === 'at_kitchen' || o.status === 'ready_for_pickup') || [];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <ScrollView style={styles.scrollView}>
        {/* Header Section */}
        <SafeAreaView edges={['top', 'left', 'right']}>
          <View style={styles.header}>
            <View>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: menuData?.kitchenPaused ? '#EF4444' : '#00D084' }]} />
                <Text style={styles.statusText}>{menuData?.kitchenPaused ? 'Operations Paused' : 'Operations Live'}</Text>
              </View>
              <Text style={styles.headerTitle}>Kitchen Command</Text>
            </View>
            <View style={{ flexDirection: 'row' }}>
                <TouchableOpacity 
                    activeOpacity={0.7}
                    style={[styles.commandButton, { backgroundColor: menuData?.kitchenPaused ? '#00D084' : '#EF4444', marginRight: 12 }]}
                    onPress={() => pauseMutation.mutate(!menuData?.kitchenPaused)}
                >
                    <Text style={styles.commandButtonText}>{menuData?.kitchenPaused ? 'RESUME' : 'PAUSE'}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    activeOpacity={0.7}
                    style={styles.logoutButton}
                    onPress={() => dispatch(logout())}
                >
                    <LogOut size={20} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>

        {/* Quick Inventory Management */}
        <View style={styles.inventorySection}>
            <Text style={styles.sectionLabel}>Quick Inventory</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.inventoryScroll}>
                {menuData?.items?.map((item: any) => (
                    <TouchableOpacity 
                        key={item.id}
                        onPress={() => toggleItemMutation.mutate({ itemId: item.id, available: !item.available })}
                        style={[styles.inventoryChip, !item.available && styles.inventoryChipDisabled]}
                    >
                        <Text style={[styles.inventoryText, !item.available && styles.inventoryTextDisabled]}>
                            {item.name} {item.available ? '✓' : '✗'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>

        {/* Incoming Orders Horizontal Strip */}
        <View style={styles.incomingSection}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderLeft}>
              <Text style={styles.sectionLabel}>Incoming</Text>
              {incomingOrders.length > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{incomingOrders.length}</Text>
                </View>
              )}
            </View>
          </View>
          
          <ScrollView 
            horizontal 
            style={styles.horizontalScroll}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScrollContent}
          >
            {incomingOrders.map((order: any) => (
              <TouchableOpacity 
                key={order.id} 
                activeOpacity={0.9}
                onPress={() => claimMutation.mutate(order.id)}
                style={styles.incomingCard}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.idBadge}>
                    <Text style={styles.idText}>{order.display_id}</Text>
                  </View>
                  <Text style={styles.timeLabel}>Just In</Text>
                </View>
                
                <View style={styles.itemsPreview}>
                  {order.items?.map((item: any, idx: number) => (
                    <Text key={idx} style={styles.previewItemText} numberOfLines={1}>• {item.quantity}x {item.name}</Text>
                  ))}
                </View>

                <View style={styles.acceptButton}>
                  <ChefHat size={14} color="white" style={{ marginRight: 8 }} />
                  <Text style={styles.acceptButtonText}>Accept & Start</Text>
                </View>
              </TouchableOpacity>
            ))}
            
            {incomingOrders.length === 0 && (
              <View style={styles.emptyIncoming}>
                <Bell size={20} color="white" />
                <Text style={styles.emptyIncomingText}>Awaiting Orders</Text>
              </View>
            )}
          </ScrollView>
        </View>

        {/* Active Orders Section */}
        <View style={styles.activeSection}>
          <Text style={styles.sectionLabelLarge}>In Preparation</Text>
          
          {activeOrders.map((order: any) => (
            <View key={order.id} style={styles.activeCard}>
              <View style={styles.activeCardHeader}>
                <View>
                  <Text style={styles.activeId}>{order.display_id}</Text>
                  <View style={styles.statusRowSmall}>
                    <View style={[styles.statusTag, { backgroundColor: order.status === 'preparing' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(0, 208, 132, 0.1)' }]}>
                      <Text style={[styles.statusTagText, { color: order.status === 'preparing' ? '#F59E0B' : '#00D084' }]}>
                        ● {order.status.replace(/_/g, ' ')}
                      </Text>
                    </View>
                    {order.is_scheduled && (
                      <View style={styles.scheduledTag}>
                        <Timer size={10} color="#3B82F6" style={{ marginRight: 4 }} />
                        <Text style={styles.scheduledText}>
                          Sched: {new Date(order.scheduled_for).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <Text style={styles.orderTimeText}>{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
              
                <View style={styles.fullItemsList}>
                  {order.items?.map((item: any, idx: number) => (
                    <View key={idx} style={styles.fullItemRow}>
                      <Text style={styles.fullItemText}>{item.quantity}x {item.name}</Text>
                      <CheckCircle2 size={16} color="rgba(255,255,255,0.1)" />
                    </View>
                  ))}
                </View>

                {order.special_instructions && (
                  <View style={styles.instructionBox}>
                    <Info size={16} color="#EF4444" style={{ marginRight: 12, marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.instructionHeader}>Customer Note</Text>
                      <Text style={styles.instructionText}>{order.special_instructions}</Text>
                    </View>
                  </View>
                )}

              {order.status === 'preparing' ? (
                <TouchableOpacity 
                  activeOpacity={0.8}
                  style={styles.completeButton}
                  onPress={() => updateStatusMutation.mutate({ orderId: order.id, status: 'ready_for_pickup' })}
                >
                  <Text style={styles.completeButtonText}>Complete & Ready</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.waitingState}>
                  <Text style={styles.waitingText}>Waiting for Rider</Text>
                </View>
              )}
            </View>
          ))}

          {activeOrders.length === 0 && (
            <View style={styles.emptyActive}>
              <ChefHat size={60} color="white" strokeWidth={1} />
              <Text style={styles.emptyActiveText}>The Floor is Clear</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 24,
    color: 'rgba(255,255,255,0.2)',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 5,
    fontSize: 10,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00D084',
    marginRight: 8,
    shadowColor: '#00D084',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  statusText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 3,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
  },
  logoutButton: {
    width: 48,
    height: 48,
    backgroundColor: '#111',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  commandButton: {
    paddingHorizontal: 20,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commandButtonText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 2,
  },
  inventorySection: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  inventoryScroll: {
    paddingTop: 12,
  },
  inventoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  inventoryChipDisabled: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  inventoryText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  inventoryTextDisabled: {
    color: '#EF4444',
  },
  incomingSection: {
    paddingVertical: 16,
  },
  sectionHeaderRow: {
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 4,
  },
  countBadge: {
    backgroundColor: '#FF6B35',
    marginLeft: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  countText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
  },
  horizontalScroll: {
    paddingLeft: 24,
  },
  horizontalScrollContent: {
    paddingRight: 40,
  },
  incomingCard: {
    backgroundColor: '#151515',
    borderRadius: 24,
    padding: 20,
    marginRight: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    width: 280,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  idBadge: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  idText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: -0.5,
  },
  timeLabel: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  itemsPreview: {
    marginBottom: 16,
    height: 80,
  },
  previewItemText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  acceptButton: {
    backgroundColor: '#FF6B35',
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  acceptButtonText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  emptyIncoming: {
    paddingVertical: 40,
    paddingHorizontal: 16,
    opacity: 0.2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyIncomingText: {
    color: '#fff',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 10,
    marginLeft: 12,
  },
  activeSection: {
    paddingHorizontal: 24,
    paddingBottom: 80,
  },
  sectionLabelLarge: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 4,
    marginBottom: 24,
  },
  activeCard: {
    backgroundColor: '#0D0D0D',
    borderRadius: 32,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 10,
  },
  activeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  activeId: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
    marginBottom: 4,
  },
  statusRowSmall: {
    flexDirection: 'row',
  },
  statusTag: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  statusTagText: {
    fontWeight: '900',
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  scheduledTag: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  scheduledText: {
    color: '#3B82F6',
    fontWeight: '900',
    fontSize: 8,
    textTransform: 'uppercase',
  },
  orderTimeText: {
    color: 'rgba(255,255,255,0.2)',
    fontWeight: '700',
    fontSize: 12,
  },
  fullItemsList: {
    marginBottom: 24,
  },
  fullItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fullItemText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '700',
  },
  instructionBox: {
    marginBottom: 24,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    flexDirection: 'row',
  },
  instructionHeader: {
    color: '#EF4444',
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 4,
  },
  instructionText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
    lineHeight: 20,
  },
  completeButton: {
    backgroundColor: '#00D084',
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00D084',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 5,
  },
  completeButtonText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  waitingState: {
    height: 64,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  waitingText: {
    color: 'rgba(255,255,255,0.2)',
    fontWeight: '900',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  emptyActive: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    opacity: 0.1,
  },
  emptyActiveText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 8,
    marginTop: 24,
  },
});

export default KitchenBoardScreen;
