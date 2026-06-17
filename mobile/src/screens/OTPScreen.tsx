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

const OTPScreen = ({ route, navigation }: any) => {
  const { phone, referralCode, devOtp, devRole, lat, lng } = route.params;
  const [otp, setOtp] = useState('');
  const [timer, setTimer] = useState(30);
  const dispatch = useDispatch();
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    if (devOtp) {
      setOtp(devOtp);
      setTimeout(() => verifyMutation.mutate(devOtp), 500);
    }

    if (Platform.OS === 'android') {
      RNOtpVerify.getOtp()
        .then(() => RNOtpVerify.addListener(otpHandler))
        .catch((e) => console.log('OTP Verify error', e));
    }

    return () => {
      clearInterval(interval);
      if (Platform.OS === 'android') {
        RNOtpVerify.removeListener();
      }
    };
  }, [devOtp]);

  const otpHandler = (message: string) => {
    if (message && message !== 'Timeout Error') {
      const match = /(\d{6})/.exec(message);
      if (match && match[1]) {
        const code = match[1];
        setOtp(code);
        verifyMutation.mutate(code);
        RNOtpVerify.removeListener();
      }
    }
  };

  const verifyMutation = useMutation({
    mutationFn: (code: string) => api.post('/auth/verify-otp', { phone, otp: code, referralCode, appRole: devRole, lat, lng }),
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
      Alert.alert('Resent', 'A new OTP has been sent to your phone.');
    },
  });

  const handleOtpChange = (text: string) => {
    setOtp(text);
    if (text.length === 6) {
      verifyMutation.mutate(text);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Verify Phone</Text>
        <Text style={styles.subText}>Enter the 6-digit code sent to</Text>
        <Text style={styles.phoneText}>
          +{phone.slice(0, 2)} {phone.slice(2, 7)} {phone.slice(7)}
        </Text>

        <TextInput
          ref={inputRef}
          style={[styles.otpInput, verifyMutation.isPending && styles.otpInputBusy]}
          placeholder="000000"
          placeholderTextColor={colors.border}
          keyboardType="numeric"
          maxLength={6}
          value={otp}
          onChangeText={handleOtpChange}
          autoFocus
          editable={!verifyMutation.isPending}
        />

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
  otpInput: {
    width: '100%',
    height: 76,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.xl,
    marginTop: spacing.xxxl,
    textAlign: 'center',
    fontSize: 32,
    fontFamily: fontFamily.black,
    letterSpacing: 10,
    color: colors.ink,
  },
  otpInputBusy: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
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
  },
  timerText: {
    color: colors.inkFaint,
    fontFamily: fontFamily.extrabold,
    textTransform: 'uppercase',
    fontSize: 10,
    letterSpacing: 1,
  },
  resendBtnText: {
    color: colors.primary,
    fontFamily: fontFamily.extrabold,
    textTransform: 'uppercase',
    fontSize: 10,
    letterSpacing: 1,
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
