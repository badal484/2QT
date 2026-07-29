import React, { useState } from 'react';
import { Alert, NativeModules, StyleSheet, Text, TextInput, TouchableOpacity, View, StatusBar, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { Bike, ChefHat, ShieldCheck, Flame } from 'lucide-react-native';
import { DefaultWidget } from '@msg91comm/sendotp-react-native';
import { api } from '../api/client';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { Button, TextField } from '../components/ui';
import { tokens } from '../theme/tokens';
import { ENV } from '../config/env';
import { setAuth } from '../store/slices/authSlice';
import { connectSocket } from '../socket/client';

const { width } = Dimensions.get('window');
const { RoleModule } = NativeModules;
const BUILD_ROLE = RoleModule?.BUILD_ROLE || 'customer';

const BRANDING: Record<string, { name: string; sub: string; color: string; Icon: any }> = {
  customer: { name: '2QT', sub: 'Cooked Fresh, Daily', color: '#FF4500', Icon: ChefHat }, // Matching the exact orange from the mockup
  rider: { name: '2QT CAPTAIN', sub: 'Rider Portal', color: tokens.colors.textPrimary, Icon: Bike },
  kitchen: { name: '2QT PARTNER', sub: 'Kitchen Command', color: '#0E7490', Icon: Flame },
  admin: { name: '2QT ADMIN', sub: 'Operations Deck', color: tokens.colors.danger, Icon: ShieldCheck },
};

const LoginScreen = ({ navigation }: any) => {
  const [phone, setPhone] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [devRole, setDevRole] = useState(BUILD_ROLE);
  const [showWidget, setShowWidget] = useState(false);
  const dispatch = useDispatch();

  const globalLocation = useSelector((state: RootState) => state.app.globalLocation);

  // MSG91 widget handles phone entry + OTP send + OTP verify entirely on-device (its own
  // modal, shown below) and hands back an access-token here — no separate OTP-entry screen
  // needed for this path.
  const widgetVerifyMutation = useMutation({
    mutationFn: (accessToken: string) => api.post('/auth/verify-widget-token', {
      accessToken,
      referralCode: referralCode.trim().toUpperCase(),
      appRole: devRole === 'kitchen' ? 'chef' : devRole,
      lat: globalLocation?.latitude,
      lng: globalLocation?.longitude,
    }),
    onSuccess: (data) => {
      dispatch(setAuth({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken }));
      connectSocket(data.accessToken);
    },
    onError: () => {
      Alert.alert('Error', 'Could not verify your phone. Please try again.');
    },
  });

  const handleSendOTP = () => {
    if (phone.length !== 10) return;
    setShowWidget(true);
  };

  const handleWidgetCompletion = (result: any) => {
    setShowWidget(false);
    if (result?.success) {
      widgetVerifyMutation.mutate(result.message);
    } else if (result?.message) {
      Alert.alert('Verification Failed', result.message);
    }
  };

  const branding = BRANDING[devRole] || BRANDING.customer;
  const Icon = branding.Icon;

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
    >
      <StatusBar barStyle="dark-content" backgroundColor={styles.container.backgroundColor} />
      
      <View style={styles.content}>
        
        <Animated.View entering={ZoomIn.duration(800).springify()} style={styles.logoWrapper}>
          <View style={[styles.logoCard, { backgroundColor: branding.color }]}>
            <Icon color="#FFFFFF" size={48} strokeWidth={2} />
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
          <TextField
            leftAdornment={<Text style={styles.countryCodeText}>+91</Text>}
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

        <Animated.View entering={FadeInUp.duration(600).delay(300).springify()} style={styles.bottomWrapper}>
          {phone.length === 10 ? (
            <Button
              label="SEND VERIFICATION CODE"
              onPress={handleSendOTP}
              loading={widgetVerifyMutation.isPending}
              style={[styles.actionBtn, { backgroundColor: branding.color }]}
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

      <DefaultWidget
        visible={showWidget}
        onClose={() => setShowWidget(false)}
        onCompletion={handleWidgetCompletion}
        widgetId={ENV.MSG91_WIDGET_ID}
        tokenAuth={ENV.MSG91_WIDGET_TOKEN_AUTH}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  content: {
    flex: 1,
    padding: tokens.spacing.xxl,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  logoWrapper: {
    marginBottom: tokens.spacing.xxl,
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
    color: '#FFFFFF',
  },
});

export default LoginScreen;
