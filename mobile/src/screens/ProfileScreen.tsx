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
  Bell
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
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const isRider = user?.role === 'rider';

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
              <User size={32} color="#10B981" />
            )}
            <View style={styles.editPicBadge}>
              <Text style={styles.editPicText}>EDIT</Text>
            </View>
          </BouncingButton>
          <View style={styles.headerTextCol}>
            <Text style={styles.headerName}>{user?.name || (isRider ? 'Rider' : 'Gourmet')}</Text>
            <Text style={styles.phoneText}>+{user?.phone}</Text>
          </View>
        </Animated.View>

        {/* STATS ROW (Swish Style) */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.statsRow}>
          {isRider ? (
            <>
              <BouncingButton style={styles.statBox} activeOpacity={0.8} onPress={() => navigation.navigate('RiderPayouts')}>
                <Wallet size={20} color="#6B7280" />
                <Text style={styles.statLabel}>Earnings</Text>
                <Text style={styles.statValue}>₹{((riderStats?.totalEarnings ?? 0) / 100).toFixed(2)}</Text>
              </BouncingButton>
              <BouncingButton style={styles.statBox} activeOpacity={0.8} onPress={() => navigation.navigate('TripHistory')}>
                <Package size={20} color="#6B7280" />
                <Text style={styles.statLabel}>Total Trips</Text>
                <Text style={styles.statValue}>{riderStats?.totalDeliveries || 0}</Text>
              </BouncingButton>
            </>
          ) : (
            <>
              <BouncingButton style={styles.statBox} activeOpacity={0.8} onPress={() => navigation.navigate('Wallet')}>
                <Wallet size={20} color="#6B7280" />
                <Text style={styles.statLabel}>Wallet Balance</Text>
                <Text style={styles.statValue}>{wallet ? `₹${(wallet.balancePaise / 100).toFixed(2)}` : '₹0.00'}</Text>
              </BouncingButton>
              <BouncingButton style={styles.statBox} activeOpacity={0.8} onPress={() => navigation.navigate('Loyalty')}>
                <Star size={20} color="#6B7280" />
                <Text style={styles.statLabel}>Loyalty Points</Text>
                <Text style={styles.statValue}>{loyalty?.points || 0}</Text>
              </BouncingButton>
            </>
          )}
        </Animated.View>

        {/* REFERRAL CARD (MINIMAL) */}
        {!isRider && (
          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.referralWrapper}>
            <BouncingButton 
              activeOpacity={0.9}
              style={styles.referralCard}
              onPress={() => {
                ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
                navigation.navigate('Referral');
              }}
            >
              <View style={styles.referralIconWrapper}>
                <Gift size={20} color="#10B981" />
              </View>
              <View style={styles.referralTextCol}>
                <Text style={styles.referralTitle}>Invite & Earn ₹50</Text>
              </View>
              <ChevronRight size={18} color="#10B981" />
            </BouncingButton>
          </Animated.View>
        )}

        {/* ACTIVITY GROUP */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.settingsGroup}>
          <Text style={styles.groupLabel}>{isRider ? 'Fleet Management' : 'Activity'}</Text>
          {isRider ? (
            <>
              <MinimalListItem icon={<ShieldCheck size={22} color="#6B7280" strokeWidth={1.5} />} title="Documents" onPress={() => navigation.navigate('Documents')} />
            </>
          ) : (
            <>
              <MinimalListItem icon={<Package size={22} color="#6B7280" strokeWidth={1.5} />} title="Your Orders" onPress={() => navigation.navigate('OrdersTab')} />
              <MinimalListItem icon={<MapPin size={22} color="#6B7280" strokeWidth={1.5} />} title="Saved Addresses" onPress={() => navigation.navigate('AddressBook')} />
              <MinimalListItem icon={<Calendar size={22} color="#6B7280" strokeWidth={1.5} />} title="Meal Subscriptions" onPress={() => navigation.navigate('MyPlans')} />
            </>
          )}
        </Animated.View>

        {/* HELP & SUPPORT GROUP */}
        <Animated.View entering={FadeInDown.delay(400).duration(400)} style={[styles.settingsGroup, { marginBottom: 40 }]}>
          <Text style={styles.groupLabel}>Support</Text>
          <MinimalListItem icon={<Bell size={22} color="#6B7280" strokeWidth={1.5} />} title="Notifications" onPress={() => navigation.navigate('Notifications')} />
          <MinimalListItem icon={<MessageCircle size={22} color="#6B7280" strokeWidth={1.5} />} title="Help & Support" onPress={() => navigation.navigate('Help')} />
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
    backgroundColor: '#10B981',
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
    backgroundColor: '#ECFDF5',
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
});

export default ProfileScreen;
