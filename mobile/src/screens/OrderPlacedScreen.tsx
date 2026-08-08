import { tokens } from '../theme/tokens';
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CircleCheck, Bike, Home } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { haptics } from '../utils/haptics';
import { Button } from '../components/ui/Button';
import { PressableScale } from '../components/ui/internal/PressableScale';

const OrderPlacedScreen = ({ route, navigation }: any) => {
  const {
    orderId,
    displayId,
    menuOfferDiscountPaise = 0,
    promoDiscountPaise = 0,
    campaignDiscountPaise = 0,
    loyaltyDiscountPaise = 0,
    walletDeductionPaise = 0,
    subtotalPaise = 0,
    promoCode,
  } = route.params || {};
  const insets = useSafeAreaInsets();

  const totalSavedPaise = menuOfferDiscountPaise + promoDiscountPaise + campaignDiscountPaise + loyaltyDiscountPaise;

  useEffect(() => {
    haptics.success();
  }, []);

  const handleTrack = () => {
    if (totalSavedPaise > 0) {
      navigation.replace('OrderSavings', {
        orderId, displayId,
        menuOfferDiscountPaise, promoDiscountPaise,
        campaignDiscountPaise,
        loyaltyDiscountPaise, walletDeductionPaise,
        subtotalPaise, promoCode,
      });
    } else {
      navigation.replace('OrderConfirmed', { orderId });
    }
  };

  const handleHome = () => {
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <Animated.View entering={ZoomIn.duration(300)} style={styles.iconWrap}>
        <View style={styles.iconCircle}>
          <CircleCheck size={52} color={tokens.colors.primary} strokeWidth={1.8} />
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(150).duration(300)} style={{ alignItems: 'center' }}>
        <Text allowFontScaling maxFontSizeMultiplier={1.4} style={styles.title}>Order Confirmed!</Text>
        <Text allowFontScaling maxFontSizeMultiplier={1.4} style={styles.sub}>Your order has been placed successfully.</Text>

        {displayId && (
          <View style={styles.orderIdBadge}>
            <Text allowFontScaling maxFontSizeMultiplier={1.4} style={styles.orderIdText}>#{displayId}</Text>
          </View>
        )}

        <Text allowFontScaling maxFontSizeMultiplier={1.4} style={styles.hint}>
          Our kitchen has received your order and will start preparing it shortly.
        </Text>
      </Animated.View>

      <Animated.View entering={FadeIn.delay(300).duration(300)} style={styles.btnGroup}>
        <Button
          label="Track Order"
          onPress={handleTrack}
          icon={<Bike size={18} color={tokens.colors.textInverse} />}
        />

        <PressableScale style={styles.homeBtn} onPress={handleHome}>
          <Home size={18} color={tokens.colors.primary} />
          <Text allowFontScaling maxFontSizeMultiplier={1.4} style={styles.homeBtnText}>Back to Home</Text>
        </PressableScale>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
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
    backgroundColor: tokens.colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: tokens.typography.family.extrabold,
    fontSize: 28,
    color: tokens.colors.textPrimary,
    marginBottom: 10,
    textAlign: 'center',
  },
  sub: {
    fontFamily: tokens.typography.family.regular,
    fontSize: 15,
    color: tokens.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  orderIdBadge: {
    backgroundColor: tokens.colors.background,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
  },
  orderIdText: {
    fontFamily: tokens.typography.family.bold,
    fontSize: 14,
    color: tokens.colors.textPrimary,
    letterSpacing: 1,
  },
  hint: {
    fontFamily: tokens.typography.family.regular,
    fontSize: 13,
    color: tokens.colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 48,
    paddingHorizontal: 8,
  },
  btnGroup: {
    width: '100%',
    gap: 12,
  },
  homeBtn: {
    backgroundColor: tokens.colors.primaryTint,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: tokens.radii.md,
    gap: 10,
    minHeight: 48,
  },
  homeBtnText: {
    fontFamily: tokens.typography.family.extrabold,
    fontSize: 15,
    color: tokens.colors.primary,
    letterSpacing: 0.5,
  },
});

export default OrderPlacedScreen;
