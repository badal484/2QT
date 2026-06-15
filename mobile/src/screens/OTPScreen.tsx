import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, NativeModules, Platform } from 'react-native';
import RNOtpVerify from 'react-native-otp-verify';
import { useDispatch } from 'react-redux';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client';
import { setAuth } from '../store/slices/authSlice';
import { connectSocket } from '../socket/client';

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
    onError: (_error: any) => {
      Alert.alert('Invalid OTP', 'The code you entered is incorrect.');
      setOtp('');
      inputRef.current?.focus();
    }
  });

  const resendMutation = useMutation({
    mutationFn: () => api.post('/auth/send-otp', { phone }),
    onSuccess: () => {
      setTimer(30);
      Alert.alert('Resent', 'A new OTP has been sent to your phone.');
    }
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
        <Text style={styles.phoneText}>+{phone.slice(0, 2)} {phone.slice(2, 7)} {phone.slice(7)}</Text>

        <TextInput
          ref={inputRef}
          style={styles.otpInput}
          placeholder="000000"
          placeholderTextColor="#E5E7EB"
          keyboardType="numeric"
          maxLength={6}
          value={otp}
          onChangeText={handleOtpChange}
          autoFocus
          editable={!verifyMutation.isPending}
        />

        {verifyMutation.isPending && (
          <ActivityIndicator color="#FF6B35" style={{ marginTop: 24 }} />
        )}

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

        <TouchableOpacity 
          style={styles.changePhoneBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.changePhoneText}>Change Phone Number</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 32,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: '#1A1A2E',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
  },
  subText: {
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '500',
    fontSize: 16,
  },
  phoneText: {
    color: '#FF6B35',
    fontWeight: '900',
    fontSize: 20,
    marginTop: 4,
    letterSpacing: 1,
  },
  otpInput: {
    width: '100%',
    height: 80,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    borderRadius: 24,
    marginTop: 48,
    textAlign: 'center',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 12,
    color: '#1A1A2E',
  },
  resendRow: {
    marginTop: 32,
    flexDirection: 'row',
    alignItems: 'center',
  },
  resendLabel: {
    color: '#9ca3af',
    fontWeight: '500',
  },
  timerText: {
    color: '#d1d5db',
    fontWeight: '900',
    textTransform: 'uppercase',
    fontSize: 10,
    letterSpacing: 1,
  },
  resendBtnText: {
    color: '#FF6B35',
    fontWeight: '900',
    textTransform: 'uppercase',
    fontSize: 10,
    letterSpacing: 1,
  },
  changePhoneBtn: {
    marginTop: 48,
  },
  changePhoneText: {
    color: '#d1d5db',
    fontWeight: '900',
    textTransform: 'uppercase',
    fontSize: 10,
    letterSpacing: 1.5,
  },
});

export default OTPScreen;
