import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import RNOtpVerify from 'react-native-otp-verify';
import { useDispatch } from 'react-redux';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client';
import { setAuth } from '../store/slices/authSlice';
import { connectSocket } from '../socket/client';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import { radius, spacing } from '../theme/spacing';
import { getConfirmationResult } from '../utils/firebaseAuthHelper';

const OTPScreen = ({ route, navigation }: any) => {
  const { phone, referralCode, devOtp, devRole, lat, lng } = route.params;
  const [otp, setOtp] = useState('');
  const [timer, setTimer] = useState(30);
  const dispatch = useDispatch();
  const inputRef = useRef<TextInput>(null);

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

    if (devOtp) {
      setOtp(devOtp);
      setTimeout(() => {
        if (!verifyMutation.isPending) verifyMutation.mutate(devOtp);
      }, 500);
    }

    startAndroidAutoRead();

    return () => {
      clearInterval(interval);
      if (Platform.OS === 'android') {
        RNOtpVerify.removeListener();
      }
    };
  }, [devOtp]);

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
      // Send all OTP verification to our backend MSG91 endpoint
      return api.post('/auth/verify-otp', { phone, otp: code, referralCode, appRole: devRole, lat, lng });
    },
    onSuccess: (data) => {
      dispatch(setAuth({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken }));
      connectSocket(data.accessToken);
    },
    onError: (err: any) => {
      const msg = err?.message || 'The code you entered is incorrect.';
      Alert.alert('Error', msg);
      setOtp('');
      inputRef.current?.focus();
    },
  });

  const resendMutation = useMutation({
    mutationFn: () => api.post('/auth/send-otp', { phone }),
    onSuccess: () => {
      setTimer(30);
      setOtp('');
      startAndroidAutoRead();
      Alert.alert('Resent', 'A new OTP has been sent to your phone.');
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.message || 'Could not resend the code. Please try again.');
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
        <Text style={styles.title}>Verify Phone</Text>
        <Text style={styles.subText}>Enter the 6-digit code sent to</Text>
        <Text style={styles.phoneText}>
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
                    <Text style={styles.otpBoxText}>{digit}</Text>
                    {isFocused && <View style={styles.cursor} />}
                  </View>
                );
              })}
          </View>
        </View>

        {verifyMutation.isPending && <ActivityIndicator color={colors.primary} style={styles.spinner} />}

        <View style={styles.resendRow}>
          <Text style={styles.resendLabel}>Didn't receive code? </Text>
          {timer > 0 ? (
            <Text style={styles.timerText}>Resend in {timer}s</Text>
          ) : (
            <TouchableOpacity onPress={() => resendMutation.mutate()}>
              <Text style={styles.resendBtnText}>Resend Now</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={styles.changePhoneBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.changePhoneText}>Change Phone Number</Text>
        </TouchableOpacity>
      </View>
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
  title: {
    color: colors.ink,
    fontSize: 30,
    fontFamily: fontFamily.black,
    letterSpacing: -0.5,
  },
  subText: {
    color: colors.inkMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
    fontFamily: fontFamily.medium,
    fontSize: 15,
  },
  phoneText: {
    color: colors.primary,
    fontFamily: fontFamily.extrabold,
    fontSize: 19,
    marginTop: spacing.xs,
    letterSpacing: 1,
  },
  otpWrapper: {
    width: '100%',
    position: 'relative',
    marginTop: spacing.xxxl,
    marginBottom: spacing.xl,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: spacing.sm,
  },
  otpBox: {
    width: 44,
    height: 56,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  otpBoxFilled: {
    borderColor: colors.primary,
  },
  otpBoxFocused: {
    borderColor: colors.primary,
    borderWidth: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  otpBoxDisabled: {
    backgroundColor: colors.surfaceMuted,
    opacity: 0.6,
  },
  otpBoxText: {
    fontSize: 22,
    fontFamily: fontFamily.black,
    color: colors.ink,
  },
  cursor: {
    position: 'absolute',
    bottom: 12,
    width: 12,
    height: 2,
    backgroundColor: colors.primary,
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
    marginTop: spacing.xl,
  },
  resendRow: {
    marginTop: spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
  },
  resendLabel: {
    color: colors.inkMuted,
    fontFamily: fontFamily.medium,
    fontSize: 14,
  },
  timerText: {
    color: colors.inkFaint,
    fontFamily: fontFamily.bold,
    fontSize: 14,
  },
  resendBtnText: {
    color: colors.primary,
    fontFamily: fontFamily.extrabold,
    fontSize: 14,
  },
  changePhoneBtn: {
    marginTop: spacing.xxxl,
  },
  changePhoneText: {
    color: colors.inkFaint,
    fontFamily: fontFamily.extrabold,
    textTransform: 'uppercase',
    fontSize: 10,
    letterSpacing: 1.5,
  },
});

export default OTPScreen;
