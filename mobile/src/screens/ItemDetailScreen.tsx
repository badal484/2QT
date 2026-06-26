import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, Dimensions, Alert,
} from 'react-native';
import Svg, { Path, Rect, Circle, Text as SvgText, Line } from 'react-native-svg';
import { useDispatch, useSelector } from 'react-redux';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { NetworkImage } from '../components/NetworkImage';
import { RootState } from '../store';
import { addItem, setQuantity, clearCart } from '../store/slices/cartSlice';
import { api } from '../api/client';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';

const { width: SCREEN_W } = Dimensions.get('window');
const HERO_H = Math.round(SCREEN_W * 0.82);
const GREEN = '#2E7D32';
const GREEN_LIGHT = '#E8F5E9';

const Bag2QT = () => (
  <Svg width={148} height={200} viewBox="0 0 148 200">
    {/* ── Right gusset — 3D side depth panel ── */}
    <Path d="M 94 65 L 118 50 L 118 172 L 94 182 Z" fill="#C4C4C4" />

    {/* ── Top-right triangle — fold seen from gusset angle ── */}
    <Path d="M 94 65 L 118 50 L 56 30 Z" fill="#ADADAD" />

    {/* ── Bag front body ── */}
    <Rect x="12" y="65" width="82" height="117" fill="#FFFFFF" stroke="#E0E0E0" strokeWidth="1.5" />

    {/* ── Left edge depth shadow ── */}
    <Rect x="12" y="65" width="7" height="117" fill="rgba(0,0,0,0.045)" />

    {/* ── Top fold panel (tent fold) ── */}
    <Path d="M 12 65 L 56 30 L 94 65 Z" fill="#EFEFEF" />

    {/* ── Fold crease line ── */}
    <Line x1="12" y1="65" x2="94" y2="65" stroke="rgba(0,0,0,0.09)" strokeWidth="1.2" />

    {/* ── Seal — green circle on fold crease ── */}
    <Circle cx="56" cy="65" r="16" fill={GREEN} />

    {/* ── Seal inner ring ── */}
    <Circle cx="56" cy="65" r="13" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />

    {/* ── 4-pointed star (yellow) ── */}
    <Path
      d="M 56 57 L 58.2 62.8 L 64 65 L 58.2 67.2 L 56 73 L 53.8 67.2 L 48 65 L 53.8 62.8 Z"
      fill="#FFD600"
    />

    {/* ── ✦ sparkle before logo ── */}
    <SvgText x="16" y="166" fill={GREEN} fontSize="13" fontWeight="bold">✦</SvgText>

    {/* ── 2QT logo ── */}
    <SvgText x="32" y="166" fill={GREEN} fontSize="22" fontWeight="bold">2QT</SvgText>
  </Svg>
);

function haptic() {
  ReactNativeHapticFeedback.trigger('impactLight', {
    enableVibrateFallback: false,
    ignoreAndroidSystemSettings: true,
  });
}

const ItemDetailScreen = ({ route, navigation }: any) => {
  const { item } = route.params;
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const cartItems = useSelector((state: RootState) => state.cart.items);
  const cartItem = useSelector((state: RootState) =>
    state.cart.items.find(ci => ci.menuItemId === item.id),
  );
  const zoneId = useSelector((state: RootState) => state.cart.zoneId);

  const [showDetails, setShowDetails] = useState(false);

  const menuData = queryClient.getQueryData<any>(['menu', zoneId]);
  const relatedItems: any[] = (menuData?.items ?? [])
    .filter((i: any) => i.category === item.category && i.id !== item.id && i.available)
    .slice(0, 6);

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
  const cartCount = cartItems.reduce((sum, ci) => sum + ci.quantity, 0);
  const cartTotal = cartItems.reduce((sum, ci) => sum + (ci.pricePaise / 100) * ci.quantity, 0);

  const serveTag = (item.tags as string[] | undefined)?.find(t =>
    /serves|ml|g\b|kg/i.test(t),
  ) ?? item.tags?.[0];

  const handleAdd = () => {
    const doAdd = () =>
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
    if (cartItems.length > 0 && cartItems[0].kitchenId !== item.kitchen_id) {
      Alert.alert('Replace cart?', 'Your cart has items from a different kitchen.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Replace',
          style: 'destructive',
          onPress: () => {
            dispatch(clearCart());
            doAdd();
          },
        },
      ]);
    } else {
      doAdd();
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />

      {/* ── Header ── */}
      <View style={[s.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <ChevronLeft size={22} color={colors.ink} strokeWidth={2.5} />
        </TouchableOpacity>
        <View style={s.headerMid}>
          <Text style={s.headerTitle} numberOfLines={1}>{item.name}</Text>
          {!!serveTag && <Text style={s.headerSub}>{serveTag}</Text>}
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 160 + insets.bottom }}
      >
        {/* ── Hero image ── */}
        <View style={s.heroBox}>
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
              <TouchableOpacity
                style={s.detailToggle}
                onPress={() => { haptic(); setShowDetails(v => !v); }}
                activeOpacity={0.7}
              >
                <Text style={s.detailToggleText}>
                  {showDetails ? 'Hide dish details ∧' : 'Show dish details ∨'}
                </Text>
              </TouchableOpacity>
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
                {relatedItems.map(ri => {
                  const riCart = cartItems.find(ci => ci.menuItemId === ri.id);
                  const riVeg = ri.is_egg ? '#EAB308' : ri.is_veg ? '#22C55E' : '#EF4444';
                  return (
                    <TouchableOpacity
                      key={ri.id}
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
                        {ri.available && !riCart ? (
                          <TouchableOpacity
                            style={s.relatedAddBtn}
                            onPress={() => {
                              haptic();
                              dispatch(addItem({
                                menuItemId: ri.id, name: ri.name,
                                pricePaise: ri.price_paise, quantity: 1,
                                photoUrl: ri.photo_url, isVeg: ri.is_veg,
                                kitchenId: ri.kitchen_id,
                              }));
                            }}
                            activeOpacity={0.85}
                          >
                            <Text style={s.relatedAddText}>+</Text>
                          </TouchableOpacity>
                        ) : ri.available && riCart ? (
                          <View style={s.relatedQtyBox}>
                            <TouchableOpacity
                              hitSlop={{ top: 6, bottom: 6, left: 8, right: 4 }}
                              onPress={() => { haptic(); dispatch(setQuantity({ menuItemId: ri.id, quantity: riCart.quantity - 1 })); }}
                            >
                              <Text style={s.relatedQtyBtn}>−</Text>
                            </TouchableOpacity>
                            <Text style={s.relatedQtyVal}>{riCart.quantity}</Text>
                            <TouchableOpacity
                              hitSlop={{ top: 6, bottom: 6, left: 4, right: 8 }}
                              onPress={() => { haptic(); dispatch(setQuantity({ menuItemId: ri.id, quantity: riCart.quantity + 1 })); }}
                            >
                              <Text style={s.relatedQtyBtn}>+</Text>
                            </TouchableOpacity>
                          </View>
                        ) : null}
                      </View>
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
                    </TouchableOpacity>
                  );
                })}
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
            <Bag2QT />
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
                <View key={promo.id ?? idx} style={s.promoCard}>
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
          <TouchableOpacity
            style={s.viewCartRow}
            onPress={() => navigation.navigate('Cart')}
            activeOpacity={0.88}
          >
            <Text style={s.viewCartLeft}>
              {cartCount} item{cartCount > 1 ? 's' : ''}  ·  ₹{cartTotal % 1 === 0 ? cartTotal : cartTotal.toFixed(0)}
            </Text>
            <Text style={s.viewCartRight}>View Cart  →</Text>
          </TouchableOpacity>
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
                    <TouchableOpacity
                      hitSlop={{ top: 8, bottom: 8, left: 10, right: 6 }}
                      onPress={() => { haptic(); dispatch(setQuantity({ menuItemId: item.id, quantity: qty - 1 })); }}
                    >
                      <Text style={s.qtyCtrlBtn}>−</Text>
                    </TouchableOpacity>
                    <Text style={s.qtyCtrlVal}>{qty}</Text>
                    <TouchableOpacity
                      hitSlop={{ top: 8, bottom: 8, left: 6, right: 10 }}
                      onPress={() => { haptic(); dispatch(setQuantity({ menuItemId: item.id, quantity: qty + 1 })); }}
                    >
                      <Text style={s.qtyCtrlBtn}>+</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={s.addBtn}
                    onPress={() => { haptic(); handleAdd(); }}
                    activeOpacity={0.88}
                  >
                    <Text style={s.addBtnText}>Add</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerMid: { flex: 1 },
  headerTitle: {
    fontSize: 17,
    fontFamily: fontFamily.bold,
    color: colors.ink,
    lineHeight: 22,
  },
  headerSub: {
    fontSize: 12,
    fontFamily: fontFamily.regular,
    color: colors.inkMuted,
    marginTop: 1,
  },

  scroll: { flex: 1 },

  heroBox: { width: SCREEN_W, height: HERO_H, backgroundColor: colors.background },
  heroImg: { width: '100%', height: '100%' },
  heroPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F0F0' },
  heroEmoji: { fontSize: 64 },

  infoBlock: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20 },
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
    fontSize: 28,
    fontFamily: fontFamily.black,
    color: colors.ink,
    lineHeight: 34,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  itemDesc: {
    fontSize: 14,
    fontFamily: fontFamily.regular,
    color: colors.inkMuted,
    lineHeight: 22,
    marginBottom: 14,
  },
  detailToggle: { alignSelf: 'flex-start', marginTop: 4 },
  detailToggleText: {
    fontSize: 14,
    fontFamily: fontFamily.semibold,
    color: GREEN,
  },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: GREEN_LIGHT,
  },
  tagChipText: {
    fontSize: 12,
    fontFamily: fontFamily.semibold,
    color: GREEN,
  },

  divider: { height: 28 },

  section: { paddingTop: 18, paddingBottom: 6 },
  sectionTitle: {
    fontSize: 19,
    fontFamily: fontFamily.black,
    color: colors.ink,
    letterSpacing: -0.3,
    marginBottom: 14,
    paddingHorizontal: 20,
  },
  relatedRow: { paddingHorizontal: 16, gap: 12 },

  relatedCard: {
    width: 148,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    padding: 8,
    marginBottom: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  relatedImgBox: {
    width: '100%',
    height: 120,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#F0F0F0',
    marginBottom: 8,
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
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  relatedAddText: {
    fontSize: 20,
    color: '#FFFFFF',
    lineHeight: 24,
    fontFamily: fontFamily.bold,
  },
  relatedQtyBox: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GREEN,
    borderRadius: 14,
    paddingHorizontal: 6,
    paddingVertical: 4,
    gap: 6,
  },
  relatedQtyBtn: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: fontFamily.bold,
    lineHeight: 18,
  },
  relatedQtyVal: {
    fontSize: 13,
    color: '#FFFFFF',
    fontFamily: fontFamily.bold,
    minWidth: 14,
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
    paddingTop: 12,
    paddingBottom: 28,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  brandGhostBox: {
    alignItems: 'center',
    marginBottom: 4,
  },
  brandGhostScript: {
    fontFamily: fontFamily.medium,
    fontStyle: 'italic',
    fontSize: 34,
    color: 'rgba(0,0,0,0.055)',
    letterSpacing: 1,
    lineHeight: 38,
  },
  brandGhostBold: {
    fontFamily: fontFamily.black,
    fontSize: 40,
    color: 'rgba(0,0,0,0.055)',
    letterSpacing: 5,
    lineHeight: 44,
    marginTop: -6,
  },
  brandTagline: {
    fontFamily: fontFamily.medium,
    fontSize: 11,
    color: 'rgba(0,0,0,0.28)',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginTop: 10,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 16,
  },
  brandSide: { flex: 1 },
  brandSideText: {
    fontSize: 9,
    fontFamily: fontFamily.semibold,
    color: 'rgba(0,0,0,0.28)',
    letterSpacing: 1.5,
    lineHeight: 17,
  },

  // Coupon
  promoRow: { paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  promoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F0FBF0',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    width: SCREEN_W - 64,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  promoIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoIconText: { fontSize: 16, color: '#FFFFFF', fontFamily: fontFamily.black },
  promoTitle: { fontSize: 13, fontFamily: fontFamily.bold, color: GREEN, lineHeight: 18 },
  promoSub: {
    fontSize: 11,
    fontFamily: fontFamily.semibold,
    color: GREEN,
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
    borderTopColor: colors.border,
    flexDirection: 'column',
    paddingHorizontal: 16,
    paddingTop: 10,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -3 },
  },
  viewCartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: GREEN,
    borderRadius: 10,
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
  stickyLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stickyThumb: { width: 44, height: 44, borderRadius: 10, backgroundColor: colors.background },
  stickyPrice: { fontSize: 20, fontFamily: fontFamily.black, color: colors.ink, letterSpacing: -0.5 },
  stickyRight: { alignItems: 'center' },
  customiseLabel: {
    fontSize: 10,
    fontFamily: fontFamily.medium,
    color: colors.inkMuted,
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  addBtn: {
    width: 116,
    height: 42,
    backgroundColor: GREEN,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { fontSize: 17, fontFamily: fontFamily.extrabold, color: '#FFFFFF', letterSpacing: 0.3 },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GREEN,
    borderRadius: 10,
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
    borderRadius: 10,
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
