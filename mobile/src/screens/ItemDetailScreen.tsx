import { ArrowLeft, ChefHat, Flame, ShoppingBag } from 'lucide-react-native';
import React, { useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, Dimensions, StatusBar, StyleSheet } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { addItem } from '../store/slices/cartSlice';

const { width } = Dimensions.get('window');

const ItemDetailScreen = ({ route, navigation }: any) => {
  const { item } = route.params;
  const dispatch = useDispatch();
  const cartItem = useSelector((state: RootState) => 
    state.cart.items.find(ci => ci.menuItemId === item.id)
  );
  const [quantity, setLocalQuantity] = useState(cartItem?.quantity || 1);

  const handleAddToCart = () => {
    dispatch(addItem({ 
      menuItemId: item.id, 
      name: item.name, 
      pricePaise: item.price_paise, 
      quantity: quantity,
      photoUrl: item.photo_url,
      isVeg: item.is_veg,
      kitchenId: item.kitchen_id
    }));
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Hero Photo Section */}
        <View style={styles.heroSection}>
          {item.photo_url ? (
            <Image source={{ uri: item.photo_url }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <View style={styles.heroPlaceholder}>
              <ChefHat size={32} color="#FF6B35" />
            </View>
          )}
          
          <View style={styles.heroOverlay} />

          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <ArrowLeft size={24} color="#1A1A2E" />
          </TouchableOpacity>

          <View style={styles.heroContent}>
            <View style={[styles.vegBadge, { borderColor: item.is_veg ? '#22C55E' : '#EF4444', backgroundColor: item.is_veg ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)' }]}>
              <Text style={[styles.vegBadgeText, { color: item.is_veg ? '#166534' : '#991B1B' }]}>
                {item.is_veg ? 'Pure Veg' : 'Non-Veg'}
              </Text>
            </View>
            <Text style={styles.heroTitle}>{item.name}</Text>
          </View>
        </View>

        <View style={styles.mainContent}>
          {/* Meta Info */}
          <View style={styles.metaInfoRow}>
            <View>
              <Text style={styles.metaLabel}>Category</Text>
              <Text style={styles.metaValue}>{item.category}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.metaLabel}>Spice Level</Text>
              <View style={styles.spiceRow}>
                {[...Array(item.spice_level || 1)].map((_, i) => (
                  <Flame key={i} size={16} color="#FF6B35" style={{ marginRight: 4 }} />
                ))}
              </View>
            </View>
          </View>

          {/* Description */}
          <Text style={styles.sectionLabel}>Description</Text>
          <Text style={styles.descriptionText}>
            {item.description || 'Our signature chef-prepared dish, made with the finest local ingredients and authentic spices for a truly gourmet experience.'}
          </Text>

          {/* Quantity Selector */}
          <View style={styles.quantityCard}>
            <View>
              <Text style={styles.quantityTitle}>Select Quantity</Text>
              <Text style={styles.quantitySub}>Choose your portion</Text>
            </View>
            <View style={styles.quantityControl}>
              <TouchableOpacity 
                style={styles.qtyBtnMinus}
                onPress={() => setLocalQuantity(Math.max(1, quantity - 1))}
              >
                <Text style={styles.qtyBtnTextMinus}>−</Text>
              </TouchableOpacity>
              <Text style={styles.qtyValueText}>{quantity}</Text>
              <TouchableOpacity 
                style={styles.qtyBtnPlus}
                onPress={() => setLocalQuantity(quantity + 1)}
              >
                <Text style={styles.qtyBtnTextPlus}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Dietary Info */}
          <View style={styles.dietarySection}>
            <Text style={styles.sectionLabel}>Dietary Info</Text>
            <View style={styles.tagRow}>
              {['No MSG', 'Fresh Prep', 'Low Sodium'].map(tag => (
                <View key={tag} style={styles.tagBadge}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Floating Add Button */}
      <View style={styles.footer}>
        <TouchableOpacity 
          activeOpacity={0.9}
          style={styles.addToCartBtn}
          onPress={handleAddToCart}
        >
          <View>
            <Text style={styles.btnPriceLabel}>Total Price</Text>
            <Text style={styles.btnPriceValue}>₹{(quantity * item.price_paise) / 100}</Text>
          </View>
          <View style={styles.btnActionRow}>
            <Text style={styles.btnActionText}>Add to Cart</Text>
            <View style={styles.btnIconWrapper}>
              <ShoppingBag size={20} color="white" />
            </View>
          </View>
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
  heroSection: {
    height: 450,
    backgroundColor: '#f9fafb',
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
  heroOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  backButton: {
    position: 'absolute',
    top: 64,
    left: 24,
    width: 48,
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  heroContent: {
    position: 'absolute',
    bottom: 40,
    left: 32,
    right: 32,
  },
  vegBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 2,
    marginBottom: 12,
  },
  vegBadgeText: {
    fontWeight: '900',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
    letterSpacing: -1,
  },
  mainContent: {
    paddingHorizontal: 32,
    paddingTop: 40,
    paddingBottom: 160,
  },
  metaInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
    paddingBottom: 32,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  metaLabel: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 4,
  },
  metaValue: {
    color: '#1A1A2E',
    fontSize: 18,
    fontWeight: '900',
  },
  spiceRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  sectionLabel: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 16,
  },
  descriptionText: {
    color: '#1A1A2E',
    fontSize: 17,
    lineHeight: 28,
    fontWeight: '500',
    marginBottom: 40,
  },
  quantityCard: {
    backgroundColor: '#f9fafb',
    padding: 32,
    borderRadius: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quantityTitle: {
    color: '#1A1A2E',
    fontSize: 20,
    fontWeight: '900',
  },
  quantitySub: {
    color: '#9ca3af',
    fontWeight: '700',
    fontSize: 12,
    marginTop: 4,
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  qtyBtnMinus: {
    width: 48,
    height: 48,
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnTextMinus: {
    color: '#1A1A2E',
    fontSize: 20,
    fontWeight: '900',
  },
  qtyValueText: {
    color: '#1A1A2E',
    fontSize: 24,
    fontWeight: '900',
    marginHorizontal: 24,
  },
  qtyBtnPlus: {
    width: 48,
    height: 48,
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnTextPlus: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
  },
  dietarySection: {
    marginTop: 40,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tagBadge: {
    backgroundColor: 'rgba(255, 107, 53, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 12,
    marginBottom: 12,
  },
  tagText: {
    color: '#FF6B35',
    fontWeight: '900',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 32,
    right: 32,
  },
  addToCartBtn: {
    height: 80,
    backgroundColor: '#FF6B35',
    borderRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 10,
  },
  btnPriceLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  btnPriceValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
  },
  btnActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  btnActionText: {
    color: '#fff',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 11,
    marginRight: 12,
  },
  btnIconWrapper: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ItemDetailScreen;
