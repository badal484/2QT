import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Zap, Clock, Sparkles, Flame, Gift, ArrowRight } from 'lucide-react-native';
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
          gradient: ['#F04A0D', '#C83B0E', '#B8320C'],
          badgeBg: 'rgba(0, 0, 0, 0.22)',
          badgeBorder: '#FFB000',
          badgeText: '#FFB000',
          badgeLabel: 'FLASH SALE',
          icon: Flame,
          accent: '#FFB000',
          foodImage: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&auto=format&fit=crop&q=80',
        };
      case 'happy_hour':
        return {
          gradient: ['#7C3AED', '#6D28D9', '#4C1D95'],
          badgeBg: 'rgba(255, 255, 255, 0.22)',
          badgeText: '#FFFFFF',
          badgeLabel: 'HAPPY HOUR',
          icon: Clock,
          accent: '#A855F7',
          foodImage: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&auto=format&fit=crop&q=80',
        };
      case 'welcome':
      case 'winback':
        return {
          gradient: ['#059669', '#047857', '#064E3B'],
          badgeBg: 'rgba(255, 255, 255, 0.22)',
          badgeText: '#FFFFFF',
          badgeLabel: 'SPECIAL OFFER',
          icon: Gift,
          accent: '#10B981',
          foodImage: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=80',
        };
      default:
        return {
          gradient: ['#EA580C', '#C2410C', '#9A3412'],
          badgeBg: 'rgba(255, 255, 255, 0.22)',
          badgeText: '#FFFFFF',
          badgeLabel: 'LIMITED DEAL',
          icon: Sparkles,
          accent: '#F59E0B',
          foodImage: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=400&auto=format&fit=crop&q=80',
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
    return `${pct}% OFF ON EVERYTHING`;
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
        {/* Ambient background glow ornaments */}
        <View style={styles.ambientGlow1} pointerEvents="none" />
        <View style={styles.ambientGlow2} pointerEvents="none" />

        {/* Floating Gourmet Food Cutout Accent */}
        <View pointerEvents="none" style={styles.foodCutoutContainer}>
          <Image
            source={{ uri: campaign.image_url || campaign.photo_url || theme.foodImage }}
            style={styles.foodCutoutImage}
            resizeMode="cover"
          />
        </View>

        {/* Top bar: Badge + Live Glass Timer */}
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

        {/* Headline & Campaign Name */}
        <View style={styles.bodyRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text allowFontScaling={false} style={styles.headline}>
              {discountHeadline()}
            </Text>
            <Text allowFontScaling={false} style={styles.campaignName} numberOfLines={1}>
              {campaign.name}
            </Text>
          </View>
          <View style={styles.shopNowPill}>
            <Text allowFontScaling={false} style={styles.shopNowText}>Order Now</Text>
            <ArrowRight size={13} color="#B8320C" />
          </View>
        </View>

        {/* Footer info: Min order / auto-applied */}
        <View style={styles.footerRow}>
          <Text allowFontScaling={false} style={styles.footerText} numberOfLines={1}>
            {minOrderRupees > 0 ? `Min ₹${minOrderRupees}` : 'No Min'}
            {maxDiscountRupees > 0 ? ` • Max discount ₹${maxDiscountRupees}` : ''}
          </Text>
          <View style={styles.autoAppliedBadge}>
            <Zap size={11} color="#FFF" style={{ marginRight: 3 }} />
            <Text allowFontScaling={false} style={styles.autoAppliedText}>
              Auto-applied
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
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#E11D48',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  gradientCard: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  ambientGlow1: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255, 176, 0, 0.22)',
  },
  ambientGlow2: {
    position: 'absolute',
    bottom: -50,
    left: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
  },
  foodCutoutContainer: {
    position: 'absolute',
    right: -15,
    bottom: -15,
    width: 140,
    height: 140,
    borderRadius: 70,
    overflow: 'hidden',
    opacity: 0.55,
    borderWidth: 2,
    borderColor: 'rgba(255, 176, 0, 0.45)',
    transform: [{ rotate: '12deg' }],
  },
  foodCutoutImage: {
    width: '100%',
    height: '100%',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
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
    backgroundColor: 'rgba(0, 0, 0, 0.26)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
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
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  headline: {
    color: '#FFFFFF',
    fontSize: 20,
    fontFamily: tokens.typography.family.black,
    letterSpacing: -0.3,
  },
  campaignName: {
    color: '#FFE8DE',
    fontSize: 12,
    fontFamily: tokens.typography.family.medium,
    marginTop: 1,
  },
  shopNowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
  },
  shopNowText: {
    color: '#B8320C',
    fontSize: 12,
    fontFamily: tokens.typography.family.extrabold,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  footerText: {
    color: '#FFE8DE',
    fontSize: 10,
    fontFamily: tokens.typography.family.bold,
    letterSpacing: 0.3,
    flex: 1,
    marginRight: 8,
  },
  autoAppliedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  autoAppliedText: {
    color: '#FFE8DE',
    fontSize: 10,
    fontFamily: tokens.typography.family.bold,
    letterSpacing: 0.2,
  },
});
