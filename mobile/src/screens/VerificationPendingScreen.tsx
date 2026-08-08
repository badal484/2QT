import { tokens } from '../theme/tokens';
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
  Linking, ActivityIndicator, Alert,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { logout, updateUser } from '../store/slices/authSlice';
import { RootState } from '../store';
import { api } from '../api/client';
import {
  ShieldCheck, Clock, PhoneCall, LogOut,
  RefreshCw, CheckCircle2, Lock,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFeedback } from '../context/FeedbackContext';

const R = {
  orange: '#FC4603', orangeLight: '#FFF0E8',
  green: '#1BA672', greenLight: '#E8F8F1',
  amber: '#F59E0B', amberLight: 'rgba(245,158,11,0.08)',
  ink: '#282C3F', gray: '#686B78', muted: '#93959F',
  border: '#E9E9EB', bg: '#F8F8F8', white: tokens.colors.surface,
};

const VerificationPendingScreen = () => {
  const dispatch = useDispatch();
  const { showDialog } = useFeedback();
  const user = useSelector((state: RootState) => state.auth.user);
  const [checking, setChecking] = useState(false);

  const checkStatus = async () => {
    try {
      setChecking(true);
      const res = await api.get('/customers/me');
      if (res.user) {
        dispatch(updateUser(res.user));
        if (res.user.is_verified) {
          showDialog({ title: 'You\'re Approved!', message: 'Your account has been verified. Welcome to the team!', confirmText: 'Okay', type: 'success' });
        } else {
          showDialog({ title: 'Still Under Review', message: 'Our team is still reviewing your documents. This usually takes 24-48 hours. Thank you for your patience.', confirmText: 'Okay', type: 'info' });
        }
      } else {
        throw new Error('User data not found');
      }
    } catch (err: any) {
      showDialog({ title: 'Check Failed', message: err.message || 'Unable to reach server. Please check your connection.', confirmText: 'Okay', type: 'error' });
    } finally {
      setChecking(false);
    }
  };

  const steps = [
    {
      icon: CheckCircle2,
      title: 'Account Created',
      desc: 'Profile created and documents submitted successfully.',
      state: 'done' as const,
    },
    {
      icon: Clock,
      title: 'Document Verification',
      desc: 'Our team is reviewing your licence and ID. This takes 24-48 hours.',
      state: 'active' as const,
    },
    {
      icon: Lock,
      title: 'Account Activated',
      desc: 'Once approved, you can start accepting delivery orders.',
      state: 'pending' as const,
    },
  ];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={R.white} />
      <SafeAreaView style={styles.content}>

        {/* Top illustration area */}
        <View style={styles.heroWrap}>
          <View style={styles.heroIcon}>
            <ShieldCheck size={40} color={R.orange} strokeWidth={1.8} />
          </View>
          <Text style={styles.heroTitle}>Under Review</Text>
          <Text style={styles.heroSub}>
            Hi {user?.name?.split(' ')[0] || 'there'}! Your documents are being reviewed by our team. We'll notify you once approved.
          </Text>
        </View>

        {/* Steps card */}
        <View style={styles.card}>
          {steps.map((step, i) => {
            const Icon = step.icon;
            const isDone = step.state === 'done';
            const isActive = step.state === 'active';
            return (
              <View key={i}>
                <View style={styles.stepRow}>
                  {/* Node */}
                  <View style={[
                    styles.stepNode,
                    isDone && styles.stepNodeDone,
                    isActive && styles.stepNodeActive,
                  ]}>
                    <Icon
                      size={14}
                      color={isDone ? R.green : isActive ? R.orange : R.muted}
                      strokeWidth={2.5}
                    />
                  </View>
                  {/* Content */}
                  <View style={styles.stepContent}>
                    <Text style={[
                      styles.stepTitle,
                      isDone && { color: R.green },
                      isActive && { color: R.orange },
                      !isDone && !isActive && { color: R.muted },
                    ]}>
                      {step.title}
                    </Text>
                    <Text style={styles.stepDesc}>{step.desc}</Text>
                  </View>
                </View>
                {i < steps.length - 1 && (
                  <View style={[styles.stepLine, isDone && styles.stepLineDone]} />
                )}
              </View>
            );
          })}
        </View>

        {/* Check status button */}
        <TouchableOpacity
          style={[styles.checkBtn, checking && { opacity: 0.7 }]}
          onPress={checkStatus}
          disabled={checking}
          activeOpacity={0.88}
        >
          {checking
            ? <ActivityIndicator color={R.white} size="small" />
            : <>
                <RefreshCw size={16} color={R.white} />
                <Text style={styles.checkBtnText}>Check Status</Text>
              </>
          }
        </TouchableOpacity>

        {/* Support card */}
        <View style={styles.supportCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.supportLabel}>NEED HELP?</Text>
            <Text style={styles.supportTitle}>Contact Support</Text>
            <Text style={styles.supportSub}>We're available 9AM – 9PM</Text>
          </View>
          <TouchableOpacity
            style={styles.contactBtn}
            onPress={() => Linking.openURL('https://wa.me/919999999999?text=Hi%2C%20I%20am%20a%20rider%20waiting%20for%20account%20verification.')}
            activeOpacity={0.85}
          >
            <PhoneCall size={18} color={R.white} />
          </TouchableOpacity>
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.logoutBtn} onPress={() => dispatch(logout())} activeOpacity={0.7}>
          <LogOut size={15} color={R.muted} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: R.bg },
  content: {
    flex: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24,
    gap: 16,
  },

  heroWrap: { alignItems: 'center', paddingVertical: 8 },
  heroIcon: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: R.orangeLight, borderWidth: 1, borderColor: '#FDDBB4',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  heroTitle: { color: R.ink, fontSize: 24, fontWeight: '900', letterSpacing: -0.5, marginBottom: 8 },
  heroSub: { color: R.gray, fontSize: 14, lineHeight: 22, textAlign: 'center', paddingHorizontal: 8 },

  card: {
    backgroundColor: R.white, borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: R.border,
  },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  stepNode: {
    width: 30, height: 30, borderRadius: 10,
    backgroundColor: R.bg, borderWidth: 1, borderColor: R.border,
    alignItems: 'center', justifyContent: 'center', zIndex: 1,
    flexShrink: 0,
  },
  stepNodeDone: { backgroundColor: R.greenLight, borderColor: '#B7E8D7' },
  stepNodeActive: { backgroundColor: R.orangeLight, borderColor: '#FDDBB4' },
  stepContent: { flex: 1, paddingBottom: 4 },
  stepTitle: { fontSize: 14, fontWeight: '800', marginBottom: 3 },
  stepDesc: { color: R.muted, fontSize: 12, lineHeight: 17 },
  stepLine: {
    width: 2, height: 18, backgroundColor: R.border,
    marginLeft: 14, marginVertical: 4,
  },
  stepLineDone: { backgroundColor: '#B7E8D7' },

  checkBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: R.orange, borderRadius: 16, paddingVertical: 16,
    shadowColor: R.orange, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6,
  },
  checkBtnText: { color: R.white, fontWeight: '900', fontSize: 15 },

  supportCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: R.white, borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: R.border,
  },
  supportLabel: { color: R.orange, fontSize: 8, fontWeight: '900', letterSpacing: 1.5 },
  supportTitle: { color: R.ink, fontSize: 15, fontWeight: '800', marginTop: 2 },
  supportSub: { color: R.muted, fontSize: 12, marginTop: 2 },
  contactBtn: {
    width: 46, height: 46, borderRadius: 14,
    backgroundColor: R.orange, alignItems: 'center', justifyContent: 'center',
    shadowColor: R.orange, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 8,
  },
  logoutText: { color: R.muted, fontSize: 13, fontWeight: '700' },
});

export default VerificationPendingScreen;
