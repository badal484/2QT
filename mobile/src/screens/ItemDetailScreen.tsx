import React, { useState, useCallback, useMemo, useRef } from 'react';
import { BouncingButton } from '../components/ui/BouncingButton';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, useWindowDimensions, Alert, Image
} from 'react-native';
import Svg, { Path, Rect, Circle, Text as SvgText, Line, Ellipse } from 'react-native-svg';
import { useDispatch, useSelector } from 'react-redux';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { NetworkImage } from '../components/NetworkImage';
import { CustomizationBottomSheet } from '../components/ui/CustomizationBottomSheet';
import { RootState } from '../store';
import { addItem, setQuantity, clearCart } from '../store/slices/cartSlice';
import { api } from '../api/client';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';



const PremiumBag = () => (
  <View style={{ width: 180, height: 240, alignItems: 'center', justifyContent: 'center' }}>
    {/* White 2QT bag with transparent background */}
    <Image 
      source={require('../../assets/images/white_bag_2qt_clean_transparent.png')} 
      style={{ width: '100%', height: '100%' }} 
      resizeMode="contain" 
    />
  </View>
);

function haptic() {
  ReactNativeHapticFeedback.trigger('impactLight', {
    enableVibrateFallback: false,
    ignoreAndroidSystemSettings: true,
  });
}

const RelatedItemCard = React.memo(({ ri, onAdd, dispatch, navigation }: any) => {
  const riCart = useSelector((state: RootState) => state.cart.items.find(ci => ci.menuItemId === ri.id));
  const riVeg = ri.is_egg ? '#EAB308' : ri.is_veg ? '#22C55E' : '#EF4444';
  return (
    <BouncingButton
      style={s.relatedCard}
      activeOpacity={0.92}
      onPress={() => navigation.replace('ItemDetail', { item: ri })}
    >
      <View style={s.relatedImgBox}>
        {ri.photo_url ? (
          <NetworkImage uri={ri.photo_url} style={s.relatedImg} />
        ) : (
          <View style={[s.relatedImg, s.heroPlaceholder]}>
            <Text style={{ fontSize: 24 }}>🍽️</Text>
          </View>
        )}
        {ri.is_bestseller && (
          <View style={s.relatedBadge}>
            <Text style={s.relatedBadgeText}>★ Bestseller</Text>
          </View>
        )}
      </View>
      {ri.available && !riCart ? (
        <BouncingButton style={s.relatedAddBtn} onPress={() => { haptic(); onAdd(ri); }} activeOpacity={0.85}>
          <Text style={s.relatedAddText}>ADD</Text>
        </BouncingButton>
      ) : ri.available && riCart ? (
        <View style={s.relatedQtyBox}>
          <BouncingButton hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => { haptic(); dispatch(setQuantity({ menuItemId: ri.id, quantity: riCart.quantity - 1 })); }}>
            <Text style={s.relatedQtyBtn}>−</Text>
          </BouncingButton>
          <Text style={s.relatedQtyVal}>{riCart.quantity}</Text>
          <BouncingButton hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => { haptic(); dispatch(setQuantity({ menuItemId: ri.id, quantity: riCart.quantity + 1 })); }}>
            <Text style={s.relatedQtyBtn}>+</Text>
          </BouncingButton>
        </View>
      ) : null}
      <View style={s.relatedMeta}>
        <View style={[s.vegBox, { borderColor: riVeg, width: 14, height: 14, borderRadius: 2 }]}>
          <View style={[s.vegDot, { backgroundColor: riVeg, width: 6, height: 6, borderRadius: 3 }]} />
        </View>
        {ri.tags?.[0] && (
          <View style={[s.servePill, { paddingHorizontal: 6, paddingVertical: 2 }]}>
            <Text style={[s.servePillText, { fontSize: 9 }]}>{ri.tags[0]}</Text>
          </View>
        )}
      </View>
      <Text style={s.relatedName} numberOfLines={2}>{ri.name}</Text>
      <Text style={s.relatedPrice}>₹{ri.price_paise / 100}</Text>
    </BouncingButton>
  );
});

const ItemDetailScreen = ({ route, navigation }: any) => {
  const { width: SCREEN_W } = useWindowDimensions();
  const { item } = route.params;
  const dispatch = useDispatch();
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

  const vegColor = item.is_egg ? '#EAB308' : item.is_veg ? '#22C55E' : '#EF4444';
  const price = item.price_paise / 100;
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
          pricePaise: itemToAdd.price_paise,
          quantity: 1,
          photoUrl: itemToAdd.photo_url,
          isVeg: itemToAdd.is_veg,
          kitchenId: itemToAdd.kitchen_id,
          customizations: customizations.length > 0 ? customizations : undefined,
          instructions: instructions || undefined,
        }),
      );
    const current = cartItemsRef.current;
    if (current.length > 0 && current[0].kitchenId !== itemToAdd.kitchen_id) {
      Alert.alert('Replace cart?', 'Your cart has items from a different kitchen.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Replace', style: 'destructive', onPress: () => { dispatch(clearCart()); doAdd(); } },
      ]);
    } else {
      doAdd();
    }
  }, [dispatch]);

  const handleAddWithCheck = useCallback((itemToAdd: any) => {
    if (itemToAdd.customization_groups?.length > 0) {
      setActiveCustomizationItem(itemToAdd);
    } else {
      handleAdd(itemToAdd, [], '');
    }
  }, [handleAdd]);

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />

      {/* ── Floating Header ── */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]} pointerEvents="box-none">
        <BouncingButton style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <ChevronLeft size={22} color={colors.ink} strokeWidth={2.5} />
        </BouncingButton>
      </View>

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 160 + insets.bottom }}
        bounces={false}
      >
        {/* ── Hero image ── */}
        <View style={[s.heroBox, { width: SCREEN_W, height: Math.round(SCREEN_W * 0.82) }]}>
          {item.photo_url ? (
            <NetworkImage uri={item.photo_url} style={s.heroImg} />
          ) : (
            <View style={[s.heroImg, s.heroPlaceholder]}>
              <Text style={s.heroEmoji}>🍽️</Text>
            </View>
          )}
        </View>

        {/* ── Item info ── */}
        <View style={s.infoBlock}>
          <View style={s.badgeRow}>
            <View style={[s.vegBox, { borderColor: vegColor }]}>
              <View style={[s.vegDot, { backgroundColor: vegColor }]} />
            </View>
            {!!serveTag && (
              <View style={s.servePill}>
                <Text style={s.servePillText}>{serveTag}</Text>
              </View>
            )}
            {item.is_bestseller && (
              <View style={s.bestsellerPill}>
                <Text style={s.bestsellerText}>★ Bestseller</Text>
              </View>
            )}
          </View>

          <Text style={s.itemName}>{item.name}</Text>

          {!!item.description && (
            <Text style={s.itemDesc}>{item.description}</Text>
          )}

          {(item.tags?.length ?? 0) > 0 && (
            <>
              <BouncingButton
                style={s.detailToggle}
                onPress={() => { haptic(); setShowDetails(v => !v); }}
                activeOpacity={0.7}
              >
                <Text style={s.detailToggleText}>
                  {showDetails ? 'Hide dish details ∧' : 'Show dish details ∨'}
                </Text>
              </BouncingButton>
              {showDetails && (
                <View style={s.tagsWrap}>
                  {(item.tags as string[]).map((tag: string) => (
                    <View key={tag} style={s.tagChip}>
                      <Text style={s.tagChipText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </View>

        {/* ── People also bought ── */}
        {relatedItems.length > 0 && (
          <>
            <View style={s.divider} />
            <View style={s.section}>
              <Text style={s.sectionTitle}>People also bought</Text>
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
                    navigation={navigation}
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
            <Text style={s.brandGhostScript}>Order it</Text>
            <Text style={s.brandGhostBold}>2QT IT</Text>
          </View>
          {/* Bag + side labels */}
          <View style={s.brandRow}>
            <View style={[s.brandSide, { alignItems: 'flex-end' }]}>
              <Text style={s.brandSideText}>FRESH{'\n'}QUICK{'\n'}DELICIOUS</Text>
            </View>
            <PremiumBag />
            <View style={[s.brandSide, { alignItems: 'flex-start' }]}>
              <Text style={s.brandSideText}>FRESH FOOD{'\n'}DELIVERED{'\n'}FAST</Text>
            </View>
          </View>
          {/* Tagline */}
          <Text style={s.brandTagline}>Quality. Quantity. Taste.</Text>
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
                    <Text style={s.promoIconText}>%</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.promoTitle} numberOfLines={1}>
                      {promo.discount_type === 'percentage'
                        ? `${promo.discount_percent}% upto ₹${promo.max_discount_paise / 100} Off`
                        : `₹${promo.discount_flat_paise / 100} Off`}
                    </Text>
                    <Text style={s.promoSub}>
                      USE {promo.code}
                      {promo.min_order_paise ? ` | ABOVE ₹${promo.min_order_paise / 100}` : ''}
                    </Text>
                  </View>
                  <Text style={s.promoIdx}>{idx + 1}/{promos.length}</Text>
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
          <BouncingButton
            style={s.viewCartRow}
            onPress={() => navigation.navigate('Cart')}
            activeOpacity={0.88}
          >
            <Text style={s.viewCartLeft}>
              {cartCount} item{cartCount > 1 ? 's' : ''}  ·  ₹{cartTotal % 1 === 0 ? cartTotal : cartTotal.toFixed(0)}
            </Text>
            <Text style={s.viewCartRight}>View Cart  →</Text>
          </BouncingButton>
        )}
        {/* Main item row */}
        <View style={s.stickyMain}>
          <View style={s.stickyLeft}>
            {item.photo_url && (
              <NetworkImage uri={item.photo_url} style={s.stickyThumb} />
            )}
            <Text style={s.stickyPrice}>
              ₹{totalPrice % 1 === 0 ? totalPrice : totalPrice.toFixed(0)}
            </Text>
          </View>
          <View style={s.stickyRight}>
            {item.available === false ? (
              <View style={s.soldOutBadge}>
                <Text style={s.soldOutText}>Sold Out</Text>
              </View>
            ) : (
              <>
                <Text style={s.customiseLabel}>Customise</Text>
                {qty > 0 ? (
                  <View style={s.qtyControl}>
                    <BouncingButton
                      hitSlop={{ top: 8, bottom: 8, left: 10, right: 6 }}
                      onPress={() => { haptic(); dispatch(setQuantity({ menuItemId: item.id, quantity: qty - 1 })); }}
                    >
                      <Text style={s.qtyCtrlBtn}>−</Text>
                    </BouncingButton>
                    <Text style={s.qtyCtrlVal}>{qty}</Text>
                    <BouncingButton
                      hitSlop={{ top: 8, bottom: 8, left: 6, right: 10 }}
                      onPress={() => { haptic(); dispatch(setQuantity({ menuItemId: item.id, quantity: qty + 1 })); }}
                    >
                      <Text style={s.qtyCtrlBtn}>+</Text>
                    </BouncingButton>
                  </View>
                ) : (
                  <BouncingButton
                    style={s.addBtn}
                    onPress={() => { haptic(); handleAddWithCheck(item); }}
                    activeOpacity={0.88}
                  >
                    <Text style={s.addBtnText}>Add</Text>
                  </BouncingButton>
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
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  scroll: { flex: 1 },
  heroBox: { backgroundColor: '#F9FAFB' },
  heroImg: { width: '100%', height: '100%' },
  heroPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  heroEmoji: { fontSize: 70 },

  infoBlock: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24,
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
    fontFamily: fontFamily.semibold,
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
    fontFamily: fontFamily.semibold,
    color: '#92400E',
  },
  itemName: {
    fontSize: 22,
    fontFamily: fontFamily.black,
    color: colors.ink,
    lineHeight: 28,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  itemDesc: {
    fontSize: 13,
    fontFamily: fontFamily.regular,
    color: colors.inkMuted,
    lineHeight: 18,
    marginBottom: 10,
  },
  detailToggle: { alignSelf: 'flex-start', marginTop: 4 },
  detailToggleText: {
    fontSize: 14,
    fontFamily: fontFamily.semibold,
    color: colors.primary,
  },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: colors.primaryTint,
  },
  tagChipText: {
    fontSize: 12,
    fontFamily: fontFamily.semibold,
    color: colors.primary,
  },

  divider: { height: 28 },

  section: { paddingTop: 18, paddingBottom: 6 },
  sectionTitle: {
    fontSize: 17,
    fontFamily: fontFamily.black,
    color: colors.ink,
    letterSpacing: -0.3,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  relatedRow: { paddingHorizontal: 16, paddingBottom: 16 },

  relatedCard: {
    width: 130,
    backgroundColor: '#FFFFFF',
    marginRight: 16,
  },
  relatedImgBox: {
    width: '100%',
    height: 120,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#F9FAFB',
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
    fontFamily: fontFamily.semibold,
    color: '#92400E',
  },
  relatedAddBtn: {
    position: 'absolute',
    top: 104, // 120 (img height) - 16 (half of btn height)
    alignSelf: 'center',
    width: 90,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    zIndex: 10,
  },
  relatedAddText: {
    fontSize: 14,
    color: colors.primary,
    fontFamily: fontFamily.black,
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
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    zIndex: 10,
  },
  relatedQtyBtn: {
    fontSize: 18,
    color: '#FFFFFF',
    fontFamily: fontFamily.bold,
    lineHeight: 20,
  },
  relatedQtyVal: {
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: fontFamily.bold,
    textAlign: 'center',
  },
  relatedMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  relatedName: {
    fontSize: 13,
    fontFamily: fontFamily.bold,
    color: colors.ink,
    lineHeight: 18,
    marginBottom: 4,
  },
  relatedPrice: {
    fontSize: 14,
    fontFamily: fontFamily.extrabold,
    color: colors.ink,
    letterSpacing: -0.3,
  },

  // 2QT Brand section
  brandSection: {
    paddingTop: 30,
    paddingBottom: 40,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
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
    fontFamily: fontFamily.medium,
    fontStyle: 'italic',
    fontSize: 54,
    color: 'rgba(0,0,0,0.035)',
    letterSpacing: 2,
    lineHeight: 60,
  },
  brandGhostBold: {
    fontFamily: fontFamily.black,
    fontSize: 64,
    color: 'rgba(0,0,0,0.035)',
    letterSpacing: 4,
    lineHeight: 70,
    marginTop: -20,
  },
  brandTagline: {
    fontFamily: fontFamily.medium,
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
    fontFamily: fontFamily.bold,
    color: 'rgba(0,0,0,0.25)',
    letterSpacing: 1.2,
    lineHeight: 18,
  },

  // Coupon
  promoRow: { paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
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
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoIconText: { fontSize: 16, color: '#FFFFFF', fontFamily: fontFamily.black },
  promoTitle: { fontSize: 13, fontFamily: fontFamily.bold, color: colors.primary, lineHeight: 18 },
  promoSub: {
    fontSize: 11,
    fontFamily: fontFamily.semibold,
    color: colors.primary,
    opacity: 0.7,
    marginTop: 1,
  },
  promoIdx: { fontSize: 11, fontFamily: fontFamily.semibold, color: colors.inkMuted, alignSelf: 'flex-start' },

  // Sticky bar
  stickyBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    flexDirection: 'column',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  viewCartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  viewCartLeft: {
    fontSize: 13,
    fontFamily: fontFamily.semibold,
    color: '#FFFFFF',
  },
  viewCartRight: {
    fontSize: 13,
    fontFamily: fontFamily.extrabold,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  stickyMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stickyLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stickyThumb: { width: 48, height: 48, borderRadius: 20, backgroundColor: '#F9FAFB' },
  stickyPrice: { fontSize: 22, fontFamily: fontFamily.black, color: colors.ink, letterSpacing: -0.5 },
  stickyRight: { alignItems: 'flex-end', justifyContent: 'center' },
  customiseLabel: {
    fontSize: 10,
    fontFamily: fontFamily.bold,
    color: colors.inkMuted,
    letterSpacing: 0.5,
    marginBottom: 4,
    marginRight: 4,
  },
  addBtn: {
    width: 116,
    height: 42,
    backgroundColor: colors.primary,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { fontSize: 17, fontFamily: fontFamily.extrabold, color: '#FFFFFF', letterSpacing: 0.3 },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 14,
    width: 116,
    justifyContent: 'center',
  },
  qtyCtrlBtn: { fontSize: 22, fontFamily: fontFamily.bold, color: '#FFFFFF', lineHeight: 26 },
  qtyCtrlVal: {
    fontSize: 17,
    fontFamily: fontFamily.bold,
    color: '#FFFFFF',
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
    fontFamily: fontFamily.bold,
    color: '#9E9E9E',
    letterSpacing: 0.3,
  },
});

export default ItemDetailScreen;
