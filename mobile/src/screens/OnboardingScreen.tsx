import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StatusBar, StyleSheet } from 'react-native';
import Animated, { 
  FadeInDown, 
  FadeInUp,
} from 'react-native-reanimated';
import { useDispatch } from 'react-redux';
import { api } from '../api/client';
import { completeOnboarding } from '../store/slices/authSlice';
import { ChevronRight, ShieldCheck, Bike, MapPin } from 'lucide-react-native';

const OnboardingScreen = () => {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const steps = [
    { id: 1, title: 'Identity Proof', desc: 'Aadhar or PAN Card', icon: <ShieldCheck size={24} color="#FF6B35" /> },
    { id: 2, title: 'Driving License', desc: 'Valid Class A/B License', icon: <Bike size={24} color="#FF6B35" /> },
    { id: 3, title: 'Vehicle Docs', desc: 'RC & Insurance', icon: <MapPin size={24} color="#FF6B35" /> },
  ];

  const handleStepComplete = (id: number) => {
    if (!completedSteps.includes(id)) {
      setCompletedSteps([...completedSteps, id]);
    }
    if (currentStep < 3) setCurrentStep(currentStep + 1);
  };

  const handleComplete = async () => {
    if (completedSteps.length < 3) return;
    setLoading(true);
    try {
      await api.post('/auth/onboarding/complete');
      dispatch(completeOnboarding());
    } catch (err) {
      console.warn('Onboarding completion failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.content}>
        <Animated.View entering={FadeInDown.delay(200).duration(800)}>
          <Text style={styles.heroTitle}>Verification{"\n"}Protocol.</Text>
          <Text style={styles.heroSubText}>
            Complete all three steps to activate your Captain profile in Bengaluru.
          </Text>
        </Animated.View>

        <View style={styles.stepsList}>
          {steps.map((step) => (
            <TouchableOpacity 
              key={step.id}
              activeOpacity={0.8}
              onPress={() => handleStepComplete(step.id)}
              style={[
                styles.stepCard, 
                currentStep === step.id && styles.activeStepCard,
                completedSteps.includes(step.id) && styles.completedStepCard
              ]}
            >
              <View style={styles.stepIconWrapper}>
                {step.icon}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepDesc}>{step.desc}</Text>
              </View>
              {completedSteps.includes(step.id) && (
                <View style={styles.checkWrapper}>
                  <Text style={styles.checkMark}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity 
          activeOpacity={0.9}
          onPress={handleComplete}
          disabled={loading || completedSteps.length < 3}
          style={[styles.actionBtn, completedSteps.length < 3 && { opacity: 0.5 }]}
        >
          <View>
            <Text style={styles.actionBtnLabel}>{completedSteps.length}/3 Steps Ready</Text>
            <Text style={styles.actionBtnText}>Submit for Review</Text>
          </View>
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <View style={styles.actionBtnIconWrapper}>
              <ChevronRight size={24} color="white" />
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A2E',
  },
  decorCircleTop: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 300,
    height: 300,
    backgroundColor: 'rgba(255, 107, 53, 0.2)',
    borderRadius: 150,
  },
  decorCircleBottom: {
    position: 'absolute',
    bottom: -50,
    left: -50,
    width: 200,
    height: 200,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 100,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'center',
  },
  logoWrapper: {
    width: 80,
    height: 80,
    backgroundColor: '#fff',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 20,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -2,
    lineHeight: 52,
    marginBottom: 16,
  },
  heroSubText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 18,
    fontWeight: '500',
    lineHeight: 28,
    marginBottom: 48,
  },
  stepsList: {
    gap: 16,
  },
  stepCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 24,
    borderRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeStepCard: {
    borderColor: 'rgba(255, 107, 53, 0.3)',
    backgroundColor: 'rgba(255, 107, 53, 0.05)',
  },
  completedStepCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  stepIconWrapper: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 20,
  },
  stepTitle: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 16,
  },
  stepDesc: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  checkWrapper: {
    width: 24,
    height: 24,
    backgroundColor: '#10B981',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  footer: {
    padding: 32,
    paddingBottom: 48,
  },
  actionBtn: {
    height: 80,
    backgroundColor: '#FF6B35',
    borderRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 10,
  },
  actionBtnLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  actionBtnIconWrapper: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default OnboardingScreen;
