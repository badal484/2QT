import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, StyleSheet, TextInput, Switch, Alert } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RootState } from '../store';
import { api } from '../api/client';
import { getSocket } from '../socket/client';
import { addItem, setQuantity, setAddress, setZone } from '../store/slices/cartSlice';
import { MapPin, User, Search, PackageOpen, ChefHat, ArrowRight, ChevronDown, Sparkles, Navigation } from 'lucide-react-native';
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
  React.useEffect(() => {
    opacity.value = withRepeat(withTiming(0.7, { duration: 800 }), -1, true);
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[styles.skeletonCard, style]}>
      <View style={styles.skeletonImage} />
      <View style={styles.skeletonInfo}>
        <View style={styles.skeletonTextRow} />
        <View style={styles.skeletonTextShort} />
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
  const { location, loadingLocation, fetchLocation } = useLocation();
  const insets = useSafeAreaInsets();

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

  const { data: bannersData } = useQuery({
    queryKey: ['banners'],
    queryFn: () => api.get('/banners'),
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
        setUnserviceableLocation(false);
      }
    } else if (!addressId && !loadingLocation && !location) {
      fetchLocation();
    }
  }, [addresses, addressId, location, loadingLocation]);

  React.useEffect(() => {
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
              // The Redux slice clears the cart if kitchenId is different, but we should make sure it actually dispatches.
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
      {/* MINIMALIST PREMIUM HEADER */}
      <View style={[styles.minimalHeader, { paddingTop: Math.max(insets.top + 16, 60) }]}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity 
            style={styles.addressSection}
            onPress={() => {
              triggerHaptic();
              navigation.navigate('Address');
            }}
          >
            <View style={styles.etaRow}>
              <View style={styles.etaBadge}>
                <Navigation size={10} color="#FF6B35" style={{ marginRight: 4 }} />
                <Text style={styles.etaText}>15 MINS</Text>
              </View>
              <Text style={styles.deliveringToText}>DELIVERING TO</Text>
            </View>
            <View style={styles.addressValueRow}>
              <Text style={styles.addressValue} numberOfLines={1}>
                {selectedAddress 
                  ? `${selectedAddress.label} - ${selectedAddress.address_text}`
                  : location 
                    ? location.addressText 
                    : loadingLocation 
                      ? 'Locating...' 
                      : 'Select Location'}
              </Text>
              <ChevronDown size={18} color="#1A1A2E" style={{ marginLeft: 4 }} />
            </View>
          </TouchableOpacity>
          
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.proButton} onPress={() => navigation.navigate('Subscription')}>
              <Sparkles size={16} color="#FF6B35" />
              <Text style={styles.proButtonText}>Pro</Text>
            </TouchableOpacity>
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
                <User size={20} color="#1A1A2E" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* INTEGRATED SEARCH BAR */}
        <View style={styles.searchBarContainer}>
          <Search size={20} color="#9CA3AF" style={{ marginRight: 8 }} />
          <TextInput
            placeholder='Search for dishes, restaurants...'
            placeholderTextColor="#9CA3AF"
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <View style={styles.vegToggleContainer}>
            <View style={styles.vegIconBox}>
              <View style={styles.vegIconDot} />
            </View>
            <Switch
              value={isVegOnly}
              onValueChange={(val) => {
                triggerHaptic();
                setIsVegOnly(val);
              }}
              trackColor={{ false: '#E5E7EB', true: '#22C55E' }}
              thumbColor="#fff"
              style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
            />
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView} contentContainerStyle={{ paddingBottom: 160 }}>
        
        {/* KITCHEN PAUSED BANNER */}
        {menuData?.kitchenPaused && (
          <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.kitchenPausedBanner}>
            <ChefHat size={20} color="#fff" style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.pausedTitle}>Kitchen is currently paused</Text>
              <Text style={styles.pausedReason}>{menuData.pauseReason || 'Taking a short break to catch up on orders.'}</Text>
            </View>
          </Animated.View>
        )}

        {/* MASSIVE PROMO BANNER */}
        {!menuData?.kitchenPaused && !isLoading && bannersData?.banners?.length > 0 && (
          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.promoBannerContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} pagingEnabled snapToInterval={width - 32} decelerationRate="fast">
              {bannersData.banners.map((banner: any, idx: number) => (
                <View key={banner.id || idx} style={{ width: width - 32, paddingRight: idx === bannersData.banners.length - 1 ? 0 : 16 }}>
                  {banner.image_url ? (
                    <View style={[styles.promoImageMock, { padding: 0, overflow: 'hidden' }]}>
                      <NetworkImage uri={banner.image_url} style={{ width: '100%', height: '100%' }} />
                    </View>
                  ) : (
                    <ImageBackgroundMock 
                      text={banner.title || "SPECIAL OFFER"} 
                      sub={banner.subtitle || "Order Now"} 
                      code={banner.tag_text || "OFFER"} 
                    />
                  )}
                </View>
              ))}
            </ScrollView>
          </Animated.View>
        )}

        {/* PILL CATEGORY GRID */}
        {!isLoading && categories.length > 1 && (
          <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.categoryGridContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryGridScroll}>
                {categories.map((cat: any) => (
                  <CategoryPill key={cat} name={cat} isSelected={selectedCategory === cat} onPress={() => { triggerHaptic(); setSelectedCategory(cat); }} />
                ))}
            </ScrollView>
          </Animated.View>
        )}

        {/* ITEMS LIST (PREMIUM CARDS) */}
        <View style={styles.itemsContainer}>
          {unserviceableLocation ? (
            <View style={styles.emptyState}>
              <MapPin size={48} color="#FF6B35" />
              <Text style={styles.emptyStateTitle}>Out of Delivery Zone</Text>
              <Text style={styles.emptyStateSub}>We don't deliver to your current location yet. Please select a different address.</Text>
            </View>
          ) : isLoading ? (
            <View style={styles.skeletonGrid}>
              <SkeletonItem />
              <SkeletonItem />
              <SkeletonItem />
              <SkeletonItem />
            </View>
          ) : (!filteredItems || filteredItems.length === 0) ? (
            <View style={styles.emptyState}>
              <PackageOpen size={48} color="#FF6B35" />
              <Text style={styles.emptyStateTitle}>Nothing found</Text>
              <Text style={styles.emptyStateSub}>Try changing your search or filters.</Text>
            </View>
          ) : (
            <View style={styles.premiumItemsGrid}>
              {filteredItems.map((item: any, index: number) => {
                const cartItem = cartItems.find(ci => ci.menuItemId === item.id);
                return (
                  <PremiumItemCard 
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

      {/* FLOATING CATEGORY PILL */}
      <View style={styles.floatingMenuPillContainer}>
        <TouchableOpacity style={styles.floatingMenuPill} onPress={() => {
          triggerHaptic();
          // Scroll to top or show category modal logic
          setSelectedCategory('All');
        }}>
          <ChefHat size={16} color="#1A1A2E" style={{ marginRight: 6 }} />
          <Text style={styles.floatingMenuPillText}>Menu</Text>
        </TouchableOpacity>
      </View>

      {/* STICKY BOTTOM OFFERS / CART SUMMARY */}
      {cartItems.length > 0 ? (
        <Animated.View entering={BounceIn.duration(600)} style={styles.floatingCartContainer}>
          <TouchableOpacity style={styles.floatingCartButton} onPress={() => { triggerHaptic(); navigation.navigate('Cart'); }}>
            <View>
              <Text style={styles.cartCountText}>{cartItems.length} Item{cartItems.length > 1 ? 's' : ''}</Text>
              <Text style={styles.cartTotalText}>₹{cartTotal / 100}</Text>
            </View>
            <View style={styles.viewCartAction}>
              <Text style={styles.viewCartText}>View Cart</Text>
              <ArrowRight size={16} color="white" />
            </View>
          </TouchableOpacity>
        </Animated.View>
      ) : (
        <Animated.View entering={FadeInDown.duration(400)} style={styles.stickyOfferBanner}>
          <View style={styles.offerIconCircle}><Text style={{fontSize: 16}}>%</Text></View>
          <View>
            <Text style={styles.stickyOfferTitle}>Exciting Offers Available</Text>
            <Text style={styles.stickyOfferSub}>APPLY PROMO CODE IN CART</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
};

// Sub-components

const CategoryPill = ({ name, isSelected, onPress }: any) => (
  <TouchableOpacity style={[styles.categoryPillItem, isSelected && styles.categoryPillItemActive]} onPress={onPress}>
    <Text style={[styles.categoryPillText, isSelected && styles.categoryPillTextActive]}>
      {name}
    </Text>
  </TouchableOpacity>
);

const PremiumItemCard = ({ item, cartItem, onAdd, onUpdate, onPress, kitchenPaused }: any) => (
  <Animated.View layout={Layout.springify()} style={styles.premiumCard}>
    <TouchableOpacity activeOpacity={0.9} onPress={onPress}>
      <View style={styles.premiumImageWrapper}>
        {item.photo_url ? (
          <NetworkImage uri={item.photo_url} style={styles.premiumImage} />
        ) : (
          <View style={styles.premiumImagePlaceholder}>
            <Text style={styles.premiumImagePlaceholderText}>V</Text>
          </View>
        )}
        
        {/* Bestseller Tag */}
        {(item.is_bestseller || item.id === '1' || item.id === '2') && (
          <View style={styles.bestsellerTag}>
            <Text style={styles.bestsellerTagText}>★ Bestseller</Text>
          </View>
        )}

        {(!item.available || kitchenPaused) && (
          <View style={styles.soldOutOverlay}>
            <Text style={styles.soldOutText}>Sold Out</Text>
          </View>
        )}
      </View>
      
      <View style={styles.premiumInfo}>
        <View style={styles.premiumTagsRow}>
          <View style={[styles.vegIndicatorSmall, { borderColor: item.is_veg ? '#22C55E' : '#EF4444' }]}>
            <View style={[styles.vegDotSmall, { backgroundColor: item.is_veg ? '#22C55E' : '#EF4444' }]} />
          </View>
          <View style={styles.servesTag}>
            <Text style={styles.servesTagText}>Serves 1</Text>
          </View>
        </View>
        <Text style={styles.premiumName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.premiumPrice}>₹{item.price_paise / 100}</Text>
        
        {/* ADD BUTTON MOVED BELOW TEXT FOR CLEANER UI */}
        <View style={{ marginTop: 12 }}>
          {cartItem ? (
            <View style={styles.floatingQuantityControl}>
              <TouchableOpacity onPress={() => onUpdate(cartItem.quantity - 1)} style={styles.floatingQtyBtn}>
                <Text style={styles.floatingQtyText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.floatingQtyValue}>{cartItem.quantity}</Text>
              <TouchableOpacity onPress={() => onUpdate(cartItem.quantity + 1)} style={styles.floatingQtyBtn}>
                <Text style={styles.floatingQtyText}>+</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              style={[styles.floatingAddButton, (!item.available || kitchenPaused) && styles.floatingAddButtonDisabled]}
              disabled={!item.available || kitchenPaused}
              onPress={onAdd}
            >
              <Text style={styles.floatingAddButtonText}>ADD</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  </Animated.View>
);

const ImageBackgroundMock = ({ text, sub, code }: any) => (
  <View style={styles.promoImageMock}>
    <Text style={styles.promoImageMockTitle}>{text}</Text>
    <Text style={styles.promoImageMockSub}>{sub}</Text>
    <View style={styles.promoCodePill}><Text style={styles.promoCodeText}>{code}</Text></View>
  </View>
);


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  minimalHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  addressSection: { flex: 1, marginRight: 16 },
  etaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  etaBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF7ED', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginRight: 8 },
  etaText: { color: '#FF6B35', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  deliveringToText: { color: '#9CA3AF', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  addressValueRow: { flexDirection: 'row', alignItems: 'center' },
  addressValue: { color: '#1A1A2E', fontSize: 15, fontWeight: '800' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  proButton: { backgroundColor: '#FFF7ED', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, flexDirection: 'row', alignItems: 'center', marginRight: 12 },
  proButtonText: { color: '#FF6B35', fontWeight: '900', fontSize: 12, marginLeft: 4 },
  profileButton: { width: 40, height: 40, backgroundColor: '#F3F4F6', borderRadius: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  profileImage: { width: '100%', height: '100%' },
  
  searchBarContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 52,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  vegToggleContainer: { flexDirection: 'row', alignItems: 'center', borderLeftWidth: 1, borderLeftColor: '#E5E7EB', paddingLeft: 12, marginLeft: 8 },
  vegIconBox: { width: 14, height: 14, borderWidth: 1, borderColor: '#22C55E', alignItems: 'center', justifyContent: 'center', marginRight: 2 },
  vegIconDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' },
  
  scrollView: { flex: 1 },
  
  kitchenPausedBanner: { backgroundColor: '#FEE2E2', marginHorizontal: 16, marginTop: 24, padding: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#FECACA' },
  pausedTitle: { color: '#991B1B', fontSize: 15, fontWeight: '800' },
  pausedReason: { color: '#B91C1C', fontSize: 12, fontWeight: '500', marginTop: 2 },
  
  promoBannerContainer: { marginHorizontal: 16, marginTop: 24 },
  promoImageMock: { height: 160, backgroundColor: '#1A1A2E', borderRadius: 24, alignItems: 'center', justifyContent: 'center', padding: 20 },
  promoImageMockTitle: { color: '#fff', fontSize: 28, fontWeight: '900', textAlign: 'center', letterSpacing: -1 },
  promoImageMockSub: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginTop: 4 },
  promoCodePill: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginTop: 16 },
  promoCodeText: { color: '#1A1A2E', fontWeight: '900', fontSize: 12 },

  categoryGridContainer: { marginTop: 24 },
  categoryGridScroll: { paddingHorizontal: 16, gap: 8 },
  categoryPillItem: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24, marginRight: 8, height: 40, justifyContent: 'center' },
  categoryPillItemActive: { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' },
  categoryPillText: { fontSize: 13, fontWeight: '700', color: '#4B5563' },
  categoryPillTextActive: { color: '#FFFFFF' },

  itemsContainer: { paddingHorizontal: 16, marginTop: 24, paddingBottom: 40 },
  premiumItemsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  premiumCard: { width: (width - 48) / 2, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#F3F4F6' },
  premiumImageWrapper: { width: '100%', aspectRatio: 1, borderRadius: 12, backgroundColor: '#F9FAFB', overflow: 'hidden', position: 'relative' },
  premiumImage: { width: '100%', height: '100%', borderRadius: 12 },
  premiumImagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6', borderRadius: 12 },
  premiumImagePlaceholderText: { color: '#D1D5DB', fontWeight: '900', fontSize: 24 },
  bestsellerTag: { position: 'absolute', top: 0, left: 0, backgroundColor: '#FF6B35', paddingHorizontal: 6, paddingVertical: 4, borderBottomRightRadius: 8, zIndex: 10 },
  bestsellerTagText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900', textTransform: 'uppercase' },
  
  floatingAddButton: { alignSelf: 'center', width: 90, backgroundColor: '#FFF7ED', paddingVertical: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FFEDD5' },
  floatingAddButtonDisabled: { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' },
  floatingAddButtonText: { color: '#FF6B35', fontWeight: '900', fontSize: 13 },
  floatingQuantityControl: { alignSelf: 'center', width: 90, backgroundColor: '#FFF7ED', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#FFEDD5' },
  floatingQtyBtn: { padding: 4 },
  floatingQtyText: { color: '#FF6B35', fontSize: 18, fontWeight: '900' },
  floatingQtyValue: { color: '#FF6B35', fontSize: 14, fontWeight: '900', paddingHorizontal: 8 },
  
  premiumInfo: { marginTop: 20 },
  premiumTagsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  vegIndicatorSmall: { width: 12, height: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: 6, borderRadius: 2 },
  vegDotSmall: { width: 4, height: 4, borderRadius: 2 },
  servesTag: { backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  servesTagText: { color: '#6B7280', fontSize: 8, fontWeight: '900', textTransform: 'uppercase' },
  premiumName: { fontSize: 14, fontWeight: '800', color: '#1A1A2E', lineHeight: 18, marginBottom: 4 },
  premiumPrice: { fontSize: 15, fontWeight: '900', color: '#1A1A2E', marginBottom: 4 },
  premiumDesc: { fontSize: 11, color: '#9CA3AF', fontWeight: '500', lineHeight: 14 },

  soldOutOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  soldOutText: { color: '#1A1A2E', fontWeight: '900', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 },

  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  skeletonCard: { width: (width - 48) / 2, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#F3F4F6' },
  skeletonImage: { width: '100%', aspectRatio: 1, borderRadius: 12, backgroundColor: '#F3F4F6' },
  skeletonInfo: { marginTop: 16 },
  skeletonTextRow: { width: '80%', height: 14, backgroundColor: '#F3F4F6', borderRadius: 4, marginBottom: 8 },
  skeletonTextShort: { width: '40%', height: 14, backgroundColor: '#F3F4F6', borderRadius: 4 },
  
  emptyState: { alignItems: 'center', paddingVertical: 64 },
  emptyStateTitle: { color: '#1A1A2E', fontSize: 18, fontWeight: '900', marginTop: 16 },
  emptyStateSub: { color: '#9CA3AF', fontSize: 13, marginTop: 4 },

  floatingMenuPillContainer: { position: 'absolute', bottom: 100, left: 0, right: 0, alignItems: 'center', pointerEvents: 'box-none' },
  floatingMenuPill: { backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  floatingMenuPillText: { color: '#1A1A2E', fontWeight: '900', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },

  stickyOfferBanner: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#1A1A2E', padding: 20, paddingBottom: 36, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 12 },
  offerIconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255, 107, 53, 0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  stickyOfferTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  stickyOfferSub: { color: '#9CA3AF', fontSize: 11, fontWeight: '700', marginTop: 2, letterSpacing: 0.5 },

  floatingCartContainer: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  floatingCartButton: { backgroundColor: '#1A1A2E', padding: 20, paddingBottom: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 12 },
  cartCountText: { color: '#9CA3AF', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  cartTotalText: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginTop: 2 },
  viewCartAction: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF6B35', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  viewCartText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14, marginRight: 8 },
});

export default HomeScreen;
