import { tokens } from '../theme/tokens';
import React, { useEffect, useState } from 'react';
import { Alert, NativeModules, StyleSheet, Text, View, StatusBar, KeyboardAvoidingView, Platform, Dimensions, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { Bike, ChefHat, ShieldCheck, Flame, Package } from 'lucide-react-native';
import { OTPWidget } from '@msg91comm/sendotp-react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { Button, TextField } from '../components/ui';
import { PressableScale } from '../components/ui/internal/PressableScale';
import { ENV } from '../config/env';
import { useFeedback } from '../context/FeedbackContext';

const { width } = Dimensions.get('window');
const { RoleModule } = NativeModules;
const BUILD_ROLE = RoleModule?.BUILD_ROLE || 'customer';

const BRANDING: Record<string, { name: string; sub: string; color: string; Icon: any }> = {
  customer: { name: 'Eigen Foods', sub: 'Cooked Fresh, Daily', color: '#FF4500', Icon: ChefHat }, // Matching the exact orange from the mockup
  rider: { name: 'EIGEN CAPTAIN', sub: 'Rider Portal', color: tokens.colors.textPrimary, Icon: Bike },
  kitchen: { name: 'EIGEN PARTNER', sub: 'Kitchen Command', color: '#0E7490', Icon: Flame },
  packer: { name: 'EIGEN PACKER', sub: 'Packing Station', color: '#F59E0B', Icon: Package },
  admin: { name: 'EIGEN ADMIN', sub: 'Operations Deck', color: tokens.colors.danger, Icon: ShieldCheck },
};

const LoginScreen = ({ navigation }: any) => {
  const [phone, setPhone] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [devRole, setDevRole] = useState(BUILD_ROLE);
  const { showDialog } = useFeedback();
  const insets = useSafeAreaInsets();

  const globalLocation = useSelector((state: RootState) => state.app.globalLocation);

  // Widget must be initialized before sendOTP/verifyOTP/retryOTP can be called.
  useEffect(() => {
    OTPWidget.initializeWidget(ENV.MSG91_WIDGET_ID, ENV.MSG91_WIDGET_TOKEN_AUTH);
  }, []);

  const sendMutation = useMutation({
    mutationFn: async (digits: string) => {
      const response: any = await OTPWidget.sendOTP({ identifier: digits });
      if (response?.type !== 'success') {
        throw new Error(response?.message || 'Could not send OTP');
      }
      const reqId = response.message || response.reqId || response.request_id;
      if (!reqId) throw new Error('No request ID returned');
      return reqId as string;
    },
    onSuccess: (reqId) => {
      navigation.navigate('OTP', {
        phone: '91' + phone,
        reqId,
        referralCode: referralCode.trim().toUpperCase(),
        devRole: devRole === 'kitchen' ? 'chef' : devRole,
        lat: globalLocation?.latitude,
        lng: globalLocation?.longitude,
      });
    },
    onError: (err: any) => {
      showDialog({
        title: 'Error',
        message: err?.message || 'Could not send OTP. Check your connection.',
        confirmText: 'Okay',
        type: 'error'
      });
    },
  });

  const handleSendOTP = () => {
    if (phone.length !== 10) return;
    sendMutation.mutate('91' + phone);
  };

  const branding = BRANDING[devRole] || BRANDING.customer;
  const Icon = branding.Icon;

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor={styles.container.backgroundColor} />
      
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top + 16, 44),
            paddingBottom: Math.max(insets.bottom + 16, 24),
          }
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        
        <Animated.View entering={ZoomIn.duration(500)} style={styles.logoWrapper}>
          <View style={[styles.logoCard, { backgroundColor: branding.color }]}>
            <Icon color={tokens.colors.textInverse} size={42} strokeWidth={2} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(500).delay(100)} style={styles.headerWrapper}>
          <Text style={styles.brandingSubText} allowFontScaling maxFontSizeMultiplier={1.4}>{branding.sub}</Text>
          <Text style={styles.brandingNameText} allowFontScaling maxFontSizeMultiplier={1.3}>{branding.name}</Text>
          <Text style={styles.heroText} allowFontScaling maxFontSizeMultiplier={1.4}>
            {devRole === 'customer'
              ? 'Real food, made fresh in our own\nkitchen — see exactly how.'
              : 'Sign in to access your\noperations dashboard.'}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(500).delay(200)} style={styles.formWrapper}>
          <TextField
            leftAdornment={<Text style={styles.countryCodeText} allowFontScaling maxFontSizeMultiplier={1.3}>+91</Text>}
            placeholder="00000 00000"
            keyboardType="numeric"
            maxLength={10}
            value={phone}
            onChangeText={setPhone}
            autoFocus
          />

          {devRole === 'customer' && (
            <TextField
              containerStyle={{ marginTop: 16 }}
              placeholder="REFERRAL CODE (OPTIONAL)"
              autoCapitalize="characters"
              value={referralCode}
              onChangeText={setReferralCode}
            />
          )}
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(500).delay(300)} style={styles.bottomWrapper}>
          {phone.length === 10 ? (
            <Button
              label="SEND VERIFICATION CODE"
              onPress={handleSendOTP}
              loading={sendMutation.isPending}
              style={[styles.actionBtn, { backgroundColor: branding.color }]}
            />
          ) : (
            <View style={styles.disabledTextContainer}>
              <Text style={styles.disabledText} allowFontScaling maxFontSizeMultiplier={1.4}>ENTER 10 DIGITS TO PROCEED</Text>
            </View>
          )}

          <View style={styles.secureBadge}>
            <Text style={styles.secureText} allowFontScaling maxFontSizeMultiplier={1.4}>SECURED BY EIGEN SHIELD</Text>
          </View>
        </Animated.View>

        {__DEV__ && !RoleModule?.BUILD_ROLE && (
          <View style={styles.devRoleContainer}>
            <View style={styles.devRoleRow}>
              {['customer', 'rider', 'kitchen', 'packer', 'admin'].map((r) => (
                <PressableScale
                  key={r}
                  onPress={() => setDevRole(r)}
                  style={[styles.devRoleBtn, devRole === r && { backgroundColor: BRANDING[r].color }]}
                >
                  <Text style={[styles.devRoleBtnText, devRole === r && styles.devRoleBtnTextActive]} allowFontScaling maxFontSizeMultiplier={1.4}>{r.toUpperCase()}</Text>
                </PressableScale>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: tokens.spacing.xxl,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  logoWrapper: {
    marginBottom: tokens.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCard: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
    borderCurve: 'continuous',
  },
  headerWrapper: {
    alignItems: 'center',
    marginBottom: tokens.spacing.xxxl,
    paddingHorizontal: tokens.spacing.sm,
  },
  brandingSubText: {
    fontSize: 11,
    fontFamily: tokens.typography.family.black,
    textTransform: 'uppercase',
    letterSpacing: 2.5,
    color: tokens.colors.textSecondary,
    marginBottom: tokens.spacing.sm,
  },
  brandingNameText: {
    color: tokens.colors.textPrimary,
    fontSize: 48,
    fontFamily: tokens.typography.family.black,
    letterSpacing: -1.5,
    textAlign: 'center',
    marginBottom: tokens.spacing.sm,
  },
  heroText: {
    color: tokens.colors.textSecondary,
    textAlign: 'center',
    fontFamily: tokens.typography.family.medium,
    fontSize: 16,
    lineHeight: 24,
  },
  formWrapper: {
    width: '100%',
    marginBottom: tokens.spacing.xxxl,
  },
  countryCodeText: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.size.h2,
    fontFamily: tokens.typography.family.black,
    marginRight: tokens.spacing.lg,
  },
  bottomWrapper: {
    width: '100%',
    alignItems: 'center',
    minHeight: 100,
  },
  actionBtn: {
    width: '100%',
    height: 64,
    borderRadius: tokens.radii.full,
    borderCurve: 'continuous',
    shadowOpacity: 0,
    elevation: 0,
  },
  disabledTextContainer: {
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledText: {
    color: tokens.colors.textTertiary,
    fontSize: 13,
    fontFamily: tokens.typography.family.black,
    letterSpacing: 1.5,
  },
  secureBadge: {
    marginTop: tokens.spacing.xl,
  },
  secureText: {
    color: tokens.colors.textTertiary,
    fontSize: 10,
    fontFamily: tokens.typography.family.black,
    letterSpacing: 2,
  },
  devRoleContainer: {
    position: 'absolute',
    bottom: tokens.spacing.xxl,
    width: '100%',
    alignItems: 'center',
    paddingTop: tokens.spacing.lg,
  },
  devRoleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: tokens.spacing.sm,
  },
  devRoleBtn: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radii.md,
    backgroundColor: tokens.colors.surface,
  },
  devRoleBtnText: {
    fontSize: 9,
    fontFamily: tokens.typography.family.black,
    color: tokens.colors.textSecondary,
    letterSpacing: 1,
  },
  devRoleBtnTextActive: {
    color: tokens.colors.textInverse,
  },
});

export default LoginScreen;
