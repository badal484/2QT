import { tokens } from '../theme/tokens';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
let RNOtpVerify: any;
if (Platform.OS === 'android') {
  RNOtpVerify = require('react-native-otp-verify').default;
}
import { useDispatch } from 'react-redux';
import { useMutation } from '@tanstack/react-query';
import { OTPWidget } from '@msg91comm/sendotp-react-native';
import { api } from '../api/client';
import { setAuth } from '../store/slices/authSlice';
import { connectSocket } from '../socket/client';
import { haptics } from '../utils/haptics';
import { PressableScale } from '../components/ui/internal/PressableScale';
import { useFeedback } from '../context/FeedbackContext';

import { registerDeviceToken } from '../services/push';

const OTPScreen = ({ route, navigation }: any) => {
  const { phone, referralCode, devRole, lat, lng } = route.params;
  const [otp, setOtp] = useState('');
  const [timer, setTimer] = useState(30);
  const [reqId, setReqId] = useState<string>(route.params.reqId);
  const dispatch = useDispatch();
  const inputRef = useRef<TextInput>(null);
  const { showDialog } = useFeedback();

  const startAndroidAutoRead = () => {
    if (Platform.OS === 'android') {
      RNOtpVerify.getOtp()
        .then(() => RNOtpVerify.addListener(otpHandler))
        .catch((e) => console.log('OTP Verify error', e));
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    startAndroidAutoRead();

    return () => {
      clearInterval(interval);
      if (Platform.OS === 'android') {
        RNOtpVerify.removeListener();
      }
    };
  }, []);

  const otpHandler = (message: string) => {
    if (message && message !== 'Timeout Error' && !verifyMutation.isPending) {
      // Word-bounded so a longer embedded number (e.g. a phone number) can't match its first 6 digits
      const match = /\b(\d{6})\b/.exec(message);
      if (match && match[1]) {
        const code = match[1];
        setOtp(code);
        verifyMutation.mutate(code);
        RNOtpVerify.removeListener();
      }
    }
  };

  const verifyMutation = useMutation({
    mutationFn: async (code: string) => {
      const response: any = await OTPWidget.verifyOTP({ reqId, otp: code });
      if (response?.type !== 'success') {
        throw new Error(response?.message || 'The code you entered is incorrect.');
      }
      const accessToken = response.message || response.access_token || response.accessToken;
      if (!accessToken) throw new Error('Verification did not return an access token.');
      return api.post('/auth/verify-widget-token', { accessToken, referralCode, appRole: devRole, lat, lng, platform: 'app' });
    },
    onSuccess: (data) => {
      haptics.success();
      dispatch(setAuth({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken }));
      connectSocket(data.accessToken);
      registerDeviceToken().catch(() => {});
    },
    onError: (err: any) => {
      haptics.error();
      const msg: string = err?.message || 'The code you entered is incorrect.';
      setOtp('');
      // MSG91 marks a reqId+otp pair as consumed the moment verifyOTP succeeds, even if OUR
      // own backend step after it fails for an unrelated reason (e.g. prelaunch gate). Retyping
      // the same code can never work again in that case -- only a fresh OTP will.
      if (/already verif/i.test(msg)) {
        showDialog({ title: 'Code already used', message: 'That code was already verified. Please tap "Resend Now" to get a new one.', confirmText: 'Okay', type: 'warning' });
      } else {
        showDialog({ title: 'Error', message: msg, confirmText: 'Okay', type: 'error' });
        inputRef.current?.focus();
      }
    },
  });

  const resendMutation = useMutation({
    mutationFn: async () => {
      const response: any = await OTPWidget.retryOTP({ reqId });
      if (response?.type !== 'success') {
        throw new Error(response?.message || 'Could not resend the code.');
      }
      // If MSG91 issues a fresh reqId on retry, switch to it -- otherwise keep the current one.
      const newReqId = response.message || response.reqId || response.request_id;
      if (newReqId) setReqId(newReqId);
      return { reqId: newReqId || reqId };
    },
    onSuccess: (data) => {
      haptics.success();
      setReqId(data.reqId);
      setTimer(30);
      setOtp('');
      startAndroidAutoRead();
      showDialog({ title: 'Resent', message: 'A new OTP has been sent to your phone.', confirmText: 'Okay', type: 'success' });
    },
    onError: (err: any) => {
      haptics.error();
      const msg: string = err?.message || 'Could not resend the code. Please try again.';
      // Same MSG91 quirk as verifyMutation above -- surface the same friendly copy instead
      // of the raw provider string when it's this specific, recognizable condition.
      if (/already verif/i.test(msg)) {
        showDialog({ title: 'Code already used', message: 'That code was already verified. Please tap "Resend Now" again to get a fresh one.', confirmText: 'Okay', type: 'warning' });
      } else {
        showDialog({ title: 'Error', message: msg, confirmText: 'Okay', type: 'error' });
      }
    },
  });

  const handleOtpChange = (text: string) => {
    setOtp(text);
    if (text.length === 6 && !verifyMutation.isPending) {
      verifyMutation.mutate(text);
    }
  };

  const handlePressBoxes = () => {
    inputRef.current?.focus();
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title} allowFontScaling maxFontSizeMultiplier={1.3}>Verify Phone</Text>
        <Text style={styles.subText} allowFontScaling maxFontSizeMultiplier={1.4}>Enter the 6-digit code sent to</Text>
        <Text style={styles.phoneText} allowFontScaling maxFontSizeMultiplier={1.4}>
          +{phone.slice(0, 2)} {phone.slice(2, 7)} {phone.slice(7)}
        </Text>

        {/* Premium 6-Box OTP Input */}
        <View style={styles.otpWrapper}>
          <TextInput
            ref={inputRef}
            style={styles.hiddenInput}
            keyboardType="numeric"
            maxLength={6}
            value={otp}
            onChangeText={handleOtpChange}
            autoFocus
            editable={!verifyMutation.isPending}
            caretHidden={true}
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
          />
          <View pointerEvents="none" style={styles.otpContainer}>
            {Array(6)
              .fill(0)
              .map((_, index) => {
                const digit = otp[index] || '';
                const isFocused = otp.length === index;
                const hasDigit = digit !== '';

                return (
                  <View
                    key={index}
                    style={[
                      styles.otpBox,
                      hasDigit && styles.otpBoxFilled,
                      isFocused && styles.otpBoxFocused,
                      verifyMutation.isPending && styles.otpBoxDisabled,
                    ]}
                  >
                    <Text style={styles.otpBoxText} allowFontScaling={false}>{digit}</Text>
                    {isFocused && <View style={styles.cursor} />}
                  </View>
                );
              })}
          </View>
        </View>

        {verifyMutation.isPending && <ActivityIndicator color={tokens.colors.primary} style={styles.spinner} />}

        <View style={styles.resendRow}>
          <Text style={styles.resendLabel} allowFontScaling maxFontSizeMultiplier={1.4}>Didn't receive code? </Text>
          {timer > 0 ? (
            <Text style={styles.timerText} allowFontScaling maxFontSizeMultiplier={1.4}>Resend in {timer}s</Text>
          ) : (
            <PressableScale onPress={() => resendMutation.mutate()} style={styles.resendBtn} accessibilityRole="button" accessibilityLabel="Resend code">
              <Text style={styles.resendBtnText} allowFontScaling maxFontSizeMultiplier={1.4}>Resend Now</Text>
            </PressableScale>
          )}
        </View>

        <PressableScale style={styles.changePhoneBtn} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Change phone number">
          <Text style={styles.changePhoneText} allowFontScaling maxFontSizeMultiplier={1.4}>Change Phone Number</Text>
        </PressableScale>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
    padding: tokens.spacing.xxl,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: tokens.colors.textPrimary,
    fontSize: 30,
    fontFamily: tokens.typography.family.black,
    letterSpacing: -0.5,
  },
  subText: {
    color: tokens.colors.textSecondary,
    marginTop: tokens.spacing.sm,
    textAlign: 'center',
    fontFamily: tokens.typography.family.medium,
    fontSize: 15,
  },
  phoneText: {
    color: tokens.colors.primary,
    fontFamily: tokens.typography.family.extrabold,
    fontSize: 19,
    marginTop: tokens.spacing.xs,
    letterSpacing: 1,
  },
  otpWrapper: {
    width: '100%',
    position: 'relative',
    marginTop: tokens.spacing.xxxl,
    marginBottom: tokens.spacing.xl,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: tokens.spacing.sm,
  },
  otpBox: {
    width: 44,
    height: 56,
    borderWidth: 1.5,
    borderColor: tokens.colors.borderStrong,
    borderRadius: tokens.radii.md,
    backgroundColor: tokens.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...tokens.shadows.soft,
  },
  otpBoxFilled: {
    borderColor: tokens.colors.primary,
  },
  otpBoxFocused: {
    borderColor: tokens.colors.primary,
    borderWidth: 2,
    ...tokens.shadows.medium,
  },
  otpBoxDisabled: {
    backgroundColor: tokens.colors.surfaceMuted,
    opacity: 0.6,
  },
  otpBoxText: {
    fontSize: 22,
    fontFamily: tokens.typography.family.black,
    color: tokens.colors.textPrimary,
  },
  cursor: {
    position: 'absolute',
    bottom: 12,
    width: 12,
    height: 2,
    backgroundColor: tokens.colors.primary,
  },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    zIndex: 10,
  },
  spinner: {
    marginTop: tokens.spacing.xl,
  },
  resendRow: {
    marginTop: tokens.spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
  },
  resendLabel: {
    color: tokens.colors.textSecondary,
    fontFamily: tokens.typography.family.medium,
    fontSize: 14,
  },
  timerText: {
    color: tokens.colors.textTertiary,
    fontFamily: tokens.typography.family.bold,
    fontSize: 14,
  },
  resendBtn: {
    minHeight: 48,
    justifyContent: 'center',
  },
  resendBtnText: {
    color: tokens.colors.primary,
    fontFamily: tokens.typography.family.extrabold,
    fontSize: 14,
  },
  changePhoneBtn: {
    marginTop: tokens.spacing.xxxl,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  changePhoneText: {
    color: tokens.colors.textTertiary,
    fontFamily: tokens.typography.family.extrabold,
    textTransform: 'uppercase',
    fontSize: 10,
    letterSpacing: 1.5,
  },
});

export default OTPScreen;
