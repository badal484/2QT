import React, { useState } from 'react';
import { isKitchenOpen, formatTime12h } from '../utils/kitchenHours';
import { BouncingButton } from '../components/ui/BouncingButton';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Image,
  ActivityIndicator, Alert, StyleSheet,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, interpolateColor, FadeIn, FadeInDown, SlideInDown } from 'react-native-reanimated';
import { useSelector, useDispatch } from 'react-redux';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { RootState } from '../store';
import { api } from '../api/client';
import { setQuantity, clearCart, setPromoCode as setPromoCodeAction, addItem as addItemAction } from '../store/slices/cartSlice';
import { getSocket } from '../socket/client';
import { MapPin, ShoppingCart, X, ChefHat, Tag, Star, Wallet, UserRound, Phone, CheckCircle2, Heart, Clock } from 'lucide-react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import RazorpayCheckout from 'react-native-razorpay';

const hapticOptions = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };
const triggerHaptic = () => ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);

const ACCENT = colors.accent;
const BG = colors.background;

// ── Custom cross-platform toggle ──────────────────────────────────────────────
const Toggle = ({ value, onValueChange, activeColor = ACCENT }: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  activeColor?: string;
}) => {
  const progress = useSharedValue(value ? 1 : 0);

  React.useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: 200 });
  }, [value]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ['#D1D5DB', activeColor]),
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withTiming(value ? 20 : 2, { duration: 200 }) }],
  }));

  return (
    <BouncingButton activeOpacity={0.8} onPress={() => { triggerHaptic(); onValueChange(!value); }}>
      <Animated.View style={[toggleStyles.track, trackStyle]}>
        <Animated.View style={[toggleStyles.thumb, thumbStyle]} />
      </Animated.View>
    </BouncingButton>
  );
};

const toggleStyles = StyleSheet.create({
  track: {
    width: 44, height: 26, borderRadius: 13,
    justifyContent: 'center',
  },
  thumb: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16,
    shadowOffset: { width: 0, height: 1 }, elevation: 4,
  },
});

const CartScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  
  const { items, addressId, zoneId } = useSelector((state: RootState) => state.cart);
  const { user } = useSelector((state: RootState) => state.auth);
  const activeZoneId = useSelector((state: any) => state.app.activeZoneId);
  const effectiveZoneId = zoneId || activeZoneId;

  const [promoCode, setPromoCode] = useState('');
  const [appliedPromoCode, setAppliedPromoCode] = useState('');
  const [riderTip, setRiderTip] = useState<number>(0);
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [altReceiver, setAltReceiver] = useState(false);
  const [altName, setAltName] = useState('');
  const [altPhone, setAltPhone] = useState('');

  const { data: activePromosData } = useQuery({
    queryKey: ['active-promos'],
    queryFn: () => api.get('/promocodes/active'),
    staleTime: 30 * 1000,
  });
  const hasActivePromos = (activePromosData?.promoCodes?.length ?? 0) > 0;



  const { data: addressesData } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => api.get('/customers/addresses'),
    enabled: !!addressId,
  });
  const selectedAddress = addressesData?.addresses?.find((a: any) => a.id === addressId);
  const isOutOfZone = !!addressId && !!selectedAddress && !selectedAddress.is_serviceable;

  const handleAddressNavigation = () => {
    triggerHaptic();
    if (addressesData?.addresses?.length === 0) {
      navigation.navigate('AddressBook');
    } else {
      navigation.navigate('Address');
    }
  };

  const { data: menuData } = useQuery({
    queryKey: ['menu', effectiveZoneId],
    queryFn: () => api.get(`/menu?zoneId=${effectiveZoneId}`),
    enabled: !!effectiveZoneId,
    staleTime: 3 * 60 * 1000,
  });

  const recommendations = React.useMemo(() => {
    if (!menuData?.items || items.length === 0) return [];
    const kitchenId = items[0]?.kitchenId;
    return menuData.items
      .filter((i: any) => i.available && i.kitchen_id === kitchenId && !items.some(ci => ci.menuItemId === i.id))
      .slice(0, 6);
  }, [menuData?.items, items]);

  const fallbackSubtotal = items.reduce((s, i) => s + i.quantity * i.pricePaise, 0);
  const { data: pricingData, isFetching: pricingFetching } = useQuery({
    queryKey: ['your-order-pricing', items, addressId, appliedPromoCode],
    queryFn: () =>
      api.post('/payment/create-order', {
        items, addressId, promoCode: appliedPromoCode, riderTipPaise: riderTip * 100, dryRun: true,
      }),
    enabled: items.length > 0 && !!addressId && !isOutOfZone,
    placeholderData: keepPreviousData,
  });

  const p = pricingData?.pricing || {
    subtotalPaise: fallbackSubtotal,
    deliveryFeePaise: 0,
    gstPaise: 0,
    cgstPaise: 0,
    sgstPaise: 0,
    totalAmountPaise: fallbackSubtotal + (riderTip * 100),
    gatewayAmountPaise: fallbackSubtotal + (riderTip * 100),
    discountPaise: 0,
  };
  const subtotal = p.subtotalPaise / 100;
  const deliveryFee = p.deliveryFeePaise / 100;
  const tax = ((p.gstPaise || 0) + (p.cgstPaise || 0) + (p.sgstPaise || 0)) / 100;
  const grandTotal = (p.gatewayAmountPaise || p.totalAmountPaise) / 100;

  if (items.length === 0) {
    return (
      <View style={[styles.emptyContainer, { paddingTop: insets.top }]}>
        <Animated.View entering={FadeIn.duration(600)} style={styles.emptyIconBox}>
          <ShoppingCart size={48} color={ACCENT} />
        </Animated.View>
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptySub}>Discover our delicious menu and add something tasty!</Text>
        <BouncingButton
          style={styles.exploreBtn}
          onPress={() => { triggerHaptic(); navigation.reset({ index: 0, routes: [{ name: 'Home' }] }); }}
        >
          <Text style={styles.exploreBtnText}>Explore Menu</Text>
        </BouncingButton>
      </View>
    );
  }

  const busy = pricingFetching;
  const kitchenOpen = isKitchenOpen(menuData?.openingTime, menuData?.closingTime);
  const kitchenPaused = !!menuData?.kitchenPaused;
  const openLabel = menuData?.openingTime ? formatTime12h(menuData.openingTime) : '10:00 AM';
  const totalItemCount = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Order confirmation</Text>
          <Text style={styles.headerSub}>{totalItemCount} {totalItemCount === 1 ? 'item' : 'items'}</Text>
        </View>
        <BouncingButton style={styles.clearCartBtn} onPress={() => { triggerHaptic(); dispatch(clearCart()); }}>
          <Text style={styles.clearCartText}>Clear Cart</Text>
        </BouncingButton>
      </View>

      {/* Saved banner exactly like Screenshot 1 */}
      {p.discountPaise > 0 && (
        <View style={styles.savingsBanner}>
          <Text style={styles.savingsBannerText}>You saved ₹{p.discountPaise / 100} on this order</Text>
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
            { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12 }
          ]}>
            <Text style={{ fontSize: 13, fontFamily: fontFamily.black, color: '#000', letterSpacing: -0.5 }}>
              2QT<Text style={{ color: '#F97316' }}>.</Text>
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.estimateTitle}>2QT Promise</Text>
            <Text style={styles.estimateSub}>Fresh food, delivered fast to your door.</Text>
          </View>
        </Animated.View>

        {/* Cart Items Card */}
        <Animated.View entering={FadeInDown.delay(30).duration(300)} style={styles.card}>
          {items.map((item, index) => (
            <View key={item.menuItemId}>
              <View style={styles.itemRow}>
                <View style={styles.itemImgBox}>
                  {item.photoUrl ? (
                    <Image source={{ uri: item.photoUrl }} style={styles.itemImg} />
                  ) : (
                    <View style={[styles.itemImg, styles.itemImgPlaceholder]}>
                      <ChefHat size={22} color={colors.inkFaint} />
                    </View>
                  )}
                </View>
                <View style={styles.itemMeta}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                    <View style={[styles.vegBadgeMini, { borderColor: item.isVeg ? '#22C55E' : colors.danger }]}>
                      <View style={[styles.vegDotMini, { backgroundColor: item.isVeg ? '#22C55E' : colors.danger }]} />
                    </View>
                    <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                  </View>
                  {item.customizations && item.customizations.length > 0 && (
                    <Text style={styles.itemCustomizations} numberOfLines={2}>
                      + {item.customizations.map(c => `${c.group}: ${c.option}`).join(', ')}
                    </Text>
                  )}
                  <Text style={styles.itemPrice}>₹{item.pricePaise / 100}</Text>
                </View>
                <View style={styles.qtyRow}>
                  <BouncingButton
                    style={styles.qtyBtn}
                    onPress={() => { triggerHaptic(); dispatch(setQuantity({ menuItemId: item.menuItemId, quantity: item.quantity - 1 })); }}
                  >
                    <Text style={styles.qtyBtnText}>−</Text>
                  </BouncingButton>
                  <Text style={styles.qtyNum}>{item.quantity}</Text>
                  <BouncingButton
                    style={[styles.qtyBtn, styles.qtyBtnActive]}
                    onPress={() => { triggerHaptic(); dispatch(setQuantity({ menuItemId: item.menuItemId, quantity: item.quantity + 1 })); }}
                  >
                    <Text style={[styles.qtyBtnText, styles.qtyBtnActiveText]}>+</Text>
                  </BouncingButton>
                </View>
              </View>
              {index < items.length - 1 && <View style={styles.cardDivider} />}
            </View>
          ))}
        </Animated.View>

        {/* You Might Like This Cross-Selling Carousel */}
        {recommendations.length > 0 && (
          <Animated.View entering={FadeInDown.delay(50).duration(300)} style={styles.card}>
            <Text style={styles.cardTitle}>You might like this</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              {recommendations.map((rec: any) => {
                const vegColor = rec.is_egg ? '#EAB308' : (rec.is_veg ? '#22C55E' : colors.danger);
                return (
                  <View key={rec.id} style={styles.recCard}>
                    {rec.photo_url ? (
                      <Image source={{ uri: rec.photo_url }} style={styles.recImg} />
                    ) : (
                      <View style={[styles.recImg, styles.recImgPlaceholder]}>
                        <ChefHat size={20} color={colors.inkFaint} />
                      </View>
                    )}
                    <BouncingButton
                      style={styles.recAddBtn}
                      activeOpacity={0.85}
                      onPress={() => {
                        triggerHaptic();
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
                    >
                      <Text style={styles.recAddText}>+</Text>
                    </BouncingButton>
                    <View style={styles.recMeta}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                        <View style={[styles.vegBadgeMini, { borderColor: vegColor, width: 6, height: 6 }]}>
                          <View style={[styles.vegDotMini, { backgroundColor: vegColor, width: 3, height: 3 }]} />
                        </View>
                        <Text style={styles.recQuantityText}>1 Piece</Text>
                      </View>
                      <Text style={styles.recName} numberOfLines={1}>{rec.name}</Text>
                      <Text style={styles.recPrice}>₹{rec.price_paise / 100}</Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </Animated.View>
        )}

        {/* Promo Code Card */}
        {hasActivePromos && (
          <Animated.View entering={FadeInDown.delay(70).duration(300)} style={styles.card}>
            <Text style={styles.cardTitle}>Offers & Coupons</Text>
            <View style={styles.promoRow}>
              <View style={styles.promoIconBox}>
                <Tag size={15} color={colors.success} />
              </View>
              {appliedPromoCode ? (
                <View style={styles.promoAppliedRow}>
                  <CheckCircle2 size={14} color={colors.success} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.promoAppliedText}>{appliedPromoCode}</Text>
                    {p.discountPaise > 0 && (
                      <Text style={styles.promoSavingText}>50% upto ₹150 Off</Text>
                    )}
                  </View>
                </View>
              ) : (
                <TextInput
                  style={styles.promoInput}
                  placeholder="Enter promo code"
                  placeholderTextColor={colors.inkFaint}
                  value={promoCode}
                  onChangeText={setPromoCode}
                  autoCapitalize="characters"
                  returnKeyType="done"
                />
              )}
              <BouncingButton
                style={[styles.applyBtn, !promoCode && !appliedPromoCode && styles.applyBtnDisabled]}
                onPress={() => {
                  triggerHaptic();
                  if (appliedPromoCode) {
                    setAppliedPromoCode('');
                    setPromoCode('');
                  } else if (promoCode) {
                    setAppliedPromoCode(promoCode.toUpperCase());
                  }
                }}
              >
                <Text style={[styles.applyBtnText, !promoCode && !appliedPromoCode && styles.applyBtnTextDisabled]}>
                  {appliedPromoCode ? 'Remove' : 'Apply'}
                </Text>
              </BouncingButton>
            </View>
          </Animated.View>
        )}

        {/* Delivery Address Card */}
        <Animated.View entering={FadeInDown.delay(90).duration(300)} style={styles.card}>
          <BouncingButton
            style={styles.addressRow}
            activeOpacity={0.7}
            onPress={handleAddressNavigation}
          >
            <View style={styles.addressIconCircle}>
              <MapPin size={16} color={ACCENT} />
            </View>
            <View style={styles.addressBody}>
              <Text style={styles.cardSectionLabel}>Delivering to</Text>
              {selectedAddress ? (
                <>
                  <Text style={styles.addressLabel}>{selectedAddress.label}</Text>
                  <Text style={styles.addressText} numberOfLines={2}>
                    {selectedAddress.address_text}
                  </Text>
                </>
              ) : (
                <Text style={styles.addressText}>
                  {addressId ? 'Loading…' : 'No address selected'}
                </Text>
              )}
            </View>
            <Text style={styles.changeText}>Change</Text>
          </BouncingButton>
        </Animated.View>

        {/* Alternate Receiver Card */}
        <Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <UserRound size={18} color={ACCENT} style={{ marginRight: 12 }} />
              <View>
                <Text style={styles.cardTitleInline}>Someone else will receive?</Text>
                <Text style={styles.cardSubInline}>Add alternate contact for rider</Text>
              </View>
            </View>
            <Toggle value={altReceiver} onValueChange={setAltReceiver} activeColor={ACCENT} />
          </View>
          {altReceiver && (
            <Animated.View entering={FadeInDown.duration(200)} style={{ marginTop: 16, gap: 12 }}>
              <View style={styles.inputBox}>
                <UserRound size={16} color={colors.inkFaint} style={{ marginRight: 10 }} />
                <TextInput
                  placeholder="Receiver's name"
                  placeholderTextColor={colors.inkFaint}
                  value={altName}
                  onChangeText={setAltName}
                  style={styles.inputText}
                  returnKeyType="next"
                />
              </View>
              <View style={styles.inputBox}>
                <Phone size={16} color={colors.inkFaint} style={{ marginRight: 10 }} />
                <TextInput
                  placeholder="Receiver's phone number"
                  placeholderTextColor={colors.inkFaint}
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
          <Text style={styles.cardTitle}>Delivery Instructions</Text>
          <TextInput 
            placeholder="e.g. Leave at door, don't ring bell..."
            placeholderTextColor={colors.inkFaint}
            value={deliveryInstructions}
            onChangeText={setDeliveryInstructions}
            style={styles.textArea}
            multiline
          />
        </Animated.View>

        {/* Tip the Rider */}
        <Animated.View entering={FadeInDown.delay(120).duration(300)} style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
            <Heart size={18} color="#1B5E46" style={{ marginRight: 8 }} />
            <Text style={[styles.cardTitle, { marginBottom: 0 }]}>Tip your delivery partner</Text>
          </View>
          <Text style={styles.tipSub}>100% of your tip goes directly to your rider. Thank you!</Text>
          <View style={styles.tipOptionsRow}>
            {[20, 50, 100].map((amt) => (
              <BouncingButton 
                key={amt}
                style={[styles.tipChip, riderTip === amt && styles.tipChipActive]}
                onPress={() => {
                  triggerHaptic();
                  setRiderTip(riderTip === amt ? 0 : amt);
                }}
              >
                <Text style={[styles.tipChipText, riderTip === amt && styles.tipChipTextActive]}>
                  ₹{amt}
                </Text>
              </BouncingButton>
            ))}
          </View>
        </Animated.View>

        {/* Billing Details Card */}
        <Animated.View entering={FadeInDown.delay(110).duration(300)} style={styles.card}>
          <Text style={styles.cardTitle}>Billing details</Text>

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Subtotal</Text>
            <Text style={styles.billValue}>₹{subtotal}</Text>
          </View>
          {addressId && (
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Delivery</Text>
              {deliveryFee === 0 ? (
                <Text style={[styles.billValue, { color: '#22C55E', fontWeight: '800' }]}>Free</Text>
              ) : (
                <Text style={styles.billValue}>₹{deliveryFee}</Text>
              )}
            </View>
          )}
          {!addressId && (
            <View style={styles.billRow}>
              <Text style={[styles.billLabel, { color: colors.inkFaint, fontStyle: 'italic' }]}>Delivery</Text>
              <Text style={[styles.billValue, { color: colors.inkFaint, fontSize: 12 }]}>Add address</Text>
            </View>
          )}
          {tax > 0 && (
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Taxes & GST</Text>
              <Text style={styles.billValue}>₹{tax.toFixed(2)}</Text>
            </View>
          )}
          {p.discountPaise > 0 && (
            <View style={styles.billRow}>
              <Text style={[styles.billLabel, { color: '#22C55E' }]}>Discount ({appliedPromoCode})</Text>
              <Text style={[styles.billValue, { color: '#22C55E' }]}>−₹{p.discountPaise / 100}</Text>
            </View>
          )}
          {riderTip > 0 && (
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Delivery Partner Tip</Text>
              <Text style={styles.billValue}>₹{riderTip}</Text>
            </View>
          )}

          <View style={styles.totalSeparator} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>₹{grandTotal.toFixed(2)}</Text>
          </View>

          {p.discountPaise > 0 && (
            <View style={styles.billTotalSavedBanner}>
              <Text style={styles.billTotalSavedText}>Total saved on this order: ₹{p.discountPaise / 100}</Text>
            </View>
          )}
        </Animated.View>

        {isOutOfZone && (
          <View style={styles.outOfZoneBanner}>
            <Text style={styles.outOfZoneText}>This address is outside our delivery zone. Please change your address.</Text>
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
            <Text style={{ fontSize: 11, fontFamily: fontFamily.extrabold, color: colors.inkFaint, textTransform: 'uppercase' }}>Item Total</Text>
            <Text style={{ fontSize: 20, fontFamily: fontFamily.black, color: colors.ink, letterSpacing: -0.5 }}>₹{grandTotal.toFixed(2)}</Text>
          </View>
          
          <BouncingButton
            style={[styles.footerCta, (busy || isOutOfZone || !kitchenOpen || kitchenPaused) && styles.placeOrderBtnDisabled]}
            disabled={busy || isOutOfZone || !kitchenOpen || kitchenPaused}
            activeOpacity={0.88}
            onPress={() => {
              triggerHaptic();
              if (!addressId) {
                handleAddressNavigation();
                return;
              }
              if (altReceiver) {
                if (!altName.trim()) {
                  Alert.alert('Required Field', 'Please enter the receiver\'s name.');
                  return;
                }
                if (altPhone.trim().length < 10) {
                  Alert.alert('Required Field', 'Please enter a valid 10-digit phone number.');
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
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.footerCtaText}>
                {kitchenPaused
                  ? 'Kitchen Paused'
                  : !kitchenOpen
                    ? `Opens at ${openLabel}`
                    : addressId
                      ? (isOutOfZone ? 'Out of Zone' : 'Proceed to Pay')
                      : 'Select Address'}
              </Text>
            )}
          </BouncingButton>
        </View>
      </Animated.View>
    </View>
  );
};

export default CartScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' }, // Light gray background for block separation

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    zIndex: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 20, fontFamily: fontFamily.black, color: colors.ink, letterSpacing: -0.5 },
  headerSub: { fontSize: 12, fontFamily: fontFamily.medium, color: colors.inkMuted, marginTop: 2 },
  clearCartBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  clearCartText: {
    fontSize: 11, fontFamily: fontFamily.bold, color: colors.inkMuted,
  },

  savingsBanner: {
    backgroundColor: '#ECFDF5',
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  savingsBannerText: {
    fontSize: 13,
    fontFamily: fontFamily.black,
    color: '#1B5E46',
    letterSpacing: 0.2,
  },

  scrollContent: { paddingBottom: 150 },

  // Estimate
  estimateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 12,
    marginBottom: 8,
  },
  estimateIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  estimateTitle: {
    fontSize: 16,
    fontFamily: fontFamily.black,
    color: '#1B5E46',
  },
  estimateSub: {
    fontSize: 13,
    fontFamily: fontFamily.medium,
    color: colors.inkMuted,
    marginTop: 2,
  },

  // Card base
  card: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 8,
  },
  cardDivider: { height: 1, backgroundColor: '#E5E7EB', borderStyle: 'solid', borderWidth: 1, borderRadius: 1, marginVertical: 12, borderColor: '#E5E7EB' },
  cardTitle: {
    fontSize: 16, fontFamily: fontFamily.black, color: colors.ink,
    marginBottom: 16, letterSpacing: -0.3,
  },
  cardSectionLabel: {
    fontSize: 11, fontFamily: fontFamily.bold, color: colors.inkMuted,
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4,
  },

  // Cart items
  itemRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8,
  },
  itemImgBox: { width: 56, height: 56, borderRadius: 20, overflow: 'hidden', marginRight: 14, backgroundColor: '#F7F8FA' },
  itemImg: { width: '100%', height: '100%' },
  itemImgPlaceholder: { backgroundColor: '#F7F8FA', alignItems: 'center', justifyContent: 'center' },
  itemMeta: { flex: 1, marginRight: 12 },
  itemName: { fontSize: 14, fontFamily: fontFamily.black, color: colors.ink, lineHeight: 20, letterSpacing: -0.2 },
  itemCustomizations: { fontSize: 11, fontFamily: fontFamily.medium, color: colors.inkMuted, marginTop: 2, marginBottom: 2 },
  itemPrice: { fontSize: 14, fontFamily: fontFamily.bold, color: colors.ink, marginTop: 4 },
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

  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F9FAFB', borderRadius: 16, padding: 2 },
  qtyBtn: {
    width: 28, height: 28, borderRadius: 6,
    backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB',
  },
  qtyBtnActive: { backgroundColor: '#1B5E46' },
  qtyBtnText: { fontSize: 16, color: colors.ink, fontFamily: fontFamily.black, lineHeight: 18 },
  qtyBtnActiveText: { color: '#FFFFFF' },
  qtyNum: { fontSize: 13, fontFamily: fontFamily.black, color: colors.ink, minWidth: 20, textAlign: 'center' },

  // Address
  addressRow: { flexDirection: 'row', alignItems: 'flex-start' },
  addressIconCircle: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#F0FDF4',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 14, marginTop: 2,
  },
  addressBody: { flex: 1, marginRight: 8 },
  addressLabel: { fontSize: 15, fontFamily: fontFamily.black, color: colors.ink, marginBottom: 4, letterSpacing: -0.2 },
  addressText: { fontSize: 13, fontFamily: fontFamily.medium, color: colors.inkMuted, lineHeight: 20 },
  changeText: { fontSize: 13, fontFamily: fontFamily.bold, color: '#1B5E46', marginTop: 4 },

  // Promo
  promoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  promoIconBox: {
    width: 42, height: 42, borderRadius: 20,
    backgroundColor: '#F7F8FA',
    alignItems: 'center', justifyContent: 'center',
  },
  promoInput: {
    flex: 1, height: 46,
    fontSize: 14, fontFamily: fontFamily.black, color: colors.ink, textTransform: 'uppercase', letterSpacing: 1,
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  promoAppliedRow: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  promoAppliedText: { fontSize: 15, fontFamily: fontFamily.black, color: '#1B5E46' },
  promoSavingText: { fontSize: 12, fontFamily: fontFamily.medium, color: colors.inkMuted, marginTop: 2 },
  promoInvalidText: { fontSize: 13, fontFamily: fontFamily.medium, color: colors.dangerTint },
  applyBtn: {
    height: 46, paddingHorizontal: 20, borderRadius: 14,
    backgroundColor: '#1B5E46',
    alignItems: 'center', justifyContent: 'center',
  },
  applyBtnDisabled: { backgroundColor: '#F7F8FA' },
  applyBtnText: { fontSize: 14, fontFamily: fontFamily.black, color: '#FFFFFF' },
  applyBtnTextDisabled: { color: colors.inkFaint },

  // Recommendations Carousel
  recCard: {
    width: 120,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginRight: 10,
    paddingBottom: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  recImg: {
    width: '100%',
    height: 90,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  recImgPlaceholder: {
    backgroundColor: '#F7F8FA',
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
    backgroundColor: '#1B5E46',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    zIndex: 5,
  },
  recAddText: {
    fontSize: 20,
    color: '#fff',
    fontFamily: fontFamily.black,
    lineHeight: 22,
  },
  recMeta: {
    paddingHorizontal: 8,
    paddingTop: 10,
  },
  recQuantityText: {
    fontSize: 9,
    fontFamily: fontFamily.bold,
    color: '#D97706',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  recName: {
    fontSize: 12,
    fontFamily: fontFamily.bold,
    color: colors.ink,
    marginVertical: 4,
    lineHeight: 16,
  },
  recPrice: {
    fontSize: 13,
    fontFamily: fontFamily.black,
    color: colors.ink,
  },

  // Bill
  billRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 14,
  },
  billLabel: { fontSize: 14, fontFamily: fontFamily.medium, color: colors.inkMuted },
  billValue: { fontSize: 14, fontFamily: fontFamily.bold, color: colors.ink },

  totalSeparator: { height: 1, backgroundColor: '#E5E7EB', borderStyle: 'dashed', borderWidth: 1, borderRadius: 1, marginVertical: 16, borderColor: '#E5E7EB' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 16, fontFamily: fontFamily.black, color: colors.ink },
  totalValue: { fontSize: 24, fontFamily: fontFamily.black, color: colors.ink, letterSpacing: -1 },

  billTotalSavedBanner: {
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 14,
    marginTop: 16,
    alignItems: 'center',
  },
  billTotalSavedText: {
    fontSize: 13,
    fontFamily: fontFamily.black,
    color: '#1B5E46',
  },

  // Out-of-zone
  outOfZoneBanner: {
    backgroundColor: '#FEF2F2', borderRadius: 16,
    padding: 16,
  },
  outOfZoneText: { fontSize: 14, fontFamily: fontFamily.bold, color: colors.dangerTint, textAlign: 'center', lineHeight: 20 },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  footerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  footerCta: {
    height: 48,
    backgroundColor: '#1B5E46',
    borderRadius: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerCtaText: {
    fontSize: 16,
    fontFamily: fontFamily.black,
    color: '#FFFFFF',
  },
  placeOrderBtnDisabled: { opacity: 0.55 },

  emptyContainer: {
    flex: 1, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center', padding: 40,
  },
  emptyIconBox: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center', marginBottom: 28,
  },
  emptyTitle: { fontSize: 24, fontFamily: fontFamily.black, color: colors.ink, marginBottom: 12, letterSpacing: -0.5 },
  emptySub: { fontSize: 15, fontFamily: fontFamily.medium, color: colors.inkMuted, textAlign: 'center', lineHeight: 24 },
  exploreBtn: {
    marginTop: 32, backgroundColor: '#1B5E46',
    paddingHorizontal: 36, paddingVertical: 16, borderRadius: 20,
  },
  exploreBtnText: { fontSize: 15, fontFamily: fontFamily.black, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 1 },

  // New Styles for Added UI
  cardTitleInline: { fontSize: 15, fontFamily: fontFamily.bold, color: colors.ink, marginBottom: 2 },
  cardSubInline: { fontSize: 12, fontFamily: fontFamily.medium, color: colors.inkFaint },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 20, paddingHorizontal: 12, height: 48 },
  inputText: { flex: 1, fontSize: 14, fontFamily: fontFamily.medium, color: colors.ink },
  textArea: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 20, padding: 12, minHeight: 80, fontSize: 14, fontFamily: fontFamily.medium, color: colors.ink, textAlignVertical: 'top' },
  tipSub: { fontSize: 12, fontFamily: fontFamily.medium, color: colors.inkFaint, marginBottom: 12, lineHeight: 18 },
  tipOptionsRow: { flexDirection: 'row', gap: 10 },
  tipChip: { flex: 1, paddingVertical: 12, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff', alignItems: 'center' },
  tipChipActive: { borderColor: '#1B5E46', backgroundColor: '#E8F2EC' },
  tipChipText: { fontSize: 14, fontFamily: fontFamily.bold, color: colors.ink },
  tipChipTextActive: { color: '#1B5E46' },
});
