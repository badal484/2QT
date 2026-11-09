import { tokens } from '../theme/tokens';
import React, { useState, useCallback, useMemo, useRef } from 'react';
import { useNavigation, useIsFocused, StackActions } from '@react-navigation/native';
import {
  View, Text, ScrollView, StyleSheet,
  StatusBar, useWindowDimensions, Image, Share, TouchableOpacity, FlatList
} from 'react-native';
import Animated, { FadeIn, FadeInDown, useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';
import { useDispatch, useSelector } from 'react-redux';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Share2 } from 'lucide-react-native';
import { NetworkImage } from '../components/NetworkImage';
import { BannerMedia } from '../components/BannerMedia';
import { CustomizationBottomSheet } from '../components/ui/CustomizationBottomSheet';
import { RootState, store } from '../store';
import { addItem, setQuantity, clearCart } from '../store/slices/cartSlice';
import { api } from '../api/client';
import { haptics } from '../utils/haptics';
import { PressableScale } from '../components/ui/internal/PressableScale';
import { useFeedback } from '../context/FeedbackContext';



const BAG_IMG_CDN = { uri: 'https://ik.imagekit.io/edncabmhc/assets/2qt_bag_clean_cC5HBiqG6.png' };
const BAG_IMG_LOCAL = require('../../assets/images/white_bag_2qt_clean_transparent.png');

const PremiumBag = () => {
  const [imgSrc, setImgSrc] = useState<any>(BAG_IMG_CDN);

  return (
    <View style={{ width: 180, height: 240, alignItems: 'center', justifyContent: 'center' }}>
      {/* White 2QT bag with transparent background */}
      <Image 
        source={imgSrc} 
        style={{ width: 180, height: 240 }} 
        resizeMode="contain"
        fadeDuration={0}
        onError={() => setImgSrc(BAG_IMG_LOCAL)}
      />
    </View>
  );
};

const RelatedItemCard = React.memo(({ ri, onAdd, dispatch }: any) => {
  const nav = useNavigation<any>();
  const riCart = useSelector((state: RootState) => state.cart.items.find(ci => ci.menuItemId === ri.id));
  const riVeg = ri.is_egg ? tokens.colors.warning : ri.is_veg ? tokens.colors.success : tokens.colors.danger;

  const handleOpenDetail = () => {
    nav.dispatch(StackActions.push('ItemDetailPush', { item: ri }));
  };

  return (
    <View style={s.relatedCard}>
      <PressableScale
        onPress={handleOpenDetail}
        accessibilityRole="button"
        accessibilityLabel={`View ${ri.name}`}
      >
        <View style={s.relatedImgBox}>
          {ri.photo_url ? (
            <NetworkImage uri={ri.photo_url} style={s.relatedImg} />
          ) : (
            <View style={[s.relatedImg, s.heroPlaceholder]}>
              <Text allowFontScaling={false} style={{ fontSize: 24 }}>🍽️</Text>
            </View>
          )}
          {ri.is_bestseller && (
            <View style={s.relatedBadge}>
              <Text allowFontScaling={false} style={s.relatedBadgeText}>★ Bestseller</Text>
            </View>
          )}
        </View>
      </PressableScale>

      {ri.available && !riCart ? (
        <TouchableOpacity
          style={s.relatedAddBtn}
          activeOpacity={0.7}
          onPress={() => { haptics.selection(); onAdd(ri); }}
          accessibilityRole="button"
          accessibilityLabel={`Add ${ri.name} to cart`}
        >
          <Text allowFontScaling={false} style={s.relatedAddText}>ADD</Text>
        </TouchableOpacity>
      ) : ri.available && riCart ? (
        <View style={s.relatedQtyBox}>
          <TouchableOpacity
            activeOpacity={0.6}
            style={{ paddingHorizontal: 8, paddingVertical: 4 }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 8 }}
            onPress={() => { haptics.selection(); dispatch(setQuantity({ menuItemId: ri.id, quantity: riCart.quantity - 1 })); }}
            accessibilityRole="button"
            accessibilityLabel="Decrease quantity"
          >
            <Text allowFontScaling={false} style={s.relatedQtyBtn}>−</Text>
          </TouchableOpacity>
          <Text allowFontScaling={false} style={s.relatedQtyVal}>{riCart.quantity}</Text>
          <TouchableOpacity
            activeOpacity={0.6}
            style={{ paddingHorizontal: 8, paddingVertical: 4 }}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 12 }}
            onPress={() => { haptics.selection(); dispatch(setQuantity({ menuItemId: ri.id, quantity: riCart.quantity + 1 })); }}
            accessibilityRole="button"
            accessibilityLabel="Increase quantity"
          >
            <Text allowFontScaling={false} style={s.relatedQtyBtn}>+</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <PressableScale
        onPress={handleOpenDetail}
        accessibilityRole="button"
        accessibilityLabel={`View ${ri.name}`}
      >
        <View style={s.relatedMeta}>
          <View style={[s.vegBox, { borderColor: riVeg, width: 14, height: 14, borderRadius: 2 }]}>
            <View style={[s.vegDot, { backgroundColor: riVeg, width: 6, height: 6, borderRadius: 3 }]} />
          </View>
          {ri.tags?.[0] && (
            <View style={[s.servePill, { paddingHorizontal: 6, paddingVertical: 2 }]}>
              <Text allowFontScaling={false} style={[s.servePillText, { fontSize: 9 }]}>{ri.tags[0]}</Text>
            </View>
          )}
        </View>
        <Text allowFontScaling={false} style={s.relatedName} numberOfLines={2}>{ri.name}</Text>
        <Text allowFontScaling={false} style={s.relatedPrice}>₹{ri.price_paise / 100}</Text>
      </PressableScale>
    </View>
  );
});

const ItemDetailScreen = ({ route, navigation }: any) => {
  const { width: SCREEN_W } = useWindowDimensions();
  const { item } = route.params;
  const dispatch = useDispatch();
  const { showDialog } = useFeedback();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const cartItems = useSelector((state: RootState) => state.cart.items);
  const cartItemsRef = useRef(cartItems);
  cartItemsRef.current = cartItems;

  const cartItem = useSelector((state: RootState) =>
    state.cart.items.find(ci => ci.menuItemId === item.id),
  );
  const cartCount = useSelector((state: RootState) =>
    state.cart.items.reduce((sum, ci) => sum + ci.quantity, 0),
  );
  const cartTotal = useSelector((state: RootState) =>
    state.cart.items.reduce((sum, ci) => sum + (ci.pricePaise / 100) * ci.quantity, 0),
  );
  const zoneId = useSelector((state: RootState) => state.cart.zoneId);
  const activeZoneId = useSelector((state: RootState) => state.app.activeZoneId);
  const effectiveZoneId = zoneId || activeZoneId;

  const [showDetails, setShowDetails] = useState(false);
  const [activeCustomizationItem, setActiveCustomizationItem] = useState<any>(null);

  const menuData = queryClient.getQueryData<any>(['menu', effectiveZoneId]);
  
  const enrichedItem = useMemo(() => {
    if (!menuData?.items) return item;
    const offers = menuData.offers || [];
    const itemInMenu = menuData.items.find((i: any) => i.id === item.id) || item;
    let basePrice = itemInMenu.price_paise;
    let offerDiscountPaise = 0;
    let appliedOffer = null;
    
    for (const offer of offers) {
         const tIds: string[] = Array.isArray(offer.target_ids) ? offer.target_ids : [];
         const itemCat = String(itemInMenu.category || '').toLowerCase();
         const targetCatNames = [
           offer.target_name,
           ...(offer.target_category_names || []),
           ...(offer.target_category_slugs || []),
         ]
             .filter(Boolean)
             .map((c: string) => String(c).trim().toLowerCase());

         const isMatch = offer.target_type === 'all' ||
                         (offer.target_type === 'item' && (tIds.includes(itemInMenu.id) || offer.target_id === itemInMenu.id)) ||
                         (offer.target_type === 'category' && (
                             targetCatNames.includes(itemCat) ||
                             tIds.some((t: string) => String(t).toLowerCase() === itemCat) ||
                             String(offer.target_id).toLowerCase() === itemCat
                         )) ||
                         (offer.target_type === 'kitchen' && (tIds.includes(itemInMenu.kitchen_id) || offer.target_id === itemInMenu.kitchen_id));
         
         if (isMatch) {
              let discount = 0;
              if (offer.discount_type === 'bogo') {
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
       ...itemInMenu,
       original_price_paise: basePrice,
       price_paise: Math.max(0, basePrice - offerDiscountPaise),
       applied_offer: appliedOffer || item.applied_offer
    };
  }, [menuData?.items, menuData?.offers, item]);

  const relatedItems: any[] = useMemo(() =>
    (menuData?.items ?? [])
      .filter((i: any) => i.category === item.category && i.id !== item.id && i.available)
      .slice(0, 6),
    [menuData?.items, item.category, item.id],
  );

  const { data: promosData } = useQuery({
    queryKey: ['promos-active'],
    queryFn: () => api.get('/promocodes/active'),
    staleTime: 5 * 60 * 1000,
  });
  const promos: any[] = promosData?.codes ?? [];

  const vegColor = item.is_egg ? tokens.colors.warning : item.is_veg ? tokens.colors.success : tokens.colors.danger;
  const price = enrichedItem.price_paise / 100;
  const qty = cartItem?.quantity ?? 0;
  const totalPrice = price * (qty || 1);

  const serveTag = (item.tags as string[] | undefined)?.find(t =>
    /serves|ml|g\b|kg/i.test(t),
  ) ?? item.tags?.[0];

  const handleAdd = useCallback((itemToAdd: any, customizations: any[] = [], instructions: string = '') => {
    const doAdd = () =>
      dispatch(
        addItem({
          menuItemId: itemToAdd.id,
          name: itemToAdd.name,
          pricePaise: itemToAdd.original_price_paise || itemToAdd.price_paise,
          quantity: 1,
          photoUrl: itemToAdd.photo_url,
          isVeg: itemToAdd.is_veg,
          kitchenId: itemToAdd.kitchen_id,
          customizations: customizations.length > 0 ? customizations : undefined,
          instructions: instructions || undefined,
        }),
      );
    const current = store.getState().cart.items;
    if (current.length > 0 && current[0].kitchenId !== itemToAdd.kitchen_id) {
      showDialog({
        title: 'Replace cart?',
        message: 'Your cart has items from a different kitchen.',
        confirmText: 'Replace',
        cancelText: 'Cancel',
        type: 'warning',
        onConfirm: () => {
          dispatch(clearCart());
          doAdd();
        }
      });
    } else {
      doAdd();
    }
  }, [dispatch, showDialog]);

  const handleAddWithCheck = useCallback((itemToAdd: any) => {
    if (itemToAdd.customization_groups?.length > 0) {
      setActiveCustomizationItem(itemToAdd);
    } else {
      handleAdd(itemToAdd, [], '');
    }
  }, [handleAdd]);

  const handleShare = useCallback(async () => {
    try {
      haptics.selection();
      const appLink = `https://2qt.in/menu/${item.id}`;
      const message = `Check out ${item.name} at Eigen Foods for just ₹${item.price_paise / 100}! It's incredibly fresh and delicious!`;
      
      await Share.share({
        message: `${message}\n\n${appLink}`,
        url: appLink,
        title: item.name,
      });
    } catch (error) {
      console.log('User cancelled or error:', error);
    }
  }, [item]);

  // Brief confirmation pulse on the sticky price whenever quantity changes —
  // the one moment on this screen that most benefits from tactile feedback.
  const priceScale = useSharedValue(1);
  const isFirstRender = useRef(true);
  React.useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    priceScale.value = withSequence(
      withTiming(1.15, { duration: 120 }),
      withTiming(1, { duration: 150 }),
    );
  }, [qty, priceScale]);
  const pricePulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: priceScale.value }] }));

  const isScreenFocused = useIsFocused();
  const [activeMediaIdx, setActiveMediaIdx] = useState(0);

  const mediaList = useMemo(() => {
    const list: Array<{ type: 'VIDEO' | 'IMAGE'; url: string; poster?: string }> = [];
    const video = enrichedItem.video_url || item.video_url;
    const cover = enrichedItem.photo_url || item.photo_url;
    const additionalImages = enrichedItem.images || item.images;

    if (video) {
      list.push({
        type: 'VIDEO',
        url: video,
        poster: cover || undefined,
      });
    }
    if (cover) {
      list.push({
        type: 'IMAGE',
        url: cover,
      });
    }
    if (Array.isArray(additionalImages)) {
      additionalImages.forEach((imgUrl: string) => {
        if (imgUrl && imgUrl !== cover) {
          list.push({
            type: 'IMAGE',
            url: imgUrl,
          });
        }
      });
    }
    return list;
  }, [enrichedItem.video_url, enrichedItem.photo_url, enrichedItem.images, item.video_url, item.photo_url, item.images]);

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />

      {/* ── Floating Header ── */}
      <View style={[s.header, { paddingTop: insets.top + 10, flexDirection: 'row', justifyContent: 'space-between', width: '100%' }]} pointerEvents="box-none">
        <PressableScale style={s.backBtn} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back">
          <ChevronLeft size={22} color={tokens.colors.textPrimary} strokeWidth={2.5} />
        </PressableScale>
        
        <PressableScale style={[s.backBtn, { marginRight: 16 }]} onPress={handleShare} accessibilityRole="button" accessibilityLabel="Share item">
          <Share2 size={20} color={tokens.colors.textPrimary} strokeWidth={2.5} />
        </PressableScale>
      </View>

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 160 + insets.bottom }}
        bounces={false}
      >
        {/* ── Hero Media (Video + Multi-Photo Gallery) ── */}
        <Animated.View entering={FadeIn.duration(tokens.motion.duration.normal)} style={[s.heroBox, { width: SCREEN_W, height: Math.round(SCREEN_W * (9 / 16)) }]}>
          {mediaList.length === 0 ? (
            <View style={[s.heroImg, s.heroPlaceholder]}>
              <Text allowFontScaling={false} style={s.heroEmoji}>🍽️</Text>
            </View>
          ) : mediaList.length === 1 && mediaList[0].type === 'IMAGE' ? (
            <NetworkImage uri={mediaList[0].url} style={s.heroImg} />
          ) : (
            <View style={{ width: SCREEN_W, height: Math.round(SCREEN_W * (9 / 16)) }}>
              <FlatList
                data={mediaList}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(_, idx) => String(idx)}
                onMomentumScrollEnd={(ev) => {
                  const newIdx = Math.round(ev.nativeEvent.contentOffset.x / SCREEN_W);
                  setActiveMediaIdx(newIdx);
                }}
                renderItem={({ item: media, index }) => (
                  <View style={{ width: SCREEN_W, height: Math.round(SCREEN_W * (9 / 16)) }}>
                    {media.type === 'VIDEO' ? (
                      <BannerMedia
                        videoUrl={media.url}
                        imageUrl={media.poster}
                        mediaType="VIDEO"
                        isActive={isScreenFocused && activeMediaIdx === index}
                        style={{ width: SCREEN_W, height: Math.round(SCREEN_W * (9 / 16)) }}
                        borderRadius={0}
                      />
                    ) : (
                      <NetworkImage uri={media.url} style={s.heroImg} />
                    )}
                  </View>
                )}
              />

              {/* Gallery Counter Pill */}
              {mediaList.length > 1 && (
                <View style={s.mediaCounterPill}>
                  {mediaList[activeMediaIdx]?.type === 'VIDEO' && (
                    <Text allowFontScaling={false} style={s.videoBadgeText}>▶ </Text>
                  )}
                  <Text allowFontScaling={false} style={s.mediaCounterText}>
                    {activeMediaIdx + 1} / {mediaList.length}
                  </Text>
                </View>
              )}

              {/* Dots indicator */}
              {mediaList.length > 1 && (
                <View style={s.mediaDotsRow}>
                  {mediaList.map((_, i) => (
                    <View
                      key={i}
                      style={[
                        s.mediaDot,
                        i === activeMediaIdx && s.mediaDotActive,
                      ]}
                    />
                  ))}
                </View>
              )}
            </View>
          )}
        </Animated.View>

        {/* ── Item info ── */}
        <Animated.View entering={FadeInDown.duration(tokens.motion.duration.normal).delay(80)} style={s.infoBlock}>
          <View style={s.badgeRow}>
            <View style={[s.vegBox, { borderColor: vegColor }]}>
              <View style={[s.vegDot, { backgroundColor: vegColor }]} />
            </View>
            {!!serveTag && (
              <View style={s.servePill}>
                <Text allowFontScaling={false} style={s.servePillText}>{serveTag}</Text>
              </View>
            )}
            {item.is_bestseller && (
              <View style={s.bestsellerPill}>
                <Text allowFontScaling={false} style={s.bestsellerText}>★ Bestseller</Text>
              </View>
            )}
          </View>

          <Text allowFontScaling={false} style={s.itemName}>{item.name}</Text>

          {/* ── Price & Offer Badge ── */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, marginBottom: 10 }}>
            <Text allowFontScaling={false} style={{ fontSize: 22, fontFamily: tokens.typography.family.black, color: tokens.colors.textPrimary }}>
              ₹{enrichedItem.price_paise / 100}
            </Text>
            {enrichedItem.applied_offer && (
              <>
                {enrichedItem.original_price_paise > enrichedItem.price_paise && (
                  <Text allowFontScaling={false} style={{ fontSize: 16, fontFamily: tokens.typography.family.medium, color: tokens.colors.textTertiary, textDecorationLine: 'line-through' }}>
                    ₹{enrichedItem.original_price_paise / 100}
                  </Text>
                )}
                <View style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                  <Text allowFontScaling={false} style={{ fontSize: 12, fontFamily: tokens.typography.family.extrabold, color: '#15803D' }}>
                    {enrichedItem.applied_offer.discount_type === 'bogo'
                      ? '🎁 BUY 1 GET 1 FREE'
                      : enrichedItem.applied_offer.discount_type === 'flat'
                      ? `₹${(enrichedItem.applied_offer.discount_flat_paise || 0) / 100} OFF`
                      : `${Math.round(parseFloat(enrichedItem.applied_offer.discount_percent || '0'))}% OFF`}
                  </Text>
                </View>
              </>
            )}
          </View>

          {!!item.description && (
            <Text allowFontScaling={false} style={s.itemDesc}>{item.description}</Text>
          )}

          {(item.tags?.length ?? 0) > 0 && (
            <>
              <PressableScale
                style={s.detailToggle}
                onPress={() => setShowDetails(v => !v)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Toggle dish details"
              >
                <Text allowFontScaling={false} style={s.detailToggleText}>
                  {showDetails ? 'Hide dish details ∧' : 'Show dish details ∨'}
                </Text>
              </PressableScale>
              {showDetails && (
                <View style={s.tagsWrap}>
                  {(item.tags as string[]).map((tag: string) => (
                    <View key={tag} style={s.tagChip}>
                      <Text allowFontScaling={false} style={s.tagChipText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </Animated.View>

        {/* ── People also bought ── */}
        {relatedItems.length > 0 && (
          <>
            <View style={s.divider} />
            <View style={s.section}>
              <Text allowFontScaling={false} style={s.sectionTitle}>People also bought</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.relatedRow}
              >
                {relatedItems.map(ri => (
                  <RelatedItemCard
                    key={ri.id}
                    ri={ri}
                    onAdd={handleAddWithCheck}
                    dispatch={dispatch}
                  />
                ))}
              </ScrollView>
            </View>
          </>
        )}

        {/* ── 2QT Brand Section ── */}
        <View style={s.divider} />
        <View style={s.brandSection}>
          {/* Ghost text — "Order it / 2QT IT" mimicking WISH IT / SWISH IT */}
          <View style={s.brandGhostBox} pointerEvents="none">
            <Text allowFontScaling={false} style={s.brandGhostScript}>Order it</Text>
            <Text allowFontScaling={false} style={s.brandGhostBold}>EAT IT</Text>
          </View>
          {/* Bag + side labels */}
          <View style={s.brandRow}>
            <View style={[s.brandSide, { alignItems: 'flex-end' }]}>
              <Text allowFontScaling={false} style={s.brandSideText}>FRESH{'\n'}QUICK{'\n'}DELICIOUS</Text>
            </View>
            <PremiumBag />
            <View style={[s.brandSide, { alignItems: 'flex-start' }]}>
              <Text allowFontScaling={false} style={s.brandSideText}>FRESH FOOD{'\n'}DELIVERED{'\n'}FAST</Text>
            </View>
          </View>
          {/* Tagline */}
          <Text allowFontScaling={false} style={s.brandTagline}>Quality. Quantity. Taste.</Text>
        </View>

        {/* ── Coupon carousel ── */}
        {promos.length > 0 && (
          <>
            <View style={s.divider} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.promoRow}
            >
              {promos.map((promo, idx) => (
                <View key={promo.id ?? idx} style={[s.promoCard, { width: SCREEN_W - 64 }]}>
                  <View style={s.promoIconBox}>
                    <Text allowFontScaling={false} style={s.promoIconText}>%</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text allowFontScaling={false} style={s.promoTitle} numberOfLines={1}>
                      {(promo.discount_type === 'percentage' || promo.discount_type === 'percent')
                        ? `${promo.discount_percent}% upto ₹${(promo.max_discount_paise || 0) / 100} Off`
                        : `₹${(promo.discount_flat_paise || 0) / 100} Off`}
                    </Text>
                    <Text allowFontScaling={false} style={s.promoSub}>
                      USE {promo.code}
                      {promo.min_order_paise ? ` | ABOVE ₹${promo.min_order_paise / 100}` : ''}
                    </Text>
                  </View>
                  <Text allowFontScaling={false} style={s.promoIdx}>{idx + 1}/{promos.length}</Text>
                </View>
              ))}
            </ScrollView>
          </>
        )}
      </ScrollView>

      {/* ── Sticky bottom bar ── */}
      <View style={[s.stickyBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {/* View Cart strip — appears when anything is in the cart */}
        {cartCount > 0 && (
          <PressableScale
            style={s.viewCartRow}
            onPress={() => navigation.navigate('Cart')}
            accessibilityRole="button"
            accessibilityLabel="View Cart"
          >
            <Text allowFontScaling={false} style={s.viewCartLeft}>
              {cartCount} item{cartCount > 1 ? 's' : ''}  ·  ₹{cartTotal % 1 === 0 ? cartTotal : cartTotal.toFixed(0)}
            </Text>
            <Text allowFontScaling={false} style={s.viewCartRight}>View Cart  →</Text>
          </PressableScale>
        )}
        {/* Main item row */}
        <View style={s.stickyMain}>
          <View style={s.stickyLeft}>
            {item.photo_url && (
              <NetworkImage uri={item.photo_url} style={s.stickyThumb} />
            )}
            <Animated.Text allowFontScaling={false} style={[s.stickyPrice, pricePulseStyle]}>
              ₹{totalPrice % 1 === 0 ? totalPrice : totalPrice.toFixed(0)}
            </Animated.Text>
          </View>
          <View style={s.stickyRight}>
            {item.available === false ? (
              <View style={s.soldOutBadge}>
                <Text allowFontScaling={false} style={s.soldOutText}>Sold Out</Text>
              </View>
            ) : (
              <>
                {Array.isArray(item.customization_groups) && item.customization_groups.length > 0 && (
                  <Text allowFontScaling={false} style={s.customiseLabel}>Customise</Text>
                )}
                {qty > 0 ? (
                  <View style={s.qtyControl}>
                    <TouchableOpacity
                      activeOpacity={0.6}
                      style={{ paddingHorizontal: 12, paddingVertical: 4 }}
                      hitSlop={{ top: 12, bottom: 12, left: 14, right: 8 }}
                      onPress={() => { haptics.selection(); dispatch(setQuantity({ menuItemId: item.id, quantity: qty - 1 })); }}
                      accessibilityRole="button"
                      accessibilityLabel="Decrease quantity"
                    >
                      <Text allowFontScaling={false} style={s.qtyCtrlBtn}>−</Text>
                    </TouchableOpacity>
                    <Text allowFontScaling={false} style={s.qtyCtrlVal}>{qty}</Text>
                    <TouchableOpacity
                      activeOpacity={0.6}
                      style={{ paddingHorizontal: 12, paddingVertical: 4 }}
                      hitSlop={{ top: 12, bottom: 12, left: 8, right: 14 }}
                      onPress={() => { haptics.selection(); dispatch(setQuantity({ menuItemId: item.id, quantity: qty + 1 })); }}
                      accessibilityRole="button"
                      accessibilityLabel="Increase quantity"
                    >
                      <Text allowFontScaling={false} style={s.qtyCtrlBtn}>+</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={s.addBtn}
                    activeOpacity={0.7}
                    onPress={() => { haptics.selection(); handleAddWithCheck(enrichedItem); }}
                    accessibilityRole="button"
                    accessibilityLabel="Add to cart"
                  >
                    <Text allowFontScaling={false} style={s.addBtnText}>Add</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>
      </View>
      
      <CustomizationBottomSheet 
        visible={!!activeCustomizationItem}
        onClose={() => setActiveCustomizationItem(null)}
        item={activeCustomizationItem}
        onAddToCart={(customizations, instructions) => {
          if (activeCustomizationItem) {
            handleAdd(activeCustomizationItem, customizations, instructions);
          }
        }}
      />
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.colors.surface },
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: tokens.spacing.lg,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    ...tokens.shadows.soft,
  },

  scroll: { flex: 1 },
  heroBox: { backgroundColor: tokens.colors.background },
  heroImg: { width: '100%', height: '100%' },
  heroPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  heroEmoji: { fontSize: 70 },

  infoBlock: {
    paddingHorizontal: tokens.spacing.xl,
    paddingTop: tokens.spacing.xl,
    paddingBottom: tokens.spacing.xl,
    backgroundColor: tokens.colors.surface,
    borderTopLeftRadius: tokens.radii.xxl,
    borderTopRightRadius: tokens.radii.xxl,
    marginTop: -tokens.spacing.xl,
  },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  vegBox: {
    width: 18,
    height: 18,
    borderRadius: 3,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vegDot: { width: 8, height: 8, borderRadius: 4 },
  servePill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: '#FFFDE7',
    borderWidth: 1,
    borderColor: '#F9E069',
  },
  servePillText: {
    fontSize: 11,
    fontFamily: tokens.typography.family.semibold,
    color: '#7A5C00',
  },
  bestsellerPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  bestsellerText: {
    fontSize: 11,
    fontFamily: tokens.typography.family.semibold,
    color: '#92400E',
  },
  itemName: {
    fontSize: 22,
    fontFamily: tokens.typography.family.black,
    color: tokens.colors.textPrimary,
    lineHeight: 28,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  itemDesc: {
    fontSize: 13,
    fontFamily: tokens.typography.family.regular,
    color: tokens.colors.textSecondary,
    lineHeight: 18,
    marginBottom: 10,
  },
  detailToggle: { alignSelf: 'flex-start', marginTop: 4 },
  detailToggleText: {
    fontSize: 14,
    fontFamily: tokens.typography.family.semibold,
    color: tokens.colors.primary,
  },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#FFEDD5',
  },
  tagChipText: {
    fontSize: 12,
    fontFamily: tokens.typography.family.semibold,
    color: tokens.colors.primary,
  },

  divider: { height: 28 },

  section: { paddingTop: 18, paddingBottom: 6 },
  sectionTitle: {
    fontSize: 17,
    fontFamily: tokens.typography.family.black,
    color: tokens.colors.textPrimary,
    letterSpacing: -0.3,
    marginBottom: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
  },
  relatedRow: { paddingHorizontal: tokens.spacing.lg, paddingBottom: tokens.spacing.lg },

  relatedCard: {
    width: 136,
    backgroundColor: tokens.colors.surface,
    marginRight: tokens.spacing.lg,
  },
  relatedImgBox: {
    width: '100%',
    height: 120,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: tokens.colors.background,
    marginBottom: 24, // Space for the floating button
  },
  relatedImg: { width: '100%', height: '100%' },
  relatedBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  relatedBadgeText: {
    fontSize: 9,
    fontFamily: tokens.typography.family.semibold,
    color: '#92400E',
  },
  relatedAddBtn: {
    position: 'absolute',
    top: 104,
    alignSelf: 'center',
    width: 90,
    height: 32,
    borderRadius: 16,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...tokens.shadows.soft,
    zIndex: 10,
  },
  relatedAddText: {
    fontSize: 14,
    color: tokens.colors.primary,
    fontFamily: tokens.typography.family.black,
    letterSpacing: 0.5,
  },
  relatedQtyBox: {
    position: 'absolute',
    top: 104,
    alignSelf: 'center',
    width: 90,
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.colors.primary,
    borderRadius: 16,
    paddingHorizontal: 12,
    ...tokens.shadows.soft,
    zIndex: 10,
  },
  relatedQtyBtn: {
    fontSize: 18,
    color: tokens.colors.surface,
    fontFamily: tokens.typography.family.bold,
    lineHeight: 20,
  },
  relatedQtyVal: {
    fontSize: 14,
    color: tokens.colors.surface,
    fontFamily: tokens.typography.family.bold,
    textAlign: 'center',
  },
  relatedMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  relatedName: {
    fontSize: 13,
    fontFamily: tokens.typography.family.bold,
    color: tokens.colors.textPrimary,
    lineHeight: 18,
    marginBottom: 4,
  },
  relatedPrice: {
    fontSize: 14,
    fontFamily: tokens.typography.family.extrabold,
    color: tokens.colors.textPrimary,
    letterSpacing: -0.3,
  },

  // 2QT Brand section
  brandSection: {
    paddingTop: 30,
    paddingBottom: 40,
    overflow: 'hidden',
    backgroundColor: tokens.colors.surface,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandGhostBox: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 0,
  },
  brandGhostScript: {
    fontFamily: tokens.typography.family.medium,
    fontStyle: 'italic',
    fontSize: 54,
    color: 'rgba(0,0,0,0.035)',
    letterSpacing: 2,
    lineHeight: 60,
  },
  brandGhostBold: {
    fontFamily: tokens.typography.family.black,
    fontSize: 64,
    color: 'rgba(0,0,0,0.035)',
    letterSpacing: 4,
    lineHeight: 70,
    marginTop: -20,
  },
  brandTagline: {
    fontFamily: tokens.typography.family.medium,
    fontSize: 11,
    color: 'rgba(0,0,0,0.28)',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginTop: 20,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 20,
    zIndex: 1,
  },
  brandSide: { flex: 1 },
  brandSideText: {
    fontSize: 10,
    fontFamily: tokens.typography.family.bold,
    color: 'rgba(0,0,0,0.25)',
    letterSpacing: 1.2,
    lineHeight: 18,
  },

  // Coupon
  promoRow: { paddingHorizontal: tokens.spacing.lg, paddingVertical: 14, gap: 10 },
  promoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F0FBF0',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  promoIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoIconText: { fontSize: 16, color: tokens.colors.surface, fontFamily: tokens.typography.family.black },
  promoTitle: { fontSize: 13, fontFamily: tokens.typography.family.bold, color: tokens.colors.primary, lineHeight: 18 },
  promoSub: {
    fontSize: 11,
    fontFamily: tokens.typography.family.semibold,
    color: tokens.colors.primary,
    opacity: 0.7,
    marginTop: 1,
  },
  promoIdx: { fontSize: 11, fontFamily: tokens.typography.family.semibold, color: tokens.colors.textSecondary, alignSelf: 'flex-start' },

  // Sticky bar
  stickyBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: tokens.colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.colors.border,
    flexDirection: 'column',
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: 10,
  },
  viewCartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.colors.primary,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  viewCartLeft: {
    fontSize: 13,
    fontFamily: tokens.typography.family.semibold,
    color: tokens.colors.surface,
  },
  viewCartRight: {
    fontSize: 13,
    fontFamily: tokens.typography.family.extrabold,
    color: tokens.colors.surface,
    letterSpacing: 0.2,
  },
  stickyMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stickyLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stickyThumb: { width: 48, height: 48, borderRadius: 20, backgroundColor: tokens.colors.background },
  stickyPrice: { fontSize: 22, fontFamily: tokens.typography.family.black, color: tokens.colors.textPrimary, letterSpacing: -0.5 },
  stickyRight: { alignItems: 'flex-end', justifyContent: 'center' },
  customiseLabel: {
    fontSize: 10,
    fontFamily: tokens.typography.family.bold,
    color: tokens.colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 4,
    marginRight: 4,
  },
  addBtn: {
    width: 116,
    height: 42,
    backgroundColor: tokens.colors.primary,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { fontSize: 17, fontFamily: tokens.typography.family.extrabold, color: tokens.colors.surface, letterSpacing: 0.3 },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.primary,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 14,
    width: 116,
    justifyContent: 'center',
  },
  qtyCtrlBtn: { fontSize: 22, fontFamily: tokens.typography.family.bold, color: tokens.colors.surface, lineHeight: 26 },
  qtyCtrlVal: {
    fontSize: 17,
    fontFamily: tokens.typography.family.bold,
    color: tokens.colors.surface,
    minWidth: 22,
    textAlign: 'center',
  },
  soldOutBadge: {
    width: 116,
    height: 42,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soldOutText: {
    fontSize: 14,
    fontFamily: tokens.typography.family.bold,
    color: '#9E9E9E',
    letterSpacing: 0.3,
  },
  mediaCounterPill: {
    position: 'absolute',
    bottom: 36,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  videoBadgeText: {
    fontSize: 11,
    color: '#C084FC',
    fontFamily: tokens.typography.family.extrabold,
  },
  mediaCounterText: {
    fontSize: 11,
    fontFamily: tokens.typography.family.bold,
    color: '#FFF',
    letterSpacing: 0.5,
  },
  mediaDotsRow: {
    position: 'absolute',
    bottom: 38,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    zIndex: 10,
  },
  mediaDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  mediaDotActive: {
    width: 18,
    backgroundColor: '#FFF',
  },
});

export default ItemDetailScreen;
