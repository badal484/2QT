import React, { useState } from 'react';
import { BouncingButton } from '../components/ui/BouncingButton';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useMutation } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChefHat, ShieldCheck, Bike } from 'lucide-react-native';
import { updateUser } from '../store/slices/authSlice';
import { api } from '../api/client';
import { Button, TextField } from '../components/ui';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import { radius, spacing } from '../theme/spacing';
import { RootState } from '../store';

const OnboardingScreen = ({ navigation }: any) => {
  const [name, setName] = useState('');
  const [riderFocused, setRiderFocused] = useState(false);
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);
  
  const isRider = user?.role === 'rider' || user?.role === 'rider_captain';

  const updateMutation = useMutation({
    mutationFn: async (newName: string) => {
      const res = await api.patch('/customers/profile', { name: newName });
      await api.post('/auth/onboarding/complete', {});
      return res;
    },
    onSuccess: (data: any) => {
      dispatch(updateUser({ ...data.user, onboarding_complete: true }));
      const role = data?.user?.role || user?.role || 'customer';
      if (role === 'customer' || role === 'buyer') {
        navigation.replace('Home');
      }
    },
    onError: (err: any) => {
      Alert.alert('Setup Failed', err.message || 'Could not update profile.');
    },
  });

  const handleSave = () => {
    if (!name.trim()) return;
    updateMutation.mutate(name.trim());
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, isRider && styles.riderContainer]} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Animated.View entering={FadeInDown.duration(500)} style={styles.content}>
        <View style={[
          styles.logoMark, 
          isRider && { backgroundColor: 'rgba(255, 107, 53, 0.15)', shadowColor: '#FF6B35' }
        ]}>
          {isRider ? (
            <Bike color="#FF6B35" size={28} strokeWidth={2.25} />
          ) : (
            <ChefHat color={colors.white} size={28} strokeWidth={2.25} />
          )}
        </View>

        <Text style={[styles.title, isRider && styles.riderTitle]}>
          {isRider ? 'Welcome, Captain' : 'Welcome aboard'}
        </Text>
        <Text style={[styles.subText, isRider && styles.riderSubText]}>
          {isRider 
            ? "Let's set up your Captain profile so we know exactly who is representing 2QT on the road."
            : "Let's get your profile set up so we know exactly who we're cooking for."
          }
        </Text>

        {isRider ? (
          <View style={styles.riderFieldContainer}>
            <Text style={styles.riderLabel}>Full Name</Text>
            <View style={[styles.riderField, riderFocused && styles.riderFieldFocused]}>
              <TextInput
                style={styles.riderInput}
                placeholder="e.g. Capt. Arjun Singh"
                placeholderTextColor="#3A3B55"
                value={name}
                onChangeText={setName}
                autoFocus
                autoCapitalize="words"
                onFocus={() => setRiderFocused(true)}
                onBlur={() => setRiderFocused(false)}
              />
            </View>
          </View>
        ) : (
          <TextField
            label="Full Name"
            placeholder="e.g. Ananya Rao"
            value={name}
            onChangeText={setName}
            autoFocus
            autoCapitalize="words"
            containerStyle={styles.fieldSpacing}
          />
        )}

        <View style={isRider ? styles.riderTrustRow : styles.trustRow}>
          <ShieldCheck 
            color={isRider ? '#FF6B35' : colors.primary} 
            size={16} 
            strokeWidth={2.25} 
          />
          <Text style={isRider ? styles.riderTrustText : styles.trustText}>
            {isRider
              ? 'All active delivery missions are secured with 2QT accident coverage and navigation assistance.'
              : 'Every meal is made fresh in our own kitchen — watch how, anytime.'
            }
          </Text>
        </View>

        {isRider ? (
          <BouncingButton
            activeOpacity={0.9}
            onPress={handleSave}
            disabled={!name.trim() || updateMutation.isPending}
            style={[
              styles.riderSaveButton,
              (!name.trim() || updateMutation.isPending) && styles.riderSaveButtonDisabled
            ]}
          >
            {updateMutation.isPending ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={[
                styles.riderSaveButtonText,
                (!name.trim() || updateMutation.isPending) && styles.riderSaveButtonTextDisabled
              ]}>
                Register as Captain
              </Text>
            )}
          </BouncingButton>
        ) : (
          <Button
            label="Complete Setup"
            onPress={handleSave}
            disabled={!name.trim()}
            loading={updateMutation.isPending}
            style={styles.saveButton}
          />
        )}
      </Animated.View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  riderContainer: {
    backgroundColor: '#0B0C10',
  },
  content: {
    flex: 1,
    padding: spacing.xxl,
    justifyContent: 'center',
  },
  logoMark: {
    width: 64,
    height: 64,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxl,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    color: colors.ink,
    fontSize: 30,
    fontFamily: fontFamily.black,
    letterSpacing: -0.5,
  },
  riderTitle: {
    color: '#FFFFFF',
  },
  subText: {
    color: colors.inkMuted,
    marginTop: spacing.sm,
    fontFamily: fontFamily.medium,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: spacing.xxl,
  },
  riderSubText: {
    color: '#94A3B8',
  },
  fieldSpacing: {
    marginBottom: spacing.lg,
  },
  riderFieldContainer: {
    marginBottom: spacing.lg,
  },
  riderLabel: {
    fontFamily: fontFamily.extrabold,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: '#94A3B8',
    marginBottom: spacing.sm,
  },
  riderField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161726',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    minHeight: 56,
  },
  riderFieldFocused: {
    borderColor: '#FF6B35',
    backgroundColor: '#161726',
  },
  riderInput: {
    flex: 1,
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    color: '#FFFFFF',
    paddingVertical: spacing.md,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.primaryTint,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.xxl,
  },
  riderTrustRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.xxl,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.15)',
  },
  trustText: {
    flex: 1,
    marginLeft: spacing.sm,
    color: colors.primaryDark,
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    lineHeight: 18,
  },
  riderTrustText: {
    flex: 1,
    marginLeft: spacing.sm,
    color: '#FF6B35',
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    lineHeight: 18,
  },
  saveButton: {
    marginTop: spacing.xs,
  },
  riderSaveButton: {
    backgroundColor: '#FF6B35',
    height: 64,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
  },
  riderSaveButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    elevation: 0,
  },
  riderSaveButtonText: {
    color: '#FFFFFF',
    fontFamily: fontFamily.extrabold,
    fontSize: 16,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  riderSaveButtonTextDisabled: {
    color: '#64748B',
  },
});

export default OnboardingScreen;
