import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { tokens } from '../theme/tokens';
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { BouncingButton } from '../components/ui/BouncingButton';
import { CustomVegToggle } from '../components/ui/internal/CustomVegToggle';
import { PressableScale } from '../components/ui/internal/PressableScale';
import { View, Text, ScrollView, TouchableOpacity, Alert, TextInput, Switch, FlatList, useWindowDimensions, ActivityIndicator, Image, RefreshControl } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSelector, useDispatch } from 'react-redux';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RootState } from '../store';
import { api } from '../api/client';
import { addItem, setZone, setAddress, clearCart } from '../store/slices/cartSlice';
import { setServiceabilityChecking, setServiceable, setUnserviceable, setNetworkError } from '../store/slices/appSlice';
import { MapPin, Search, PackageOpen, ChefHat, ChevronDown, ShoppingBag, User, Bike, ArrowRight, UtensilsCrossed } from 'lucide-react-native';
import Animated, { FadeInDown, FadeOutDown, useSharedValue, useAnimatedStyle, interpolate, useAnimatedScrollHandler, withRepeat, withTiming } from 'react-native-reanimated';
import { isKitchenOpen } from '../utils/kitchenHours';
import { NetworkImage } from '../components/NetworkImage';
import { BannerMedia } from '../components/BannerMedia';
import { CustomizationBottomSheet } from '../components/ui/CustomizationBottomSheet';
import { EmptyState, SkeletonRow, SkeletonHomeScreen, ActiveOrdersBottomSheet } from '../components/ui';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptics } from '../utils/haptics';
import { styles } from './home/homeStyles';
import { AnimatedSearchPlaceholder } from './home/AnimatedSearchPlaceholder';
import { CategoryPreviewSection } from './home/CategoryPreviewSection';
import { MenuGridCard } from './home/MenuGridCard';
import { ExploreMenuBanner } from './home/ExploreMenuBanner';
import { ClosedBottomSheet } from './home/ClosedBottomSheet';
import { CampaignBannerCard } from './home/CampaignBannerCard';
import { useFeedback } from '../context/FeedbackContext';
import { FlashList } from '@shopify/flash-list';

const AnimatedFlashList = Animated.createAnimatedComponent(FlashList);

const HomeScreen = ({ navigation }: any) => {
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
  const { user } = useSelector((state: RootState) => state.auth);
  const { items: cartItems, zoneId, addressId } = useSelector((state: RootState) => state.cart);
  const isFocused = useIsFocused();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const { globalLocation: location, serviceabilityStatus, activeZoneId } = useSelector((state: RootState) => state.app);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const { showDialog } = useFeedback();

  // Stable ref so handleAddToCart doesn't need cartItems in its dep array
  const cartItemsRef = useRef(cartItems);

  cartItemsRef.current = cartItems;

  const [isVegOnly, setIsVegOnly] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [closedSheetDismissed, setClosedSheetDismissed] = useState(false);
  const [activeCustomizationItem, setActiveCustomizationItem] = useState<any>(null);
  const [showActiveOrdersModal, setShowActiveOrdersModal] = useState(false);

  // If address has a zone use it; if address exists but has no zone, fall back to GPS zone
  const effectiveZoneId = zoneId || activeZoneId;

  const [retrying, setRetrying] = useState(false);
  const retryZoneCheck = useCallback(async () => {
    if (!location) { navigation.navigate('Address'); return; }
    setRetrying(true);
    dispatch(setServiceabilityChecking());
    try {
      const res = await api.get(`/menu/zones/check?lat=${location.latitude}&lng=${location.longitude}`);
      if (res.serviceable && res.zone?.id) {
        dispatch(setZone(res.zone.id));
        dispatch(setServiceable({ zoneId: res.zone.id, zoneName: res.zone.name || null, location }));
        queryClient.invalidateQueries({ queryKey: ['menu'] });
      } else {
        dispatch(setUnserviceable(location));
      }
    } catch {
      dispatch(setNetworkError());
    } finally {
      setRetrying(false);
    }
  }, [location, dispatch, queryClient, navigation]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    haptics.selection();
    try {
      if (!effectiveZoneId && location) {
        await retryZoneCheck();
      }
      await queryClient.refetchQueries();
    } catch {
      // Ignored - React Query handles error states
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, effectiveZoneId, location, retryZoneCheck]);

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

  const liveDotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
    opacity: 1 - pulseAnim.value,
  }));



  const { data: menuData, isLoading } = useQuery({
    queryKey: ['menu', effectiveZoneId],
    queryFn: () => api.get(`/menu?zoneId=${effectiveZoneId}`),
    enabled: !!effectiveZoneId,
    staleTime: 3 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const { data: activeOrdersData } = useQuery({
    queryKey: ['activeOrders'],
    queryFn: () => api.get('/orders/active'),
    staleTime: 10000,
    // Poll every 15s only when an active order exists — saves battery + requests when idle
    refetchInterval: (query) => {
      const orders = (query.state.data as any)?.activeOrders;
      return Array.isArray(orders) && orders.length > 0 ? 5000 : false;
    },
  });
  const activeOrders = activeOrdersData?.activeOrders?.filter((o: any) => !['cancelled', 'cancelled_by_restaurant', 'refunded', 'payment_failed'].includes(o.status)) || [];
  const primaryActiveOrder = activeOrders[0];

  const { data: bannersData } = useQuery({
    queryKey: ['banners'],
    queryFn: () => api.get('/banners'),
    staleTime: 30 * 1000,
    gcTime: 15 * 60 * 1000,
  });
  const banners = bannersData?.banners || [];
  const mainBanners = banners.filter((b: any) => !b.banner_type || b.banner_type === 'MAIN');
  const miniBanners = banners.filter((b: any) => b.banner_type === 'MINI');
  const stripBanners = banners.filter((b: any) => b.banner_type === 'STRIP');

  const { data: campaignsData } = useQuery({
    queryKey: ['campaigns', effectiveZoneId],
    queryFn: () => api.get(`/campaigns/active?zoneId=${effectiveZoneId || ''}`),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
  const activeCampaigns = campaignsData?.campaigns || [];
  const primaryCampaign = activeCampaigns[0];

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

  const { data: restaurantsData } = useQuery({
    queryKey: ['restaurants', effectiveZoneId],
    queryFn: () => api.get(`/restaurants${effectiveZoneId ? `?zoneId=${effectiveZoneId}` : ''}`).then((r: any) => r.restaurants as any[]),
    enabled: !unserviceableLocation && !showNoLocation && !showNetworkError,
    staleTime: 5 * 60 * 1000,
  });
  const restaurants: any[] = restaurantsData || [];

  const getRestCoverPhoto = (photos: any): string | null => {
    if (!photos || !Array.isArray(photos) || photos.length === 0) return null;
    const first = photos[0];
    if (typeof first === 'string') {
      try { const o = JSON.parse(first); if (o?.url) return o.url; } catch {}
      return first.startsWith('http') ? first : null;
    }
    return first?.url || null;
  };

  // 3 copies is enough for infinite-scroll feel while keeping the array tiny (was 500 copies = ~2500 items)
  const BANNER_COPIES = 3;
  const infiniteBanners = useMemo(() => {
    if (!mainBanners || mainBanners.length === 0) return [];
    if (mainBanners.length === 1) return mainBanners;
    const repeated = [];
    for (let i = 0; i < BANNER_COPIES; i++) {
      for (let j = 0; j < mainBanners.length; j++) {
        repeated.push({ ...mainBanners[j], uniqueId: `${mainBanners[j].id}-${i}` });
      }
    }
    return repeated;
  }, [mainBanners]);

  const bannerListRef = useRef<FlatList>(null);
  // Start at the middle copy so user can scroll both directions
  const bannerIndexRef = useRef(mainBanners.length > 1 ? mainBanners.length : 0);
  const hasInitializedBanner = useRef(false);
  const [activeBannerDot, setActiveBannerDot] = useState(0);

  // mainBanners is a fresh array reference on every render (built via .filter() above),
  // so we mirror it into a ref rather than depending on it directly — otherwise the
  // autoplay effect below would tear down and restart on every unrelated re-render.
  const mainBannersRef = useRef(mainBanners);
  mainBannersRef.current = mainBanners;

  // Jump to the middle instantly on mount
  useEffect(() => {
    if (infiniteBanners.length > 1 && !hasInitializedBanner.current) {
      const timer = setTimeout(() => {
        try {
          bannerListRef.current?.scrollToIndex({ index: bannerIndexRef.current, animated: false });
          hasInitializedBanner.current = true;
        } catch (e) {}
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [infiniteBanners.length]);

  // Per-banner auto-slide timer respecting exact configured duration
  useEffect(() => {
    if (mainBanners.length <= 1) return;

    const currentBanner = mainBanners[activeBannerDot % mainBanners.length];
    const duration = (currentBanner?.slide_duration_ms && currentBanner.slide_duration_ms >= 1000)
      ? currentBanner.slide_duration_ms
      : 3000;

    const timer = setTimeout(() => {
      if (!bannerListRef.current || infiniteBanners.length === 0) return;

      let nextIndex = bannerIndexRef.current + 1;
      if (nextIndex >= infiniteBanners.length) {
        nextIndex = Math.floor(infiniteBanners.length / 2);
        try {
          bannerListRef.current.scrollToIndex({ index: nextIndex, animated: false });
        } catch {}
      } else {
        try {
          bannerListRef.current.scrollToIndex({ index: nextIndex, animated: true });
        } catch {}
      }

      bannerIndexRef.current = nextIndex;
      setActiveBannerDot(nextIndex % mainBanners.length);
    }, duration);

    return () => clearTimeout(timer);
  }, [activeBannerDot, mainBanners, infiniteBanners.length]);

  const enrichedItems = useMemo(() => {
    if (!menuData?.items) return [];
    const items = menuData.items;
    const offers = menuData.offers || [];

    return items.map((item: any) => {
        let basePrice = item.price_paise;
        let offerDiscountPaise = 0;
        let appliedOffer = null;
        
        for (const offer of offers) {
             const tIds: string[] = Array.isArray(offer.target_ids) ? offer.target_ids : [];
             const itemCat = String(item.category || '').toLowerCase();
             const targetCatNames = [
               offer.target_name,
               ...(offer.target_category_names || []),
               ...(offer.target_category_slugs || []),
             ]
                 .filter(Boolean)
                 .map((c: string) => String(c).trim().toLowerCase());

             const isMatch = offer.target_type === 'all' ||
                             (offer.target_type === 'item' && (tIds.includes(item.id) || offer.target_id === item.id)) ||
                             (offer.target_type === 'category' && (
                                 targetCatNames.includes(itemCat) ||
                                 tIds.some((t: string) => String(t).toLowerCase() === itemCat) ||
                                 String(offer.target_id).toLowerCase() === itemCat
                             )) ||
                             (offer.target_type === 'kitchen' && (tIds.includes(item.kitchen_id) || offer.target_id === item.kitchen_id));
             
             if (isMatch) {
                  let discount = 0;
                  if (offer.discount_type === 'bogo') {
                      // Top-tier standard: BOGO shows full menu price with BOGO badge,
                      // and 50% / free item is granted on 2nd quantity in Cart!
                      appliedOffer = offer;
                  } else if (offer.discount_type === 'flat') {
                      discount = offer.discount_flat_paise || 0;
                      if (discount > offerDiscountPaise) {
                          offerDiscountPaise = discount;
                          appliedOffer = offer;
                      }
                  } else if (offer.discount_type === 'percent' || offer.discount_type === 'percentage') {
                      discount = Math.floor((basePrice * (parseFloat(offer.discount_percent || '0') || 0)) / 100);
                      if (offer.max_discount_paise && discount > offer.max_discount_paise) {
                          discount = offer.max_discount_paise;
                      }
                      if (discount > offerDiscountPaise) {
                          offerDiscountPaise = discount;
                          appliedOffer = offer;
                      }
                  }
             }
        }
        
        return {
           ...item,
           original_price_paise: basePrice,
           price_paise: Math.max(0, basePrice - offerDiscountPaise),
           applied_offer: appliedOffer
        };
    });
  }, [menuData?.items, menuData?.offers]);

  // Animated search placeholder — cycles through menu item names
  const placeholderNames = useMemo(() => {
    const items: any[] = enrichedItems ?? [];
    return items.filter((i: any) => i.available).map((i: any) => i.name as string).slice(0, 12);
  }, [enrichedItems]);

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
        contact_number: user.phone,
      });
      setRequestStep('done');
    } catch (err) {
      setReqError('Failed to submit request. Please try again later.');
    } finally {
      setReqLoading(false);
    }
  };

  // Reserved for meaningful cart-modifying actions (add to cart, qty +/-) — passed down to
  // CatPreviewCard/MenuGridCard, and used directly in handleAddToCart below. Not used for
  // pure navigation/filter taps in this file (those were audited and left haptic-free).
  const triggerHaptic = useCallback(() => haptics.selection(), []);

  const handleAddToCart = useCallback((item: any, customizations: any[], customExtraPaise: number, instructions: string) => {
    const currentCart = cartItemsRef.current;
    if (currentCart.length > 0 && currentCart[0].kitchenId !== item.kitchen_id) {
      showDialog({
        title: 'Different Kitchen',
        message: 'Your cart contains items from another kitchen. Do you want to clear the cart and add this item?',
        type: 'warning',
        cancelText: 'Cancel',
        confirmText: 'Clear & Add',
        destructive: true,
        onConfirm: () => {
          dispatch(clearCart());
          triggerHaptic();
          dispatch(
            addItem({
              menuItemId: item.id,
              name: item.name,
              pricePaise: (item.original_price_paise || item.price_paise) + customExtraPaise,
              quantity: 1,
              photoUrl: item.photo_url,
              isVeg: item.is_veg,
              kitchenId: item.kitchen_id,
              customizations: customizations.length > 0 ? customizations : undefined,
              instructions: instructions || undefined,
            }),
          );
        },
      });
    } else {
      triggerHaptic();
      dispatch(
        addItem({
          menuItemId: item.id,
          name: item.name,
          pricePaise: (item.original_price_paise || item.price_paise) + customExtraPaise,
          quantity: 1,
          photoUrl: item.photo_url,
          isVeg: item.is_veg,
          kitchenId: item.kitchen_id,
          customizations: customizations.length > 0 ? customizations : undefined,
          instructions: instructions || undefined,
        }),
      );
    }
  }, [dispatch, triggerHaptic]); // cartItems removed — read from cartItemsRef.current instead

  const handleAddToCartWithCheck = useCallback((item: any) => {
    let groups: any[] = [];
    if (Array.isArray(item.customization_groups)) {
      groups = item.customization_groups;
    } else if (typeof item.customization_groups === 'string') {
      try {
        const parsed = JSON.parse(item.customization_groups);
        if (Array.isArray(parsed)) groups = parsed;
      } catch {}
    }
    if (groups.length > 0) {
      setActiveCustomizationItem({ ...item, customization_groups: groups });
    } else {
      handleAddToCart(item, [], 0, '');
    }
  }, [handleAddToCart]);


  const sections = useMemo(() => {
    if (!enrichedItems || enrichedItems.length === 0) return [];
    let items = enrichedItems;
    
    if (isVegOnly) items = items.filter((item: any) => item.is_veg);

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
  }, [enrichedItems, selectedCategory, isVegOnly, adminCategories]);

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

  // renderItem is now stable — cart changes are handled inside memoized leaf components
  const renderItem = useCallback(({ item }: { item: any }) => {
    if (item.type === 'category-preview') {
      return (
        <CategoryPreviewSection
          items={item.items}
          kitchenPaused={!!menuData?.kitchenPaused}
          navigation={navigation}
          dispatch={dispatch}
          triggerHaptic={triggerHaptic}
          onAddToCartWithCheck={handleAddToCartWithCheck}
        />
      );
    }
    if (item.type === 'explore-header') return <ExploreMenuBanner />;
    if (item.type === 'section-header') {
      return (
        <View style={styles.categorySectionHeader}>
          <Text allowFontScaling={false} style={styles.categorySectionTitle}>{item.title}</Text>
          <Text allowFontScaling={false} style={styles.categorySectionCount}>{item.count} {item.count === 1 ? 'item' : 'items'}</Text>
        </View>
      );
    }
    return (
      <View style={styles.homeGridRow}>
        <MenuGridCard
          menuItem={item.left}
          kitchenPaused={!!menuData?.kitchenPaused}
          navigation={navigation}
          dispatch={dispatch}
          triggerHaptic={triggerHaptic}
          onAddToCartWithCheck={handleAddToCartWithCheck}
        />
        {item.right
          ? <MenuGridCard
              menuItem={item.right}
              kitchenPaused={!!menuData?.kitchenPaused}
              navigation={navigation}
              dispatch={dispatch}
              triggerHaptic={triggerHaptic}
              onAddToCartWithCheck={handleAddToCartWithCheck}
            />
          : <View style={styles.homeGridCard} />
        }
      </View>
    );
  }, [menuData?.kitchenPaused, handleAddToCartWithCheck, triggerHaptic, dispatch, navigation]);

  const totalCartQty = useMemo(
    () => cartItems.reduce((acc, i) => acc + i.quantity, 0),
    [cartItems],
  );

  const pillBottomAnim = useSharedValue(Math.max(insets.bottom, 16) + 16);
  React.useEffect(() => {
    pillBottomAnim.value = withTiming(totalCartQty > 0 ? Math.max(insets.bottom, 16) + 84 : Math.max(insets.bottom, 16) + 16, { duration: 250 });
  }, [totalCartQty, insets.bottom]);
  
  const safePillStyle = useAnimatedStyle(() => ({
    bottom: pillBottomAnim.value
  }));

  const flatListRef = useRef<any>(null);
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const LOCATION_HEIGHT = 50;
  const LOCATION_MARGIN = 16;
  const BASE_PADDING = Math.max(insets.top + 8, 12) + 128;

  // Snap: when finger lifts mid-collapse, jump to fully open or fully closed
  const snapHeader = useCallback((offsetY: number) => {
    if (offsetY <= 0 || offsetY >= LOCATION_HEIGHT) return;
    const snapTo = offsetY < LOCATION_HEIGHT / 2 ? 0 : LOCATION_HEIGHT;
    flatListRef.current?.scrollToOffset({ offset: snapTo, animated: true });
  }, []);

  const locationRowStyle = useAnimatedStyle(() => {
    const height = interpolate(scrollY.value, [0, LOCATION_HEIGHT], [LOCATION_HEIGHT, 0], 'clamp');
    const opacity = interpolate(scrollY.value, [0, LOCATION_HEIGHT / 2], [1, 0], 'clamp');
    const marginBottom = interpolate(scrollY.value, [0, LOCATION_HEIGHT], [LOCATION_MARGIN, 0], 'clamp');
    return { height, opacity, marginBottom, overflow: 'hidden' };
  });

  const listPaddingStyle = useAnimatedStyle(() => {
    const collapsedAmount = interpolate(scrollY.value, [0, LOCATION_HEIGHT], [0, LOCATION_HEIGHT + LOCATION_MARGIN], 'clamp');
    return { paddingTop: BASE_PADDING - collapsedAmount };
  });

  const headerGlassStyle = useAnimatedStyle(() => {
    const alpha = interpolate(scrollY.value, [0, 50], [1, 0.96], 'clamp');
    const borderAlpha = interpolate(scrollY.value, [0, 50], [0, 0.08], 'clamp');
    return {
      backgroundColor: `rgba(255, 255, 255, ${alpha})`,
      borderBottomWidth: 1,
      borderBottomColor: `rgba(0, 0, 0, ${borderAlpha})`,
    };
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[
        { 
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
          paddingTop: Math.max(insets.top + 8, 12), 
          paddingBottom: 8,
          paddingHorizontal: 12
        },
        headerGlassStyle
      ]}>
        {/* ROW 1: Address and Profile (Animated) */}
        <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, locationRowStyle]}>
          <View style={{ flex: 1, paddingRight: tokens.spacing.lg, alignItems: 'flex-start', justifyContent: 'center' }}>
            <BouncingButton 
              style={{ flexDirection: 'row', alignItems: 'center', maxWidth: '100%' }}
              onPress={() => navigation.navigate('Address')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Delivering to ${location?.addressText || selectedAddress?.address_text || 'Set location'}`}
            >
              <View style={{ width: 40, height: 40, borderRadius: tokens.radii.full, backgroundColor: '#F0FDF4', alignItems: 'center', justifyContent: 'center', marginRight: tokens.spacing.md }}>
                <MapPin size={22} color={tokens.colors.primary} fill={'#FFEDD5'} />
              </View>
              <View style={{ flexShrink: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text allowFontScaling={false} style={{ fontSize: 12, fontFamily: tokens.typography.family.bold, color: tokens.colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Delivering to
                  </Text>
                  <ChevronDown size={14} color={tokens.colors.primary} style={{ marginLeft: 2 }} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                  <Text allowFontScaling={false} style={{ fontSize: 16, fontFamily: tokens.typography.family.extrabold, color: tokens.colors.textPrimary }} numberOfLines={1}>
                    {location?.addressText || selectedAddress?.address_text || 'Set location'}
                  </Text>
                </View>
              </View>
            </BouncingButton>
          </View>

          <BouncingButton
            style={[styles.profileButton, { borderWidth: 2, borderColor: tokens.colors.primary }]}
            onPress={() => navigation.navigate('ProfileTab')}
            accessibilityRole="button"
            accessibilityLabel="Open Profile"
          >
            {user?.photo_url ? (
              <NetworkImage uri={user.photo_url} style={styles.profileImage} fallbackText={user?.name?.[0]?.toUpperCase() || '?'} />
            ) : (
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: tokens.colors.primaryTint, alignItems: 'center', justifyContent: 'center' }}>
                <User size={20} color={tokens.colors.primary} />
              </View>
            )}
          </BouncingButton>
        </Animated.View>

        {/* ROW 2: Search Bar (pure entry point into full-menu Search) with VEG toggle */}
        {!unserviceableLocation && !showNoLocation && !showNetworkError && (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: tokens.colors.surface, // Premium clean surface
            borderRadius: 16,
            height: 48,
            ...tokens.shadows.soft,
          }}>
            {/* Flat, premium search affordance — tapping navigates to the dedicated Search screen */}
            <PressableScale
              onPress={() => navigation.navigate('Search')}
              accessibilityRole="button"
              accessibilityLabel="Search menu"
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                height: '100%',
                paddingLeft: tokens.spacing.lg,
              }}
            >
              <Search size={16} color={tokens.colors.textSecondary} style={{ marginRight: 6, flexShrink: 0 }} />
              <View style={{ flex: 1, height: '100%', flexDirection: 'row', alignItems: 'center', overflow: 'hidden' }} pointerEvents="none">
                <AnimatedSearchPlaceholder names={placeholderNames} />
              </View>
            </PressableScale>

            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              flexShrink: 0,
              paddingRight: 8,
            }}>
              <Text allowFontScaling={false} style={{
                fontSize: 9,
                fontFamily: tokens.typography.family.extrabold,
                color: isVegOnly ? tokens.colors.success : tokens.colors.primary,
                letterSpacing: 0.5,
                marginLeft: 4,
                flexShrink: 0
              }} numberOfLines={1}>
                VEG
              </Text>

              <View style={{
                width: 1,
                height: 16,
                backgroundColor: tokens.colors.border,
                marginHorizontal: 6,
                flexShrink: 0
              }} />

              <CustomVegToggle
                value={isVegOnly}
                onValueChange={(val) => setIsVegOnly(val)}
              />
            </View>
          </View>
        )}
      </Animated.View>

      <AnimatedFlashList
        ref={flatListRef}
        style={{ flex: 1, minHeight: 2 }}
        data={
          unserviceableLocation || showNoLocation || showNetworkError
            ? []
            : listData
        }
        keyExtractor={(item: any) => item.id}
        renderItem={renderItem}
        // @ts-ignore
        estimatedItemSize={250}
        overrideItemLayout={(layout, item: any) => {
          if (item?.type === 'category-preview') {
            layout.size = 280;
          } else if (item?.type === 'explore-header') {
            layout.size = 60;
          } else if (item?.type === 'section-header') {
            layout.size = 50;
          } else if (item?.type === 'item-row') {
            layout.size = 250;
          } else {
            layout.size = 250;
          }
        }}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onScrollEndDrag={(e) => snapHeader(e.nativeEvent.contentOffset.y)}
        onMomentumScrollEnd={(e) => snapHeader(e.nativeEvent.contentOffset.y)}
        contentContainerStyle={[styles.listContent, { paddingTop: Math.max(insets.top + 8, 12) + 128 }]}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor={tokens.colors.primary} 
            colors={[tokens.colors.primary]} 
            progressViewOffset={Math.max(insets.top + 8, 12) + 128}
          />
        }
        ListHeaderComponent={
          <View>
            
            {/* ── Category Strip ── */}
            {!unserviceableLocation && !showNoLocation && !showNetworkError && adminCategories.length > 0 && (
              <View style={styles.categoryStrip}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryStripScroll}>
                  {/* Admin categories */}
                  {adminCategories.map((cat) => {
                    return (
                      <BouncingButton
                        key={cat.id}
                        style={styles.categoryStripItem}
                        onPress={() => navigation.navigate('Category', { categorySlug: cat.slug, categoryName: cat.name, categoryImage: cat.image_url, categoryBannerUrl: cat.banner_url })}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel={`Category ${cat.name}`}
                      >
                        <View style={styles.categoryStripCircle}>
                          {cat.image_url ? (
                            <NetworkImage uri={cat.image_url} style={styles.categoryStripImage} />
                          ) : (
                            <Text allowFontScaling={false} style={{ fontSize: 18 }}>🍴</Text>
                          )}
                        </View>
                        <Text allowFontScaling={false} style={styles.categoryStripLabel} numberOfLines={1}>
                          {cat.name}
                        </Text>
                      </BouncingButton>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* ── Mini Banners (Quick Filters) ── */}
            {!unserviceableLocation && !showNoLocation && !showNetworkError && miniBanners.length > 0 && (
              <View style={styles.miniBannersContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.miniBannersScroll}>
                  {miniBanners.map((banner: any) => (
                    <BouncingButton
                      key={banner.id}
                      activeOpacity={0.8}
                      onPress={() => {
                        if (banner.action_type === 'FILTER_CATEGORY') setSelectedCategory(banner.action_payload);
                      }}
                      style={styles.miniBannerCard}
                      accessibilityRole="button"
                      accessibilityLabel={`Filter by ${banner.title}`}
                    >
                      <BannerMedia
                        imageUrl={banner.image_url}
                        videoUrl={banner.video_url}
                        mediaType={banner.media_type}
                        isActive={isFocused}
                        style={styles.miniBannerImage}
                        borderRadius={20}
                      />
                      <View style={styles.miniBannerOverlay}>
                        <Text allowFontScaling={false} style={styles.miniBannerTitle}>{banner.title}</Text>
                        {banner.subtitle && <Text allowFontScaling={false} style={styles.miniBannerSubtitle} numberOfLines={1}>{banner.subtitle}</Text>}
                      </View>
                    </BouncingButton>
                  ))}
                </ScrollView>
              </View>
            )}

            {menuData?.kitchenPaused && (
              <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.kitchenPausedBanner}>
                <ChefHat size={20} color={tokens.colors.danger} style={styles.pausedIcon} />
                <View style={styles.pausedTextCol}>
                  <Text allowFontScaling={false} style={styles.pausedTitle}>Kitchen is currently paused</Text>
                  <Text allowFontScaling={false} style={styles.pausedReason}>{menuData.pauseReason || 'Taking a short break to catch up on orders.'}</Text>
                </View>
              </Animated.View>
            )}

            {/* ── Active Campaign Deal Banner (Flash Sale, Happy Hour, Special Deal) ── */}
            {!unserviceableLocation && !showNoLocation && !showNetworkError && primaryCampaign && (
              <Animated.View entering={FadeInDown.delay(120).duration(400)}>
                <CampaignBannerCard
                  campaign={primaryCampaign}
                  onPress={() => {
                    flatListRef.current?.scrollToOffset({ offset: 350, animated: true });
                  }}
                />
              </Animated.View>
            )}

            {infiniteBanners.length > 0 && !unserviceableLocation && !showNoLocation && !showNetworkError && (
              <Animated.View entering={FadeInDown.delay(150).duration(400)} style={{ overflow: 'hidden', marginTop: tokens.spacing.sm }}>
                <FlatList
                  ref={bannerListRef}
                  data={infiniteBanners}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(b: any) => b.uniqueId || b.id}
                  snapToInterval={SCREEN_WIDTH}
                  decelerationRate="fast"
                  initialNumToRender={1}
                  windowSize={3}
                  maxToRenderPerBatch={1}
                  removeClippedSubviews={true}
                  contentContainerStyle={{ paddingHorizontal: 0 }}
                  onMomentumScrollEnd={(ev) => {
                    const newIndex = Math.round(ev.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                    bannerIndexRef.current = newIndex;
                    setActiveBannerDot(newIndex % mainBanners.length);
                  }}
                  getItemLayout={(_, index) => ({
                    length: SCREEN_WIDTH,
                    offset: SCREEN_WIDTH * index,
                    index,
                  })}
                  renderItem={({ item: b, index }: any) => {
                    const isSlideActive = isFocused && ((index % (mainBanners.length || 1)) === activeBannerDot);
                    return (
                      <View style={{ width: SCREEN_WIDTH, paddingHorizontal: tokens.spacing.lg }}>
                        <BouncingButton
                          activeOpacity={0.9}
                          onPress={() => {
                            if (b.action_type === 'FILTER_CATEGORY') setSelectedCategory(b.action_payload);
                          }}
                          style={[styles.bannerContainer, { height: 130 }]}
                          accessibilityRole="button"
                          accessibilityLabel={b.title}
                        >
                          <BannerMedia
                            imageUrl={b.image_url}
                            videoUrl={b.video_url}
                            mediaType={b.media_type}
                            isActive={isSlideActive}
                            style={[styles.bannerImage, { borderRadius: 16 }]}
                            borderRadius={16}
                          />
                          <View style={[styles.bannerOverlay, { borderRadius: 16 }]}>
                            <Text allowFontScaling={false} style={styles.bannerTitle} numberOfLines={2}>{b.title}</Text>
                            {b.subtitle && <Text allowFontScaling={false} style={styles.bannerSubtitle} numberOfLines={2}>{b.subtitle}</Text>}
                          </View>
                        </BouncingButton>
                      </View>
                    );
                  }}
                />
                {mainBanners.length > 1 && (
                  <View style={styles.bannerDotsContainer}>
                    {mainBanners.map((_: any, idx: number) => (
                      <View
                        key={idx}
                        style={[
                          styles.bannerDot,
                          idx === activeBannerDot && styles.bannerDotActive,
                        ]}
                      />
                    ))}
                  </View>
                )}
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
                      if (banner.action_type === 'FILTER_CATEGORY') setSelectedCategory(banner.action_payload);
                    }}
                    style={styles.stripBannerCard}
                    accessibilityRole="button"
                    accessibilityLabel={banner.title}
                  >
                    <BannerMedia
                      imageUrl={banner.image_url}
                      videoUrl={banner.video_url}
                      mediaType={banner.media_type}
                      isActive={isFocused}
                      style={styles.stripBannerImage}
                      borderRadius={20}
                    />
                    <View style={styles.stripBannerOverlay}>
                      <Text allowFontScaling={false} style={styles.stripBannerTitle}>{banner.title}</Text>
                      {banner.subtitle && <Text allowFontScaling={false} style={styles.stripBannerSubtitle} numberOfLines={1}>{banner.subtitle}</Text>}
                    </View>
                  </BouncingButton>
                ))}
              </View>
            )}


            {/* ── Book a Table ── */}
            {restaurants.length > 0 && !unserviceableLocation && !showNoLocation && !showNetworkError && (
              <View style={{ marginTop: tokens.spacing.md }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: tokens.spacing.lg, marginBottom: 10 }}>
                  <Text allowFontScaling={false} style={{ fontSize: 17, fontFamily: tokens.typography.family.bold, color: tokens.colors.textPrimary }}>Book a Table</Text>
                  <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={() => navigation.navigate('MyTableBookings')} accessibilityRole="button" accessibilityLabel="My Bookings">
                    <Text allowFontScaling={false} style={{ fontSize: 13, fontFamily: tokens.typography.family.medium, color: tokens.colors.primary }}>My Bookings</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: tokens.spacing.lg, gap: 14 }}>
                  {restaurants.map((rest: any) => {
                    const CARD_W = SCREEN_WIDTH - tokens.spacing.lg * 2;
                    const CARD_H = Math.round(CARD_W * 0.56);
                    const cover = getRestCoverPhoto(rest.photos);
                    const hasSlots = rest.total_tables > 0 && rest.bookings_today < rest.total_tables * 3;
                    return (
                      <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        key={rest.id}
                        style={{ width: CARD_W, borderRadius: 18, overflow: 'hidden', ...tokens.shadows.soft, backgroundColor: '#111' }}
                        activeOpacity={0.88}
                        onPress={() => navigation.navigate('RestaurantDetail', { restaurantId: rest.id })}
                        accessibilityRole="button"
                        accessibilityLabel={`Book table at ${rest.name}`}
                      >
                        <View style={{ width: CARD_W, height: CARD_H }}>
                          {cover ? (
                            <NetworkImage uri={cover} style={{ width: CARD_W, height: CARD_H }} width={CARD_W} height={CARD_H} />
                          ) : (
                            <View style={{ width: CARD_W, height: CARD_H, backgroundColor: tokens.colors.primary + '18', justifyContent: 'center', alignItems: 'center' }}>
                              <UtensilsCrossed size={40} color={tokens.colors.primary + '50'} />
                            </View>
                          )}
                          <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0.70)']}
                            locations={[0.3, 0.6, 1]}
                            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 90, paddingHorizontal: 14, paddingBottom: 14, justifyContent: 'flex-end' }}
                          >
                            <Text allowFontScaling={false} style={{ fontSize: 16, fontFamily: tokens.typography.family.bold, color: tokens.colors.surface, marginBottom: 5 }} numberOfLines={1}>{rest.name}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                              {rest.cuisine_type ? (
                                <Text allowFontScaling={false} style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', fontFamily: tokens.typography.family.regular, flex: 1, marginRight: 8 }} numberOfLines={1}>{rest.cuisine_type}</Text>
                              ) : <View style={{ flex: 1 }} />}
                              <View style={{ backgroundColor: hasSlots ? '#10B981DD' : 'rgba(255,255,255,0.25)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
                                <Text allowFontScaling={false} style={{ fontSize: 11, fontFamily: tokens.typography.family.semibold, color: tokens.colors.surface }}>
                                  {hasSlots ? '● Slots open' : 'Check slots'}
                                </Text>
                              </View>
                            </View>
                          </LinearGradient>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {!unserviceableLocation && !showNoLocation && !showNetworkError && <View style={styles.headerSpacer} />}
          </View>
        }
        ListEmptyComponent={
          isServiceabilityChecking || (isLoading && !(menuData as any)?.items) ? (
            <SkeletonHomeScreen />
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
              <Text allowFontScaling={false} style={styles.comingSoonHeading}>Enable Location</Text>
              <Text allowFontScaling={false} style={styles.comingSoonSub}>
                Allow location access so we can detect your zone instantly, or pick an address manually.
              </Text>
              <BouncingButton style={styles.ctaPrimary} onPress={() => navigation.navigate('Address')} accessibilityRole="button" accessibilityLabel="Select Delivery Address">
                <Text allowFontScaling={false} style={styles.ctaPrimaryText}>Select Delivery Address</Text>
              </BouncingButton>
            </Animated.View>
          ) : showNetworkError ? (
            /* ── Network error ── */
            <Animated.View entering={FadeInDown.duration(400)} style={styles.unserviceableWrap}>
              <View style={styles.foodCarousel}>
                <View style={[styles.foodCardDeco, styles.foodCardLeft]}><ChefHat size={32} color={tokens.colors.textTertiary} /></View>
                <View style={[styles.foodCardDeco, styles.foodCardCenter]}><ChefHat size={44} color={tokens.colors.textSecondary} /></View>
                <View style={[styles.foodCardDeco, styles.foodCardRight]}><ChefHat size={32} color={tokens.colors.textTertiary} /></View>
              </View>
              <Text allowFontScaling={false} style={styles.comingSoonHeading}>Connection Issue</Text>
              <Text allowFontScaling={false} style={styles.comingSoonSub}>
                Couldn't verify your delivery area. Check your connection, then retry or change address.
              </Text>
              <BouncingButton style={styles.ctaPrimary} onPress={retryZoneCheck} disabled={retrying} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Retry or Change Address">
                {retrying
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text allowFontScaling={false} style={styles.ctaPrimaryText}>Retry / Change Address</Text>}
              </BouncingButton>
            </Animated.View>
          ) : unserviceableLocation ? (
            /* ── Out of zone — full screen like reference ── */
            <Animated.View entering={FadeInDown.duration(400)} style={styles.unserviceableWrap}>
              {requestStep === 'done' ? (
                <View style={styles.reqDoneCard}>
                  <Text allowFontScaling={false} style={styles.reqDoneTitle}>You're on the list!</Text>
                  <Text allowFontScaling={false} style={styles.reqDoneSub}>We'll notify you the day we launch in {reqForm.area_name || 'your area'}!</Text>
                  <BouncingButton style={styles.ctaOutline} onPress={() => setRequestStep('info')} accessibilityRole="button" accessibilityLabel="Go Back">
                    <Text allowFontScaling={false} style={styles.ctaOutlineText}>Back</Text>
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
                        <MapPin size={16} color={tokens.colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text allowFontScaling={false} style={styles.reqFormTitle}>Bring 2QT to your area</Text>
                        <Text allowFontScaling={false} style={styles.reqFormSub}>Tell us where you are — we'll expand there next.</Text>
                      </View>
                    </View>

                    {/* Area input */}
                    <View style={styles.reqInputRow}>
                      <MapPin size={15} color={tokens.colors.textTertiary} />
                      <TextInput
                        style={styles.reqInputField}
                        placeholder="Your area or locality"
                        value={reqForm.area_name}
                        onChangeText={(t) => setReqForm(p => ({ ...p, area_name: t }))}
                        placeholderTextColor={tokens.colors.textTertiary}
                      />
                    </View>

                    {/* Pincode input */}
                    <View style={styles.reqInputRow}>
                      <Text allowFontScaling={false} style={styles.reqPinHash}>#</Text>
                      <TextInput
                        style={styles.reqInputField}
                        placeholder="6-digit pincode"
                        keyboardType="numeric"
                        maxLength={6}
                        value={reqForm.pincode}
                        onChangeText={(t) => setReqForm(p => ({ ...p, pincode: t.replace(/\D/g, '') }))}
                        placeholderTextColor={tokens.colors.textTertiary}
                      />
                    </View>

                    {!!reqError && <Text allowFontScaling={false} style={styles.reqErrorText}>{reqError}</Text>}

                    <BouncingButton style={styles.reqSubmitBtn} onPress={handleRequestService} disabled={reqLoading} accessibilityRole="button" accessibilityLabel="Submit Request">
                      {reqLoading
                        ? <ActivityIndicator color={tokens.colors.surface} />
                        : <Text allowFontScaling={false} style={styles.reqSubmitBtnText}>Submit Request</Text>}
                    </BouncingButton>

                    <BouncingButton style={styles.reqCancelLink} onPress={() => setRequestStep('info')} accessibilityRole="button" accessibilityLabel="Cancel Request">
                      <Text allowFontScaling={false} style={styles.reqCancelLinkText}>Cancel</Text>
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
                  <Text allowFontScaling={false} style={styles.comingSoonHeading}>COMING SOON TO{"\n"}YOUR DOORSTEP</Text>
                  <Text allowFontScaling={false} style={styles.comingSoonSub}>
                    {location?.addressText
                      ? `We're not serving ${location.addressText} yet — but we're growing fast!`
                      : "We're not in your area yet, but we're expanding fast!"}
                  </Text>

                  {/* We're Live in */}
                  {liveZones.length > 0 && (
                    <View style={styles.liveInSection}>
                      <Text allowFontScaling={false} style={styles.liveInTitle}>We're Live in</Text>
                      <View style={styles.liveZonesRow}>
                        {liveZones.map((z: any, i: number) => (
                          <React.Fragment key={z.id}>
                            <Text allowFontScaling={false} style={styles.liveZoneName}>{z.name}</Text>
                            {i < liveZones.length - 1 && <Text allowFontScaling={false} style={styles.liveZoneDot}> • </Text>}
                          </React.Fragment>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* CTAs */}
                  <BouncingButton style={styles.ctaPrimary} onPress={() => navigation.navigate('Address')} activeOpacity={0.9} accessibilityRole="button" accessibilityLabel="Change Address">
                    <Text allowFontScaling={false} style={styles.ctaPrimaryText}>Change Address</Text>
                  </BouncingButton>
                  <BouncingButton style={styles.ctaOutline} onPress={() => setRequestStep('form')} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Request Service in My Area">
                    <Text allowFontScaling={false} style={styles.ctaOutlineText}>Request Service in My Area</Text>
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
              icon={<PackageOpen size={32} color={tokens.colors.primary} />}
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
          exiting={FadeOutDown.duration(200)}
          style={[
            styles.floatingCartContainer,
            { bottom: Math.max(insets.bottom, 16) + 8 },
          ]}
        >
          <BouncingButton
            style={styles.floatingCartButton}
            activeOpacity={0.9}
            onPress={() => navigation.navigate('Cart')}
          >
            <View style={styles.cartLeftRow}>
              <Text allowFontScaling={false} style={styles.cartItemCount}>{totalCartQty} {totalCartQty === 1 ? 'ITEM' : 'ITEMS'}</Text>
              <Text allowFontScaling={false} style={styles.cartTotalText}>  ₹{cartTotal / 100}</Text>
            </View>
            <View style={styles.viewCartAction}>
              <Text allowFontScaling={false} style={styles.viewCartText}>View Cart</Text>
              <ShoppingBag size={16} color={tokens.colors.surface} style={{ marginLeft: 6 }} />
            </View>
          </BouncingButton>
        </Animated.View>
      )}

      {primaryActiveOrder && (
        <Animated.View entering={FadeInDown.duration(300)} style={[
          styles.activeOrderPillContainer,
          safePillStyle
        ]}>
          <BouncingButton
            activeOpacity={0.8}
            onPress={() => {
              if (activeOrders.length > 1) {
                setShowActiveOrdersModal(true);
              } else {
                navigation.navigate('OrderConfirmed', { orderId: primaryActiveOrder.id });
              }
            }}
            style={styles.activeOrderPill}
          >
            <View style={styles.activeOrderIconContainer}>
              <View style={styles.activeOrderDotBase}>
                <Animated.View style={[styles.activeOrderDotPulse, liveDotStyle]} />
              </View>
              {activeOrders.length > 1 ? (
                <ShoppingBag size={16} color="#34D399" style={{ marginLeft: 6 }} />
              ) : primaryActiveOrder.status === 'out_for_delivery' ? (
                <Bike size={16} color="#34D399" style={{ marginLeft: 6 }} />
              ) : (
                <ChefHat size={16} color="#FBBF24" style={{ marginLeft: 6 }} />
              )}
            </View>
            <View style={styles.activeOrderTextContainer}>
              <Text allowFontScaling={false} style={styles.activeOrderTitle}>
                {activeOrders.length > 1 ? `${activeOrders.length} Active Orders` :
                 primaryActiveOrder.status === 'pending_payment' ? 'Payment Pending' :
                 primaryActiveOrder.status === 'placed' ? 'Order Placed' :
                 primaryActiveOrder.status === 'accepted' ? 'Preparing food' :
                 primaryActiveOrder.status === 'preparing' ? 'Preparing food' :
                 primaryActiveOrder.status === 'ready' ? 'Ready for pickup' :
                 primaryActiveOrder.status === 'out_for_delivery' ? 'Arriving soon' : 'Active Order'}
              </Text>
              <Text allowFontScaling={false} style={styles.activeOrderSubtitle}>
                {activeOrders.length > 1 ? 'View all orders' :
                 primaryActiveOrder.status === 'pending_payment' ? 'Tap to complete payment' : 'View live tracking'}
              </Text>
            </View>
            <View style={styles.activeOrderArrow}>
              <ArrowRight size={16} color="#9CA3AF" />
            </View>
          </BouncingButton>
        </Animated.View>
      )}

      {activeOrders.length > 1 && (
        <ActiveOrdersBottomSheet
          visible={showActiveOrdersModal}
          orders={activeOrders}
          onClose={() => setShowActiveOrdersModal(false)}
          onSelectOrder={(orderId) => {
            navigation.navigate('OrderConfirmed', { orderId });
          }}
        />
      )}

      {!!effectiveZoneId && !isLoading && !!menuData && !closedSheetDismissed &&
        (!isKitchenOpen(menuData?.openingTime, menuData?.closingTime) || menuData?.kitchenPaused) && (
        <ClosedBottomSheet
          openingTime={menuData.openingTime}
          paused={menuData.kitchenPaused}
          pauseReason={menuData.pauseReason}
          pauseUntil={menuData.pauseUntil}
          kitchenId={menuData.kitchenId}
          onDismiss={() => setClosedSheetDismissed(true)}
        />
      )}
      
      <CustomizationBottomSheet 
        visible={!!activeCustomizationItem}
        onClose={() => setActiveCustomizationItem(null)}
        item={activeCustomizationItem}
        onAddToCart={(customizations, instructions) => {
          if (activeCustomizationItem) {
            handleAddToCart(activeCustomizationItem, customizations, 0, instructions);
          }
        }}
      />
    </View>
  );
};






export default HomeScreen;
// v2
