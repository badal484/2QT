import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { BouncingButton } from '../components/ui/BouncingButton';
import { View, Text, ScrollView, TouchableOpacity, Alert, StyleSheet, TextInput, Switch, FlatList, Dimensions, ActivityIndicator, Image, RefreshControl } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RootState } from '../store';
import { api } from '../api/client';
import { addItem, setQuantity, setZone, setAddress } from '../store/slices/cartSlice';
import { MapPin, Search, PackageOpen, ChefHat, ChevronDown, ShoppingBag, User, Bike, ArrowRight } from 'lucide-react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import Animated, { FadeInDown, FadeOutUp, SlideInDown, useSharedValue, useAnimatedStyle, interpolate, useAnimatedScrollHandler, withRepeat, withTiming } from 'react-native-reanimated';
import { isKitchenOpen, minutesUntilOpen, formatTime12h } from '../utils/kitchenHours';
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
  const { globalLocation: location, serviceabilityStatus, activeZoneId } = useSelector((state: RootState) => state.app);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const [isVegOnly, setIsVegOnly] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [phIndex, setPhIndex] = useState(0);
  const [closedSheetDismissed, setClosedSheetDismissed] = useState(false);

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
  const adminCategories: { id: string; name: string; slug: string; image_url: string; banner_url?: string }[] =
    menuCategoriesData?.categories ?? [];

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

  // Animated search placeholder — cycles through menu item names
  const placeholderNames = useMemo(() => {
    const items: any[] = menuData?.items ?? [];
    return items.filter((i: any) => i.available).map((i: any) => i.name as string).slice(0, 12);
  }, [menuData?.items]);

  useEffect(() => {
    if (placeholderNames.length < 2) return;
    const id = setInterval(() => {
      setPhIndex(i => (i + 1) % placeholderNames.length);
    }, 2500);
    return () => clearInterval(id);
  }, [placeholderNames.length]);

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

  // Build flat list data: category-preview → explore-header → section-header + item-rows per category
  const listData = useMemo(() => {
    if (sections.length === 0) return [];
    // One representative item (first) per category for the preview strip
    const previewItems = sections
      .map(s => s.data.find((i: any) => i.available) ?? null)
      .filter(Boolean);
    const result: any[] = [
      { type: 'category-preview', id: 'category-preview', items: previewItems },
      { type: 'explore-header', id: 'explore-header' },
    ];
    sections.forEach(section => {
      result.push({ type: 'section-header', id: `sh-${section.title}`, title: section.title, count: section.data.length });
      for (let i = 0; i < section.data.length; i += 2) {
        result.push({ type: 'item-row', id: `ir-${section.data[i].id}`, left: section.data[i], right: section.data[i + 1] || null });
      }
    });
    return result;
  }, [sections]);

  const renderItem = useCallback(({ item }: { item: any }) => {
    if (item.type === 'category-preview') {
      return (
        <View style={styles.catPreviewWrap}>
          {/* Heading */}
          <View style={styles.catPreviewHeadingRow}>
            <View style={styles.catPreviewHeadingAccent} />
            <Text style={styles.catPreviewHeading}>Highlights</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catPreviewScroll}>
            {item.items.map((mi: any) => {
              const ci = cartItems.find((c: any) => c.menuItemId === mi.id);
              const vegColor = mi.is_egg ? '#EAB308' : (mi.is_veg ? '#22C55E' : colors.danger);
              const unavailable = !mi.available || menuData?.kitchenPaused;
              return (
                <TouchableOpacity
                  key={mi.id}
                  style={styles.catPreviewCard}
                  activeOpacity={0.92}
                  onPress={() => { triggerHaptic(); navigation.navigate('ItemDetail', { item: mi }); }}
                >
                  {/* ── Image block ── */}
                  <View style={styles.catPreviewImgBox}>
                    {mi.photo_url
                      ? <NetworkImage uri={mi.photo_url} style={styles.catPreviewImg} />
                      : <View style={[styles.catPreviewImg, styles.catPreviewImgPlaceholder]}>
                          <ChefHat size={30} color={colors.inkFaint} />
                        </View>}

                    {/* Category pill over image */}
                    <View style={styles.catPreviewCatPill}>
                      <Text style={styles.catPreviewCatText} numberOfLines={1}>{mi.category}</Text>
                    </View>

                    {/* Bestseller badge */}
                    {mi.is_bestseller && (
                      <View style={styles.catPreviewBestBadge}>
                        <Text style={styles.catPreviewBestText}>★ Bestseller</Text>
                      </View>
                    )}

                    {/* Sold out overlay */}
                    {unavailable && (
                      <View style={styles.catPreviewSoldOut}>
                        <Text style={styles.catPreviewSoldOutText}>Sold Out</Text>
                      </View>
                    )}

                    {/* ADD / qty — floats at bottom-right of image */}
                    {!unavailable && (
                      <View style={styles.catPreviewAddFloat}>
                        {ci ? (
                          <View style={styles.catPreviewQty}>
                            <TouchableOpacity
                              onPress={() => { triggerHaptic(); dispatch(setQuantity({ menuItemId: mi.id, quantity: ci.quantity - 1 })); }}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.catPreviewQtyBtn}>−</Text>
                            </TouchableOpacity>
                            <Text style={styles.catPreviewQtyVal}>{ci.quantity}</Text>
                            <TouchableOpacity
                              onPress={() => { triggerHaptic(); dispatch(setQuantity({ menuItemId: mi.id, quantity: ci.quantity + 1 })); }}
                              hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.catPreviewQtyBtn}>+</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity style={styles.catPreviewAddBtn} onPress={() => handleAddToCart(mi)} activeOpacity={0.8}>
                            <Text style={styles.catPreviewAddText}>ADD</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>

                  {/* ── Info block ── */}
                  <View style={styles.catPreviewInfo}>
                    <View style={styles.catPreviewNameRow}>
                      <View style={[styles.catPreviewVegBadge, { borderColor: vegColor }]}>
                        <View style={[styles.catPreviewVegDot, { backgroundColor: vegColor }]} />
                      </View>
                      <Text style={styles.catPreviewName} numberOfLines={2}>{mi.name}</Text>
                    </View>
                    <Text style={styles.catPreviewPrice}>₹{mi.price_paise / 100}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      );
    }

    if (item.type === 'explore-header') {
      return <ExploreMenuBanner />;
    }

    if (item.type === 'section-header') {
      return (
        <View style={styles.categorySectionHeader}>
          <Text style={styles.categorySectionTitle}>{item.title}</Text>
          <Text style={styles.categorySectionCount}>{item.count} {item.count === 1 ? 'item' : 'items'}</Text>
        </View>
      );
    }

    // Local helper — not a hook, just a closure over renderItem's deps
    const renderCard = (menuItem: any) => {
      const cartItem = cartItems.find((ci: any) => ci.menuItemId === menuItem.id);
      const vegColor = menuItem.is_egg ? '#EAB308' : (menuItem.is_veg ? '#22C55E' : colors.danger);
      const unavailable = !menuItem.available || menuData?.kitchenPaused;
      return (
        <TouchableOpacity key={menuItem.id} style={styles.homeGridCard} activeOpacity={0.92}
          onPress={() => { if (menuItem.available) { triggerHaptic(); navigation.navigate('ItemDetail', { item: menuItem }); } }}>
          <View style={styles.homeGridImageContainer}>
            {menuItem.photo_url
              ? <NetworkImage uri={menuItem.photo_url} style={styles.homeGridImage} />
              : <View style={[styles.homeGridImage, styles.homeGridImagePlaceholder]}><ChefHat size={28} color={colors.inkFaint} /></View>}
            <View style={[styles.homeGridVegBadge, { borderColor: vegColor }]}>
              <View style={[styles.homeGridVegDot, { backgroundColor: vegColor }]} />
            </View>
            {menuItem.is_bestseller && <View style={styles.homeGridBestsellerBadge}><Text style={styles.homeGridBestsellerText}>★ Bestseller</Text></View>}
            {!menuItem.is_bestseller && menuItem.is_new && <View style={styles.homeGridNewBadge}><Text style={styles.homeGridNewText}>+ New</Text></View>}
            {unavailable && <View style={styles.homeGridSoldOut}><Text style={styles.homeGridSoldOutText}>Sold Out</Text></View>}
            {!unavailable && (
              <View style={styles.homeGridAddFloat}>
                {cartItem ? (
                  <View style={styles.homeGridQtyControl}>
                    <TouchableOpacity onPress={() => { triggerHaptic(); dispatch(setQuantity({ menuItemId: menuItem.id, quantity: cartItem.quantity - 1 })); }} style={styles.homeGridQtyBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }} activeOpacity={0.7}>
                      <Text style={styles.homeGridQtyBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.homeGridQtyValue}>{cartItem.quantity}</Text>
                    <TouchableOpacity onPress={() => { triggerHaptic(); dispatch(setQuantity({ menuItemId: menuItem.id, quantity: cartItem.quantity + 1 })); }} style={styles.homeGridQtyBtn} hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }} activeOpacity={0.7}>
                      <Text style={styles.homeGridQtyBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.homeGridAddBtn} onPress={() => handleAddToCart(menuItem)} activeOpacity={0.8}>
                    <Text style={styles.homeGridAddBtnText}>ADD</Text>
                    <View style={styles.homeGridCustomiseBadge}><Text style={styles.homeGridCustomiseText}>Customise</Text></View>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
          <View style={styles.homeGridInfo}>
            <Text style={styles.homeGridName} numberOfLines={2}>{menuItem.name}</Text>
            {menuItem.description ? <Text style={styles.homeGridDesc} numberOfLines={2}>{menuItem.description}</Text> : null}
            <Text style={styles.homeGridPrice}>₹{menuItem.price_paise / 100}</Text>
            {menuItem.tags?.length > 0 && (
              <View style={styles.homeGridTagRow}>
                {menuItem.tags.slice(0, 2).map((tag: string) => (
                  <View key={tag} style={styles.homeGridTagChip}><Text style={styles.homeGridTagText}>{tag}</Text></View>
                ))}
              </View>
            )}
          </View>
        </TouchableOpacity>
      );
    };

    return (
      <View style={styles.homeGridRow}>
        {renderCard(item.left)}
        {item.right ? renderCard(item.right) : <View style={styles.homeGridCard} />}
      </View>
    );
  }, [cartItems, menuData?.kitchenPaused, handleAddToCart, triggerHaptic, dispatch, navigation]);

  const totalCartQty = cartItems.reduce((acc, i) => acc + i.quantity, 0);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const LOCATION_HEIGHT = 50;
  const locationRowStyle = useAnimatedStyle(() => {
    const height = interpolate(scrollY.value, [0, LOCATION_HEIGHT], [LOCATION_HEIGHT, 0], 'clamp');
    const opacity = interpolate(scrollY.value, [0, LOCATION_HEIGHT / 2], [1, 0], 'clamp');
    const marginBottom = interpolate(scrollY.value, [0, LOCATION_HEIGHT], [16, 0], 'clamp');
    return { height, opacity, marginBottom, overflow: 'hidden' };
  });



  return (
    <View style={styles.container}>
      <Animated.View style={[
        { 
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
          paddingTop: Math.max(insets.top + 8, 12), 
          paddingBottom: 8,
          backgroundColor: colors.surface, 
          paddingHorizontal: 12
        }
      ]}>
        {/* ROW 1: Address and Profile (Animated) */}
        <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, locationRowStyle]}>
          <View style={{ flex: 1, paddingRight: 16, flexDirection: 'row', alignItems: 'center' }}>
            <MapPin size={28} color={colors.primary} fill={colors.primaryTint} style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontFamily: fontFamily.extrabold, color: colors.ink }}>
                {user?.name ? `Hey ${user.name.split(' ')[0]} 👋` : 'Hello'}
              </Text>
              <BouncingButton
                style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}
                onPress={() => { triggerHaptic(); navigation.navigate('Address'); }}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 13, fontFamily: fontFamily.medium, color: colors.inkMuted }} numberOfLines={1}>
                  {location?.addressText || selectedAddress?.address_text || 'Set location'}
                </Text>
                <ChevronDown size={14} color={colors.inkMuted} style={{ marginLeft: 3 }} />
              </BouncingButton>
            </View>
          </View>

          <BouncingButton
            style={styles.profileButton}
            onPress={() => { triggerHaptic(); navigation.navigate('ProfileTab'); }}
          >
            {user?.photo_url ? (
              <NetworkImage uri={user.photo_url} style={Object.assign({}, styles.profileImage as object, { borderWidth: 2, borderColor: colors.border })} fallbackText={user?.name?.[0]?.toUpperCase() || '?'} />
            ) : (
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }}>
                <User size={20} color={colors.inkMuted} />
              </View>
            )}
          </BouncingButton>
        </Animated.View>

        {/* ROW 2: Search Bar with VEG toggle */}
        {!unserviceableLocation && !showNoLocation && !showNetworkError && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.surface,
              borderRadius: 20,
              paddingLeft: 10,
              paddingRight: 6,
              height: 42,
              shadowColor: colors.ink,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.04,
              shadowRadius: 16,
              elevation: 4,
              borderWidth: 1,
              borderColor: colors.border,
            }}>
              <Search size={16} color={colors.inkMuted} style={{ marginRight: 6, flexShrink: 0 }} />
              <View style={{ flex: 1, height: '100%', justifyContent: 'center', overflow: 'hidden' }}>
                <TextInput
                  placeholder=""
                  placeholderTextColor="transparent"
                  style={{ 
                    flex: 1, 
                    fontSize: 13, 
                    fontFamily: fontFamily.medium, 
                    color: colors.ink, 
                    paddingVertical: 0, 
                    paddingHorizontal: 0,
                    height: '100%',
                    textAlignVertical: 'center',
                    minWidth: 50,
                    zIndex: 2
                  }}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery === '' && (
                  <View 
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      height: '100%',
                      flexDirection: 'row',
                      alignItems: 'center',
                      zIndex: 1
                    }}
                  >
                    {placeholderNames.length > 0 ? (
                      <>
                        <Text style={{
                          fontSize: 13,
                          fontFamily: fontFamily.medium,
                          color: colors.inkMuted,
                        }}>
                          Search{" "}
                        </Text>
                        <View style={{ flex: 1, height: '100%', justifyContent: 'center', overflow: 'hidden' }}>
                          <Animated.Text
                            key={phIndex}
                            entering={FadeInDown.duration(350)}
                            exiting={FadeOutUp.duration(350)}
                            style={{
                              fontSize: 13,
                              fontFamily: fontFamily.medium,
                              color: colors.inkMuted,
                            }}
                          >
                            "{placeholderNames[phIndex]}"
                          </Animated.Text>
                        </View>
                      </>
                    ) : (
                      <Text style={{
                        fontSize: 13,
                        fontFamily: fontFamily.medium,
                        color: colors.inkMuted,
                      }}>
                        Search for food...
                      </Text>
                    )}
                  </View>
                )}
              </View>
              {searchQuery.length > 0 ? (
                <BouncingButton onPress={() => { triggerHaptic(); setSearchQuery(''); }} style={{ paddingLeft: 6, paddingRight: 2, flexShrink: 0 }}>
                  <Text style={{ fontSize: 11, fontFamily: fontFamily.bold, color: colors.inkMuted }}>Clear</Text>
                </BouncingButton>
              ) : (
                <View style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  flexShrink: 0 
                }}>
                  <Text style={{
                    fontSize: 9,
                    fontFamily: fontFamily.extrabold,
                    color: isVegOnly ? '#22C55E' : colors.inkMuted,
                    letterSpacing: 0.5,
                    marginLeft: 4,
                    flexShrink: 0
                  }} numberOfLines={1}>
                    VEG
                  </Text>
                  
                  <View style={{ 
                    width: 1, 
                    height: 16, 
                    backgroundColor: colors.border, 
                    marginHorizontal: 6,
                    flexShrink: 0
                  }} />

                  <Switch
                    value={isVegOnly}
                    onValueChange={(val) => { triggerHaptic(); setIsVegOnly(val); }}
                    trackColor={{ false: '#E2E8F0', true: '#BBF7D0' }}
                    thumbColor={isVegOnly ? '#22C55E' : '#FFFFFF'}
                    style={{ 
                      transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }],
                      marginRight: -4,
                      marginLeft: -4,
                      marginTop: -4,
                      marginBottom: -4
                    }}
                  />
                </View>
              )}
            </View>

            {/* 2QT brand mark */}
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingRight: 2, flexShrink: 0 }}>
              <Text style={{ fontSize: 18, fontFamily: fontFamily.black, color: colors.ink, letterSpacing: -1 }}>
                2QT<Text style={{ color: colors.primary, fontSize: 20 }}>.</Text>
              </Text>
            </View>
          </View>
        )}
      </Animated.View>

      <Animated.FlatList
        style={{ flex: 1 }}
        data={
          isServiceabilityChecking || unserviceableLocation || showNoLocation || showNetworkError
            ? []
            : listData
        }
        keyExtractor={(item: any) => item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={32}
        contentContainerStyle={[styles.listContent, { paddingTop: Math.max(insets.top + 8, 12) + 116 + LOCATION_HEIGHT }]}
        windowSize={5}
        maxToRenderPerBatch={4}
        initialNumToRender={6}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={true}
        decelerationRate="fast"
        overScrollMode="never"
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
                      <BouncingButton
                        key={cat.id}
                        style={styles.categoryStripItem}
                        onPress={() => { triggerHaptic(); navigation.navigate('Category', { categorySlug: cat.slug, categoryName: cat.name, categoryImage: cat.image_url, categoryBannerUrl: cat.banner_url }); }}
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
                      </BouncingButton>
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
                    <BouncingButton
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
                    </BouncingButton>
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
              <Animated.View entering={FadeInDown.delay(150).duration(400)} style={{ overflow: 'hidden', marginTop: spacing.sm }}>
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
                      <BouncingButton
                        activeOpacity={0.9}
                        onPress={() => {
                          triggerHaptic();
                          if (b.action_type === 'FILTER_CATEGORY') setSelectedCategory(b.action_payload);
                        }}
                        style={[styles.bannerContainer, { height: 130 }]}
                      >
                        <NetworkImage uri={b.image_url} style={[styles.bannerImage, { borderRadius: 16 }]} />
                        <View style={[styles.bannerOverlay, { borderRadius: 16 }]}>
                          <Text style={styles.bannerTitle} numberOfLines={2}>{b.title}</Text>
                          {b.subtitle && <Text style={styles.bannerSubtitle} numberOfLines={2}>{b.subtitle}</Text>}
                        </View>
                      </BouncingButton>
                    </View>
                  )}
                />
              </Animated.View>
            )}

            {/* ── Strip Banners ── */}
            {!isLoading && !unserviceableLocation && !showNoLocation && !showNetworkError && stripBanners.length > 0 && (
              <View style={styles.stripBannersContainer}>
                {stripBanners.map((banner: any) => (
                  <BouncingButton
                    key={banner.id}
                    activeOpacity={0.9}
                    onPress={() => {
                      triggerHaptic();
                      if (banner.action_type === 'FILTER_CATEGORY') setSelectedCategory(banner.action_payload);
                    }}
                    style={styles.stripBannerCard}
                  >
                    <NetworkImage uri={banner.image_url} style={styles.stripBannerImage} />
                    <View style={styles.stripBannerOverlay}>
                      <Text style={styles.stripBannerTitle}>{banner.title}</Text>
                      {banner.subtitle && <Text style={styles.stripBannerSubtitle} numberOfLines={1}>{banner.subtitle}</Text>}
                    </View>
                  </BouncingButton>
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
              <BouncingButton style={styles.ctaPrimary} onPress={() => { triggerHaptic(); navigation.navigate('Address'); }}>
                <Text style={styles.ctaPrimaryText}>Select Delivery Address</Text>
              </BouncingButton>
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
              <BouncingButton style={styles.ctaPrimary} onPress={() => { triggerHaptic(); navigation.navigate('Address'); }}>
                <Text style={styles.ctaPrimaryText}>Retry / Change Address</Text>
              </BouncingButton>
            </Animated.View>
          ) : unserviceableLocation ? (
            /* ── Out of zone — full screen like reference ── */
            <Animated.View entering={FadeInDown.duration(400)} style={styles.unserviceableWrap}>
              {requestStep === 'done' ? (
                <View style={styles.reqDoneCard}>
                  <Text style={styles.reqDoneTitle}>You're on the list!</Text>
                  <Text style={styles.reqDoneSub}>We'll notify you the day we launch in {reqForm.area_name || 'your area'}!</Text>
                  <BouncingButton style={styles.ctaOutline} onPress={() => setRequestStep('info')}>
                    <Text style={styles.ctaOutlineText}>Back</Text>
                  </BouncingButton>
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

                    <BouncingButton style={styles.reqSubmitBtn} onPress={handleRequestService} disabled={reqLoading}>
                      {reqLoading
                        ? <ActivityIndicator color={colors.white} />
                        : <Text style={styles.reqSubmitBtnText}>Submit Request</Text>}
                    </BouncingButton>

                    <BouncingButton style={styles.reqCancelLink} onPress={() => { triggerHaptic(); setRequestStep('info'); }}>
                      <Text style={styles.reqCancelLinkText}>Cancel</Text>
                    </BouncingButton>
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
                  <BouncingButton style={styles.ctaPrimary} onPress={() => { triggerHaptic(); navigation.navigate('Address'); }} activeOpacity={0.9}>
                    <Text style={styles.ctaPrimaryText}>Change Address</Text>
                  </BouncingButton>
                  <BouncingButton style={styles.ctaOutline} onPress={() => { triggerHaptic(); setRequestStep('form'); }} activeOpacity={0.8}>
                    <Text style={styles.ctaOutlineText}>Request Service in My Area</Text>
                  </BouncingButton>
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
        ListFooterComponent={
          <View style={{ paddingBottom: 40, marginTop: 24 }} />
        }
      />

      {cartItems.length > 0 && listData.length > 0 && (
        <Animated.View
          entering={FadeInDown.duration(300)}
          exiting={FadeInDown.duration(200).delay(0)}
          style={[
            styles.floatingCartContainer,
            { bottom: Math.max(insets.bottom, 16) + 8 },
          ]}
        >
          <BouncingButton
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
          </BouncingButton>
        </Animated.View>
      )}

      {primaryActiveOrder && (
        <Animated.View entering={FadeInDown.duration(400).springify().damping(15)} style={[
          styles.activeOrderPillContainer,
          { bottom: totalCartQty > 0 ? Math.max(insets.bottom, 16) + 84 : Math.max(insets.bottom, 16) + 16 }
        ]}>
          <BouncingButton
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
          </BouncingButton>
        </Animated.View>
      )}

      {!isKitchenOpen(menuData?.openingTime, menuData?.closingTime) &&
        !!effectiveZoneId && !isLoading && !!menuData && !closedSheetDismissed && (
        <ClosedBottomSheet
          openingTime={menuData.openingTime}
          onDismiss={() => setClosedSheetDismissed(true)}
        />
      )}
    </View>
  );
};



const ExploreMenuBanner = React.memo(() => (
  <View style={ebS.wrapper}>
    {/* Giant ghost "MENU" — 5% opacity, gives depth without any background */}
    <Text style={ebS.ghost} numberOfLines={1}>MENU</Text>

    {/* Top diamond rule */}
    <View style={ebS.ruleRow}>
      <View style={ebS.ruleLine} />
      <Text style={ebS.diamond}>◆</Text>
      <View style={ebS.ruleLine} />
    </View>

    {/* Eyebrow label */}
    <Text style={ebS.eyebrow}>E X P L O R E</Text>

    {/* Main title — two weights inline */}
    <View style={ebS.titleRow}>
      <Text style={ebS.titleLight}>our </Text>
      <Text style={ebS.titleBold}>menu</Text>
    </View>

    {/* Bottom diamond rule */}
    <View style={ebS.ruleRow}>
      <View style={ebS.ruleLine} />
      <Text style={ebS.diamond}>◆</Text>
      <View style={ebS.ruleLine} />
    </View>
  </View>
));

const ebS = StyleSheet.create({
  wrapper: {
    paddingVertical: 20,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  ghost: {
    position: 'absolute',
    fontFamily: fontFamily.black,
    fontSize: 108,
    color: 'rgba(46, 125, 50, 0.05)',
    letterSpacing: 10,
    top: '50%',
    marginTop: -54,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '78%',
    marginVertical: 5,
  },
  ruleLine: {
    flex: 1,
    height: 0.8,
    backgroundColor: 'rgba(94, 175, 99, 0.45)',
  },
  diamond: {
    fontSize: 7,
    color: 'rgba(94, 175, 99, 0.7)',
  },
  eyebrow: {
    fontFamily: fontFamily.extrabold,
    fontSize: 10,
    color: '#7DC880',
    letterSpacing: 5,
    marginBottom: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  titleLight: {
    fontFamily: fontFamily.medium,
    fontStyle: 'italic',
    fontSize: 38,
    color: '#81C784',
    letterSpacing: 0.5,
  },
  titleBold: {
    fontFamily: fontFamily.black,
    fontSize: 42,
    color: '#1B5E20',
    letterSpacing: -0.5,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  minimalHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
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
  addressValue: { color: colors.inkMuted, fontSize: 12, fontFamily: fontFamily.semibold, marginTop: 2 },
  profileButton: {
    width: 36, height: 36, backgroundColor: colors.primaryTint, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    borderWidth: 0,
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
    flexDirection: 'row', backgroundColor: '#24B059', borderRadius: 16,
    alignItems: 'center', justifyContent: 'space-between', height: 40,
    shadowColor: '#24B059', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  qtyBtn: { width: 34, height: 40, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { color: '#FFFFFF', fontSize: 22, fontFamily: fontFamily.bold },
  qtyValue: { color: '#FFFFFF', fontSize: 15, fontFamily: fontFamily.extrabold },
  addBtn: {
    backgroundColor: '#24B059', borderRadius: 16,
    height: 40, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#24B059', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  addBtnDisabled: { backgroundColor: colors.surfaceMuted },
  addBtnText: { color: '#FFFFFF', fontFamily: fontFamily.extrabold, fontSize: 15, letterSpacing: 0.5 },

  // ── Home grid card (2-column) ──────────────────────────────────────────────
  // Explore Menu divider
  exploreHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 20 },
  exploreLine: { flex: 1, height: 1, backgroundColor: colors.border },
  explorePill: { marginHorizontal: 12, backgroundColor: colors.surface, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: colors.border },
  exploreText: { fontSize: 12, fontFamily: fontFamily.extrabold, color: colors.ink, letterSpacing: 0.3 },

  // Category section header
  categorySectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 4, paddingBottom: 10 },
  categorySectionTitle: { fontSize: 18, fontFamily: fontFamily.black, color: colors.ink, letterSpacing: -0.3 },
  categorySectionCount: { fontSize: 12, fontFamily: fontFamily.semibold, color: colors.inkMuted },

  // Grid row (2 cards per row)
  homeGridRow: { flexDirection: 'row', paddingHorizontal: 12, gap: 12, marginBottom: 16 },
  homeGridCard: { flex: 1, backgroundColor: '#FFFFFF', marginBottom: 2 },
  homeGridImageContainer: { width: '100%', aspectRatio: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: '#F9FAFB', position: 'relative', marginBottom: 8 },
  homeGridImage: { width: '100%', height: '100%' },
  homeGridImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  homeGridVegBadge: { position: 'absolute', top: 8, left: 8, width: 14, height: 14, borderWidth: 1.5, borderRadius: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  homeGridVegDot: { width: 8, height: 8, borderRadius: 4 },
  homeGridBestsellerBadge: { position: 'absolute', top: 10, right: 10, backgroundColor: '#FEF3C7', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7 },
  homeGridBestsellerText: { fontSize: 9, fontFamily: fontFamily.extrabold, color: '#92400E', letterSpacing: 0.2 },
  homeGridNewBadge: { position: 'absolute', top: 10, right: 10, backgroundColor: '#EDE9FE', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7 },
  homeGridNewText: { fontSize: 9, fontFamily: fontFamily.extrabold, color: '#5B21B6', letterSpacing: 0.2 },
  homeGridSoldOut: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' },
  homeGridSoldOutText: { color: colors.ink, fontFamily: fontFamily.extrabold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  homeGridAddFloat: { position: 'absolute', bottom: -1, alignSelf: 'center', width: '85%', zIndex: 10 },
  homeGridQtyControl: { flexDirection: 'row', backgroundColor: '#24B059', borderRadius: 16, alignItems: 'center', justifyContent: 'space-between', height: 32, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 16, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  homeGridQtyBtn: { width: 30, height: 32, alignItems: 'center', justifyContent: 'center' },
  homeGridQtyBtnText: { color: colors.white, fontSize: 18, fontFamily: fontFamily.bold },
  homeGridQtyValue: { color: colors.white, fontSize: 13, fontFamily: fontFamily.extrabold },
  homeGridAddBtn: { backgroundColor: '#24B059', borderRadius: 16, height: 32, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 16, shadowOffset: { width: 0, height: 2 }, elevation: 4, position: 'relative' },
  homeGridAddBtnText: { color: colors.white, fontFamily: fontFamily.extrabold, fontSize: 14, letterSpacing: 0.5 },
  homeGridCustomiseBadge: { position: 'absolute', top: -10, backgroundColor: '#FFFFFF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#F3F4F6' },
  homeGridCustomiseText: { fontSize: 8, fontFamily: fontFamily.bold, color: '#24B059', textTransform: 'uppercase' },
  homeGridInfo: { paddingHorizontal: 4 },
  homeGridName: { fontSize: 14, fontFamily: fontFamily.bold, color: colors.ink, marginBottom: 2, lineHeight: 18 },
  homeGridDesc: { fontSize: 11, color: '#8E8E93', fontFamily: fontFamily.medium, lineHeight: 14, marginBottom: 4 },
  homeGridPrice: { fontSize: 14, fontFamily: fontFamily.black, color: colors.ink },
  homeGridTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  homeGridTagChip: { backgroundColor: '#F9FAFB', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 0 },
  homeGridTagText: { fontSize: 9, fontFamily: fontFamily.bold, color: colors.inkMuted },
  customisePill: {
    alignSelf: 'center', backgroundColor: '#FFFFFF', borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2, marginBottom: 3,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#F3F4F6',
  },
  customisePillText: { fontSize: 8, fontFamily: fontFamily.bold, color: '#24B059', textTransform: 'uppercase', letterSpacing: 0.3 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 4 },
  bestsellerBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  bestsellerBadgeText: { fontSize: 9, fontFamily: fontFamily.extrabold, color: '#92400E', letterSpacing: 0.2 },
  newBadge: { backgroundColor: '#EDE9FE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  newBadgeText: { fontSize: 9, fontFamily: fontFamily.extrabold, color: '#5B21B6', letterSpacing: 0.2 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  tagChip: { backgroundColor: '#F9FAFB', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 0 },
  tagChipText: { fontSize: 9, fontFamily: fontFamily.bold, color: colors.inkMuted },

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
  liveDot: { position: 'absolute', width: 16, height: 16, borderRadius: 16, backgroundColor: colors.primary },
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
    shadowRadius: 16,
    elevation: 4,
  },
  deliveryTimeText: { color: colors.primary, fontSize: 14, fontFamily: fontFamily.extrabold },
  deliveryTimeSub: { color: colors.inkMuted, fontSize: 8, fontFamily: fontFamily.bold, letterSpacing: 0.5 },

  searchBarContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 40,
    marginTop: 12,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 13, fontFamily: fontFamily.semibold, color: colors.ink },
  vegToggleContainer: { borderLeftWidth: 1, borderLeftColor: '#E5E7EB', paddingLeft: 8, marginLeft: 8 },
  vegToggleWrapper: { flexDirection: 'row', alignItems: 'center' },
  vegText: { fontSize: 9, fontFamily: fontFamily.extrabold, color: colors.inkFaint, marginRight: 4, letterSpacing: 0.5 },
  vegTextActive: { color: colors.primary },
  vegSwitch: { transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] },

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

  mindContainer: { marginTop: 16 },
  mindScroll: { paddingHorizontal: 12, gap: 8 },
  categoryPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  categoryPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryPillText: { fontSize: 14, fontFamily: fontFamily.extrabold, color: colors.inkMuted },
  categoryPillTextActive: { color: colors.white },

  // ── Swish-style circular image categories ──────────────────────────────────
  imageCategoryItem: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: 60,
    marginRight: 4,
  },
  imageCategoryItemActive: {},
  imageCategoryCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageCategoryCircleActive: {
    borderColor: colors.primary,
    borderWidth: 2.5,
    shadowColor: colors.primary,
    shadowOpacity: 0.08,
    shadowRadius: 16,
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
    ...StyleSheet.absoluteFill,
    padding: spacing.sm + 2,
    justifyContent: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.3)'
  },
  miniBannerTitle: {
    fontSize: 12,
    fontFamily: fontFamily.extrabold,
    color: colors.white,
  },
  miniBannerSubtitle: {
    fontSize: 10,
    fontFamily: fontFamily.bold,
    color: 'rgba(255,255,255,0.9)',
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
  stripBannerOverlay: {
    ...StyleSheet.absoluteFill,
    padding: spacing.lg,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  stripBannerTitle: {
    fontSize: 16,
    fontFamily: fontFamily.black,
    color: colors.white,
  },
  stripBannerSubtitle: {
    fontSize: 12,
    fontFamily: fontFamily.bold,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },

  itemsContainer: { paddingHorizontal: 12, marginTop: 16, paddingBottom: 60 },
  modernItemsList: { width: '100%' },

  modernCard: {
    width: '100%',
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  modernCardInner: { flexDirection: 'row', alignItems: 'center' },

  modernImageCol: { width: 70, alignItems: 'center', marginRight: 12 },
  modernImageWrapper: { width: 70, height: 70, borderRadius: 16, backgroundColor: '#F9FAFB', overflow: 'hidden' },
  modernImage: { width: '100%', height: '100%' },
  modernImagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  modernInfo: { flex: 1, paddingRight: 4 },
  modernTagsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  vegIndicatorModern: { width: 10, height: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: 4, borderRadius: 3 },
  vegDotModern: { width: 4, height: 4, borderRadius: 2 },
  bestsellerTagModern: { backgroundColor: colors.warningTint, paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 },
  bestsellerTagTextModern: { color: colors.warning, fontSize: 8, fontFamily: fontFamily.extrabold, textTransform: 'uppercase' },
  modernName: { fontSize: 14, fontFamily: fontFamily.bold, color: colors.ink, lineHeight: 18, marginBottom: 2 },
  modernPrice: { fontSize: 13, fontFamily: fontFamily.extrabold, color: colors.ink, marginBottom: 2 },
  modernDesc: { fontSize: 11, color: colors.inkMuted, fontFamily: fontFamily.medium, lineHeight: 14 },

  addBtnContainerRight: { marginLeft: 'auto' },
  floatingAddButtonModern: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    borderWidth: 0,
  },
  floatingAddButtonDisabled: { backgroundColor: '#F9FAFB' },
  floatingAddButtonTextModern: { color: colors.primary, fontFamily: fontFamily.extrabold, fontSize: 13, letterSpacing: 0.5 },

  floatingQuantityControlModern: {
    width: 70,
    height: 28,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 6,
  },
  floatingQtyBtnModern: { paddingHorizontal: 6, height: '100%', justifyContent: 'center' },
  floatingQtyTextModern: { color: colors.white, fontSize: 16, fontFamily: fontFamily.extrabold },
  floatingQtyValueModern: { color: colors.white, fontSize: 13, fontFamily: fontFamily.extrabold },

  soldOutOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' },
  soldOutText: { color: colors.ink, fontFamily: fontFamily.extrabold, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 },

  skeletonList: { width: '100%' },

  floatingCartContainer: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 999,
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  floatingCartButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cartLeftRow: { flexDirection: 'row', alignItems: 'center' },
  cartItemCount: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontFamily: fontFamily.extrabold, letterSpacing: 1, textTransform: 'uppercase' },
  cartTotalText: { color: colors.white, fontSize: 18, fontFamily: fontFamily.black, letterSpacing: -0.5 },
  viewCartText: {
    color: "#fff",
    fontFamily: fontFamily.black,
    fontSize: 14,
  },
  viewCartAction: { flexDirection: 'row', alignItems: 'center' },
  bannersList: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingTop: spacing.xl },
  bannerContainer: {
    width: '100%',
    height: 130,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#E0E0E0',
  },
  bannerImage: { width: '100%', height: '100%', opacity: 1 },
  bannerOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    padding: spacing.lg,
    justifyContent: 'center',
    backgroundColor: 'transparent',
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
    shadowOpacity: 0.08,
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
    shadowOpacity: 0.08,
    shadowRadius: 16,
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
    shadowOpacity: 0.08,
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
    shadowOpacity: 0.08,
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
    borderRadius: 16,
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
    backgroundColor: colors.surface,
    paddingTop: 4,
    paddingBottom: 8,
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
    shadowOpacity: 0.08,
    shadowRadius: 16,
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
  // ── Category Preview Strip ──────────────────────────────────────
  catPreviewWrap: { paddingTop: 10, paddingBottom: 4 },
  catPreviewHeadingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, marginBottom: 10,
  },
  catPreviewHeadingAccent: {
    width: 4, height: 16, borderRadius: 2,
    backgroundColor: colors.primary,
  },
  catPreviewHeading: {
    fontFamily: fontFamily.black,
    fontSize: 18,
    color: colors.ink,
    letterSpacing: -0.3,
  },
  catPreviewScroll: { paddingHorizontal: 12, gap: 10, paddingBottom: 4 },
  catPreviewCard: {
    width: 140,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#F3F4F6',
    overflow: 'hidden',
  },
  catPreviewImgBox: { width: '100%', height: 100, position: 'relative' },
  catPreviewImg: { width: '100%', height: '100%' },
  catPreviewImgPlaceholder: {
    backgroundColor: '#F9FAFB',
    alignItems: 'center', justifyContent: 'center',
  },
  catPreviewCatPill: {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: 'rgba(0,0,0,0.48)',
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3,
    maxWidth: 100,
  },
  catPreviewCatText: { fontSize: 9, color: '#fff', fontFamily: fontFamily.bold },
  catPreviewBestBadge: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 16, paddingHorizontal: 6, paddingVertical: 2,
  },
  catPreviewBestText: { fontSize: 9, color: '#92400E', fontFamily: fontFamily.extrabold },
  catPreviewSoldOut: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  catPreviewSoldOutText: { color: '#fff', fontFamily: fontFamily.extrabold, fontSize: 12 },
  catPreviewAddFloat: {
    position: 'absolute', bottom: 8, right: 8,
  },
  catPreviewAddBtn: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.primary,
    paddingHorizontal: 14, paddingVertical: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  catPreviewAddText: { fontFamily: fontFamily.extrabold, fontSize: 12, color: colors.primary },
  catPreviewQty: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.primary, borderRadius: 16,
    paddingHorizontal: 8, paddingVertical: 5, gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  catPreviewQtyBtn: { fontFamily: fontFamily.extrabold, fontSize: 16, color: '#fff', lineHeight: 18 },
  catPreviewQtyVal: {
    fontFamily: fontFamily.extrabold, fontSize: 13,
    color: '#fff', minWidth: 18, textAlign: 'center',
  },
  catPreviewInfo: { padding: 10, paddingTop: 10 },
  catPreviewNameRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 6,
  },
  catPreviewVegBadge: {
    width: 15, height: 15, borderRadius: 3, borderWidth: 1.5,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: 1,
  },
  catPreviewVegDot: { width: 7, height: 7, borderRadius: 3.5 },
  catPreviewName: {
    fontFamily: fontFamily.bold,
    fontSize: 13, lineHeight: 17,
    color: colors.ink,
    flex: 1,
  },
  catPreviewPrice: {
    fontFamily: fontFamily.extrabold,
    fontSize: 15,
    color: colors.ink,
    marginTop: 2,
  },
  // ────────────────────────────────────────────────────────────────
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

const SLAT_COUNT = 6;

const ClosedBottomSheet = ({
  openingTime,
  onDismiss,
}: {
  openingTime?: string | null;
  onDismiss: () => void;
}) => {
  const insets = useSafeAreaInsets();
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const minsLeft = minutesUntilOpen(openingTime);
  const opensVerySoon = minsLeft > 0 && minsLeft <= 30;
  const openLabel = openingTime ? formatTime12h(openingTime) : '10:00 AM';

  return (
    <Animated.View entering={SlideInDown.springify().damping(18).stiffness(120)} style={closedSS.sheet}>
      {/* Roller shutter illustration */}
      <View style={closedSS.shutterBox}>
        <View style={closedSS.rail} />
        {Array.from({ length: SLAT_COUNT }).map((_, i) => (
          <View key={i} style={closedSS.slat} />
        ))}
        <View style={closedSS.rail} />
        <View style={closedSS.handle} />
      </View>

      <Text style={closedSS.title}>Closed for Now, Back Soon!</Text>

      {opensVerySoon ? (
        <Text style={closedSS.subtitle}>
          Opening in <Text style={closedSS.highlight}>{minsLeft} min</Text>
        </Text>
      ) : (
        <Text style={closedSS.subtitle}>
          We open at <Text style={closedSS.highlight}>{openLabel}</Text>
        </Text>
      )}

      <Text style={closedSS.body}>
        We're closed for now, but we'll be back soon!{'\n'}Thank you for your patience.
      </Text>

      <TouchableOpacity
        style={[closedSS.btn, { marginBottom: Math.max(insets.bottom, 20) }]}
        onPress={onDismiss}
        activeOpacity={0.85}
      >
        <Text style={closedSS.btnText}>Browse Menu</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const closedSS = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 24,
  },
  shutterBox: {
    width: 170,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    marginBottom: 20,
  },
  rail: { height: 9, backgroundColor: '#9CA3AF' },
  slat: { height: 15, backgroundColor: '#E5E7EB', borderBottomWidth: 1, borderBottomColor: '#9CA3AF' },
  handle: { alignSelf: 'center', width: 44, height: 7, backgroundColor: '#6B7280', borderRadius: 4, marginVertical: 5 },
  title: {
    fontSize: 22,
    fontFamily: fontFamily.black,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: fontFamily.medium,
    color: colors.inkMuted,
    textAlign: 'center',
    marginBottom: 8,
  },
  highlight: {
    fontFamily: fontFamily.extrabold,
    color: colors.primary,
  },
  body: {
    fontSize: 13,
    fontFamily: fontFamily.medium,
    color: colors.inkMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  btn: {
    width: '100%',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: fontFamily.extrabold,
  },
});

export default HomeScreen;
// v2
