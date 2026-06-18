import { ArrowLeft, ChefHat, Flame, ShoppingBag, Plus, Minus, Info } from 'lucide-react-native';
import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, Dimensions, StatusBar, StyleSheet, Alert, Pressable, ScrollView } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { addItem } from '../store/slices/cartSlice';
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, interpolate, Extrapolation, withSpring, withTiming } from 'react-native-reanimated';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const { width, height } = Dimensions.get('window');

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const triggerHaptic = (type = 'impactLight') => {
  ReactNativeHapticFeedback.trigger(type as any, { enableVibrateFallback: true });
};

const BouncingButton = ({ onPress, style, children, activeOpacity = 0.9, haptic = 'impactLight', disabled = false }: any) => {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={() => {
        if (!disabled) {
          scale.value = withSpring(0.92, { damping: 10, stiffness: 400 });
          triggerHaptic(haptic);
        }
      }}
      onPressOut={() => {
        if (!disabled) {
          scale.value = withSpring(1, { damping: 10, stiffness: 400 });
        }
      }}
      onPress={onPress}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
};

const ItemDetailScreen = ({ route, navigation }: any) => {
  const { item } = route.params;
  const dispatch = useDispatch();
  const cartItem = useSelector((state: RootState) => 
    state.cart.items.find(ci => ci.menuItemId === item.id)
  );
  const [quantity, setLocalQuantity] = useState(cartItem?.quantity || 1);
  const cartItems = useSelector((state: RootState) => state.cart.items);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const heroAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(scrollY.value, [-100, 0, 450], [-50, 0, 450 * 0.4], Extrapolation.CLAMP)
        },
        {
          scale: interpolate(scrollY.value, [-100, 0], [1.5, 1], Extrapolation.CLAMP)
        }
      ]
    };
  });

  const handleAddToCart = () => {
    triggerHaptic('notificationSuccess');
    if (cartItems.length > 0 && cartItems[0].kitchenId !== item.kitchen_id) {
      Alert.alert(
        'Clear Cart?',
        'Your cart contains items from a different kitchen. Would you like to clear your cart and add this item instead?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Clear & Add', 
            style: 'destructive',
            onPress: () => {
              dispatch(addItem({ 
                menuItemId: item.id, name: item.name, pricePaise: item.price_paise, 
                quantity: quantity, photoUrl: item.photo_url, isVeg: item.is_veg, kitchenId: item.kitchen_id
              }));
              navigation.goBack();
            }
          }
        ]
      );
    } else {
      dispatch(addItem({ 
        menuItemId: item.id, name: item.name, pricePaise: item.price_paise, 
        quantity: quantity, photoUrl: item.photo_url, isVeg: item.is_veg, kitchenId: item.kitchen_id
      }));
      navigation.goBack();
    }
  };

  const itemPrice = (item.price_paise / 100).toFixed(2);
  const totalPrice = ((quantity * item.price_paise) / 100).toFixed(2);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <Animated.ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {/* Ultra Premium Hero Section */}
        <Animated.View style={[styles.heroSection, heroAnimatedStyle]}>
          {item.photo_url ? (
            <Image source={{ uri: item.photo_url }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <View style={styles.heroPlaceholder}>
              <ChefHat size={48} color="#FF6B35" opacity={0.5} />
            </View>
          )}
          {/* Subtle dark gradient overlay at top for back button visibility */}
          <View style={styles.heroTopOverlay} />
        </Animated.View>

        {/* Floating Frosted Back Button */}
        <BouncingButton 
          style={styles.backButton}
          onPress={() => {
            triggerHaptic('impactLight');
            navigation.goBack();
          }}
        >
          <ArrowLeft size={24} color="#1A1A2E" />
        </BouncingButton>

        {/* Main Content Overlapping the Image */}
        <View style={styles.mainContent}>
          <View style={styles.dragHandle} />
          
          <View style={styles.titleHeaderRow}>
            <View style={{ flex: 1, paddingRight: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <View style={[styles.vegBadge, { borderColor: item.is_veg ? '#22C55E' : '#EF4444' }]}>
                  <View style={[styles.vegBadgeDot, { backgroundColor: item.is_veg ? '#22C55E' : '#EF4444' }]} />
                </View>
                <Text style={styles.categoryPill}>{item.category || 'Specialty'}</Text>
              </View>
              <Text style={styles.heroTitle}>{item.name}</Text>
            </View>
            <View style={styles.priceContainer}>
              <Text style={styles.priceSymbol}>₹</Text>
              <Text style={styles.priceText}>{itemPrice}</Text>
            </View>
          </View>

          {/* Elegant Meta Info */}
          <View style={styles.metaCard}>
            <View style={styles.metaItem}>
              <Flame size={20} color="#FF6B35" style={{ marginBottom: 4 }} />
              <Text style={styles.metaLabel}>Spice Level</Text>
              <View style={styles.spiceRow}>
                {[...Array(Math.max(1, item.spice_level || 1))].map((_, i) => (
                  <View key={i} style={styles.spiceDot} />
                ))}
              </View>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaItem}>
              <ChefHat size={20} color="#10B981" style={{ marginBottom: 4 }} />
              <Text style={styles.metaLabel}>Preparation</Text>
              <Text style={styles.metaValueText}>Fresh</Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaItem}>
              <Info size={20} color="#3B82F6" style={{ marginBottom: 4 }} />
              <Text style={styles.metaLabel}>Dietary</Text>
              <Text style={styles.metaValueText}>{item.is_veg ? 'Pure Veg' : 'Non-Veg'}</Text>
            </View>
          </View>

          {/* Description */}
          {item.description && (
            <View style={styles.descriptionSection}>
              <Text style={styles.sectionTitle}>About this dish</Text>
              <Text style={styles.descriptionText}>
                {item.description}
              </Text>
            </View>
          )}

          {/* Premium Quantity Selector */}
          <View style={styles.quantitySection}>
            <View>
              <Text style={styles.sectionTitle}>Portion Size</Text>
              <Text style={styles.quantitySub}>How many would you like?</Text>
            </View>
            
            <View style={styles.quantityPill}>
              <BouncingButton 
                style={[styles.qtyBtn, quantity <= 1 && styles.qtyBtnDisabled]}
                disabled={quantity <= 1}
                haptic="impactLight"
                onPress={() => setLocalQuantity(Math.max(1, quantity - 1))}
              >
                <Minus size={20} color={quantity <= 1 ? '#D1D5DB' : '#1A1A2E'} />
              </BouncingButton>
              
              <Text style={styles.qtyValueText}>{quantity}</Text>
              
              <BouncingButton 
                style={styles.qtyBtn}
                haptic="impactMedium"
                onPress={() => setLocalQuantity(quantity + 1)}
              >
                <Plus size={20} color="#1A1A2E" />
              </BouncingButton>
            </View>
          </View>

          <View style={styles.bottomPadding} />
        </View>
      </Animated.ScrollView>

      {/* Floating Add Button Premium */}
      <View style={styles.footerBlurContainer}>
        <View style={styles.footer}>
          <BouncingButton 
            activeOpacity={0.9}
            style={styles.addToCartBtn}
            onPress={handleAddToCart}
            haptic="impactHeavy"
          >
            <View style={styles.cartBtnContent}>
              <View>
                <Text style={styles.btnItemCount}>{quantity} ITEM{quantity > 1 ? 'S' : ''}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                  <Text style={styles.btnPriceSymbol}>₹</Text>
                  <Text style={styles.btnPriceValue}>{totalPrice}</Text>
                </View>
              </View>
              
              <View style={styles.btnActionRow}>
                <Text style={styles.btnActionText}>Add to Cart</Text>
                <View style={styles.btnIconCircle}>
                  <ShoppingBag size={18} color="#FF6B35" />
                </View>
              </View>
            </View>
          </BouncingButton>
        </View>
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
  heroSection: {
    height: 480,
    backgroundColor: '#F3F4F6',
    position: 'relative',
    zIndex: -1,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 107, 53, 0.05)',
  },
  heroTopOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: 'rgba(0,0,0,0.2)', // Helps back button contrast
  },
  backButton: {
    position: 'absolute',
    top: 56,
    left: 20,
    width: 48,
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 10,
  },
  mainContent: {
    marginTop: -40, // Overlap the hero image
    paddingTop: 16,
    paddingHorizontal: 24,
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    minHeight: height * 0.6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 10,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 24,
  },
  titleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  vegBadge: {
    width: 16,
    height: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderRadius: 4,
  },
  vegBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryPill: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  heroTitle: {
    color: '#1A1A2E',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1.5,
    lineHeight: 42,
  },
  priceContainer: {
    alignItems: 'flex-end',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  priceSymbol: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: -4,
  },
  priceText: {
    color: '#10B981',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
  },
  metaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  metaItem: {
    flex: 1,
    alignItems: 'center',
  },
  metaDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E5E7EB',
  },
  metaLabel: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  metaValueText: {
    color: '#1A1A2E',
    fontSize: 13,
    fontWeight: '800',
  },
  spiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spiceDot: {
    width: 6,
    height: 6,
    backgroundColor: '#FF6B35',
    borderRadius: 3,
    marginHorizontal: 2,
  },
  descriptionSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    color: '#1A1A2E',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  descriptionText: {
    color: '#6B7280',
    fontSize: 15,
    lineHeight: 24,
    fontWeight: '500',
  },
  quantitySection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  quantitySub: {
    color: '#9CA3AF',
    fontWeight: '600',
    fontSize: 13,
    marginTop: 2,
  },
  quantityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 100,
    padding: 6,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  qtyBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#fff',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  qtyBtnDisabled: {
    backgroundColor: '#F3F4F6',
    shadowOpacity: 0,
    elevation: 0,
  },
  qtyValueText: {
    color: '#1A1A2E',
    fontSize: 20,
    fontWeight: '900',
    minWidth: 40,
    textAlign: 'center',
  },
  bottomPadding: {
    height: 120, // Space for the floating bottom cart
  },
  footerBlurContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 32,
    paddingTop: 16,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  footer: {
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10,
  },
  addToCartBtn: {
    height: 72,
    backgroundColor: '#FF6B35',
    borderRadius: 36,
    justifyContent: 'center',
  },
  cartBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
  },
  btnItemCount: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  btnPriceSymbol: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginRight: 2,
    marginBottom: 2,
  },
  btnPriceValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  btnActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 10,
    paddingLeft: 20,
    paddingRight: 10,
    borderRadius: 100,
  },
  btnActionText: {
    color: '#fff',
    fontWeight: '900',
    letterSpacing: 1,
    fontSize: 13,
    marginRight: 12,
  },
  btnIconCircle: {
    width: 32,
    height: 32,
    backgroundColor: '#fff',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ItemDetailScreen;
