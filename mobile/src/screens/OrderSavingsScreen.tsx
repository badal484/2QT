import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated as RNAnimated, Share, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BouncingButton } from '../components/ui/BouncingButton';
import { Tag, Bike, Zap, Gift, ChevronRight, Share2 } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const hapticOpts = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };
const triggerSuccess = () => ReactNativeHapticFeedback.trigger('notificationSuccess', hapticOpts);

// Animated counter — counts up from 0 to target
const AnimatedCounter = ({ target, prefix = '₹', style }: { target: number; prefix?: string; style?: any }) => {
  const animated = useRef(new RNAnimated.Value(0)).current;
  const displayRef = useRef<TextInput>(null);

  useEffect(() => {
    RNAnimated.timing(animated, {
      toValue: target,
      duration: 1200,
      useNativeDriver: false,
    }).start();

    const listener = animated.addListener(({ value }) => {
      displayRef.current?.setNativeProps({ text: `${prefix}${value.toFixed(2)}` });
    });
    return () => animated.removeListener(listener);
  }, [target]);

  return (
    <TextInput
      ref={displayRef}
      defaultValue={`${prefix}0.00`}
      editable={false}
      style={style}
    />
  );
};

interface SavingsParams {
  orderId: string;
  displayId: string;
  menuOfferDiscountPaise?: number;
  promoDiscountPaise?: number;
  campaignDiscountPaise?: number;
  loyaltyDiscountPaise?: number;
  walletDeductionPaise?: number;
  subtotalPaise?: number;
  promoCode?: string;
}

const OrderSavingsScreen = ({ route, navigation }: any) => {
  const insets = useSafeAreaInsets();
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
  }: SavingsParams = route.params || {};

  const totalSavedPaise = menuOfferDiscountPaise + promoDiscountPaise + campaignDiscountPaise + loyaltyDiscountPaise;
  const totalSaved = totalSavedPaise / 100;
  const subtotal = subtotalPaise / 100;

  useEffect(() => {
    triggerSuccess();
  }, []);

  const handleTrack = () => {
    navigation.replace('OrderConfirmed', { orderId });
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `I just saved ₹${totalSaved.toFixed(0)} on my 2QT order! 🎉 Use my code for your first order too.`,
      });
    } catch { /* ignore */ }
  };

  const savingsLines = [
    menuOfferDiscountPaise > 0 && {
      icon: <Tag size={18} color="#059669" />,
      label: 'Item Offers',
      amount: menuOfferDiscountPaise / 100,
      color: '#059669',
      bg: '#F0FDF4',
    },
    promoDiscountPaise > 0 && {
      icon: <Gift size={18} color="#7C3AED" />,
      label: promoCode ? `Promo: ${promoCode}` : 'Promo Code',
      amount: promoDiscountPaise / 100,
      color: '#7C3AED',
      bg: '#F5F3FF',
    },
    campaignDiscountPaise > 0 && {
      icon: <Zap size={18} color="#7C3AED" />,
      label: 'Campaign Deal',
      amount: campaignDiscountPaise / 100,
      color: '#7C3AED',
      bg: '#F5F3FF',
    },
    loyaltyDiscountPaise > 0 && {
      icon: <Zap size={18} color="#D97706" />,
      label: 'Loyalty Points',
      amount: loyaltyDiscountPaise / 100,
      color: '#D97706',
      bg: '#FFFBEB',
    },
    walletDeductionPaise > 0 && {
      icon: <Bike size={18} color="#2563EB" />,
      label: '2QT Wallet',
      amount: walletDeductionPaise / 100,
      color: '#2563EB',
      bg: '#EFF6FF',
    },
  ].filter(Boolean) as Array<{ icon: any; label: string; amount: number; color: string; bg: string }>;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
      {/* Confetti dots — pure decorative View elements */}
      {['#FBBF24','#34D399','#F472B6','#60A5FA','#A78BFA','#FB923C'].map((c, i) => (
        <View key={i} style={[styles.confettiDot, {
          backgroundColor: c,
          top: 20 + (i * 37) % 120,
          left: (i * 67) % 320,
          width: 8 + (i % 3) * 4,
          height: 8 + (i % 3) * 4,
          borderRadius: 4 + (i % 3) * 2,
        }]} />
      ))}

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.emojiRing}>
          <Text style={styles.emoji}>🎉</Text>
        </View>
        <Text style={styles.title}>You saved</Text>
        <AnimatedCounter target={totalSaved} style={styles.totalAmount} />
        <Text style={styles.subtitle}>on order #{displayId}</Text>
      </View>

      {/* Savings breakdown */}
      {savingsLines.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>How you saved</Text>
          {savingsLines.map((line, i) => (
            <View key={i} style={[styles.savingRow, i < savingsLines.length - 1 && styles.savingRowBorder]}>
              <View style={[styles.savingIconBox, { backgroundColor: line.bg }]}>
                {line.icon}
              </View>
              <Text style={styles.savingLabel}>{line.label}</Text>
              <Text style={[styles.savingAmount, { color: line.color }]}>−₹{line.amount.toFixed(2)}</Text>
            </View>
          ))}
          {subtotal > 0 && (
            <View style={styles.savingPercent}>
              <Text style={styles.savingPercentText}>
                That's {Math.round((totalSaved / subtotal) * 100)}% off your order total
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Share nudge */}
      {totalSaved > 0 && (
        <BouncingButton onPress={handleShare} style={styles.shareBtn} activeOpacity={0.85}>
          <Share2 size={16} color="#7C3AED" />
          <Text style={styles.shareBtnText}>Share your savings</Text>
        </BouncingButton>
      )}

      {/* CTA */}
      <View style={styles.ctaGroup}>
        <BouncingButton onPress={handleTrack} style={styles.trackBtn} activeOpacity={0.88}>
          <Text style={styles.trackBtnText}>Track My Order</Text>
          <ChevronRight size={18} color="#fff" />
        </BouncingButton>
        <BouncingButton
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Home' }] })}
          style={styles.homeBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.homeBtnText}>Back to Home</Text>
        </BouncingButton>
      </View>
    </View>
  );
};

export default OrderSavingsScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingHorizontal: 24,
    overflow: 'hidden',
  },
  confettiDot: {
    position: 'absolute',
    opacity: 0.35,
  },

  header: { alignItems: 'center', marginBottom: 28 },
  emojiRing: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#FEF9C3',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 4, borderColor: '#FDE68A',
  },
  emoji: { fontSize: 44 },
  title: { fontSize: 18, fontFamily: fontFamily.bold, color: colors.inkMuted, marginBottom: 4 },
  totalAmount: {
    fontSize: 52, fontFamily: fontFamily.black, color: '#1B5E46', letterSpacing: -2,
    height: 64,
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 0,
  },
  subtitle: { fontSize: 14, fontFamily: fontFamily.medium, color: colors.inkFaint, marginTop: 4 },

  card: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  cardTitle: { fontSize: 13, fontFamily: fontFamily.extrabold, color: colors.inkFaint, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 16 },
  savingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  savingRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  savingIconBox: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  savingLabel: { flex: 1, fontSize: 14, fontFamily: fontFamily.semibold, color: colors.ink },
  savingAmount: { fontSize: 15, fontFamily: fontFamily.black },
  savingPercent: {
    marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6',
    alignItems: 'center',
  },
  savingPercentText: { fontSize: 13, fontFamily: fontFamily.bold, color: '#1B5E46' },

  shareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20,
    backgroundColor: '#F5F3FF',
    borderWidth: 1, borderColor: '#DDD6FE',
    marginBottom: 24,
  },
  shareBtnText: { fontSize: 14, fontFamily: fontFamily.bold, color: '#7C3AED' },

  ctaGroup: { width: '100%', gap: 12, marginTop: 'auto' },
  trackBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#1B5E46',
    borderRadius: 22, paddingVertical: 16,
    width: '100%',
  },
  trackBtnText: { fontSize: 16, fontFamily: fontFamily.black, color: '#FFFFFF' },
  homeBtn: { alignItems: 'center', paddingVertical: 12 },
  homeBtnText: { fontSize: 14, fontFamily: fontFamily.semibold, color: colors.inkMuted },
});
