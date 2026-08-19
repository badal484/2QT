import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Clock, Sparkles, Flame, Gift, ArrowRight, CheckCircle2 } from 'lucide-react-native';
import { tokens } from '../../theme/tokens';
import { BouncingButton } from '../../components/ui/BouncingButton';

interface CampaignBannerCardProps {
  campaign: any;
  onPress?: () => void;
}

export const CampaignBannerCard: React.FC<CampaignBannerCardProps> = ({ campaign, onPress }) => {
  if (!campaign) return null;

  // Countdown timer for Flash Sales
  const [timeLeft, setTimeLeft] = useState<{ hours: string; minutes: string; seconds: string } | null>(null);

  useEffect(() => {
    if (campaign.type !== 'flash_sale' || !campaign.flash_end) {
      setTimeLeft(null);
      return;
    }

    const calculateTime = () => {
      const diff = new Date(campaign.flash_end).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft(null);
        return;
      }
      const hrs = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft({
        hours: String(hrs).padStart(2, '0'),
        minutes: String(mins).padStart(2, '0'),
        seconds: String(secs).padStart(2, '0'),
      });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [campaign.type, campaign.flash_end]);

  const getTheme = () => {
    switch (campaign.type) {
      case 'flash_sale':
        return {
          gradient: ['#FF5A0A', '#F04A0D', '#B8320C', '#8E2005'],
          badgeBg: 'rgba(0, 0, 0, 0.25)',
          badgeBorder: '#FFB000',
          badgeText: '#FFB000',
          badgeLabel: 'FLASH SALE',
          icon: Flame,
          accent: '#FFB000',
          foodImage: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=1000&auto=format&fit=crop&q=80',
        };
      case 'happy_hour':
        return {
          gradient: ['#6D28D9', '#5B21B6', '#4C1D95', '#3B0764'],
          badgeBg: 'rgba(0, 0, 0, 0.25)',
          badgeBorder: '#A855F7',
          badgeText: '#FFFFFF',
          badgeLabel: 'HAPPY HOUR',
          icon: Clock,
          accent: '#A855F7',
          foodImage: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1000&auto=format&fit=crop&q=80',
        };
      case 'welcome':
      case 'winback':
        return {
          gradient: ['#059669', '#047857', '#064E3B', '#022C22'],
          badgeBg: 'rgba(0, 0, 0, 0.25)',
          badgeBorder: '#10B981',
          badgeText: '#FFFFFF',
          badgeLabel: 'SPECIAL OFFER',
          icon: Gift,
          accent: '#10B981',
          foodImage: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1000&auto=format&fit=crop&q=80',
        };
      default:
        return {
          gradient: ['#EA580C', '#C2410C', '#9A3412', '#7C2D12'],
          badgeBg: 'rgba(0, 0, 0, 0.25)',
          badgeBorder: '#F59E0B',
          badgeText: '#FFFFFF',
          badgeLabel: 'LIMITED DEAL',
          icon: Sparkles,
          accent: '#F59E0B',
          foodImage: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=1000&auto=format&fit=crop&q=80',
        };
    }
  };

  const theme = getTheme();
  const Icon = theme.icon;

  const discountHeadline = () => {
    if (campaign.discount_type === 'free_delivery') return 'FREE DELIVERY';
    if (campaign.discount_type === 'flat') {
      const amt = ((campaign.discount_flat_paise || 0) / 100).toFixed(0);
      return `FLAT ₹${amt} OFF`;
    }
    const pct = parseFloat(String(campaign.discount_percent || 0));
    return `${pct}% OFF ON\nEVERYTHING`;
  };

  const minOrderRupees = campaign.min_order_paise ? Math.round(campaign.min_order_paise / 100) : 0;
  const maxDiscountRupees = campaign.max_discount_paise ? Math.round(campaign.max_discount_paise / 100) : 0;

  return (
    <BouncingButton activeOpacity={0.94} onPress={onPress} style={styles.outerContainer}>
      <LinearGradient
        colors={theme.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientCard}
      >
        {/* Subtle background gourmet food texture overlay */}
        <Image
          source={{ uri: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1000&auto=format&fit=crop&q=80' }}
          style={[StyleSheet.absoluteFillObject, { opacity: 0.18 }]}
          resizeMode="cover"
        />

        {/* Top glossy sheen */}
        <View style={styles.topSheen} pointerEvents="none" />

        {/* Ambient radial lighting glow behind food */}
        <View style={styles.foodRadialGlow} pointerEvents="none" />

        {/* Hero Food Dish Photograph (Right side 42% integrated with soft ambient glow) */}
        <View style={styles.heroFoodWrapper} pointerEvents="none">
          <Image
            source={{ uri: campaign.image_url || campaign.photo_url || theme.foodImage }}
            style={styles.heroFoodImage}
            resizeMode="cover"
          />
        </View>

        {/* Left Column Content Container */}
        <View style={styles.contentContainer}>
          {/* Top Row: Badge + Countdown Timer */}
          <View style={styles.topRow}>
            <View style={[styles.badge, theme.badgeBorder ? { borderColor: theme.badgeBorder, backgroundColor: theme.badgeBg } : null]}>
              <Icon size={12} color={theme.accent || '#FFF'} style={{ marginRight: 4 }} />
              <Text allowFontScaling={false} style={[styles.badgeText, theme.badgeText ? { color: theme.badgeText } : null]}>
                {theme.badgeLabel}
              </Text>
            </View>

            {timeLeft ? (
              <View style={styles.timerBadge}>
                <Text allowFontScaling={false} style={styles.timerLabel}>ENDS IN </Text>
                <View style={styles.timeBox}>
                  <Text allowFontScaling={false} style={styles.timeBoxText}>{timeLeft.hours}</Text>
                </View>
                <Text allowFontScaling={false} style={styles.timerColon}>:</Text>
                <View style={styles.timeBox}>
                  <Text allowFontScaling={false} style={styles.timeBoxText}>{timeLeft.minutes}</Text>
                </View>
                <Text allowFontScaling={false} style={styles.timerColon}>:</Text>
                <View style={styles.timeBox}>
                  <Text allowFontScaling={false} style={styles.timeBoxText}>{timeLeft.seconds}</Text>
                </View>
              </View>
            ) : campaign.happy_hour_start ? (
              <View style={styles.timerBadge}>
                <Clock size={11} color="#FFF" style={{ marginRight: 4 }} />
                <Text allowFontScaling={false} style={styles.timerValue}>
                  {campaign.happy_hour_start.slice(0, 5)} – {campaign.happy_hour_end?.slice(0, 5)}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Headline: 20% OFF ON EVERYTHING */}
          <Text allowFontScaling={false} style={styles.headline}>
            {discountHeadline()}
          </Text>

          {/* Subtitle */}
          <Text allowFontScaling={false} style={styles.campaignName} numberOfLines={1}>
            {campaign.name}
          </Text>

          {/* CTA & Auto-applied Row */}
          <View style={styles.bottomRow}>
            <View style={styles.shopNowPill}>
              <Text allowFontScaling={false} style={styles.shopNowText}>Order Now</Text>
              <ArrowRight size={13} color="#B8320C" />
            </View>

            <View style={styles.autoAppliedBadge}>
              <CheckCircle2 size={11} color="#FFB000" style={{ marginRight: 4 }} />
              <Text allowFontScaling={false} style={styles.autoAppliedText}>
                Auto-applied
              </Text>
            </View>
          </View>

          {/* Footer Info Row */}
          <View style={styles.footerRow}>
            <Text allowFontScaling={false} style={styles.footerText} numberOfLines={1}>
              {minOrderRupees > 0 ? `Min ₹${minOrderRupees}` : 'No Min'}
              {maxDiscountRupees > 0 ? `  |  Max discount ₹${maxDiscountRupees}` : ''}
            </Text>
          </View>
        </View>
      </LinearGradient>
    </BouncingButton>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    marginHorizontal: tokens.spacing.lg,
    marginVertical: tokens.spacing.sm,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#B8320C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 6,
  },
  gradientCard: {
    borderRadius: 22,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 165,
  },
  topSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    zIndex: 3,
  },
  foodRadialGlow: {
    position: 'absolute',
    right: -10,
    top: -10,
    bottom: -10,
    width: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(255, 176, 0, 0.25)',
    zIndex: 1,
  },
  heroFoodWrapper: {
    position: 'absolute',
    right: 8,
    top: 10,
    bottom: 10,
    width: 145,
    borderRadius: 18,
    overflow: 'hidden',
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  heroFoodImage: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    zIndex: 4,
    position: 'relative',
    maxWidth: '62%',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    width: '100%',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFB000',
  },
  badgeText: {
    color: '#FFB000',
    fontSize: 10,
    fontFamily: tokens.typography.family.black,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  timerLabel: {
    color: 'rgba(255, 232, 222, 0.85)',
    fontSize: 9,
    fontFamily: tokens.typography.family.extrabold,
    letterSpacing: 0.6,
    marginRight: 4,
  },
  timeBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    minWidth: 20,
    alignItems: 'center',
  },
  timeBoxText: {
    color: '#B8320C',
    fontSize: 11,
    fontFamily: tokens.typography.family.black,
  },
  timerColon: {
    color: '#FFF',
    fontSize: 11,
    fontFamily: tokens.typography.family.black,
    marginHorizontal: 2,
  },
  timerValue: {
    color: '#FFF',
    fontSize: 11,
    fontFamily: tokens.typography.family.extrabold,
    letterSpacing: 0.5,
  },
  headline: {
    color: '#FFFFFF',
    fontSize: 21,
    fontFamily: tokens.typography.family.black,
    letterSpacing: -0.4,
    lineHeight: 24,
  },
  campaignName: {
    color: '#FFE8DE',
    fontSize: 12,
    fontFamily: tokens.typography.family.medium,
    marginTop: 3,
    marginBottom: 10,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 6,
    gap: 8,
  },
  shopNowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 18,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  shopNowText: {
    color: '#B8320C',
    fontSize: 12,
    fontFamily: tokens.typography.family.extrabold,
  },
  autoAppliedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
  },
  autoAppliedText: {
    color: '#FFE8DE',
    fontSize: 10,
    fontFamily: tokens.typography.family.bold,
    letterSpacing: 0.2,
  },
  footerRow: {
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.22)',
  },
  footerText: {
    color: '#FFE8DE',
    fontSize: 10,
    fontFamily: tokens.typography.family.bold,
    letterSpacing: 0.3,
  },
});
