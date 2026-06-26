import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Dimensions, RefreshControl } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RootState } from '../store';
import { api } from '../api/client';
import { addItem, setQuantity } from '../store/slices/cartSlice';
import { MapPin, Search, ChefHat, ChevronDown, ShoppingBag } from 'lucide-react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { NetworkImage } from '../components/NetworkImage';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_WIDTH = (SCREEN_WIDTH - spacing.lg * 2 - 16) / 2;
const hapticOptions = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };

const HomeScreenSDUI = ({ navigation }: any) => {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  
  const { user } = useSelector((state: RootState) => state.auth);
  const { items: cartItems, zoneId } = useSelector((state: RootState) => state.cart);
  const { globalLocation: location, activeZoneId } = useSelector((state: RootState) => state.app);
  
  const effectiveZoneId = zoneId || activeZoneId;
  const [refreshing, setRefreshing] = useState(false);

  const { data: feedData, isLoading } = useQuery({
    queryKey: ['homeFeed', effectiveZoneId],
    queryFn: () => api.get(`/home/feed?zoneId=${effectiveZoneId || ''}`),
    enabled: !!effectiveZoneId,
    staleTime: 3 * 60 * 1000,
  });

  const feed = feedData?.feed || [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
    await queryClient.invalidateQueries({ queryKey: ['homeFeed'] });
    setRefreshing(false);
  }, [queryClient]);

  const triggerHaptic = useCallback(
    () => ReactNativeHapticFeedback.trigger('impactLight', hapticOptions),
    []
  );

  const handleAddToCart = useCallback((item: any) => {
    triggerHaptic();
    dispatch(addItem({
      menuItemId: item.id,
      name: item.name,
      pricePaise: item.price_paise,
      quantity: 1,
      photoUrl: item.photo_url,
      isVeg: item.is_veg,
      kitchenId: item.kitchen_id,
    }));
  }, [dispatch, triggerHaptic]);

  const renderTopBar = () => (
    <View style={styles.topBarContainer}>
      <View style={styles.locationRow}>
        <MapPin size={18} color={colors.primary} />
        <View style={{ marginLeft: 8, flex: 1 }}>
          <Text style={styles.locationTitle}>Delivering to</Text>
          <Text style={styles.locationValue} numberOfLines={1}>
            {location?.address || 'Select your location'}
          </Text>
        </View>
        <TouchableOpacity onPress={() => { triggerHaptic(); navigation.navigate('ProfileTab'); }}>
          <View style={styles.profileBtn}>
            <Text style={{ fontFamily: fontFamily.bold, color: colors.white }}>{user?.name?.[0] || 'U'}</Text>
          </View>
        </TouchableOpacity>
      </View>
      
      <View style={styles.searchRow}>
        <TouchableOpacity style={styles.searchBar} onPress={() => { triggerHaptic(); navigation.navigate('Search'); }}>
          <Search size={18} color={colors.inkMuted} style={{ marginRight: 10 }} />
          <Text style={{ color: colors.inkMuted, fontFamily: fontFamily.medium, fontSize: 14 }}>Search "Rajma Rice"</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderMiniBanners = (banners: any[]) => (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingVertical: 16, gap: 12 }}
      data={banners}
      keyExtractor={b => b.id}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.miniBannerCard} onPress={() => {
           if(item.destination_screen) {
             navigation.navigate(item.destination_screen, item.destination_params || {});
           }
        }}>
          <NetworkImage uri={item.image_url} style={styles.miniBannerImage} />
        </TouchableOpacity>
      )}
    />
  );

  const renderStripBanner = (banner: any) => (
    <TouchableOpacity style={styles.stripBannerContainer} onPress={() => {
       if(banner.destination_screen) {
         navigation.navigate(banner.destination_screen, banner.destination_params || {});
       }
    }}>
      <NetworkImage uri={banner.image_url} style={styles.stripBannerImage} />
    </TouchableOpacity>
  );

  const renderCollection = (collection: any) => {
    return (
      <View style={styles.collectionContainer}>
        <View style={styles.collectionHeader}>
          <View>
            <Text style={styles.collectionTitle}>{collection.title}</Text>
            {collection.subtitle && <Text style={styles.collectionSubtitle}>{collection.subtitle}</Text>}
          </View>
          <TouchableOpacity onPress={() => {}}>
            <Text style={styles.viewAllText}>View all {'>'}</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 16, paddingBottom: 16 }}
          data={collection.data}
          keyExtractor={item => item.id}
          renderItem={({ item }) => {
            const cartItem = cartItems.find((ci: any) => ci.menuItemId === item.id);
            const vegColor = item.is_veg ? '#22C55E' : colors.danger;
            const unavailable = !item.available;

            return (
              <TouchableOpacity
                style={styles.gridCard}
                activeOpacity={0.93}
                onPress={() => {
                  if (item.available) {
                    triggerHaptic();
                    navigation.navigate('ItemDetail', { item });
                  }
                }}
              >
                <View style={styles.gridCardImageContainer}>
                  {item.photo_url ? (
                    <NetworkImage uri={item.photo_url} style={styles.gridCardImage} />
                  ) : (
                    <View style={[styles.gridCardImage, styles.cardImagePlaceholder]}>
                      <ChefHat size={32} color={colors.inkFaint} />
                    </View>
                  )}
                  
                  <View style={[styles.vegBadgeFloat, { borderColor: vegColor }]}>
                    <View style={[styles.vegDot, { backgroundColor: vegColor }]} />
                  </View>

                  {!unavailable && (
                    <View style={styles.gridAddBtnFloat}>
                      {cartItem ? (
                        <View style={styles.qtyControl}>
                          <TouchableOpacity
                            onPress={() => { triggerHaptic(); dispatch(setQuantity({ menuItemId: item.id, quantity: cartItem.quantity - 1 })); }}
                            style={styles.qtyBtn}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
                          >
                            <Text style={styles.qtyBtnText}>−</Text>
                          </TouchableOpacity>
                          <Text style={styles.qtyValue}>{cartItem.quantity}</Text>
                          <TouchableOpacity
                            onPress={() => { triggerHaptic(); dispatch(setQuantity({ menuItemId: item.id, quantity: cartItem.quantity + 1 })); }}
                            style={styles.qtyBtn}
                            hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                          >
                            <Text style={styles.qtyBtnText}>+</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity style={styles.addBtn} onPress={() => handleAddToCart(item)} activeOpacity={0.85}>
                          <Text style={styles.addBtnText}>ADD</Text>
                          <View style={styles.customiseBadge}>
                            <Text style={styles.customiseText}>+</Text>
                          </View>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>

                <View style={styles.gridCardInfo}>
                  <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.cardPrice}>₹{item.price_paise / 100}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    );
  };

  const renderBlock = ({ item }: { item: any }) => {
    switch (item.type) {
      case 'TOP_BAR':
        return renderTopBar();
      case 'MINI_BANNERS':
        return renderMiniBanners(item.data);
      case 'STRIP_BANNER':
        return renderStripBanner(item.data);
      case 'COLLECTION':
        return renderCollection(item);
      default:
        return null;
    }
  };

  const totalCartQty = cartItems.reduce((acc: number, i: any) => acc + i.quantity, 0);
  const cartTotal = cartItems.reduce((acc: number, i: any) => acc + i.quantity * i.pricePaise, 0);

  return (
    <View style={styles.container}>
      {isLoading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={feed}
          keyExtractor={(item, index) => item.id || \`block-\${index}\`}
          renderItem={renderBlock}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: totalCartQty > 0 ? 120 : 80 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        />
      )}

      {/* Floating Menu Pill */}
      <TouchableOpacity style={styles.menuPill} activeOpacity={0.9} onPress={() => { triggerHaptic(); navigation.navigate('Category', { categorySlug: 'all', categoryName: 'Menu' }); }}>
        <ChefHat size={18} color={colors.white} />
        <Text style={styles.menuPillText}>Menu</Text>
      </TouchableOpacity>

      {/* Floating cart */}
      {totalCartQty > 0 && (
        <Animated.View entering={FadeInDown.duration(300)} style={[styles.floatingCart, { bottom: Math.max(insets.bottom, 16) + 8 }]}>
          <TouchableOpacity
            style={styles.floatingCartBtn}
            onPress={() => { triggerHaptic(); navigation.navigate('Cart'); }}
            activeOpacity={0.9}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.cartCount}>{totalCartQty} {totalCartQty === 1 ? 'ITEM' : 'ITEMS'}</Text>
              <Text style={styles.cartTotal}>  ₹{cartTotal / 100}</Text>
            </View>
            <Text style={styles.viewCartText}>View Cart</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  
  topBarContainer: { paddingHorizontal: spacing.lg, paddingBottom: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  locationTitle: { fontSize: 11, fontFamily: fontFamily.bold, color: colors.primary, textTransform: 'uppercase', letterSpacing: 1 },
  locationValue: { fontSize: 14, fontFamily: fontFamily.bold, color: colors.ink, marginTop: 2 },
  profileBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  
  searchRow: { flexDirection: 'row', alignItems: 'center' },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: 12, paddingHorizontal: 12, height: 46, borderWidth: 1, borderColor: colors.border },
  
  miniBannerCard: { width: 140, height: 90, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  miniBannerImage: { width: '100%', height: '100%' },
  
  stripBannerContainer: { marginHorizontal: spacing.lg, height: 100, borderRadius: 16, overflow: 'hidden', marginVertical: 8 },
  stripBannerImage: { width: '100%', height: '100%' },
  
  collectionContainer: { marginTop: 16 },
  collectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, marginBottom: 12 },
  collectionTitle: { fontSize: 18, fontFamily: fontFamily.black, color: colors.ink },
  collectionSubtitle: { fontSize: 12, fontFamily: fontFamily.medium, color: colors.inkMuted, marginTop: 2 },
  viewAllText: { fontSize: 13, fontFamily: fontFamily.bold, color: colors.primary },
  
  gridCard: { width: 140, backgroundColor: 'transparent' },
  gridCardImageContainer: { width: '100%', aspectRatio: 1, borderRadius: 24, overflow: 'hidden', backgroundColor: colors.surfaceMuted, position: 'relative', marginBottom: 12 },
  gridCardImage: { width: '100%', height: '100%' },
  cardImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  
  vegBadgeFloat: { position: 'absolute', top: 12, left: 12, width: 16, height: 16, borderWidth: 1.5, borderRadius: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  vegDot: { width: 8, height: 8, borderRadius: 4 },
  
  gridCardInfo: { paddingHorizontal: 4 },
  cardName: { fontSize: 15, fontFamily: fontFamily.bold, color: colors.ink, marginBottom: 4, lineHeight: 20 },
  cardPrice: { fontSize: 15, fontFamily: fontFamily.black, color: colors.ink },
  
  gridAddBtnFloat: { position: 'absolute', bottom: -1, alignSelf: 'center', width: '80%', zIndex: 10 },
  qtyControl: {
    flexDirection: 'row', backgroundColor: '#24B059', borderRadius: 12,
    alignItems: 'center', justifyContent: 'space-between', height: 40,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6
  },
  qtyBtn: { width: 34, height: 40, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { color: colors.white, fontSize: 22, fontFamily: fontFamily.bold },
  qtyValue: { color: colors.white, fontSize: 15, fontFamily: fontFamily.extrabold },
  addBtn: {
    backgroundColor: '#24B059', borderRadius: 12, height: 40,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
    position: 'relative'
  },
  addBtnText: { color: colors.white, fontFamily: fontFamily.extrabold, fontSize: 16, letterSpacing: 0.5 },
  customiseBadge: { position: 'absolute', top: -10, backgroundColor: '#FFFFFF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  customiseText: { fontSize: 12, fontFamily: fontFamily.black, color: '#24B059' },
  
  menuPill: { position: 'absolute', bottom: 32, alignSelf: 'center', backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 30, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 10 },
  menuPillText: { color: colors.white, fontFamily: fontFamily.bold, fontSize: 14, marginLeft: 8 },
  
  floatingCart: { position: 'absolute', left: 16, right: 16, zIndex: 999, backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 20 },
  floatingCartBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cartCount: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontFamily: fontFamily.extrabold, letterSpacing: 1, textTransform: 'uppercase' },
  cartTotal: { color: colors.white, fontSize: 22, fontFamily: fontFamily.black, letterSpacing: -0.5 },
  viewCartText: { color: colors.white, fontFamily: fontFamily.extrabold, fontSize: 14 },
});

export default HomeScreenSDUI;
