import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, useWindowDimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, runOnJS } from 'react-native-reanimated';
import { ChefHat, Bike, ArrowRight, X } from 'lucide-react-native';
import { tokens } from '../../theme/tokens';
import { haptics } from '../../utils/haptics';
import { PressableScale } from './internal/PressableScale';

interface Props {
  visible: boolean;
  orders: any[];
  onClose: () => void;
  onSelectOrder: (orderId: string) => void;
}

export const ActiveOrdersBottomSheet = ({ visible, orders, onClose, onSelectOrder }: Props) => {
  const { height: SCREEN_HEIGHT } = useWindowDimensions();
  const [showModal, setShowModal] = useState(visible);
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setShowModal(true);
      opacity.value = withTiming(1, { duration: 250, easing: Easing.out(Easing.ease) });
      translateY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) });
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: 250 }, (finished) => {
        if (finished) runOnJS(setShowModal)(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  if (!showModal) return null;

  return (
    <Modal visible={showModal} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.overlay, overlayStyle]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[styles.sheet, sheetStyle]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title} allowFontScaling maxFontSizeMultiplier={1.4}>{orders.length} Active Orders</Text>
          <PressableScale onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8}>
            <X size={20} color={tokens.colors.textSecondary} />
          </PressableScale>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
          {orders.map((o) => (
            <PressableScale
              key={o.id}
              onPress={() => {
                haptics.selection();
                onClose();
                setTimeout(() => onSelectOrder(o.id), 100);
              }}
              style={styles.card}
            >
              <View style={styles.iconBox}>
                {o.status === 'out_for_delivery' ? (
                  <Bike size={20} color={tokens.colors.success} />
                ) : (
                  <ChefHat size={20} color={tokens.colors.warning} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.orderId} allowFontScaling maxFontSizeMultiplier={1.4}>Order #{o.display_id || o.id.slice(0, 8)}</Text>
                <Text style={styles.status} allowFontScaling maxFontSizeMultiplier={1.4}>
                  {o.status === 'placed' ? 'Order Placed' :
                   o.status === 'accepted' ? 'Preparing food' :
                   o.status === 'preparing' ? 'Preparing food' :
                   o.status === 'ready' ? 'Ready for pickup' :
                   o.status === 'out_for_delivery' ? 'Arriving soon' : 'Active Order'}
                </Text>
                <Text style={styles.details} numberOfLines={1} allowFontScaling maxFontSizeMultiplier={1.4}>
                  {o.items?.length || 0} items • ₹{(o.total_amount_paise / 100).toFixed(2)}
                </Text>
              </View>
              <View style={styles.arrowBox}>
                <ArrowRight size={16} color={tokens.colors.textSecondary} />
              </View>
            </PressableScale>
          ))}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: tokens.colors.overlay,
  },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: tokens.colors.surface,
    borderTopLeftRadius: tokens.radii.xl,
    borderTopRightRadius: tokens.radii.xl,
    paddingBottom: tokens.spacing.xxxl,
    maxHeight: '80%',
    ...tokens.shadows.strong,
  },
  handle: {
    width: 40, height: 4,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.border,
    alignSelf: 'center',
    marginTop: tokens.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.xl,
    paddingVertical: tokens.spacing.lg,
  },
  title: {
    fontSize: tokens.typography.type.h3.fontSize,
    fontFamily: tokens.typography.family.black,
    color: tokens.colors.textPrimary,
  },
  closeBtn: {
    width: 48, height: 48,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: tokens.spacing.xl,
    gap: tokens.spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: tokens.spacing.md,
    backgroundColor: tokens.colors.background,
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  iconBox: {
    width: 44, height: 44,
    borderRadius: 22,
    backgroundColor: tokens.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: tokens.spacing.md,
    ...tokens.shadows.soft,
  },
  orderId: {
    fontSize: tokens.typography.type.caption.fontSize,
    fontFamily: tokens.typography.family.bold,
    color: tokens.colors.textSecondary,
  },
  status: {
    fontSize: 15,
    fontFamily: tokens.typography.family.black,
    color: tokens.colors.textPrimary,
    marginTop: 2,
  },
  details: {
    fontSize: tokens.typography.type.caption.fontSize,
    fontFamily: tokens.typography.family.medium,
    color: tokens.colors.textSecondary,
    marginTop: 2,
  },
  arrowBox: {
    width: 32, height: 32,
    borderRadius: 16,
    backgroundColor: tokens.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...tokens.shadows.soft,
  }
});
