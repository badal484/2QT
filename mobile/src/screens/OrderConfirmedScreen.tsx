import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { CheckCircle2, ChevronRight } from 'lucide-react-native';
import { fontFamily } from '../theme/typography';
import { colors } from '../theme/colors';

const OrderConfirmedScreen = ({ route, navigation }: any) => {
  const { orderId } = route.params;
  const scale = useSharedValue(0.5);
  const rotate = useSharedValue('-20deg');

  useEffect(() => {
    scale.value = withSpring(1, { stiffness: 300, damping: 20 });
    rotate.value = withSpring('0deg', { stiffness: 300, damping: 20 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotateZ: rotate.value }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.successIcon, animatedStyle]}>
        <CheckCircle2 size={64} color={colors.white} />
      </Animated.View>

      <Text style={styles.title}>Order Confirmed</Text>
      <Text style={styles.description}>
        Our master chefs are now preparing your gourmet meal with care.
      </Text>

      <View style={styles.detailsCard}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Order ID</Text>
          <Text style={styles.detailValue} numberOfLines={1}>#{orderId.slice(0, 8).toUpperCase()}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Est. Delivery</Text>
          <Text style={styles.estTime}>15-20 Mins</Text>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.trackBtn}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('OrderTracking', { orderId })}
      >
        <Text style={styles.trackBtnText}>Track Order</Text>
        <ChevronRight size={20} color={colors.white} />
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.homeBtn}
        onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Home' }] })}
      >
        <Text style={styles.homeBtnText}>Back to Home</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  successIcon: {
    width: 128,
    height: 128,
    backgroundColor: colors.primary,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 50,
    elevation: 10,
  },
  title: {
    color: colors.ink,
    fontSize: 32,
    fontFamily: fontFamily.black,
    textAlign: 'center',
    letterSpacing: -1,
  },
  description: {
    color: colors.inkMuted,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 24,
    fontFamily: fontFamily.medium,
    lineHeight: 24,
  },
  detailsCard: {
    backgroundColor: colors.surface,
    padding: 24,
    borderRadius: 24,
    marginTop: 48,
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  detailLabel: {
    color: colors.inkFaint,
    fontFamily: fontFamily.black,
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 10,
  },
  detailValue: {
    color: colors.ink,
    fontFamily: fontFamily.black,
  },
  estTime: {
    color: colors.primary,
    fontFamily: fontFamily.black,
  },
  trackBtn: {
    width: '100%',
    height: 60,
    backgroundColor: colors.primary,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  trackBtnText: {
    color: colors.white,
    fontSize: 16,
    fontFamily: fontFamily.bold,
    marginRight: 8,
  },
  homeBtn: {
    marginTop: 24,
    padding: 12,
  },
  homeBtnText: {
    color: colors.inkMuted,
    fontFamily: fontFamily.bold,
  },
});

export default OrderConfirmedScreen;
