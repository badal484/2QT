import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
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
          gradient: ['#FF512F', '#DD2476'],
          badgeBg: '#FFF1F2',
          badgeText: '#E11D48',
          badgeLabel: 'FLASH SALE',
          icon: Flame,
          accent: '#FF4D4D',
        };
      case 'happy_hour':
        return {
          gradient: ['#6B21A8', '#9333EA'],
          badgeBg: '#F3E8FF',
          badgeText: '#7E22CE',
          badgeLabel: 'HAPPY HOUR',
          icon: Clock,
          accent: '#A855F7',
        };
      case 'welcome':
      case 'winback':
        return {
          gradient: ['#059669', '#10B981'],
          badgeBg: '#ECFDF5',
          badgeText: '#047857',
          badgeLabel: 'SPECIAL OFFER',
          icon: Gift,
          accent: '#10B981',
        };
      default:
        return {
          gradient: ['#D97706', '#F59E0B'],
          badgeBg: '#FEF3C7',
          badgeText: '#B45309',
          badgeLabel: 'LIMITED DEAL',
          icon: Sparkles,
          accent: '#F59E0B',
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
    <BouncingButton activeOpacity={0.92} onPress={onPress} style={styles.outerContainer}>
      <LinearGradient
        colors={theme.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientCard}
      >
        {/* Top bar: Badge + Live Timer or Window */}
        <View style={styles.topRow}>
          <View style={[styles.badge, { backgroundColor: 'rgba(255,255,255,0.22)' }]}>
            <Icon size={13} color="#FFF" style={{ marginRight: 4 }} />
            <Text allowFontScaling={false} style={styles.badgeText}>
              {theme.badgeLabel}
            </Text>
          </View>

          {timeLeft ? (
            <View style={styles.timerBadge}>
              <Text allowFontScaling={false} style={styles.timerLabel}>ENDS IN </Text>
              <Text allowFontScaling={false} style={styles.timerValue}>
                {timeLeft.hours}h : {timeLeft.minutes}m : {timeLeft.seconds}s
              </Text>
            </View>
          ) : campaign.happy_hour_start ? (
            <View style={styles.timerBadge}>
              <Text allowFontScaling={false} style={styles.timerValue}>
                {campaign.happy_hour_start.slice(0, 5)} – {campaign.happy_hour_end?.slice(0, 5)}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Headline & Campaign Name */}
        <View style={styles.bodyRow}>
          <View style={{ flex: 1 }}>
            <Text allowFontScaling={false} style={styles.headline}>
              {discountHeadline()}
            </Text>
            <Text allowFontScaling={false} style={styles.campaignName} numberOfLines={1}>
              {campaign.name}
            </Text>
          </View>
          <View style={styles.shopNowPill}>
            <Text allowFontScaling={false} style={styles.shopNowText}>Order Now</Text>
            <ArrowRight size={13} color="#FFF" />
          </View>
        </View>

        {/* Footer info: Min order / auto-applied */}
        <View style={styles.footerRow}>
          <Text allowFontScaling={false} style={styles.footerText}>
            {minOrderRupees > 0 ? `Min order ₹${minOrderRupees}` : 'No minimum order'}
            {maxDiscountRupees > 0 ? ` · Max discount ₹${maxDiscountRupees}` : ''}
          </Text>
          <Text allowFontScaling={false} style={styles.autoAppliedText}>
            ⚡ Auto-applied in Cart
          </Text>
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
    ...tokens.shadows.medium,
  },
  gradientCard: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 20,
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
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 11,
    fontFamily: tokens.typography.family.black,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  timerLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 10,
    fontFamily: tokens.typography.family.bold,
    letterSpacing: 0.5,
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
    color: '#FFF',
    fontSize: 20,
    fontFamily: tokens.typography.family.black,
    letterSpacing: -0.3,
  },
  campaignName: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontFamily: tokens.typography.family.medium,
    marginTop: 1,
  },
  shopNowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.24)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 4,
  },
  shopNowText: {
    color: '#FFF',
    fontSize: 12,
    fontFamily: tokens.typography.family.bold,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.18)',
  },
  footerText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontFamily: tokens.typography.family.medium,
  },
  autoAppliedText: {
    color: '#FFF',
    fontSize: 11,
    fontFamily: tokens.typography.family.bold,
  },
});
