import React, { useState } from 'react';
import {
  View, Text, ScrollView, Image, TouchableOpacity, StyleSheet,
  Dimensions, StatusBar, ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronLeft, MapPin, Clock, Star, UtensilsCrossed, Users } from 'lucide-react-native';
import { api } from '../api/client';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import { spacing, radius } from '../theme/spacing';
import { BouncingButton } from '../components/ui/BouncingButton';
import { NetworkImage } from '../components/NetworkImage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const RestaurantDetailScreen = ({ navigation, route }: any) => {
  const { restaurantId } = route.params;
  const insets = useSafeAreaInsets();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const { data: restaurant, isLoading: restLoading } = useQuery({
    queryKey: ['restaurant', restaurantId],
    queryFn: () => api.get(`/restaurants/${restaurantId}`).then((r: any) => r.restaurant),
  });

  const { data: menuData, isLoading: menuLoading } = useQuery({
    queryKey: ['restaurant-menu', restaurantId],
    queryFn: () => api.get(`/restaurants/${restaurantId}/menu`).then((r: any) => r.menu as Record<string, any[]>),
  });

  if (restLoading) {
    return (
      <View style={[styles.loadingWrap, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const categories: string[] = menuData ? ['All', ...Object.keys(menuData)] : ['All'];
  const filteredItems: any[] = menuData
    ? selectedCategory === 'All'
      ? Object.values(menuData).flat()
      : menuData[selectedCategory] || []
    : [];

  const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const todayHours = restaurant?.operating_hours?.[DAY_KEYS[new Date().getDay()]];
  const opensAt = todayHours && !todayHours.closed ? todayHours.open : null;
  const closesAt = todayHours && !todayHours.closed ? todayHours.close : null;

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" />

      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        {/* Hero image */}
        <View style={styles.heroWrap}>
          {restaurant?.image_url ? (
            <NetworkImage uri={restaurant.image_url} style={styles.heroImage} />
          ) : (
            <View style={[styles.heroImage, styles.heroPlaceholder]}>
              <UtensilsCrossed size={48} color="#ffffff44" />
            </View>
          )}
          <View style={styles.heroOverlay} />
          <TouchableOpacity
            style={[styles.backBtn, { top: insets.top + 8 }]}
            onPress={() => navigation.goBack()}
          >
            <ChevronLeft size={24} color="#fff" strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Restaurant info */}
        <Animated.View entering={FadeInDown.duration(350)} style={styles.infoCard}>
          <Text style={styles.restName}>{restaurant?.name}</Text>
          {restaurant?.cuisine_type && (
            <Text style={styles.cuisine}>{restaurant.cuisine_type}</Text>
          )}

          <View style={styles.metaRow}>
            {restaurant?.avg_rating > 0 && (
              <View style={styles.metaBadge}>
                <Star size={13} color="#F59E0B" fill="#F59E0B" />
                <Text style={styles.metaText}>{Number(restaurant.avg_rating).toFixed(1)}</Text>
              </View>
            )}
            {opensAt && (
              <View style={styles.metaBadge}>
                <Clock size={13} color={colors.inkMuted} />
                <Text style={styles.metaText}>{opensAt} – {closesAt}</Text>
              </View>
            )}
            {restaurant?.address && (
              <View style={styles.metaBadge}>
                <MapPin size={13} color={colors.inkMuted} />
                <Text style={[styles.metaText, { flexShrink: 1 }]} numberOfLines={1}>{restaurant.address}</Text>
              </View>
            )}
          </View>

          {restaurant?.description && (
            <Text style={styles.description}>{restaurant.description}</Text>
          )}

          {/* Book a Table CTA */}
          <BouncingButton
            style={styles.bookBtn}
            onPress={() => navigation.navigate('TableBooking', { restaurantId, restaurantName: restaurant?.name })}
          >
            <UtensilsCrossed size={18} color="#fff" strokeWidth={2} />
            <Text style={styles.bookBtnText}>Book a Table</Text>
          </BouncingButton>
        </Animated.View>

        {/* Menu section */}
        {menuLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
        ) : filteredItems.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(100).duration(350)}>
            <Text style={styles.menuHeading}>Menu</Text>

            {/* Category pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryScroll}
            >
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryPill, selectedCategory === cat && styles.categoryPillActive]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <Text style={[styles.categoryPillText, selectedCategory === cat && styles.categoryPillTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {filteredItems.map((item: any) => (
              <View key={item.id} style={styles.menuItemRow}>
                <View style={styles.menuItemInfo}>
                  <View style={styles.vegDot}>
                    <View style={[styles.vegDotInner, { backgroundColor: item.is_veg ? '#10B981' : '#EF4444' }]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.menuItemName}>{item.name}</Text>
                    {item.description && (
                      <Text style={styles.menuItemDesc} numberOfLines={2}>{item.description}</Text>
                    )}
                    <Text style={styles.menuItemPrice}>₹{(item.price_paise / 100).toFixed(0)}</Text>
                  </View>
                </View>
                {item.image_url && (
                  <NetworkImage uri={item.image_url} style={styles.menuItemImage} />
                )}
              </View>
            ))}

            <View style={{ height: 32 }} />
          </Animated.View>
        ) : null}
      </ScrollView>

      {/* Sticky bottom CTA */}
      <View style={[styles.stickyBottom, { paddingBottom: insets.bottom + 12 }]}>
        <BouncingButton
          style={styles.bookBtnLarge}
          onPress={() => navigation.navigate('TableBooking', { restaurantId, restaurantName: restaurant?.name })}
        >
          <Users size={20} color="#fff" strokeWidth={2} />
          <Text style={styles.bookBtnLargeText}>Reserve a Table</Text>
        </BouncingButton>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  heroWrap: { width: SCREEN_WIDTH, height: 240, position: 'relative' },
  heroImage: { width: '100%', height: '100%' },
  heroPlaceholder: { backgroundColor: '#2D3748', justifyContent: 'center', alignItems: 'center' },
  heroOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.3)' },
  backBtn: {
    position: 'absolute', left: 16, width: 40, height: 40,
    borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },
  infoCard: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    marginTop: -20, padding: spacing.lg, paddingTop: 20,
  },
  restName: { fontSize: 22, fontFamily: fontFamily.bold, color: colors.ink, marginBottom: 2 },
  cuisine: { fontSize: 13, color: colors.inkMuted, fontFamily: fontFamily.regular, marginBottom: 10 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  metaBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  metaText: { fontSize: 12, color: colors.inkMuted, fontFamily: fontFamily.regular },
  description: { fontSize: 13, color: colors.inkMuted, fontFamily: fontFamily.regular, lineHeight: 18, marginBottom: 16 },
  bookBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14,
  },
  bookBtnText: { color: '#fff', fontSize: 15, fontFamily: fontFamily.semibold },
  menuHeading: { fontSize: 18, fontFamily: fontFamily.bold, color: colors.ink, marginHorizontal: spacing.lg, marginTop: 8, marginBottom: 4 },
  categoryScroll: { paddingHorizontal: spacing.lg, paddingVertical: 10, gap: 8 },
  categoryPill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: 'transparent',
  },
  categoryPillActive: { backgroundColor: colors.primary + '15', borderColor: colors.primary },
  categoryPillText: { fontSize: 13, color: colors.inkMuted, fontFamily: fontFamily.medium },
  categoryPillTextActive: { color: colors.primary, fontFamily: fontFamily.semibold },
  menuItemRow: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    marginHorizontal: spacing.lg, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB',
  },
  menuItemInfo: { flexDirection: 'row', flex: 1, gap: 10, marginRight: 12 },
  vegDot: { width: 16, height: 16, borderRadius: 3, borderWidth: 1.5, borderColor: '#9CA3AF', justifyContent: 'center', alignItems: 'center', marginTop: 2, flexShrink: 0 },
  vegDotInner: { width: 8, height: 8, borderRadius: 4 },
  menuItemName: { fontSize: 14, fontFamily: fontFamily.semibold, color: colors.ink, marginBottom: 2 },
  menuItemDesc: { fontSize: 12, color: colors.inkMuted, fontFamily: fontFamily.regular, lineHeight: 16, marginBottom: 4 },
  menuItemPrice: { fontSize: 14, fontFamily: fontFamily.bold, color: colors.ink },
  menuItemImage: { width: 72, height: 72, borderRadius: 10 },
  stickyBottom: {
    paddingHorizontal: spacing.lg, paddingTop: 12, backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E7EB',
  },
  bookBtnLarge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 16,
  },
  bookBtnLargeText: { color: '#fff', fontSize: 16, fontFamily: fontFamily.semibold },
});

export default RestaurantDetailScreen;
