import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSelector } from 'react-redux';
import { ChefHat } from 'lucide-react-native';
import { RootState } from '../../store';
import { setQuantity } from '../../store/slices/cartSlice';
import { NetworkImage } from '../../components/NetworkImage';
import { tokens } from '../../theme/tokens';
import { styles } from './homeStyles';

/** Single menu item grid card — re-renders only when its own cart quantity changes */
export const MenuGridCard = React.memo(({ menuItem, kitchenPaused, navigation, dispatch, triggerHaptic, onAddToCartWithCheck }: any) => {
  const cartQty = useSelector((state: RootState) => {
    const ci = state.cart.items.find(i => i.menuItemId === menuItem.id);
    return ci?.quantity ?? 0;
  });
  const vegColor = menuItem.is_egg ? tokens.colors.warning : (menuItem.is_veg ? tokens.colors.success : tokens.colors.danger);
  const unavailable = !menuItem.available || kitchenPaused;
  return (
    <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.homeGridCard} activeOpacity={0.92}
      onPress={() => { if (menuItem.available) navigation.navigate('ItemDetail', { item: menuItem }); }}>
      <View style={styles.homeGridImageContainer}>
        {menuItem.photo_url
          ? <NetworkImage uri={menuItem.photo_url} style={styles.homeGridImage} />
          : <View style={[styles.homeGridImage, styles.homeGridImagePlaceholder]}><ChefHat size={28} color={tokens.colors.textTertiary} /></View>}
        <View style={[styles.homeGridVegBadge, { borderColor: vegColor }]}>
          <View style={[styles.homeGridVegDot, { backgroundColor: vegColor }]} />
        </View>
        {menuItem.is_bestseller && <View style={styles.homeGridBestsellerBadge}><Text allowFontScaling={false} style={styles.homeGridBestsellerText}>★ Bestseller</Text></View>}
        {!menuItem.is_bestseller && menuItem.is_new && <View style={styles.homeGridNewBadge}><Text allowFontScaling={false} style={styles.homeGridNewText}>+ New</Text></View>}
        {unavailable && <View style={styles.homeGridSoldOut}><Text allowFontScaling={false} style={styles.homeGridSoldOutText}>Sold Out</Text></View>}
        {!unavailable && (
          <View style={styles.homeGridAddFloat}>
            {cartQty > 0 ? (
              <View style={styles.homeGridQtyControl}>
                <TouchableOpacity onPress={() => { triggerHaptic(); dispatch(setQuantity({ menuItemId: menuItem.id, quantity: cartQty - 1 })); }} style={styles.homeGridQtyBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }} activeOpacity={0.7}>
                  <Text allowFontScaling={false} style={styles.homeGridQtyBtnText}>−</Text>
                </TouchableOpacity>
                <Text allowFontScaling={false} style={styles.homeGridQtyValue}>{cartQty}</Text>
                <TouchableOpacity onPress={() => { triggerHaptic(); dispatch(setQuantity({ menuItemId: menuItem.id, quantity: cartQty + 1 })); }} style={styles.homeGridQtyBtn} hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }} activeOpacity={0.7}>
                  <Text allowFontScaling={false} style={styles.homeGridQtyBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.homeGridAddBtn} onPress={() => onAddToCartWithCheck(menuItem)} activeOpacity={0.8}>
                <Text allowFontScaling={false} style={styles.homeGridAddBtnText}>ADD</Text>
                {Array.isArray(menuItem.customization_groups) && menuItem.customization_groups.length > 0 && (
                  <View style={styles.homeGridCustomiseBadge}><Text allowFontScaling={false} style={styles.homeGridCustomiseText}>Customise</Text></View>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
      <View style={styles.homeGridInfo}>
        <Text allowFontScaling={false} style={styles.homeGridName} numberOfLines={2}>{menuItem.name}</Text>
        {menuItem.description ? <Text allowFontScaling={false} style={styles.homeGridDesc} numberOfLines={2}>{menuItem.description}</Text> : null}
        {menuItem.applied_offer && (
          <View style={styles.itemOfferBadge}>
            <Text allowFontScaling={false} style={styles.itemOfferBadgeText}>
              {menuItem.applied_offer.discount_type === 'bogo'
                ? '🎁 BUY 1 GET 1 FREE'
                : menuItem.applied_offer.discount_type === 'flat'
                ? `₹${(menuItem.applied_offer.discount_flat_paise || 0) / 100} OFF`
                : `${Math.round(parseFloat(menuItem.applied_offer.discount_percent || '0'))}% OFF`}
            </Text>
          </View>
        )}
        <View style={styles.homeGridPriceRow}>
          <Text allowFontScaling={false} style={styles.homeGridPrice}>₹{menuItem.price_paise / 100}</Text>
          {menuItem.original_price_paise > menuItem.price_paise && (
            <Text allowFontScaling={false} style={styles.homeGridStrikePrice}>₹{menuItem.original_price_paise / 100}</Text>
          )}
        </View>
        {menuItem.tags?.length > 0 && (
          <View style={styles.homeGridTagRow}>
            {menuItem.tags.slice(0, 2).map((tag: string) => (
              <View key={tag} style={styles.homeGridTagChip}><Text allowFontScaling={false} style={styles.homeGridTagText}>{tag}</Text></View>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});
