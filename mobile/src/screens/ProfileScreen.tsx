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

const MinimalListItem = ({ icon, title, value, onPress, subtitle, color = "#1A1A2E", hideBorder = false }: any) => (
  <TouchableOpacity 
    activeOpacity={0.7}
    style={[styles.minimalListItem, hideBorder && { borderBottomWidth: 0 }]}
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
        <Text style={[styles.minimalListTitle, { color }]}>{title}</Text>
        {subtitle && <Text style={styles.minimalListSub}>{subtitle}</Text>}
      </View>
    </View>
    <View style={styles.minimalListRight}>
      {value !== undefined && value !== null && value !== '' && (
        <Text style={styles.minimalListValue}>{value}</Text>
      )}
      <ChevronRight size={18} color="#D1D5DB" />
    </View>
  </TouchableOpacity>
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
          <TouchableOpacity 
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
          </TouchableOpacity>
          <View style={styles.headerTextCol}>
            <Text style={styles.headerName}>{user?.name || (isRider ? 'Rider' : 'Gourmet')}</Text>
            <Text style={styles.phoneText}>+{user?.phone}</Text>
          </View>
        </Animated.View>

        {/* ACCOUNT SETTINGS GROUP */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.settingsGroup}>
          {isRider ? (
            <>
              <MinimalListItem icon={<Wallet size={20} color="#10B981" />} title="Earnings" value={`₹${(riderStats?.totalEarnings || 0) / 100}`} onPress={() => navigation.navigate('RiderPayouts')} />
              <MinimalListItem icon={<Package size={20} color="#6B7280" />} title="Total Trips" value={riderStats?.totalDeliveries || 0} onPress={() => navigation.navigate('TripHistory')} hideBorder={true} />
            </>
          ) : (
            <>
              <MinimalListItem icon={<Wallet size={20} color="#10B981" />} title="Wallet Balance" value={`₹${wallet?.balancePaise / 100 || '0.00'}`} onPress={() => navigation.navigate('Wallet')} />
              <MinimalListItem icon={<Star size={20} color="#F59E0B" />} title="Loyalty Points" value={loyalty?.points || 0} onPress={() => navigation.navigate('Loyalty')} hideBorder={true} />
            </>
          )}
        </Animated.View>

        {/* REFERRAL CARD (MINIMAL) */}
        {!isRider && (
          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.referralWrapper}>
            <TouchableOpacity 
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
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ACTIVITY GROUP */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.settingsGroup}>
          <Text style={styles.groupLabel}>{isRider ? 'FLEET MANAGEMENT' : 'ACTIVITY'}</Text>
          {isRider ? (
            <>
              <MinimalListItem icon={<ShieldCheck size={20} color="#1A1A2E" />} title="Documents" onPress={() => navigation.navigate('Documents')} hideBorder={true} />
            </>
          ) : (
            <>
              <MinimalListItem icon={<Package size={20} color="#1A1A2E" />} title="Your Orders" onPress={() => navigation.navigate('OrdersTab')} />
              <MinimalListItem icon={<MapPin size={20} color="#1A1A2E" />} title="Saved Addresses" onPress={() => navigation.navigate('AddressBook')} />
              <MinimalListItem icon={<Calendar size={20} color="#1A1A2E" />} title="Meal Subscriptions" onPress={() => navigation.navigate('MyPlans')} hideBorder={true} />
            </>
          )}
        </Animated.View>

        {/* HELP & SUPPORT GROUP */}
        <Animated.View entering={FadeInDown.delay(400).duration(400)} style={[styles.settingsGroup, { marginBottom: 40 }]}>
          <Text style={styles.groupLabel}>SUPPORT</Text>
          <MinimalListItem icon={<Bell size={20} color="#6366F1" />} title="Notifications" onPress={() => navigation.navigate('Notifications')} />
          <MinimalListItem icon={<MessageCircle size={20} color="#1A1A2E" />} title="Help Center" onPress={() => navigation.navigate('Help')} />
          <MinimalListItem icon={<LogOut size={20} color="#EF4444" />} title="Sign Out" color="#EF4444" onPress={handleLogout} hideBorder={true} />
        </Animated.View>

        {/* Dev Role Switcher */}
        {__DEV__ && (
            <View style={styles.devCard}>
                <Text style={styles.devHeader}>Developer Role Control</Text>
                <View style={styles.devBtnRow}>
                    {['customer', 'rider', 'chef', 'super_admin'].map(r => (
                        <TouchableOpacity 
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
                        </TouchableOpacity>
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
    backgroundColor: '#F3F4F6', // iOS-style very light grey background
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 32,
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
    borderRadius: 12,
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

  settingsGroup: {
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 24,
  },
  groupLabel: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 8,
    marginLeft: 4,
  },
  minimalListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
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
  },
  minimalListTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  minimalListSub: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  minimalListValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6B7280',
    marginRight: 8,
  },

  referralWrapper: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  referralCard: {
    backgroundColor: '#ECFDF5',
    padding: 16,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  referralIconWrapper: {
    width: 40,
    height: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
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
    borderRadius: 10,
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
