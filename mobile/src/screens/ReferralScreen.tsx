import { useFocusEffect } from '@react-navigation/native';
import { tokens } from '../theme/tokens';
import { ArrowLeft, Copy, Gift } from 'lucide-react-native';
import React, { useCallback } from 'react';
import { View, Text, ScrollView, Share, StyleSheet } from 'react-native';
import { PressableScale } from '../components/ui/internal/PressableScale';
import { useSelector } from 'react-redux';
import { useQuery } from '@tanstack/react-query';
import { RootState } from '../store';
import { api } from '../api/client';

const ReferralScreen = ({ navigation }: any) => {
  const { user } = useSelector((state: RootState) => state.auth);
  
  const { data: stats, refetch } = useQuery({
    queryKey: ['referral-stats'],
    queryFn: () => api.get('/customers/referrals/stats'),
  });

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const referralCode = stats?.referralCode || user?.phone?.slice(-6).toUpperCase() || 'EIGEN50';

  const onShare = async () => {
    try {
      await Share.share({
        title: 'Join me on Eigen Foods!',
        message: `Order fresh, chef-crafted meals from Eigen Foods and get ₹50 off on your first order! Use my code: ${referralCode}\n\nDownload here: https://play.google.com/store/apps/details?id=com.veltomobile.buyer`,
      }, {
        dialogTitle: 'Share your Eigen Foods invite code',
        subject: 'Join me on Eigen Foods!',
      });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header Image/Icon */}
      <View style={styles.heroSection}>
        <View style={styles.giftWrapper}>
          <Gift size={48} color={tokens.colors.success} />
        </View>
        <Text style={styles.heroTitle}>Invite & Earn</Text>
        <PressableScale 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ArrowLeft size={24} color={tokens.colors.textPrimary} />
        </PressableScale>
      </View>

      <View style={styles.content}>
        <Text style={styles.promoTitle}>Give ₹50, Get ₹50</Text>
        <Text style={styles.promoDesc}>
          When your friend signs up with your code and places their first order, you both get ₹50 in your Eigen wallet.
        </Text>

        <View style={styles.statsRow}>
           <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats?.totalReferrals || 0}</Text>
              <Text style={styles.statLabel}>Friends Joined</Text>
           </View>
           <View style={styles.divider} />
           <View style={styles.statItem}>
              <Text style={styles.rewardValue}>₹{(stats?.rewardAmountPaise || 0) / 100}</Text>
              <Text style={styles.statLabel}>Rewards Earned</Text>
           </View>
        </View>

        {/* Code Box */}
        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>Your Unique Code</Text>
          <Text style={styles.codeText}>{referralCode}</Text>
          <View style={styles.codeBtnRow}>
            <PressableScale
              style={[styles.shareBtn, styles.copyBtn]}
              onPress={() => Share.share({ message: referralCode })}
              accessibilityRole="button"
              accessibilityLabel="Copy referral code"
            >
              <Copy size={16} color={tokens.colors.textPrimary} style={{ marginRight: tokens.spacing.sm }} />
              <Text style={styles.copyBtnText}>COPY</Text>
            </PressableScale>
            <PressableScale 
              style={styles.shareBtn} 
              onPress={onShare}
              accessibilityRole="button"
              accessibilityLabel="Share referral code"
            >
              <Text style={styles.shareBtnText}>SHARE CODE</Text>
            </PressableScale>
          </View>
        </View>

        {/* Steps */}
        <View style={styles.stepsSection}>
          <Text style={styles.sectionTitle}>How it works</Text>
          
          <View style={styles.stepRow}>
            <View style={styles.stepNumWrapper}>
              <Text style={styles.stepNum}>1</Text>
            </View>
            <Text style={styles.stepText}>Share your code with friends who haven't tried Eigen Foods.</Text>
          </View>

          <View style={styles.stepRow}>
            <View style={styles.stepNumWrapper}>
              <Text style={styles.stepNum}>2</Text>
            </View>
            <Text style={styles.stepText}>They get ₹50 off on their first order of ₹100 or more.</Text>
          </View>

          <View style={styles.stepRow}>
            <View style={styles.stepNumWrapper}>
              <Text style={styles.stepNum}>3</Text>
            </View>
            <Text style={styles.stepText}>Once they receive their order, ₹50 is credited to your wallet.</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
  },
  heroSection: {
    height: 300,
    backgroundColor: tokens.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    ...tokens.shadows.soft,
  },
  giftWrapper: {
    width: 140,
    height: 140,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftEmoji: {
    fontSize: 80,
  },
  heroTitle: {
    color: tokens.colors.textInverse,
    fontSize: 32,
    fontFamily: tokens.typography.family.black,
    marginTop: tokens.spacing.lg,
  },
  backButton: {
    position: 'absolute',
    top: 48,
    left: tokens.spacing.xxl,
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: tokens.spacing.xxl,
    paddingTop: tokens.spacing.xxxl,
    paddingBottom: 64,
  },
  promoTitle: {
    color: tokens.colors.textPrimary,
    textAlign: 'center',
    fontSize: 24,
    fontFamily: tokens.typography.family.black,
    lineHeight: 32,
  },
  promoDesc: {
    color: tokens.colors.textSecondary,
    textAlign: 'center',
    fontSize: 16,
    marginTop: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.sm,
    lineHeight: 24,
    fontFamily: tokens.typography.family.medium,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: tokens.spacing.xxxl,
    gap: tokens.spacing.xxl,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: tokens.colors.textPrimary,
    fontFamily: tokens.typography.family.black,
    fontSize: 24,
  },
  statLabel: {
    color: tokens.colors.textTertiary,
    fontSize: 10,
    fontFamily: tokens.typography.family.black,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: tokens.spacing.xs,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: tokens.colors.background,
  },
  rewardValue: {
    color: tokens.colors.success,
    fontFamily: tokens.typography.family.black,
    fontSize: 24,
  },
  codeBox: {
    marginTop: tokens.spacing.xxxl,
    backgroundColor: tokens.colors.background,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: tokens.colors.border,
    borderRadius: tokens.radii.xxl,
    padding: tokens.spacing.xxl,
    alignItems: 'center',
  },
  codeLabel: {
    color: tokens.colors.textTertiary,
    fontFamily: tokens.typography.family.bold,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 8,
    fontSize: 12,
  },
  codeText: {
    color: tokens.colors.textPrimary,
    fontSize: 32,
    fontFamily: tokens.typography.family.black,
    letterSpacing: 2,
  },
  codeBtnRow: {
    flexDirection: 'row',
    gap: tokens.spacing.md,
    marginTop: tokens.spacing.xl,
  },
  copyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.background,
    paddingHorizontal: tokens.spacing.xl,
    paddingVertical: tokens.spacing.lg,
    borderRadius: tokens.radii.xl,
    marginTop: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  copyBtnText: {
    color: tokens.colors.textPrimary,
    fontFamily: tokens.typography.family.black,
    fontSize: 14,
  },
  shareBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.textPrimary,
    paddingHorizontal: tokens.spacing.xl,
    paddingVertical: tokens.spacing.lg,
    borderRadius: tokens.radii.xl,
    ...tokens.shadows.soft,
  },
  shareBtnText: {
    color: tokens.colors.textInverse,
    fontFamily: tokens.typography.family.black,
    fontSize: 14,
  },
  stepsSection: {
    marginTop: 40,
  },
  sectionTitle: {
    color: tokens.colors.textPrimary,
    fontSize: 18,
    fontFamily: tokens.typography.family.black,
    marginBottom: tokens.spacing.xl,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: tokens.spacing.xl,
  },
  stepNumWrapper: {
    width: 40,
    height: 40,
    backgroundColor: tokens.colors.background,
    borderRadius: tokens.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: tokens.spacing.lg,
  },
  stepNum: {
    color: tokens.colors.textPrimary,
    fontFamily: tokens.typography.family.black,
    fontSize: 18,
  },
  stepText: {
    color: tokens.colors.textSecondary,
    fontSize: 16,
    flex: 1,
    fontFamily: tokens.typography.family.medium,
  },
});

export default ReferralScreen;
