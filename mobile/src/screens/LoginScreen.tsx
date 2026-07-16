import React, { useState } from 'react';
import { Alert, NativeModules, StyleSheet, Text, TextInput, TouchableOpacity, View, StatusBar, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { Bike, ChefHat, ShieldCheck, Flame } from 'lucide-react-native';
import { api } from '../api/client';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { Button } from '../components/ui';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import { radius, spacing } from '../theme/spacing';
import auth from '@react-native-firebase/auth';
import { setConfirmationResult } from '../utils/firebaseAuthHelper';

const { width } = Dimensions.get('window');
const { RoleModule } = NativeModules;
const BUILD_ROLE = RoleModule?.BUILD_ROLE || 'customer';

const BRANDING: Record<string, { name: string; sub: string; color: string; Icon: any }> = {
  customer: { name: '2QT', sub: 'Cooked Fresh, Daily', color: '#FF4500', Icon: ChefHat }, // Matching the exact orange from the mockup
  rider: { name: '2QT CAPTAIN', sub: 'Rider Portal', color: colors.ink, Icon: Bike },
  kitchen: { name: '2QT PARTNER', sub: 'Kitchen Command', color: '#0E7490', Icon: Flame },
  admin: { name: '2QT ADMIN', sub: 'Operations Deck', color: colors.danger, Icon: ShieldCheck },
};

const LoginScreen = ({ navigation }: any) => {
  const [phone, setPhone] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [devRole, setDevRole] = useState(BUILD_ROLE);
  const [firebaseLoading, setFirebaseLoading] = useState(false);

  const globalLocation = useSelector((state: RootState) => state.app.globalLocation);

  const mutation = useMutation({
    mutationFn: (phoneNumber: string) => api.post('/auth/send-otp', { phone: phoneNumber }),
    onSuccess: (data) => {
      navigation.navigate('OTP', {
        phone: data.phone,
        referralCode: referralCode.trim().toUpperCase(),
        devOtp: data.devOtp,
        devRole: devRole === 'kitchen' ? 'chef' : devRole,
        lat: globalLocation?.latitude,
        lng: globalLocation?.longitude,
      });
    },
    onError: () => {
      Alert.alert('Error', 'Could not send OTP. Check your connection.');
    },
  });

  const handleSendOTP = async () => {
    if (phone.length !== 10) return;
    const digits = '91' + phone;
    const isDevNumber = ["910000000000", "912222222222", "913333333333"].includes(digits);

    if (isDevNumber) {
      mutation.mutate(digits);
    } else {
      setFirebaseLoading(true);
      try {
        const formattedPhone = '+91' + phone;
        const confirmation = await auth().signInWithPhoneNumber(formattedPhone);
        setConfirmationResult(confirmation);
        
        navigation.navigate('OTP', {
          phone: digits,
          referralCode: referralCode.trim().toUpperCase(),
          devOtp: '',
          devRole: devRole === 'kitchen' ? 'chef' : devRole,
          lat: globalLocation?.latitude,
          lng: globalLocation?.longitude,
        });
      } catch (err: any) {
        console.error('Firebase Auth sendOtp error:', err);
        Alert.alert('Error', err.message || 'Could not send OTP. Check your connection.');
      } finally {
        setFirebaseLoading(false);
      }
    }
  };

  const branding = BRANDING[devRole] || BRANDING.customer;
  const Icon = branding.Icon;

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor={styles.container.backgroundColor} />
      
      <View style={styles.content}>
        
        <Animated.View entering={ZoomIn.duration(800).springify()} style={styles.logoWrapper}>
          <View style={[styles.logoCard, { backgroundColor: branding.color }]}>
            <Icon color={colors.white} size={48} strokeWidth={2} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(600).delay(100).springify()} style={styles.headerWrapper}>
          <Text style={styles.brandingSubText}>{branding.sub}</Text>
          <Text style={styles.brandingNameText}>{branding.name}</Text>
          <Text style={styles.heroText}>
            {devRole === 'customer'
              ? 'Real food, made fresh in our own\nkitchen — see exactly how.'
              : 'Sign in to access your\noperations dashboard.'}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(600).delay(200).springify()} style={styles.formWrapper}>
          <View style={styles.inputField}>
            <Text style={styles.countryCodeText}>+91</Text>
            <TextInput
              style={styles.phoneInput}
              placeholder="00000 00000"
              placeholderTextColor="#A0A0A0"
              keyboardType="numeric"
              maxLength={10}
              value={phone}
              onChangeText={setPhone}
              autoFocus
            />
          </View>

          {devRole === 'customer' && (
            <View style={[styles.inputField, { marginTop: spacing.lg }]}>
              <TextInput
                style={styles.referralInput}
                placeholder="REFERRAL CODE (OPTIONAL)"
                placeholderTextColor="#A0A0A0"
                autoCapitalize="characters"
                value={referralCode}
                onChangeText={setReferralCode}
              />
            </View>
          )}
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(600).delay(300).springify()} style={styles.bottomWrapper}>
          {phone.length === 10 ? (
            <Button
              label="SEND VERIFICATION CODE"
              onPress={handleSendOTP}
              loading={mutation.isPending || firebaseLoading}
              style={[styles.actionBtn, { backgroundColor: branding.color }]}
              textStyle={styles.actionBtnText}
            />
          ) : (
            <View style={styles.disabledTextContainer}>
              <Text style={styles.disabledText}>ENTER 10 DIGITS TO PROCEED</Text>
            </View>
          )}

          <View style={styles.secureBadge}>
            <Text style={styles.secureText}>SECURED BY 2QT SHIELD</Text>
          </View>
        </Animated.View>

        {__DEV__ && !RoleModule?.BUILD_ROLE && (
          <View style={styles.devRoleContainer}>
            <View style={styles.devRoleRow}>
              {['customer', 'rider', 'kitchen', 'admin'].map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setDevRole(r)}
                  style={[styles.devRoleBtn, devRole === r && { backgroundColor: BRANDING[r].color }]}
                >
                  <Text style={[styles.devRoleBtnText, devRole === r && styles.devRoleBtnTextActive]}>{r.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7', // The exact cool off-white from the mockup
  },
  content: {
    flex: 1,
    padding: spacing.xxl,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  logoWrapper: {
    marginBottom: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCard: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 34,
    borderCurve: 'continuous',
  },
  headerWrapper: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
    paddingHorizontal: spacing.sm,
  },
  brandingSubText: {
    fontSize: 11,
    fontFamily: fontFamily.black,
    textTransform: 'uppercase',
    letterSpacing: 2.5,
    color: '#8E8E93',
    marginBottom: spacing.sm,
  },
  brandingNameText: {
    color: colors.ink,
    fontSize: 48,
    fontFamily: fontFamily.black,
    letterSpacing: -1.5,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  heroText: {
    color: '#8E8E93',
    textAlign: 'center',
    fontFamily: fontFamily.medium,
    fontSize: 16,
    lineHeight: 24,
  },
  formWrapper: {
    width: '100%',
    marginBottom: spacing.xxxl,
  },
  inputField: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E9E9EB', // Very flat grey fill from mockup
    borderRadius: 24,
    borderCurve: 'continuous',
    height: 72,
    paddingHorizontal: spacing.xl,
  },
  countryCodeText: {
    color: colors.ink,
    fontSize: 22,
    fontFamily: fontFamily.black,
    marginRight: spacing.lg,
  },
  phoneInput: {
    flex: 1,
    color: colors.ink,
    fontSize: 22,
    fontFamily: fontFamily.bold,
    height: '100%',
  },
  referralInput: {
    flex: 1,
    color: colors.ink,
    fontSize: 16,
    fontFamily: fontFamily.bold,
    height: '100%',
  },
  bottomWrapper: {
    width: '100%',
    alignItems: 'center',
    minHeight: 100,
  },
  actionBtn: {
    width: '100%',
    height: 64,
    borderRadius: 24,
    borderCurve: 'continuous',
    shadowOpacity: 0,
    elevation: 0,
  },
  actionBtnText: {
    fontFamily: fontFamily.black,
    letterSpacing: 1,
  },
  disabledTextContainer: {
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledText: {
    color: '#999999',
    fontSize: 13,
    fontFamily: fontFamily.black,
    letterSpacing: 1.5,
  },
  secureBadge: {
    marginTop: spacing.xl,
  },
  secureText: {
    color: '#B0B0B0',
    fontSize: 10,
    fontFamily: fontFamily.black,
    letterSpacing: 2,
  },
  devRoleContainer: {
    position: 'absolute',
    bottom: spacing.xxl,
    width: '100%',
    alignItems: 'center',
    paddingTop: spacing.lg,
  },
  devRoleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  devRoleBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: '#E9E9EB',
  },
  devRoleBtnText: {
    fontSize: 9,
    fontFamily: fontFamily.black,
    color: colors.inkMuted,
    letterSpacing: 1,
  },
  devRoleBtnTextActive: {
    color: colors.white,
  },
});

export default LoginScreen;
