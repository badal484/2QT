import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Animated, Dimensions } from 'react-native';
import { ChefHat, Bike, ArrowRight, X } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { fontFamily } from '../../theme/typography';
import { BouncingButton } from './BouncingButton';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
  visible: boolean;
  orders: any[];
  onClose: () => void;
  onSelectOrder: (orderId: string) => void;
}

export const ActiveOrdersBottomSheet = ({ visible, orders, onClose, onSelectOrder }: Props) => {
  const [showModal, setShowModal] = useState(visible);
  const slideAnim = React.useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setShowModal(true);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, damping: 20, stiffness: 150, useNativeDriver: true })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: SCREEN_HEIGHT, duration: 250, useNativeDriver: true })
      ]).start(() => setShowModal(false));
    }
  }, [visible]);

  if (!showModal) return null;

  return (
    <Modal visible={showModal} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title}>{orders.length} Active Orders</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X size={20} color={colors.inkMuted} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
          {orders.map((o) => (
            <BouncingButton
              key={o.id}
              activeOpacity={0.9}
              onPress={() => {
                ReactNativeHapticFeedback.trigger('impactLight');
                onClose();
                setTimeout(() => onSelectOrder(o.id), 100);
              }}
              style={styles.card}
            >
              <View style={styles.iconBox}>
                {o.status === 'out_for_delivery' ? (
                  <Bike size={20} color="#34D399" />
                ) : (
                  <ChefHat size={20} color="#FBBF24" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.orderId}>Order #{o.display_id || o.id.slice(0, 8)}</Text>
                <Text style={styles.status}>
                  {o.status === 'placed' ? 'Order Placed' :
                   o.status === 'accepted' ? 'Preparing food' :
                   o.status === 'preparing' ? 'Preparing food' :
                   o.status === 'ready' ? 'Ready for pickup' :
                   o.status === 'out_for_delivery' ? 'Arriving soon' : 'Active Order'}
                </Text>
                <Text style={styles.details} numberOfLines={1}>
                  {o.items?.length || 0} items • ₹{(o.total_amount_paise / 100).toFixed(2)}
                </Text>
              </View>
              <View style={styles.arrowBox}>
                <ArrowRight size={16} color={colors.inkMuted} />
              </View>
            </BouncingButton>
          ))}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 20,
  },
  handle: {
    width: 40, height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 18,
    fontFamily: fontFamily.black,
    color: colors.ink,
  },
  closeBtn: {
    width: 32, height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: 20,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  iconBox: {
    width: 44, height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  orderId: {
    fontSize: 12,
    fontFamily: fontFamily.bold,
    color: colors.inkMuted,
  },
  status: {
    fontSize: 15,
    fontFamily: fontFamily.black,
    color: colors.ink,
    marginTop: 2,
  },
  details: {
    fontSize: 12,
    fontFamily: fontFamily.medium,
    color: colors.inkMuted,
    marginTop: 2,
  },
  arrowBox: {
    width: 32, height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  }
});
