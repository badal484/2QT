import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { useDispatch } from 'react-redux';
import { logout } from '../store/slices/authSlice';
import { ShieldCheck, Clock, PhoneCall, LogOut } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const VerificationPendingScreen = () => {
  const dispatch = useDispatch();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.content}>
        <View style={styles.card}>
          <View style={styles.iconWrapper}>
            <ShieldCheck size={48} color="#FF6B35" />
          </View>
          
          <Text style={styles.title}>Verification Pending</Text>
          <Text style={styles.description}>
            Your Captain profile is currently under review by our operations team. This typically takes 24-48 hours.
          </Text>

          <View style={styles.infoBox}>
            <Clock size={20} color="#1A1A2E" style={{ marginRight: 12 }} />
            <Text style={styles.infoText}>Estimated wait: 1 business day</Text>
          </View>

          <TouchableOpacity 
            style={styles.contactBtn}
            onPress={() => {/* Open support */}}
          >
            <PhoneCall size={20} color="#fff" style={{ marginRight: 12 }} />
            <Text style={styles.contactText}>Contact Support</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.logoutBtn}
          onPress={() => dispatch(logout())}
        >
          <LogOut size={20} color="#9CA3AF" style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
    padding: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 40,
    padding: 40,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.1,
    shadowRadius: 30,
    elevation: 10,
  },
  iconWrapper: {
    width: 96,
    height: 96,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1A1A2E',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 20,
    width: '100%',
    marginBottom: 32,
  },
  infoText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  contactBtn: {
    backgroundColor: '#1A1A2E',
    flexDirection: 'row',
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  contactText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  logoutBtn: {
    marginTop: 40,
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoutText: {
    color: '#9CA3AF',
    fontWeight: '900',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
});

export default VerificationPendingScreen;
