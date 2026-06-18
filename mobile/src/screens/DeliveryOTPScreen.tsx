import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  Alert, StyleSheet, StatusBar, Pressable,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { ArrowLeft, ShieldCheck } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const G = {
  bg: '#070F0C', surface: '#0F1F18', card: '#152318',
  accent: '#10B981', accentDim: 'rgba(16,185,129,0.12)',
  white: '#FFFFFF', muted: '#6B9E85', border: 'rgba(16,185,129,0.15)',
  danger: '#EF4444',
};

const DeliveryOTPScreen = ({ route, navigation }: any) => {
  const { orderId } = route.params;
  const insets = useSafeAreaInsets();
  const [otp, setOtp] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const queryClient = useQueryClient();

  const verifyMutation = useMutation({
    mutationFn: () => api.post('/riders/verify-otp', { orderId, otp }),
    onSuccess: () => {
      Alert.alert('Delivered!', 'Order successfully delivered.', [
        {
          text: 'Done', onPress: () => {
            queryClient.invalidateQueries({ queryKey: ['rider-active-order'] });
            queryClient.invalidateQueries({ queryKey: ['rider-earnings'] });
            navigation.navigate('RiderHome');
          },
        },
      ]);
    },
    onError: () => {
      Alert.alert('Wrong Code', 'Ask the customer to check their OTP again.');
      setOtp('');
    },
  });

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <ArrowLeft size={20} color={G.white} />
        </TouchableOpacity>
      </View>

      {/* Icon + title */}
      <View style={styles.heroSection}>
        <View style={styles.iconWrap}>
          <ShieldCheck size={40} color={G.accent} />
        </View>
        <Text style={styles.title}>Enter Delivery OTP</Text>
        <Text style={styles.subtitle}>Ask the customer for their 6-digit code to confirm delivery.</Text>
      </View>

      {/* OTP boxes */}
      <Pressable style={styles.otpWrapper} onPress={() => inputRef.current?.focus()}>
        <View style={styles.boxRow}>
          {Array.from({ length: 6 }).map((_, i) => {
            const char = otp[i] || '';
            const isCurrent = i === otp.length && focused;
            const filled = char.length > 0;
            return (
              <View
                key={i}
                style={[
                  styles.otpBox,
                  filled && styles.otpBoxFilled,
                  isCurrent && styles.otpBoxActive,
                ]}
              >
                {isCurrent ? <View style={styles.cursor} /> : <Text style={styles.otpChar}>{char}</Text>}
              </View>
            );
          })}
        </View>
        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          keyboardType="numeric"
          maxLength={6}
          value={otp}
          onChangeText={t => setOtp(t.replace(/\D/g, ''))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoFocus
        />
      </Pressable>

      {/* Confirm button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[styles.confirmBtn, (otp.length < 6 || verifyMutation.isPending) && styles.confirmBtnDisabled]}
          onPress={() => verifyMutation.mutate()}
          disabled={otp.length < 6 || verifyMutation.isPending}
          activeOpacity={0.9}
        >
          {verifyMutation.isPending
            ? <ActivityIndicator color={G.white} />
            : <Text style={styles.confirmBtnText}>Confirm Delivery</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: G.bg },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  backBtn: {
    width: 40, height: 40, borderRadius: 14, backgroundColor: G.surface,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: G.border,
  },
  heroSection: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  iconWrap: {
    width: 88, height: 88, borderRadius: 28, backgroundColor: G.accentDim,
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
    borderWidth: 1, borderColor: G.border,
    shadowColor: G.accent, shadowOpacity: 0.2, shadowRadius: 20, elevation: 8,
  },
  title: { color: G.white, fontSize: 28, fontWeight: '900', textAlign: 'center', marginBottom: 10 },
  subtitle: { color: G.muted, fontSize: 14, textAlign: 'center', lineHeight: 22 },

  otpWrapper: { paddingHorizontal: 24, marginBottom: 32 },
  boxRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  otpBox: {
    flex: 1, height: 62, borderRadius: 16,
    backgroundColor: G.surface, borderWidth: 1.5, borderColor: G.border,
    alignItems: 'center', justifyContent: 'center',
  },
  otpBoxActive: {
    borderColor: G.accent,
    shadowColor: G.accent, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  otpBoxFilled: { borderColor: 'rgba(16,185,129,0.4)', backgroundColor: G.card },
  otpChar: { color: G.white, fontSize: 24, fontWeight: '900' },
  cursor: { width: 2, height: 26, backgroundColor: G.accent },
  hiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1 },

  footer: {
    backgroundColor: G.surface, paddingHorizontal: 20, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: G.border,
  },
  confirmBtn: {
    backgroundColor: G.accent, borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: G.accent, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  confirmBtnDisabled: { backgroundColor: G.card, shadowOpacity: 0 },
  confirmBtnText: { color: G.white, fontSize: 15, fontWeight: '800' },
});

export default DeliveryOTPScreen;
