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
import React from 'react';
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

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

const MinimalListItem = ({ icon, title, value, onPress, subtitle, color = "#1A1A2E", isDestructive = false }: any) => (
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
        <Text style={[styles.minimalListTitle, isDestructive && { color: '#EF4444' }]}>{title}</Text>
        {subtitle && <Text style={styles.minimalListSub}>{subtitle}</Text>}
      </View>
    </View>
    <View style={styles.minimalListRight}>
      {value !== undefined && value !== null && value !== '' && (
        <Text style={styles.minimalListValue}>{value}</Text>
      )}
      <ChevronRight size={16} color="#E5E7EB" />
    </View>
  </BouncingButton>
);

const ProfileScreen = ({ navigation }: any) => {
  const { user } = useSelector((state: RootState) => state.auth);
  const { featureLoyalty, featureReferrals } = useSelector((state: RootState) => state.app);
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const isRider = user?.role === 'rider';
  const accent = isRider ? '#FC8019' : '#10B981';
  const accentLight = isRider ? '#FFF3E8' : '#ECFDF5';

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

  const handleLogout = () => {
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
  };

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
              <Text style={styles.editPicText}>EDIT</Text>
            </View>
          </BouncingButton>
          <View style={styles.headerTextCol}>
            <Text style={styles.headerName}>{user?.name || (isRider ? 'Rider' : 'Gourmet')}</Text>
            <Text style={styles.phoneText}>+{user?.phone}</Text>
          </View>
        </Animated.View>

        {/* STATS ROW (Swish Style) */}
        {!isRider && featureReferrals && (
          <Animated.View entering={FadeInDown.delay(120).duration(400)}>
            <BouncingButton style={styles.referralBanner} activeOpacity={0.8} onPress={() => navigation.navigate('Referral')}>
              <View style={styles.referralIconBox}>
                <Gift size={20} color="#FFFFFF" />
              </View>
              <View style={styles.referralTexts}>
                <Text style={styles.referralTitle}>Invite & Earn ₹50</Text>
                <Text style={styles.referralSub}>Get ₹50 for every friend who orders.</Text>
              </View>
              <ChevronRight size={20} color="#FFFFFF" />
            </BouncingButton>
          </Animated.View>
        )}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.statsRow}>
          {isRider ? (
            <>
              <BouncingButton style={styles.statBox} activeOpacity={0.8} onPress={() => navigation.navigate('Payouts')}>
                <Wallet size={20} color="#6B7280" />
                <Text style={styles.statLabel}>Earnings</Text>
                <Text style={styles.statValue}>₹{((riderStats?.totalEarnings ?? 0) / 100).toFixed(0)}</Text>
              </BouncingButton>
              <BouncingButton style={styles.statBox} activeOpacity={0.8} onPress={() => navigation.navigate('RiderHistory')}>
                <Package size={20} color="#6B7280" />
                <Text style={styles.statLabel}>Total Trips</Text>
                <Text style={styles.statValue}>{riderStats?.totalDeliveries || 0}</Text>
              </BouncingButton>
              <BouncingButton style={styles.statBox} activeOpacity={0.8} onPress={() => {}}>
                <Star size={20} color="#F59E0B" />
                <Text style={styles.statLabel}>Rating</Text>
                <Text style={[styles.statValue, { color: '#F59E0B' }]}>{(riderStats?.rating ?? 5.0).toFixed(1)}★</Text>
              </BouncingButton>
            </>
          ) : (
            <>
              <BouncingButton style={[styles.statBox, !featureLoyalty && { flex: 1 }]} activeOpacity={0.8} onPress={() => navigation.navigate('Wallet')}>
                <Wallet size={20} color="#6B7280" />
                <Text style={styles.statLabel}>Wallet Balance</Text>
                <Text style={styles.statValue}>{wallet ? `₹${(wallet.balancePaise / 100).toFixed(2)}` : '₹0.00'}</Text>
              </BouncingButton>
              {featureLoyalty && (
                <BouncingButton style={styles.statBox} activeOpacity={0.8} onPress={() => navigation.navigate('Loyalty')}>
                  <Sparkles size={20} color="#FC4603" />
                  <Text style={styles.statLabel}>Loyalty Points</Text>
                  <Text style={[styles.statValue, { color: '#FC4603' }]}>{loyalty?.points || 0}</Text>
                </BouncingButton>
              )}
            </>
          )}
        </Animated.View>

        {/* RIDER TIER + STREAK CARD */}
        {isRider && (
          <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.tierCard}>
            {/* Tier badge row */}
            <View style={styles.tierRow}>
              <View style={[styles.tierBadge, {
                backgroundColor:
                  riderStats?.tier === 'platinum' ? '#F3E8FF' :
                  riderStats?.tier === 'gold'     ? '#FEF3C7' :
                  riderStats?.tier === 'silver'   ? '#F1F5F9' : '#FFF3E8',
              }]}>
                <Text style={styles.tierEmoji}>
                  {riderStats?.tier === 'platinum' ? '💎' :
                   riderStats?.tier === 'gold'     ? '🥇' :
                   riderStats?.tier === 'silver'   ? '🥈' : '🥉'}
                </Text>
                <Text style={[styles.tierName, {
                  color:
                    riderStats?.tier === 'platinum' ? '#7C3AED' :
                    riderStats?.tier === 'gold'     ? '#D97706' :
                    riderStats?.tier === 'silver'   ? '#64748B' : '#FC8019',
                }]}>
                  {(riderStats?.tier || 'bronze').charAt(0).toUpperCase() + (riderStats?.tier || 'bronze').slice(1)}
                </Text>
              </View>
              {riderStats?.nextTierAt && (
                <Text style={styles.tierNextHint}>
                  {riderStats.nextTierAt - (riderStats.totalDeliveries || 0)} trips to next tier
                </Text>
              )}
              {/* Streak */}
              <View style={styles.streakBadge}>
                <Flame size={14} color={riderStats?.currentStreak > 0 ? '#FC8019' : '#93959F'} />
                <Text style={[styles.streakText, { color: riderStats?.currentStreak > 0 ? '#FC8019' : '#93959F' }]}>
                  {riderStats?.currentStreak || 0} day streak
                </Text>
              </View>
            </View>
            {/* Progress bar to next tier */}
            {riderStats?.nextTierAt && (
              <View style={styles.tierProgressTrack}>
                <View style={[styles.tierProgressFill, {
                  width: `${Math.min(100, Math.round(((riderStats.totalDeliveries || 0) / riderStats.nextTierAt) * 100))}%` as any,
                }]} />
              </View>
            )}
            {/* Acceptance + Completion rate */}
            <View style={styles.perfRow}>
              <View style={styles.perfItem}>
                <TrendingUp size={13} color={
                  (riderStats?.acceptanceRate ?? 100) >= 80 ? '#1BA672' :
                  (riderStats?.acceptanceRate ?? 100) >= 60 ? '#FC8019' : '#EF4444'
                } />
                <Text style={[styles.perfVal, {
                  color:
                    (riderStats?.acceptanceRate ?? 100) >= 80 ? '#1BA672' :
                    (riderStats?.acceptanceRate ?? 100) >= 60 ? '#FC8019' : '#EF4444',
                }]}>{riderStats?.acceptanceRate ?? 100}%</Text>
                <Text style={styles.perfLabel}>Acceptance</Text>
              </View>
              <View style={styles.perfDivider} />
              <View style={styles.perfItem}>
                <Award size={13} color={
                  (riderStats?.completionRate ?? 100) >= 90 ? '#1BA672' :
                  (riderStats?.completionRate ?? 100) >= 70 ? '#FC8019' : '#EF4444'
                } />
                <Text style={[styles.perfVal, {
                  color:
                    (riderStats?.completionRate ?? 100) >= 90 ? '#1BA672' :
                    (riderStats?.completionRate ?? 100) >= 70 ? '#FC8019' : '#EF4444',
                }]}>{riderStats?.completionRate ?? 100}%</Text>
                <Text style={styles.perfLabel}>Completion</Text>
              </View>
              <View style={styles.perfDivider} />
              <View style={styles.perfItem}>
                <Flame size={13} color='#F59E0B' />
                <Text style={[styles.perfVal, { color: '#F59E0B' }]}>{riderStats?.longestStreak || 0}d</Text>
                <Text style={styles.perfLabel}>Best Streak</Text>
              </View>
            </View>
          </Animated.View>
        )}



        {/* ACTIVITY GROUP */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.settingsGroup}>
          <Text style={styles.groupLabel}>{isRider ? 'Fleet Management' : 'Activity'}</Text>
          {isRider ? (
            <>
              <MinimalListItem icon={<ShieldCheck size={22} color="#6B7280" strokeWidth={1.5} />} title="Documents" onPress={() => navigation.navigate('RiderDocuments')} />
              <MinimalListItem icon={<Star size={22} color="#6B7280" strokeWidth={1.5} />} title="Daily Missions" onPress={() => navigation.navigate('RiderMissions')} />
              <MinimalListItem icon={<BarChart2 size={22} color="#6B7280" strokeWidth={1.5} />} title="Weekly Scorecard" subtitle="Your performance this week" onPress={() => navigation.navigate('RiderScorecard')} />
            </>
          ) : (
            <>
              <MinimalListItem icon={<Package size={22} color="#6B7280" strokeWidth={1.5} />} title="Your Orders" onPress={() => navigation.navigate('OrdersTab')} />
              {/* <MinimalListItem icon={<Calendar size={22} color="#6B7280" strokeWidth={1.5} />} title="My Table Bookings" onPress={() => navigation.navigate('MyTableBookings')} /> */}
              <MinimalListItem icon={<MapPin size={22} color="#6B7280" strokeWidth={1.5} />} title="Saved Addresses" onPress={() => navigation.navigate('Address')} />
            </>

          )}
        </Animated.View>

        {/* HELP & SUPPORT GROUP */}
        <Animated.View entering={FadeInDown.delay(400).duration(400)} style={[styles.settingsGroup, { marginBottom: 40 }]}>
          <Text style={styles.groupLabel}>Support</Text>
          <MinimalListItem icon={<Bell size={22} color="#6B7280" strokeWidth={1.5} />} title="Notifications" onPress={() => navigation.navigate(isRider ? 'RiderNotifications' : 'Notifications')} />
          <MinimalListItem icon={<MessageCircle size={22} color="#6B7280" strokeWidth={1.5} />} title="Help & Support" onPress={() => navigation.navigate(isRider ? 'RiderHelp' : 'Help')} />
          <MinimalListItem icon={<LogOut size={22} color="#EF4444" strokeWidth={1.5} />} title="Sign Out" isDestructive={true} onPress={handleLogout} />
        </Animated.View>

        {/* Dev Role Switcher */}
        {__DEV__ && (
            <View style={styles.devCard}>
                <Text style={styles.devHeader}>Developer Role Control</Text>
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
                            <Text style={[styles.devBtnText, user?.role === r ? styles.devBtnTextActive : styles.devBtnTextInactive]}>{r}</Text>
                        </BouncingButton>
                    ))}
                </View>
            </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>2QT v1.0.0 Stable</Text>
        </View>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF', // Pure white Swish style
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  profilePicWrapper: {
    width: 88,
    height: 88,
    backgroundColor: '#FFFFFF',
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    borderColor: '#F3F4F6',
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
    color: '#1A1A2E',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  phoneText: {
    color: '#6B7280',
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
    borderRadius: 16,
    padding: 16,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 12,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A2E',
    marginTop: 4,
  },

  settingsGroup: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  groupLabel: {
    color: '#9CA3AF',
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
    color: '#1A1A2E',
  },
  minimalListSub: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '400',
    marginTop: 2,
  },
  minimalListValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
    marginRight: 8,
  },

  referralWrapper: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  referralCard: {
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  referralIconWrapper: {
    width: 40,
    height: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  referralTextCol: {
    flex: 1,
  },
  referralTitle: {
    color: '#10B981',
    fontWeight: '800',
    fontSize: 15,
  },

  devCard: {
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 20,
    marginBottom: 24,
  },
  devHeader: {
    color: '#1A1A2E',
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
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  devBtnActive: {
    backgroundColor: '#10B981',
  },
  devBtnInactive: {
    backgroundColor: '#F3F4F6',
  },
  devBtnText: {
    fontWeight: '700',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  devBtnTextActive: {
    color: '#FFFFFF',
  },
  devBtnTextInactive: {
    color: '#6B7280',
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
    marginHorizontal: 16, marginBottom: 12, backgroundColor: '#FFFFFF',
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
    height: 5, backgroundColor: '#FC8019', borderRadius: 3,
  },
  perfRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8F8F8', borderRadius: 14, padding: 12,
  },
  perfItem: { flex: 1, alignItems: 'center', gap: 3 },
  perfVal: { fontSize: 15, fontWeight: '800' },
  perfLabel: { fontSize: 10, color: '#93959F', fontWeight: '600' },
  perfDivider: { width: 1, height: 32, backgroundColor: '#E9E9EB' },
});

export default ProfileScreen;
