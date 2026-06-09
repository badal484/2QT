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
  ShieldCheck
} from 'lucide-react-native';
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Image, StyleSheet } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RootState } from '../store';
import { logout } from '../store/slices/authSlice';
import { disconnectSocket } from '../socket/client';
import { api } from '../api/client';

const MenuItem = ({ icon, title, onPress, subtitle }: any) => (
  <TouchableOpacity 
    activeOpacity={0.7}
    style={styles.menuItem}
    onPress={onPress}
  >
    <View style={styles.menuItemLeft}>
      <View style={styles.menuItemIconWrapper}>
        {icon}
      </View>
      <View>
        <Text style={styles.menuItemTitle}>{title}</Text>
        {subtitle && <Text style={styles.menuItemSub}>{subtitle}</Text>}
      </View>
    </View>
    <ChevronRight size={20} color="#D1D5DB" />
  </TouchableOpacity>
);

const ProfileScreen = ({ navigation }: any) => {
  const { user } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
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
      {/* Premium Header Card */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerTitleCol}>
            <Text style={styles.headerSubText}>{isRider ? 'Fleet Personnel' : 'Welcome back,'}</Text>
            <Text style={styles.headerMainText}>{user?.name?.split(' ')[0] || (isRider ? 'Rider' : 'Gourmet')}</Text>
            <View style={styles.phoneBadge}>
              <View style={[styles.statusDot, { backgroundColor: isRider ? '#10B981' : '#FF6B35' }]} />
              <Text style={styles.phoneText}>+{user?.phone}</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.profilePicWrapper}
            onPress={() => navigation.navigate('EditProfile')}
          >
            {user?.photo_url ? (
              <Image source={{ uri: user.photo_url }} style={styles.profilePic} />
            ) : (
              <User size={32} color="white" opacity={0.3} />
            )}
            <View style={styles.editPicOverlay}>
              <Text style={styles.editPicText}>Edit</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Balance Cards */}
        <View style={styles.balanceRow}>
          {isRider ? (
            <>
              <View style={[styles.balanceCard, styles.whiteCard]}>
                <View style={[styles.balanceIconWrapper, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                  <Package size={24} color="#10B981" />
                </View>
                <Text style={styles.balanceCardLabel}>Trips</Text>
                <Text style={styles.balanceCardValue}>{riderStats?.totalDeliveries || 0}</Text>
              </View>
              <View style={[styles.balanceCard, styles.greenCard]}>
                <View style={styles.balanceIconWrapperGlass}>
                  <CreditCard size={16} color="white" />
                </View>
                <Text style={styles.balanceCardLabelWhite}>Earnings</Text>
                <Text style={styles.balanceCardValueWhite}>₹{(riderStats?.totalEarnings || 0) / 100}</Text>
              </View>
            </>
          ) : (
            <>
              <TouchableOpacity 
                activeOpacity={0.9}
                style={[styles.balanceCard, styles.whiteCard]}
                onPress={() => navigation.navigate('Wallet')}
              >
                <View style={[styles.balanceIconWrapper, { backgroundColor: '#f9fafb' }]}>
                  <CreditCard size={24} color="#1A1A2E" />
                </View>
                <Text style={styles.balanceCardLabel}>Balance</Text>
                <Text style={styles.balanceCardValue}>₹{wallet?.balancePaise / 100 || '0.00'}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                activeOpacity={0.9}
                style={[styles.balanceCard, styles.orangeCard]}
                onPress={() => navigation.navigate('Loyalty')}
              >
                <View style={styles.balanceIconWrapperGlass}>
                  <Star size={16} color="white" />
                </View>
                <Text style={styles.balanceCardLabelWhite}>Loyalty</Text>
                <Text style={styles.balanceCardValueWhite}>{loyalty?.points || 0}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {!isRider && (
          <TouchableOpacity 
            activeOpacity={0.9}
            style={styles.referralCard}
            onPress={() => navigation.navigate('Referral')}
          >
            <View style={styles.referralTextCol}>
              <Text style={styles.referralTitle}>Earn Rewards</Text>
              <Text style={styles.referralSub}>Get ₹50 for every friend who joins the Velto community.</Text>
            </View>
            <View style={styles.referralIconWrapper}>
              <Gift size={32} color="#FF6B35" />
            </View>
          </TouchableOpacity>
        )}

        <Text style={styles.sectionLabel}>
            {isRider ? 'Fleet Management' : 'Personal Settings'}
        </Text>
        
        {isRider ? (
          <>
            <MenuItem icon={<Package size={22} color="#1A1A2E" />} title="Trip History" subtitle="Your Deliveries" onPress={() => navigation.navigate('TripHistory')} />
            <MenuItem icon={<CreditCard size={22} color="#1A1A2E" />} title="Payouts" subtitle="Weekly Settlements" onPress={() => navigation.navigate('RiderPayouts')} />
            <MenuItem icon={<ShieldCheck size={22} color="#1A1A2E" />} title="Fleet Documents" subtitle="Compliance Status" onPress={() => navigation.navigate('Documents')} />
          </>
        ) : (
          <>
            <MenuItem icon={<Package size={22} color="#1A1A2E" />} title="Order History" subtitle="Your Past Cravings" onPress={() => navigation.navigate('OrdersTab')} />
            <MenuItem icon={<MapPin size={22} color="#1A1A2E" />} title="Saved Addresses" subtitle="Home, Office & More" onPress={() => navigation.navigate('AddressBook')} />
            <MenuItem icon={<Calendar size={22} color="#1A1A2E" />} title="Meal Plans" subtitle="Active Subscriptions" onPress={() => navigation.navigate('MyPlans')} />
          </>
        )}
        
        <MenuItem icon={<MessageCircle size={22} color="#1A1A2E" />} title="Support" subtitle="Help & FAQs" onPress={() => navigation.navigate('Support')} />
        
        <TouchableOpacity 
          style={styles.logoutBtn}
          onPress={handleLogout}
        >
          <LogOut size={22} color="#EF4444" />
          <Text style={styles.logoutBtnText}>Sign Out</Text>
        </TouchableOpacity>

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
          <Text style={styles.footerText}>Velto v1.0.0 Stable</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingTop: 80,
    paddingHorizontal: 32,
    paddingBottom: 40,
    backgroundColor: '#1A1A2E',
    borderBottomLeftRadius: 48,
    borderBottomRightRadius: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 10,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleCol: {
    flex: 1,
    marginRight: 16,
  },
  headerSubText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  headerMainText: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '900',
    marginTop: 8,
  },
  phoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  phoneText: {
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 1,
  },
  profilePicWrapper: {
    width: 80,
    height: 80,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  profilePic: {
    width: '100%',
    height: '100%',
  },
  editPicOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingVertical: 4,
  },
  editPicText: {
    fontSize: 8,
    color: '#fff',
    fontWeight: '900',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  balanceRow: {
    flexDirection: 'row',
    marginTop: 40,
    justifyContent: 'space-between',
  },
  balanceCard: {
    width: '48%',
    padding: 24,
    borderRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  whiteCard: {
    backgroundColor: '#fff',
  },
  greenCard: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOpacity: 0.3,
  },
  orangeCard: {
    backgroundColor: '#FF6B35',
    shadowColor: '#FF6B35',
    shadowOpacity: 0.3,
  },
  balanceIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  balanceIconWrapperGlass: {
    width: 32,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  balanceCardLabel: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  balanceCardValue: {
    color: '#1A1A2E',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 4,
  },
  balanceCardLabelWhite: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  balanceCardValueWhite: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },
  referralCard: {
    backgroundColor: 'rgba(255, 107, 53, 0.05)',
    padding: 24,
    borderRadius: 32,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  referralTextCol: {
    flex: 1,
    marginRight: 16,
  },
  referralTitle: {
    color: '#FF6B35',
    fontWeight: '900',
    fontSize: 20,
  },
  referralSub: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    lineHeight: 20,
  },
  referralIconWrapper: {
    width: 64,
    height: 64,
    backgroundColor: '#fff',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  sectionLabel: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 24,
    marginLeft: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    backgroundColor: '#fff',
    borderRadius: 32,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f9fafb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemIconWrapper: {
    width: 48,
    height: 48,
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  menuItemTitle: {
    color: '#1A1A2E',
    fontSize: 17,
    fontWeight: '900',
  },
  menuItemSub: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginTop: 4,
    letterSpacing: 1,
  },
  logoutBtn: {
    backgroundColor: '#FEF2F2',
    padding: 24,
    borderRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    marginTop: 16,
  },
  logoutBtnText: {
    color: '#EF4444',
    fontWeight: '900',
    marginLeft: 16,
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 12,
  },
  devCard: {
    marginTop: 48,
    backgroundColor: '#f9fafb',
    padding: 32,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  devHeader: {
    color: '#1A1A2E',
    fontWeight: '900',
    marginBottom: 24,
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 10,
  },
  devBtnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  devBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  devBtnActive: {
    backgroundColor: '#FF6B35',
  },
  devBtnInactive: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  devBtnText: {
    fontWeight: '700',
    fontSize: 9,
    textTransform: 'uppercase',
  },
  devBtnTextActive: {
    color: '#fff',
  },
  devBtnTextInactive: {
    color: '#9ca3af',
  },
  footer: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 32,
  },
  footerText: {
    color: '#d1d5db',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 3,
  },
});

export default ProfileScreen;
