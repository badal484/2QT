import { Minus, Plus } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, TouchableWithoutFeedback,
  ScrollView, StatusBar, StyleSheet, Alert, Dimensions,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { RootState } from '../store';
import { addItem, clearCart } from '../store/slices/cartSlice';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';

const { height: SCREEN_H } = Dimensions.get('window');
const IMAGE_H = Math.round(SCREEN_H * 0.42);
const ACCENT = colors.accent;

const ItemDetailScreen = ({ route, navigation }: any) => {
  const { item } = route.params;
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const cartItems = useSelector((state: RootState) => state.cart.items);
  const cartItem = useSelector((state: RootState) =>
    state.cart.items.find(ci => ci.menuItemId === item.id)
  );
  const [quantity, setQuantity] = useState(cartItem?.quantity || 1);

  const price = item.price_paise / 100;

  const handleAddToCart = () => {
    const doAdd = () => {
      dispatch(addItem({
        menuItemId: item.id,
        name: item.name,
        pricePaise: item.price_paise,
        quantity,
        photoUrl: item.photo_url,
        isVeg: item.is_veg,
        kitchenId: item.kitchen_id,
      }));
      navigation.goBack();
    };

    if (cartItems.length > 0 && cartItems[0].kitchenId !== item.kitchen_id) {
      Alert.alert(
        'Replace cart?',
        'Your cart has items from a different kitchen.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Replace', style: 'destructive', onPress: () => { dispatch(clearCart()); doAdd(); } },
        ]
      );
    } else {
      doAdd();
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Dim backdrop — tap to dismiss */}
      <Animated.View entering={FadeIn.duration(200)} style={StyleSheet.absoluteFill}>
        <TouchableWithoutFeedback onPress={() => navigation.goBack()}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>
      </Animated.View>

      {/* Bottom sheet */}
      <Animated.View entering={SlideInDown.duration(300)} style={styles.sheet}>

        {/* Hero image */}
        <View style={styles.hero}>
          {item.photo_url ? (
            <Image source={{ uri: item.photo_url }} style={styles.heroImg} resizeMode="cover" />
          ) : (
            <View style={[styles.heroImg, styles.heroPlaceholder]} />
          )}

          {/* X button */}
          <TouchableOpacity
            style={[styles.closeBtn, { top: 14 }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Category + Price */}
          <View style={styles.metaRow}>
            <View style={styles.categoryPill}>
              <Text style={styles.categoryText}>
                {item.category
                  ? item.category.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
                  : 'Dish'}
              </Text>
            </View>
            <Text style={styles.price}>
              ₹{price % 1 === 0 ? price : price.toFixed(2)}
            </Text>
          </View>

          {/* Name */}
          <Text style={styles.name}>{item.name}</Text>

          {/* Description */}
          {!!item.description && (
            <Text style={styles.description}>{item.description}</Text>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 8, 20) }]}>
          {/* Qty stepper */}
          <View style={styles.stepper}>
            <TouchableOpacity
              style={styles.stepperMinus}
              onPress={() => setQuantity(q => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              activeOpacity={0.7}
            >
              <Minus size={16} color={quantity <= 1 ? colors.inkFaint : colors.ink} strokeWidth={2.5} />
            </TouchableOpacity>
            <Text style={styles.stepperCount}>{quantity}</Text>
            <TouchableOpacity
              style={styles.stepperPlus}
              onPress={() => setQuantity(q => q + 1)}
              activeOpacity={0.8}
            >
              <Plus size={16} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          {/* Add / Update */}
          <TouchableOpacity style={styles.cartBtn} onPress={handleAddToCart} activeOpacity={0.88}>
            <Text style={styles.cartBtnText}>
              {cartItem ? 'Update Cart' : 'View Cart'}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },

  // Dim overlay behind the sheet
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },

  // Sheet container — marginTop leaves the dim area, flex:1 fills to device bottom (no gap)
  sheet: {
    marginTop: SCREEN_H * 0.12,
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },

  // Hero
  hero: {
    width: '100%',
    height: IMAGE_H,
    backgroundColor: colors.surfaceMuted,
  },
  heroImg: { width: '100%', height: '100%' },
  heroPlaceholder: { backgroundColor: colors.surfaceMuted },
  closeBtn: {
    position: 'absolute',
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  closeBtnText: {
    fontSize: 14,
    color: colors.ink,
    fontFamily: fontFamily.bold,
    lineHeight: 17,
  },

  // Content
  content: { flex: 1 },
  contentInner: { paddingHorizontal: 20, paddingTop: 20 },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
  },
  categoryText: {
    fontSize: 13,
    fontFamily: fontFamily.semibold,
    color: colors.inkMuted,
  },
  price: {
    fontSize: 26,
    fontFamily: fontFamily.black,
    color: ACCENT,
    letterSpacing: -0.5,
  },

  name: {
    fontSize: 30,
    fontFamily: fontFamily.black,
    color: colors.ink,
    lineHeight: 36,
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  description: {
    fontSize: 14,
    fontFamily: fontFamily.regular,
    color: colors.inkMuted,
    lineHeight: 22,
  },

  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  stepperMinus: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperCount: {
    fontSize: 18,
    fontFamily: fontFamily.bold,
    color: colors.ink,
    minWidth: 20,
    textAlign: 'center',
  },
  stepperPlus: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBtnText: {
    fontSize: 16,
    fontFamily: fontFamily.extrabold,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});

export default ItemDetailScreen;
