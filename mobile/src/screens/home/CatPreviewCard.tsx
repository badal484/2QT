import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSelector } from 'react-redux';
import { ChefHat } from 'lucide-react-native';
import { RootState } from '../../store';
import { setQuantity } from '../../store/slices/cartSlice';
import { NetworkImage } from '../../components/NetworkImage';
import { tokens } from '../../theme/tokens';
import { styles } from './homeStyles';

/** One card in the "Highlights" horizontal strip — re-renders only when its cart qty changes */
export const CatPreviewCard = React.memo(({ mi, kitchenPaused, navigation, dispatch, triggerHaptic, onAddToCartWithCheck }: any) => {
  const cartQty = useSelector((state: RootState) => {
    const ci = state.cart.items.find(i => i.menuItemId === mi.id);
    return ci?.quantity ?? 0;
  });
  const vegColor = mi.is_egg ? tokens.colors.warning : (mi.is_veg ? tokens.colors.success : tokens.colors.danger);
  const unavailable = !mi.available || kitchenPaused;
  const handleOpenDetail = () => {
    navigation.navigate('ItemDetail', { item: mi });
  };

  return (
    <View style={styles.catPreviewCard}>
      <View style={styles.catPreviewImgBox}>
        <TouchableOpacity
          style={{ width: '100%', height: '100%' }}
          activeOpacity={0.92}
          onPress={handleOpenDetail}
          accessibilityRole="button"
          accessibilityLabel={`View ${mi.name}`}
        >
          {mi.photo_url
            ? <NetworkImage uri={mi.photo_url} style={styles.catPreviewImg} />
            : <View style={[styles.catPreviewImg, styles.catPreviewImgPlaceholder]}><ChefHat size={30} color={tokens.colors.textTertiary} /></View>}
          <View style={styles.catPreviewCatPill}>
            <Text allowFontScaling={false} style={styles.catPreviewCatText} numberOfLines={1}>{mi.category}</Text>
          </View>
          {mi.is_bestseller && (
            <View style={styles.catPreviewBestBadge}><Text allowFontScaling={false} style={styles.catPreviewBestText}>★ Bestseller</Text></View>
          )}
          {unavailable && (
            <View style={styles.catPreviewSoldOut}><Text allowFontScaling={false} style={styles.catPreviewSoldOutText}>Sold Out</Text></View>
          )}
        </TouchableOpacity>

        {!unavailable && (
          <View style={styles.catPreviewAddFloat}>
            {cartQty > 0 ? (
              <View style={styles.catPreviewQty}>
                <TouchableOpacity
                  onPress={() => { triggerHaptic(); dispatch(setQuantity({ menuItemId: mi.id, quantity: cartQty - 1 })); }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 6 }}
                  activeOpacity={0.6}
                  accessibilityRole="button"
                  accessibilityLabel="Decrease quantity"
                >
                  <Text allowFontScaling={false} style={styles.catPreviewQtyBtn}>−</Text>
                </TouchableOpacity>
                <Text allowFontScaling={false} style={styles.catPreviewQtyVal}>{cartQty}</Text>
                <TouchableOpacity
                  onPress={() => { triggerHaptic(); dispatch(setQuantity({ menuItemId: mi.id, quantity: cartQty + 1 })); }}
                  hitSlop={{ top: 10, bottom: 10, left: 6, right: 10 }}
                  activeOpacity={0.6}
                  accessibilityRole="button"
                  accessibilityLabel="Increase quantity"
                >
                  <Text allowFontScaling={false} style={styles.catPreviewQtyBtn}>+</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.catPreviewAddBtn}
                onPress={() => onAddToCartWithCheck(mi)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Add ${mi.name} to cart`}
              >
                <Text allowFontScaling={false} style={styles.catPreviewAddText}>ADD</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
      <TouchableOpacity
        style={styles.catPreviewInfo}
        activeOpacity={0.92}
        onPress={handleOpenDetail}
        accessibilityRole="button"
        accessibilityLabel={`View ${mi.name}`}
      >
        <View style={styles.catPreviewNameRow}>
          <View style={[styles.catPreviewVegBadge, { borderColor: vegColor }]}>
            <View style={[styles.catPreviewVegDot, { backgroundColor: vegColor }]} />
          </View>
          <Text allowFontScaling={false} style={styles.catPreviewName} numberOfLines={2}>{mi.name}</Text>
        </View>
        {mi.applied_offer && (
          <View style={styles.itemOfferTag}>
            <Text allowFontScaling={false} style={styles.itemOfferTagText}>
              {mi.applied_offer.discount_type === 'bogo'
                ? '🎁 BUY 1 GET 1 FREE'
                : mi.applied_offer.discount_type === 'flat'
                ? `₹${(mi.applied_offer.discount_flat_paise || 0) / 100} OFF`
                : `${Math.round(parseFloat(mi.applied_offer.discount_percent || '0'))}% OFF`}
            </Text>
          </View>
        )}
        <View style={styles.catPreviewPriceRow}>
          <Text allowFontScaling={false} style={styles.catPreviewPrice}>₹{mi.price_paise / 100}</Text>
          {mi.original_price_paise > mi.price_paise && (
            <Text allowFontScaling={false} style={styles.catPreviewStrikePrice}>₹{mi.original_price_paise / 100}</Text>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
});
