import React, { useState } from 'react';
import { Alert, NativeModules, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Bike, ChefHat, ShieldCheck, Flame } from 'lucide-react-native';
import { api } from '../api/client';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { Button, TextField } from '../components/ui';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import { radius, spacing } from '../theme/spacing';

const { RoleModule } = NativeModules;
const BUILD_ROLE = RoleModule?.BUILD_ROLE || 'customer';

const BRANDING: Record<string, { name: string; sub: string; color: string; Icon: any }> = {
  customer: { name: '2QT', sub: 'Cooked Fresh, Daily', color: colors.primary, Icon: ChefHat },
  rider: { name: '2QT CAPTAIN', sub: 'Rider Portal', color: colors.ink, Icon: Bike },
  kitchen: { name: '2QT PARTNER', sub: 'Kitchen Command', color: '#0E7490', Icon: Flame },
  admin: { name: '2QT ADMIN', sub: 'Operations Deck', color: colors.danger, Icon: ShieldCheck },
};

const LoginScreen = ({ navigation }: any) => {
  const [phone, setPhone] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [devRole, setDevRole] = useState(BUILD_ROLE);
  // Use location already detected by AppBootManager during the splash screen
  // instead of triggering a new GPS request (which races against OTP submission)
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

  const handleSendOTP = () => {
    if (phone.length === 10) {
      mutation.mutate('91' + phone);
    }
  };

  const branding = BRANDING[devRole] || BRANDING.customer;
  const Icon = branding.Icon;

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeInDown.duration(500)} style={styles.content}>
        <View style={[styles.logoCard, { backgroundColor: branding.color }]}>
          <Icon color={colors.white} size={40} strokeWidth={2} />
        </View>
        <Text style={styles.brandingSubText}>{branding.sub}</Text>
        <Text style={styles.brandingNameText}>{branding.name}</Text>
        <Text style={styles.heroText}>
          {devRole === 'customer'
            ? 'Real food, made fresh in our own kitchen — see exactly how.'
            : 'Sign in to continue'}
        </Text>

        <View style={styles.phoneRow}>
          <Text style={styles.countryCodeText}>+91</Text>
          <TextInput
            style={styles.phoneInput}
            placeholder="00000 00000"
            placeholderTextColor={colors.inkFaint}
            keyboardType="numeric"
            maxLength={10}
            value={phone}
            onChangeText={setPhone}
            autoFocus
          />
        </View>

        {devRole === 'customer' && (
          <TextField
            placeholder="REFERRAL CODE (OPTIONAL)"
            autoCapitalize="characters"
            value={referralCode}
            onChangeText={setReferralCode}
            containerStyle={styles.referralField}
          />
        )}

        {phone.length === 10 ? (
          <Button
            label="Send Verification Code"
            onPress={handleSendOTP}
            loading={mutation.isPending}
            style={[styles.actionBtn, { backgroundColor: branding.color, shadowColor: branding.color }]}
          />
        ) : (
          <View style={styles.hintContainer}>
            <Text style={styles.hintText}>Enter 10 digits to proceed</Text>
          </View>
        )}

        <Text style={styles.secureText}>Secured by 2QT Shield</Text>

        {__DEV__ && !RoleModule?.BUILD_ROLE && (
          <View style={styles.devRoleContainer}>
            <Text style={styles.devRoleLabel}>DEV ROLE SWITCHER</Text>
            <View style={styles.devRoleRow}>
              {['customer', 'rider', 'kitchen', 'admin'].map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setDevRole(r)}
                  style={[styles.devRoleBtn, devRole === r && styles.devRoleBtnActive]}
                >
                  <Text style={[styles.devRoleBtnText, devRole === r && styles.devRoleBtnTextActive]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.xxl,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoCard: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.xxl,
    marginBottom: spacing.xxl,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 10,
  },
  brandingSubText: {
    color: colors.inkMuted,
    fontSize: 10,
    fontFamily: fontFamily.extrabold,
    textTransform: 'uppercase',
    letterSpacing: 3,
    marginBottom: spacing.sm,
  },
  brandingNameText: {
    color: colors.ink,
    fontSize: 36,
    fontFamily: fontFamily.black,
    letterSpacing: -0.5,
  },
  heroText: {
    color: colors.inkMuted,
    marginTop: spacing.md,
    textAlign: 'center',
    fontFamily: fontFamily.medium,
    fontSize: 14,
    paddingHorizontal: spacing.lg,
    lineHeight: 20,
  },
  phoneRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xxxl,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    height: 72,
  },
  countryCodeText: {
    color: colors.ink,
    fontSize: 18,
    fontFamily: fontFamily.extrabold,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingRight: spacing.lg,
  },
  phoneInput: {
    flex: 1,
    color: colors.ink,
    fontSize: 18,
    fontFamily: fontFamily.extrabold,
    paddingLeft: spacing.lg,
  },
  referralField: {
    width: '100%',
    marginTop: spacing.lg,
  },
  actionBtn: {
    width: '100%',
    marginTop: spacing.xxl,
  },
  hintContainer: {
    marginTop: spacing.xxl,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.4,
  },
  hintText: {
    color: colors.ink,
    fontSize: 10,
    fontFamily: fontFamily.extrabold,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  secureText: {
    marginTop: spacing.xxl,
    color: colors.inkFaint,
    fontSize: 9,
    fontFamily: fontFamily.extrabold,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  devRoleContainer: {
    marginTop: spacing.xxl,
    width: '100%',
    alignItems: 'center',
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  devRoleLabel: {
    fontSize: 10,
    fontFamily: fontFamily.extrabold,
    color: colors.inkFaint,
    marginBottom: spacing.md,
  },
  devRoleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  devRoleBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
  },
  devRoleBtnActive: {
    backgroundColor: colors.ink,
  },
  devRoleBtnText: {
    fontSize: 10,
    fontFamily: fontFamily.bold,
    color: colors.inkFaint,
  },
  devRoleBtnTextActive: {
    color: colors.white,
  },
});

export default LoginScreen;
