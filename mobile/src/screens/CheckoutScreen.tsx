import { ArrowLeft, MapPin, CreditCard, ArrowRight, Sparkles, Clock } from 'lucide-react-native';
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, StyleSheet } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { getSocket } from '../socket/client';
import { useSelector, useDispatch } from 'react-redux';
import { clearCart, setPromoCode as setPromoCodeAction } from '../store/slices/cartSlice';
import RazorpayCheckout from 'react-native-razorpay';

const CheckoutScreen = ({ navigation, route }: any) => {
  const queryClient = useQueryClient();
  const socket = getSocket();
  const dispatch = useDispatch();
  const cart = useSelector((state: any) => state.cart);
  const { user } = useSelector((state: any) => state.auth);

  React.useEffect(() => {
    if (socket) {
      const handleUpdate = () => {
        queryClient.invalidateQueries({ queryKey: ['pricing'] });
        queryClient.invalidateQueries({ queryKey: ['wallet'] });
        queryClient.invalidateQueries({ queryKey: ['loyalty'] });
      };
      socket.on('wallet_updated', handleUpdate);
      socket.on('loyalty_updated', handleUpdate);
      socket.on('subscription_updated', handleUpdate);
      return () => {
        socket.off('wallet_updated', handleUpdate);
        socket.off('loyalty_updated', handleUpdate);
        socket.off('subscription_updated', handleUpdate);
      };
    }
  }, [socket]);

  const [useWallet, setUseWallet] = useState(false);
  const [useLoyalty, setUseLoyalty] = useState(false);
  const [promoCode, setPromoCode] = useState(route.params?.promoCode || '');
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cod'>('online');
  
  const { data: pricing, isLoading: loadingPricing } = useQuery({
    queryKey: ['pricing', cart.items, useWallet, useLoyalty, promoCode],
    queryFn: () => api.post('/payment/create-order', { 
        items: cart.items, 
        addressId: route.params?.addressId, 
        useWallet,
        useLoyalty,
        promoCode,
        dryRun: true 
    }),
  });

  const { data: addresses } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => api.get('/customers/addresses'),
  });

  const selectedAddress = addresses?.addresses?.find((a: any) => a.id === route.params?.addressId);

  const { data: loyaltyData } = useQuery({
    queryKey: ['loyalty'],
    queryFn: () => api.get('/customers/loyalty'),
  });

  const [isVerifying, setIsVerifying] = useState(false);

  const verifyOrder = async (orderId: string) => {
    setIsVerifying(true);
    let attempts = 0;
    const maxAttempts = 10;
    
    const interval = setInterval(async () => {
      attempts++;
      try {
        const res: any = await api.get(`/orders/${orderId}`);
        if (res.order?.status === 'confirmed' || res.order?.status === 'preparing') {
          clearInterval(interval);
          setIsVerifying(false);
          dispatch(clearCart());
          queryClient.invalidateQueries({ queryKey: ['wallet'] });
          queryClient.invalidateQueries({ queryKey: ['loyalty'] });
          queryClient.invalidateQueries({ queryKey: ['order-history'] });
          navigation.navigate('OrderConfirmed', { orderId });
        }
      } catch (e) {
        console.log('Verification polling error:', e);
      }

      if (attempts >= maxAttempts) {
        clearInterval(interval);
        setIsVerifying(false);
        Alert.alert('Payment Pending', 'Your payment is being processed. You can check the status in your orders history.');
        navigation.navigate('OrderHistory');
      }
    }, 2000);
  };

  const placeOrderMutation = useMutation({
    mutationFn: (data: any) => api.post('/payment/create-order', data),
    onSuccess: (res: any) => {
      if (res.status === 'confirmed') {
        dispatch(clearCart());
        navigation.navigate('OrderConfirmed', { orderId: res.orderId });
        return;
      }

      if (__DEV__ && !res.keyId) {
        api.post('/payment/mock-success', { razorpayOrderId: res.razorpayOrderId })
          .then(() => verifyOrder(res.orderId))
          .catch((err) => {
            Alert.alert('Mock Payment Failed', err.message);
          });
        return;
      }

      const options = {
        description: 'Velto Food Order',
        image: 'https://velto.app/logo.png',
        currency: 'INR',
        key: res.keyId,
        amount: res.amount,
        name: 'VELTO',
        order_id: res.razorpayOrderId,
        prefill: {
          email: user?.email || 'customer@velto.app',
          contact: user?.phone || '',
          name: user?.name || 'Customer'
        },
        theme: { color: '#FF6B35' }
      };

      if (RazorpayCheckout && typeof RazorpayCheckout.open === 'function') {
        RazorpayCheckout.open(options)
          .then((data: any) => {
            verifyOrder(res.orderId);
          })
          .catch((error: any) => {
            Alert.alert('Payment Failed', error.description || 'Transaction cancelled');
          });
      } else {
        Alert.alert('Error', 'Payment gateway is not available on this device.');
      }
    },
    onError: (err: any) => {
      Alert.alert('Order Failed', err.message || 'Could not initiate payment');
    }
  });

  if (isVerifying) return (
    <View style={styles.verifyingContainer}>
      <ActivityIndicator size="large" color="#FF6B35" />
      <Text style={styles.verifyingTitle}>Verifying Payment</Text>
      <Text style={styles.verifyingSub}>We are confirming your order with our kitchen. Please don't close the app.</Text>
    </View>
  );

  if (loadingPricing) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FF6B35" />
      <Text style={styles.loadingText}>Calculating Total</Text>
    </View>
  );

  const p = pricing?.pricing || { totalAmountPaise: 0, subtotalPaise: 0, deliveryFeePaise: 0, gstPaise: 0 };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView}>
        <View style={styles.scrollContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <ArrowLeft size={24} color="#1A1A2E" />
          </TouchableOpacity>

          <Text style={styles.screenTitle}>Final Step</Text>
          <Text style={styles.screenSubTitle}>Review and Pay</Text>

          {/* Delivery Address Summary */}
          <View style={styles.addressCard}>
            <View style={styles.addressHeader}>
              <View style={styles.addressIconWrapper}>
                <MapPin size={24} color="#FF6B35" />
              </View>
              <View style={styles.addressLabelCol}>
                <Text style={styles.addressSubLabel}>Delivering to</Text>
                <Text style={styles.addressLabel} numberOfLines={1}>{selectedAddress?.label || 'Selected Address'}</Text>
              </View>
            </View>
            <Text style={styles.addressText}>
              {selectedAddress?.address_text}, {selectedAddress?.landmark}
            </Text>
          </View>

          {/* Delivery & Notes Summary */}
          {(route.params?.scheduledAt || route.params?.instructions) && (
            <View style={styles.metaInfoRow}>
              {route.params?.scheduledAt && (
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Schedule</Text>
                  <View style={styles.metaValueRow}>
                    <Clock size={12} color="#FF6B35" />
                    <Text style={styles.metaValue}>
                      {new Date(route.params.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              )}
              {route.params?.instructions && (
                <View style={[styles.metaItem, { flex: 2 }]}>
                  <Text style={styles.metaLabel}>Kitchen Notes</Text>
                  <Text style={styles.metaValueSmall} numberOfLines={1}>{route.params.instructions}</Text>
                </View>
              )}
            </View>
          )}

          {/* Bill Details */}
          <View style={styles.billCard}>
            <Text style={styles.billHeader}>Bill Details</Text>
            
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Item Total</Text>
              <Text style={styles.billValue}>₹{p.subtotalPaise / 100}</Text>
            </View>
            
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Delivery Fee</Text>
              <Text style={styles.billValue}>₹{p.deliveryFeePaise / 100}</Text>
            </View>
            
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Taxes & Charges</Text>
              <Text style={styles.billValue}>₹{(p.cgstPaise + p.sgstPaise) / 100}</Text>
            </View>

            {p.discountPaise > 0 && (
              <View style={styles.billRow}>
                <Text style={styles.discountText}>Promo Discount</Text>
                <Text style={styles.discountValue}>-₹{p.discountPaise / 100}</Text>
              </View>
            )}

            {p.loyaltyDiscountPaise > 0 && (
              <View style={styles.billRow}>
                <Text style={styles.loyaltyText}>Points Applied</Text>
                <Text style={styles.loyaltyValue}>-₹{p.loyaltyDiscountPaise / 100}</Text>
              </View>
            )}

            {p.walletDeductionPaise > 0 && (
              <View style={styles.billRow}>
                <Text style={styles.discountText}>Wallet Used</Text>
                <Text style={styles.discountValue}>-₹{p.walletDeductionPaise / 100}</Text>
              </View>
            )}

            {p.isSubscriptionOrder && (
              <View style={styles.subOrderBadge}>
                <View style={styles.subOrderBadgeLeft}>
                    <Sparkles size={14} color="#FF6B35" />
                    <Text style={styles.subOrderText}>Pro Meal Credit</Text>
                </View>
                <Text style={styles.subOrderValue}>-₹{p.subtotalPaise / 100}</Text>
              </View>
            )}

            <View style={styles.billDivider} />
            
            <View style={styles.billTotalRow}>
              <Text style={styles.billTotalLabel}>Total</Text>
              <Text style={styles.billTotalValue}>₹{p.gatewayAmountPaise / 100}</Text>
            </View>
          </View>

          {/* Wallet Toggle */}
          <TouchableOpacity 
            onPress={() => setUseWallet(!useWallet)}
            activeOpacity={0.8}
            style={[styles.toggleCard, useWallet ? styles.toggleCardActive : styles.toggleCardInactive]}
          >
            <View style={styles.toggleCardLeft}>
              <View style={styles.toggleIconWrapper}>
                <CreditCard size={24} color="#1A1A2E" />
              </View>
              <View>
                <Text style={styles.toggleTitle}>Velto Wallet</Text>
                <Text style={styles.toggleSub}>Bal: ₹{pricing?.availableWallet / 100 || 0}</Text>
              </View>
            </View>
            <View style={[styles.switchTrack, { backgroundColor: useWallet ? '#FF6B35' : '#e5e7eb' }]}>
              <View style={[styles.switchThumb, { alignSelf: useWallet ? 'flex-end' : 'flex-start' }]} />
            </View>
          </TouchableOpacity>

          {/* Loyalty Toggle */}
          <TouchableOpacity 
            onPress={() => setUseLoyalty(!useLoyalty)}
            activeOpacity={0.8}
            disabled={!loyaltyData?.points}
            style={[styles.toggleCard, useLoyalty ? styles.toggleCardActive : styles.toggleCardInactive, !loyaltyData?.points && { opacity: 0.5 }]}
          >
            <View style={styles.toggleCardLeft}>
              <View style={styles.toggleIconWrapper}>
                <Sparkles size={24} color={useLoyalty ? "#FF6B35" : "#1A1A2E"} />
              </View>
              <View>
                <Text style={styles.toggleTitle}>Velto Points</Text>
                <Text style={styles.toggleSub}>Bal: {loyaltyData?.points || 0} pts</Text>
              </View>
            </View>
            <View style={[styles.switchTrack, { backgroundColor: useLoyalty ? '#FF6B35' : '#e5e7eb' }]}>
              <View style={[styles.switchThumb, { alignSelf: useLoyalty ? 'flex-end' : 'flex-start' }]} />
            </View>
          </TouchableOpacity>

          {/* Promo Code */}
          <View style={styles.promoCard}>
            <View style={styles.promoInputWrapper}>
              <TextInput 
                placeholder="PROMO CODE" 
                placeholderTextColor="#A0A0A0"
                value={promoCode}
                onChangeText={setPromoCode}
                style={styles.promoInput}
              />
            </View>
            <TouchableOpacity 
              style={styles.promoApplyBtn}
              onPress={() => {
                if (promoCode.toUpperCase() === 'VELTO50') {
                  dispatch(setPromoCodeAction(promoCode.toUpperCase()));
                  Alert.alert('Success', 'Promo code applied! You get 50% off.');
                } else {
                  Alert.alert('Invalid Code', 'Try VELTO50 for a discount.');
                }
              }} 
            >
              <Text style={styles.promoApplyText}>Apply</Text>
            </TouchableOpacity>
          </View>

          {/* Payment Method Selector */}
          <Text style={styles.sectionTitle}>Payment Method</Text>
          
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => setPaymentMethod('online')}
            style={[styles.paymentMethodBtn, paymentMethod === 'online' ? styles.paymentMethodBtnActive : styles.paymentMethodBtnInactive]}
          >
            <View style={styles.paymentMethodLeft}>
              <View style={styles.paymentMethodIconWrapper}>
                <CreditCard size={20} color={paymentMethod === 'online' ? '#FF6B35' : '#1A1A2E'} />
              </View>
              <Text style={[styles.paymentMethodText, paymentMethod === 'online' ? styles.paymentMethodTextActive : styles.paymentMethodTextInactive]}>Pay Online / UPI</Text>
            </View>
            <View style={[styles.radioOuter, { borderColor: paymentMethod === 'online' ? '#FF6B35' : '#d1d5db' }]}>
              {paymentMethod === 'online' && <View style={styles.radioInner} />}
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => setPaymentMethod('cod')}
            style={[styles.paymentMethodBtn, paymentMethod === 'cod' ? styles.paymentMethodBtnActive : styles.paymentMethodBtnInactive, { marginBottom: 120 }]}
          >
            <View style={styles.paymentMethodLeft}>
              <View style={styles.paymentMethodIconWrapper}>
                <Text style={styles.codEmoji}>💵</Text>
              </View>
              <Text style={[styles.paymentMethodText, paymentMethod === 'cod' ? styles.paymentMethodTextActive : styles.paymentMethodTextInactive]}>Cash on Delivery</Text>
            </View>
            <View style={[styles.radioOuter, { borderColor: paymentMethod === 'cod' ? '#FF6B35' : '#d1d5db' }]}>
              {paymentMethod === 'cod' && <View style={styles.radioInner} />}
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Final Action Button */}
      <View style={styles.footer}>
        <TouchableOpacity 
          onPress={() => placeOrderMutation.mutate({ 
            items: cart.items, 
            addressId: route.params?.addressId, 
            useWallet,
            useLoyalty,
            promoCode,
            paymentMethod,
            scheduledAt: route.params?.scheduledAt,
            instructions: route.params?.instructions
          })}
          disabled={placeOrderMutation.isPending}
          style={styles.payButton}
        >
          <View>
            <Text style={styles.payButtonSub}>Secure Checkout</Text>
            <Text style={styles.payButtonMain}>Pay ₹{p.gatewayAmountPaise / 100}</Text>
          </View>
          {placeOrderMutation.isPending ? (
            <ActivityIndicator color="white" />
          ) : (
            <View style={styles.payArrowWrapper}>
              <ArrowRight size={24} color="white" />
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 32,
  },
  backButton: {
    marginBottom: 32,
    alignSelf: 'flex-start',
    width: 48,
    height: 48,
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenTitle: {
    color: '#1A1A2E',
    fontSize: 40,
    fontWeight: '900',
    marginBottom: 8,
  },
  screenSubTitle: {
    color: '#9ca3af',
    fontWeight: '900',
    marginBottom: 40,
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 12,
  },
  addressCard: {
    backgroundColor: '#f9fafb',
    padding: 24,
    borderRadius: 32,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  addressIconWrapper: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  addressLabelCol: {
    flex: 1,
  },
  addressSubLabel: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  addressLabel: {
    color: '#1A1A2E',
    fontWeight: '900',
    fontSize: 15,
  },
  addressText: {
    color: '#6b7280',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 20,
  },
  metaInfoRow: {
    backgroundColor: '#f9fafb',
    padding: 24,
    borderRadius: 32,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    flexDirection: 'row',
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 4,
  },
  metaValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaValue: {
    color: '#1A1A2E',
    fontWeight: '900',
    fontSize: 12,
    marginLeft: 4,
  },
  metaValueSmall: {
    color: '#1A1A2E',
    fontWeight: '700',
    fontSize: 12,
  },
  billCard: {
    backgroundColor: '#1A1A2E',
    padding: 32,
    borderRadius: 40,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 10,
  },
  billHeader: {
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 10,
    marginBottom: 24,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  billLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '700',
  },
  billValue: {
    color: '#fff',
    fontWeight: '900',
  },
  discountText: {
    color: '#4ADE80',
    fontWeight: '700',
  },
  discountValue: {
    color: '#4ADE80',
    fontWeight: '900',
  },
  loyaltyText: {
    color: '#FF6B35',
    fontWeight: '700',
  },
  loyaltyValue: {
    color: '#FF6B35',
    fontWeight: '900',
  },
  subOrderBadge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    backgroundColor: 'rgba(255, 107, 53, 0.2)',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.1)',
  },
  subOrderBadgeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subOrderText: {
    color: '#FB923C',
    fontWeight: '700',
    marginLeft: 8,
  },
  subOrderValue: {
    color: '#FB923C',
    fontWeight: '900',
  },
  billDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 24,
  },
  billTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  billTotalLabel: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
  },
  billTotalValue: {
    color: '#FF6B35',
    fontSize: 32,
    fontWeight: '900',
  },
  toggleCard: {
    padding: 24,
    borderRadius: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
  },
  toggleCardActive: {
    backgroundColor: 'rgba(255, 107, 53, 0.05)',
    borderColor: '#FF6B35',
  },
  toggleCardInactive: {
    backgroundColor: '#fff',
    borderColor: '#f3f4f6',
  },
  toggleCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleIconWrapper: {
    width: 48,
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  toggleTitle: {
    color: '#1A1A2E',
    fontWeight: '900',
  },
  toggleSub: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginTop: 4,
  },
  switchTrack: {
    width: 56,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  switchThumb: {
    width: 20,
    height: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  promoCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    padding: 10,
    borderRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  promoInputWrapper: {
    flex: 1,
    paddingHorizontal: 20,
  },
  promoInput: {
    fontWeight: '900',
    color: '#1A1A2E',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  promoApplyBtn: {
    backgroundColor: '#1A1A2E',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 24,
  },
  promoApplyText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  sectionTitle: {
    color: '#9ca3af',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 10,
    marginBottom: 24,
    marginLeft: 8,
  },
  paymentMethodBtn: {
    padding: 24,
    borderRadius: 32,
    marginBottom: 16,
    borderWidth: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentMethodBtnActive: {
    backgroundColor: 'rgba(255, 107, 53, 0.05)',
    borderColor: '#FF6B35',
  },
  paymentMethodBtnInactive: {
    backgroundColor: '#fff',
    borderColor: '#f3f4f6',
  },
  paymentMethodLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentMethodIconWrapper: {
    width: 40,
    height: 40,
    backgroundColor: '#fff',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  codEmoji: {
    fontSize: 20,
  },
  paymentMethodText: {
    fontWeight: '900',
  },
  paymentMethodTextActive: {
    color: '#FF6B35',
  },
  paymentMethodTextInactive: {
    color: '#1A1A2E',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    backgroundColor: '#FF6B35',
    borderRadius: 5,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 24,
    right: 24,
  },
  payButton: {
    height: 80,
    backgroundColor: '#FF6B35',
    borderRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  payButtonSub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  payButtonMain: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
  },
  payArrowWrapper: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#9ca3af',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 10,
  },
  verifyingContainer: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  verifyingTitle: {
    marginTop: 32,
    color: '#1A1A2E',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  verifyingSub: {
    marginTop: 8,
    color: '#9ca3af',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default CheckoutScreen;
