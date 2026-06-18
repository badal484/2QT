import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, StyleSheet, TextInput, Switch, FlatList, Dimensions, ActivityIndicator, Image } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RootState } from '../store';
import { api } from '../api/client';
import { getSocket } from '../socket/client';
import { addItem, setQuantity, setZone } from '../store/slices/cartSlice';
import { MapPin, Search, PackageOpen, ChefHat, ChevronDown, ShoppingBag, User } from 'lucide-react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';
import { NetworkImage } from '../components/NetworkImage';
import { EmptyState, SkeletonRow } from '../components/ui';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import { radius, spacing } from '../theme/spacing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const [isVegOnly, setIsVegOnly] = useState(false);

  // Zone resolution:
  //   • If user picked a delivery address → use its validated zone (trust AddressScreen)
  //   • Otherwise → use the GPS-verified zone from AppBootManager / foreground recheck
  // NOTE: user?.zoneId is intentionally excluded — it's a stale login-time value and
  //       would cause menus to appear even when the user is outside the delivery area.
  const effectiveZoneId = addressId ? zoneId : activeZoneId;

  // Serviceability derived flags (only meaningful when no saved address is selected)
  const isServiceabilityChecking =
    !addressId && (serviceabilityStatus === 'idle' || serviceabilityStatus === 'checking');
  const unserviceableLocation = !addressId && serviceabilityStatus === 'unserviceable';
  const showNoLocation = !addressId && serviceabilityStatus === 'no_location';
  const showNetworkError = !addressId && serviceabilityStatus === 'network_error';
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

  useEffect(() => {
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

  const { data: menuData, isLoading } = useQuery({
    queryKey: ['menu', effectiveZoneId],
    queryFn: () => api.get(`/menu?zoneId=${effectiveZoneId}`),
    enabled: !!effectiveZoneId,
  });

  const { data: bannersData } = useQuery({
    queryKey: ['banners'],
    queryFn: () => api.get('/banners'),
  });
  const banners = bannersData?.banners || [];

  const { data: zonesData } = useQuery({
    queryKey: ['zones'],
    queryFn: () => api.get('/menu/zones'),
    staleTime: 5 * 60 * 1000,
  });
  const liveZones: any[] = zonesData?.zones || [];

  const { data: addresses } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => api.get('/customers/addresses'),
    enabled: !!user,
  });

  const selectedAddress = addresses?.addresses?.find((a: any) => a.id === addressId);

  // GPS is the primary zone source on launch — do NOT auto-select saved addresses here.
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

  const categories = useMemo(
    () => ['All', ...new Set((menuData?.items || []).map((item: any) => item.category))],
    [menuData?.items],
  );

  const filteredItems = useMemo(() => {
    if (!menuData?.items) return [];
    return menuData.items.filter((item: any) => {
      if (selectedCategory !== 'All' && item.category !== selectedCategory) return false;
      if (isVegOnly && !item.is_veg) return false;
      if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [menuData?.items, selectedCategory, isVegOnly, searchQuery]);

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
      <View style={[styles.minimalHeader, { paddingTop: Math.max(insets.top + spacing.md, 50) }]}>
        {/* ── Logo row ─────────────────────────────────────────── */}
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.logoText}>2QT<Text style={styles.logoDot}>.</Text></Text>
            <View style={styles.deliveryTagRow}>
              <Text style={styles.deliveryTagIcon}>⚡</Text>
              <Text style={styles.deliveryTagText}>15-MIN DELIVERY</Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            {/* Address pill */}
            <TouchableOpacity
              style={styles.addressPill}
              onPress={() => { triggerHaptic(); navigation.navigate('Address'); }}
            >
              <MapPin size={12} color={unserviceableLocation || showNoLocation ? colors.danger : colors.primary} />
              <Text style={[styles.addressPillText, (unserviceableLocation || showNoLocation) && { color: colors.danger }]} numberOfLines={1}>
                {addressId
                  ? selectedAddress?.label || selectedAddress?.address_text?.split(',')[0] || 'Home'
                  : (location?.addressText?.split(',')[0] || 'Set location')}
              </Text>
              <ChevronDown size={12} color={colors.inkMuted} />
            </TouchableOpacity>

            {/* Profile */}
            <TouchableOpacity
              style={styles.profileButton}
              onPress={() => { triggerHaptic(); navigation.navigate('ProfileTab'); }}
            >
              {user?.photo_url ? (
                <NetworkImage uri={user.photo_url} style={styles.profileImage} fallbackText={user?.name?.[0]?.toUpperCase() || '?'} />
              ) : (
                <User size={18} color={colors.primary} />
              )}
            </TouchableOpacity>

            {/* Cart badge */}
            <TouchableOpacity
              style={styles.cartBadgeBtn}
              onPress={() => { triggerHaptic(); navigation.navigate('Cart'); }}
            >
              <Text style={styles.cartBadgeNum}>{totalCartQty || 0}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Banner + Search — hidden when zone is unserviceable/unknown */}
        {!unserviceableLocation && !showNoLocation && !showNetworkError && (
          <Animated.View entering={FadeInDown.duration(400)}>
            <TouchableOpacity
              style={styles.liveKitchenBanner}
              onPress={() => {
                triggerHaptic();
                navigation.navigate('LiveKitchen');
              }}
              activeOpacity={0.9}
            >
              <View style={styles.liveDotWrapper}>
                <Animated.View style={[styles.liveDot, liveDotStyle]} />
                <View style={styles.liveDotCore} />
              </View>
              <View style={styles.liveKitchenTextCol}>
                <Text style={styles.liveKitchenText}>LIVE FROM</Text>
                <Text style={styles.liveKitchenTitle}>{menuData?.kitchenName || '2QT Kitchen'}{menuData?.zoneName ? ` • ${menuData.zoneName}` : ''}</Text>
              </View>
              <View style={styles.deliveryTimeBadge}>
                <Text style={styles.deliveryTimeText}>10-15</Text>
                <Text style={styles.deliveryTimeSub}>MINS</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        )}

        {!unserviceableLocation && !showNoLocation && !showNetworkError && (
          <View style={styles.searchBarContainer}>
            <Search size={20} color={colors.primary} style={styles.searchIcon} />
            <TextInput
              placeholder="Search for a craving..."
              placeholderTextColor={colors.inkFaint}
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <View style={styles.vegToggleContainer}>
              <View style={styles.vegToggleWrapper}>
                <Text style={[styles.vegText, isVegOnly && styles.vegTextActive]}>VEG</Text>
                <Switch
                  value={isVegOnly}
                  onValueChange={(val) => {
                    triggerHaptic();
                    setIsVegOnly(val);
                  }}
                  trackColor={{ false: colors.border, true: colors.primaryTint }}
                  thumbColor={isVegOnly ? colors.primary : colors.white}
                  style={styles.vegSwitch}
                />
              </View>
            </View>
          </View>
        )}
      </View>

      <FlatList
        data={
          isServiceabilityChecking || unserviceableLocation || showNoLocation || showNetworkError
            ? []
            : filteredItems
        }
        keyExtractor={(item: any) => item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        removeClippedSubviews
        windowSize={5}
        maxToRenderPerBatch={5}
        initialNumToRender={6}
        ListHeaderComponent={
          <View>
            {menuData?.kitchenPaused && (
              <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.kitchenPausedBanner}>
                <ChefHat size={20} color={colors.danger} style={styles.pausedIcon} />
                <View style={styles.pausedTextCol}>
                  <Text style={styles.pausedTitle}>Kitchen is currently paused</Text>
                  <Text style={styles.pausedReason}>{menuData.pauseReason || 'Taking a short break to catch up on orders.'}</Text>
                </View>
              </Animated.View>
            )}
            {banners.length > 0 && !unserviceableLocation && !showNoLocation && !showNetworkError && !isServiceabilityChecking && (
              <Animated.View entering={FadeInDown.delay(150).duration(400)}>
                <FlatList
                  data={banners}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(b: any) => b.id}
                  snapToInterval={SCREEN_WIDTH - spacing.lg * 2 + spacing.sm}
                  decelerationRate="fast"
                  contentContainerStyle={styles.bannersList}
                  renderItem={({ item: b }: any) => (
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => {
                        triggerHaptic();
                        if (b.action_type === 'FILTER_CATEGORY') setSelectedCategory(b.action_payload);
                      }}
                      style={styles.bannerContainer}
                    >
                      <NetworkImage uri={b.image_url} style={styles.bannerImage} />
                      <View style={styles.bannerOverlay}>
                        {b.tag_text && (
                          <View style={styles.bannerTag}>
                            <Text style={styles.bannerTagText}>{b.tag_text}</Text>
                          </View>
                        )}
                        <Text style={styles.bannerTitle}>{b.title}</Text>
                        {b.subtitle && <Text style={styles.bannerSubtitle} numberOfLines={1}>{b.subtitle}</Text>}
                      </View>
                    </TouchableOpacity>
                  )}
                />
              </Animated.View>
            )}
            {!isLoading && categories.length > 1 && !unserviceableLocation && !showNoLocation && !showNetworkError && !isServiceabilityChecking && (
              <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.mindContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mindScroll}>
                  {categories.map((cat: any) => (
                    <CategoryPill
                      key={cat}
                      name={cat}
                      isSelected={selectedCategory === cat}
                      onPress={() => {
                        triggerHaptic();
                        setSelectedCategory(cat);
                      }}
                    />
                  ))}
                </ScrollView>
              </Animated.View>
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
                    <View style={[styles.foodCardDeco, styles.foodCardLeft]}><ChefHat size={32} color={colors.inkFaint} /></View>
                    <View style={[styles.foodCardDeco, styles.foodCardCenter]}><ChefHat size={44} color={colors.primary} /></View>
                    <View style={[styles.foodCardDeco, styles.foodCardRight]}><ChefHat size={32} color={colors.inkFaint} /></View>
                  </View>

                  {/* Heading */}
                  <Text style={styles.comingSoonLabel}>COMING SOON</Text>
                  <Text style={styles.comingSoonHeading}>To Your{'\n'}Doorstep</Text>
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
                  <TouchableOpacity style={styles.ctaPrimary} onPress={() => { triggerHaptic(); navigation.navigate('Address'); }}>
                    <Text style={styles.ctaPrimaryText}>Change Address</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.ctaOutline} onPress={() => { triggerHaptic(); setRequestStep('form'); }}>
                    <Text style={styles.ctaOutlineText}>Request Service in My Area</Text>
                  </TouchableOpacity>
                </>
              )}
            </Animated.View>
          ) : (
            <EmptyState
              icon={<PackageOpen size={32} color={colors.primary} />}
              title="Nothing found"
              subtitle="Try changing your search or filters."
            />
          )
        }
      />

      {cartItems.length > 0 && (
        <Animated.View
          entering={FadeInDown.duration(300)}
          exiting={FadeInDown.duration(200).delay(0)}
          style={[
            styles.floatingCartContainer,
            // insets.bottom covers gesture-nav area; fallback 16 keeps bar above any nav overlay
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
    </View>
  );
};

const CategoryPill = React.memo(({ name, isSelected, onPress }: any) => {
  return (
    <TouchableOpacity style={[styles.categoryPill, isSelected && styles.categoryPillActive]} onPress={onPress}>
      <Text style={[styles.categoryPillText, isSelected && styles.categoryPillTextActive]}>{name}</Text>
    </TouchableOpacity>
  );
});

const ModernItemCard = React.memo(({ item, cartItem, onAdd, onUpdate, onPress, kitchenPaused }: any) => {
  const vegColor = item.is_veg ? '#22C55E' : colors.danger;

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.92} onPress={onPress}>
      {/* Left: text */}
      <View style={styles.cardLeft}>
        <View style={[styles.vegBadge, { borderColor: vegColor }]}>
          <View style={[styles.vegDot, { backgroundColor: vegColor }]} />
        </View>
        <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.cardPrice}>₹{item.price_paise / 100}</Text>
        <Text style={styles.cardDesc} numberOfLines={2}>
          {item.description || 'Fresh and delicious.'}
        </Text>
      </View>

      {/* Right: image + ADD/qty pinned to its bottom */}
      <View style={styles.cardRight}>
        <View style={styles.cardImageWrapper}>
          {item.photo_url ? (
            <NetworkImage uri={item.photo_url} style={styles.cardImage} />
          ) : (
            <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
              <ChefHat size={28} color={colors.inkFaint} />
            </View>
          )}
          {(!item.available || kitchenPaused) && (
            <View style={styles.soldOutOverlay}>
              <Text style={styles.soldOutText}>Sold Out</Text>
            </View>
          )}
        </View>

        <View style={styles.cardQtyRow}>
          {cartItem ? (
            <View style={styles.qtyControl}>
              <TouchableOpacity onPress={() => onUpdate(cartItem.quantity - 1)} style={styles.qtyBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}>
                <Text style={styles.qtyBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.qtyValue}>{cartItem.quantity}</Text>
              <TouchableOpacity onPress={() => onUpdate(cartItem.quantity + 1)} style={styles.qtyBtn} hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}>
                <Text style={styles.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.addBtn, (!item.available || kitchenPaused) && styles.addBtnDisabled]}
              disabled={!item.available || kitchenPaused}
              onPress={onAdd}
            >
              <Text style={styles.addBtnText}>ADD</Text>
            </TouchableOpacity>
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

  // ── New card layout ─────────────────────────────────────────────────────
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  cardLeft: { flex: 1, padding: 14, justifyContent: 'center' },
  vegBadge: {
    width: 16, height: 16, borderWidth: 1.5, borderRadius: 3,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  vegDot: { width: 7, height: 7, borderRadius: 4 },
  cardName: { fontSize: 15, fontFamily: fontFamily.bold, color: colors.ink, marginBottom: 4, lineHeight: 20 },
  cardPrice: { fontSize: 14, fontFamily: fontFamily.extrabold, color: colors.ink, marginBottom: 4 },
  cardDesc: { fontSize: 12, color: colors.inkMuted, fontFamily: fontFamily.medium, lineHeight: 16 },
  cardRight: { width: 126, justifyContent: 'flex-end' },
  cardImageWrapper: { width: 126, height: 126, overflow: 'hidden' },
  cardImage: { width: '100%', height: '100%' },
  cardImagePlaceholder: { backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  cardQtyRow: { padding: 8, backgroundColor: colors.surface },
  qtyControl: {
    flexDirection: 'row', backgroundColor: colors.accent, borderRadius: 10,
    alignItems: 'center', justifyContent: 'space-between', height: 36,
  },
  qtyBtn: { width: 32, height: 36, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { color: colors.white, fontSize: 20, fontFamily: fontFamily.bold },
  qtyValue: { color: colors.white, fontSize: 14, fontFamily: fontFamily.extrabold },
  addBtn: {
    backgroundColor: colors.accent, borderRadius: 10,
    paddingVertical: 8, alignItems: 'center',
  },
  addBtnDisabled: { backgroundColor: colors.surfaceMuted },
  addBtnText: { color: colors.white, fontFamily: fontFamily.extrabold, fontSize: 13, letterSpacing: 0.5 },

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

  listContent: { paddingBottom: 200 },
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
    width: SCREEN_WIDTH - spacing.lg * 2,
    height: 160,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.ink,
  },
  bannerImage: { width: '100%', height: '100%', opacity: 0.6 },
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
  comingSoonLabel: {
    fontSize: 11,
    fontFamily: fontFamily.extrabold,
    color: colors.inkFaint,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  comingSoonHeading: {
    fontSize: 36,
    fontFamily: fontFamily.black,
    color: colors.ink,
    textAlign: 'center',
    letterSpacing: -1,
    lineHeight: 42,
    marginBottom: spacing.lg,
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
});

export default HomeScreen;
// v2
