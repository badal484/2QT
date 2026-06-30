import React from 'react';
import { BouncingButton } from '../components/ui/BouncingButton';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CircleCheck, Bike, Home } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const hapticOpts = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };

const OrderPlacedScreen = ({ route, navigation }: any) => {
  const {
    orderId,
    displayId,
    menuOfferDiscountPaise = 0,
    promoDiscountPaise = 0,
    loyaltyDiscountPaise = 0,
    walletDeductionPaise = 0,
    subtotalPaise = 0,
    promoCode,
  } = route.params || {};
  const insets = useSafeAreaInsets();

  const totalSavedPaise = menuOfferDiscountPaise + promoDiscountPaise + loyaltyDiscountPaise;

  const handleTrack = () => {
    ReactNativeHapticFeedback.trigger('impactLight', hapticOpts);
    if (totalSavedPaise > 0) {
      navigation.replace('OrderSavings', {
        orderId, displayId,
        menuOfferDiscountPaise, promoDiscountPaise,
        loyaltyDiscountPaise, walletDeductionPaise,
        subtotalPaise, promoCode,
      });
    } else {
      navigation.replace('OrderConfirmed', { orderId });
    }
  };

  const handleHome = () => {
    ReactNativeHapticFeedback.trigger('impactLight', hapticOpts);
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      {/* Success icon */}
      <View style={styles.iconWrap}>
        <View style={styles.iconCircle}>
          <CircleCheck size={52} color={colors.primary} strokeWidth={1.8} />
        </View>
      </View>

      {/* Text */}
      <Text style={styles.title}>Order Confirmed!</Text>
      <Text style={styles.sub}>Your order has been placed successfully.</Text>

      {displayId && (
        <View style={styles.orderIdBadge}>
          <Text style={styles.orderIdText}>#{displayId}</Text>
        </View>
      )}

      <Text style={styles.hint}>
        Our kitchen has received your order and will start preparing it shortly.
      </Text>

      {/* Buttons */}
      <View style={styles.btnGroup}>
        <BouncingButton style={styles.trackBtn} onPress={handleTrack} activeOpacity={0.85}>
          <Bike size={18} color="#fff" />
          <Text style={styles.trackBtnText}>Track Order</Text>
        </BouncingButton>

        <BouncingButton style={styles.homeBtn} onPress={handleHome} activeOpacity={0.85}>
          <Home size={18} color={colors.primary} />
          <Text style={styles.homeBtnText}>Back to Home</Text>
        </BouncingButton>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconWrap: {
    marginBottom: 28,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fontFamily.extrabold,
    fontSize: 28,
    color: '#1A1A2E',
    marginBottom: 10,
    textAlign: 'center',
  },
  sub: {
    fontFamily: fontFamily.regular,
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  orderIdBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
  },
  orderIdText: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    color: '#374151',
    letterSpacing: 1,
  },
  hint: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 48,
    paddingHorizontal: 8,
  },
  btnGroup: {
    width: '100%',
    gap: 12,
  },
  trackBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
  },
  trackBtnText: {
    fontFamily: fontFamily.extrabold,
    fontSize: 15,
    color: '#fff',
    letterSpacing: 0.5,
  },
  homeBtn: {
    backgroundColor: '#F0FDF4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
  },
  homeBtnText: {
    fontFamily: fontFamily.extrabold,
    fontSize: 15,
    color: colors.primary,
    letterSpacing: 0.5,
  },
});

export default OrderPlacedScreen;
