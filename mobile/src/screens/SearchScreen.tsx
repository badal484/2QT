import { tokens } from '../theme/tokens';
import { ArrowLeft, ChefHat, Flame, Search, SearchX, Utensils, X } from 'lucide-react-native';
import React, { useState, useEffect, useMemo } from 'react';
import { PressableScale } from '../components/ui/internal/PressableScale';
import { View, Text, TextInput, FlatList, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { NetworkImage } from '../components/NetworkImage';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { addItem, setQuantity } from '../store/slices/cartSlice';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Search result row — subscribes to its own cart quantity so only it re-renders on cart change */
const SearchResultCard = React.memo(({ item, dispatch, navigation, saveSearch, query }: any) => {
  const cartQty = useSelector((state: RootState) => {
    const ci = state.cart.items.find(i => i.menuItemId === item.id);
    return ci?.quantity ?? 0;
  });
  return (
    <PressableScale
      onPress={() => { saveSearch(query); navigation.navigate('ItemDetail', { item }); }}
      style={styles.itemCard}
      accessibilityRole="button"
      accessibilityLabel={`View details for ${item.name}`}
    >
      <View style={styles.itemImageWrapper}>
        {item.photo_url
          ? <NetworkImage uri={item.photo_url} style={styles.itemImage} fallbackText={item.name[0]} />
          : <View style={styles.itemPlaceholder}><ChefHat size={32} color={tokens.colors.primary} /></View>}
      </View>
      <View style={styles.itemDetails}>
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
        <View style={styles.itemRightCol}>
          <Text allowFontScaling={false} style={styles.itemPrice}>₹{item.price_paise / 100}</Text>
          {cartQty > 0 ? (
            <View style={styles.quantityControl}>
              <PressableScale hitSlop={8} onPress={() => dispatch(setQuantity({ menuItemId: item.id, quantity: cartQty - 1 }))} accessibilityRole="button" accessibilityLabel="Decrease quantity">
                <Text allowFontScaling={false} style={styles.quantityBtnText}>−</Text>
              </PressableScale>
              <Text allowFontScaling={false} style={styles.quantityValueText}>{cartQty}</Text>
              <PressableScale hitSlop={8} onPress={() => dispatch(setQuantity({ menuItemId: item.id, quantity: cartQty + 1 }))} accessibilityRole="button" accessibilityLabel="Increase quantity">
                <Text allowFontScaling={false} style={styles.quantityBtnText}>+</Text>
              </PressableScale>
            </View>
          ) : (
            <PressableScale
              style={styles.addButton}
              hitSlop={8}
              onPress={() => dispatch(addItem({ menuItemId: item.id, name: item.name, pricePaise: item.price_paise, quantity: 1, photoUrl: item.photo_url, isVeg: item.is_veg, kitchenId: item.kitchen_id }))}
              accessibilityRole="button"
              accessibilityLabel={`Add ${item.name} to cart`}
            >
              <Text allowFontScaling={false} style={styles.addButtonText}>Add</Text>
            </PressableScale>
          )}
        </View>
      </View>
    </PressableScale>
  );
});

const SearchScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const { zoneId } = useSelector((state: RootState) => state.cart);
  const { user } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();

  // 300ms debounce — avoids firing API on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const effectiveZoneId = zoneId || user?.zoneId;

  const { data: searchResults, isLoading } = useQuery({
    queryKey: ['search', debouncedQuery, effectiveZoneId],
    queryFn: () => api.get(`/menu/search?q=${encodeURIComponent(debouncedQuery)}&zoneId=${effectiveZoneId}`),
    enabled: debouncedQuery.length > 2 && !!effectiveZoneId,
  });

  const filteredResults = useMemo(
    () => searchResults?.results?.filter((item: any) => vegOnly ? item.is_veg : true) ?? [],
    [searchResults?.results, vegOnly],
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
    if (!term || term.trim().length < 3) return;
    const termClean = term.trim().toLowerCase();
    setRecentSearches(prev => {
      const current = prev.filter(s => s.toLowerCase() !== termClean);
      const updated = [termClean, ...current].slice(0, 5);
      AsyncStorage.setItem('recent_searches', JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 12) }]}>
        <View style={styles.titleRow}>
          <PressableScale onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go Back">
            <ArrowLeft size={24} color={tokens.colors.textPrimary} />
          </PressableScale>
          <Text allowFontScaling={false} style={styles.titleText}>Search</Text>
        </View>

        <View style={[styles.searchBar, searchFocused && styles.searchBarFocused]}>
          <Search size={17} color={searchFocused ? tokens.colors.primary : tokens.colors.textTertiary} style={{ marginRight: 8 }} />
          <TextInput
            autoFocus
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
            <PressableScale onPress={() => setQuery('')} style={styles.searchClearBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search query">
              <X size={13} color={tokens.colors.textPrimary} strokeWidth={2.5} />
            </PressableScale>
          )}
        </View>

        <View style={styles.filterRow}>
            <PressableScale
                style={[styles.filterChip, vegOnly ? styles.filterChipActive : null]}
                onPress={() => setVegOnly(!vegOnly)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: vegOnly }}
                accessibilityLabel="Pure Veg filter"
            >
                <View style={[styles.checkbox, vegOnly && styles.checkboxActive]}>
                  {vegOnly && <View style={styles.checkboxTick} />}
                </View>
                <Text allowFontScaling={false} style={[styles.filterChipText, vegOnly ? styles.filterChipTextActive : null]}>Pure Veg</Text>
            </PressableScale>

            {!isLoading && query.length >= 3 && filteredResults.length > 0 && (
              <Text allowFontScaling={false} style={styles.resultCount}>{filteredResults.length} item{filteredResults.length === 1 ? '' : 's'} found</Text>
            )}
        </View>
      </View>

      <View style={styles.scrollView}>
        {isLoading ? (
          <View style={styles.loadingWrapper}>
            <ActivityIndicator color={tokens.colors.primary} />
          </View>
        ) : query.length < 3 ? (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.emptyState}>
            {recentSearches.length > 0 ? (
                <View style={{ width: '100%', alignItems: 'flex-start' }}>
                    <Text allowFontScaling={false} style={[styles.sectionLabel, { marginBottom: 16 }]}>Recent Searches</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                        {recentSearches.map(rs => (
                            <PressableScale
                                key={rs}
                                style={styles.recentSearchChip}
                                onPress={() => setQuery(rs)}
                                accessibilityRole="button"
                                accessibilityLabel={`Search for ${rs}`}
                            >
                                <Search size={12} color={tokens.colors.textSecondary} style={{ marginRight: 6 }} />
                                <Text allowFontScaling={false} style={styles.recentSearchText}>{rs}</Text>
                            </PressableScale>
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
              contentContainerStyle={[styles.resultsContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            />
          </Animated.View>
        )}
      </View>
    </KeyboardAvoidingView>
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
});

export default SearchScreen;
