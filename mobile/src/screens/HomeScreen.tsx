import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, Dimensions, StyleSheet } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RootState } from '../store';
import { api } from '../api/client';
import { getSocket } from '../socket/client';
import { addItem, setQuantity, setAddress, setZone } from '../store/slices/cartSlice';
import { MapPin, User, Search, PackageOpen, ChefHat, ArrowRight, ChevronDown, Sparkles } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const HomeScreen = ({ navigation }: any) => {
  const { user } = useSelector((state: RootState) => state.auth);
  const { items: cartItems, zoneId, addressId } = useSelector((state: RootState) => state.cart);
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const socket = getSocket();
  const [selectedCategory, setSelectedCategory] = useState('All');

  React.useEffect(() => {
    if (socket && zoneId) {
      socket.on('menu_updated', (data) => {
        if (data.zoneId === zoneId) {
          queryClient.invalidateQueries({ queryKey: ['menu', zoneId] });
        }
      });
    }
    return () => {
      if (socket) socket.off('menu_updated');
    };
  }, [socket, zoneId]);

  const { data: subsData } = useQuery({
    queryKey: ['my-subscriptions'],
    queryFn: () => api.get('/customers/subscriptions/my'),
    enabled: !!user,
  });

  const activeSub = subsData?.subscriptions?.[0];

  const { data: menuData, isLoading } = useQuery({
    queryKey: ['menu', zoneId || user?.zoneId],
    queryFn: () => api.get(`/menu?zoneId=${zoneId || user?.zoneId}`),
    enabled: !!(zoneId || user?.zoneId),
  });

  const { data: addresses } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => api.get('/customers/addresses'),
    enabled: !!user,
  });

  const selectedAddress = addresses?.addresses?.find((a: any) => a.id === addressId);

  React.useEffect(() => {
    if (!addressId && addresses?.addresses?.length > 0) {
      const defaultAddr = addresses.addresses.find((a: any) => a.is_serviceable) || addresses.addresses[0];
      if (defaultAddr) {
        dispatch(setAddress(defaultAddr.id));
        dispatch(setZone(defaultAddr.zone_id));
      }
    }
  }, [addresses, addressId]);

  const categories = ['All', ...new Set((menuData?.items || []).map((item: any) => item.category))];

  const filteredItems = selectedCategory === 'All' 
    ? menuData?.items 
    : menuData?.items.filter((item: any) => item.category === selectedCategory);

  const cartTotal = cartItems.reduce((acc, item) => acc + item.quantity * item.pricePaise, 0);

  if (isLoading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FF6B35" />
      <Text style={styles.loadingText}>Preparing Menu</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Premium Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.addressBar}
          onPress={() => navigation.navigate('Address')}
        >
          <View style={styles.addressIconWrapper}>
            <MapPin size={20} color="#FF6B35" />
          </View>
          <View style={styles.addressTextColumn}>
            <Text style={styles.addressLabel}>Deliver to</Text>
            <View style={styles.addressValueRow}>
              <Text style={styles.addressValue} numberOfLines={1}>
                {selectedAddress ? `${selectedAddress.label} - ${selectedAddress.address_text}` : 'Select Location'}
              </Text>
              <ChevronDown size={14} color="#1A1A2E" style={{ marginLeft: 4, marginTop: 2 }} />
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.profileButton}
          onPress={() => navigation.navigate('ProfileTab')}
        >
          {user?.photo_url ? (
            <Image source={{ uri: user.photo_url }} style={styles.profileImage} />
          ) : (
            <Text style={styles.profileInitial}>
              {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView}>
        {/* Search Bar Placeholder */}
        <TouchableOpacity 
          style={styles.searchPlaceholder}
          onPress={() => navigation.navigate('Search')}
        >
          <Search size={20} color="#9CA3AF" style={{ marginRight: 12 }} />
          <Text style={styles.searchPlaceholderText}>Search for "Dal Tadka" or "Paneer"...</Text>
        </TouchableOpacity>

        {/* Kitchen Status Banner */}
        {menuData?.kitchenPaused && (
          <View style={styles.kitchenPausedBanner}>
            <ChefHat size={20} color="#fff" style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.pausedTitle}>Kitchen is currently paused</Text>
              <Text style={styles.pausedReason}>{menuData.pauseReason || 'Taking a short break to catch up on orders.'}</Text>
            </View>
          </View>
        )}

        {/* Membership Card / Promo */}
        {!menuData?.kitchenPaused && (
          activeSub ? (
            <TouchableOpacity 
              activeOpacity={0.9}
              style={styles.membershipCard}
              onPress={() => navigation.navigate('Subscription')}
            >
              <View style={{ flex: 1 }}>
                <View style={styles.proBadgeRow}>
                  <Sparkles size={14} color="#FF6B35" />
                  <Text style={styles.proBadgeText}>Velto Pro Member</Text>
                </View>
                <Text style={styles.planName}>{activeSub.plan_id?.replace('sub_', '').toUpperCase() || 'ACTIVE PLAN'}</Text>
                <Text style={styles.planStatus}>{activeSub.remaining_meals} meals left • {activeSub.current_day_credits} credit today</Text>
              </View>
              <View style={styles.membershipArrow}>
                <ArrowRight size={24} color="white" />
              </View>
            </TouchableOpacity>
          ) : !menuData?.items?.length ? null : (
            <View style={styles.promoBanner}>
              <View style={styles.promoContent}>
                <Text style={styles.promoTag}>Limited Offer</Text>
                <Text style={styles.promoTitle}>Get 50% OFF on{"\n"}your first order!</Text>
                <TouchableOpacity style={styles.promoButton} onPress={() => navigation.navigate('Subscription')}>
                  <Text style={styles.promoButtonText}>Claim Now</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.promoDecoration} />
            </View>
          )
        )}

        {/* Categories Chips */}
        <View>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesScroll}
          >
            {categories.map((cat: any) => (
              <TouchableOpacity 
                key={cat}
                onPress={() => setSelectedCategory(cat)}
                style={[styles.categoryChip, { backgroundColor: selectedCategory === cat ? '#1A1A2E' : '#fff', borderColor: selectedCategory === cat ? '#1A1A2E' : '#f3f4f6' }]}
              >
                <Text style={[styles.categoryChipText, { color: selectedCategory === cat ? '#fff' : '#9ca3af' }]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Items List */}
        <View style={styles.itemsContainer}>
          {(!filteredItems || filteredItems.length === 0) ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrapper}>
                <PackageOpen size={48} color="#FF6B35" />
              </View>
              <Text style={styles.emptyStateTitle}>
                {!(zoneId || user?.zoneId) ? 'Where are we sending food?' : 'Chef is busy preparing more!'}
              </Text>
              <Text style={styles.emptyStateSub}>
                {!(zoneId || user?.zoneId) 
                  ? 'Set your location to see the curated menu for your area.' 
                  : 'Try another category or come back in a few minutes.'}
              </Text>
              {!(zoneId || user?.zoneId) && (
                <TouchableOpacity 
                  style={styles.selectAddressButton}
                  onPress={() => navigation.navigate('Address')}
                >
                  <Text style={styles.selectAddressButtonText}>Select Address</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              <Text style={styles.sectionHeader}>
                {selectedCategory === 'All' ? 'Signature Menu' : selectedCategory}
              </Text>
              {filteredItems.map((item: any) => {
                const cartItem = cartItems.find(ci => ci.menuItemId === item.id);
                return (
                  <TouchableOpacity 
                    key={item.id}
                    activeOpacity={item.available ? 0.9 : 1}
                    onPress={() => item.available && navigation.navigate('ItemDetail', { item })}
                    style={[styles.itemCard, !item.available && { opacity: 0.6 }]}
                  >
                    <View style={styles.itemImageWrapper}>
                      {item.photo_url ? (
                        <Image source={{ uri: item.photo_url }} style={styles.itemImage} />
                      ) : (
                        <View style={styles.itemImagePlaceholder}>
                          <ChefHat size={32} color="#FF6B35" opacity={0.5} />
                        </View>
                      )}
                      {!item.available && (
                        <View style={styles.soldOutOverlay}>
                          <Text style={styles.soldOutText}>Sold Out</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.itemDetails}>
                      <View>
                        <View style={styles.itemNameRow}>
                          <View style={[styles.vegIndicator, { borderColor: item.is_veg ? '#22C55E' : '#EF4444' }]}>
                            <View style={[styles.vegDot, { backgroundColor: item.is_veg ? '#22C55E' : '#EF4444' }]} />
                          </View>
                          <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                        </View>
                        <Text style={styles.itemDesc} numberOfLines={2}>{item.description}</Text>
                      </View>
                      
                      <View style={styles.itemFooter}>
                        <View>
                          <Text style={styles.itemPrice}>₹{item.price_paise / 100}</Text>
                        </View>
                        
                        {cartItem ? (
                          <View style={styles.quantityControl}>
                            <TouchableOpacity onPress={() => dispatch(setQuantity({ menuItemId: item.id, quantity: cartItem.quantity - 1 }))}>
                              <Text style={styles.quantityButtonText}>−</Text>
                            </TouchableOpacity>
                            <Text style={styles.quantityValue}>{cartItem.quantity}</Text>
                            <TouchableOpacity onPress={() => dispatch(setQuantity({ menuItemId: item.id, quantity: cartItem.quantity + 1 }))}>
                              <Text style={styles.quantityButtonText}>+</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity 
                            style={[styles.addButton, (!item.available || menuData?.kitchenPaused) && styles.addButtonDisabled]}
                            disabled={!item.available || menuData?.kitchenPaused}
                            onPress={() => dispatch(addItem({ 
                              menuItemId: item.id, 
                              name: item.name, 
                              pricePaise: item.price_paise, 
                              quantity: 1,
                              photoUrl: item.photo_url,
                              isVeg: item.is_veg,
                              kitchenId: item.kitchen_id
                            }))}
                          >
                            <Text style={[styles.addButtonText, (!item.available || menuData?.kitchenPaused) && styles.addButtonTextDisabled]}>
                              {menuData?.kitchenPaused ? 'Paused' : item.available ? 'Add' : 'Out'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}
        </View>
      </ScrollView>

      {/* View Cart Button (Floating) */}
      {cartItems.length > 0 && (
        <View style={styles.floatingCartContainer}>
          <TouchableOpacity 
            style={styles.floatingCartButton}
            onPress={() => navigation.navigate('Cart')}
          >
            <View>
              <Text style={styles.cartCountText}>{cartItems.length} Item{cartItems.length > 1 ? 's' : ''}</Text>
              <Text style={styles.cartTotalText}>₹{cartTotal / 100}</Text>
            </View>
            <View style={styles.viewCartAction}>
              <Text style={styles.viewCartText}>View Cart</Text>
              <ArrowRight size={16} color="white" />
            </View>
          </TouchableOpacity>
        </View>
      )}
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
    paddingHorizontal: 24,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  addressIconWrapper: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255, 107, 53, 0.05)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  addressTextColumn: {
    flex: 1,
  },
  addressLabel: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  addressValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addressValue: {
    color: '#1A1A2E',
    fontSize: 15,
    fontWeight: '900',
  },
  profileButton: {
    width: 44,
    height: 44,
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
    overflow: 'hidden',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  profileInitial: {
    color: '#fff',
    fontWeight: '900',
  },
  scrollView: {
    flex: 1,
  },
  searchPlaceholder: {
    marginHorizontal: 24,
    marginTop: 8,
    marginBottom: 24,
    backgroundColor: '#f9fafb',
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  searchPlaceholderText: {
    color: '#9ca3af',
    fontWeight: '700',
    fontSize: 14,
  },
  membershipCard: {
    marginHorizontal: 24,
    marginBottom: 32,
    padding: 24,
    backgroundColor: '#1A1A2E',
    borderRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  proBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  proBadgeText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginLeft: 8,
  },
  planName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
  },
  planStatus: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
  membershipArrow: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoBanner: {
    marginHorizontal: 24,
    marginBottom: 32,
    height: 160,
    backgroundColor: '#FF6B35',
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 6,
  },
  promoContent: {
    padding: 24,
    justifyContent: 'center',
    flex: 1,
  },
  promoTag: {
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 10,
  },
  promoTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 4,
  },
  promoButton: {
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 12,
  },
  promoButtonText: {
    color: '#FF6B35',
    fontWeight: '900',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  promoDecoration: {
    position: 'absolute',
    right: -16,
    bottom: -16,
    width: 128,
    height: 128,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 64,
  },
  categoriesScroll: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  categoryChip: {
    marginRight: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  categoryChipText: {
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 10,
  },
  kitchenPausedBanner: {
    backgroundColor: '#1A1A2E',
    marginHorizontal: 24,
    marginBottom: 24,
    padding: 20,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  pausedTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  pausedReason: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  itemsContainer: {
    paddingHorizontal: 24,
    paddingBottom: 128,
  },
  sectionHeader: {
    color: '#1A1A2E',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 24,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  itemCard: {
    flexDirection: 'row',
    marginBottom: 24,
    backgroundColor: '#fff',
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  itemImageWrapper: {
    width: 112,
    height: 112,
    backgroundColor: '#f9fafb',
    borderRadius: 20,
    overflow: 'hidden',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  itemImagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 107, 53, 0.05)',
  },
  itemDetails: {
    flex: 1,
    marginLeft: 20,
    justifyContent: 'space-between',
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  vegIndicator: {
    width: 14,
    height: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  vegDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  itemName: {
    color: '#1A1A2E',
    fontSize: 17,
    fontWeight: '900',
    flex: 1,
    letterSpacing: -0.5,
  },
  itemDesc: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
  },
  itemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemPrice: {
    color: '#FF6B35',
    fontSize: 18,
    fontWeight: '900',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  quantityButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    paddingHorizontal: 12,
  },
  quantityValue: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 15,
  },
  addButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#FF6B35',
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 12,
  },
  addButtonDisabled: {
    borderColor: '#E5E7EB',
  },
  addButtonText: {
    color: '#FF6B35',
    fontWeight: '900',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  addButtonTextDisabled: {
    color: '#9CA3AF',
  },
  soldOutOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soldOutText: {
    backgroundColor: '#1A1A2E',
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    letterSpacing: 1,
  },
  emptyState: {
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconWrapper: {
    width: 96,
    height: 96,
    backgroundColor: 'rgba(255, 107, 53, 0.05)',
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyStateTitle: {
    color: '#1A1A2E',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  emptyStateSub: {
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 32,
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 20,
  },
  selectAddressButton: {
    marginTop: 32,
    backgroundColor: '#FF6B35',
    paddingHorizontal: 40,
    paddingVertical: 20,
    borderRadius: 20,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 5,
  },
  selectAddressButtonText: {
    color: '#fff',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 12,
  },
  floatingCartContainer: {
    position: 'absolute',
    bottom: 40,
    left: 24,
    right: 24,
  },
  floatingCartButton: {
    height: 72,
    backgroundColor: '#1A1A2E',
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  cartCountText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  cartTotalText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  viewCartAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B35',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  viewCartText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginRight: 8,
  },
});

export default HomeScreen;
