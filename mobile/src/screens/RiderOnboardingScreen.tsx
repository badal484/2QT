import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar, StyleSheet } from 'react-native';
import { ShieldCheck, Clock, Package, CheckCircle2, ChevronRight, Bookmark, AlertTriangle, ShieldAlert } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const RiderOnboardingScreen = ({ navigation }: any) => {
  const [agreed, setAgreed] = useState(false);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.contentSafeArea} edges={['top']}>
        {/* Top Operational Progress Timeline */}
        <View style={styles.timelineContainer}>
          <View style={styles.timelineRow}>
            <View style={styles.timelineStep}>
              <View style={[styles.timelineNode, styles.timelineNodeActive]}>
                <Text style={styles.timelineNodeTextActive}>1</Text>
              </View>
              <Text style={styles.timelineLabelActive}>BRIEFING</Text>
            </View>
            <View style={styles.timelineConnector} />
            <View style={styles.timelineStep}>
              <View style={styles.timelineNode}>
                <Text style={styles.timelineNodeText}>2</Text>
              </View>
              <Text style={styles.timelineLabel}>IDENTITY</Text>
            </View>
            <View style={styles.timelineConnector} />
            <View style={styles.timelineStep}>
              <View style={styles.timelineNode}>
                <Text style={styles.timelineNodeText}>3</Text>
              </View>
              <Text style={styles.timelineLabel}>CLEARANCE</Text>
            </View>
          </View>
        </View>

        <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Hero Identity */}
          <View style={styles.heroSection}>
            <View style={styles.logoWrapper}>
              <Bookmark size={28} color="#FF6B35" />
            </View>
            <Text style={styles.heroLabel}>Operational Security Briefing</Text>
            <Text style={styles.heroTitle}>2QT PROTOCOL</Text>
          </View>

          <Text style={styles.sectionTitle}>Captain Code of Conduct</Text>
          <Text style={styles.sectionDesc}>
            Riders on the 2QT network are designated as Captains. Review our core delivery guidelines below.
          </Text>

          <View style={styles.stepsContainer}>
            {/* Step 1 */}
            <View style={styles.stepRow}>
              <View style={styles.stepIconWrapper}>
                <Clock size={20} color="#FF6B35" />
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Strict Dispatch Windows</Text>
                <Text style={styles.stepDesc}>
                  Accept orders only if you are ready to roll immediately. Freshness is measured in seconds.
                </Text>
              </View>
            </View>

            {/* Step 2 */}
            <View style={styles.stepRow}>
              <View style={styles.stepIconWrapper}>
                <Package size={20} color="#FF6B35" />
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Sealed Thermal Containers</Text>
                <Text style={styles.stepDesc}>
                  Mouthwatering dishes must be kept inside your sealed thermal bag at all times to lock in temperatures.
                </Text>
              </View>
            </View>

            {/* Step 3 */}
            <View style={styles.stepRow}>
              <View style={styles.stepIconWrapper}>
                <ShieldCheck size={20} color="#FF6B35" />
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>OTP Handoff Verification</Text>
                <Text style={styles.stepDesc}>
                  Input the secure key with the customer. Deliveries without OTP keys are flagged as high risk.
                </Text>
              </View>
            </View>
          </View>

          {/* Compliance Card */}
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => setAgreed(!agreed)}
            style={[styles.termsBox, agreed && styles.termsBoxChecked]}
          >
            <View style={[styles.checkboxNode, agreed && styles.checkboxNodeChecked]}>
              {agreed && <CheckCircle2 size={16} color="#22C55E" />}
            </View>
            <Text style={styles.termsText}>
              I acknowledge the operational guidelines and agree to uphold the 2QT SLA standards.
            </Text>
          </TouchableOpacity>

          {/* Action Button */}
          <TouchableOpacity 
            activeOpacity={0.9}
            style={[styles.actionBtn, agreed ? styles.actionBtnActive : styles.actionBtnInactive]}
            disabled={!agreed}
            onPress={() => {
              navigation.navigate('Onboarding');
            }}
          >
            <View style={styles.actionBtnContent}>
              <Text style={[styles.actionBtnText, agreed ? styles.actionBtnTextActive : styles.actionBtnTextInactive]}>Acknowledge & Continue</Text>
              <ChevronRight size={18} color={agreed ? 'white' : '#475569'} strokeWidth={3} style={{ marginLeft: 8 }} />
            </View>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0C10',
  },
  contentSafeArea: {
    flex: 1,
  },
  timelineContainer: {
    paddingVertical: 20,
    backgroundColor: '#0D0E15',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  timelineRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  timelineStep: {
    alignItems: 'center',
  },
  timelineNode: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: '#1E2035',
    borderWidth: 1.5,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineNodeActive: {
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderColor: '#FF6B35',
  },
  timelineNodeText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '900',
  },
  timelineNodeTextActive: {
    color: '#FF6B35',
    fontSize: 10,
    fontWeight: '900',
  },
  timelineLabel: {
    color: '#475569',
    fontSize: 8,
    fontWeight: '900',
    marginTop: 6,
    letterSpacing: 0.5,
  },
  timelineLabelActive: {
    color: '#FF6B35',
    fontSize: 8,
    fontWeight: '900',
    marginTop: 6,
    letterSpacing: 0.5,
  },
  timelineConnector: {
    flex: 1,
    height: 2,
    backgroundColor: '#1E2035',
    marginHorizontal: 12,
    marginTop: -14,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 48,
  },
  heroSection: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 32,
  },
  logoWrapper: {
    width: 68,
    height: 68,
    backgroundColor: 'rgba(255, 107, 53, 0.08)',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.15)',
  },
  heroLabel: {
    color: '#FF6B35',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 9,
    marginBottom: 6,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 6,
  },
  sectionDesc: {
    color: '#94A3B8',
    fontWeight: '600',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 28,
  },
  stepsContainer: {
    gap: 16,
    marginBottom: 32,
  },
  stepRow: {
    flexDirection: 'row',
    backgroundColor: '#161726',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 20,
    padding: 18,
  },
  stepIconWrapper: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255, 107, 53, 0.08)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.15)',
  },
  stepContent: {
    flex: 1,
    justifyContent: 'center',
  },
  stepTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  stepDesc: {
    color: '#94A3B8',
    fontWeight: '600',
    fontSize: 11,
    marginTop: 4,
    lineHeight: 16,
  },
  termsBox: {
    backgroundColor: '#161726',
    padding: 18,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  termsBoxChecked: {
    borderColor: 'rgba(34, 197, 94, 0.25)',
    backgroundColor: '#122520',
  },
  checkboxNode: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: '#0D0E15',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginRight: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxNodeChecked: {
    borderColor: 'rgba(34, 197, 94, 0.3)',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  termsText: {
    color: '#94A3B8',
    fontWeight: '700',
    fontSize: 12,
    flex: 1,
    lineHeight: 18,
  },
  actionBtn: {
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnActive: {
    backgroundColor: '#FF6B35',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 6,
  },
  actionBtnInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  actionBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtnText: {
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontSize: 13,
  },
  actionBtnTextActive: {
    color: '#FFFFFF',
  },
  actionBtnTextInactive: {
    color: '#475569',
  },
});

export default RiderOnboardingScreen;
