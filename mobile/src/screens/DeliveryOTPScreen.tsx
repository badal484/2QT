import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  Alert, StyleSheet, StatusBar, Pressable, Animated,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { ArrowLeft, ShieldCheck, CircleCheck } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const G = {
  bg: '#070F0C', surface: '#0F1F18', card: '#152318',
  accent: '#10B981', accentDim: 'rgba(16,185,129,0.12)',
  white: '#FFFFFF', muted: '#6B9E85', border: 'rgba(16,185,129,0.15)',
  danger: '#EF4444',
};

// ── Success screen ────────────────────────────────────────────────────────────
const SuccessScreen = ({ onDone }: { onDone: () => void }) => {
  const insets = useSafeAreaInsets();
  const scale = useRef(new Animated.Value(0.5)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Icon pop-in
    Animated.spring(scale, { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }).start();
    Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();

    // Ripple rings
    const pulse = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ).start();

    pulse(ring1, 0);
    pulse(ring2, 600);
  }, []);

  const ringStyle = (anim: Animated.Value) => ({
    position: 'absolute' as const,
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: G.accent,
    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }) }],
  });

  return (
    <View style={[suc.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={suc.hero}>
        {/* Ripple rings */}
        <Animated.View style={ringStyle(ring1)} />
        <Animated.View style={ringStyle(ring2)} />

        {/* Icon */}
        <Animated.View style={[suc.iconWrap, { transform: [{ scale }], opacity }]}>
          <CircleCheck size={52} color={G.accent} strokeWidth={1.8} />
        </Animated.View>

        <Animated.View style={{ opacity }}>
          <Text style={suc.title}>Delivered!</Text>
          <Text style={suc.sub}>Order successfully delivered to the customer.</Text>
        </Animated.View>
      </View>

      <Animated.View style={[suc.card, { opacity }]}>
        <CircleCheck size={18} color={G.accent} strokeWidth={2} />
        <Text style={suc.cardText}>OTP verified • Delivery confirmed</Text>
      </Animated.View>

      <TouchableOpacity style={suc.btn} onPress={onDone} activeOpacity={0.9}>
        <Text style={suc.btnText}>Back to Dashboard</Text>
      </TouchableOpacity>
    </View>
  );
};

const suc = StyleSheet.create({
  root: {
    flex: 1, backgroundColor: G.bg,
    alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 28,
  },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 },
  iconWrap: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderWidth: 1.5, borderColor: 'rgba(16,185,129,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: '#fff', fontSize: 34, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5 },
  sub: { color: G.muted, fontSize: 15, textAlign: 'center', lineHeight: 22, marginTop: 8 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.18)',
    paddingHorizontal: 20, paddingVertical: 14, borderRadius: 16,
    marginBottom: 20, width: '100%', justifyContent: 'center',
  },
  cardText: { color: G.accent, fontWeight: '700', fontSize: 13 },
  btn: {
    width: '100%', backgroundColor: G.accent,
    paddingVertical: 18, borderRadius: 18, alignItems: 'center',
    shadowColor: G.accent, shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});

// ── Main screen ───────────────────────────────────────────────────────────────
const DeliveryOTPScreen = ({ route, navigation }: any) => {
  const { orderId, isCashCod, amountPaise, displayId } = route.params;
  const insets = useSafeAreaInsets();
  const [otp, setOtp] = useState('');
  const [focused, setFocused] = useState(false);
  const [delivered, setDelivered] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const queryClient = useQueryClient();

  const handleDone = () => {
    queryClient.invalidateQueries({ queryKey: ['rider-active-order'] });
    queryClient.invalidateQueries({ queryKey: ['rider-earnings'] });
    // Cash COD → must submit cash to finance before going home
    if (isCashCod) {
      navigation.replace('CashSubmit', { orderId, amountPaise, displayId });
    } else {
      navigation.navigate('RiderHome');
    }
  };

  const verifyMutation = useMutation({
    mutationFn: () => api.post('/riders/verify-otp', { orderId, otp }),
    onSuccess: () => setDelivered(true),
    onError: () => {
      Alert.alert('Wrong Code', 'Ask the customer to check their OTP again.');
      setOtp('');
    },
  });

  if (delivered) return <SuccessScreen onDone={handleDone} />;

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
