import { ArrowLeft, Share2, Copy, Gift } from 'lucide-react-native';
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Share, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { useQuery } from '@tanstack/react-query';
import { RootState } from '../store';
import { api } from '../api/client';

const ReferralScreen = ({ navigation }: any) => {
  const { user } = useSelector((state: RootState) => state.auth);
  
  const { data: stats } = useQuery({
    queryKey: ['referral-stats'],
    queryFn: () => api.get('/customers/referrals/stats'),
  });

  const referralCode = stats?.referralCode || user?.phone?.slice(-6).toUpperCase() || '2QT50';

  const onShare = async () => {
    try {
      await Share.share({
        title: 'Join me on 2QT!',
        message: `Order fresh, home-style food from 2QT and get ₹50 off on your first order! Use my code: ${referralCode}\n\nDownload here: https://2qt.in/app`,
      }, {
        dialogTitle: 'Share your 2QT invite code',
        subject: 'Join me on 2QT!',
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
          <Gift size={48} color="#10B981" />
        </View>
        <Text style={styles.heroTitle}>Invite & Earn</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={24} color="#1A1A2E" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.promoTitle}>Give ₹50, Get ₹50</Text>
        <Text style={styles.promoDesc}>
          When your friend signs up with your code and places their first order, you both get ₹50 in your 2QT wallet.
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
          <TouchableOpacity 
            style={styles.shareBtn}
            onPress={onShare}
          >
            <Text style={styles.shareBtnText}>SHARE CODE</Text>
          </TouchableOpacity>
        </View>

        {/* Steps */}
        <View style={styles.stepsSection}>
          <Text style={styles.sectionTitle}>How it works</Text>
          
          <View style={styles.stepRow}>
            <View style={styles.stepNumWrapper}>
              <Text style={styles.stepNum}>1</Text>
            </View>
            <Text style={styles.stepText}>Share your code with friends who haven't tried 2QT.</Text>
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
    backgroundColor: '#fff',
  },
  heroSection: {
    height: 300,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
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
    color: '#fff',
    fontSize: 32,
    fontWeight: '900',
    marginTop: 16,
  },
  backButton: {
    position: 'absolute',
    top: 48,
    left: 24,
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 64,
  },
  promoTitle: {
    color: '#1A1A2E',
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 32,
  },
  promoDesc: {
    color: '#6b7280',
    textAlign: 'center',
    fontSize: 16,
    marginTop: 12,
    paddingHorizontal: 8,
    lineHeight: 24,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
    gap: 24,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: '#1A1A2E',
    fontWeight: '900',
    fontSize: 24,
  },
  statLabel: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 4,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: '#f3f4f6',
  },
  rewardValue: {
    color: '#10B981',
    fontWeight: '900',
    fontSize: 24,
  },
  codeBox: {
    marginTop: 32,
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#e5e7eb',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  codeLabel: {
    color: '#9ca3af',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 8,
    fontSize: 12,
  },
  codeText: {
    color: '#1A1A2E',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 2,
  },
  shareBtn: {
    backgroundColor: '#1A1A2E',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  shareBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 16,
  },
  stepsSection: {
    marginTop: 40,
  },
  sectionTitle: {
    color: '#1A1A2E',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 24,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  stepNumWrapper: {
    width: 40,
    height: 40,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  stepNum: {
    color: '#1A1A2E',
    fontWeight: '900',
    fontSize: 18,
  },
  stepText: {
    color: '#4b5563',
    fontSize: 16,
    flex: 1,
    fontWeight: '500',
  },
});

export default ReferralScreen;
