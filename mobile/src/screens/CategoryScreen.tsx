import { tokens } from '../theme/tokens';
import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform,
  TextInput, ActivityIndicator, useWindowDimensions
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useQuery } from '@tanstack/react-query';
import { RootState } from '../store';
import { api } from '../api/client';
import { addItem, setQuantity } from '../store/slices/cartSlice';
import { ChevronLeft, Search, ChefHat } from 'lucide-react-native';
import { NetworkImage } from '../components/NetworkImage';
import { haptics } from '../utils/haptics';
import { PressableScale } from '../components/ui/internal/PressableScale';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedFlashList } from '@shopify/flash-list';

/** Grid card that re-renders only when its own cart qty changes */
const CategoryGridCard = React.memo(({ item, index, columnWidth, kitchenPaused, navigation, dispatch, onAdd }: any) => {
  const cartQty = useSelector((state: RootState) => {
    const ci = state.cart.items.find(i => i.menuItemId === item.id);
    return ci?.quantity ?? 0;
  });
  const vegColor = item.is_egg ? tokens.colors.warning : (item.is_veg ? tokens.colors.success : tokens.colors.danger);
  const unavailable = !item.available || kitchenPaused;
  const isEven = index % 2 === 0;
  return (
    <PressableScale
      style={[styles.gridCard, { width: columnWidth, marginLeft: isEven ? 0 : tokens.spacing.md }]}
      onPress={() => { if (item.available) navigation.navigate('ItemDetail', { item }); }}
      accessibilityRole="button"
      accessibilityLabel={`View ${item.name}`}
    >
      <View style={styles.gridCardImageContainer}>
        {item.photo_url
          ? <NetworkImage uri={item.photo_url} style={styles.gridCardImage} />
          : <View style={[styles.gridCardImage, styles.cardImagePlaceholder]}><ChefHat size={32} color={tokens.colors.textTertiary} /></View>}
        <View style={[styles.vegBadgeFloat, { borderColor: vegColor }]}>
          <View style={[styles.vegDot, { backgroundColor: vegColor }]} />
        </View>
        {item.is_bestseller && <View style={styles.bestsellerOverlay}><Text style={styles.bestsellerOverlayText}>★ Bestseller</Text></View>}
        {!item.is_bestseller && item.is_new && <View style={styles.newOverlay}><Text style={styles.newOverlayText}>+ New</Text></View>}
        {unavailable && <View style={styles.soldOutOverlay}><Text style={styles.soldOutText}>Sold Out</Text></View>}
        {!unavailable && (
          <View style={styles.gridAddBtnFloat}>
            {cartQty > 0 ? (
              <View style={styles.qtyControl}>
                <PressableScale onPress={() => { haptics.selection(); dispatch(setQuantity({ menuItemId: item.id, quantity: cartQty - 1 })); }} style={styles.qtyBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }} accessibilityRole="button" accessibilityLabel="Decrease quantity">
                  <Text style={styles.qtyBtnText}>−</Text>
                </PressableScale>
                <Text style={styles.qtyValue}>{cartQty}</Text>
                <PressableScale onPress={() => { haptics.selection(); dispatch(setQuantity({ menuItemId: item.id, quantity: cartQty + 1 })); }} style={styles.qtyBtn} hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }} accessibilityRole="button" accessibilityLabel="Increase quantity">
                  <Text style={styles.qtyBtnText}>+</Text>
                </PressableScale>
              </View>
            ) : (
              <PressableScale style={styles.addBtn} onPress={() => onAdd(item)} accessibilityRole="button" accessibilityLabel={`Add ${item.name} to cart`}>
                <Text style={styles.addBtnText}>ADD</Text>
                {Array.isArray(item.customization_groups) && item.customization_groups.length > 0 && (
                  <View style={styles.customiseBadge}><Text style={styles.customiseText}>Customise</Text></View>
                )}
              </PressableScale>
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
              <View key={tag} style={styles.tagChip}><Text style={styles.tagChipText}>{tag}</Text></View>
            ))}
          </View>
        )}
      </View>
    </PressableScale>
  );
});

const CategoryScreen = ({ route, navigation }: any) => {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  // Safe layout math using pure tokens
  const COLUMN_WIDTH = (SCREEN_WIDTH - tokens.spacing.lg * 2 - tokens.spacing.md) / 2;
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

  const { data: menuData, isLoading } = useQuery({
    queryKey: ['menu', effectiveZoneId],
    queryFn: () => api.get(`/menu?zoneId=${effectiveZoneId}`),
    enabled: !!effectiveZoneId,
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const baseItems = useMemo(() => {
    if (!menuData?.items) return [];
    const slugLower = categorySlug.toLowerCase().trim();
    const nameLower = categoryName.toLowerCase().trim();

    return menuData.items.filter((item: any) => {
      const itemCat = (item.category || '').toLowerCase().trim();
      return itemCat === slugLower || itemCat === nameLower;
    });
  }, [menuData?.items, categorySlug, categoryName]);

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
    haptics.selection();
    dispatch(addItem({
      menuItemId: item.id,
      name: item.name,
      pricePaise: item.price_paise,
      quantity: 1,
      photoUrl: item.photo_url,
      isVeg: item.is_veg,
      kitchenId: item.kitchen_id,
    }));
  }, [dispatch]);

  const renderItem = useCallback(({ item, index }: { item: any, index: number }) => (
    <CategoryGridCard
      item={item}
      index={index}
      columnWidth={COLUMN_WIDTH}
      kitchenPaused={!!menuData?.kitchenPaused}
      navigation={navigation}
      dispatch={dispatch}
      onAdd={handleAddToCart}
    />
  ), [COLUMN_WIDTH, menuData?.kitchenPaused, navigation, dispatch, handleAddToCart]);

  const totalCartQty = useMemo(() => cartItems.reduce((acc, i) => acc + i.quantity, 0), [cartItems]);
  const cartTotal = useMemo(() => cartItems.reduce((acc, i) => acc + i.quantity * i.pricePaise, 0), [cartItems]);

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {(categoryBannerUrl || categoryImage) ? (
        <View style={styles.heroImageContainer}>
          <NetworkImage uri={(categoryBannerUrl || categoryImage)!} style={styles.heroImage} />
        </View>
      ) : (
        <View style={[styles.heroImageContainer, { backgroundColor: tokens.colors.primaryTint }]}>
          <Text style={styles.heroTextFallback}>{categoryName}</Text>
        </View>
      )}

      <PressableScale
        style={[styles.floatingBackBtn, { top: Math.max(insets.top, tokens.spacing.md) }]}
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <ChevronLeft size={24} color={tokens.colors.textPrimary} />
      </PressableScale>

      <PressableScale
        style={[styles.floatingSearchBtn, { top: Math.max(insets.top, tokens.spacing.md) }]}
        onPress={() => setIsSearching(!isSearching)}
        accessibilityRole="button"
        accessibilityLabel="Search"
      >
        <Search size={22} color={tokens.colors.textPrimary} />
      </PressableScale>

      {isSearching && (
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Search size={18} color={tokens.colors.textSecondary} style={{ marginRight: tokens.spacing.sm }} />
            <TextInput
              placeholder={`Search in ${categoryName}...`}
              placeholderTextColor={tokens.colors.textSecondary}
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <PressableScale onPress={() => setSearchQuery('')}>
                <Text style={styles.clearBtn}>Clear</Text>
              </PressableScale>
            )}
          </View>
        </View>
      )}

      <View style={styles.dietaryRow}>
        {(['Veg', 'Non-Veg', 'Egg'] as const).map((type) => {
          const isActive = dietaryFilter === type;
          let iconColor = type === 'Veg' ? tokens.colors.success : type === 'Non-Veg' ? tokens.colors.danger : tokens.colors.warning;
          return (
            <PressableScale
              key={type}
              style={[styles.dietaryPill, isActive && styles.dietaryPillActive]}
              onPress={() => setDietaryFilter(isActive ? 'All' : type)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isActive }}
            >
              <View style={[styles.dietaryIcon, { borderColor: isActive ? tokens.colors.textInverse : iconColor }]}>
                <View style={[styles.dietaryIconInner, { backgroundColor: isActive ? tokens.colors.textInverse : iconColor, borderRadius: type === 'Egg' ? 4 : 4 }]} />
              </View>
              <Text style={[styles.dietaryText, isActive && styles.dietaryTextActive]}>{type}</Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={tokens.colors.primary} />
        </View>
      ) : (
        <AnimatedFlashList
          data={filteredItems}
          keyExtractor={(item: any) => item.id}
          renderItem={renderItem}
          numColumns={2}
          estimatedItemSize={260}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyTitle}>No items found</Text>
              <Text style={styles.emptySub}>Try removing filters</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ 
            paddingHorizontal: tokens.spacing.md,
            paddingBottom: totalCartQty > 0 ? 120 : Math.max(insets.bottom + tokens.spacing.xl, 40) 
          }}
        />
      )}

      {totalCartQty > 0 && (
        <View style={[styles.floatingCart, { bottom: Math.max(insets.bottom, tokens.spacing.md) + tokens.spacing.sm }]}>
          <PressableScale
            style={styles.floatingCartBtn}
            onPress={() => navigation.navigate('Cart')}
            accessibilityRole="button"
            accessibilityLabel="View Cart"
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.cartCount}>{totalCartQty} {totalCartQty === 1 ? 'ITEM' : 'ITEMS'}</Text>
              <Text style={styles.cartTotal}>  ₹{cartTotal / 100}</Text>
            </View>
            <Text style={styles.viewCartText}>View Cart</Text>
          </PressableScale>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: tokens.spacing.xl, marginTop: tokens.spacing.xl },
  emptyTitle: { fontSize: 18, fontFamily: tokens.typography.family.black, color: tokens.colors.textPrimary, marginBottom: tokens.spacing.xs },
  emptySub: { fontSize: 14, fontFamily: tokens.typography.family.medium, color: tokens.colors.textSecondary },
  
  headerContainer: { backgroundColor: 'transparent', paddingBottom: tokens.spacing.lg, zIndex: 10, marginHorizontal: -tokens.spacing.md },
  heroImageContainer: { width: '100%', height: 260, position: 'relative', borderBottomLeftRadius: tokens.radii.xxl, borderBottomRightRadius: tokens.radii.xxl, overflow: 'hidden' },
  heroImage: { width: '100%', height: '100%' },
  heroTextFallback: { fontSize: 32, fontFamily: tokens.typography.family.black, color: tokens.colors.textPrimary, position: 'absolute', bottom: tokens.spacing.xl, left: tokens.spacing.xl + tokens.spacing.md },
  
  floatingBackBtn: {
    position: 'absolute', left: tokens.spacing.lg + tokens.spacing.md, width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.8)', alignItems: 'center', justifyContent: 'center',
    ...tokens.shadows.md,
  },
  floatingSearchBtn: {
    position: 'absolute', right: tokens.spacing.lg + tokens.spacing.md, width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.8)', alignItems: 'center', justifyContent: 'center',
    ...tokens.shadows.md,
  },

  searchRow: { paddingHorizontal: tokens.spacing.sm + tokens.spacing.md, marginTop: tokens.spacing.lg },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: tokens.colors.background, 
    borderRadius: tokens.radii.xl, paddingHorizontal: tokens.spacing.lg, height: 48,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: tokens.typography.family.medium, color: tokens.colors.textPrimary, padding: 0 },
  clearBtn: { fontSize: 13, fontFamily: tokens.typography.family.bold, color: tokens.colors.textSecondary },

  dietaryRow: { flexDirection: 'row', paddingHorizontal: tokens.spacing.sm + tokens.spacing.md, gap: tokens.spacing.sm, marginTop: tokens.spacing.xs, marginBottom: tokens.spacing.lg },
  dietaryPill: { flexDirection: 'row', alignItems: 'center', paddingVertical: tokens.spacing.sm, paddingHorizontal: 14, borderRadius: 24, backgroundColor: tokens.colors.surface, gap: tokens.spacing.sm },
  dietaryPillActive: { backgroundColor: tokens.colors.textPrimary },
  dietaryIcon: { width: 14, height: 14, borderWidth: 1.5, borderRadius: tokens.radii.sm, alignItems: 'center', justifyContent: 'center' },
  dietaryIconInner: { width: 6, height: 6, borderRadius: 3 },
  dietaryText: { fontSize: 13, fontFamily: tokens.typography.family.bold, color: tokens.colors.textSecondary },
  dietaryTextActive: { color: tokens.colors.textInverse },

  gridCard: { backgroundColor: 'transparent', marginBottom: tokens.spacing.lg },
  gridCardImageContainer: { width: '100%', aspectRatio: 1, borderRadius: tokens.radii.xl, overflow: 'hidden', backgroundColor: tokens.colors.background, position: 'relative', marginBottom: tokens.spacing.md, ...tokens.shadows.sm },
  gridCardImage: { width: '100%', height: '100%' },
  cardImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  
  vegBadgeFloat: { position: 'absolute', top: tokens.spacing.sm, left: tokens.spacing.sm, width: 16, height: 16, borderWidth: 1.5, borderRadius: tokens.radii.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colors.surface },
  vegDot: { width: 8, height: 8, borderRadius: 4 },
  
  gridCardInfo: { paddingHorizontal: tokens.spacing.xs },
  cardName: { fontSize: 15, fontFamily: tokens.typography.family.bold, color: tokens.colors.textPrimary, marginBottom: 4, lineHeight: 20 },
  cardDesc: { fontSize: 12, color: tokens.colors.textTertiary, fontFamily: tokens.typography.family.medium, lineHeight: 16, marginBottom: 6 },
  cardPrice: { fontSize: 15, fontFamily: tokens.typography.family.black, color: tokens.colors.textPrimary },
  
  gridAddBtnFloat: { position: 'absolute', bottom: -1, alignSelf: 'center', width: '85%', zIndex: 10 },
  qtyControl: {
    flexDirection: 'row', backgroundColor: tokens.colors.primary, borderRadius: tokens.radii.xl,
    alignItems: 'center', justifyContent: 'space-between', height: 36,
  },
  qtyBtn: { width: 34, height: 36, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { color: tokens.colors.textInverse, fontSize: 18, fontFamily: tokens.typography.family.bold },
  qtyValue: { color: tokens.colors.textInverse, fontSize: 14, fontFamily: tokens.typography.family.extrabold },
  addBtn: {
    backgroundColor: tokens.colors.surface, borderRadius: tokens.radii.xl, height: 36,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: tokens.colors.border,
    position: 'relative'
  },
  addBtnText: { color: tokens.colors.primary, fontFamily: tokens.typography.family.extrabold, fontSize: 14, letterSpacing: 0.5 },
  customiseBadge: { position: 'absolute', top: -10, backgroundColor: tokens.colors.surface, paddingHorizontal: 8, paddingVertical: 2, borderRadius: tokens.radii.md, borderWidth: 1, borderColor: tokens.colors.border },
  customiseText: { fontSize: 9, fontFamily: tokens.typography.family.bold, color: tokens.colors.primary, textTransform: 'uppercase' },
  
  soldOutOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255, 255, 255, 0.8)', alignItems: 'center', justifyContent: 'center' },
  soldOutText: { color: tokens.colors.textPrimary, fontFamily: tokens.typography.family.extrabold, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },

  bestsellerOverlay: { position: 'absolute', top: 10, right: 10, backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  bestsellerOverlayText: { fontSize: 10, fontFamily: tokens.typography.family.extrabold, color: '#92400E', letterSpacing: 0.2 },
  newOverlay: { position: 'absolute', top: 10, right: 10, backgroundColor: '#EDE9FE', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  newOverlayText: { fontSize: 10, fontFamily: tokens.typography.family.extrabold, color: '#5B21B6', letterSpacing: 0.2 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  tagChip: { backgroundColor: tokens.colors.background, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 0 },
  tagChipText: { fontSize: 10, fontFamily: tokens.typography.family.bold, color: tokens.colors.textSecondary },

  floatingCart: {
    position: 'absolute', left: tokens.spacing.lg, right: tokens.spacing.lg, zIndex: 999,
    backgroundColor: tokens.colors.primary, borderRadius: 20,
    paddingVertical: 14, paddingHorizontal: tokens.spacing.lg,
    ...tokens.shadows.lg,
  },
  floatingCartBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cartCount: { color: tokens.colors.textInverse, opacity: 0.9, fontSize: 12, fontFamily: tokens.typography.family.extrabold, letterSpacing: 1, textTransform: 'uppercase' },
  cartTotal: { color: tokens.colors.textInverse, fontSize: 18, fontFamily: tokens.typography.family.black, letterSpacing: -0.5 },
  viewCartText: { color: tokens.colors.textInverse, fontFamily: tokens.typography.family.extrabold, fontSize: 14 },
});

export default CategoryScreen;
