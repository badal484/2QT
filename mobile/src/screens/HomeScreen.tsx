import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, StyleSheet, TextInput, Switch, FlatList, SectionList, Dimensions, ActivityIndicator, Image, RefreshControl } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RootState } from '../store';
import { api } from '../api/client';
import { getSocket } from '../socket/client';
import { addItem, setQuantity, setZone, setAddress } from '../store/slices/cartSlice';
import { MapPin, Search, PackageOpen, ChefHat, ChevronDown, ShoppingBag, User, Bike, ArrowRight } from 'lucide-react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, interpolate, Extrapolate, useAnimatedScrollHandler, withRepeat, withTiming } from 'react-native-reanimated';
import { NetworkImage } from '../components/NetworkImage';
import { EmptyState, SkeletonRow } from '../components/ui';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import { radius, spacing } from '../theme/spacing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { registerDeviceToken, subscribeToTokenRefresh } from '../services/push';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

const HomeScreen = ({ navigation }: any) => {
  const { user } = useSelector((state: RootState) => state.auth);
  const { items: cartItems, zoneId, addressId } = useSelector((state: RootState) => state.cart);
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const socket = getSocket();
  const { globalLocation: location, serviceabilityStatus, activeZoneId } = useSelector((state: RootState) => state.app);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const sectionListRef = React.useRef<SectionList>(null);
  const [isVegOnly, setIsVegOnly] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // If address has a zone use it; if address exists but has no zone, fall back to GPS zone
  const effectiveZoneId = zoneId || activeZoneId;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['menu', effectiveZoneId] }),
      queryClient.invalidateQueries({ queryKey: ['banners'] }),
      queryClient.invalidateQueries({ queryKey: ['zones'] }),
      queryClient.invalidateQueries({ queryKey: ['addresses'] })
    ]);
    setRefreshing(false);
  }, [queryClient, effectiveZoneId]);

  // Serviceability derived flags — trigger even with an address if effectiveZoneId is still null
  // Also treat 'serviceable' with no zone as checking — happens when persist is stale/corrupt
  const isServiceabilityChecking =
    !effectiveZoneId && (serviceabilityStatus === 'idle' || serviceabilityStatus === 'checking' || serviceabilityStatus === 'serviceable');
  const unserviceableLocation = !effectiveZoneId && serviceabilityStatus === 'unserviceable';
  const showNoLocation = !effectiveZoneId && serviceabilityStatus === 'no_location';
  const showNetworkError = !effectiveZoneId && serviceabilityStatus === 'network_error';
  const insets = useSafeAreaInsets();
  const [requestStep, setRequestStep] = useState<'info' | 'form' | 'done'>('info');
  const [reqForm, setReqForm] = useState({ area_name: '', pincode: '' });
  const [reqLoading, setReqLoading] = useState(false);
  const [reqError, setReqError] = useState('');

  const pulseAnim = useSharedValue(0.2);
  useEffect(() => {
    pulseAnim.value = withRepeat(withTiming(1, { duration: 1000 }), -1, true);
  }, []);

  useEffect(() => {
    registerDeviceToken();
    const unsub = subscribeToTokenRefresh();
    return unsub;
  }, []);
  const liveDotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
    opacity: 1 - pulseAnim.value,
  }));

  useEffect(() => {
    if (socket && effectiveZoneId) {
      socket.on('menu_updated', (data) => {
        if (data.zoneId === effectiveZoneId) {
          queryClient.invalidateQueries({ queryKey: ['menu', effectiveZoneId] });
        }
      });
      socket.on('order_status_update', () => {
        queryClient.invalidateQueries({ queryKey: ['activeOrders'] });
      });
    }
    return () => {
      if (socket) {
        socket.off('menu_updated');
        socket.off('order_status_update');
      }
    };
  }, [socket, effectiveZoneId]);

  const { data: menuData, isLoading } = useQuery({
    queryKey: ['menu', effectiveZoneId],
    queryFn: () => api.get(`/menu?zoneId=${effectiveZoneId}`),
    enabled: !!effectiveZoneId,
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: activeOrdersData } = useQuery({
    queryKey: ['activeOrders'],
    queryFn: () => api.get('/orders/active'),
    refetchInterval: 15000,
  });
  const activeOrders = activeOrdersData?.activeOrders?.filter((o: any) => !['cancelled_by_restaurant', 'refunded', 'pending_payment', 'payment_failed'].includes(o.status)) || [];
  const primaryActiveOrder = activeOrders[0];

  const { data: bannersData } = useQuery({
    queryKey: ['banners'],
    queryFn: () => api.get('/banners'),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
  const banners = bannersData?.banners || [];
  const mainBanners = banners.filter((b: any) => !b.banner_type || b.banner_type === 'MAIN');
  const miniBanners = banners.filter((b: any) => b.banner_type === 'MINI');
  const stripBanners = banners.filter((b: any) => b.banner_type === 'STRIP');

  // ── Admin-configured image categories (zone-specific) ──────────────────
  const { data: menuCategoriesData } = useQuery({
    queryKey: ['menu-categories', effectiveZoneId],
    queryFn: () => api.get(`/categories?zoneId=${effectiveZoneId}`),
    enabled: !!effectiveZoneId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
  const adminCategories: { id: string; name: string; slug: string; image_url: string }[] =
    menuCategoriesData?.categories ?? [];
  // Set of slugs that admin has configured — used to HIDE unregistered categories
  const adminCategorySlugSet = new Set(
    adminCategories.map((c) => c.slug.toLowerCase().trim())
  );

  const infiniteBanners = useMemo(() => {
    if (!mainBanners || mainBanners.length === 0) return [];
    if (mainBanners.length === 1) return mainBanners;
    const repeated = [];
    for (let i = 0; i < 500; i++) {
      for (let j = 0; j < mainBanners.length; j++) {
        repeated.push({ ...mainBanners[j], uniqueId: `${mainBanners[j].id}-${i}` });
      }
    }
    return repeated;
  }, [mainBanners]);

  const bannerListRef = useRef<FlatList>(null);
  const bannerIndexRef = useRef(banners.length > 1 ? banners.length * 250 : 0);
  const hasInitializedBanner = useRef(false);

  useEffect(() => {
    if (infiniteBanners.length <= 1) return;
    
    // Jump to the middle instantly on mount
    if (!hasInitializedBanner.current) {
      setTimeout(() => {
        try {
          bannerListRef.current?.scrollToIndex({ index: bannerIndexRef.current, animated: false });
          hasInitializedBanner.current = true;
        } catch (e) {}
      }, 100);
    }

    const interval = setInterval(() => {
      if (!bannerListRef.current || infiniteBanners.length === 0) return;
      
      // If we somehow go out of bounds, silently reset to the middle
      if (bannerIndexRef.current >= infiniteBanners.length - 1) {
        bannerIndexRef.current = Math.floor(infiniteBanners.length / 2);
        try { bannerListRef.current.scrollToIndex({ index: bannerIndexRef.current, animated: false }); } catch(e) {}
        return;
      }

      bannerIndexRef.current += 1;
      try {
        bannerListRef.current.scrollToIndex({
          index: bannerIndexRef.current,
          animated: true,
        });
      } catch (e) {
        // Suppress out of range errors
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [infiniteBanners.length]);

  const { data: zonesData } = useQuery({
    queryKey: ['zones'],
    queryFn: () => api.get('/menu/zones'),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
  const liveZones: any[] = zonesData?.zones || [];

  const { data: addresses, isSuccess: addressesLoaded } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => api.get('/customers/addresses'),
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const selectedAddress = addresses?.addresses?.find((a: any) => a.id === addressId);

  // GPS is the primary zone source on launch — do NOT auto-select saved addresses here.
  // We only care about ensuring the current addressId is still valid.
  useEffect(() => {
    if (addressesLoaded && addressId && addresses?.addresses) {
      const exists = addresses.addresses.some((a: any) => a.id === addressId);
      if (!exists) {
        dispatch(setAddress(null));
      }
    }
  }, [addressesLoaded, addressId, addresses?.addresses, dispatch]);
  // Users explicitly choose an address from AddressScreen if they want to override GPS.

  // When the boot check resolves to a zone and no saved address is selected,
  // mirror activeZoneId into cart so checkout always has a zone to send.
  useEffect(() => {
    if (!addressId && activeZoneId) {
      dispatch(setZone(activeZoneId));
    }
  }, [activeZoneId, addressId, dispatch]);

  const handleRequestService = async () => {
    if (!user) { navigation.navigate('ProfileTab'); return; }
    if (!/^\d{6}$/.test(reqForm.pincode)) { setReqError('Please enter a valid 6-digit pincode'); return; }
    setReqLoading(true); setReqError('');
    try {
      await api.post('/service-requests', {
        area_name: reqForm.area_name,
        pincode: reqForm.pincode,
        lat: location?.latitude || 0,
        lng: location?.longitude || 0,
      });
      setRequestStep('done');
    } catch (err: any) {
      setReqError(err.message || 'Something went wrong.');
    } finally {
      setReqLoading(false);
    }
  };

  const triggerHaptic = useCallback(
    () => ReactNativeHapticFeedback.trigger('impactLight', hapticOptions),
    [],
  );

  const handleAddToCart = useCallback((item: any) => {
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
              dispatch(
                addItem({
                  menuItemId: item.id,
                  name: item.name,
                  pricePaise: item.price_paise,
                  quantity: 1,
                  photoUrl: item.photo_url,
                  isVeg: item.is_veg,
                  kitchenId: item.kitchen_id,
                }),
              );
            },
          },
        ],
      );
    } else {
      triggerHaptic();
      dispatch(
        addItem({
          menuItemId: item.id,
          name: item.name,
          pricePaise: item.price_paise,
          quantity: 1,
          photoUrl: item.photo_url,
          isVeg: item.is_veg,
          kitchenId: item.kitchen_id,
        }),
      );
    }
  }, [cartItems, dispatch, triggerHaptic]);


  const sections = useMemo(() => {
    if (!menuData?.items) return [];
    let items = menuData.items;
    
    if (isVegOnly) items = items.filter((item: any) => item.is_veg);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter((item: any) => item.name.toLowerCase().includes(q));
    }

    const grouped: Record<string, any[]> = {};
    items.forEach((item: any) => {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    });

    const hasAdminCategories = adminCategories.length > 0;

    if (selectedCategory !== 'All') {
      // Case-insensitive match so slug "Rice & Biryani" matches item.category "rice & biryani"
      const matchKey = Object.keys(grouped).find(
        k => k.toLowerCase().trim() === selectedCategory.toLowerCase().trim()
      );
      return matchKey ? [{ title: matchKey, data: grouped[matchKey] }] : [];
    }

    // "All" view — always show every item. Admin slugs only control sort order.
    return Object.keys(grouped)
      .sort((a, b) => {
        if (hasAdminCategories) {
          const aIdx = adminCategories.findIndex(c => c.slug.toLowerCase() === a.toLowerCase());
          const bIdx = adminCategories.findIndex(c => c.slug.toLowerCase() === b.toLowerCase());
          // Configured categories come first (sorted by sort_order); unconfigured go to end
          return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
        }
        return a.localeCompare(b);
      })
      .map(key => ({ title: key, data: grouped[key] }));
  }, [menuData?.items, selectedCategory, isVegOnly, searchQuery, adminCategories]);

  const cartTotal = useMemo(
    () => cartItems.reduce((acc, item) => acc + item.quantity * item.pricePaise, 0),
    [cartItems],
  );

  const renderItem = useCallback(({ item }: { item: any }) => {
    const cartItem = cartItems.find((ci: any) => ci.menuItemId === item.id);
    return (
      <View style={styles.itemPadding}>
        <ModernItemCard
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
      </View>
    );
  }, [cartItems, menuData?.kitchenPaused, handleAddToCart, triggerHaptic, dispatch, navigation]);

  const totalCartQty = cartItems.reduce((acc, i) => acc + i.quantity, 0);

  return (
    <View style={styles.container}>
      <View style={[
        styles.minimalHeader, 
        { 
          paddingTop: Math.max(insets.top + 10, 20), 
          paddingBottom: 16,
          backgroundColor: '#24B059', // Swish Vibrant Green
          borderBottomWidth: 0, 
        }
      ]}>
        {/* ROW 1: Address and Profile */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <View style={{ flex: 1, paddingRight: 16, flexDirection: 'row', alignItems: 'center' }}>
            <MapPin size={28} color="#FFFFFF" fill="#FFFFFF" style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center' }}
                onPress={() => { triggerHaptic(); navigation.navigate('Address'); }}
              >
                <Text style={{ fontSize: 18, fontFamily: fontFamily.extrabold, color: '#FFFFFF' }}>
                  {user?.name ? `Hey ${user.name.split(' ')[0]} 👋` : 'Home'}
                </Text>
                <ChevronDown size={16} color="#FFFFFF" style={{ marginLeft: 4 }} />
              </TouchableOpacity>
              <Text style={{ fontSize: 13, fontFamily: fontFamily.medium, color: 'rgba(255,255,255,0.9)', marginTop: 2 }} numberOfLines={1}>
                {location?.addressText || selectedAddress?.address_text || 'Set location'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => { triggerHaptic(); navigation.navigate('ProfileTab'); }}
          >
            {user?.photo_url ? (
              <NetworkImage uri={user.photo_url} style={[styles.profileImage, { borderWidth: 2, borderColor: '#FFFFFF' }]} fallbackText={user?.name?.[0]?.toUpperCase() || '?'} />
            ) : (
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' }}>
                <User size={20} color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* ROW 2: Search Bar with VEG toggle */}
        {!unserviceableLocation && !showNoLocation && !showNetworkError && (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderRadius: 16,
            paddingHorizontal: 16,
            height: 52,
            shadowColor: colors.ink,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 8,
            elevation: 2,
            borderWidth: 1,
            borderColor: colors.border
          }}>
            <Search size={22} color={colors.inkMuted} style={{ marginRight: 12 }} />
            <TextInput
              placeholder='Search "Biryani" or "Pizza"...'
              placeholderTextColor={colors.inkMuted}
              style={{ flex: 1, fontSize: 15, fontFamily: fontFamily.medium, color: colors.ink, padding: 0 }}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 ? (
              <TouchableOpacity onPress={() => { triggerHaptic(); setSearchQuery(''); }}>
                <Text style={{ fontSize: 14, fontFamily: fontFamily.bold, color: colors.inkMuted }}>Clear</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', borderLeftWidth: 1, borderLeftColor: colors.border, paddingLeft: 12, marginLeft: 8 }}>
                <Text style={[styles.vegText, isVegOnly && styles.vegTextActive]}>VEG</Text>
                <Switch
                  value={isVegOnly}
                  onValueChange={(val) => { triggerHaptic(); setIsVegOnly(val); }}
                  trackColor={{ false: colors.border, true: colors.primaryTint }}
                  thumbColor={isVegOnly ? colors.primary : colors.white}
                  style={styles.vegSwitch}
                />
              </View>
            )}
          </View>
        )}
      </View>

      <SectionList
        style={{ flex: 1 }}
        ref={sectionListRef}
        sections={
          isServiceabilityChecking || unserviceableLocation || showNoLocation || showNetworkError
            ? []
            : sections
        }
        keyExtractor={(item: any) => item.id}
        renderItem={renderItem}
        renderSectionHeader={({ section: { title } }: any) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{title}</Text>
          </View>
        )}
        stickySectionHeadersEnabled={true}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        windowSize={5}
        maxToRenderPerBatch={5}
        initialNumToRender={6}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor={colors.primary} 
            colors={[colors.primary]} 
          />
        }
        ListHeaderComponent={
          <View>
            
            {/* ── Category Strip ── */}
            {!isLoading && !unserviceableLocation && !showNoLocation && !showNetworkError && !isServiceabilityChecking && adminCategories.length > 0 && (
              <View style={styles.categoryStrip}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryStripScroll}>
                  {/* Admin categories */}
                  {adminCategories.map((cat) => {
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={styles.categoryStripItem}
                        onPress={() => { triggerHaptic(); navigation.navigate('Category', { categorySlug: cat.slug, categoryName: cat.name, categoryImage: cat.image_url }); }}
                        activeOpacity={0.8}
                      >
                        <View style={styles.categoryStripCircle}>
                          {cat.image_url ? (
                            <NetworkImage uri={cat.image_url} style={styles.categoryStripImage} />
                          ) : (
                            <Text style={{ fontSize: 18 }}>🍴</Text>
                          )}
                        </View>
                        <Text style={styles.categoryStripLabel} numberOfLines={1}>
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* ── Mini Banners (Quick Filters) ── */}
            {!isLoading && !unserviceableLocation && !showNoLocation && !showNetworkError && miniBanners.length > 0 && (
              <View style={styles.miniBannersContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.miniBannersScroll}>
                  {miniBanners.map((banner: any) => (
                    <TouchableOpacity
                      key={banner.id}
                      activeOpacity={0.8}
                      onPress={() => {
                        triggerHaptic();
                        if (banner.action_type === 'FILTER_CATEGORY') setSelectedCategory(banner.action_payload);
                      }}
                      style={styles.miniBannerCard}
                    >
                      <NetworkImage uri={banner.image_url} style={styles.miniBannerImage} />
                      <View style={styles.miniBannerOverlay}>
                        <Text style={styles.miniBannerTitle}>{banner.title}</Text>
                        {banner.subtitle && <Text style={styles.miniBannerSubtitle} numberOfLines={1}>{banner.subtitle}</Text>}
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {menuData?.kitchenPaused && (
              <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.kitchenPausedBanner}>
                <ChefHat size={20} color={colors.danger} style={styles.pausedIcon} />
                <View style={styles.pausedTextCol}>
                  <Text style={styles.pausedTitle}>Kitchen is currently paused</Text>
                  <Text style={styles.pausedReason}>{menuData.pauseReason || 'Taking a short break to catch up on orders.'}</Text>
                </View>
              </Animated.View>
            )}
            {infiniteBanners.length > 0 && !unserviceableLocation && !showNoLocation && !showNetworkError && !isServiceabilityChecking && (
              <Animated.View entering={FadeInDown.delay(150).duration(400)} style={{ overflow: 'hidden', marginTop: spacing.xl }}>
                <FlatList
                  ref={bannerListRef}
                  data={infiniteBanners}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(b: any) => b.uniqueId || b.id}
                  snapToInterval={SCREEN_WIDTH}
                  decelerationRate="fast"
                  contentContainerStyle={{ paddingHorizontal: 0 }}
                  onMomentumScrollEnd={(ev) => {
                    const newIndex = Math.round(ev.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                    bannerIndexRef.current = newIndex;
                  }}
                  getItemLayout={(_, index) => ({
                    length: SCREEN_WIDTH,
                    offset: SCREEN_WIDTH * index,
                    index,
                  })}
                  renderItem={({ item: b }: any) => (
                    <View style={{ width: SCREEN_WIDTH, paddingHorizontal: spacing.lg }}>
                      <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => {
                          triggerHaptic();
                          if (b.action_type === 'FILTER_CATEGORY') setSelectedCategory(b.action_payload);
                        }}
                        style={[styles.bannerContainer, { height: 180 }]}
                      >
                        <NetworkImage uri={b.image_url} style={[styles.bannerImage, { borderRadius: 16 }]} />
                        {/* Removed dark overlay and text to allow pure image banners (Swish-style) */}
                      </TouchableOpacity>
                    </View>
                  )}
                />
              </Animated.View>
            )}

            {/* ── Strip Banners ── */}
            {!isLoading && !unserviceableLocation && !showNoLocation && !showNetworkError && stripBanners.length > 0 && (
              <View style={styles.stripBannersContainer}>
                {stripBanners.map((banner: any) => (
                  <TouchableOpacity
                    key={banner.id}
                    activeOpacity={0.9}
                    onPress={() => {
                      triggerHaptic();
                      if (banner.action_type === 'FILTER_CATEGORY') setSelectedCategory(banner.action_payload);
                    }}
                    style={styles.stripBannerCard}
                  >
                    <NetworkImage uri={banner.image_url} style={styles.stripBannerImage} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {!unserviceableLocation && !showNoLocation && !showNetworkError && <View style={styles.headerSpacer} />}
          </View>
        }
        ListEmptyComponent={
          isServiceabilityChecking || (isLoading && !!effectiveZoneId) ? (
            <View style={[styles.skeletonList, styles.itemPadding]}>
              <SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow />
            </View>
          ) : showNoLocation ? (
            /* ── No GPS permission ── */
            <Animated.View entering={FadeInDown.duration(400)} style={styles.unserviceableWrap}>
              <View style={styles.foodCarousel}>
                <View style={[styles.foodCardDeco, styles.foodCardLeft]}>
                  <Image source={{ uri: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=300&q=80' }} style={styles.foodCardImage} />
                </View>
                <View style={[styles.foodCardDeco, styles.foodCardCenter]}>
                  <Image source={{ uri: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=300&q=80' }} style={styles.foodCardImage} />
                </View>
                <View style={[styles.foodCardDeco, styles.foodCardRight]}>
                  <Image source={{ uri: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300&q=80' }} style={styles.foodCardImage} />
                </View>
              </View>
              <Text style={styles.comingSoonHeading}>Enable Location</Text>
              <Text style={styles.comingSoonSub}>
                Allow location access so we can detect your zone instantly, or pick an address manually.
              </Text>
              <TouchableOpacity style={styles.ctaPrimary} onPress={() => { triggerHaptic(); navigation.navigate('Address'); }}>
                <Text style={styles.ctaPrimaryText}>Select Delivery Address</Text>
              </TouchableOpacity>
            </Animated.View>
          ) : showNetworkError ? (
            /* ── Network error ── */
            <Animated.View entering={FadeInDown.duration(400)} style={styles.unserviceableWrap}>
              <View style={styles.foodCarousel}>
                <View style={[styles.foodCardDeco, styles.foodCardLeft]}><ChefHat size={32} color={colors.inkFaint} /></View>
                <View style={[styles.foodCardDeco, styles.foodCardCenter]}><ChefHat size={44} color={colors.inkMuted} /></View>
                <View style={[styles.foodCardDeco, styles.foodCardRight]}><ChefHat size={32} color={colors.inkFaint} /></View>
              </View>
              <Text style={styles.comingSoonHeading}>Connection Issue</Text>
              <Text style={styles.comingSoonSub}>
                Couldn't verify your delivery area. Check your connection, then retry or change address.
              </Text>
              <TouchableOpacity style={styles.ctaPrimary} onPress={() => { triggerHaptic(); navigation.navigate('Address'); }}>
                <Text style={styles.ctaPrimaryText}>Retry / Change Address</Text>
              </TouchableOpacity>
            </Animated.View>
          ) : unserviceableLocation ? (
            /* ── Out of zone — full screen like reference ── */
            <Animated.View entering={FadeInDown.duration(400)} style={styles.unserviceableWrap}>
              {requestStep === 'done' ? (
                <View style={styles.reqDoneCard}>
                  <Text style={styles.reqDoneTitle}>You're on the list!</Text>
                  <Text style={styles.reqDoneSub}>We'll notify you the day we launch in {reqForm.area_name || 'your area'}!</Text>
                  <TouchableOpacity style={styles.ctaOutline} onPress={() => setRequestStep('info')}>
                    <Text style={styles.ctaOutlineText}>Back</Text>
                  </TouchableOpacity>
                </View>
              ) : requestStep === 'form' ? (
                <View style={styles.reqFormCard}>
                  {/* Hero image */}
                  <Image
                    source={{ uri: 'https://images.unsplash.com/photo-1596797038530-2c107aa08dcc?w=700&q=80' }}
                    style={styles.reqFormHero}
                    resizeMode="cover"
                  />
                  <View style={styles.reqFormBody}>
                    {/* Header */}
                    <View style={styles.reqFormHeaderRow}>
                      <View style={styles.reqFormIconBadge}>
                        <MapPin size={16} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.reqFormTitle}>Bring 2QT to your area</Text>
                        <Text style={styles.reqFormSub}>Tell us where you are — we'll expand there next.</Text>
                      </View>
                    </View>

                    {/* Area input */}
                    <View style={styles.reqInputRow}>
                      <MapPin size={15} color={colors.inkFaint} />
                      <TextInput
                        style={styles.reqInputField}
                        placeholder="Your area or locality"
                        value={reqForm.area_name}
                        onChangeText={(t) => setReqForm(p => ({ ...p, area_name: t }))}
                        placeholderTextColor={colors.inkFaint}
                      />
                    </View>

                    {/* Pincode input */}
                    <View style={styles.reqInputRow}>
                      <Text style={styles.reqPinHash}>#</Text>
                      <TextInput
                        style={styles.reqInputField}
                        placeholder="6-digit pincode"
                        keyboardType="numeric"
                        maxLength={6}
                        value={reqForm.pincode}
                        onChangeText={(t) => setReqForm(p => ({ ...p, pincode: t.replace(/\D/g, '') }))}
                        placeholderTextColor={colors.inkFaint}
                      />
                    </View>

                    {!!reqError && <Text style={styles.reqErrorText}>{reqError}</Text>}

                    <TouchableOpacity style={styles.reqSubmitBtn} onPress={handleRequestService} disabled={reqLoading}>
                      {reqLoading
                        ? <ActivityIndicator color={colors.white} />
                        : <Text style={styles.reqSubmitBtnText}>Submit Request</Text>}
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.reqCancelLink} onPress={() => { triggerHaptic(); setRequestStep('info'); }}>
                      <Text style={styles.reqCancelLinkText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                /* ── Coming Soon info screen ── */
                <>
                  {/* Fanned food cards */}
                  <View style={styles.foodCarousel}>
                    <View style={[styles.foodCardDeco, styles.foodCardLeft]}>
                      <Image source={{ uri: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=300&q=80' }} style={styles.foodCardImage} />
                    </View>
                    <View style={[styles.foodCardDeco, styles.foodCardCenter]}>
                      <Image source={{ uri: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=300&q=80' }} style={styles.foodCardImage} />
                    </View>
                    <View style={[styles.foodCardDeco, styles.foodCardRight]}>
                      <Image source={{ uri: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300&q=80' }} style={styles.foodCardImage} />
                    </View>
                  </View>

                  {/* Heading */}
                  <Text style={styles.comingSoonHeading}>COMING SOON TO{"\n"}YOUR DOORSTEP</Text>
                  <Text style={styles.comingSoonSub}>
                    {location?.addressText
                      ? `We're not serving ${location.addressText} yet — but we're growing fast!`
                      : "We're not in your area yet, but we're expanding fast!"}
                  </Text>

                  {/* We're Live in */}
                  {liveZones.length > 0 && (
                    <View style={styles.liveInSection}>
                      <Text style={styles.liveInTitle}>We're Live in</Text>
                      <View style={styles.liveZonesRow}>
                        {liveZones.map((z: any, i: number) => (
                          <React.Fragment key={z.id}>
                            <Text style={styles.liveZoneName}>{z.name}</Text>
                            {i < liveZones.length - 1 && <Text style={styles.liveZoneDot}> • </Text>}
                          </React.Fragment>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* CTAs */}
                  <TouchableOpacity style={styles.ctaPrimary} onPress={() => { triggerHaptic(); navigation.navigate('Address'); }} activeOpacity={0.9}>
                    <Text style={styles.ctaPrimaryText}>Change Address</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.ctaOutline} onPress={() => { triggerHaptic(); setRequestStep('form'); }} activeOpacity={0.8}>
                    <Text style={styles.ctaOutlineText}>Request Service in My Area</Text>
                  </TouchableOpacity>
                </>
              )}
            </Animated.View>
          ) : !effectiveZoneId ? (
            /* Zone still resolving — show skeleton instead of "Nothing found" */
            <View style={[styles.skeletonList, styles.itemPadding]}>
              <SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow />
            </View>
          ) : (
            <EmptyState
              icon={<PackageOpen size={32} color={colors.primary} />}
              title="Nothing found"
              subtitle="Try changing your search or filters."
            />
          )
        }
      />

      {cartItems.length > 0 && sections.length > 0 && (
        <Animated.View
          entering={FadeInDown.duration(300)}
          exiting={FadeInDown.duration(200).delay(0)}
          style={[
            styles.floatingCartContainer,
            { bottom: Math.max(insets.bottom, 16) + 8 },
          ]}
        >
          <TouchableOpacity
            style={styles.floatingCartButton}
            activeOpacity={0.9}
            onPress={() => {
              triggerHaptic();
              navigation.navigate('Cart');
            }}
          >
            <View style={styles.cartLeftRow}>
              <Text style={styles.cartItemCount}>{totalCartQty} {totalCartQty === 1 ? 'ITEM' : 'ITEMS'}</Text>
              <Text style={styles.cartTotalText}>  ₹{cartTotal / 100}</Text>
            </View>
            <View style={styles.viewCartAction}>
              <Text style={styles.viewCartText}>View Cart</Text>
              <ShoppingBag size={16} color={colors.white} style={{ marginLeft: 6 }} />
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}

      {primaryActiveOrder && (
        <Animated.View entering={FadeInDown.duration(400).springify().damping(15)} style={[
          styles.activeOrderPillContainer,
          { bottom: totalCartQty > 0 ? Math.max(insets.bottom, 16) + 84 : Math.max(insets.bottom, 16) + 16 }
        ]}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              triggerHaptic();
              navigation.navigate('OrderConfirmed', { orderId: primaryActiveOrder.id });
            }}
            style={styles.activeOrderPill}
          >
            <View style={styles.activeOrderIconContainer}>
              <View style={styles.activeOrderDotBase}>
                <Animated.View style={[styles.activeOrderDotPulse, liveDotStyle]} />
              </View>
              {primaryActiveOrder.status === 'out_for_delivery' ? (
                <Bike size={16} color="#34D399" style={{ marginLeft: 6 }} />
              ) : (
                <ChefHat size={16} color="#FBBF24" style={{ marginLeft: 6 }} />
              )}
            </View>
            <View style={styles.activeOrderTextContainer}>
              <Text style={styles.activeOrderTitle}>
                {primaryActiveOrder.status === 'placed' ? 'Order Placed' :
                 primaryActiveOrder.status === 'accepted' ? 'Preparing food' :
                 primaryActiveOrder.status === 'preparing' ? 'Preparing food' :
                 primaryActiveOrder.status === 'ready' ? 'Ready for pickup' :
                 primaryActiveOrder.status === 'out_for_delivery' ? 'Arriving soon' : 'Active Order'}
              </Text>
              <Text style={styles.activeOrderSubtitle}>View live tracking</Text>
            </View>
            <View style={styles.activeOrderArrow}>
              <ArrowRight size={16} color="#9CA3AF" />
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
};


const ModernItemCard = React.memo(({ item, cartItem, onAdd, onUpdate, onPress, kitchenPaused }: any) => {
  const vegColor = item.is_veg ? '#22C55E' : colors.danger;
  const unavailable = !item.available || kitchenPaused;

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.93} onPress={onPress}>
      {/* ── Left: text content ─────────────────────────────── */}
      <View style={styles.cardLeft}>
        <View style={[styles.vegBadge, { borderColor: vegColor }]}>
          <View style={[styles.vegDot, { backgroundColor: vegColor }]} />
        </View>

        <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.cardPrice}>₹{item.price_paise / 100}</Text>
        {item.description ? (
          <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
        ) : null}
      </View>

      {/* ── Right: Image and Floating Button ── */}
      <View style={styles.cardRightWrapper}>
        <View style={styles.cardRightRelative}>
          {/* Image */}
          <View style={styles.cardImageContainer}>
            {item.photo_url ? (
              <NetworkImage uri={item.photo_url} style={styles.cardImage} />
            ) : (
              <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
                <ChefHat size={32} color={colors.inkFaint} />
              </View>
            )}

            {unavailable && (
              <View style={styles.soldOutOverlay}>
                <Text style={styles.soldOutText}>Sold Out</Text>
              </View>
            )}
          </View>

          {/* ADD / qty — pinned to the bottom of the 130x130 box! */}
          {!unavailable && (
            <View style={styles.cardBtnFloat}>
              {cartItem ? (
                <View style={styles.qtyControl}>
                  <TouchableOpacity
                    onPress={() => onUpdate(cartItem.quantity - 1)}
                    style={styles.qtyBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
                  >
                    <Text style={styles.qtyBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyValue}>{cartItem.quantity}</Text>
                  <TouchableOpacity
                    onPress={() => onUpdate(cartItem.quantity + 1)}
                    style={styles.qtyBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                  >
                    <Text style={styles.qtyBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.addBtn} onPress={onAdd} activeOpacity={0.85}>
                  <Text style={styles.addBtnText}>ADD</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  minimalHeader: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  // Logo
  logoText: { fontSize: 28, fontFamily: fontFamily.black, color: colors.ink, letterSpacing: -0.5 },
  logoDot: { color: colors.accent },
  deliveryTagRow: { flexDirection: 'row', alignItems: 'center', marginTop: 1 },
  deliveryTagIcon: { fontSize: 11, marginRight: 3 },
  deliveryTagText: { fontSize: 10, fontFamily: fontFamily.extrabold, color: colors.accent, letterSpacing: 1.2, textTransform: 'uppercase' },

  // Header right cluster
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  addressPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.surfaceMuted, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: colors.border, maxWidth: 140,
  },
  addressPillText: { fontSize: 11, fontFamily: fontFamily.bold, color: colors.inkMuted, flex: 1 },
  cartBadgeBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.ink,
    alignItems: 'center', justifyContent: 'center',
  },
  cartBadgeNum: { color: colors.white, fontSize: 14, fontFamily: fontFamily.extrabold },

  // Kept for compatibility (used in unserviceable state)
  locationTitleUnserviceable: { color: colors.danger },
  addressSection: { flex: 1, marginRight: spacing.lg },
  addressRow: { justifyContent: 'center' },
  addressLabelRow: { flexDirection: 'row', alignItems: 'center' },
  chevron: { marginLeft: spacing.xs },
  locationTitle: { color: colors.ink, fontSize: 13, fontFamily: fontFamily.extrabold, letterSpacing: 0.3 },
  addressValue: { color: colors.inkMuted, fontSize: 13, fontFamily: fontFamily.semibold, marginTop: 2 },
  profileButton: {
    width: 44, height: 44, backgroundColor: colors.primaryTint, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    borderWidth: 1, borderColor: colors.primaryTint,
  },
  profileImage: { width: '100%', height: '100%' },

  // ── Card layout ──────────────────────────────────────────────────────────
  card: {
    flexDirection: 'row',
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  cardLeft: { flex: 1, paddingRight: 20, justifyContent: 'flex-start' }, // Top-align text
  vegBadge: {
    width: 14, height: 14, borderWidth: 1.5, borderRadius: 4,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  vegDot: { width: 6, height: 6, borderRadius: 3 },
  cardName: { fontSize: 17, fontFamily: fontFamily.bold, color: colors.ink, marginBottom: 6, lineHeight: 22 },
  cardPrice: { fontSize: 16, fontFamily: fontFamily.semibold, color: colors.ink, marginBottom: 8 },
  cardDesc: { fontSize: 14, color: '#8E8E93', fontFamily: fontFamily.medium, lineHeight: 18 },

  // Right column
  cardRightWrapper: { width: 140, alignItems: 'center' }, // Outer wrapper just holds width
  cardRightRelative: { width: 130, height: 130, position: 'relative' }, // Inner wrapper handles absolute positioning perfectly
  cardImageContainer: {
    width: 130, height: 130,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
  },
  cardImage: { width: '100%', height: '100%' },
  cardImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },

  // ADD / qty floats over image bottom
  cardBtnFloat: {
    position: 'absolute', bottom: -12, alignSelf: 'center', width: 110, zIndex: 10,
  },
  qtyControl: {
    flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 8,
    alignItems: 'center', justifyContent: 'space-between', height: 38,
    borderWidth: 1, borderColor: '#E5E7EB', // Clean border, NO shadow
    elevation: 0, shadowOpacity: 0
  },
  qtyBtn: { width: 34, height: 38, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { color: colors.primary, fontSize: 22, fontFamily: fontFamily.bold },
  qtyValue: { color: colors.ink, fontSize: 15, fontFamily: fontFamily.extrabold },
  addBtn: {
    backgroundColor: '#FFFFFF', borderRadius: 8,
    height: 38, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#E5E7EB', // Clean border, NO shadow
    elevation: 0, shadowOpacity: 0
  },
  addBtnDisabled: { backgroundColor: colors.surfaceMuted },
  addBtnText: { color: colors.primary, fontFamily: fontFamily.extrabold, fontSize: 15, letterSpacing: 0.5 },

  liveKitchenBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryTint,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: colors.primaryTint,
  },
  liveDotWrapper: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  liveDot: { position: 'absolute', width: 16, height: 16, borderRadius: 8, backgroundColor: colors.primary },
  liveDotCore: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  liveKitchenTextCol: { marginLeft: spacing.md, flex: 1 },
  liveKitchenText: { color: colors.primary, fontSize: 10, fontFamily: fontFamily.extrabold, letterSpacing: 1 },
  liveKitchenTitle: { color: colors.ink, fontSize: 14, fontFamily: fontFamily.extrabold, marginTop: 2 },
  deliveryTimeBadge: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
    alignItems: 'center',
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  deliveryTimeText: { color: colors.primary, fontSize: 14, fontFamily: fontFamily.extrabold },
  deliveryTimeSub: { color: colors.inkMuted, fontSize: 8, fontFamily: fontFamily.bold, letterSpacing: 0.5 },

  searchBarContainer: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    height: 52,
    marginTop: spacing.xl,
  },
  searchIcon: { marginRight: spacing.md },
  searchInput: { flex: 1, fontSize: 15, fontFamily: fontFamily.semibold, color: colors.ink },
  vegToggleContainer: { borderLeftWidth: 1, borderLeftColor: colors.border, paddingLeft: spacing.md, marginLeft: spacing.sm },
  vegToggleWrapper: { flexDirection: 'row', alignItems: 'center' },
  vegText: { fontSize: 10, fontFamily: fontFamily.extrabold, color: colors.inkFaint, marginRight: spacing.xs, letterSpacing: 0.5 },
  vegTextActive: { color: colors.primary },
  vegSwitch: { transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] },

  listContent: { paddingBottom: 200, flexGrow: 1 },
  itemPadding: { paddingHorizontal: spacing.lg },
  headerSpacer: { height: spacing.xl },

  kitchenPausedBanner: {
    backgroundColor: colors.dangerTint,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.dangerTint,
  },
  pausedIcon: { marginRight: spacing.md },
  pausedTextCol: { flex: 1 },
  pausedTitle: { color: colors.danger, fontSize: 15, fontFamily: fontFamily.extrabold },
  pausedReason: { color: colors.danger, fontSize: 12, fontFamily: fontFamily.medium, marginTop: 2 },

  mindContainer: { marginTop: spacing.xl },
  mindScroll: { paddingHorizontal: spacing.lg, gap: spacing.md },
  categoryPill: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  categoryPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryPillText: { fontSize: 14, fontFamily: fontFamily.extrabold, color: colors.inkMuted },
  categoryPillTextActive: { color: colors.white },

  // ── Swish-style circular image categories ──────────────────────────────────
  imageCategoryItem: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: 72,
    marginRight: 4,
  },
  imageCategoryItemActive: {},
  imageCategoryCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 2.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  imageCategoryCircleActive: {
    borderColor: colors.primary,
    borderWidth: 2.5,
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  imageCategoryImage: {
    width: '100%',
    height: '100%',
    borderRadius: 36,
  },
  imageCategoryLabel: {
    fontSize: 11,
    fontFamily: fontFamily.semibold,
    color: colors.inkMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 14,
  },
  imageCategoryLabelActive: {
    color: colors.primary,
    fontFamily: fontFamily.extrabold,
  },

  // ── Mini Banners (Quick Filters) ──────────────────────────────────────────
  miniBannersContainer: { marginTop: spacing.md, marginBottom: spacing.sm },
  miniBannersScroll: { paddingHorizontal: spacing.lg, gap: spacing.md },
  miniBannerCard: {
    width: 130,
    height: 80,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
  },
  miniBannerImage: {
    width: '100%',
    height: '100%',
  },
  miniBannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    padding: spacing.sm + 2,
    justifyContent: 'flex-start',
  },
  miniBannerTitle: {
    fontSize: 12,
    fontFamily: fontFamily.extrabold,
    color: colors.ink,
  },
  miniBannerSubtitle: {
    fontSize: 10,
    fontFamily: fontFamily.bold,
    color: colors.inkMuted,
    marginTop: 2,
  },

  // ── Strip Banners (Wide & Short) ──────────────────────────────────────────
  stripBannersContainer: { marginTop: spacing.md, paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.lg },
  stripBannerCard: {
    width: '100%',
    height: 90,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
  },
  stripBannerImage: {
    width: '100%',
    height: '100%',
  },

  itemsContainer: { paddingHorizontal: spacing.lg, marginTop: spacing.xl, paddingBottom: spacing.xxxl },
  modernItemsList: { width: '100%' },

  modernCard: {
    width: '100%',
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 4,
  },
  modernCardInner: { flexDirection: 'row', alignItems: 'center' },

  modernImageCol: { width: 80, alignItems: 'center', marginRight: spacing.lg },
  modernImageWrapper: { width: 80, height: 80, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  modernImage: { width: '100%', height: '100%' },
  modernImagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  modernInfo: { flex: 1, paddingRight: spacing.sm },
  modernTagsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  vegIndicatorModern: { width: 12, height: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm, borderRadius: 3 },
  vegDotModern: { width: 5, height: 5, borderRadius: 3 },
  bestsellerTagModern: { backgroundColor: colors.warningTint, paddingHorizontal: spacing.xs + 2, paddingVertical: 2, borderRadius: 6 },
  bestsellerTagTextModern: { color: colors.warning, fontSize: 9, fontFamily: fontFamily.extrabold, textTransform: 'uppercase' },
  modernName: { fontSize: 15, fontFamily: fontFamily.bold, color: colors.ink, lineHeight: 20, marginBottom: spacing.xs },
  modernPrice: { fontSize: 14, fontFamily: fontFamily.extrabold, color: colors.ink, marginBottom: spacing.xs },
  modernDesc: { fontSize: 12, color: colors.inkMuted, fontFamily: fontFamily.medium, lineHeight: 16 },

  addBtnContainerRight: { marginLeft: 'auto' },
  floatingAddButtonModern: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.primaryTint,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primaryTint,
  },
  floatingAddButtonDisabled: { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
  floatingAddButtonTextModern: { color: colors.primary, fontFamily: fontFamily.extrabold, fontSize: 14, letterSpacing: 0.5 },

  floatingQuantityControlModern: {
    width: 80,
    height: 36,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.sm,
  },
  floatingQtyBtnModern: { paddingHorizontal: spacing.sm + 2, height: '100%', justifyContent: 'center' },
  floatingQtyTextModern: { color: colors.white, fontSize: 18, fontFamily: fontFamily.extrabold },
  floatingQtyValueModern: { color: colors.white, fontSize: 14, fontFamily: fontFamily.extrabold },

  soldOutOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' },
  soldOutText: { color: colors.ink, fontFamily: fontFamily.extrabold, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 },

  skeletonList: { width: '100%' },

  floatingCartContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 999,
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 20,
  },
  floatingCartButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cartLeftRow: { flexDirection: 'row', alignItems: 'center' },
  cartItemCount: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontFamily: fontFamily.extrabold, letterSpacing: 1, textTransform: 'uppercase' },
  cartTotalText: { color: colors.white, fontSize: 22, fontFamily: fontFamily.black, letterSpacing: -0.5 },
  viewCartAction: { flexDirection: 'row', alignItems: 'center' },
  viewCartText: { color: colors.white, fontFamily: fontFamily.extrabold, fontSize: 14, letterSpacing: 0.3 },

  bannersList: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingTop: spacing.xl },
  bannerContainer: {
    width: '100%',
    height: 180,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.ink,
  },
  bannerImage: { width: '100%', height: '100%', opacity: 0.75 },
  bannerOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    padding: spacing.lg,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)'
  },
  bannerTag: { backgroundColor: colors.primary, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginBottom: 8 },
  bannerTagText: { color: colors.white, fontSize: 10, fontFamily: fontFamily.extrabold, textTransform: 'uppercase' },
  bannerTitle: { color: colors.white, fontSize: 24, fontFamily: fontFamily.black, width: '80%' },
  bannerSubtitle: { color: colors.white, fontSize: 14, fontFamily: fontFamily.medium, marginTop: 4, opacity: 0.9 },

  requestServiceContainer: { width: '100%', paddingHorizontal: spacing.sm },
  reqInfoCard: { alignItems: 'center', paddingVertical: spacing.xxl },
  reqInfoIconBox: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  reqInfoTitle: { fontSize: 24, fontFamily: fontFamily.black, color: colors.ink, marginBottom: spacing.sm },
  reqInfoSub: { fontSize: 15, fontFamily: fontFamily.medium, color: colors.inkMuted, textAlign: 'center', paddingHorizontal: spacing.lg, marginBottom: spacing.xl },
  reqActionBtn: { backgroundColor: colors.primary, width: '100%', paddingVertical: 16, borderRadius: radius.lg, alignItems: 'center' },
  reqActionBtnText: { color: colors.white, fontSize: 16, fontFamily: fontFamily.extrabold },
  reqFormCard: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', width: '100%' },
  reqFormHero: { width: '100%', height: 180 },
  reqFormBody: { padding: spacing.xl },
  reqFormHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.md },
  reqFormIconBadge: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center', marginTop: 2, flexShrink: 0 },
  reqFormTitle: { fontSize: 18, fontFamily: fontFamily.black, color: colors.ink },
  reqFormSub: { fontSize: 13, fontFamily: fontFamily.medium, color: colors.inkMuted, lineHeight: 18, marginTop: 2 },
  reqFormLabel: { fontSize: 12, fontFamily: fontFamily.extrabold, color: colors.inkMuted, textTransform: 'uppercase', marginBottom: spacing.xs },
  reqInputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  reqInputField: { flex: 1, fontSize: 15, fontFamily: fontFamily.medium, color: colors.ink, paddingVertical: 13 },
  reqPinHash: { fontSize: 17, fontFamily: fontFamily.extrabold, color: colors.inkFaint },
  reqInput: { backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 14, fontSize: 15, fontFamily: fontFamily.semibold, color: colors.ink, marginBottom: spacing.lg },
  reqErrorText: { color: colors.danger, fontSize: 13, fontFamily: fontFamily.bold, marginBottom: spacing.md },
  reqSubmitBtn: { backgroundColor: colors.primary, paddingVertical: 16, borderRadius: radius.lg, alignItems: 'center', marginTop: spacing.sm },
  reqSubmitBtnText: { color: colors.white, fontSize: 16, fontFamily: fontFamily.extrabold },
  reqCancelLink: { marginTop: spacing.lg, alignItems: 'center', paddingVertical: spacing.sm },
  reqCancelLinkText: { color: colors.inkMuted, fontSize: 14, fontFamily: fontFamily.bold },
  reqBackLink: { marginTop: spacing.lg, alignItems: 'center' },
  reqBackLinkText: { color: colors.inkMuted, fontSize: 14, fontFamily: fontFamily.bold },
  reqDoneCard: { alignItems: 'center', paddingVertical: spacing.xl },
  reqDoneTitle: { fontSize: 24, fontFamily: fontFamily.black, color: colors.ink, marginBottom: spacing.sm },
  reqDoneSub: { fontSize: 15, fontFamily: fontFamily.medium, color: colors.inkMuted, textAlign: 'center', marginBottom: spacing.xl },
  reqBackBtn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  reqBackBtnText: { color: colors.ink, fontSize: 14, fontFamily: fontFamily.extrabold },

  // ── Unserviceable / Coming Soon screen ──────────────────────────────────
  unserviceableWrap: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxxl,
    alignItems: 'center',
  },

  // Three fanned food-card decorations
  foodCarousel: {
    width: '100%',
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxl,
  },
  foodCardDeco: {
    position: 'absolute',
    width: 140,
    height: 160,
    borderRadius: radius.xl,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  foodCardImage: { width: '100%', height: '100%' },
  foodCardLeft: {
    transform: [{ rotate: '-12deg' }, { translateX: -60 }],
    backgroundColor: colors.warningTint,
    zIndex: 1,
  },
  foodCardCenter: {
    backgroundColor: colors.primaryTint,
    zIndex: 3,
    width: 160,
    height: 180,
    shadowOpacity: 0.14,
    elevation: 8,
  },
  foodCardRight: {
    transform: [{ rotate: '12deg' }, { translateX: 60 }],
    backgroundColor: colors.accentTint,
    zIndex: 1,
  },

  // Heading text
  comingSoonHeading: {
    fontSize: 26,
    fontFamily: fontFamily.black,
    color: colors.ink,
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 32,
    marginBottom: spacing.lg,
    textTransform: 'uppercase',
  },
  comingSoonSub: {
    fontSize: 15,
    fontFamily: fontFamily.medium,
    color: colors.inkMuted,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xxl,
  },

  // "We're Live in" zone list
  liveInSection: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  liveInTitle: {
    fontSize: 11,
    fontFamily: fontFamily.extrabold,
    color: colors.inkFaint,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  liveZonesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveZoneName: {
    fontSize: 14,
    fontFamily: fontFamily.semibold,
    color: colors.ink,
  },
  liveZoneDot: {
    fontSize: 14,
    color: colors.inkFaint,
  },

  // CTAs
  ctaPrimary: {
    width: '100%',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  ctaPrimaryText: {
    color: colors.white,
    fontSize: 16,
    fontFamily: fontFamily.extrabold,
  },
  ctaOutline: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: radius.lg,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  ctaOutlineText: {
    color: colors.ink,
    fontSize: 15,
    fontFamily: fontFamily.bold,
  },

  sectionHeader: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: 28,
    paddingBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 18,
    fontFamily: fontFamily.black,
    color: colors.ink,
    letterSpacing: -0.3,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    zIndex: 1000,
  },
  menuFab: {
    backgroundColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: 12,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  menuFabText: {
    color: colors.white,
    fontFamily: fontFamily.bold,
    fontSize: 14,
    marginLeft: spacing.sm,
    letterSpacing: 1,
  },
  menuPopupOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 1001,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 160,
  },
  menuPopupContainer: {
    backgroundColor: colors.surface,
    width: 250,
    borderRadius: radius.xl,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
  },
  menuPopupItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuPopupText: {
    fontSize: 15,
    fontFamily: fontFamily.medium,
    color: colors.ink,
  },
  menuPopupCount: {
    fontSize: 13,
    fontFamily: fontFamily.medium,
    color: colors.inkFaint,
  },
  activeOrderPillContainer: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 999,
  },
  activeOrderPill: {
    backgroundColor: '#1C1C1E', // Sleek dark capsule
    borderRadius: 100,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  activeOrderIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 20,
  },
  activeOrderDotBase: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34D399',
  },
  activeOrderDotPulse: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#34D399',
    top: -5,
    left: -5,
    opacity: 0.4,
  },
  activeOrderTextContainer: {
    marginRight: 12,
    justifyContent: 'center',
  },
  activeOrderTitle: {
    color: '#F9FAFB',
    fontFamily: fontFamily.black,
    fontSize: 13,
    letterSpacing: -0.2,
  },
  activeOrderSubtitle: {
    color: '#9CA3AF',
    fontFamily: fontFamily.bold,
    fontSize: 10,
    marginTop: 2,
    letterSpacing: 0.1,
  },
  activeOrderArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeOrderArrowText: {
    color: '#FFFFFF',
    fontFamily: fontFamily.black,
    fontSize: 14,
  },

  // ── Sticky category strip ──────────────────────────────────────────────────
  categoryStrip: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 10,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryStripScroll: {
    paddingHorizontal: spacing.lg,
    gap: 6,
  },
  categoryStripItem: {
    alignItems: 'center',
    width: 64,
    position: 'relative',
  },
  categoryStripCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  categoryStripCircleActive: {
    borderColor: colors.primary,
    borderWidth: 2.5,
    shadowColor: colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  categoryStripImage: {
    width: '100%',
    height: '100%',
  },
  categoryStripLabel: {
    fontSize: 10,
    fontFamily: fontFamily.semibold,
    color: colors.inkMuted,
    textAlign: 'center',
  },
  categoryStripLabelActive: {
    color: colors.primary,
    fontFamily: fontFamily.extrabold,
  },
  categoryStripUnderline: {
    position: 'absolute',
    bottom: -10,
    left: 8,
    right: 8,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
});
export default HomeScreen;
// v2
