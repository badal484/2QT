import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { CatPreviewCard } from './CatPreviewCard';
import { styles } from './homeStyles';

/** Wrapper for the horizontal "Highlights" strip — stable props prevent re-renders on cart change */
export const CategoryPreviewSection = React.memo(({ items, kitchenPaused, navigation, dispatch, triggerHaptic, onAddToCartWithCheck }: any) => (
  <View style={styles.catPreviewWrap}>
    <View style={styles.catPreviewHeadingRow}>
      <View style={styles.catPreviewHeadingAccent} />
      <Text allowFontScaling={false} style={styles.catPreviewHeading}>Highlights</Text>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catPreviewScroll}>
      {items.map((mi: any) => (
        <CatPreviewCard
          key={mi.id}
          mi={mi}
          kitchenPaused={kitchenPaused}
          navigation={navigation}
          dispatch={dispatch}
          triggerHaptic={triggerHaptic}
          onAddToCartWithCheck={onAddToCartWithCheck}
        />
      ))}
    </ScrollView>
  </View>
));
