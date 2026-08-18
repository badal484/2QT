import { useFocusEffect } from '@react-navigation/native';
import { tokens } from '../theme/tokens';
import {
  CreditCard,
  User,
  Package,
  MapPin,
  Calendar,
  MessageCircle,
  ChevronRight,
  Star,
  Gift,
  LogOut,
  ShieldCheck,
  Wallet,
  Bell,
  Flame,
  TrendingUp,
  Award,
  BarChart2,
  Sparkles,
  ArrowLeft,
} from 'lucide-react-native';
import React, { useCallback } from 'react';
import { PressableScale } from '../components/ui/internal/PressableScale';
import { View, Text, ScrollView, Image, StyleSheet, RefreshControl } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFeedback } from '../context/FeedbackContext';
import { RootState } from '../store';
import { logout } from '../store/slices/authSlice';
import { disconnectSocket } from '../socket/client';
import { api } from '../api/client';
import { haptics } from '../utils/haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MinimalListItem = React.memo(({ icon, title, value, onPress, subtitle, isDestructive = false }: any) => (
  <PressableScale
    style={styles.minimalListItem}
    onPress={onPress}
    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    accessibilityRole="button"
    accessibilityLabel={title}
  >
    <View style={styles.minimalListLeft}>
      <View style={styles.minimalListIcon}>
        {icon}
      </View>
      <View>
        <Text allowFontScaling maxFontSizeMultiplier={1.4} style={[styles.minimalListTitle, isDestructive && { color: tokens.colors.danger }]}>{title}</Text>
        {subtitle && <Text allowFontScaling maxFontSizeMultiplier={1.4} style={styles.minimalListSub}>{subtitle}</Text>}
      </View>
    </View>
    <View style={styles.minimalListRight}>
      {value !== undefined && value !== null && value !== '' && (
        <Text allowFontScaling maxFontSizeMultiplier={1.4} style={styles.minimalListValue}>{value}</Text>
      )}
      <ChevronRight size={16} color={tokens.colors.border} />
    </View>
  </PressableScale>
));

const ProfileScreen = ({ navigation }: any) => {
  const { user } = useSelector((state: RootState) => state.auth);
  const { featureLoyalty, featureReferrals } = useSelector((state: RootState) => state.app);
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { showDialog } = useFeedback();
  const isRider = user?.role === 'rider';
  const accent = isRider ? tokens.colors.primary : tokens.colors.success;
  const accentLight = isRider ? tokens.colors.primaryTint : tokens.colors.successTint;

  const { data: wallet, refetch: refetchWallet } = useQuery({
    queryKey: ['wallet', 'balance'],
    queryFn: () => api.get('/customers/wallet'),
    enabled: !isRider
  });

  const { data: loyalty, refetch: refetchLoyalty } = useQuery({
    queryKey: ['loyalty', 'balance'],
    queryFn: () => api.get('/customers/loyalty'),
    enabled: !isRider
  });

  const { data: riderStats, refetch: refetchRiderStats } = useQuery({
    queryKey: ['rider-stats'],
    queryFn: () => api.get('/riders/stats'),
    enabled: isRider
  });

  useFocusEffect(
    useCallback(() => {
      if (isRider) {
        refetchRiderStats();
      } else {
        refetchWallet();
        refetchLoyalty();
      }
    }, [isRider, refetchRiderStats, refetchWallet, refetchLoyalty])
  );

  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (isRider) {
        await refetchRiderStats();
      } else {
        await Promise.all([refetchWallet(), refetchLoyalty()]);
      }
    } finally {
      setRefreshing(false);
    }
  }, [isRider, refetchRiderStats, refetchWallet, refetchLoyalty]);

  const handleLogout = useCallback(() => {
    haptics.warning();
    showDialog({
      title: 'Logout',
      message: 'Are you sure you want to sign out?',
      confirmText: 'Sign Out',
      cancelText: 'Cancel',
      type: 'warning',
      onConfirm: () => {
        dispatch(logout());
        disconnectSocket();
      }
    });
  }, [dispatch, showDialog]);

  return (
    <View style={styles.container}>
      {/* TOP NAVIGATION BAR */}
      <View style={[styles.navHeader, { paddingTop: Math.max(insets.top + 8, 16) }]}>
        <PressableScale
          onPress={() => {
            if (navigation.canGoBack?.()) {
              navigation.goBack();
            } else {
              navigation.navigate('HomeTab');
            }
          }}
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Go Back"
        >
          <ArrowLeft size={20} color={tokens.colors.textPrimary} />
        </PressableScale>
        <Text allowFontScaling maxFontSizeMultiplier={1.4} style={styles.navHeaderTitle}>My Profile</Text>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.colors.primary} />}
      >
        
        {/* REFINED UPPER PROFILE CARD */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.headerCard}>
          <PressableScale 
            style={[styles.profilePicWrapper, { borderColor: accent }]}
            onPress={() => navigation.navigate('EditProfile')}
            accessibilityRole="button"
            accessibilityLabel="Edit Profile"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {user?.photo_url ? (
              <Image source={{ uri: user.photo_url }} style={styles.profilePic} />
            ) : (
              <View style={[styles.profilePic, { backgroundColor: tokens.colors.primaryTint, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: tokens.colors.primary + '30' }]}>
                <User size={48} color={tokens.colors.primary} />
              </View>
            )}
            <View style={[styles.editPicBadge, { backgroundColor: accent }]}>
              <Text allowFontScaling maxFontSizeMultiplier={1.4} style={styles.editPicText}>EDIT</Text>
            </View>
          </PressableScale>

          <View style={styles.headerTextCol}>
            <Text allowFontScaling maxFontSizeMultiplier={1.4} style={styles.headerName}>{user?.name || (isRider ? 'Rider' : 'Gourmet')}</Text>
            <Text allowFontScaling maxFontSizeMultiplier={1.4} style={styles.phoneText}>+{user?.phone}</Text>
          </View>
        </Animated.View>

        {/* STATS ROW (Swish Style) */}
        {!isRider && featureReferrals && (
          <Animated.View entering={FadeInDown.delay(120).duration(400)}>
            <PressableScale 
              style={styles.referralBanner} 
              onPress={() => navigation.navigate('Referral')}
              accessibilityRole="button"
              accessibilityLabel="Invite and Earn"
            >
              <View style={styles.referralIconBox}>
                <Gift size={20} color={tokens.colors.surface} />
              </View>
              <View style={styles.referralTexts}>
                <Text allowFontScaling maxFontSizeMultiplier={1.4} style={styles.referralTitle}>Invite & Earn ₹50</Text>
                <Text allowFontScaling maxFontSizeMultiplier={1.4} style={styles.referralSub}>Get ₹50 for every friend who orders.</Text>
              </View>
              <ChevronRight size={20} color={tokens.colors.surface} />
            </PressableScale>
          </Animated.View>
        )}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.statsRow}>
          {isRider ? (
            <>
              <PressableScale style={styles.statBox} onPress={() => navigation.navigate('Payouts')} accessibilityRole="button" accessibilityLabel="Earnings">
                <Wallet size={20} color={tokens.colors.textSecondary} />
                <Text allowFontScaling maxFontSizeMultiplier={1.4} style={styles.statLabel}>Earnings</Text>
                <Text 
                  allowFontScaling={false} 
                  numberOfLines={1} 
                  adjustsFontSizeToFit 
                  style={styles.statValue}
                >
                  ₹{(() => {
                    const raw = riderStats?.totalEarnings ?? riderStats?.total_earnings ?? 0;
                    const num = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
                    const val = isNaN(num) ? 0 : num;
                    const rupees = Math.round(val > 100000 ? val / 100 : val / 100);
                    if (rupees >= 100000) return `${(rupees / 100000).toFixed(2)}L`;
                    if (rupees >= 10000) return `${(rupees / 1000).toFixed(1)}k`;
                    return rupees.toLocaleString('en-IN');
                  })()}
                </Text>
              </PressableScale>
              <PressableScale style={styles.statBox} onPress={() => navigation.navigate('RiderHistory')} accessibilityRole="button" accessibilityLabel="Total Trips">
                <Package size={20} color={tokens.colors.textSecondary} />
                <Text allowFontScaling maxFontSizeMultiplier={1.4} style={styles.statLabel}>Total Trips</Text>
                <Text 
                  allowFontScaling={false} 
                  numberOfLines={1} 
                  adjustsFontSizeToFit 
                  style={styles.statValue}
                >
                  {riderStats?.totalDeliveries || 0}
                </Text>
              </PressableScale>
              <PressableScale style={styles.statBox} onPress={() => navigation.navigate('RiderScorecard')} accessibilityRole="button" accessibilityLabel="Rating">
                <Star size={20} color={tokens.colors.warning} />
                <Text allowFontScaling maxFontSizeMultiplier={1.4} style={styles.statLabel}>Rating</Text>
                <Text 
                  allowFontScaling={false} 
                  numberOfLines={1} 
                  adjustsFontSizeToFit 
                  style={[styles.statValue, { color: tokens.colors.warning }]}
                >
                  {(() => {
                    const raw = riderStats?.rating ?? 5.0;
                    const num = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
                    const val = isNaN(num) ? 5.0 : num;
                    return val.toFixed(1);
                  })()}★
                </Text>
              </PressableScale>
            </>
          ) : (
            <>
              <PressableScale style={[styles.statBox, !featureLoyalty && { flex: 1 }]} onPress={() => navigation.navigate('Wallet')} accessibilityRole="button" accessibilityLabel="Wallet Balance">
                <Wallet size={20} color={tokens.colors.textSecondary} />
                <Text allowFontScaling maxFontSizeMultiplier={1.4} style={styles.statLabel}>Wallet Balance</Text>
                <Text allowFontScaling maxFontSizeMultiplier={1.4} style={styles.statValue}>
                  {(() => {
                    if (!wallet) return '₹0.00';
                    const raw = wallet?.balancePaise ?? wallet?.balance_paise ?? 0;
                    const num = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
                    const safePaise = isNaN(num) ? 0 : num;
                    return `₹${(safePaise / 100).toFixed(2)}`;
                  })()}
                </Text>
              </PressableScale>
              {featureLoyalty && (
                <PressableScale style={styles.statBox} onPress={() => navigation.navigate('Loyalty')} accessibilityRole="button" accessibilityLabel="Loyalty Points">
                  <Sparkles size={20} color={tokens.colors.primary} />
                  <Text allowFontScaling maxFontSizeMultiplier={1.4} style={styles.statLabel}>Loyalty Points</Text>
                  <Text allowFontScaling maxFontSizeMultiplier={1.4} style={[styles.statValue, { color: tokens.colors.primary }]}>{loyalty?.points || 0}</Text>
                </PressableScale>
              )}
            </>
          )}
        </Animated.View>




        {/* ACTIVITY GROUP */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.settingsGroup}>
          <Text allowFontScaling maxFontSizeMultiplier={1.4} style={styles.groupLabel}>{isRider ? 'Fleet Management' : 'Activity'}</Text>
          {isRider ? (
            <>
              <MinimalListItem icon={<ShieldCheck size={22} color={tokens.colors.textSecondary} strokeWidth={1.5} />} title="Documents" onPress={() => navigation.navigate('RiderDocuments')} />
              <MinimalListItem icon={<Star size={22} color={tokens.colors.textSecondary} strokeWidth={1.5} />} title="Daily Missions" onPress={() => navigation.navigate('RiderMissions')} />
              <MinimalListItem icon={<BarChart2 size={22} color={tokens.colors.textSecondary} strokeWidth={1.5} />} title="Weekly Scorecard" subtitle="Your performance this week" onPress={() => navigation.navigate('RiderScorecard')} />
            </>
          ) : (
            <>
              <MinimalListItem icon={<Package size={22} color={tokens.colors.textSecondary} strokeWidth={1.5} />} title="Your Orders" onPress={() => navigation.navigate('OrdersTab')} />
              {/* <MinimalListItem icon={<Calendar size={22} color={tokens.colors.textSecondary} strokeWidth={1.5} />} title="My Table Bookings" onPress={() => navigation.navigate('MyTableBookings')} /> */}
              <MinimalListItem icon={<MapPin size={22} color={tokens.colors.textSecondary} strokeWidth={1.5} />} title="Saved Addresses" onPress={() => navigation.navigate('Address', { fromCheckout: true })} />
            </>

          )}
        </Animated.View>

        {/* HELP & SUPPORT GROUP */}
        <Animated.View entering={FadeInDown.delay(400).duration(400)} style={[styles.settingsGroup, { marginBottom: 40 }]}>
          <Text allowFontScaling maxFontSizeMultiplier={1.4} style={styles.groupLabel}>Support</Text>
          <MinimalListItem icon={<Bell size={22} color={tokens.colors.textSecondary} strokeWidth={1.5} />} title="Notifications" onPress={() => navigation.navigate(isRider ? 'RiderNotifications' : 'Notifications')} />
          <MinimalListItem icon={<MessageCircle size={22} color={tokens.colors.textSecondary} strokeWidth={1.5} />} title="Help & Support" onPress={() => navigation.navigate(isRider ? 'RiderHelp' : 'Help')} />
          <MinimalListItem icon={<LogOut size={22} color={tokens.colors.danger} strokeWidth={1.5} />} title="Sign Out" isDestructive={true} onPress={handleLogout} />
        </Animated.View>

        {/* Dev Role Switcher */}
        {__DEV__ && (
            <View style={styles.devCard}>
                <Text allowFontScaling maxFontSizeMultiplier={1.4} style={styles.devHeader}>Developer Role Control</Text>
                <View style={styles.devBtnRow}>
                    {['customer', 'rider', 'chef', 'super_admin'].map(r => (
                        <PressableScale 
                            key={r}
                            onPress={() => {
                                api.post('/auth/update-role', { role: r })
                                    .then(() => {
                                        showDialog({ title: 'Role Updated', message: `Now: ${r}. Please restart app.`, confirmText: 'Okay', type: 'info' });
                                        queryClient.invalidateQueries({ queryKey: ['me'] });
                                        dispatch(logout());
                                    });
                            }}
                            style={[styles.devBtn, user?.role === r ? styles.devBtnActive : styles.devBtnInactive]}
                            accessibilityRole="button"
                            accessibilityLabel={`Switch to ${r} role`}
                        >
                            <Text allowFontScaling maxFontSizeMultiplier={1.4} style={[styles.devBtnText, user?.role === r ? styles.devBtnTextActive : styles.devBtnTextInactive]}>{r}</Text>
                        </PressableScale>
                    ))}
                </View>
            </View>
        )}

        <View style={styles.footer}>
          <Text allowFontScaling maxFontSizeMultiplier={1.4} style={styles.footerText}>2QT v1.0.0 Stable</Text>
        </View>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.surface, // Pure white Swish style
  },
  headerCard: {
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.xl,
    paddingVertical: 20,
    marginHorizontal: tokens.spacing.lg,
    marginTop: 8,
    marginBottom: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  profilePicWrapper: {
    width: 92,
    height: 92,
    backgroundColor: '#FFFFFF',
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  profilePic: {
    width: '100%',
    height: '100%',
    borderRadius: 46,
  },
  editPicBadge: {
    position: 'absolute',
    bottom: -6,
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  editPicText: {
    fontSize: 9,
    color: '#FFFFFF',
    fontFamily: tokens.typography.family.extrabold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerTextCol: {
    alignItems: 'center',
  },
  headerName: {
    color: '#111827',
    fontSize: 26,
    fontFamily: tokens.typography.family.extrabold,
    letterSpacing: -0.6,
  },
  phoneText: {
    color: '#6B7280',
    fontFamily: tokens.typography.family.semibold,
    fontSize: 14,
    marginTop: 3,
    letterSpacing: 0.3,
  },

  // Top stats row (Swish style side-by-side)
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: tokens.spacing.xl,
    gap: tokens.spacing.md,
    marginBottom: tokens.spacing.xl,
  },
  statBox: {
    flex: 1,
    backgroundColor: tokens.colors.background, // Extremely soft gray, no border, no shadow
    borderRadius: tokens.radii.lg,
    padding: 16,
  },
  statLabel: {
    fontSize: 13,
    fontFamily: tokens.typography.family.semibold,
    color: tokens.colors.textSecondary,
    marginTop: 12,
  },
  statValue: {
    fontSize: 18,
    fontFamily: tokens.typography.family.extrabold,
    color: tokens.colors.textPrimary,
    marginTop: 4,
  },

  settingsGroup: {
    marginBottom: tokens.spacing.xl,
    paddingHorizontal: tokens.spacing.xl,
  },
  groupLabel: {
    color: tokens.colors.textTertiary,
    fontSize: 12,
    fontFamily: tokens.typography.family.bold,
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  minimalListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18, // Generous airy padding
    minHeight: 48,
  },
  minimalListLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  minimalListRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  minimalListIcon: {
    width: 32,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginRight: 8,
  },
  minimalListTitle: {
    fontSize: 16,
    fontFamily: tokens.typography.family.semibold,
    color: tokens.colors.textPrimary,
  },
  minimalListSub: {
    color: tokens.colors.textTertiary,
    fontSize: 13,
    fontFamily: tokens.typography.family.regular,
    marginTop: 2,
  },
  minimalListValue: {
    fontSize: 15,
    fontFamily: tokens.typography.family.semibold,
    color: tokens.colors.textSecondary,
    marginRight: 8,
  },

  referralWrapper: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  referralCard: {
    padding: 16,
    borderRadius: tokens.radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  referralIconWrapper: {
    width: 40,
    height: 40,
    backgroundColor: tokens.colors.surface,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  devCard: {
    marginHorizontal: 16,
    backgroundColor: tokens.colors.surface,
    padding: 24,
    borderRadius: 20,
    marginBottom: 24,
  },
  devHeader: {
    color: tokens.colors.textPrimary,
    fontFamily: tokens.typography.family.extrabold,
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 11,
  },
  devBtnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  devBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: tokens.radii.lg,
    marginRight: 8,
    marginBottom: 8,
  },
  devBtnActive: {
    backgroundColor: tokens.colors.success,
  },
  devBtnInactive: {
    backgroundColor: tokens.colors.background,
  },
  devBtnText: {
    fontFamily: tokens.typography.family.bold,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  devBtnTextActive: {
    color: tokens.colors.surface,
  },
  devBtnTextInactive: {
    color: tokens.colors.textSecondary,
  },
  footer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  footerText: {
    color: tokens.colors.textTertiary,
    fontSize: 11,
    fontFamily: tokens.typography.family.extrabold,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },

  // Tier + streak card
  tierCard: {
    marginHorizontal: tokens.spacing.lg, marginBottom: tokens.spacing.md, backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.xxl, padding: tokens.spacing.lg,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    borderWidth: 1, borderColor: tokens.colors.border,
  },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  tierBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
  },
  tierEmoji: { fontSize: 16 },
  tierName: { fontSize: 14, fontWeight: '800' },
  tierNextHint: { flex: 1, fontSize: 11, color: '#93959F', fontWeight: '600' },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  streakText: { fontSize: 12, fontWeight: '700' },
  tierProgressTrack: {
    height: 5, backgroundColor: '#F0F0F0', borderRadius: 3, overflow: 'hidden', marginBottom: 14,
  },
  tierProgressFill: {
    height: 5, backgroundColor: tokens.colors.primary, borderRadius: 3,
  },
  perfRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8F8F8', borderRadius: 14, padding: 12,
  },
  perfItem: { flex: 1, alignItems: 'center', gap: 3 },
  perfVal: { fontSize: 15, fontWeight: '800' },
  perfLabel: { fontSize: 10, color: '#93959F', fontWeight: '600' },
  perfDivider: { width: 1, height: 32, backgroundColor: '#E9E9EB' },
  referralBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.successTint,
    padding: tokens.spacing.lg,
    borderRadius: tokens.radii.lg,
    marginHorizontal: tokens.spacing.xl,
    marginTop: tokens.spacing.sm,
    marginBottom: tokens.spacing.lg,
    minHeight: 48,
  },
  referralIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  referralTexts: { flex: 1 },
  referralTitle: { fontSize: 16, fontFamily: tokens.typography.family.extrabold, color: tokens.colors.success, marginBottom: 2 },
  referralSub: { fontSize: 12, color: tokens.colors.textPrimary, fontFamily: tokens.typography.family.medium },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  navHeaderTitle: {
    fontSize: 22,
    fontFamily: tokens.typography.family.extrabold,
    color: '#111827',
    letterSpacing: -0.6,
  },
});

export default ProfileScreen;

