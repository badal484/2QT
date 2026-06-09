import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { ShieldCheck, Clock, Package, CheckCircle2 } from 'lucide-react-native';

const RiderOnboardingScreen = ({ navigation }: any) => {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Hero Image / Graphic */}
      <View style={styles.heroSection}>
        <View style={styles.logoWrapper}>
          <Package size={48} color="#FF6B35" />
        </View>
        <Text style={styles.heroLabel}>Welcome to the Fleet</Text>
        <Text style={styles.heroTitle}>VELTO RIDER</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Operational Protocol</Text>
        <Text style={styles.sectionDesc}>
          Before you start accepting missions, please review our core delivery standards. Velto is a premium service, and our riders are the face of the brand.
        </Text>

        <View style={styles.stepsContainer}>
          {/* Step 1 */}
          <View style={styles.stepRow}>
            <View style={styles.stepIconWrapper}>
              <Clock size={24} color="#FF6B35" />
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Time is Critical</Text>
              <Text style={styles.stepDesc}>Every order has a strict SLA. Accept orders only if you can reach the kitchen immediately.</Text>
            </View>
          </View>

          {/* Step 2 */}
          <View style={styles.stepRow}>
            <View style={styles.stepIconWrapper}>
              <Package size={24} color="#FF6B35" />
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Thermal Bag Mandatory</Text>
              <Text style={styles.stepDesc}>Food must always be transported in your Velto-issued thermal bag to maintain temperature.</Text>
            </View>
          </View>

          {/* Step 3 */}
          <View style={styles.stepRow}>
            <View style={styles.stepIconWrapper}>
              <ShieldCheck size={24} color="#FF6B35" />
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>OTP Verification</Text>
              <Text style={styles.stepDesc}>Never handover an order without verifying the 6-digit PIN from the customer.</Text>
            </View>
          </View>
        </View>

        <View style={styles.termsBox}>
          <CheckCircle2 size={20} color="#10B981" />
          <Text style={styles.termsText}>By continuing, I agree to the Velto Terms of Service and Code of Conduct.</Text>
        </View>

        <TouchableOpacity 
          activeOpacity={0.9}
          style={styles.actionBtn}
          onPress={() => {
            navigation.navigate('Onboarding');
          }}
        >
          <Text style={styles.actionBtnText}>Accept & Start</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A2E',
  },
  heroSection: {
    height: 288,
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 32,
  },
  logoWrapper: {
    width: 96,
    height: 96,
    backgroundColor: 'rgba(255, 107, 53, 0.2)',
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  heroLabel: {
    color: '#FF6B35',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 3,
    fontSize: 12,
    marginBottom: 8,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
  },
  content: {
    backgroundColor: '#fff',
    flex: 1,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingHorizontal: 32,
    paddingTop: 40,
    paddingBottom: 80,
    marginTop: -32,
  },
  sectionTitle: {
    color: '#1A1A2E',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 8,
  },
  sectionDesc: {
    color: '#9ca3af',
    fontWeight: '700',
    fontSize: 12,
    lineHeight: 20,
    marginBottom: 40,
  },
  stepsContainer: {
    gap: 24,
    marginBottom: 48,
  },
  stepRow: {
    flexDirection: 'row',
  },
  stepIconWrapper: {
    width: 48,
    height: 48,
    backgroundColor: '#FFF7ED',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  stepContent: {
    flex: 1,
    justifyContent: 'center',
  },
  stepTitle: {
    color: '#1A1A2E',
    fontWeight: '900',
    fontSize: 15,
  },
  stepDesc: {
    color: '#9ca3af',
    fontWeight: '700',
    fontSize: 11,
    marginTop: 4,
    lineHeight: 16,
  },
  termsBox: {
    backgroundColor: '#f9fafb',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
  },
  termsText: {
    color: '#6b7280',
    fontWeight: '700',
    fontSize: 12,
    marginLeft: 12,
    flex: 1,
  },
  actionBtn: {
    backgroundColor: '#FF6B35',
    height: 64,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
});

export default RiderOnboardingScreen;
