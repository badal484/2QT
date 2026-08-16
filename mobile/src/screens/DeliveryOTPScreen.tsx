import { tokens } from '../theme/tokens';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, Image,
  Alert, StyleSheet, StatusBar, Animated, PermissionsAndroid, Platform,
  KeyboardAvoidingView, ScrollView, BackHandler,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { ArrowLeft, ShieldCheck, CheckCircle, Camera, RefreshCw } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { launchCamera } from 'react-native-image-picker';
import { uploadToImageKit } from '../utils/imageKit';
import { useFeedback } from '../context/FeedbackContext';

const R = {
  orange: '#FC4603', orangeLight: '#FFF0E8', orangeMid: '#FFE0C0',
  green: '#1BA672', greenLight: '#E8F8F1',
  ink: '#282C3F', gray: '#686B78', muted: '#93959F',
  border: '#E9E9EB', bg: '#F8F8F8', white: tokens.colors.surface,
  red: '#E53935', redLight: '#FFEBEE',
};

// ─── Success screen ────────────────────────────────────────────────────────────
const SuccessScreen = ({ onDone, doneLabel = 'Back to Dashboard' }: { onDone: () => void; doneLabel?: string }) => {
  const insets = useSafeAreaInsets();
  const scale = useRef(new Animated.Value(0.5)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scale, { toValue: 1, tension: 50, friction: 6, useNativeDriver: true }).start();
    Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, []);

  return (
    <View style={[suc.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <StatusBar barStyle="dark-content" backgroundColor={R.bg} />
      
      <View style={suc.hero}>
        <Animated.View style={[suc.iconWrap, { transform: [{ scale }], opacity }]}>
          <CheckCircle size={52} color={R.green} strokeWidth={2.5} />
        </Animated.View>
        <Animated.View style={{ opacity, alignItems: 'center', marginTop: 24, transform: [{ translateY: opacity.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
          <Text style={suc.title}>Delivered!</Text>
          <Text style={suc.sub}>Order successfully handed to the customer.</Text>
        </Animated.View>
      </View>

      <Animated.View style={[suc.bottomSection, { opacity, transform: [{ translateY: opacity.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
        <View style={suc.confirmBox}>
          <CheckCircle size={16} color={R.green} />
          <Text style={suc.confirmText}>OTP verified · Delivery confirmed</Text>
        </View>
        <TouchableOpacity style={suc.btn} onPress={onDone} activeOpacity={0.9}>
          <Text style={suc.btnText}>{doneLabel}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const suc = StyleSheet.create({
  root: { flex: 1, backgroundColor: R.bg, alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconWrap: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: R.greenLight,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#B7E8D7',
  },
  title: { color: R.ink, fontSize: 32, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5 },
  sub: { color: R.gray, fontSize: 15, textAlign: 'center', lineHeight: 22, marginTop: 8, paddingHorizontal: 20 },
  bottomSection: { width: '100%', alignItems: 'center', gap: 20 },
  confirmBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: R.white, borderWidth: 1, borderColor: R.border,
    paddingHorizontal: 20, paddingVertical: 14, borderRadius: 16,
    width: '100%', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 8, elevation: 2,
  },
  confirmText: { color: R.ink, fontWeight: '700', fontSize: 13, letterSpacing: 0.2 },
  btn: {
    width: '100%', backgroundColor: R.ink,
    paddingVertical: 18, borderRadius: 16, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 4, shadowOffset: { width: 0, height: 4 },
  },
  btnText: { color: R.white, fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
const RESEND_COOLDOWN = 30;

const DeliveryOTPScreen = ({ route, navigation }: any) => {
  const { orderId, displayId } = route.params;
  const insets = useSafeAreaInsets();
  const { showDialog } = useFeedback();
  const [otp, setOtp] = useState('');
  const [focused, setFocused] = useState(false);
  const [delivered, setDelivered] = useState(false);
  const [podPhotoUri, setPodPhotoUri] = useState<string | null>(null);
  const [podPhotoUrl, setPodPhotoUrl] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRef = useRef<TextInput>(null);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queryClient = useQueryClient();
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const handleDone = () => {
    queryClient.invalidateQueries({ queryKey: ['rider-active-order'] });
    queryClient.invalidateQueries({ queryKey: ['rider-earnings'] });
    queryClient.invalidateQueries({ queryKey: ['cash-in-hand'] });
    navigation.reset({
      index: 0,
      routes: [{ name: 'RiderTabs' }],
    });
  };

  useEffect(() => {
    if (delivered) {
      const onBackPress = () => {
        handleDone();
        return true; // prevent default behavior
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }
  }, [delivered]);

  const startCooldown = useCallback(() => {
    setResendCooldown(RESEND_COOLDOWN);
    cooldownRef.current = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const captureProofPhoto = async () => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          showDialog({ title: 'Permission Denied', message: 'Camera permission is required to take a photo.', confirmText: 'Okay', type: 'error' });
          return;
        }
      }
      const result = await launchCamera({ mediaType: 'photo', quality: 0.7, saveToPhotos: false });
      if (result.didCancel || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setPodPhotoUri(asset.uri ?? null);
      setPodPhotoUrl(null);
      setIsUploadingPhoto(true);
      try {
        const uploaded = await uploadToImageKit(asset, 'pod');
        setPodPhotoUrl(uploaded.url);
      } catch {
        showDialog({ title: 'Upload Failed', message: 'Could not upload the photo. You can still confirm delivery without it.', confirmText: 'Okay', type: 'warning' });
        setPodPhotoUri(null);
      } finally {
        setIsUploadingPhoto(false);
      }
    } catch {
      showDialog({ title: 'Error', message: 'Could not open camera.', confirmText: 'Okay', type: 'error' });
    }
  };

  const verifyMutation = useMutation({
    mutationFn: () => api.post('/riders/verify-otp', { orderId, otp, podPhotoUrl }),
    onSuccess: () => setDelivered(true),
    onError: () => {
      shake();
      showDialog({ title: 'Wrong Code', message: 'The OTP is incorrect. Ask the customer to check their app and try again.', confirmText: 'Okay', type: 'error' });
      setOtp('');
    },
  });

  const resendMutation = useMutation({
    mutationFn: () => api.post('/riders/resend-otp', { orderId }),
    onSuccess: () => {
      startCooldown();
      showDialog({ title: 'OTP Resent ✅', message: 'The customer has been sent their OTP again via notification.', confirmText: 'Okay', type: 'success' });
    },
    onError: () => {
      showDialog({ title: 'Failed', message: 'Could not resend the OTP. Please try again.', confirmText: 'Okay', type: 'error' });
    },
  });

  const handleResend = () => {
    if (resendCooldown > 0 || resendMutation.isPending) return;
    resendMutation.mutate();
  };

  if (delivered) return <SuccessScreen onDone={handleDone} doneLabel="Back to Dashboard" />;

  // Photo is optional — never block confirmation on upload; show a warning row instead
  const isBlocked = otp.length < 6 || verifyMutation.isPending;

  return (
    <KeyboardAvoidingView
      style={[st.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor={R.white} />

      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity style={st.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <ArrowLeft size={20} color={R.ink} />
        </TouchableOpacity>
        {displayId && <Text style={st.orderId}>{displayId}</Text>}
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: focused ? 300 : 20 }}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {/* Hero */}
        <View style={st.hero}>
          <View style={st.iconWrap}>
            <ShieldCheck size={40} color={R.orange} />
          </View>
          <Text style={st.title}>Enter Delivery OTP</Text>
          <Text style={st.subtitle}>Ask the customer for their 6-digit code to confirm delivery.</Text>
        </View>

        {/* OTP boxes */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => inputRef.current?.focus()}
          style={{ width: '100%' }}
        >
          <Animated.View style={[st.otpWrapper, { transform: [{ translateX: shakeAnim }] }]}>
            <View style={st.boxRow} pointerEvents="none">
              {Array.from({ length: 6 }).map((_, i) => {
                const char = otp[i] || '';
                const isCurrent = i === otp.length && focused;
                const filled = char.length > 0;
                return (
                  <View key={i} style={[st.otpBox, filled && st.otpBoxFilled, isCurrent && st.otpBoxActive]}>
                    {isCurrent ? <View style={st.cursor} /> : <Text style={[st.otpChar, filled && { color: R.orange }]}>{char}</Text>}
                  </View>
                );
              })}
            </View>
            <TextInput
              ref={inputRef}
              style={st.hiddenInput}
              keyboardType="number-pad"
              caretHidden={true}
              maxLength={6}
              value={otp}
              onChangeText={(t: string) => setOtp(t.replace(/\D/g, ''))}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              autoFocus
            />
          </Animated.View>
        </TouchableOpacity>

        {/* Resend OTP */}
        <View style={st.resendRow}>
          <Text style={st.resendHint}>Customer didn't receive the OTP?</Text>
          <TouchableOpacity
            onPress={handleResend}
            disabled={resendCooldown > 0 || resendMutation.isPending}
            style={[st.resendBtn, (resendCooldown > 0 || resendMutation.isPending) && st.resendBtnDisabled]}
            activeOpacity={0.7}
          >
            {resendMutation.isPending ? (
              <ActivityIndicator size="small" color={R.orange} />
            ) : (
              <RefreshCw size={14} color={resendCooldown > 0 ? R.muted : R.orange} />
            )}
            <Text style={[st.resendBtnText, resendCooldown > 0 && { color: R.muted }]}>
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* POD photo */}
        <View style={st.podSection}>
          <Text style={st.podLabel}>
            Proof of Delivery <Text style={st.podOptional}>(optional)</Text>
          </Text>
          {podPhotoUri ? (
            <View style={st.podPreviewRow}>
              <Image source={{ uri: podPhotoUri }} style={st.podThumb} />
              <View style={st.podPreviewInfo}>
                {isUploadingPhoto ? (
                  <>
                    <ActivityIndicator color={R.orange} size="small" />
                    <Text style={st.podUploadingText}>Uploading…</Text>
                  </>
                ) : podPhotoUrl ? (
                  <>
                    <CheckCircle size={16} color={R.green} />
                    <Text style={st.podUploadedText}>Photo uploaded ✓</Text>
                  </>
                ) : null}
                <TouchableOpacity onPress={captureProofPhoto} style={st.retakeBtn}>
                  <Text style={st.retakeBtnText}>Retake</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={st.podCaptureBtn} onPress={captureProofPhoto} activeOpacity={0.85}>
              <Camera size={20} color={R.orange} />
              <Text style={st.podCaptureBtnText}>Take Photo</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Footer */}
      <View style={[st.footer, { paddingBottom: insets.bottom + 12 }]}>
        {isUploadingPhoto && (
          <Text style={st.uploadingWarn}>Waiting for photo upload…</Text>
        )}
        <TouchableOpacity
          style={[st.confirmBtn, isBlocked && st.confirmBtnDisabled]}
          onPress={() => verifyMutation.mutate()}
          disabled={isBlocked}
          activeOpacity={0.9}
        >
          {verifyMutation.isPending
            ? <ActivityIndicator color={R.white} />
            : <Text style={st.confirmBtnText}>Confirm Delivery</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: R.white },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: R.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: R.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  orderId: { fontSize: 14, fontWeight: '800', color: R.muted },

  hero: { alignItems: 'center', paddingHorizontal: 32, paddingVertical: 28 },
  iconWrap: {
    width: 90, height: 90, borderRadius: 28, backgroundColor: R.orangeLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
    shadowColor: R.orange, shadowOpacity: 0.15, shadowRadius: 16, elevation: 4,
  },
  title: { color: R.ink, fontSize: 26, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
  subtitle: { color: R.muted, fontSize: 14, textAlign: 'center', lineHeight: 22 },

  otpWrapper: { paddingHorizontal: 20, marginBottom: 16 },
  boxRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  otpBox: {
    flex: 1, height: 64, borderRadius: 16,
    backgroundColor: R.bg, borderWidth: 1.5, borderColor: R.border,
    alignItems: 'center', justifyContent: 'center',
  },
  otpBoxActive: {
    borderColor: R.orange,
    shadowColor: R.orange, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
    backgroundColor: R.orangeLight,
  },
  otpBoxFilled: { borderColor: R.orangeMid, backgroundColor: R.orangeLight },
  otpChar: { color: R.ink, fontSize: 24, fontWeight: '900' },
  cursor: { width: 2, height: 28, backgroundColor: R.orange },
  hiddenInput: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    opacity: 0.01, color: 'transparent', backgroundColor: 'transparent', fontSize: 1, zIndex: 10,
  },

  resendRow: {
    alignItems: 'center', gap: 10, marginBottom: 24, paddingHorizontal: 20,
  },
  resendHint: { color: R.muted, fontSize: 13, textAlign: 'center' },
  resendBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 100,
    backgroundColor: R.orangeLight, borderWidth: 1.5, borderColor: R.orangeMid,
  },
  resendBtnDisabled: {
    backgroundColor: R.bg, borderColor: R.border,
  },
  resendBtnText: { color: R.orange, fontSize: 13, fontWeight: '700' },

  podSection: { paddingHorizontal: 20, marginBottom: 20 },
  podLabel: { color: R.ink, fontSize: 13, fontWeight: '700', marginBottom: 10 },
  podOptional: { color: R.muted, fontWeight: '400' },
  podCaptureBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: R.orangeLight, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18,
    borderWidth: 1.5, borderColor: '#FFD5A8', borderStyle: 'dashed',
  },
  podCaptureBtnText: { color: R.orange, fontSize: 14, fontWeight: '700' },
  podPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  podThumb: { width: 72, height: 72, borderRadius: 12, backgroundColor: R.bg },
  podPreviewInfo: { flex: 1, gap: 6 },
  podUploadingText: { color: R.muted, fontSize: 13 },
  podUploadedText: { color: R.green, fontSize: 13, fontWeight: '700' },
  retakeBtn: {
    alignSelf: 'flex-start', paddingVertical: 5, paddingHorizontal: 12,
    backgroundColor: R.bg, borderRadius: 8, borderWidth: 1, borderColor: R.border,
  },
  retakeBtnText: { color: R.gray, fontSize: 12, fontWeight: '600' },

  footer: {
    backgroundColor: R.white, paddingHorizontal: 20, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: R.border,
  },
  uploadingWarn: { color: R.muted, fontSize: 12, textAlign: 'center', marginBottom: 8 },
  confirmBtn: {
    backgroundColor: R.orange, borderRadius: 14, paddingVertical: 18,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: R.orange, shadowOpacity: 0.3, shadowRadius: 12, elevation: 5,
  },
  confirmBtnDisabled: { backgroundColor: R.border, shadowOpacity: 0, elevation: 0 },
  confirmBtnText: { color: R.white, fontSize: 15, fontWeight: '800' },
});

export default DeliveryOTPScreen;
