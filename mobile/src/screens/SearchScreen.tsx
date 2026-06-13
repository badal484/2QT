import { ArrowLeft, ChefHat, Search, SearchX, Utensils } from 'lucide-react-native';
import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import Animated, { FadeIn, BounceIn } from 'react-native-reanimated';
import { NetworkImage } from '../components/NetworkImage';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { addItem, setQuantity } from '../store/slices/cartSlice';
import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV();

const SearchScreen = ({ navigation }: any) => {
  const [query, setQuery] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const { zoneId } = useSelector((state: RootState) => state.cart);
  const { user } = useSelector((state: RootState) => state.auth);
  const cartItems = useSelector((state: RootState) => state.cart.items);
  const dispatch = useDispatch();

  const { data: searchResults, isLoading } = useQuery({
    queryKey: ['search', query, zoneId || user?.zoneId],
    queryFn: () => api.get(`/menu/search?q=${query}&zoneId=${zoneId || user?.zoneId}`),
    enabled: query.length > 2 && !!(zoneId || user?.zoneId),
  });

  const filteredResults = searchResults?.results?.filter((item: any) => vegOnly ? item.is_veg : true) || [];

  const [recentSearches, setRecentSearches] = React.useState<string[]>([]);

  React.useEffect(() => {
    const stored = storage.getString('recent_searches');
    if (stored) {
      try {
        setRecentSearches(JSON.parse(stored));
      } catch (e) {}
    }
  }, []);

  const saveSearch = (term: string) => {
    if (!term || term.trim().length < 3) return;
    const termClean = term.trim().toLowerCase();
    const current = recentSearches.filter(s => s.toLowerCase() !== termClean);
    const updated = [termClean, ...current].slice(0, 5);
    setRecentSearches(updated);
    storage.set('recent_searches', JSON.stringify(updated));
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <ArrowLeft size={24} color="#1A1A2E" />
          </TouchableOpacity>
          <View style={styles.searchBar}>
            <Search size={20} color="#9CA3AF" style={{ marginRight: 12 }} />
            <TextInput 
              autoFocus
              placeholder="Search dishes..."
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={(e) => saveSearch(e.nativeEvent.text)}
              style={styles.searchInput}
              placeholderTextColor="#9ca3af"
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Text style={styles.clearIcon}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.filterRow}>
            <TouchableOpacity 
                style={[styles.filterChip, vegOnly ? styles.filterChipActive : null]}
                onPress={() => setVegOnly(!vegOnly)}
            >
                <View style={styles.vegIndicator}>
                    <View style={styles.vegDot} />
                </View>
                <Text style={[styles.filterChipText, vegOnly ? styles.filterChipTextActive : null]}>Pure Veg</Text>
            </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.loadingWrapper}>
            <ActivityIndicator color="#FF6B35" />
          </View>
        ) : query.length < 3 ? (
          <Animated.View entering={BounceIn} style={styles.emptyState}>
            {recentSearches.length > 0 ? (
                <View style={{ width: '100%', alignItems: 'flex-start' }}>
                    <Text style={[styles.sectionLabel, { marginBottom: 16 }]}>Recent Searches</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                        {recentSearches.map(rs => (
                            <TouchableOpacity 
                                key={rs}
                                style={styles.recentSearchChip}
                                onPress={() => setQuery(rs)}
                            >
                                <Search size={12} color="#6B7280" style={{ marginRight: 6 }} />
                                <Text style={styles.recentSearchText}>{rs}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            ) : (
                <>
                    <View style={styles.emptyIconWrapper}>
                    <Utensils size={48} color="#FF6B35" />
                    </View>
                    <Text style={styles.emptyTitle}>Hungry?</Text>
                    <Text style={styles.emptySub}>Type at least 3 characters to find your favorite dishes.</Text>
                </>
            )}
          </Animated.View>
        ) : filteredResults.length === 0 ? (
          <Animated.View entering={BounceIn} style={styles.emptyState}>
            <View style={[styles.emptyIconWrapper, { backgroundColor: '#f9fafb' }]}>
              <SearchX size={48} color="#9CA3AF" />
            </View>
            <Text style={styles.emptyTitle}>No results found</Text>
            <Text style={styles.emptySub}>We couldn't find anything matching "{query}". Try something else?</Text>
          </Animated.View>
        ) : (
          <View style={styles.resultsContainer}>
            {filteredResults.map((item: any) => {
              const cartItem = cartItems.find(ci => ci.menuItemId === item.id);
              return (
                <TouchableOpacity 
                  key={item.id}
                  activeOpacity={0.9}
                  onPress={() => {
                    saveSearch(query);
                    navigation.navigate('ItemDetail', { item });
                  }}
                  style={styles.itemCard}
                >
                  <View style={styles.itemImageWrapper}>
                    {item.photo_url ? (
                      <NetworkImage uri={item.photo_url} style={styles.itemImage} fallbackText={item.name[0]} />
                    ) : (
                      <View style={styles.itemPlaceholder}>
                        <ChefHat size={32} color="#FF6B35" />
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
                      <Text style={styles.itemPrice}>₹{item.price_paise / 100}</Text>
                    </View>
                    
                    <View style={styles.itemFooter}>
                      {cartItem ? (
                        <View style={styles.quantityControl}>
                          <TouchableOpacity onPress={() => dispatch(setQuantity({ menuItemId: item.id, quantity: cartItem.quantity - 1 }))}>
                            <Text style={styles.quantityBtnText}>−</Text>
                          </TouchableOpacity>
                          <Text style={styles.quantityValueText}>{cartItem.quantity}</Text>
                          <TouchableOpacity onPress={() => dispatch(setQuantity({ menuItemId: item.id, quantity: cartItem.quantity + 1 }))}>
                            <Text style={styles.quantityBtnText}>+</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity 
                          style={styles.addButton}
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
                          <Text style={styles.addButtonText}>Add</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingTop: 64,
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 16,
  },
  searchBar: {
    flex: 1,
    backgroundColor: '#f9fafb',
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  searchInput: {
    flex: 1,
    fontWeight: '700',
    color: '#1A1A2E',
    fontSize: 16,
  },
  clearIcon: {
    color: '#9ca3af',
    fontWeight: '900',
    marginLeft: 8,
    fontSize: 16,
  },
  filterRow: {
    flexDirection: 'row',
    marginTop: 16,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  filterChipActive: {
    borderColor: '#22C55E',
    backgroundColor: '#F0FDF4',
  },
  filterChipText: {
    color: '#6b7280',
    fontWeight: '700',
    fontSize: 12,
  },
  filterChipTextActive: {
    color: '#166534',
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
    backgroundColor: 'rgba(255, 107, 53, 0.05)',
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    color: '#1A1A2E',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptySub: {
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 20,
  },
  resultsContainer: {
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  itemCard: {
    flexDirection: 'row',
    marginBottom: 24,
    backgroundColor: '#fff',
    borderRadius: 24,
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
    width: 80,
    height: 80,
    backgroundColor: '#f9fafb',
    borderRadius: 16,
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
    marginLeft: 16,
    justifyContent: 'space-between',
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vegIndicator: {
    width: 12,
    height: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  vegDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  itemName: {
    color: '#1A1A2E',
    fontSize: 18,
    fontWeight: '900',
    flex: 1,
    letterSpacing: -0.5,
  },
  itemPrice: {
    color: '#FF6B35',
    fontWeight: '900',
    fontSize: 14,
    marginTop: 4,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  quantityBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    paddingHorizontal: 8,
  },
  quantityValueText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 14,
    marginHorizontal: 4,
  },
  quantityText: {
    fontWeight: '900',
    color: '#1A1A2E',
    fontSize: 14,
    marginHorizontal: 12,
  },
  sectionLabel: {
    color: '#1A1A2E',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 12,
  },
  recentSearchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 12,
    marginBottom: 12,
  },
  recentSearchText: {
    color: '#4B5563',
    fontWeight: '700',
    fontSize: 14,
  },
  addButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#FF6B35',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
  },
  addButtonText: {
    color: '#FF6B35',
    fontWeight: '900',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

export default SearchScreen;
