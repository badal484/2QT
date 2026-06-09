import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { api } from '../../api/client';
import { SafeAreaView } from 'react-native-safe-area-context';
import { logout } from '../../store/slices/authSlice';
import { 
  TrendingUp, 
  ShoppingBag, 
  Users, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight,
  LogOut,
  ChevronRight,
  Zap,
  Layers,
  Heart,
  Box,
  LayoutDashboard,
  IndianRupee
} from 'lucide-react-native';

const { width } = Dimensions.get('window');

const MetricCard = ({ title, value, trend, icon: Icon, color }: any) => (
  <View style={[styles.metricCard, { borderColor: '#f3f4f6' }]}>
    <View style={styles.metricHeader}>
      <View style={[styles.iconContainer, { backgroundColor: color }]}>
        <Icon size={20} color={color.includes('orange') ? '#FF6B35' : '#1A1A2E'} />
      </View>
      {trend && (
        <View style={[styles.trendBadge, { backgroundColor: trend > 0 ? 'rgba(0, 208, 132, 0.1)' : 'rgba(255, 75, 75, 0.1)' }]}>
          {trend > 0 ? <ArrowUpRight size={10} color="#00D084" /> : <ArrowDownRight size={10} color="#FF4B4B" />}
          <Text style={[styles.trendText, { color: trend > 0 ? '#00D084' : '#FF4B4B' }]}>
            {Math.abs(trend)}%
          </Text>
        </View>
      )}
    </View>
    <Text style={styles.metricTitle}>{title}</Text>
    <Text style={styles.metricValue}>{value}</Text>
  </View>
);

const NavItem = ({ title, sub, icon: Icon, onPress, color = "#f9fafb" }: any) => (
  <TouchableOpacity 
    activeOpacity={0.9}
    style={[styles.navItem, { backgroundColor: color }]}
    onPress={onPress}
  >
    <View style={styles.navItemLeft}>
      <View style={styles.navIconContainer}>
        <Icon size={22} color="#1A1A2E" />
      </View>
      <View style={styles.navTextContainer}>
        <Text style={styles.navTitle}>{title}</Text>
        <Text style={styles.navSub}>{sub}</Text>
      </View>
    </View>
    <ChevronRight size={18} color="#D1D5DB" />
  </TouchableOpacity>
);

const DashboardScreen = ({ navigation }: any) => {
  const dispatch = useDispatch();
  const { data: stats, isLoading, isError, error } = useQuery({
    queryKey: ['admin-dashboard-stats'],
    queryFn: async () => {
      console.log('--- DASHBOARD: FETCHING STATS ---');
      const res = await api.get('/admin/dashboard');
      console.log('--- DASHBOARD: STATS RECEIVED:', res);
      return res;
    },
    refetchInterval: 10000,
    retry: 3,
  });

  console.log('--- DASHBOARD RENDER:', { isLoading, isError, statsAvailable: !!stats });

  if (isLoading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FF6B35" />
      <Text style={styles.loadingText}>Initializing Ops Deck</Text>
    </View>
  );

  if (isError) {
    console.error('--- DASHBOARD ERROR:', error);
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>2QT Ops</Text>
          </View>
        </View>
        <View style={styles.errorContainer}>
          <AlertTriangle size={48} color="#FF4B4B" />
          <Text style={styles.errorTitle}>System Offline</Text>
          <Text style={styles.errorSub}>Unable to establish secure uplink with control center.</Text>
          <TouchableOpacity 
            onPress={() => dispatch(logout())}
            style={styles.restartButton}
          >
              <Text style={styles.restartButtonText}>Restart Session</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Systematic fallback for empty/undefined stats
  const activeOrders = stats?.activeOrders ?? 0;
  const todayRevenuePaise = stats?.todayRevenuePaise ?? 0;
  const ridersOnline = stats?.ridersOnline ?? 0;
  const lowStockAlerts = stats?.lowStockAlerts ?? 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Premium Header */}
      <View style={styles.header}>
        <View>
          <View style={styles.statusIndicator}>
             <View style={styles.statusDot} />
             <Text style={styles.statusText}>System Status: Operational</Text>
          </View>
          <Text style={styles.headerTitle}>2QT Ops</Text>
        </View>
        
        <TouchableOpacity 
          activeOpacity={0.7}
          style={styles.logoutButton}
          onPress={() => dispatch(logout())}
        >
          <LogOut size={20} color="#999" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Performance Graph Section */}
        <View style={styles.graphCard}>
          <View style={styles.graphHeader}>
            <View>
              <Text style={styles.graphLabel}>Performance</Text>
              <Text style={styles.graphValue}>₹{(todayRevenuePaise / 100).toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.liveFlowBadge}>
              <Text style={styles.liveFlowText}>Live Flow</Text>
            </View>
          </View>
          
          <View style={styles.barsContainer}>
            {[30, 45, 35, 60, 55, 80, 40, 95, 70, 85, 65, 90].map((h, i) => (
              <View key={i} style={styles.barWrapper}>
                 <View 
                  style={[styles.bar, { height: `${h}%`, backgroundColor: i === 11 ? '#FF6B35' : 'rgba(255,255,255,0.1)' }]} 
                />
              </View>
            ))}
          </View>
          
          <View style={styles.graphFooter}>
             <View style={styles.activeMissions}>
                <Zap size={12} color="#FF6B35" />
                <Text style={styles.activeMissionsText}>{activeOrders} Active Missions</Text>
             </View>
             <Text style={styles.trendGreenText}>+12% vs Yesterday</Text>
          </View>
        </View>

        {/* Real-time Grid */}
        <View style={styles.metricsGrid}>
          <MetricCard 
            title="Live Orders" 
            value={activeOrders} 
            trend={8.2}
            icon={ShoppingBag}
            color="#eff6ff"
          />
          <MetricCard 
            title="Online Pilots" 
            value={ridersOnline} 
            trend={-2.4}
            icon={Users}
            color="#f5f3ff"
          />
          <MetricCard 
            title="Stock Alerts" 
            value={lowStockAlerts} 
            trend={100}
            icon={Box}
            color="#fef2f2"
          />
          <MetricCard 
            title="Efficiency" 
            value="94%" 
            trend={1.2}
            icon={TrendingUp}
            color="rgba(255, 107, 53, 0.1)"
          />
        </View>

        {/* Management Clusters */}
        <View style={styles.managementSection}>
          <Text style={styles.sectionHeader}>Mission Control</Text>
          
          <NavItem 
            title="Pipeline Control" 
            sub="Manage active kitchen & delivery flows" 
            icon={Layers} 
            onPress={() => navigation.navigate('Orders')} 
          />
          <NavItem 
            title="Fleet Management" 
            sub="Directory and status of all pilots" 
            icon={Users} 
            onPress={() => navigation.navigate('UserManagement')} 
          />
          <NavItem 
            title="Catalog Manager" 
            sub="Update menu items and availability" 
            icon={LayoutDashboard} 
            onPress={() => navigation.navigate('MenuManager')} 
          />
          <NavItem 
            title="Supply Chain" 
            sub="Monitor and update stock levels" 
            icon={Box} 
            onPress={() => navigation.navigate('Stock')} 
          />
          <NavItem 
            title="Settlement Hub" 
            sub="Financial payouts and approvals" 
            icon={IndianRupee} 
            onPress={() => navigation.navigate('Payouts')} 
          />
          <NavItem 
            title="Resolution Hub" 
            sub="Handle customer support tickets" 
            icon={Heart} 
            onPress={() => navigation.navigate('Support')} 
          />
          <NavItem 
            title="Push Broadcast" 
            sub="Send alerts to customers & riders" 
            icon={Zap} 
            onPress={() => navigation.navigate('Broadcast')} 
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#9ca3af',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 10,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    color: '#1A1A2E',
    fontWeight: '900',
    fontSize: 20,
    marginTop: 24,
    textAlign: 'center',
  },
  errorSub: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  restartButton: {
    marginTop: 32,
    backgroundColor: '#1A1A2E',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
  },
  restartButtonText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  header: {
    paddingHorizontal: 32,
    paddingTop: 16,
    paddingBottom: 24,
    flexDirection: 'row',
    justifyContent: 'between',
    alignItems: 'center',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    backgroundColor: '#00D084',
    borderRadius: 3,
    marginRight: 8,
  },
  statusText: {
    color: '#9ca3af',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 3,
  },
  headerTitle: {
    color: '#1A1A2E',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
  },
  logoutButton: {
    width: 48,
    height: 48,
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 100,
  },
  graphCard: {
    backgroundColor: '#1A1A2E',
    padding: 32,
    borderRadius: 48,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 10,
  },
  graphHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
  },
  graphLabel: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 4,
    marginBottom: 8,
  },
  graphValue: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
  },
  liveFlowBadge: {
    backgroundColor: 'rgba(0, 208, 132, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 208, 132, 0.2)',
  },
  liveFlowText: {
    color: '#00D084',
    fontWeight: '900',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 96,
    paddingHorizontal: 4,
  },
  barWrapper: {
    alignItems: 'center',
  },
  bar: {
    width: 6,
    borderRadius: 3,
  },
  graphFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    paddingTop: 16,
  },
  activeMissions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeMissionsText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9,
    fontWeight: '900',
    marginLeft: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  trendGreenText: {
    color: '#00D084',
    fontWeight: '900',
    fontSize: 9,
    textTransform: 'uppercase',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 32,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  trendText: {
    fontSize: 9,
    fontWeight: '900',
    marginLeft: 4,
  },
  metricTitle: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 4,
  },
  metricValue: {
    color: '#1A1A2E',
    fontSize: 24,
    fontWeight: '900',
  },
  managementSection: {
    marginTop: 32,
    marginBottom: 48,
  },
  sectionHeader: {
    color: '#1A1A2E',
    fontWeight: '900',
    textTransform: 'uppercase',
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  navItem: {
    padding: 24,
    borderRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    marginBottom: 16,
  },
  navItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navIconContainer: {
    width: 48,
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
  },
  navTextContainer: {
    marginLeft: 16,
  },
  navTitle: {
    color: '#1A1A2E',
    fontWeight: '900',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  navSub: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
});

export default DashboardScreen;
