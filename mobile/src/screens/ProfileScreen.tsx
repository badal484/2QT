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
} from 'lucide-react-native';
import React, { useCallback } from 'react';
import { BouncingButton } from '../components/ui/BouncingButton';
import { View, Text, ScrollView, TouchableOpacity, Alert, Image, StyleSheet } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RootState } from '../store';
import { logout } from '../store/slices/authSlice';
import { disconnectSocket } from '../socket/client';
import { api } from '../api/client';
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../theme/tokens';

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

const MinimalListItem = React.memo(({ icon, title, value, onPress, subtitle, color = tokens.colors.textPrimary, isDestructive = false }: any) => (
  <BouncingButton 
    activeOpacity={0.7}
    style={styles.minimalListItem}
    onPress={() => {
      ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
      onPress();
    }}
  >
    <View style={styles.minimalListLeft}>
      <View style={styles.minimalListIcon}>
        {icon}
      </View>
      <View>
        <Text allowFontScaling={false} style={[styles.minimalListTitle, isDestructive && { color: tokens.colors.danger }]}>{title}</Text>
        {subtitle && <Text allowFontScaling={false} style={styles.minimalListSub}>{subtitle}</Text>}
      </View>
    </View>
    <View style={styles.minimalListRight}>
      {value !== undefined && value !== null && value !== '' && (
        <Text allowFontScaling={false} style={styles.minimalListValue}>{value}</Text>
      )}
      <ChevronRight size={16} color={tokens.colors.border} />
    </View>
  </BouncingButton>
));

const ProfileScreen = ({ navigation }: any) => {
  const { user } = useSelector((state: RootState) => state.auth);
  const { featureLoyalty, featureReferrals } = useSelector((state: RootState) => state.app);
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const isRider = user?.role === 'rider';
  const accent = isRider ? tokens.colors.primary : tokens.colors.success;
  const accentLight = isRider ? '#FFF0E8' : '#ECFDF5';

  const { data: wallet } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => api.get('/customers/wallet'),
    enabled: !isRider
  });

  const { data: loyalty } = useQuery({
    queryKey: ['loyalty'],
    queryFn: () => api.get('/customers/loyalty'),
    enabled: !isRider
  });

  const { data: riderStats } = useQuery({
    queryKey: ['rider-stats'],
    queryFn: () => api.get('/riders/stats'),
    enabled: isRider
  });

  const handleLogout = useCallback(() => {
    ReactNativeHapticFeedback.trigger("impactHeavy", hapticOptions);
    Alert.alert('Logout', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          dispatch(logout());
          disconnectSocket();
        }
      }
    ]);
  }, [dispatch]);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        
        {/* REFINED HEADER */}
        <Animated.View entering={FadeInDown.duration(400)} style={[styles.header, { paddingTop: Math.max(insets.top + 16, 40) }]}>
          <BouncingButton 
            style={styles.profilePicWrapper}
            onPress={() => {
              ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
              navigation.navigate('EditProfile');
            }}
          >
            {user?.photo_url ? (
              <Image source={{ uri: user.photo_url }} style={styles.profilePic} />
            ) : (
              <User size={32} color={accent} />
            )}
            <View style={[styles.editPicBadge, { backgroundColor: accent }]}>
              <Text allowFontScaling={false} style={styles.editPicText}>EDIT</Text>
            </View>
          </BouncingButton>
          <View style={styles.headerTextCol}>
            <Text allowFontScaling={false} style={styles.headerName}>{user?.name || (isRider ? 'Rider' : 'Gourmet')}</Text>
            <Text allowFontScaling={false} style={styles.phoneText}>+{user?.phone}</Text>
          </View>
        </Animated.View>

        {/* STATS ROW (Swish Style) */}
        {!isRider && featureReferrals && (
          <Animated.View entering={FadeInDown.delay(120).duration(400)}>
            <BouncingButton style={styles.referralBanner} activeOpacity={0.8} onPress={() => navigation.navigate('Referral')}>
              <View style={styles.referralIconBox}>
                <Gift size={20} color={tokens.colors.surface} />
              </View>
              <View style={styles.referralTexts}>
                <Text allowFontScaling={false} style={styles.referralTitle}>Invite & Earn ₹50</Text>
                <Text allowFontScaling={false} style={styles.referralSub}>Get ₹50 for every friend who orders.</Text>
              </View>
              <ChevronRight size={20} color={tokens.colors.surface} />
            </BouncingButton>
          </Animated.View>
        )}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.statsRow}>
          {isRider ? (
            <>
              <BouncingButton style={styles.statBox} activeOpacity={0.8} onPress={() => navigation.navigate('Payouts')}>
                <Wallet size={20} color={tokens.colors.textSecondary} />
                <Text allowFontScaling={false} style={styles.statLabel}>Earnings</Text>
                <Text allowFontScaling={false} style={styles.statValue}>₹{((riderStats?.totalEarnings ?? 0) / 100).toFixed(0)}</Text>
              </BouncingButton>
              <BouncingButton style={styles.statBox} activeOpacity={0.8} onPress={() => navigation.navigate('RiderHistory')}>
                <Package size={20} color={tokens.colors.textSecondary} />
                <Text allowFontScaling={false} style={styles.statLabel}>Total Trips</Text>
                <Text allowFontScaling={false} style={styles.statValue}>{riderStats?.totalDeliveries || 0}</Text>
              </BouncingButton>
              <BouncingButton style={styles.statBox} activeOpacity={0.8} onPress={() => {}}>
                <Star size={20} color="#F59E0B" />
                <Text allowFontScaling={false} style={styles.statLabel}>Rating</Text>
                <Text allowFontScaling={false} style={[styles.statValue, { color: '#F59E0B' }]}>{(riderStats?.rating ?? 5.0).toFixed(1)}★</Text>
              </BouncingButton>
            </>
          ) : (
            <>
              <BouncingButton style={[styles.statBox, !featureLoyalty && { flex: 1 }]} activeOpacity={0.8} onPress={() => navigation.navigate('Wallet')}>
                <Wallet size={20} color={tokens.colors.textSecondary} />
                <Text allowFontScaling={false} style={styles.statLabel}>Wallet Balance</Text>
                <Text allowFontScaling={false} style={styles.statValue}>{wallet ? `₹${(wallet.balancePaise / 100).toFixed(2)}` : '₹0.00'}</Text>
              </BouncingButton>
              {featureLoyalty && (
                <BouncingButton style={styles.statBox} activeOpacity={0.8} onPress={() => navigation.navigate('Loyalty')}>
                  <Sparkles size={20} color={tokens.colors.primary} />
                  <Text allowFontScaling={false} style={styles.statLabel}>Loyalty Points</Text>
                  <Text allowFontScaling={false} style={[styles.statValue, { color: tokens.colors.primary }]}>{loyalty?.points || 0}</Text>
                </BouncingButton>
              )}
            </>
          )}
        </Animated.View>




        {/* ACTIVITY GROUP */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.settingsGroup}>
          <Text allowFontScaling={false} style={styles.groupLabel}>{isRider ? 'Fleet Management' : 'Activity'}</Text>
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
          <Text allowFontScaling={false} style={styles.groupLabel}>Support</Text>
          <MinimalListItem icon={<Bell size={22} color={tokens.colors.textSecondary} strokeWidth={1.5} />} title="Notifications" onPress={() => navigation.navigate(isRider ? 'RiderNotifications' : 'Notifications')} />
          <MinimalListItem icon={<MessageCircle size={22} color={tokens.colors.textSecondary} strokeWidth={1.5} />} title="Help & Support" onPress={() => navigation.navigate(isRider ? 'RiderHelp' : 'Help')} />
          <MinimalListItem icon={<LogOut size={22} color={tokens.colors.danger} strokeWidth={1.5} />} title="Sign Out" isDestructive={true} onPress={handleLogout} />
        </Animated.View>

        {/* Dev Role Switcher */}
        {__DEV__ && (
            <View style={styles.devCard}>
                <Text allowFontScaling={false} style={styles.devHeader}>Developer Role Control</Text>
                <View style={styles.devBtnRow}>
                    {['customer', 'rider', 'chef', 'super_admin'].map(r => (
                        <BouncingButton 
                            key={r}
                            onPress={() => {
                                api.post('/auth/update-role', { role: r })
                                    .then(() => {
                                        Alert.alert('Role Updated', `Now: ${r}. Please restart app.`);
                                        queryClient.invalidateQueries({ queryKey: ['me'] });
                                        dispatch(logout());
                                    });
                            }}
                            style={[styles.devBtn, user?.role === r ? styles.devBtnActive : styles.devBtnInactive]}
                        >
                            <Text allowFontScaling={false} style={[styles.devBtnText, user?.role === r ? styles.devBtnTextActive : styles.devBtnTextInactive]}>{r}</Text>
                        </BouncingButton>
                    ))}
                </View>
            </View>
        )}

        <View style={styles.footer}>
          <Text allowFontScaling={false} style={styles.footerText}>2QT v1.0.0 Stable</Text>
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
  header: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  profilePicWrapper: {
    width: 88,
    height: 88,
    backgroundColor: tokens.colors.surface,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 16,
  },
  profilePic: {
    width: '100%',
    height: '100%',
    borderRadius: 44,
  },
  editPicBadge: {
    position: 'absolute',
    bottom: -4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: tokens.colors.background,
  },
  editPicText: {
    fontSize: 9,
    color: '#fff',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerTextCol: {
    alignItems: 'center',
  },
  headerName: {
    color: tokens.colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  phoneText: {
    color: tokens.colors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
    marginTop: 4,
  },

  // Top stats row (Swish style side-by-side)
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#F9FAFB', // Extremely soft gray, no border, no shadow
    borderRadius: tokens.radii.lg,
    padding: 16,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.textSecondary,
    marginTop: 12,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: tokens.colors.textPrimary,
    marginTop: 4,
  },

  settingsGroup: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  groupLabel: {
    color: tokens.colors.textTertiary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  minimalListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18, // Generous airy padding
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
    fontWeight: '600',
    color: tokens.colors.textPrimary,
  },
  minimalListSub: {
    color: tokens.colors.textTertiary,
    fontSize: 13,
    fontWeight: '400',
    marginTop: 2,
  },
  minimalListValue: {
    fontSize: 15,
    fontWeight: '600',
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
    fontWeight: '800',
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
    fontWeight: '700',
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
    color: '#D1D5DB',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },

  // Tier + streak card
  tierCard: {
    marginHorizontal: 16, marginBottom: 12, backgroundColor: tokens.colors.surface,
    borderRadius: 20, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    borderWidth: 1, borderColor: '#E9E9EB',
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
    backgroundColor: '#E8F5E9',
    padding: 16,
    borderRadius: tokens.radii.lg,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 20,
  },
  referralIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1BA672',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  referralTexts: { flex: 1 },
  referralTitle: { fontSize: 16, fontWeight: '800', color: '#1BA672', marginBottom: 2 },
  referralSub: { fontSize: 12, color: '#333333', fontWeight: '500' },
});

export default ProfileScreen;

