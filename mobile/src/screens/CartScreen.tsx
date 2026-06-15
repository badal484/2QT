import { ArrowLeft, ChefHat, Wallet, Calendar, Clock, Sparkles, Star, Ticket, Trash2, ShoppingCart, ArrowRight } from 'lucide-react-native';
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Image, ActivityIndicator, Alert, StyleSheet, Platform } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RootState } from '../store';
import { api } from '../api/client';
import { setQuantity, clearCart, setInstructions, setScheduledAt, validateCartItems } from '../store/slices/cartSlice';
import { getSocket } from '../socket/client';
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import Animated, { FadeIn, FadeInDown, FadeOut, Layout } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const insets = useSafeAreaInsets();

  const triggerHaptic = () => ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
  const triggerHapticHeavy = () => ReactNativeHapticFeedback.trigger("impactHeavy", hapticOptions);

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

  const { data: promoData } = useQuery({
    queryKey: ['active-promocodes'],
    queryFn: () => api.get('/promocodes/active'),
  });

  const { data: subData } = useQuery({
    queryKey: ['my-subscriptions'],
    queryFn: () => api.get('/customers/subscriptions/my'),
    enabled: !!user
  });

  const { data: loyaltyData } = useQuery({
    queryKey: ['loyalty-balance'],
    queryFn: () => api.get('/customers/loyalty'),
    enabled: !!user
  });

  const activeSub = subData?.subscriptions?.find((s: any) => s.status === 'active');
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
        <Animated.View entering={FadeIn.duration(600)} style={styles.emptyIconWrapper}>
          <ShoppingCart size={48} color="#10B981" />
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
              navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
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
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 16, 60) }]}>
        <TouchableOpacity onPress={() => { triggerHaptic(); navigation.goBack(); }} style={styles.backButton}>
          <ArrowLeft size={20} color="#1A1A2E" />
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
          <Trash2 size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.scrollContent}>
          {/* Active Subscription Badge */}
          {activeSub && (
            <Animated.View entering={FadeInDown.duration(400)} style={styles.proCard}>
              <View style={styles.proIconWrapper}>
                <Sparkles size={24} color="#10B981" />
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
                    <ChefHat size={32} color="#9CA3AF" />
                  </View>
                )}
              </View>
              <View style={styles.itemInfo}>
                <View style={styles.itemNameRow}>
                  <View style={[styles.vegIndicator, { borderColor: item.isVeg ? '#10B981' : '#EF4444' }]}>
                    <View style={[styles.vegDot, { backgroundColor: item.isVeg ? '#10B981' : '#EF4444' }]} />
                  </View>
                  <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                </View>
                <Text style={styles.itemPrice}>₹{item.pricePaise / 100}</Text>
              </View>
              <View style={styles.quantityControl}>
                <TouchableOpacity onPress={() => {
                  triggerHaptic();
                  dispatch(setQuantity({ menuItemId: item.menuItemId, quantity: item.quantity - 1 }));
                }} style={{padding: 4}}>
                  <Text style={styles.quantityBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.quantityValueText}>{item.quantity}</Text>
                <TouchableOpacity onPress={() => {
                  triggerHaptic();
                  dispatch(setQuantity({ menuItemId: item.menuItemId, quantity: item.quantity + 1 }));
                }} style={{padding: 4}}>
                  <Text style={styles.quantityBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          ))}

          <TouchableOpacity 
            style={styles.addMoreButton}
            onPress={() => {
              triggerHaptic();
              navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
            }}
          >
            <Text style={styles.addMoreText}>+ Add More Items</Text>
          </TouchableOpacity>

          {/* Scheduling Section */}
          <Text style={styles.sectionLabel}>Delivery Time</Text>
          <View style={styles.scheduleRow}>
            <View style={styles.scheduleLeft}>
              <View style={styles.scheduleIconWrapper}>
                <Clock size={20} color="#10B981" />
              </View>
              <View>
                <Text style={styles.scheduleMainText}>{scheduledAt ? 'Scheduled for Later' : 'Delivery in 10-15 mins'}</Text>
                <Text style={styles.scheduleSubText}>{scheduledAt ? 'Tomorrow' : 'As soon as possible'}</Text>
              </View>
            </View>
            
            <View style={styles.scheduleRight}>
               {scheduledAt && (
                 <TouchableOpacity onPress={() => { triggerHaptic(); dispatch(setScheduledAt(null)); }} style={styles.scheduleCancelBtn}>
                   <Text style={styles.scheduleCancelText}>Reset</Text>
                 </TouchableOpacity>
               )}
               <TouchableOpacity 
                 onPress={() => { triggerHaptic(); navigation.navigate('ScheduleOrder'); }}
                 style={styles.scheduleActionBtn}
               >
                 <Text style={styles.scheduleActionText}>{scheduledAt ? 'Edit' : 'Schedule'}</Text>
               </TouchableOpacity>
            </View>
          </View>

          {/* Promo Code Section */}
          <Text style={styles.sectionLabel}>Offers & Coupons</Text>
          <View style={styles.promoCardContainer}>
            <TextInput 
              placeholder="Enter Promo Code"
              placeholderTextColor="#9CA3AF"
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
                  <Ticket size={14} color="#10B981" />
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
              placeholderTextColor="#9CA3AF"
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
                  <Sparkles size={14} color="#10B981" />
                  <Text style={styles.discountLabel}>Promo Discount</Text>
                </View>
                <Text style={styles.discountValue}>-₹{p.discountPaise / 100}</Text>
              </Animated.View>
            )}
            {p.isSubscriptionOrder && (
              <Animated.View entering={FadeInDown} style={styles.discountRow}>
                <View style={styles.discountRowLeft}>
                  <Star size={14} color="#F59E0B" />
                  <Text style={styles.discountLabel}>Pro Credit Used</Text>
                </View>
                <Text style={styles.discountValue}>-₹{p.subtotalPaise / 100}</Text>
              </Animated.View>
            )}
            {p.loyaltyDiscountPaise > 0 && (
              <Animated.View entering={FadeInDown} style={styles.discountRow}>
                <View style={styles.discountRowLeft}>
                  <Star size={14} color="#F59E0B" />
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

      {/* EDGE-TO-EDGE CHECKOUT FOOTER */}
      <Animated.View entering={FadeIn.duration(300)} style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
        <View style={styles.footerTotalSection}>
          <Text style={styles.footerTotalLabel}>Total to Pay</Text>
          <Text style={styles.footerTotalValue}>₹{finalTotal / 100}</Text>
        </View>
        
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
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.checkoutMainText}>Checkout</Text>
            <View style={styles.checkoutArrowWrapper}>
              <ArrowRight size={16} color="#FFFFFF" />
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* FULL SCREEN LOADING OVERLAY */}
      {isCheckingOut && (
        <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(300)} style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingOverlayText}>Securing your items...</Text>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF' },
  backButton: { width: 40, height: 40, backgroundColor: '#F9FAFB', borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#1A1A2E', fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  clearButton: { width: 40, height: 40, backgroundColor: '#FEF2F2', borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingVertical: 24 },
  
  availableOfferChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 12,
  },
  offerCodeText: { color: '#10B981', fontWeight: '900', fontSize: 12 },
  offerDescText: { color: '#6B7280', fontSize: 10, fontWeight: '600' },
  
  proCard: { backgroundColor: '#1A1A2E', borderRadius: 24, padding: 24, marginBottom: 32, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 8 },
  proIconWrapper: { width: 48, height: 48, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  proTextColumn: { flex: 1 },
  proTitle: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },
  proSub: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700', marginTop: 2 },
  
  sectionLabel: { color: '#9CA3AF', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12, marginLeft: 4 },
  
  itemCard: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, backgroundColor: '#FFFFFF', padding: 12, borderRadius: 20, borderWidth: 1, borderColor: '#F3F4F6', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 8, elevation: 2 },
  itemImageWrapper: { width: 70, height: 70, backgroundColor: '#F9FAFB', borderRadius: 16, overflow: 'hidden' },
  itemImage: { width: '100%', height: '100%' },
  itemPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  itemInfo: { flex: 1, marginLeft: 16, marginRight: 8 },
  itemNameRow: { flexDirection: 'row', alignItems: 'center' },
  vegIndicator: { width: 10, height: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: 8, borderRadius: 2 },
  vegDot: { width: 4, height: 4, borderRadius: 2 },
  itemName: { color: '#1A1A2E', fontWeight: '800', fontSize: 14, flex: 1 },
  itemPrice: { color: '#1A1A2E', fontWeight: '900', fontSize: 14, marginTop: 4 },
  quantityControl: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', borderRadius: 12, paddingHorizontal: 6, paddingVertical: 4 },
  quantityBtnText: { color: '#10B981', fontSize: 16, fontWeight: '900', paddingHorizontal: 8 },
  quantityValueText: { color: '#1A1A2E', fontWeight: '900', fontSize: 14 },
  
  addMoreButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 32, borderWidth: 1, borderColor: '#F3F4F6', borderStyle: 'dashed' },
  addMoreText: { color: '#1A1A2E', fontWeight: '800', fontSize: 13 },
  
  scheduleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, marginBottom: 32, borderWidth: 1, borderColor: '#F3F4F6', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 8, elevation: 2 },
  scheduleLeft: { flexDirection: 'row', alignItems: 'center' },
  scheduleIconWrapper: { width: 40, height: 40, backgroundColor: '#ECFDF5', borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  scheduleMainText: { color: '#1A1A2E', fontWeight: '800', fontSize: 14 },
  scheduleSubText: { color: '#6B7280', fontWeight: '600', fontSize: 12, marginTop: 2 },
  scheduleRight: { flexDirection: 'row', alignItems: 'center' },
  scheduleCancelBtn: { marginRight: 16 },
  scheduleCancelText: { color: '#EF4444', fontWeight: '800', fontSize: 12, textTransform: 'uppercase' },
  scheduleActionBtn: { backgroundColor: '#F9FAFB', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6' },
  scheduleActionText: { color: '#1A1A2E', fontWeight: '800', fontSize: 12, textTransform: 'uppercase' },
  
  instructionCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, marginBottom: 32, borderWidth: 1, borderColor: '#F3F4F6' },
  instructionInput: { color: '#1A1A2E', fontWeight: '600', fontSize: 14, height: 60, textAlignVertical: 'top' },
  
  promoCardContainer: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 6, marginBottom: 32, borderWidth: 1, borderColor: '#F3F4F6', alignItems: 'center' },
  promoInput: { flex: 1, paddingHorizontal: 12, color: '#1A1A2E', fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },
  applyBtn: { backgroundColor: '#10B981', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 16 },
  applyBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12, textTransform: 'uppercase' },
  
  billCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#F3F4F6', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 8, elevation: 2 },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  billRowLabel: { color: '#6B7280', fontWeight: '600', fontSize: 13 },
  billRowValue: { color: '#1A1A2E', fontWeight: '800', fontSize: 13 },
  discountRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6', borderStyle: 'dashed' },
  discountRowLeft: { flexDirection: 'row', alignItems: 'center' },
  discountLabel: { color: '#10B981', fontWeight: '800', fontSize: 13, marginLeft: 8 },
  discountValue: { color: '#10B981', fontWeight: '800', fontSize: 13 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  totalLabel: { color: '#1A1A2E', fontWeight: '900', fontSize: 16 },
  totalValue: { color: '#1A1A2E', fontWeight: '900', fontSize: 20 },
  
  footer: { backgroundColor: '#FFFFFF', paddingHorizontal: 24, paddingTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  footerTotalSection: { flex: 1 },
  footerTotalLabel: { color: '#9CA3AF', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  footerTotalValue: { color: '#1A1A2E', fontSize: 22, fontWeight: '900', marginTop: 2, letterSpacing: -0.5 },
  checkoutButton: { backgroundColor: '#10B981', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 16, flexDirection: 'row', alignItems: 'center' },
  checkoutMainText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, marginRight: 8 },
  checkoutArrowWrapper: { width: 28, height: 28, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  
  emptyContainer: { flex: 1, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIconWrapper: { width: 128, height: 128, backgroundColor: '#FFFFFF', borderRadius: 64, alignItems: 'center', justifyContent: 'center', marginBottom: 32, borderWidth: 1, borderColor: '#F3F4F6', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 10, elevation: 4 },
  emptyTitle: { color: '#1A1A2E', fontSize: 28, fontWeight: '900', textAlign: 'center' },
  emptySub: { color: '#6B7280', textAlign: 'center', marginTop: 16, fontWeight: '600', fontSize: 15, lineHeight: 24 },
  exploreButton: { marginTop: 40, backgroundColor: '#1A1A2E', paddingHorizontal: 48, paddingVertical: 20, borderRadius: 24 },
  exploreButtonText: { color: '#FFFFFF', fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2, fontSize: 14 },
  
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center', zIndex: 9999 },
  loadingOverlayText: { color: '#1A1A2E', fontSize: 18, fontWeight: '900', marginTop: 16 }
});

export default CartScreen;
