import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Dimensions, ScrollView
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useQuery } from '@tanstack/react-query';
import { RootState } from '../store';
import { api } from '../api/client';
import { addItem, setQuantity } from '../store/slices/cartSlice';
import { ChevronLeft, Search, ChefHat } from 'lucide-react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { NetworkImage } from '../components/NetworkImage';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_WIDTH = (SCREEN_WIDTH - spacing.lg * 2 - 16) / 2;
const hapticOptions = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };

const CategoryScreen = ({ route, navigation }: any) => {
  const { categorySlug, categoryName, categoryImage, categoryBannerUrl } = route.params as {
    categorySlug: string;
    categoryName: string;
    categoryImage?: string;
    categoryBannerUrl?: string;
  };

  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { items: cartItems, zoneId } = useSelector((state: RootState) => state.cart);
  const { activeZoneId } = useSelector((state: RootState) => state.app);
  const effectiveZoneId = zoneId || activeZoneId;

  const [searchQuery, setSearchQuery] = useState('');
  const [dietaryFilter, setDietaryFilter] = useState<'All' | 'Veg' | 'Non-Veg' | 'Egg'>('All');
  const [isSearching, setIsSearching] = useState(false);

  const triggerHaptic = useCallback(
    () => ReactNativeHapticFeedback.trigger('impactLight', hapticOptions),
    [],
  );

  const { data: menuData, isLoading } = useQuery({
    queryKey: ['menu', effectiveZoneId],
    queryFn: () => api.get(`/menu?zoneId=${effectiveZoneId}`),
    enabled: !!effectiveZoneId,
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // 1. Filter ALL items that belong to this category (fixing the bug)
  const baseItems = useMemo(() => {
    if (!menuData?.items) return [];
    const slugLower = categorySlug.toLowerCase().trim();
    const nameLower = categoryName.toLowerCase().trim();

    return menuData.items.filter((item: any) => {
      const itemCat = (item.category || '').toLowerCase().trim();
      return itemCat === slugLower || itemCat === nameLower;
    });
  }, [menuData?.items, categorySlug, categoryName]);

  // 3. Apply user filters (Dietary, Search)
  const filteredItems = useMemo(() => {
    let items = baseItems;

    if (dietaryFilter === 'Veg') {
      items = items.filter((item: any) => item.is_veg && !item.is_egg);
    } else if (dietaryFilter === 'Non-Veg') {
      items = items.filter((item: any) => !item.is_veg && !item.is_egg);
    } else if (dietaryFilter === 'Egg') {
      items = items.filter((item: any) => item.is_egg);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter((item: any) => item.name.toLowerCase().includes(q));
    }

    return items;
  }, [baseItems, dietaryFilter, searchQuery]);

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

  // Swish-style Vertical Grid Card
  const renderItem = useCallback(({ item, index }: { item: any, index: number }) => {
    const cartItem = cartItems.find((ci: any) => ci.menuItemId === item.id);
    const vegColor = item.is_egg ? '#EAB308' : (item.is_veg ? '#22C55E' : colors.danger);
    const unavailable = !item.available || menuData?.kitchenPaused;

    // We only add margin to the left item in the pair to create the gap
    const isEven = index % 2 === 0;

    return (
      <TouchableOpacity
        style={[styles.gridCard, { marginLeft: isEven ? 0 : 16 }]}
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

          {/* Veg badge — top left */}
          <View style={[styles.vegBadgeFloat, { borderColor: vegColor }]}>
            <View style={[styles.vegDot, { backgroundColor: vegColor }]} />
          </View>

          {/* Bestseller badge — top right */}
          {item.is_bestseller && (
            <View style={styles.bestsellerOverlay}>
              <Text style={styles.bestsellerOverlayText}>★ Bestseller</Text>
            </View>
          )}
          {!item.is_bestseller && item.is_new && (
            <View style={styles.newOverlay}>
              <Text style={styles.newOverlayText}>+ New</Text>
            </View>
          )}

          {unavailable && (
            <View style={styles.soldOutOverlay}>
              <Text style={styles.soldOutText}>Sold Out</Text>
            </View>
          )}

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
                    <Text style={styles.customiseText}>Customise</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        <View style={styles.gridCardInfo}>
          <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
          {item.description ? <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text> : null}
          <Text style={styles.cardPrice}>₹{item.price_paise / 100}</Text>
          {item.tags?.length > 0 && (
            <View style={styles.tagRow}>
              {item.tags.slice(0, 2).map((tag: string) => (
                <View key={tag} style={styles.tagChip}>
                  <Text style={styles.tagChipText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [cartItems, menuData?.kitchenPaused, handleAddToCart, triggerHaptic, dispatch, navigation]);

  const totalCartQty = cartItems.reduce((acc, i) => acc + i.quantity, 0);
  const cartTotal = cartItems.reduce((acc, i) => acc + i.quantity * i.pricePaise, 0);

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* 1. Hero Image */}
      {(categoryBannerUrl || categoryImage) ? (
        <View style={styles.heroImageContainer}>
          <NetworkImage uri={categoryBannerUrl || categoryImage} style={styles.heroImage} />
          <View style={styles.heroGradient} />
        </View>
      ) : (
        <View style={[styles.heroImageContainer, { backgroundColor: '#FDF7EE' }]}>
          <Text style={styles.heroTextFallback}>{categoryName}</Text>
        </View>
      )}

      {/* Floating Back Button */}
      <TouchableOpacity 
        style={[styles.floatingBackBtn, { top: Math.max(insets.top, 16) }]} 
        onPress={() => { triggerHaptic(); navigation.goBack(); }}
      >
        <ChevronLeft size={24} color={colors.ink} />
      </TouchableOpacity>

      {/* Floating Search Button */}
      <TouchableOpacity 
        style={[styles.floatingSearchBtn, { top: Math.max(insets.top, 16) }]} 
        onPress={() => { triggerHaptic(); setIsSearching(!isSearching); }}
      >
        <Search size={22} color={colors.ink} />
      </TouchableOpacity>

      {/* Search Input (Expandable) */}
      {isSearching && (
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Search size={18} color={colors.inkMuted} style={{ marginRight: 10 }} />
            <TextInput
              placeholder={`Search in ${categoryName}...`}
              placeholderTextColor={colors.inkMuted}
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Text style={{ fontSize: 13, fontFamily: fontFamily.bold, color: colors.inkMuted }}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* 2. Dietary Filters (Swish Style) */}
      <View style={styles.dietaryRow}>
        {(['Veg', 'Non-Veg', 'Egg'] as const).map((type) => {
          const isActive = dietaryFilter === type;
          let iconColor = type === 'Veg' ? '#22C55E' : type === 'Non-Veg' ? colors.danger : '#F59E0B';
          return (
            <TouchableOpacity
              key={type}
              style={[styles.dietaryPill, isActive && styles.dietaryPillActive]}
              onPress={() => { 
                triggerHaptic(); 
                setDietaryFilter(isActive ? 'All' : type); 
              }}
            >
              <View style={[styles.dietaryIcon, { borderColor: iconColor }]}>
                <View style={[styles.dietaryIconInner, { backgroundColor: iconColor, borderRadius: type === 'Egg' ? 4 : 4 }]} />
              </View>
              <Text style={styles.dietaryText}>{type}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item: any) => item.id}
          renderItem={renderItem}
          numColumns={2}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyTitle}>No items found</Text>
              <Text style={styles.emptySub}>Try removing filters</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: totalCartQty > 0 ? 120 : 40 }}
          columnWrapperStyle={styles.columnWrapper}
        />
      )}

      {/* Floating cart */}
      {totalCartQty > 0 && (
        <View style={[styles.floatingCart, { bottom: Math.max(insets.bottom, 16) + 8 }]}>
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
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, marginTop: 40 },
  emptyTitle: { fontSize: 18, fontFamily: fontFamily.black, color: colors.ink, marginBottom: 6 },
  emptySub: { fontSize: 14, fontFamily: fontFamily.medium, color: colors.inkMuted },
  
  // Hero Header
  headerContainer: { backgroundColor: colors.background, paddingBottom: 16 },
  heroImageContainer: { width: '100%', height: 260, position: 'relative' },
  heroImage: { width: '100%', height: '100%', borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  heroGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, backgroundColor: 'transparent' }, // Placeholder for actual gradient if needed
  heroTextFallback: { fontSize: 32, fontFamily: fontFamily.black, color: colors.ink, position: 'absolute', bottom: 40, left: 24 },
  
  floatingBackBtn: {
    position: 'absolute', left: 16, width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4
  },
  floatingSearchBtn: {
    position: 'absolute', right: 16, width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4
  },

  // Search
  searchRow: { paddingHorizontal: spacing.lg, marginTop: 16 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, 
    borderRadius: 14, paddingHorizontal: 14, height: 46, borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: fontFamily.medium, color: colors.ink, padding: 0 },

  // Subcategories
  subcategoryScroll: { paddingHorizontal: spacing.lg, paddingVertical: 16, gap: 12 },
  subcategoryPill: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  subcategoryPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  subcategoryText: { fontSize: 13, fontFamily: fontFamily.bold, color: colors.inkMuted },
  subcategoryTextActive: { color: colors.white },

  // Dietary Filters
  dietaryRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: 10, marginTop: 4, marginBottom: 16 },
  dietaryPill: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 6 },
  dietaryPillActive: { backgroundColor: 'rgba(34, 197, 94, 0.05)', borderColor: '#22C55E' },
  dietaryIcon: { width: 14, height: 14, borderWidth: 1.5, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  dietaryIconInner: { width: 6, height: 6, borderRadius: 3 },
  dietaryText: { fontSize: 12, fontFamily: fontFamily.bold, color: colors.ink },

  // 2-Column Grid
  columnWrapper: { paddingHorizontal: spacing.lg, justifyContent: 'flex-start', marginBottom: 24 },
  gridCard: { width: COLUMN_WIDTH, backgroundColor: 'transparent' },
  gridCardImageContainer: { width: '100%', aspectRatio: 1, borderRadius: 24, overflow: 'hidden', backgroundColor: colors.surfaceMuted, position: 'relative', marginBottom: 12 },
  gridCardImage: { width: '100%', height: '100%' },
  cardImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  
  vegBadgeFloat: { position: 'absolute', top: 12, left: 12, width: 16, height: 16, borderWidth: 1.5, borderRadius: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  vegDot: { width: 8, height: 8, borderRadius: 4 },
  
  gridCardInfo: { paddingHorizontal: 4 },
  cardName: { fontSize: 15, fontFamily: fontFamily.bold, color: colors.ink, marginBottom: 4, lineHeight: 20 },
  cardDesc: { fontSize: 12, color: '#8E8E93', fontFamily: fontFamily.medium, lineHeight: 16, marginBottom: 6 },
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
  customiseText: { fontSize: 9, fontFamily: fontFamily.bold, color: '#24B059', textTransform: 'uppercase' },
  
  soldOutOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' },
  soldOutText: { color: colors.ink, fontFamily: fontFamily.extrabold, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },

  // Floating cart
  floatingCart: {
    position: 'absolute', left: 16, right: 16, zIndex: 999,
    backgroundColor: colors.primary, borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 20,
  },
  floatingCartBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cartCount: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontFamily: fontFamily.extrabold, letterSpacing: 1, textTransform: 'uppercase' },
  cartTotal: { color: colors.white, fontSize: 22, fontFamily: fontFamily.black, letterSpacing: -0.5 },
  viewCartText: { color: colors.white, fontFamily: fontFamily.extrabold, fontSize: 14 },
});

export default CategoryScreen;
