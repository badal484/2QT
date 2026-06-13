import { ArrowLeft, ChefHat, Wallet, Calendar, Clock, Sparkles, Star, Ticket } from 'lucide-react-native';
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Image, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RootState } from '../store';
import { api } from '../api/client';
import { setQuantity, clearCart, setInstructions, setScheduledAt, validateCartItems } from '../store/slices/cartSlice';
import { getSocket } from '../socket/client';
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import Animated, { FadeIn, FadeInDown, FadeOut, Layout, BounceInUp } from 'react-native-reanimated';

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

const CartScreen = ({ navigation }: any) => {
  const { items, addressId, instructions, scheduledAt } = useSelector((state: RootState) => state.cart);
  const { user } = useSelector((state: RootState) => state.auth);
  const [promoCode, setPromoCode] = useState('');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  const triggerHaptic = () => ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
  const triggerHapticHeavy = () => ReactNativeHapticFeedback.trigger("impactHeavy", hapticOptions);

  // Systematic Real-time Listeners
  React.useEffect(() => {
    const socket = getSocket();
    if (socket) {
      socket.on('menu_updated', () => {
        queryClient.invalidateQueries({ queryKey: ['cart-pricing'] });
      });
      socket.on('wallet_updated', () => {
        queryClient.invalidateQueries({ queryKey: ['cart-pricing'] });
      });
      socket.on('loyalty_updated', () => {
        queryClient.invalidateQueries({ queryKey: ['loyalty-balance'] });
        queryClient.invalidateQueries({ queryKey: ['cart-pricing'] });
      });
      return () => {
        socket.off('menu_updated');
        socket.off('wallet_updated');
        socket.off('loyalty_updated');
      };
    }
  }, [queryClient]);

  // 1. Fetch Subscription Info
  const { data: promoData } = useQuery({
    queryKey: ['active-promocodes'],
    queryFn: () => api.get('/promocodes/active'),
  });

  const { data: subData } = useQuery({
    queryKey: ['my-subscriptions'],
    queryFn: () => api.get('/customers/subscriptions/my'),
    enabled: !!user
  });

  // 2. Fetch Loyalty Info
  const { data: loyaltyData } = useQuery({
    queryKey: ['loyalty-balance'],
    queryFn: () => api.get('/customers/loyalty'),
    enabled: !!user
  });

  const activeSub = subData?.subscriptions?.find((s: any) => s.status === 'active');
  // 3. Fetch Systematic Pricing
  const { data: pricingData, isLoading: loadingPricing } = useQuery({
    queryKey: ['cart-pricing', items, addressId, promoCode, activeSub?.id],
    queryFn: () => api.post('/payment/create-order', { 
        items, 
        addressId, 
        promoCode,
        isSubscriptionOrder: !!(activeSub && activeSub.current_day_credits > 0),
        dryRun: true 
    }),
    enabled: items.length > 0 && !!addressId
  });

  const fallbackSubtotal = items.reduce((acc, item) => acc + item.quantity * item.pricePaise, 0);
  const p = pricingData?.pricing || { 
    subtotalPaise: fallbackSubtotal,
    deliveryFeePaise: 0,
    gstPaise: 0,
    totalAmountPaise: fallbackSubtotal,
    discountPaise: 0,
    loyaltyDiscountPaise: 0,
    walletDeductionPaise: 0,
    gatewayAmountPaise: fallbackSubtotal
  };

  const cartTotal = p.subtotalPaise;
  const deliveryFee = p.deliveryFeePaise;
  const tax = p.gstPaise || (p.cgstPaise + p.sgstPaise) || 0;
  const finalTotal = p.gatewayAmountPaise;

  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Animated.View entering={BounceInUp.duration(600)} style={styles.emptyIconWrapper}>
          <Text style={styles.emptyEmoji}>🛒</Text>
        </Animated.View>
        <Animated.Text entering={FadeIn.delay(200)} style={styles.emptyTitle}>Your cart is empty</Animated.Text>
        <Animated.Text entering={FadeIn.delay(300)} style={styles.emptySub}>
          Looks like you haven't discovered our delicious menu yet. Your next meal is waiting!
        </Animated.Text>
        <Animated.View entering={FadeInDown.delay(400)}>
          <TouchableOpacity 
            style={styles.exploreButton}
            onPress={() => {
              triggerHaptic();
              navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
            }}
          >
            <Text style={styles.exploreButtonText}>Explore Menu</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { triggerHaptic(); navigation.goBack(); }} style={styles.backButton}>
          <ArrowLeft size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cart Summary</Text>
        <TouchableOpacity 
          onPress={() => {
            triggerHapticHeavy();
            Alert.alert('Clear Cart', 'Remove all items from your cart?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Clear', style: 'destructive', onPress: () => {
                triggerHapticHeavy();
                dispatch(clearCart());
              } }
            ]);
          }} 
          style={styles.clearButton}
        >
          <Text style={styles.clearEmoji}>🗑️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.scrollContent}>
          {/* Active Subscription Badge */}
          {activeSub && (
            <Animated.View entering={FadeInDown.duration(400)} style={styles.proCard}>
              <View style={styles.proIconWrapper}>
                <Sparkles size={24} color="#FF6B35" />
              </View>
              <View style={styles.proTextColumn}>
                <Text style={styles.proTitle}>2QT Pro Member</Text>
                <Text style={styles.proSub}>You're saving ₹{(p.discountPaise + p.loyaltyDiscountPaise) / 100} on this order!</Text>
              </View>
            </Animated.View>
          )}

          {/* Items List */}
          <Text style={styles.sectionLabel}>Selected Items</Text>
          {items.map((item, index) => (
            <Animated.View 
              key={item.menuItemId} 
              entering={FadeInDown.delay(index * 50).duration(400)}
              exiting={FadeOut.duration(200)}
              layout={Layout.springify()}
              style={styles.itemCard}
            >
              <View style={styles.itemImageWrapper}>
                {item.photoUrl ? (
                  <Image source={{ uri: item.photoUrl }} style={styles.itemImage} />
                ) : (
                  <View style={styles.itemPlaceholder}>
                    <ChefHat size={32} color="#FF6B35" />
                  </View>
                )}
              </View>
              <View style={styles.itemInfo}>
                <View style={styles.itemNameRow}>
                  <View style={[styles.vegIndicator, { borderColor: item.isVeg ? '#22C55E' : '#EF4444' }]}>
                    <View style={[styles.vegDot, { backgroundColor: item.isVeg ? '#22C55E' : '#EF4444' }]} />
                  </View>
                  <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                </View>
                <Text style={styles.itemPrice}>₹{item.pricePaise / 100}</Text>
              </View>
              <View style={styles.quantityControl}>
                <TouchableOpacity onPress={() => {
                  triggerHaptic();
                  dispatch(setQuantity({ menuItemId: item.menuItemId, quantity: item.quantity - 1 }));
                }}>
                  <Text style={styles.quantityBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.quantityValueText}>{item.quantity}</Text>
                <TouchableOpacity onPress={() => {
                  triggerHaptic();
                  dispatch(setQuantity({ menuItemId: item.menuItemId, quantity: item.quantity + 1 }));
                }}>
                  <Text style={styles.quantityBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          ))}

          <TouchableOpacity 
            style={styles.addMoreButton}
            onPress={() => {
              triggerHaptic();
              navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
            }}
          >
            <Text style={styles.addMoreText}>+ Add More Items</Text>
          </TouchableOpacity>

          {/* Scheduling Section */}
          <Text style={styles.sectionLabel}>Delivery Time</Text>
          <View style={styles.scheduleRow}>
            <TouchableOpacity 
              onPress={() => { triggerHaptic(); dispatch(setScheduledAt(null)); }}
              style={[styles.scheduleBtn, !scheduledAt ? styles.scheduleBtnActive : styles.scheduleBtnInactive]}
            >
              <Clock size={18} color={!scheduledAt ? "#FF6B35" : "#A0A0A0"} />
              <Text style={[styles.scheduleBtnText, !scheduledAt ? styles.scheduleTextActive : styles.scheduleTextInactive]}>Asap</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => {
                triggerHaptic();
                navigation.navigate('ScheduleOrder');
              }}
              style={[styles.scheduleBtn, scheduledAt ? styles.scheduleBtnActive : styles.scheduleBtnInactive]}
            >
              <Calendar size={18} color={scheduledAt ? "#FF6B35" : "#A0A0A0"} />
              <Text style={[styles.scheduleBtnText, scheduledAt ? styles.scheduleTextActive : styles.scheduleTextInactive]}>
                {scheduledAt ? 'Tomorrow' : 'Schedule'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Promo Code Section */}
          <Text style={styles.sectionLabel}>Offers & Coupons</Text>
          <View style={styles.promoCardContainer}>
            <TextInput 
              placeholder="Enter Promo Code"
              placeholderTextColor="#A0A0A0"
              value={promoCode}
              onChangeText={setPromoCode}
              style={styles.promoInput}
              autoCapitalize="characters"
            />
            <TouchableOpacity 
              style={[styles.applyBtn, !promoCode && { opacity: 0.5 }]}
              onPress={() => {
                triggerHaptic();
                queryClient.invalidateQueries({ queryKey: ['cart-pricing'] });
              }}
              disabled={!promoCode}
            >
              <Text style={styles.applyBtnText}>Apply</Text>
            </TouchableOpacity>
          </View>

          {/* Dynamic Available Offers */}
          {promoData?.promoCodes?.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 32, marginTop: -16 }}>
              {promoData.promoCodes.map((promo: any) => (
                <TouchableOpacity 
                  key={promo.id} 
                  style={styles.availableOfferChip}
                  onPress={() => {
                    triggerHaptic();
                    setPromoCode(promo.code);
                  }}
                >
                  <Ticket size={14} color="#FF6B35" />
                  <View style={{ marginLeft: 6 }}>
                    <Text style={styles.offerCodeText}>{promo.code}</Text>
                    <Text style={styles.offerDescText}>{promo.discount_percent}% OFF (Up to ₹{promo.max_discount_paise / 100})</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Delivery Instructions */}
          <Text style={styles.sectionLabel}>Cooking Instructions</Text>

          <View style={styles.instructionCard}>
            <TextInput 
              placeholder="e.g. Less spicy, no onions, etc."
              placeholderTextColor="#A0A0A0"
              multiline
              value={instructions}
              onChangeText={(text) => dispatch(setInstructions(text))}
              style={styles.instructionInput}
            />
          </View>

          {/* Bill Summary */}
          <Text style={styles.sectionLabel}>Bill Details</Text>
          <Animated.View layout={Layout.springify()} style={styles.billCard}>
            <View style={styles.billRow}>
              <Text style={styles.billRowLabel}>Item Total</Text>
              <Text style={styles.billRowValue}>₹{cartTotal / 100}</Text>
            </View>
            <View style={styles.billRow}>
              <Text style={styles.billRowLabel}>Delivery Fee</Text>
              <Text style={styles.billRowValue}>₹{deliveryFee / 100}</Text>
            </View>
            <View style={styles.billRow}>
              <Text style={styles.billRowLabel}>Taxes & Charges</Text>
              <Text style={styles.billRowValue}>₹{tax / 100}</Text>
            </View>
            {p.discountPaise > 0 && (
              <Animated.View entering={FadeInDown} style={styles.discountRow}>
                <View style={styles.discountRowLeft}>
                  <Sparkles size={14} color="#FF6B35" />
                  <Text style={styles.discountLabel}>Promo Discount</Text>
                </View>
                <Text style={styles.discountValue}>-₹{p.discountPaise / 100}</Text>
              </Animated.View>
            )}
            {p.isSubscriptionOrder && (
              <Animated.View entering={FadeInDown} style={styles.discountRow}>
                <View style={styles.discountRowLeft}>
                  <Star size={14} color="#FFD700" />
                  <Text style={styles.discountLabel}>Pro Credit Used</Text>
                </View>
                <Text style={styles.discountValue}>-₹{p.subtotalPaise / 100}</Text>
              </Animated.View>
            )}
            {p.loyaltyDiscountPaise > 0 && (
              <Animated.View entering={FadeInDown} style={styles.discountRow}>
                <View style={styles.discountRowLeft}>
                  <Star size={14} color="#FFD700" />
                  <Text style={styles.discountLabel}>Points Redeemed</Text>
                </View>
                <Text style={styles.discountValue}>-₹{p.loyaltyDiscountPaise / 100}</Text>
              </Animated.View>
            )}
            {p.walletDeductionPaise > 0 && (
              <Animated.View entering={FadeInDown} style={styles.discountRow}>
                <View style={styles.discountRowLeft}>
                  <Wallet size={14} color="#1A1A2E" />
                  <Text style={styles.discountLabel}>Wallet Used</Text>
                </View>
                <Text style={styles.discountValue}>-₹{p.walletDeductionPaise / 100}</Text>
              </Animated.View>
            )}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Pay</Text>
              <Text style={styles.totalValue}>₹{finalTotal / 100}</Text>
            </View>
          </Animated.View>
        </View>
      </ScrollView>

      {/* Checkout Footer */}
      <Animated.View entering={BounceInUp.duration(600).delay(200)} style={styles.footer}>
        <TouchableOpacity 
          style={styles.checkoutButton}
          disabled={isCheckingOut}
          onPress={async () => {
            triggerHapticHeavy();
            if (!addressId) {
              Alert.alert('Missing Address', 'Please select a delivery address first.');
              navigation.navigate('Address');
              return;
            } 
            
            setIsCheckingOut(true);
            // Validate Items before checkout
            try {
              const resultAction = await dispatch(validateCartItems(items) as any);
              const result = resultAction.payload;
              if (result && result.removedCount > 0) {
                Alert.alert('Menu Changed', `${result.removedCount} item(s) were removed from your cart because they are currently sold out.`);
                setIsCheckingOut(false);
                return;
              }
            } catch (err) {
              Alert.alert('Error', 'Could not validate cart items.');
              setIsCheckingOut(false);
              return;
            }
            setIsCheckingOut(false);

            navigation.navigate('Checkout', { 
              addressId, 
              instructions, 
              scheduledAt,
              promoCode,
              finalAmount: finalTotal
            });
          }}
        >
          <View>
            <Text style={styles.checkoutSubText}>Next Step</Text>
            <Text style={styles.checkoutMainText}>Review Order</Text>
          </View>
          <View style={styles.checkoutArrowWrapper}>
            <Text style={styles.checkoutArrow}>➔</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* FULL SCREEN LOADING OVERLAY */}
      {isCheckingOut && (
        <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(300)} style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingOverlayText}>Securing your items...</Text>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { paddingTop: 64, paddingHorizontal: 24, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: '#f9fafb', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, backgroundColor: '#f9fafb', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#1A1A2E', fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  clearButton: { width: 40, height: 40, backgroundColor: 'rgba(255, 107, 53, 0.05)', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  clearEmoji: { fontSize: 18 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingVertical: 32 },
  availableOfferChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 12,
  },
  offerCodeText: {
    color: '#FF6B35',
    fontWeight: '900',
    fontSize: 12,
  },
  offerDescText: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '600',
  },
  proCard: { backgroundColor: '#1A1A2E', borderRadius: 32, padding: 24, marginBottom: 32, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 8 },
  proIconWrapper: { width: 48, height: 48, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  proTextColumn: { flex: 1 },
  proTitle: { color: '#fff', fontWeight: '900', fontSize: 14 },
  proSub: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '700', marginTop: 2 },
  sectionLabel: { color: '#9ca3af', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16, marginLeft: 8 },
  itemCard: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, backgroundColor: 'rgba(249, 250, 251, 0.5)', padding: 16, borderRadius: 24, borderWidth: 1, borderColor: '#f3f4f6' },
  itemImageWrapper: { width: 64, height: 64, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#f3f4f6' },
  itemImage: { width: '100%', height: '100%' },
  itemPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  itemInfo: { flex: 1, marginLeft: 16, marginRight: 8 },
  itemNameRow: { flexDirection: 'row', alignItems: 'center' },
  vegIndicator: { width: 10, height: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  vegDot: { width: 4, height: 4, borderRadius: 2 },
  itemName: { color: '#1A1A2E', fontWeight: '900', fontSize: 15, flex: 1, letterSpacing: -0.2 },
  itemPrice: { color: '#FF6B35', fontWeight: '900', fontSize: 13, marginTop: 4 },
  quantityControl: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 4, borderWidth: 1, borderColor: '#f3f4f6', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  quantityBtnText: { color: '#1A1A2E', fontSize: 18, fontWeight: '900', paddingHorizontal: 12 },
  quantityValueText: { color: '#1A1A2E', fontWeight: '900', fontSize: 14 },
  addMoreButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: '#f3f4f6', borderRadius: 24, marginBottom: 32 },
  addMoreText: { color: '#9ca3af', fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2, fontSize: 10 },
  scheduleRow: { flexDirection: 'row', marginBottom: 32 },
  scheduleBtn: { flex: 1, padding: 16, borderRadius: 20, borderWidth: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  scheduleBtnActive: { backgroundColor: 'rgba(255, 107, 53, 0.05)', borderColor: '#FF6B35' },
  scheduleBtnInactive: { backgroundColor: '#f9fafb', borderColor: '#f3f4f6' },
  scheduleBtnText: { marginLeft: 12, fontWeight: '900', fontSize: 10, textTransform: 'uppercase' },
  scheduleTextActive: { color: '#FF6B35' },
  scheduleTextInactive: { color: '#9ca3af' },
  instructionCard: { backgroundColor: '#f9fafb', borderRadius: 32, padding: 24, marginBottom: 32, borderWidth: 1, borderColor: '#f3f4f6' },
  instructionInput: { color: '#1A1A2E', fontWeight: '500', fontSize: 14, height: 96, textAlignVertical: 'top' },
  promoCardContainer: { flexDirection: 'row', backgroundColor: '#f9fafb', borderRadius: 24, padding: 8, marginBottom: 32, borderWidth: 1, borderColor: '#f3f4f6', alignItems: 'center' },
  promoInput: { flex: 1, paddingHorizontal: 16, color: '#1A1A2E', fontWeight: '900', fontSize: 14, letterSpacing: 1 },
  applyBtn: { backgroundColor: '#1A1A2E', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 16 },
  applyBtnText: { color: '#fff', fontWeight: '900', fontSize: 12, textTransform: 'uppercase' },
  billCard: { backgroundColor: '#f9fafb', borderRadius: 32, padding: 24, marginBottom: 128, borderWidth: 1, borderColor: '#f3f4f6' },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  billRowLabel: { color: '#9ca3af', fontWeight: '700', fontSize: 14 },
  billRowValue: { color: '#1A1A2E', fontWeight: '900', fontSize: 14 },
  discountRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  discountRowLeft: { flexDirection: 'row', alignItems: 'center' },
  discountLabel: { color: '#22C55E', fontWeight: '900', fontSize: 14, marginLeft: 8 },
  discountValue: { color: '#22C55E', fontWeight: '900', fontSize: 14 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  totalLabel: { color: '#1A1A2E', fontWeight: '900', fontSize: 18 },
  totalValue: { color: '#FF6B35', fontWeight: '900', fontSize: 24, letterSpacing: -0.5 },
  footer: { position: 'absolute', bottom: 40, left: 24, right: 24 },
  checkoutButton: { height: 80, backgroundColor: '#FF6B35', borderRadius: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 32, shadowColor: '#FF6B35', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 8 },
  checkoutSubText: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2 },
  checkoutMainText: { color: '#fff', fontSize: 18, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2 },
  checkoutArrowWrapper: { width: 48, height: 48, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  checkoutArrow: { color: '#fff', fontSize: 20, fontWeight: '900' },
  emptyContainer: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIconWrapper: { width: 128, height: 128, backgroundColor: '#f9fafb', borderRadius: 64, alignItems: 'center', justifyContent: 'center', marginBottom: 32 },
  emptyEmoji: { fontSize: 64 },
  emptyTitle: { color: '#1A1A2E', fontSize: 28, fontWeight: '900', textAlign: 'center' },
  emptySub: { color: '#9ca3af', textAlign: 'center', marginTop: 16, fontWeight: '500', fontSize: 15, lineHeight: 24 },
  exploreButton: { marginTop: 40, backgroundColor: '#FF6B35', paddingHorizontal: 48, paddingVertical: 20, borderRadius: 24, shadowColor: '#FF6B35', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 8 },
  exploreButtonText: { color: '#fff', fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2, fontSize: 12 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center', zIndex: 9999 },
  loadingOverlayText: { color: '#1A1A2E', fontSize: 16, fontWeight: '900', marginTop: 16 }
});

export default CartScreen;
