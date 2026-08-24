import { tokens } from '../theme/tokens';
import { ArrowLeft, ChefHat, Flame, Search, SearchX, Utensils, X } from 'lucide-react-native';
import React, { useState, useEffect, useMemo } from 'react';
import { PressableScale } from '../components/ui/internal/PressableScale';
import { CustomVegToggle } from '../components/ui/internal/CustomVegToggle';
import { View, Text, TextInput, FlatList, ActivityIndicator, StyleSheet, Platform, InteractionManager, TouchableOpacity } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { NetworkImage } from '../components/NetworkImage';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { addItem, setQuantity } from '../store/slices/cartSlice';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { enrichItemsWithOffers } from '../utils/menuOfferUtils';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

/** Search result row — subscribes to its own cart quantity so only it re-renders on cart change */
const SearchResultCard = React.memo(({ item, dispatch, navigation, saveSearch, query }: any) => {
  const cartQty = useSelector((state: RootState) => {
    const ci = state.cart.items.find(ci => ci.menuItemId === item.id);
    return ci?.quantity ?? 0;
  });
  const hasOffer = !!item.applied_offer && item.original_price_paise > item.price_paise;

  const handleOpenDetail = () => {
    saveSearch(query);
    navigation.navigate('ItemDetail', { item });
  };

  return (
    <View style={styles.itemCard}>
      <PressableScale
        onPress={handleOpenDetail}
        style={{ flexDirection: 'row', flex: 1, alignItems: 'center' }}
        accessibilityRole="button"
        accessibilityLabel={`View details for ${item.name}`}
      >
        <View style={styles.itemImageWrapper}>
          {item.photo_url
            ? <NetworkImage uri={item.photo_url} style={styles.itemImage} fallbackText={item.name[0]} />
            : <View style={styles.itemPlaceholder}><ChefHat size={32} color={tokens.colors.primary} /></View>}
          {hasOffer && !!item.discount_badge && (
            <View style={styles.imageOfferBadge}>
              <Text allowFontScaling={false} style={styles.imageOfferBadgeText}>{item.discount_badge}</Text>
            </View>
          )}
        </View>
        <View style={[styles.itemDetails, { flex: 1 }]}>
          <View style={{ flex: 1 }}>
            <View style={styles.itemNameRow}>
              <View style={[styles.vegIndicator, { borderColor: item.is_veg ? tokens.colors.success : tokens.colors.danger }]}>
                <View style={[styles.vegDot, { backgroundColor: item.is_veg ? tokens.colors.success : tokens.colors.danger }]} />
              </View>
              <Text allowFontScaling={false} style={styles.itemName} numberOfLines={1}>{item.name}</Text>
            </View>
            {!!item.description && (
              <Text allowFontScaling={false} style={styles.itemDesc} numberOfLines={2}>{item.description}</Text>
            )}
            {item.is_bestseller && (
              <View style={styles.tagRow}>
                <Flame size={12} color={tokens.colors.primary} fill={tokens.colors.primary} />
                <Text allowFontScaling={false} style={styles.tagBestsellerText}>Bestseller</Text>
              </View>
            )}
          </View>
        </View>
      </PressableScale>

      <View style={styles.itemRightCol}>
        {hasOffer ? (
          <View style={{ alignItems: 'flex-end', marginBottom: 4 }}>
            <Text allowFontScaling={false} style={styles.itemPrice}>₹{item.price_paise / 100}</Text>
            <Text allowFontScaling={false} style={styles.strikethroughPrice}>₹{item.original_price_paise / 100}</Text>
          </View>
        ) : (
          <Text allowFontScaling={false} style={styles.itemPrice}>₹{item.price_paise / 100}</Text>
        )}
        {cartQty > 0 ? (
          <View style={styles.quantityControl}>
            <TouchableOpacity
              activeOpacity={0.6}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 6 }}
              onPress={() => dispatch(setQuantity({ menuItemId: item.id, quantity: cartQty - 1 }))}
              accessibilityRole="button"
              accessibilityLabel="Decrease quantity"
            >
              <Text allowFontScaling={false} style={styles.quantityBtnText}>−</Text>
            </TouchableOpacity>
            <Text allowFontScaling={false} style={styles.quantityValueText}>{cartQty}</Text>
            <TouchableOpacity
              activeOpacity={0.6}
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 10 }}
              onPress={() => dispatch(setQuantity({ menuItemId: item.id, quantity: cartQty + 1 }))}
              accessibilityRole="button"
              accessibilityLabel="Increase quantity"
            >
              <Text allowFontScaling={false} style={styles.quantityBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.addButton}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => dispatch(addItem({ menuItemId: item.id, name: item.name, pricePaise: item.price_paise, quantity: 1, photoUrl: item.photo_url, isVeg: item.is_veg, kitchenId: item.kitchen_id }))}
            accessibilityRole="button"
            accessibilityLabel={`Add ${item.name} to cart`}
          >
            <Text allowFontScaling={false} style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

const SearchScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const { zoneId, items: cartItems } = useSelector((state: RootState) => state.cart);
  const { user } = useSelector((state: RootState) => state.auth);
  const location = useSelector((state: RootState) => (state as any).location);
  const { isOnline } = useNetworkStatus();
  const totalCartQty = useMemo(() => cartItems.reduce((sum, i) => sum + i.quantity, 0), [cartItems]);
  const cartTotal = useMemo(() => cartItems.reduce((sum, i) => sum + (i.pricePaise / 100) * i.quantity, 0), [cartItems]);
  const dispatch = useDispatch();
  const inputRef = React.useRef<TextInput>(null);

  useFocusEffect(
    React.useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        inputRef.current?.focus();
      });
      return () => task.cancel();
    }, [])
  );

  // 200ms debounce for responsive live typing suggestions
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  const effectiveZoneId = location?.serviceableZoneId || location?.zoneId || zoneId || user?.zoneId;

  const { data: searchResults, isLoading } = useQuery({
    queryKey: ['search', debouncedQuery.trim(), effectiveZoneId],
    queryFn: () => api.get(`/menu/search?q=${encodeURIComponent(debouncedQuery.trim())}&zoneId=${effectiveZoneId}`),
    enabled: debouncedQuery.trim().length > 0 && !!effectiveZoneId,
  });

  const enrichedResults = useMemo(() => {
    const rawItems = searchResults?.results ?? [];
    const offers = searchResults?.offers ?? [];
    return enrichItemsWithOffers(rawItems, offers);
  }, [searchResults?.results, searchResults?.offers]);

  const filteredResults = useMemo(
    () => enrichedResults.filter((item: any) => vegOnly ? item.is_veg : true),
    [enrichedResults, vegOnly],
  );

  const [recentSearches, setRecentSearches] = React.useState<string[]>([]);

  React.useEffect(() => {
    const loadSearches = async () => {
      try {
        const stored = await AsyncStorage.getItem('recent_searches');
        if (stored) {
          setRecentSearches(JSON.parse(stored));
        }
      } catch (e) {}
    };
    loadSearches();
  }, []);

  const saveSearch = React.useCallback(async (term: string) => {
    if (!term || term.trim().length < 1) return;
    const termClean = term.trim().toLowerCase();
    setRecentSearches(prev => {
      const current = prev.filter(s => s.toLowerCase() !== termClean);
      const updated = [termClean, ...current].slice(0, 5);
      AsyncStorage.setItem('recent_searches', JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  const removeSearch = React.useCallback(async (term: string) => {
    setRecentSearches(prev => {
      const updated = prev.filter(s => s !== term);
      AsyncStorage.setItem('recent_searches', JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 12) }]}>
        <View style={styles.titleRow}>
          <PressableScale onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go Back">
            <ArrowLeft size={24} color={tokens.colors.textPrimary} />
          </PressableScale>
          <Text allowFontScaling={false} style={styles.titleText}>Search</Text>
        </View>

        <PressableScale onPress={() => inputRef.current?.focus()} style={[styles.searchBar, searchFocused && styles.searchBarFocused]}>
          <Search size={17} color={searchFocused ? tokens.colors.primary : tokens.colors.textTertiary} style={{ marginRight: 8 }} />
          <TextInput
            ref={inputRef}
            placeholder="Search dishes..."
            value={query}
            onChangeText={setQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            onSubmitEditing={(e) => saveSearch(e.nativeEvent.text)}
            style={styles.searchInput}
            placeholderTextColor={tokens.colors.textTertiary}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <PressableScale onPress={() => { setQuery(''); inputRef.current?.focus(); }} style={styles.searchClearBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search query">
              <X size={13} color={tokens.colors.textPrimary} strokeWidth={2.5} />
            </PressableScale>
          )}
          
          <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
            <Text allowFontScaling={false} style={{ fontSize: 9, fontFamily: tokens.typography.family.extrabold, color: vegOnly ? tokens.colors.success : tokens.colors.primary, letterSpacing: 0.5, marginRight: 6 }}>VEG</Text>
            <View style={{ width: 1, height: 16, backgroundColor: tokens.colors.border, marginRight: 6 }} />
            <CustomVegToggle value={vegOnly} onValueChange={setVegOnly} />
          </View>
        </PressableScale>

        <View style={[styles.filterRow, { justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }]}>
          {!isOnline ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#F59E0B', marginRight: 5 }} />
              <Text allowFontScaling={false} style={{ fontSize: 11, fontFamily: tokens.typography.family.medium, color: '#F59E0B' }}>
                Searching saved dishes (Offline)
              </Text>
            </View>
          ) : <View />}
          {!isLoading && query.trim().length > 0 && (
            <Text allowFontScaling={false} style={styles.resultCount}>{filteredResults.length} item{filteredResults.length === 1 ? '' : 's'} found</Text>
          )}
        </View>
      </View>

      <View style={styles.scrollView}>
        {isLoading ? (
          <View style={styles.loadingWrapper}>
            <ActivityIndicator color={tokens.colors.primary} />
          </View>
        ) : query.trim().length === 0 ? (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.emptyState}>
            {recentSearches.length > 0 ? (
                <View style={{ width: '100%', alignItems: 'flex-start' }}>
                    <Text allowFontScaling={false} style={[styles.sectionLabel, { marginBottom: 16 }]}>Recent Searches</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                        {recentSearches.map(rs => (
                            <View key={rs} style={[styles.recentSearchChip, { paddingRight: 6 }]}>
                                <PressableScale
                                    style={{ flexDirection: 'row', alignItems: 'center' }}
                                    onPress={() => setQuery(rs)}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Search for ${rs}`}
                                >
                                    <Search size={12} color={tokens.colors.textSecondary} style={{ marginRight: 6 }} />
                                    <Text allowFontScaling={false} style={styles.recentSearchText}>{rs}</Text>
                                </PressableScale>
                                <PressableScale
                                    style={{ padding: 6, marginLeft: 4 }}
                                    onPress={() => removeSearch(rs)}
                                >
                                    <X size={14} color={tokens.colors.textTertiary} />
                                </PressableScale>
                            </View>
                        ))}
                    </View>
                </View>
            ) : (
                <>
                    <View style={styles.emptyIconWrapper}>
                    <Utensils size={48} color={tokens.colors.primary} />
                    </View>
                    <Text allowFontScaling={false} style={styles.emptyTitle}>Hungry?</Text>
                    <Text allowFontScaling={false} style={styles.emptySub}>Type at least 3 characters to find your favorite dishes.</Text>
                </>
            )}
          </Animated.View>
        ) : filteredResults.length === 0 ? (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.emptyState}>
            <View style={[styles.emptyIconWrapper, { backgroundColor: tokens.colors.background }]}>
              <SearchX size={48} color={tokens.colors.textTertiary} />
            </View>
            <Text allowFontScaling={false} style={styles.emptyTitle}>No results found</Text>
            <Text allowFontScaling={false} style={styles.emptySub}>We couldn't find anything matching "{query}". Try something else?</Text>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.duration(200)} style={{ flex: 1 }}>
            <FlatList
              data={filteredResults}
              keyExtractor={(item: any) => item.id}
              renderItem={({ item }: any) => (
                <SearchResultCard
                  item={item}
                  dispatch={dispatch}
                  navigation={navigation}
                  saveSearch={saveSearch}
                  query={query}
                />
              )}
              contentContainerStyle={[styles.resultsContainer, { paddingBottom: totalCartQty > 0 ? 100 : Math.max(insets.bottom, 16) }]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            />
          </Animated.View>
        )}
      </View>

      {/* FLOATING VIEW CART BAR */}
      {totalCartQty > 0 && (
        <Animated.View entering={FadeInDown.duration(300)} style={[styles.floatingCart, { bottom: Math.max(insets.bottom + 12, 20) }]}>
          <PressableScale
            style={styles.floatingCartBtn}
            onPress={() => navigation.navigate('Cart')}
            accessibilityRole="button"
            accessibilityLabel="View Cart"
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text allowFontScaling={false} style={styles.cartCount}>{totalCartQty} {totalCartQty === 1 ? 'ITEM' : 'ITEMS'}</Text>
              <Text allowFontScaling={false} style={styles.cartTotal}>  ₹{cartTotal.toFixed(0)}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text allowFontScaling={false} style={styles.viewCartText}>View Cart</Text>
              <Text allowFontScaling={false} style={styles.viewCartArrow}>  →</Text>
            </View>
          </PressableScale>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
  },
  header: {
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.md,
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: tokens.spacing.md,
  },
  backButton: {
    marginRight: tokens.spacing.md,
  },
  titleText: {
    fontSize: 21,
    fontFamily: tokens.typography.family.extrabold,
    color: tokens.colors.textPrimary,
    letterSpacing: -0.3,
  },
  searchBar: {
    backgroundColor: tokens.colors.background,
    height: 44,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  searchBarFocused: {
    borderColor: tokens.colors.primary,
    backgroundColor: tokens.colors.surface,
    ...tokens.shadows.soft,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontFamily: tokens.typography.family.semibold,
    color: tokens.colors.textPrimary,
    fontSize: 14,
  },
  searchClearBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: tokens.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: tokens.spacing.md,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
  },
  filterChipActive: {
    borderColor: tokens.colors.textPrimary,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: tokens.colors.textTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  checkboxActive: {
    borderColor: tokens.colors.textPrimary,
    backgroundColor: tokens.colors.textPrimary,
  },
  checkboxTick: {
    width: 7,
    height: 7,
    borderRadius: 1,
    backgroundColor: tokens.colors.textInverse,
  },
  filterChipText: {
    color: tokens.colors.textSecondary,
    fontFamily: tokens.typography.family.semibold,
    fontSize: 12,
  },
  filterChipTextActive: {
    color: tokens.colors.textPrimary,
  },
  resultCount: {
    color: tokens.colors.textSecondary,
    fontFamily: tokens.typography.family.medium,
    fontSize: 12,
  },
  scrollView: {
    flex: 1,
  },
  loadingWrapper: {
    paddingVertical: 80,
    alignItems: 'center',
  },
  emptyState: {
    paddingVertical: 80,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconWrapper: {
    width: 96,
    height: 96,
    backgroundColor: 'rgba(252, 70, 3, 0.05)',
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    color: tokens.colors.textPrimary,
    fontSize: 20,
    fontFamily: tokens.typography.family.black,
    textAlign: 'center',
  },
  emptySub: {
    color: tokens.colors.textTertiary,
    textAlign: 'center',
    marginTop: 8,
    fontFamily: tokens.typography.family.medium,
    fontSize: 14,
    lineHeight: 20,
  },
  resultsContainer: {
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: 14,
  },
  itemCard: {
    flexDirection: 'row',
    marginBottom: tokens.spacing.md,
    backgroundColor: tokens.colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 10,
    ...tokens.shadows.soft,
  },
  itemImageWrapper: {
    width: 84,
    height: 84,
    backgroundColor: tokens.colors.background,
    borderRadius: 12,
    overflow: 'hidden',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  itemPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemDetails: {
    flex: 1,
    flexDirection: 'row',
    marginLeft: tokens.spacing.md,
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vegIndicator: {
    width: 12,
    height: 12,
    borderRadius: 3,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  vegDot: {
    width: 4.5,
    height: 4.5,
    borderRadius: 2.5,
  },
  itemName: {
    color: tokens.colors.textPrimary,
    fontSize: 14,
    fontFamily: tokens.typography.family.bold,
    flex: 1,
    letterSpacing: -0.2,
  },
  itemDesc: {
    color: tokens.colors.textSecondary,
    fontFamily: tokens.typography.family.medium,
    fontSize: 11.5,
    lineHeight: 15,
    marginTop: 2,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  tagBestsellerText: {
    color: tokens.colors.primary,
    fontFamily: tokens.typography.family.bold,
    fontSize: 11,
  },
  itemRightCol: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginLeft: tokens.spacing.sm,
  },
  itemPrice: {
    color: tokens.colors.textPrimary,
    fontFamily: tokens.typography.family.extrabold,
    fontSize: 14,
  },
  strikethroughPrice: {
    color: tokens.colors.textTertiary,
    fontFamily: tokens.typography.family.medium,
    fontSize: 11,
    textDecorationLine: 'line-through',
    marginTop: 1,
  },
  imageOfferBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#10B981',
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  imageOfferBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontFamily: tokens.typography.family.black,
    letterSpacing: 0.5,
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.primary,
    borderRadius: 14,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  quantityBtnText: {
    color: tokens.colors.textInverse,
    fontSize: 14,
    fontFamily: tokens.typography.family.black,
    paddingHorizontal: 6,
  },
  quantityValueText: {
    color: tokens.colors.textInverse,
    fontFamily: tokens.typography.family.black,
    fontSize: 12,
    marginHorizontal: 2,
  },
  sectionLabel: {
    color: tokens.colors.textPrimary,
    fontFamily: tokens.typography.family.black,
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 12,
  },
  recentSearchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.background,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    borderRadius: 20,
    marginRight: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
  },
  recentSearchText: {
    color: tokens.colors.textSecondary,
    fontFamily: tokens.typography.family.bold,
    fontSize: 14,
  },
  addButton: {
    backgroundColor: tokens.colors.primaryTint,
    borderWidth: 1.5,
    borderColor: tokens.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 14,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: tokens.colors.primary,
    fontFamily: tokens.typography.family.black,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  floatingCart: {
    position: 'absolute',
    left: tokens.spacing.lg,
    right: tokens.spacing.lg,
    zIndex: 99,
  },
  floatingCartBtn: {
    backgroundColor: tokens.colors.primary,
    borderRadius: 16,
    paddingHorizontal: tokens.spacing.xl,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: tokens.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  cartCount: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: tokens.typography.family.extrabold,
    letterSpacing: 1,
    opacity: 0.9,
  },
  cartTotal: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: tokens.typography.family.black,
  },
  viewCartText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: tokens.typography.family.extrabold,
  },
  viewCartArrow: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: tokens.typography.family.black,
  },
});

export default SearchScreen;
