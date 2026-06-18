import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, Linking, ActivityIndicator, Alert } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { logout, updateUser } from '../store/slices/authSlice';
import { RootState } from '../store';
import { api } from '../api/client';
import { ShieldAlert, Clock, PhoneCall, LogOut, RefreshCw, CheckCircle2, Lock, ShieldCheck } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const VerificationPendingScreen = () => {
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  const [checking, setChecking] = useState(false);

  const checkStatus = async () => {
    try {
      setChecking(true);
      const res = await api.get('/customers/me');
      if (res.user) {
        dispatch(updateUser(res.user));
        if (res.user.is_verified) {
          Alert.alert('Clearance Activated', 'Your account has been verified! Welcome to the squad, Captain.');
        } else {
          Alert.alert('Audit In Progress', 'Operations audit is still underway. This typically takes 24-48 hours. Thank you for your patience.');
        }
      } else {
        throw new Error('User data not found');
      }
    } catch (err: any) {
      Alert.alert('Sync Failed', err.message || 'Unable to contact verification server. Please check your connection.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.content}>
        
        {/* Terminal Header */}
        <View style={styles.header}>
          <Text style={styles.terminalLabel}>COMMAND HUD // AUTH_AUDIT</Text>
          <Text style={styles.headerTitle}>SECURITY AUDIT</Text>
        </View>

        {/* Status Graphic Card */}
        <View style={styles.card}>
          <View style={styles.iconWrapper}>
            <ShieldAlert size={40} color="#FF6B35" />
          </View>
          
          <Text style={styles.title}>Clearance Pending</Text>
          <Text style={styles.description}>
            Your Captain credentials are currently undergoing operational review. We are validating database registry details and zone dispatch slots.
          </Text>

          {/* Verification Audit Steps Timeline */}
          <View style={styles.timeline}>
            
            {/* Step 1 */}
            <View style={styles.timelineItem}>
              <View style={[styles.timelineNode, styles.timelineNodeSuccess]}>
                <CheckCircle2 size={14} color="#22C55E" />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Captain Registry</Text>
                <Text style={styles.timelineDesc}>Profile created & identity submitted successfully.</Text>
              </View>
            </View>

            <View style={[styles.timelineLine, styles.timelineLineSuccess]} />

            {/* Step 2 */}
            <View style={styles.timelineItem}>
              <View style={[styles.timelineNode, styles.timelineNodeActive]}>
                <Clock size={14} color="#FF6B35" />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitleActive}>Credentials Verification</Text>
                <Text style={styles.timelineDescActive}>Verification of driver licence and active vehicle protocol details.</Text>
              </View>
            </View>

            <View style={styles.timelineLine} />

            {/* Step 3 */}
            <View style={styles.timelineItem}>
              <View style={styles.timelineNode}>
                <Lock size={12} color="#475569" />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitleDisabled}>Clearance Activation</Text>
                <Text style={styles.timelineDescDisabled}>Unlocks the active dispatch interface & mission accept keys.</Text>
              </View>
            </View>
            
          </View>

          {/* Action Row */}
          <TouchableOpacity 
            style={styles.checkBtn}
            onPress={checkStatus}
            disabled={checking}
          >
            {checking ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <View style={styles.btnContent}>
                <RefreshCw size={16} color="white" style={{ marginRight: 8 }} />
                <Text style={styles.checkText}>Verify Audit Status</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Support Section */}
        <View style={styles.supportCard}>
          <View style={styles.supportInfo}>
            <Text style={styles.supportLabel}>NEED QUICK CLEARANCE?</Text>
            <Text style={styles.supportTitle}>Operations Support Desk</Text>
          </View>
          <TouchableOpacity 
            style={styles.contactBtn}
            onPress={() => {
              Linking.openURL('https://wa.me/919999999999?text=Hi%202QT%20Support%2C%20I%20am%20a%20Rider%20waiting%20for%20my%20account%20verification.');
            }}
          >
            <PhoneCall size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.logoutBtn}
          onPress={() => dispatch(logout())}
        >
          <LogOut size={16} color="#64748B" style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>Abort & Sign Out</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0C10',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  terminalLabel: {
    color: '#FF6B35',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 4,
    letterSpacing: -0.5,
  },
  card: {
    backgroundColor: '#161726',
    borderRadius: 36,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 8,
  },
  iconWrapper: {
    width: 76,
    height: 76,
    backgroundColor: 'rgba(255, 107, 53, 0.08)',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.15)',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 10,
  },
  description: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  timeline: {
    width: '100%',
    marginBottom: 28,
    paddingHorizontal: 4,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  timelineNode: {
    width: 28,
    height: 28,
    backgroundColor: '#1E2035',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  timelineNodeSuccess: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderColor: 'rgba(34, 197, 94, 0.25)',
  },
  timelineNodeActive: {
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderColor: 'rgba(255, 107, 53, 0.25)',
  },
  timelineContent: {
    flex: 1,
    marginLeft: 16,
    paddingBottom: 16,
  },
  timelineTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#E2E8F0',
  },
  timelineTitleActive: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FF6B35',
  },
  timelineTitleDisabled: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
  },
  timelineDesc: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 14,
  },
  timelineDescActive: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
    lineHeight: 14,
  },
  timelineDescDisabled: {
    fontSize: 10,
    color: '#334155',
    marginTop: 2,
    lineHeight: 14,
  },
  timelineLine: {
    width: 2,
    height: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginLeft: 13,
    marginTop: -16,
    marginBottom: 4,
  },
  timelineLineSuccess: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  checkBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  supportCard: {
    flexDirection: 'row',
    backgroundColor: '#161726',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  supportInfo: {
    flex: 1,
  },
  supportLabel: {
    color: '#FF6B35',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  supportTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  contactBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#FF6B35',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  logoutBtn: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  logoutText: {
    color: '#64748B',
    fontWeight: '800',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
});

export default VerificationPendingScreen;
