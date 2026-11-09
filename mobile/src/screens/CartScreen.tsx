import { tokens } from '../theme/tokens';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { isKitchenOpen, formatTime12h } from '../utils/kitchenHours';
import {
  View, Text, ScrollView, TextInput, Image,
  ActivityIndicator, Alert, StyleSheet, TouchableOpacity, Modal,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, interpolateColor, FadeIn, FadeInDown, SlideInDown } from 'react-native-reanimated';
import { useSelector, useDispatch } from 'react-redux';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { RootState } from '../store';
import { api } from '../api/client';
import { setQuantity, clearCart, setPromoCode as setPromoCodeAction, addItem as addItemAction } from '../store/slices/cartSlice';
import { getSocket } from '../socket/client';
import { MapPin, ShoppingCart, X, ChefHat, Tag, Star, Wallet, UserRound, Phone, CheckCircle2, Heart, Clock, Zap, ArrowLeft, Sparkles, AlertCircle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptics } from '../utils/haptics';
import { PressableScale } from '../components/ui/internal/PressableScale';
import { useFeedback } from '../context/FeedbackContext';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

const ACCENT = tokens.colors.primary;
const BG = tokens.colors.background;

// ── Custom cross-platform toggle ──────────────────────────────────────────────
const Toggle = ({ value, onValueChange, activeColor = ACCENT, accessibilityLabel }: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  activeColor?: string;
  accessibilityLabel?: string;
}) => {
  const progress = useSharedValue(value ? 1 : 0);

  React.useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: 200 });
  }, [value]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [tokens.colors.borderStrong, activeColor]),
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withTiming(value ? 20 : 2, { duration: 200 }) }],
  }));

  return (
    <PressableScale 
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={[toggleStyles.track, trackStyle]}>
        <Animated.View style={[toggleStyles.thumb, thumbStyle]} />
      </Animated.View>
    </PressableScale>
  );
};

const toggleStyles = StyleSheet.create({
  track: {
    width: 44, height: 26, borderRadius: 13,
    justifyContent: 'center',
  },
  thumb: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: tokens.colors.surface,
    shadowColor: tokens.shadows.soft.shadowColor, shadowOpacity: 0.08, shadowRadius: 16,
    shadowOffset: { width: 0, height: 1 }, elevation: 4,
  },
});

const CartItem = React.memo(({ item, isLast, bogoOffer }: { item: any; isLast: boolean; bogoOffer?: any }) => {
  const dispatch = useDispatch();
  const isOddBogo = !!bogoOffer && (item.quantity % 2 !== 0);
  const isEvenBogo = !!bogoOffer && (item.quantity >= 2);
  const freeItemsCount = isEvenBogo ? Math.floor(item.quantity / 2) : 0;

  return (
    <View>
      <View style={styles.itemRow}>
        <View style={styles.itemImgBox}>
          {item.photoUrl ? (
            <FastImage source={{ uri: item.photoUrl, priority: FastImage.priority.normal }} style={styles.itemImg} resizeMode={FastImage.resizeMode.cover} />
          ) : (
            <View style={[styles.itemImg, styles.itemImgPlaceholder]}>
              <ChefHat size={22} color={tokens.colors.textTertiary} />
            </View>
          )}
        </View>
        <View style={styles.itemMeta}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
            <View style={[styles.vegBadgeMini, { borderColor: item.isVeg ? tokens.colors.success : tokens.colors.danger }]}>
              <View style={[styles.vegDotMini, { backgroundColor: item.isVeg ? tokens.colors.success : tokens.colors.danger }]} />
            </View>
            <Text allowFontScaling={false} style={styles.itemName} numberOfLines={1}>{item.name}</Text>
          </View>
          {item.customizations && item.customizations.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4, marginBottom: 6 }}>
              {item.customizations.map((c: any, idx: number) => (
                <View key={idx} style={{
                  flexDirection: 'row', alignItems: 'center', flexShrink: 1,
                  backgroundColor: tokens.colors.background, borderWidth: 1, borderColor: tokens.colors.border,
                  borderRadius: 8, padding: 4, paddingRight: 8,
                }}>
                  {!!c.photo_url && (
                    <FastImage source={{ uri: c.photo_url, priority: FastImage.priority.low }} style={{ width: 18, height: 18, borderRadius: 4, marginRight: 6, backgroundColor: tokens.colors.background }} resizeMode={FastImage.resizeMode.cover} />
                  )}
                  <Text allowFontScaling={false} style={{ fontSize: 10, fontFamily: tokens.typography.family.medium, color: tokens.colors.textSecondary, flexShrink: 1 }} numberOfLines={1}>
                    {c.group}: <Text allowFontScaling={false} style={{ fontFamily: tokens.typography.family.medium, color: tokens.colors.textPrimary }}>{c.option}</Text>
                  </Text>
                </View>
              ))}
            </View>
          )}
          <Text allowFontScaling={false} style={styles.itemPrice}>₹{item.pricePaise / 100}</Text>
        </View>
        <View style={styles.qtyRow}>
          <TouchableOpacity
            style={styles.qtyBtn}
            activeOpacity={0.6}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 6 }}
            onPress={() => { haptics.selection(); dispatch(setQuantity({ cartItemId: item.cartItemId, menuItemId: item.menuItemId, quantity: item.quantity - 1 })); }}
            accessibilityRole="button"
            accessibilityLabel="Decrease quantity"
          >
            <Text allowFontScaling={false} style={styles.qtyBtnText}>−</Text>
          </TouchableOpacity>
          <Text allowFontScaling={false} style={styles.qtyNum}>{item.quantity}</Text>
          <TouchableOpacity
            style={[styles.qtyBtn, styles.qtyBtnActive]}
            activeOpacity={0.6}
            hitSlop={{ top: 10, bottom: 10, left: 6, right: 10 }}
            onPress={() => { haptics.selection(); dispatch(setQuantity({ cartItemId: item.cartItemId, menuItemId: item.menuItemId, quantity: item.quantity + 1 })); }}
            accessibilityRole="button"
            accessibilityLabel="Increase quantity"
          >
            <Text allowFontScaling={false} style={[styles.qtyBtnText, styles.qtyBtnActiveText]}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* BOGO Upsell Nudge if quantity is odd */}
      {isOddBogo && (
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#FEF3C7',
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 8,
          marginTop: 6,
          marginBottom: 4,
          borderWidth: 1,
          borderColor: '#FDE68A',
        }}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text allowFontScaling={false} style={{ fontSize: 11, fontFamily: tokens.typography.family.extrabold, color: '#B45309' }}>
              🎁 BUY 1 GET 1 FREE
            </Text>
            <Text allowFontScaling={false} style={{ fontSize: 11, fontFamily: tokens.typography.family.medium, color: '#92400E' }}>
              Add 1 more to get 1 FREE!
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              haptics.selection();
              dispatch(setQuantity({ cartItemId: item.cartItemId, menuItemId: item.menuItemId, quantity: item.quantity + 1 }));
            }}
            style={{
              backgroundColor: '#D97706',
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 6,
            }}
            activeOpacity={0.8}
          >
            <Text allowFontScaling={false} style={{ fontSize: 11, fontFamily: tokens.typography.family.extrabold, color: '#FFF' }}>
              + Add Free
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* BOGO Unlocked Banner if 2+ items */}
      {isEvenBogo && (
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          backgroundColor: '#ECFDF5',
          borderRadius: 8,
          paddingHorizontal: 10,
          paddingVertical: 6,
          marginTop: 6,
          marginBottom: 4,
          borderWidth: 1,
          borderColor: '#A7F3D0',
        }}>
          <Sparkles size={13} color="#059669" />
          <Text allowFontScaling={false} style={{ fontSize: 11, fontFamily: tokens.typography.family.extrabold, color: '#047857' }}>
            🎉 {freeItemsCount} × FREE Item Unlocked (BOGO)!
          </Text>
        </View>
      )}

      {!isLast && <View style={styles.cardDivider} />}
    </View>
  );
});

// Custom comparator to prevent thrashing
CartItem.displayName = 'CartItem';
const CartItemMemoized = React.memo(CartItem, (prevProps, nextProps) => {
  return prevProps.item.quantity === nextProps.item.quantity &&
         prevProps.isLast === nextProps.isLast &&
         prevProps.bogoOffer?.id === nextProps.bogoOffer?.id;
});

const CartScreen = ({ navigation }: any) => {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { showDialog, showToast } = useFeedback();
  const { isOnline } = useNetworkStatus();
  
  const { items, addressId, zoneId } = useSelector((state: RootState) => state.cart);
  const activeZoneId = useSelector((state: any) => state.app.activeZoneId);
  const effectiveZoneId = zoneId || activeZoneId;

  const [promoCode, setPromoCode] = useState('');
  const [appliedPromoCode, setAppliedPromoCode] = useState('');
  const [promoError, setPromoError] = useState('');
  const [riderTip, setRiderTip] = useState<number>(0);
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [altReceiver, setAltReceiver] = useState(false);
  const [altName, setAltName] = useState('');
  const [altPhone, setAltPhone] = useState('');
  const [showDeliveryFeeInfo, setShowDeliveryFeeInfo] = useState(false);
  const [showCouponModal, setShowCouponModal] = useState(false);

  const { data: activePromosData } = useQuery({
    queryKey: ['active-promos', effectiveZoneId],
    queryFn: () => api.get(`/promocodes/active${effectiveZoneId ? `?zoneId=${effectiveZoneId}` : ''}`),
    staleTime: 30 * 1000,
  });
  const activePromos: any[] = activePromosData?.promoCodes ?? [];
  const hasActivePromos = activePromos.length > 0;



  const { data: addressesData } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => api.get('/customers/addresses'),
    staleTime: 5 * 60 * 1000,
  });
  const selectedAddress = addressesData?.addresses?.find((a: any) => a.id === addressId);
  const isOutOfZone = !!addressId && !!selectedAddress && !selectedAddress.is_serviceable;

  const handleAddressNavigation = () => {
    // Always use push, never navigate — navigate('Address') can silently jump
    // back to a pre-existing Address screen in the stack, which removes Cart
    // from the history and causes pop(2) in AddressBook to land on Home.
    if (addressesData?.addresses?.length === 0) {
      navigation.push('AddressBook', { returnToCart: true, fromCheckout: true });
    } else {
      navigation.push('Address', { fromCheckout: true, returnToCart: true });
    }
  };

  const { data: menuData } = useQuery({
    queryKey: ['menu', effectiveZoneId],
    queryFn: () => api.get(`/menu?zoneId=${effectiveZoneId}`),
    enabled: !!effectiveZoneId,
    staleTime: 10 * 1000,
  });

  const recommendations = React.useMemo(() => {
    if (!menuData?.items || items.length === 0) return [];
    const kitchenId = items[0]?.kitchenId;
    return menuData.items
      .filter((i: any) => i.available && i.kitchen_id === kitchenId && !items.some(ci => ci.menuItemId === i.id))
      .slice(0, 6);
  }, [menuData?.items, items]);

  const offers: any[] = menuData?.offers || [];
  const getBogoOfferForItem = useCallback((cartItem: any) => {
    const itemInMenu = menuData?.items?.find((i: any) => i.id === cartItem.menuItemId);
    if (!itemInMenu) return null;
    const itemCat = String(itemInMenu.category || '').toLowerCase();
    return offers.find((o: any) => {
      if (o.discount_type !== 'bogo') return false;
      const tIds: string[] = Array.isArray(o.target_ids) ? o.target_ids : [];
      const targetCatNames = [o.target_name, ...(o.target_category_names || []), ...(o.target_category_slugs || [])]
        .filter(Boolean).map((c: string) => String(c).trim().toLowerCase());
      return o.target_type === 'all' ||
             (o.target_type === 'item' && (tIds.includes(itemInMenu.id) || o.target_id === itemInMenu.id)) ||
             (o.target_type === 'category' && (targetCatNames.includes(itemCat) || tIds.some((t: string) => String(t).toLowerCase() === itemCat) || String(o.target_id).toLowerCase() === itemCat));
    });
  }, [offers, menuData?.items]);

  const fallbackSubtotal = useMemo(() => items.reduce((s, i) => s + i.quantity * i.pricePaise, 0), [items]);
  const { data: pricingData, isFetching: pricingFetching, isError: pricingErrored, error: pricingError } = useQuery({
    queryKey: ['your-order-pricing', items, addressId, appliedPromoCode, riderTip, effectiveZoneId],
    queryFn: () =>
      api.post('/payment/create-order', {
        items, addressId, promoCode: appliedPromoCode, riderTipPaise: riderTip * 100,
        zoneId: effectiveZoneId, dryRun: true,
      }),
    enabled: items.length > 0 && !!addressId && !isOutOfZone,
    placeholderData: keepPreviousData,
  });

  // onSuccess/onError were removed from useQuery in TanStack Query v5 (query options no
  // longer match any overload with it present, which was also breaking pricingData's type
  // inference below) — this is the v5-correct way to react to a successful fetch.
  useEffect(() => {
    if (pricingData) {
      console.log('\n\n--- RAW PRICING RESPONSE ---\n', JSON.stringify(pricingData, null, 2), '\n\n');
    }
  }, [pricingData]);

  // Only trust a delivery fee (including a genuine ₹0) once we've actually heard back from
  // the server — otherwise the zero-filled fallback below would render identically to "Free".
  const hasPricingData = !!pricingData?.pricing;

  // Set inline promo error message (unintrusive, Zomato/Swiggy-style)
  useEffect(() => {
    if (pricingErrored && pricingError && appliedPromoCode) {
      const msg = (pricingError as any)?.message || "";
      const code = appliedPromoCode;
      setAppliedPromoCode("");
      if (msg.includes("PROMO_INVALID_OR_EXPIRED")) {
        setPromoError(`Code "${code}" is invalid or expired.`);
      } else if (msg.includes("PROMO_MIN_ORDER:")) {
        const minPaise = parseInt(msg.split("PROMO_MIN_ORDER:")[1], 10) || 0;
        const diff = (minPaise - fallbackSubtotal) / 100;
        if (diff > 0) {
          setPromoError(`Add items worth ₹${diff.toFixed(0)} more to use "${code}".`);
        } else {
          setPromoError(`Minimum item total of ₹${(minPaise / 100).toFixed(0)} required for "${code}".`);
        }
      } else if (msg.includes("PROMO_FIRST_ORDER_ONLY")) {
        setPromoError(`"${code}" is valid on your first completed order only.`);
      } else if (msg.includes("PROMO_NEW_USER_ONLY")) {
        setPromoError(`"${code}" is valid for new users only.`);
      } else if (msg.includes("PROMO_USAGE_LIMIT_REACHED")) {
        setPromoError(`Usage limit reached for "${code}".`);
      } else {
        setPromoError(`Could not apply code "${code}".`);
      }
    }
  }, [pricingErrored, pricingError, appliedPromoCode, fallbackSubtotal]);

  const rawError = (pricingError as any)?.message || "Couldn't calculate";
  let displayError = rawError;
  if (rawError.includes('CART_ZONE_MISMATCH')) {
    displayError = "Items in cart are from a different area. Please clear your cart.";
  } else if (rawError.includes('CART_MULTIPLE_ZONES')) {
    displayError = "Your cart contains items from multiple areas. Please clear your cart.";
  } else if (rawError.includes('NO_KITCHENS_AVAILABLE_FOR_ZONE')) {
    displayError = "No kitchens available here right now.";
  } else if (rawError.includes('KITCHEN_CLOSED')) {
    displayError = rawError.split('KITCHEN_CLOSED:')[1]?.trim() || "Kitchen is currently closed.";
  }

  const p = pricingData?.pricing || {
    subtotalPaise: fallbackSubtotal,
    deliveryFeePaise: 0,
    gstPaise: 0,
    cgstPaise: 0,
    sgstPaise: 0,
    totalAmountPaise: fallbackSubtotal + (riderTip * 100),
    gatewayAmountPaise: fallbackSubtotal + (riderTip * 100),
    discountPaise: 0,
    menuOfferDiscountPaise: 0,
    campaignDiscountPaise: 0,
    smallOrderFeePaise: 0,
  };
  const subtotal = p.subtotalPaise / 100;
  const deliveryFee = p.deliveryFeePaise / 100;
  const tax = ((p.gstPaise || 0) + (p.cgstPaise || 0) + (p.sgstPaise || 0)) / 100;
  const grandTotal = (p.gatewayAmountPaise || p.totalAmountPaise) / 100;
  const menuOfferDiscount = (p.menuOfferDiscountPaise || 0) / 100;
  const campaignDiscount = (p.campaignDiscountPaise || 0) / 100;
  const campaignType = p.campaignType;
  const campaignPercent = p.campaignDiscountPercent;
  const campaignLabel = useMemo(() => {
    if (campaignType === 'flash_sale') {
      return campaignPercent ? `Flash Sale (${campaignPercent}% OFF)` : 'Flash Sale';
    }
    if (campaignType === 'happy_hour') {
      return campaignPercent ? `Happy Hour (${campaignPercent}% OFF)` : 'Happy Hour Discount';
    }
    if (campaignType === 'winback') {
      return campaignPercent ? `Welcome Back (${campaignPercent}% OFF)` : 'Special Reward';
    }
    return campaignPercent ? `Special Deal (${campaignPercent}% OFF)` : (p.campaignName || 'Special Deal');
  }, [campaignType, campaignPercent, p.campaignName]);
  const smallOrderFee = (p.smallOrderFeePaise || 0) / 100;
  const totalSaved = ((p.menuOfferDiscountPaise || 0) + (p.discountPaise || 0) + (p.campaignDiscountPaise || 0)) / 100;

  const totalItemCount = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);

  if (items.length === 0) {
    return (
      <View style={[styles.emptyContainer, { paddingTop: insets.top }]}>
        <Animated.View entering={FadeIn.duration(600)} style={styles.emptyIconBox}>
          <ShoppingCart size={48} color={ACCENT} />
        </Animated.View>
        <Text allowFontScaling={false} style={styles.emptyTitle}>Your cart is empty</Text>
        <Text allowFontScaling={false} style={styles.emptySub}>Discover our delicious menu and add something tasty!</Text>
        <PressableScale
          style={styles.exploreBtn}
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Home' }] })}
          accessibilityRole="button"
          accessibilityLabel="Explore Menu"
        >
          <Text allowFontScaling={false} style={styles.exploreBtnText}>Explore Menu</Text>
        </PressableScale>
      </View>
    );
  }

  const busy = pricingFetching;
  const kitchenOpen = isKitchenOpen(menuData?.openingTime, menuData?.closingTime);
  const kitchenPaused = !!menuData?.kitchenPaused;
  const openLabel = menuData?.openingTime ? formatTime12h(menuData.openingTime) : '10:00 AM';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <PressableScale hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back">
            <ArrowLeft size={24} color={tokens.colors.textPrimary} style={{ marginRight: 12 }} />
          </PressableScale>
          <View>
            <Text allowFontScaling={false} style={styles.headerTitle}>Order confirmation</Text>
            <Text allowFontScaling={false} style={styles.headerSub}>{totalItemCount} {totalItemCount === 1 ? 'item' : 'items'}</Text>
          </View>
        </View>
        <PressableScale style={styles.clearCartBtn} onPress={() => { haptics.warning(); dispatch(clearCart()); }} accessibilityRole="button" accessibilityLabel="Clear Cart">
          <Text allowFontScaling={false} style={styles.clearCartText}>Clear Cart</Text>
        </PressableScale>
      </View>

      {/* Savings banner — shows total saved across menu offers + promo */}
      {totalSaved > 0 && (
        <View style={styles.savingsBanner}>
          <Text allowFontScaling={false} style={styles.savingsBannerText}>You saved ₹{totalSaved.toFixed(2)} on this order 🎉</Text>
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Delivery Estimate */}
        <Animated.View entering={FadeInDown.duration(300)} style={styles.estimateCard}>
          <View style={[
            styles.estimateIconBox,
            { backgroundColor: tokens.colors.surface, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 12 }
          ]}>
            <Text allowFontScaling={false} style={{ fontSize: 13, fontFamily: tokens.typography.family.regular, color: tokens.colors.textPrimary, letterSpacing: -0.5 }}>
              Eigen<Text allowFontScaling={false} style={{ color: tokens.colors.primary }}>.</Text>
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text allowFontScaling={false} style={styles.estimateTitle}>Eigen Promise</Text>
            <Text allowFontScaling={false} style={styles.estimateSub}>Fresh food, delivered fast to your door.</Text>
          </View>
        </Animated.View>

        {/* Free Delivery Progress Bar Card — only rendered if free delivery threshold is set by admin */}
        {(() => {
          const thresholdPaise = (menuData as any)?.minOrderForFreeDeliveryPaise || (menuData as any)?.zoneConfig?.min_order_for_free_delivery_paise;
          if (!thresholdPaise || Number(thresholdPaise) <= 0) return null;

          const threshold = Number(thresholdPaise) / 100;
          const currentSubtotal = fallbackSubtotal / 100;
          const remaining = Math.max(0, threshold - currentSubtotal);
          const progressPercent = Math.min(100, Math.round((currentSubtotal / threshold) * 100));

          return (
            <Animated.View entering={FadeInDown.duration(250)} style={styles.delProgressCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                {remaining > 0 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Zap size={14} color={tokens.colors.primary} />
                    <Text allowFontScaling={false} style={{ fontSize: 13, fontFamily: tokens.typography.family.medium, color: tokens.colors.textPrimary }}>
                      Add <Text style={{ fontFamily: tokens.typography.family.extrabold, color: tokens.colors.primary }}>₹{remaining.toFixed(0)}</Text> more for <Text style={{ color: tokens.colors.success, fontFamily: tokens.typography.family.extrabold }}>FREE Delivery!</Text> 🚚
                    </Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={14} color={tokens.colors.success} />
                    <Text allowFontScaling={false} style={{ fontSize: 13, fontFamily: tokens.typography.family.extrabold, color: tokens.colors.success }}>
                      🎉 FREE Delivery Unlocked on this order!
                    </Text>
                  </View>
                )}
                <Text allowFontScaling={false} style={{ fontSize: 11, fontFamily: tokens.typography.family.medium, color: tokens.colors.textTertiary }}>
                  {progressPercent}%
                </Text>
              </View>
              <View style={styles.delProgressTrack}>
                <View style={[styles.delProgressFill, { width: `${progressPercent}%`, backgroundColor: remaining > 0 ? tokens.colors.primary : tokens.colors.success }]} />
              </View>
            </Animated.View>
          );
        })()}

        {/* Cart Items Card */}
        <Animated.View entering={FadeInDown.delay(30).duration(300)} style={styles.card}>
            {items.map((item: any, idx: number) => (
              <CartItemMemoized
                key={`${item.menuItemId}-${JSON.stringify(item.customizations)}`}
                item={item}
                isLast={idx === items.length - 1}
                bogoOffer={getBogoOfferForItem(item)}
              />
            ))}
        </Animated.View>

        {/* You Might Like This Cross-Selling Carousel */}
        {recommendations.length > 0 && (
          <Animated.View entering={FadeInDown.delay(50).duration(300)} style={styles.card}>
            <Text allowFontScaling={false} style={styles.cardTitle}>You might like this</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: tokens.spacing.md }}>
              {recommendations.map((rec: any) => {
                const vegColor = rec.is_egg ? tokens.colors.warning : (rec.is_veg ? tokens.colors.success : tokens.colors.danger);
                return (
                  <View key={rec.id} style={styles.recCard}>
                    {rec.photo_url ? (
                      <Image source={{ uri: rec.photo_url }} style={styles.recImg} />
                    ) : (
                      <View style={[styles.recImg, styles.recImgPlaceholder]}>
                        <ChefHat size={20} color={tokens.colors.textTertiary} />
                      </View>
                    )}
                    <PressableScale
                      style={styles.recAddBtn}
                      onPress={() => {
                        haptics.selection();
                        dispatch(
                          addItemAction({
                            menuItemId: rec.id,
                            name: rec.name,
                            pricePaise: rec.price_paise,
                            quantity: 1,
                            photoUrl: rec.photo_url,
                            isVeg: rec.is_veg,
                            kitchenId: rec.kitchen_id,
                          })
                        );
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${rec.name} to cart`}
                    >
                      <Text allowFontScaling={false} style={styles.recAddText}>+</Text>
                    </PressableScale>
                    <View style={styles.recMeta}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                        <View style={[styles.vegBadgeMini, { borderColor: vegColor, width: 6, height: 6 }]}>
                          <View style={[styles.vegDotMini, { backgroundColor: vegColor, width: 3, height: 3 }]} />
                        </View>
                      </View>
                      <Text allowFontScaling={false} style={styles.recName} numberOfLines={1}>{rec.name}</Text>
                      <Text allowFontScaling={false} style={styles.recPrice}>₹{rec.price_paise / 100}</Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </Animated.View>
        )}

        {/* Promo Code Card */}
        <Animated.View entering={FadeInDown.delay(70).duration(300)} style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text allowFontScaling={false} style={styles.cardTitle}>Offers & Coupons</Text>
            {activePromos.length > 0 && (
              <TouchableOpacity
                onPress={() => { haptics.selection(); setShowCouponModal(true); }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Tag size={13} color={tokens.colors.primary} />
                <Text allowFontScaling={false} style={{ fontSize: 12, fontFamily: tokens.typography.family.extrabold, color: tokens.colors.primary }}>
                  View All ({activePromos.length})
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Quick-apply chips for available promos */}
          {!appliedPromoCode && activePromos.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {activePromos.slice(0, 4).map((promo: any) => (
                  <PressableScale
                    key={promo.id}
                    onPress={() => {
                      haptics.selection();
                      setPromoCode(promo.code);
                      setAppliedPromoCode(promo.code);
                    }}
                    style={styles.promoChip}
                    accessibilityRole="button"
                    accessibilityLabel={`Apply promo code ${promo.code}`}
                  >
                    <Tag size={11} color={tokens.colors.success} />
                    <Text allowFontScaling={false} style={styles.promoChipCode}>{promo.code}</Text>
                    <Text allowFontScaling={false} style={styles.promoChipDesc} numberOfLines={1}>
                      {(promo.discount_type === 'percentage' || promo.discount_type === 'percent')
                        ? `${promo.discount_percent}% off`
                        : `₹${(promo.discount_flat_paise || 0) / 100} off`}
                      {promo.min_order_paise ? ` on ₹${promo.min_order_paise / 100}+` : ''}
                    </Text>
                  </PressableScale>
                ))}
              </View>
            )}

            <View style={styles.promoRow}>
              <View style={styles.promoIconBox}>
                <Tag size={15} color={tokens.colors.success} />
              </View>
              {appliedPromoCode ? (
                <View style={styles.promoAppliedRow}>
                  <CheckCircle2 size={14} color={tokens.colors.success} />
                  <View style={{ flex: 1 }}>
                    <Text allowFontScaling={false} style={styles.promoAppliedText}>{appliedPromoCode}</Text>
                    {p.discountPaise > 0 && (
                      <Text allowFontScaling={false} style={styles.promoSavingText}>−₹{(p.discountPaise / 100).toFixed(2)} saved</Text>
                    )}
                  </View>
                </View>
              ) : (
                <TextInput
                  style={styles.promoInput}
                  placeholder="Enter promo code"
                  placeholderTextColor={tokens.colors.textTertiary}
                  value={promoCode}
                  onChangeText={(val) => {
                    setPromoCode(val);
                    if (promoError) setPromoError('');
                  }}
                  autoCapitalize="characters"
                  returnKeyType="done"
                />
              )}
              <PressableScale
                style={[styles.applyBtn, !promoCode && !appliedPromoCode && styles.applyBtnDisabled]}
                onPress={() => {
                  haptics.selection();
                  setPromoError('');
                  if (appliedPromoCode) {
                    setAppliedPromoCode('');
                    setPromoCode('');
                  } else if (promoCode) {
                    setAppliedPromoCode(promoCode.toUpperCase());
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel={appliedPromoCode ? 'Remove promo code' : 'Apply promo code'}
              >
                <Text allowFontScaling={false} style={[styles.applyBtnText, !promoCode && !appliedPromoCode && styles.applyBtnTextDisabled]}>
                  {appliedPromoCode ? 'Remove' : 'Apply'}
                </Text>
              </PressableScale>
            </View>

            {!!promoError && !appliedPromoCode && (
              <Animated.View entering={FadeInDown.duration(200)} style={styles.promoErrorRow}>
                <AlertCircle size={13} color={tokens.colors.danger} />
                <Text allowFontScaling={false} style={styles.promoErrorText}>{promoError}</Text>
              </Animated.View>
            )}
          </Animated.View>

        {/* Delivery Address Card */}
        <Animated.View entering={FadeInDown.delay(90).duration(300)} style={styles.card}>
          <PressableScale
            style={styles.addressRow}
            onPress={handleAddressNavigation}
            accessibilityRole="button"
            accessibilityLabel="Change delivery address"
          >
            <View style={styles.addressIconCircle}>
              <MapPin size={16} color={ACCENT} />
            </View>
            <View style={styles.addressBody}>
              <Text allowFontScaling={false} style={styles.cardSectionLabel}>Delivering to</Text>
              {selectedAddress ? (
                <>
                  <Text allowFontScaling={false} style={styles.addressLabel}>{selectedAddress.label}</Text>
                  <Text allowFontScaling={false} style={styles.addressText} numberOfLines={2}>
                    {selectedAddress.address_text}
                  </Text>
                </>
              ) : (
                <Text allowFontScaling={false} style={styles.addressText}>
                  {addressId ? 'Loading…' : 'No address selected'}
                </Text>
              )}
            </View>
            <Text allowFontScaling={false} style={styles.changeText}>{selectedAddress ? 'Change' : 'Add'}</Text>
          </PressableScale>
        </Animated.View>

        {/* Alternate Receiver Card */}
        <Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <UserRound size={18} color={ACCENT} style={{ marginRight: 12 }} />
              <View>
                <Text allowFontScaling={false} style={styles.cardTitleInline}>Someone else will receive?</Text>
                <Text allowFontScaling={false} style={styles.cardSubInline}>Add alternate contact for rider</Text>
              </View>
            </View>
            <Toggle value={altReceiver} onValueChange={setAltReceiver} activeColor={ACCENT} accessibilityLabel="Someone else will receive?" />
          </View>
          {altReceiver && (
            <Animated.View entering={FadeInDown.duration(200)} style={{ marginTop: 16, gap: 12 }}>
              <View style={styles.inputBox}>
                <UserRound size={16} color={tokens.colors.textTertiary} style={{ marginRight: 10 }} />
                <TextInput
                  placeholder="Receiver's name"
                  placeholderTextColor={tokens.colors.textTertiary}
                  value={altName}
                  onChangeText={setAltName}
                  style={styles.inputText}
                  returnKeyType="next"
                />
              </View>
              <View style={styles.inputBox}>
                <Phone size={16} color={tokens.colors.textTertiary} style={{ marginRight: 10 }} />
                <TextInput
                  placeholder="Receiver's phone number"
                  placeholderTextColor={tokens.colors.textTertiary}
                  value={altPhone}
                  onChangeText={setAltPhone}
                  keyboardType="phone-pad"
                  maxLength={10}
                  style={styles.inputText}
                  returnKeyType="done"
                />
              </View>
            </Animated.View>
          )}
        </Animated.View>

        {/* Delivery Instructions */}
        <Animated.View entering={FadeInDown.delay(110).duration(300)} style={styles.card}>
          <Text allowFontScaling={false} style={styles.cardTitle}>Delivery Instructions</Text>
          <TextInput 
            placeholder="e.g. Leave at door, don't ring bell..."
            placeholderTextColor={tokens.colors.textTertiary}
            value={deliveryInstructions}
            onChangeText={setDeliveryInstructions}
            style={styles.textArea}
            multiline
          />
        </Animated.View>

        {/* Tip the Rider */}
        <Animated.View entering={FadeInDown.delay(120).duration(300)} style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
            <Heart size={18} color={tokens.colors.primary} style={{ marginRight: 8 }} />
            <Text allowFontScaling={false} style={[styles.cardTitle, { marginBottom: 0 }]}>Tip your delivery partner</Text>
          </View>
          <Text allowFontScaling={false} style={styles.tipSub}>100% of your tip goes directly to your rider. Thank you!</Text>
          <View style={styles.tipOptionsRow}>
            {[20, 50, 100].map((amt) => (
              <PressableScale 
                key={amt}
                style={[styles.tipChip, riderTip === amt && styles.tipChipActive]}
                onPress={() => {
                  haptics.selection();
                  setRiderTip(riderTip === amt ? 0 : amt);
                }}
                accessibilityRole="button"
                accessibilityState={{ checked: riderTip === amt }}
                accessibilityLabel={`Tip ₹${amt}`}
              >
                <Text allowFontScaling={false} style={[styles.tipChipText, riderTip === amt && styles.tipChipTextActive]}>
                  ₹{amt}
                </Text>
              </PressableScale>
            ))}
          </View>
        </Animated.View>

        {/* Billing Details Card */}
        <Animated.View entering={FadeInDown.delay(110).duration(300)} style={styles.card}>
          <View style={styles.billRow}>
            <Text allowFontScaling={false} style={styles.billLabel}>Cart Total</Text>
            <Text allowFontScaling={false} style={styles.billValue}>₹{subtotal}</Text>
          </View>

          {/* 1. Discounts & Offers Section */}
          {menuOfferDiscount > 0 && (
            <View style={styles.billRow}>
              <Text allowFontScaling={false} style={[styles.billLabel, { color: tokens.colors.success }]}>Item Offers</Text>
              <Text allowFontScaling={false} style={[styles.billValue, { color: tokens.colors.success }]}>−₹{menuOfferDiscount.toFixed(2)}</Text>
            </View>
          )}
          {p.discountPaise > 0 && (
            <View style={styles.billRow}>
              <Text allowFontScaling={false} style={[styles.billLabel, { color: tokens.colors.success }]}>Promo ({appliedPromoCode})</Text>
              <Text allowFontScaling={false} style={[styles.billValue, { color: tokens.colors.success }]}>−₹{(p.discountPaise / 100).toFixed(2)}</Text>
            </View>
          )}
          {campaignDiscount > 0 && (
            <View style={styles.billRow}>
              <Text allowFontScaling={false} style={[styles.billLabel, { color: '#7C3AED' }]}>{campaignLabel}</Text>
              <Text allowFontScaling={false} style={[styles.billValue, { color: '#7C3AED' }]}>−₹{campaignDiscount.toFixed(2)}</Text>
            </View>
          )}

          {/* 2. Taxes & Fees Section */}
          {!hasPricingData && addressId && !pricingErrored ? (
            <View style={styles.billRow}>
              <Text allowFontScaling={false} style={styles.billLabel}>GST</Text>
              <Text allowFontScaling={false} style={[styles.billValue, { color: tokens.colors.textTertiary, fontSize: 12 }]}>Calculating...</Text>
            </View>
          ) : tax > 0 ? (
            <View style={styles.billRow}>
              <Text allowFontScaling={false} style={styles.billLabel}>GST</Text>
              <Text allowFontScaling={false} style={styles.billValue}>₹{tax.toFixed(2)}</Text>
            </View>
          ) : null}

          {addressId && (
            <>
              <View style={styles.billRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text allowFontScaling={false} style={styles.billLabel}>Delivery Fee </Text>
                  <TouchableOpacity hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} onPress={() => {
                    haptics.selection();
                    setShowDeliveryFeeInfo(!showDeliveryFeeInfo);
                  }}>
                    <Text allowFontScaling={false} style={[styles.billLabel, { color: tokens.colors.danger, marginLeft: 2 }]}>(Why this?)</Text>
                  </TouchableOpacity>
                </View>
                {pricingErrored ? (
                  <Text allowFontScaling={false} style={[styles.billValue, { color: tokens.colors.danger, fontSize: 12, maxWidth: 200, textAlign: 'right' }]}>
                    {displayError}
                  </Text>
                ) : !hasPricingData ? (
                  <Text allowFontScaling={false} style={[styles.billValue, { color: tokens.colors.textTertiary, fontSize: 12 }]}>Calculating...</Text>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {deliveryFee === 0 ? (
                      <>
                        <Text allowFontScaling={false} style={[styles.billValue, { textDecorationLine: 'line-through', color: tokens.colors.textTertiary, marginRight: 6, fontFamily: tokens.typography.family.medium }]}>₹25</Text>
                        <Text allowFontScaling={false} style={[styles.billValue, { color: tokens.colors.success }]}>FREE</Text>
                      </>
                    ) : (
                      <Text allowFontScaling={false} style={styles.billValue}>₹{deliveryFee.toFixed(2)}</Text>
                    )}
                  </View>
                )}
              </View>
              
              {showDeliveryFeeInfo && (
                <Animated.View entering={FadeInDown.duration(200)} style={{
                  backgroundColor: tokens.colors.background,
                  borderRadius: 12,
                  padding: 16,
                  marginTop: -4,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: tokens.colors.border,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.05,
                  shadowRadius: 8,
                  elevation: 2,
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text allowFontScaling={false} style={{ fontSize: 14, fontFamily: tokens.typography.family.medium, color: tokens.colors.textPrimary }}>
                      Why pay a Delivery Fee ?
                    </Text>
                    <TouchableOpacity hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} onPress={() => setShowDeliveryFeeInfo(false)}>
                      <X size={16} color={tokens.colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                  <Text allowFontScaling={false} style={{ fontSize: 13, fontFamily: tokens.typography.family.regular, color: tokens.colors.textSecondary, lineHeight: 18 }}>
                    This goes towards fairly compensating our captains and covering the convenience of bringing yummy food right to the comfort of your home. It ensures a sustainable service for everyone involved.
                  </Text>
                </Animated.View>
              )}
            </>
          )}
          {!addressId && (
            <View style={styles.billRow}>
              <Text allowFontScaling={false} style={[styles.billLabel, { color: tokens.colors.textTertiary, fontStyle: 'italic' }]}>Delivery Fees</Text>
              <Text allowFontScaling={false} style={[styles.billValue, { color: tokens.colors.textTertiary, fontSize: 12 }]}>Add address</Text>
            </View>
          )}
          <View style={styles.billRow}>
            <Text allowFontScaling={false} style={[styles.billLabel, { textDecorationLine: 'line-through', color: tokens.colors.textTertiary }]}>Platform Fee</Text>
            <Text allowFontScaling={false} style={[styles.billValue, { color: tokens.colors.success, fontFamily: tokens.typography.family.regular }]}>₹0 <Text style={{ fontFamily: tokens.typography.family.medium, color: tokens.colors.success }}>(Not our style)</Text></Text>
          </View>
          <View style={styles.billRow}>
            <Text allowFontScaling={false} style={[styles.billLabel, { textDecorationLine: 'line-through', color: tokens.colors.textTertiary }]}>Handling Fee</Text>
            <Text allowFontScaling={false} style={[styles.billValue, { color: tokens.colors.success, fontFamily: tokens.typography.family.regular }]}>₹0 <Text style={{ fontFamily: tokens.typography.family.medium, color: tokens.colors.success }}>(On the house)</Text></Text>
          </View>

          {/* 3. Rider Tip Section */}
          {riderTip > 0 && (
            <View style={styles.billRow}>
              <Text allowFontScaling={false} style={styles.billLabel}>Delivery Partner Tip</Text>
              <Text allowFontScaling={false} style={styles.billValue}>₹{riderTip.toFixed(2)}</Text>
            </View>
          )}

          <View style={styles.totalSeparator} />
          <View style={[styles.totalRow, { marginBottom: 16 }]}>
            <Text allowFontScaling={false} style={styles.totalLabel}>Total Payable</Text>
            {!hasPricingData && addressId && !pricingErrored ? (
              <Text allowFontScaling={false} style={[styles.totalValue, { color: tokens.colors.textTertiary, fontSize: 16, fontFamily: tokens.typography.family.medium }]}>
                Calculating...
              </Text>
            ) : (
              <Text allowFontScaling={false} style={styles.totalValue}>₹{grandTotal.toFixed(2)}</Text>
            )}
          </View>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12 }}>
            <View>
              <Text allowFontScaling={false} style={{ fontSize: 13, color: tokens.colors.textSecondary, fontFamily: tokens.typography.family.medium, lineHeight: 18 }}>The Eigen Promise:</Text>
              <Text allowFontScaling={false} style={{ fontSize: 14, color: tokens.colors.primary, fontFamily: tokens.typography.family.regular, lineHeight: 18 }}>No sneaky fees. Just great food.</Text>
            </View>
            <View style={{ 
              width: 86, height: 86, borderRadius: 43, 
              backgroundColor: tokens.colors.warningTint, 
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 2, borderColor: tokens.colors.warningTint,
              transform: [{ rotate: '8deg' }]
            }}>
              <Text allowFontScaling={false} style={{ fontSize: 10, fontFamily: tokens.typography.family.regular, color: tokens.colors.primary, letterSpacing: 0.5, textAlign: 'center' }}>100%</Text>
              <View style={{ width: 22, height: 22, backgroundColor: tokens.colors.primary, borderRadius: 11, marginVertical: 3, alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={12} color={tokens.colors.textInverse} />
              </View>
              <Text allowFontScaling={false} style={{ fontSize: 8, fontFamily: tokens.typography.family.regular, color: tokens.colors.primary, letterSpacing: 0, textAlign: 'center', paddingHorizontal: 2 }} numberOfLines={1} adjustsFontSizeToFit>TRANSPARENT</Text>
            </View>
          </View>

          {totalSaved > 0 && (
            <View style={styles.billTotalSavedBanner}>
              <Text allowFontScaling={false} style={styles.billTotalSavedText}>Total saved on this order: ₹{totalSaved.toFixed(2)}</Text>
            </View>
          )}
        </Animated.View>

        {isOutOfZone && (
          <View style={styles.outOfZoneBanner}>
            <Text allowFontScaling={false} style={styles.outOfZoneText}>This address is outside our delivery zone. Please change your address.</Text>
          </View>
        )}
      </ScrollView>

      {/* Sticky Bottom Bar matching Screenshots */}
      <Animated.View
        entering={SlideInDown.duration(400)}
        style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 8, 20) }]}
      >
        <View style={styles.footerRow}>
          <View style={{ flex: 1 }}>
            <Text allowFontScaling={false} style={{ fontSize: 11, fontFamily: tokens.typography.family.regular, color: tokens.colors.textTertiary, textTransform: 'uppercase' }}>
              {!hasPricingData && addressId && !pricingErrored ? 'Total Payable' : 'Item Total'}
            </Text>
            {!hasPricingData && addressId && !pricingErrored ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <ActivityIndicator size="small" color={tokens.colors.primary} />
                <Text allowFontScaling={false} style={{ fontSize: 16, fontFamily: tokens.typography.family.medium, color: tokens.colors.textTertiary }}>
                  Calculating...
                </Text>
              </View>
            ) : (
              <Text allowFontScaling={false} style={{ fontSize: 20, fontFamily: tokens.typography.family.regular, color: tokens.colors.textPrimary, letterSpacing: -0.5 }}>
                ₹{grandTotal.toFixed(2)}
              </Text>
            )}
          </View>
          
          <PressableScale
            style={[styles.footerCta, (busy || isOutOfZone || !kitchenOpen || kitchenPaused || (!hasPricingData && addressId && !pricingErrored)) && styles.placeOrderBtnDisabled]}
            disabled={busy || isOutOfZone || !kitchenOpen || kitchenPaused || (!hasPricingData && addressId && !pricingErrored)}
            accessibilityRole="button"
            accessibilityLabel={addressId ? (isOutOfZone ? 'Out of Zone' : (!isOnline ? 'Waiting for connection' : 'Proceed to Pay')) : 'Select Address'}
            onPress={() => {
              haptics.selection();
              if (!addressId) {
                handleAddressNavigation();
                return;
              }
              if (!isOnline) {
                haptics.warning();
                showToast({ message: 'Your cart is saved. Please connect to the internet to proceed.', type: 'info' });
                return;
              }
              if (altReceiver) {
                if (!altName.trim()) {
                  showDialog({ title: 'Required Field', message: 'Please enter the receiver\'s name.' });
                  return;
                }
                if (altPhone.trim().length < 10) {
                  showDialog({ title: 'Required Field', message: 'Please enter a valid 10-digit phone number.' });
                  return;
                }
              }
              navigation.navigate('Checkout', { 
                addressId, 
                promoCode: appliedPromoCode,
                riderTip,
                instructions: deliveryInstructions,
                altReceiver,
                altName,
                altPhone
              });
            }}
          >
            {busy ? (
              <ActivityIndicator color={tokens.colors.textInverse} />
            ) : (
              <Text allowFontScaling={false} style={styles.footerCtaText}>
                {kitchenPaused
                  ? 'Kitchen Paused'
                  : !kitchenOpen
                    ? `Opens at ${openLabel}`
                    : addressId
                      ? (isOutOfZone ? 'Out of Zone' : (!isOnline ? 'Waiting for connection...' : 'Proceed to Pay'))
                      : 'Select Address'}
              </Text>
            )}
          </PressableScale>
        </View>
      </Animated.View>

      {/* Slide-Up Coupon Selector Drawer Modal */}
      <Modal
        visible={showCouponModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCouponModal(false)}
      >
        <View style={styles.modalOverlay}>
          <PressableScale style={styles.modalBackdrop} onPress={() => setShowCouponModal(false)} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Tag size={18} color={tokens.colors.primary} />
                <Text allowFontScaling={false} style={styles.modalTitleText}>Offers & Coupons</Text>
              </View>
              <TouchableOpacity onPress={() => setShowCouponModal(false)} style={styles.modalCloseBtn}>
                <X size={18} color={tokens.colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {activePromos.length === 0 ? (
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <Text allowFontScaling={false} style={{ fontSize: 14, color: tokens.colors.textSecondary }}>No coupons available right now.</Text>
                </View>
              ) : (
                activePromos.map((promo: any) => {
                  const isApplied = appliedPromoCode === promo.code;
                  const minOrder = (promo.min_order_paise || 0) / 100;
                  const currentSubtotal = fallbackSubtotal / 100;
                  const isLocked = minOrder > 0 && currentSubtotal < minOrder;
                  const remainingForUnlock = Math.max(0, minOrder - currentSubtotal);

                  return (
                    <View key={promo.id} style={[styles.modalCouponCard, isApplied && styles.modalCouponCardApplied, isLocked && styles.modalCouponCardLocked]}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <Text allowFontScaling={false} style={styles.modalCouponCodeText}>{promo.code}</Text>
                          {isApplied && (
                            <View style={styles.modalAppliedBadge}>
                              <CheckCircle2 size={11} color="#15803D" />
                              <Text allowFontScaling={false} style={styles.modalAppliedBadgeText}>APPLIED</Text>
                            </View>
                          )}
                        </View>
                        <Text allowFontScaling={false} style={styles.modalCouponDescText}>
                          {promo.discount_type === 'bogo'
                            ? 'Buy 1 Get 1 Free (BOGO Deal)'
                            : (promo.discount_type === 'percentage' || promo.discount_type === 'percent')
                            ? `Get ${promo.discount_percent}% OFF up to ₹${(promo.max_discount_paise || 0) / 100}`
                            : `Get ₹${(promo.discount_flat_paise || 0) / 100} Flat OFF`}
                        </Text>
                        {isLocked && (
                          <Text allowFontScaling={false} style={styles.modalLockedHintText}>
                            ⚠️ Add ₹{remainingForUnlock.toFixed(0)} more to unlock
                          </Text>
                        )}
                      </View>

                      <TouchableOpacity
                        disabled={isLocked && !isApplied}
                        onPress={() => {
                          haptics.selection();
                          if (isApplied) {
                            setAppliedPromoCode('');
                            setPromoCode('');
                          } else {
                            setAppliedPromoCode(promo.code);
                            setPromoCode(promo.code);
                          }
                          setShowCouponModal(false);
                        }}
                        style={[styles.modalApplyBtn, isApplied && styles.modalRemoveBtn, isLocked && styles.modalApplyBtnDisabled]}
                      >
                        <Text allowFontScaling={false} style={[styles.modalApplyBtnText, isApplied && styles.modalRemoveBtnText]}>
                          {isApplied ? 'REMOVE' : isLocked ? 'LOCKED' : 'APPLY'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default CartScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.background }, // Light gray background for block separation

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: tokens.spacing.lg, paddingTop: tokens.spacing.md, paddingBottom: 10,
    backgroundColor: tokens.colors.surface,
    zIndex: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.colors.border,
  },
  headerTitle: { fontSize: 20, fontFamily: tokens.typography.family.regular, color: tokens.colors.textPrimary, letterSpacing: -0.5 },
  headerSub: { fontSize: 12, fontFamily: tokens.typography.family.medium, color: tokens.colors.textSecondary, marginTop: 2 },
  clearCartBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: tokens.colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.border,
  },
  clearCartText: {
    fontSize: 11, fontFamily: tokens.typography.family.medium, color: tokens.colors.textSecondary,
  },

  savingsBanner: {
    backgroundColor: tokens.colors.successTint,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  savingsBannerText: {
    fontSize: 13,
    fontFamily: tokens.typography.family.regular,
    color: tokens.colors.primary,
    letterSpacing: 0.2,
  },

  scrollContent: { paddingBottom: 150 },

  // Estimate
  estimateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surface,
    padding: tokens.spacing.lg,
    gap: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
  },
  estimateIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.colors.successTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  estimateTitle: {
    fontSize: 16,
    fontFamily: tokens.typography.family.regular,
    color: tokens.colors.primary,
  },
  estimateSub: {
    fontSize: 13,
    fontFamily: tokens.typography.family.medium,
    color: tokens.colors.textSecondary,
    marginTop: 2,
  },

  // Card base
  card: {
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.lg,
    marginBottom: tokens.spacing.sm,
  },
  cardDivider: { height: 1, backgroundColor: tokens.colors.border, borderStyle: 'solid', borderWidth: 1, borderRadius: 1, marginVertical: tokens.spacing.md, borderColor: tokens.colors.border },
  cardTitle: {
    fontSize: 16, fontFamily: tokens.typography.family.regular, color: tokens.colors.textPrimary,
    marginBottom: tokens.spacing.lg, letterSpacing: -0.3,
  },
  cardSectionLabel: {
    fontSize: 11, fontFamily: tokens.typography.family.medium, color: tokens.colors.textSecondary,
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4,
  },

  // Cart items
  itemRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8,
  },
  itemImgBox: { width: 56, height: 56, borderRadius: 20, overflow: 'hidden', marginRight: 14, backgroundColor: tokens.colors.background },
  itemImg: { width: '100%', height: '100%' },
  itemImgPlaceholder: { backgroundColor: tokens.colors.background, alignItems: 'center', justifyContent: 'center' },
  itemMeta: { flex: 1, marginRight: 12 },
  itemName: { fontSize: 14, fontFamily: tokens.typography.family.regular, color: tokens.colors.textPrimary, lineHeight: 20, letterSpacing: -0.2 },
  itemCustomizations: { fontSize: 11, fontFamily: tokens.typography.family.medium, color: tokens.colors.textSecondary, marginTop: 2, marginBottom: 2 },
  itemPrice: { fontSize: 14, fontFamily: tokens.typography.family.medium, color: tokens.colors.textPrimary, marginTop: 4 },
  vegBadgeMini: {
    width: 10,
    height: 10,
    borderWidth: 1,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vegDotMini: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },

  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: tokens.colors.background, borderRadius: 16, padding: 2 },
  qtyBtn: {
    width: 28, height: 28, borderRadius: 6,
    backgroundColor: tokens.colors.surface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: tokens.colors.border,
  },
  qtyBtnActive: { backgroundColor: tokens.colors.primary },
  qtyBtnText: { fontSize: 16, color: tokens.colors.textPrimary, fontFamily: tokens.typography.family.regular, lineHeight: 18 },
  qtyBtnActiveText: { color: tokens.colors.textInverse },
  qtyNum: { fontSize: 13, fontFamily: tokens.typography.family.regular, color: tokens.colors.textPrimary, minWidth: 20, textAlign: 'center' },

  // Address
  addressRow: { flexDirection: 'row', alignItems: 'flex-start' },
  addressIconCircle: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: tokens.colors.successTint,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 14, marginTop: 2,
  },
  addressBody: { flex: 1, marginRight: 8 },
  addressLabel: { fontSize: 15, fontFamily: tokens.typography.family.regular, color: tokens.colors.textPrimary, marginBottom: 4, letterSpacing: -0.2 },
  addressText: { fontSize: 13, fontFamily: tokens.typography.family.medium, color: tokens.colors.textSecondary, lineHeight: 20 },
  changeText: { fontSize: 13, fontFamily: tokens.typography.family.medium, color: tokens.colors.primary, marginTop: 4 },

  // Promo
  promoRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.md },
  promoIconBox: {
    width: 42, height: 42, borderRadius: 20,
    backgroundColor: tokens.colors.background,
    alignItems: 'center', justifyContent: 'center',
  },
  promoInput: {
    flex: 1, height: 46,
    fontSize: 14, fontFamily: tokens.typography.family.regular, color: tokens.colors.textPrimary, textTransform: 'uppercase', letterSpacing: 1,
    borderBottomWidth: 1, borderBottomColor: tokens.colors.border,
  },
  promoAppliedRow: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  promoAppliedText: { fontSize: 15, fontFamily: tokens.typography.family.regular, color: tokens.colors.primary },
  promoSavingText: { fontSize: 12, fontFamily: tokens.typography.family.medium, color: tokens.colors.textSecondary, marginTop: 2 },
  promoInvalidText: { fontSize: 13, fontFamily: tokens.typography.family.medium, color: tokens.colors.danger },
  promoErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  promoErrorText: {
    fontSize: 12,
    fontFamily: tokens.typography.family.medium,
    color: tokens.colors.danger,
    flex: 1,
  },
  applyBtn: {
    height: 46, paddingHorizontal: 20, borderRadius: 14,
    backgroundColor: tokens.colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  applyBtnDisabled: { backgroundColor: tokens.colors.background },
  applyBtnText: { fontSize: 14, fontFamily: tokens.typography.family.regular, color: tokens.colors.textInverse },
  applyBtnTextDisabled: { color: tokens.colors.textTertiary },

  // Recommendations Carousel
  recCard: {
    width: 120,
    backgroundColor: tokens.colors.surface,
    borderRadius: 16,
    marginRight: 10,
    paddingBottom: 8,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  recImg: {
    width: '100%',
    height: 90,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  recImgPlaceholder: {
    backgroundColor: tokens.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recAddBtn: {
    position: 'absolute',
    top: 75,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: tokens.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...tokens.shadows.soft,
    zIndex: 5,
  },
  recAddText: {
    fontSize: 20,
    color: tokens.colors.textInverse,
    fontFamily: tokens.typography.family.regular,
    lineHeight: 22,
  },
  recMeta: {
    paddingHorizontal: 8,
    paddingTop: 10,
  },
  recName: {
    fontSize: 12,
    fontFamily: tokens.typography.family.medium,
    color: tokens.colors.textPrimary,
    marginVertical: 4,
    lineHeight: 16,
  },
  recPrice: {
    fontSize: 13,
    fontFamily: tokens.typography.family.regular,
    color: tokens.colors.textPrimary,
  },

  // Bill
  billRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: tokens.spacing.md,
  },
  billLabel: { fontSize: 14, fontFamily: tokens.typography.family.medium, color: tokens.colors.textSecondary },
  billValue: { fontSize: 14, fontFamily: tokens.typography.family.medium, color: tokens.colors.textPrimary },

  totalSeparator: { height: 1, backgroundColor: tokens.colors.border, borderStyle: 'dashed', borderWidth: 1, borderRadius: 1, marginVertical: 16, borderColor: tokens.colors.border },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 16, fontFamily: tokens.typography.family.regular, color: tokens.colors.textPrimary },
  totalValue: { fontSize: 24, fontFamily: tokens.typography.family.regular, color: tokens.colors.textPrimary, letterSpacing: -1 },

  billTotalSavedBanner: {
    backgroundColor: tokens.colors.successTint,
    padding: 12,
    borderRadius: 14,
    marginTop: 16,
    alignItems: 'center',
  },
  billTotalSavedText: {
    fontSize: 13,
    fontFamily: tokens.typography.family.regular,
    color: tokens.colors.primary,
  },

  // Out-of-zone
  outOfZoneBanner: {
    backgroundColor: tokens.colors.dangerTint, borderRadius: 16,
    padding: 16,
  },
  outOfZoneText: { fontSize: 14, fontFamily: tokens.typography.family.medium, color: tokens.colors.danger, textAlign: 'center', lineHeight: 20 },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: tokens.spacing.lg, paddingTop: tokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
  },
  footerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  footerCta: {
    height: 48,
    backgroundColor: tokens.colors.primary,
    borderRadius: 20,
    paddingHorizontal: tokens.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerCtaText: {
    fontSize: 16,
    fontFamily: tokens.typography.family.regular,
    color: tokens.colors.textInverse,
  },
  placeOrderBtnDisabled: { opacity: 0.55 },

  emptyContainer: {
    flex: 1, backgroundColor: tokens.colors.surface,
    alignItems: 'center', justifyContent: 'center', padding: tokens.spacing.xxxl,
  },
  emptyIconBox: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: tokens.colors.background, alignItems: 'center', justifyContent: 'center', marginBottom: 28,
  },
  emptyTitle: { fontSize: 24, fontFamily: tokens.typography.family.regular, color: tokens.colors.textPrimary, marginBottom: 12, letterSpacing: -0.5 },
  emptySub: { fontSize: 15, fontFamily: tokens.typography.family.medium, color: tokens.colors.textSecondary, textAlign: 'center', lineHeight: 24 },
  exploreBtn: {
    marginTop: 32, backgroundColor: tokens.colors.primary,
    paddingHorizontal: 36, paddingVertical: 16, borderRadius: 20,
  },
  exploreBtnText: { fontSize: 15, fontFamily: tokens.typography.family.regular, color: tokens.colors.textInverse, textTransform: 'uppercase', letterSpacing: 1 },

  // New Styles for Added UI
  cardTitleInline: { fontSize: 15, fontFamily: tokens.typography.family.medium, color: tokens.colors.textPrimary, marginBottom: 2 },
  cardSubInline: { fontSize: 12, fontFamily: tokens.typography.family.medium, color: tokens.colors.textTertiary },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: tokens.colors.background, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 20, paddingHorizontal: 12, height: 48 },
  inputText: { flex: 1, fontSize: 14, fontFamily: tokens.typography.family.medium, color: tokens.colors.textPrimary },
  textArea: { backgroundColor: tokens.colors.background, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 20, padding: 12, minHeight: 80, fontSize: 14, fontFamily: tokens.typography.family.medium, color: tokens.colors.textPrimary, textAlignVertical: 'top' },
  tipSub: { fontSize: 12, fontFamily: tokens.typography.family.medium, color: tokens.colors.textTertiary, marginBottom: 12, lineHeight: 18 },
  tipOptionsRow: { flexDirection: 'row', gap: 10 },
  tipChip: { flex: 1, paddingVertical: 12, borderRadius: 20, borderWidth: 1, borderColor: tokens.colors.border, backgroundColor: tokens.colors.surface, alignItems: 'center' },
  tipChipActive: { borderColor: tokens.colors.primary, backgroundColor: tokens.colors.primaryTint },
  tipChipText: { fontSize: 14, fontFamily: tokens.typography.family.medium, color: tokens.colors.textPrimary },
  tipChipTextActive: { color: tokens.colors.primary },
  promoChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: tokens.colors.success, backgroundColor: tokens.colors.successTint },
  promoChipCode: { fontSize: 12, fontFamily: tokens.typography.family.regular, color: tokens.colors.primary, letterSpacing: 0.5 },
  promoChipDesc: { fontSize: 11, fontFamily: tokens.typography.family.medium, color: tokens.colors.success, maxWidth: 100 },

  plusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginBottom: 6,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#F5F3FF', borderRadius: 16,
    borderWidth: 1, borderColor: '#DDD6FE',
  },
  plusBannerIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center',
  },
  plusBannerText: { flex: 1 },
  plusBannerTitle: { fontSize: 13, fontFamily: tokens.typography.family.medium, color: '#4C1D95', lineHeight: 18 },
  plusBannerSub: { fontSize: 11, fontFamily: tokens.typography.family.medium, color: '#7C3AED', marginTop: 2 },

  // Free Delivery Progress Bar Styles
  delProgressCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  delProgressTrack: {
    height: 6,
    backgroundColor: tokens.colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  delProgressFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Modal Styles
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalBackdrop: { flex: 1 },
  modalContent: {
    backgroundColor: tokens.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
  },
  modalTitleText: { fontSize: 18, fontFamily: tokens.typography.family.extrabold, color: tokens.colors.textPrimary },
  modalCloseBtn: { padding: 4, borderRadius: 12, backgroundColor: tokens.colors.background },

  modalCouponCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justify: 'space-between',
    backgroundColor: tokens.colors.background,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  modalCouponCardApplied: { borderColor: '#22C55E', backgroundColor: '#F0FDF4' },
  modalCouponCardLocked: { opacity: 0.6 },
  modalCouponCodeText: { fontSize: 15, fontFamily: tokens.typography.family.extrabold, color: tokens.colors.textPrimary, letterSpacing: 0.5 },
  modalAppliedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#DCFCE7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  modalAppliedBadgeText: { fontSize: 10, fontFamily: tokens.typography.family.extrabold, color: '#15803D' },
  modalCouponDescText: { fontSize: 12, fontFamily: tokens.typography.family.medium, color: tokens.colors.textSecondary, marginTop: 2 },
  modalLockedHintText: { fontSize: 11, fontFamily: tokens.typography.family.medium, color: tokens.colors.warning, marginTop: 4 },
  modalApplyBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: tokens.colors.primary },
  modalApplyBtnDisabled: { backgroundColor: tokens.colors.border },
  modalApplyBtnText: { fontSize: 12, fontFamily: tokens.typography.family.extrabold, color: '#FFF' },
  modalRemoveBtn: { backgroundColor: '#FEE2E2' },
  modalRemoveBtnText: { color: '#DC2626' },
});
