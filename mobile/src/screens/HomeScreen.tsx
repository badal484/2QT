import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, StyleSheet, TextInput, Switch, Alert, Platform } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RootState } from '../store';
import { api } from '../api/client';
import { getSocket } from '../socket/client';
import { addItem, setQuantity, setAddress, setZone } from '../store/slices/cartSlice';
import { MapPin, User, Search, PackageOpen, ChefHat, ArrowRight, ChevronDown, Sparkles, Navigation, Star, Clock } from 'lucide-react-native';
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import Animated, { FadeInDown, FadeIn, Layout, BounceIn, useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';
import { useLocation } from '../hooks/useLocation';
import { NetworkImage } from '../components/NetworkImage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

const SkeletonItem = () => {
  const opacity = useSharedValue(0.3);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.7, { duration: 800 }), -1, true);
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[styles.skeletonRow, style]}>
      <View style={styles.skeletonImageCol}>
        <View style={{width: 100, height: 100, backgroundColor: '#F3F4F6', borderRadius: 20}} />
      </View>
      <View style={styles.skeletonInfoCol}>
        <View style={{width: '70%', height: 16, backgroundColor: '#E5E7EB', borderRadius: 4, marginBottom: 8}} />
        <View style={{width: '40%', height: 14, backgroundColor: '#E5E7EB', borderRadius: 4, marginBottom: 12}} />
        <View style={{width: '90%', height: 10, backgroundColor: '#F3F4F6', borderRadius: 2, marginBottom: 4}} />
        <View style={{width: '60%', height: 10, backgroundColor: '#F3F4F6', borderRadius: 2}} />
      </View>
    </Animated.View>
  );
};

const HomeScreen = ({ navigation }: any) => {
  const { user } = useSelector((state: RootState) => state.auth);
  const { items: cartItems, zoneId, addressId } = useSelector((state: RootState) => state.cart);
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const socket = getSocket();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isVegOnly, setIsVegOnly] = useState(false);
  const [unserviceableLocation, setUnserviceableLocation] = useState(false);
  const { location, loadingLocation, locationError, fetchLocation } = useLocation();
  const hasAttemptedLocationRef = useRef(false);
  const insets = useSafeAreaInsets();

  const pulseAnim = useSharedValue(0.2);
  useEffect(() => {
      pulseAnim.value = withRepeat(withTiming(1, { duration: 1000 }), -1, true);
  }, []);
  const liveDotStyle = useAnimatedStyle(() => ({
      transform: [{ scale: pulseAnim.value }],
      opacity: 1 - pulseAnim.value
  }));

  useEffect(() => {
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

  useEffect(() => {
    if (!addressId) {
      if (addresses?.addresses?.length > 0) {
        const defaultAddr = addresses.addresses.find((a: any) => a.is_serviceable) || addresses.addresses[0];
        if (defaultAddr) {
          dispatch(setAddress(defaultAddr.id));
          dispatch(setZone(defaultAddr.zone_id));
          setUnserviceableLocation(false);
          return;
        }
      }
      
      if (!location && !hasAttemptedLocationRef.current) {
        hasAttemptedLocationRef.current = true;
        fetchLocation();
      }
    }
  }, [addresses, addressId, location, fetchLocation]);

  useEffect(() => {
    if (!addressId && location && !zoneId) {
      const checkZone = async () => {
        try {
          const res = await api.get(`/menu/zones/check?lat=${location.latitude}&lng=${location.longitude}`);
          if (res.serviceable && res.zone) {
            dispatch(setZone(res.zone.id));
            setUnserviceableLocation(false);
          } else {
            setUnserviceableLocation(true);
          }
        } catch (e) {
          console.log('Zone check failed', e);
        }
      };
      checkZone();
    }
  }, [location, addressId, zoneId]);

  const handleAddToCart = (item: any) => {
    if (cartItems.length > 0 && cartItems[0].kitchenId !== item.kitchen_id) {
      Alert.alert(
        'Clear Cart?',
        'Your cart contains items from a different kitchen. Would you like to clear your cart and add this item instead?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Clear & Add', 
            style: 'destructive',
            onPress: () => {
              triggerHaptic();
              dispatch(addItem({ 
                menuItemId: item.id, name: item.name, pricePaise: item.price_paise, 
                quantity: 1, photoUrl: item.photo_url, isVeg: item.is_veg, kitchenId: item.kitchen_id
              }));
            }
          }
        ]
      );
    } else {
      triggerHaptic();
      dispatch(addItem({ 
        menuItemId: item.id, name: item.name, pricePaise: item.price_paise, 
        quantity: 1, photoUrl: item.photo_url, isVeg: item.is_veg, kitchenId: item.kitchen_id
      }));
    }
  };

  const categories = ['All', ...new Set((menuData?.items || []).map((item: any) => item.category))];

  const filteredItems = useMemo(() => {
    if (!menuData?.items) return [];
    return menuData.items.filter((item: any) => {
      if (selectedCategory !== 'All' && item.category !== selectedCategory) return false;
      if (isVegOnly && !item.is_veg) return false;
      if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [menuData?.items, selectedCategory, isVegOnly, searchQuery]);

  const cartTotal = cartItems.reduce((acc, item) => acc + item.quantity * item.pricePaise, 0);

  const triggerHaptic = () => ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);

  return (
    <View style={styles.container}>
      {/* ULTRA CLEAN HEADER */}
      <View style={[styles.minimalHeader, { paddingTop: Math.max(insets.top + 12, 50) }]}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity 
            style={styles.addressSection}
            onPress={() => {
              triggerHaptic();
              navigation.navigate('Address');
            }}
          >
            <View style={styles.addressRow}>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <Text style={styles.locationTitle}>Delivering to</Text>
                <ChevronDown size={14} color="#1A1A2E" style={{ marginLeft: 4 }} />
              </View>
              <Text style={styles.addressValue} numberOfLines={1}>
                {selectedAddress 
                  ? selectedAddress.address_text
                  : location 
                    ? location.addressText 
                    : loadingLocation 
                      ? 'Locating you...' 
                      : 'Select Location'}
              </Text>
            </View>
          </TouchableOpacity>
          
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.profileButton}
              onPress={() => {
                triggerHaptic();
                navigation.navigate('ProfileTab');
              }}
            >
              {user?.photo_url ? (
                <NetworkImage uri={user.photo_url} style={styles.profileImage} fallbackText={user?.name ? user.name.charAt(0).toUpperCase() : '?'} />
              ) : (
                <User size={20} color="#10B981" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* LIVE CLOUD KITCHEN BANNER */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <TouchableOpacity 
            style={styles.liveKitchenBanner}
            onPress={() => {
              triggerHaptic();
              navigation.navigate('LiveKitchen');
            }}
            activeOpacity={0.9}
          >
           <View style={styles.liveDotWrapper}>
              <Animated.View style={[styles.liveDot, liveDotStyle]} />
              <View style={styles.liveDotCore} />
           </View>
           <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={styles.liveKitchenText}>LIVE FROM</Text>
              <Text style={styles.liveKitchenTitle}>Velto Kitchen • Zone {zoneId || 'A'}</Text>
           </View>
           <View style={styles.deliveryTimeBadge}>
              <Text style={styles.deliveryTimeText}>10-15</Text>
              <Text style={styles.deliveryTimeSub}>MINS</Text>
           </View>
          </TouchableOpacity>
        </Animated.View>

        {/* INTEGRATED SEARCH BAR (SWISH STYLE) */}
        <View style={styles.searchBarContainer}>
          <Search size={20} color="#10B981" style={{ marginRight: 12 }} />
          <TextInput
            placeholder='Search for a craving...'
            placeholderTextColor="#9CA3AF"
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <View style={styles.vegToggleContainer}>
            <View style={styles.vegToggleWrapper}>
              <Text style={[styles.vegText, isVegOnly && styles.vegTextActive]}>VEG</Text>
              <Switch
                value={isVegOnly}
                onValueChange={(val) => {
                  triggerHaptic();
                  setIsVegOnly(val);
                }}
                trackColor={{ false: '#E5E7EB', true: '#D1FAE5' }}
                thumbColor={isVegOnly ? "#10B981" : "#FFFFFF"}
                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
              />
            </View>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView} contentContainerStyle={{ paddingBottom: 160 }}>
        
        {/* KITCHEN PAUSED BANNER */}
        {menuData?.kitchenPaused && (
          <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.kitchenPausedBanner}>
            <ChefHat size={20} color="#991B1B" style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.pausedTitle}>Kitchen is currently paused</Text>
              <Text style={styles.pausedReason}>{menuData.pauseReason || 'Taking a short break to catch up on orders.'}</Text>
            </View>
          </Animated.View>
        )}

        {/* MOOD DISCOVERY (HORIZONTAL PILLS) */}
        {!isLoading && categories.length > 1 && (
          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.mindContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mindScroll}>
                {categories.map((cat: any) => (
                  <CategoryPill 
                    key={cat} 
                    name={cat} 
                    isSelected={selectedCategory === cat} 
                    onPress={() => { triggerHaptic(); setSelectedCategory(cat); }} 
                  />
                ))}
            </ScrollView>
          </Animated.View>
        )}

        {/* ITEMS LIST (ULTRA CLEAN ROWS) */}
        <View style={styles.itemsContainer}>
          {unserviceableLocation ? (
            <View style={styles.emptyState}>
              <MapPin size={48} color="#10B981" />
              <Text style={styles.emptyStateTitle}>Out of Delivery Zone</Text>
              <Text style={styles.emptyStateSub}>We don't deliver to your current location yet. Please select a different address.</Text>
            </View>
          ) : isLoading ? (
            <View style={styles.skeletonList}>
              <SkeletonItem />
              <SkeletonItem />
              <SkeletonItem />
              <SkeletonItem />
              <SkeletonItem />
            </View>
          ) : (!filteredItems || filteredItems.length === 0) ? (
            <View style={styles.emptyState}>
              <PackageOpen size={48} color="#10B981" />
              <Text style={styles.emptyStateTitle}>Nothing found</Text>
              <Text style={styles.emptyStateSub}>Try changing your search or filters.</Text>
            </View>
          ) : (
            <View style={styles.modernItemsList}>
              {filteredItems.map((item: any, index: number) => {
                const cartItem = cartItems.find((ci: any) => ci.menuItemId === item.id);
                return (
                  <ModernItemCard 
                    key={item.id} 
                    item={item} 
                    cartItem={cartItem} 
                    kitchenPaused={menuData?.kitchenPaused}
                    onPress={() => {
                      if (item.available) {
                        triggerHaptic();
                        navigation.navigate('ItemDetail', { item });
                      }
                    }}
                    onAdd={() => handleAddToCart(item)}
                    onUpdate={(qty: number) => {
                      triggerHaptic();
                      dispatch(setQuantity({ menuItemId: item.id, quantity: qty }));
                    }}
                  />
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* FLOATING CART SUMMARY (SWISH STYLE) */}
      {cartItems.length > 0 && (
        <Animated.View entering={BounceIn.duration(600)} style={styles.floatingCartContainer}>
          <TouchableOpacity style={styles.floatingCartButton} onPress={() => { triggerHaptic(); navigation.navigate('Cart'); }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.cartIconBadge}>
                    <Text style={styles.cartIconBadgeText}>{cartItems.length}</Text>
                </View>
                <View style={{marginLeft: 12}}>
                    <Text style={styles.cartTotalText}>₹{cartTotal / 100}</Text>
                    <Text style={styles.cartSubText}>PLUS TAXES</Text>
                </View>
            </View>
            <View style={styles.viewCartAction}>
              <Text style={styles.viewCartText}>View Cart</Text>
              <ArrowRight size={16} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
};

// Sub-components

const CategoryPill = ({ name, isSelected, onPress }: any) => {
    return (
        <TouchableOpacity 
            style={[styles.categoryPill, isSelected && styles.categoryPillActive]} 
            onPress={onPress}
        >
            <Text style={[styles.categoryPillText, isSelected && styles.categoryPillTextActive]}>
                {name}
            </Text>
        </TouchableOpacity>
    );
};

const ModernItemCard = ({ item, cartItem, onAdd, onUpdate, onPress, kitchenPaused }: any) => {
    const isBestseller = item.is_bestseller || item.id === '1' || item.id === '2';
    
    return (
        <Animated.View layout={Layout.springify()} style={styles.modernCard}>
            <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.modernCardInner}>
            
            <View style={styles.modernImageCol}>
                <View style={styles.modernImageWrapper}>
                    {item.photo_url ? (
                        <NetworkImage uri={item.photo_url} style={styles.modernImage} />
                    ) : (
                        <View style={styles.modernImagePlaceholder}>
                            <ChefHat size={32} color="#9CA3AF" />
                        </View>
                    )}
                    
                    {(!item.available || kitchenPaused) && (
                        <View style={styles.soldOutOverlay}>
                            <Text style={styles.soldOutText}>Sold Out</Text>
                        </View>
                    )}
                </View>
            </View>

            <View style={styles.modernInfo}>
                <View style={styles.modernTagsRow}>
                    <View style={[styles.vegIndicatorModern, { borderColor: item.is_veg ? '#10B981' : '#EF4444' }]}>
                        <View style={[styles.vegDotModern, { backgroundColor: item.is_veg ? '#10B981' : '#EF4444' }]} />
                    </View>
                    {isBestseller && (
                        <View style={styles.bestsellerTagModern}>
                            <Text style={styles.bestsellerTagTextModern}>Bestseller</Text>
                        </View>
                    )}
                </View>
                <Text style={styles.modernName} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.modernPrice}>₹{item.price_paise / 100}</Text>
                <Text style={styles.modernDesc} numberOfLines={2}>
                    {item.description || "Fresh and delicious."}
                </Text>
            </View>

            <View style={styles.addBtnContainerRight}>
                {cartItem ? (
                    <View style={styles.floatingQuantityControlModern}>
                        <TouchableOpacity onPress={() => onUpdate(cartItem.quantity - 1)} style={styles.floatingQtyBtnModern}>
                            <Text style={styles.floatingQtyTextModern}>−</Text>
                        </TouchableOpacity>
                        <Text style={styles.floatingQtyValueModern}>{cartItem.quantity}</Text>
                        <TouchableOpacity onPress={() => onUpdate(cartItem.quantity + 1)} style={styles.floatingQtyBtnModern}>
                            <Text style={styles.floatingQtyTextModern}>+</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <TouchableOpacity 
                        style={[styles.floatingAddButtonModern, (!item.available || kitchenPaused) && styles.floatingAddButtonDisabled]}
                        disabled={!item.available || kitchenPaused}
                        onPress={onAdd}
                    >
                        <Text style={styles.floatingAddButtonTextModern}>ADD</Text>
                    </TouchableOpacity>
                )}
            </View>

            </TouchableOpacity>
        </Animated.View>
    );
};


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  minimalHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addressSection: { flex: 1, marginRight: 16 },
  addressRow: { justifyContent: 'center' },
  locationTitle: { color: '#1A1A2E', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  addressValue: { color: '#6B7280', fontSize: 13, fontWeight: '600', marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  profileButton: { width: 44, height: 44, backgroundColor: '#ECFDF5', borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: '#D1FAE5' },
  profileImage: { width: '100%', height: '100%' },

  liveKitchenBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    padding: 12,
    borderRadius: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  liveDotWrapper: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  liveDot: { position: 'absolute', width: 16, height: 16, borderRadius: 8, backgroundColor: '#10B981' },
  liveDotCore: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  liveKitchenText: { color: '#059669', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  liveKitchenTitle: { color: '#1A1A2E', fontSize: 14, fontWeight: '900', marginTop: 2 },
  deliveryTimeBadge: { backgroundColor: '#FFFFFF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, alignItems: 'center', shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  deliveryTimeText: { color: '#10B981', fontSize: 14, fontWeight: '900' },
  deliveryTimeSub: { color: '#6B7280', fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  
  searchBarContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 52,
    marginTop: 20,
  },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  vegToggleContainer: { borderLeftWidth: 1, borderLeftColor: '#E5E7EB', paddingLeft: 12, marginLeft: 8 },
  vegToggleWrapper: { flexDirection: 'row', alignItems: 'center' },
  vegText: { fontSize: 10, fontWeight: '900', color: '#9CA3AF', marginRight: 4, letterSpacing: 0.5 },
  vegTextActive: { color: '#10B981' },
  
  scrollView: { flex: 1 },
  
  kitchenPausedBanner: { backgroundColor: '#FEE2E2', marginHorizontal: 16, marginTop: 20, padding: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#FECACA' },
  pausedTitle: { color: '#991B1B', fontSize: 15, fontWeight: '800' },
  pausedReason: { color: '#B91C1C', fontSize: 12, fontWeight: '500', marginTop: 2 },
  
  mindContainer: { marginTop: 20 },
  mindScroll: { paddingHorizontal: 16, gap: 12 },
  categoryPill: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  categoryPillActive: { backgroundColor: '#10B981', borderColor: '#10B981' },
  categoryPillText: { fontSize: 14, fontWeight: '800', color: '#4B5563' },
  categoryPillTextActive: { color: '#FFFFFF' },

  itemsContainer: { paddingHorizontal: 16, marginTop: 24, paddingBottom: 40 },
  modernItemsList: { width: '100%' },
  
  modernCard: { width: '100%', marginBottom: 16, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 4 },
  modernCardInner: { flexDirection: 'row', alignItems: 'center' },
  
  modernImageCol: { width: 80, alignItems: 'center', marginRight: 16 },
  modernImageWrapper: { width: 80, height: 80, borderRadius: 16, backgroundColor: '#F3F4F6', overflow: 'hidden' },
  modernImage: { width: '100%', height: '100%' },
  modernImagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  
  modernInfo: { flex: 1, paddingRight: 8 },
  modernTagsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  vegIndicatorModern: { width: 12, height: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: 8, borderRadius: 3 },
  vegDotModern: { width: 5, height: 5, borderRadius: 3 },
  bestsellerTagModern: { backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  bestsellerTagTextModern: { color: '#D97706', fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  modernName: { fontSize: 15, fontWeight: '800', color: '#1A1A2E', lineHeight: 20, marginBottom: 4 },
  modernPrice: { fontSize: 14, fontWeight: '900', color: '#1A1A2E', marginBottom: 4 },
  modernDesc: { fontSize: 12, color: '#6B7280', fontWeight: '500', lineHeight: 16 },

  addBtnContainerRight: { marginLeft: 'auto' },
  floatingAddButtonModern: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#ECFDF5', borderRadius: 12, borderWidth: 1, borderColor: '#D1FAE5' },
  floatingAddButtonDisabled: { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' },
  floatingAddButtonTextModern: { color: '#10B981', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },
  
  floatingQuantityControlModern: { width: 80, height: 36, backgroundColor: '#10B981', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10 },
  floatingQtyBtnModern: { paddingHorizontal: 10, height: '100%', justifyContent: 'center' },
  floatingQtyTextModern: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  floatingQtyValueModern: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },

  soldOutOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' },
  soldOutText: { color: '#1A1A2E', fontWeight: '900', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 },

  skeletonList: { width: '100%' },
  skeletonRow: { flexDirection: 'row', width: '100%', padding: 16, marginBottom: 16, backgroundColor: '#FFFFFF', borderRadius: 24, alignItems: 'center' },
  skeletonImageCol: { width: 80, height: 80, marginRight: 16 },
  skeletonInfoCol: { flex: 1 },
  
  emptyState: { alignItems: 'center', paddingVertical: 64 },
  emptyStateTitle: { color: '#1A1A2E', fontSize: 20, fontWeight: '900', marginTop: 16 },
  emptyStateSub: { color: '#6B7280', fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 },

  floatingCartContainer: { position: 'absolute', bottom: 16, left: 16, right: 16, paddingBottom: Platform.OS === 'ios' ? 16 : 0 },
  floatingCartButton: { backgroundColor: '#10B981', paddingHorizontal: 20, paddingVertical: 16, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#10B981', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 15, elevation: 12 },
  cartIconBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  cartIconBadgeText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },
  cartTotalText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  cartSubText: { color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: '800', marginTop: 2, letterSpacing: 1 },
  viewCartAction: { flexDirection: 'row', alignItems: 'center' },
  viewCartText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15, marginRight: 8 },
});

export default HomeScreen;
