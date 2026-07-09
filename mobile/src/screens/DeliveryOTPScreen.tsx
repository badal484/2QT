import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, Image,
  Alert, StyleSheet, StatusBar, Pressable, Animated,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { ArrowLeft, ShieldCheck, CheckCircle, Camera } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { launchCamera } from 'react-native-image-picker';
import { uploadToImageKit } from '../utils/imageKit';

const R = {
  orange: '#FC8019', orangeLight: '#FFF3E8',
  green: '#1BA672', greenLight: '#E8F8F1',
  ink: '#282C3F', gray: '#686B78', muted: '#93959F',
  border: '#E9E9EB', bg: '#F8F8F8', white: '#FFFFFF',
};

// ─── Success screen ─────────────────────────────────────────────────────────
const SuccessScreen = ({ onDone }: { onDone: () => void }) => {
  const insets = useSafeAreaInsets();
  const scale = useRef(new Animated.Value(0.5)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scale, { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }).start();
    Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
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
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: R.green,
    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }) }],
  });

  return (
    <View style={[suc.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <StatusBar barStyle="dark-content" backgroundColor={R.white} />

      <View style={suc.hero}>
        <Animated.View style={ringStyle(ring1)} />
        <Animated.View style={ringStyle(ring2)} />
        <Animated.View style={[suc.iconWrap, { transform: [{ scale }], opacity }]}>
          <CheckCircle size={52} color={R.green} strokeWidth={1.8} />
        </Animated.View>
        <Animated.View style={{ opacity, alignItems: 'center' }}>
          <Text style={suc.title}>Delivered!</Text>
          <Text style={suc.sub}>Order successfully handed to the customer.</Text>
        </Animated.View>
      </View>

      <Animated.View style={[suc.confirmBox, { opacity }]}>
        <CheckCircle size={16} color={R.green} />
        <Text style={suc.confirmText}>OTP verified · Delivery confirmed</Text>
      </Animated.View>

      <TouchableOpacity style={suc.btn} onPress={onDone} activeOpacity={0.9}>
        <Text style={suc.btnText}>Back to Dashboard</Text>
      </TouchableOpacity>
    </View>
  );
};

const suc = StyleSheet.create({
  root: {
    flex: 1, backgroundColor: R.white,
    alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 28,
  },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 },
  iconWrap: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: R.greenLight, borderWidth: 2, borderColor: '#A7F3D0',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: R.ink, fontSize: 34, fontWeight: '900', textAlign: 'center', marginTop: 8 },
  sub: { color: R.muted, fontSize: 15, textAlign: 'center', lineHeight: 22, marginTop: 8 },
  confirmBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: R.greenLight, borderWidth: 1, borderColor: '#A7F3D0',
    paddingHorizontal: 20, paddingVertical: 14, borderRadius: 16,
    marginBottom: 20, width: '100%', justifyContent: 'center',
  },
  confirmText: { color: R.green, fontWeight: '700', fontSize: 13 },
  btn: {
    width: '100%', backgroundColor: R.orange,
    paddingVertical: 18, borderRadius: 16, alignItems: 'center',
    shadowColor: R.orange, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  btnText: { color: R.white, fontSize: 16, fontWeight: '800' },
});

// ─── Main screen ─────────────────────────────────────────────────────────────
const DeliveryOTPScreen = ({ route, navigation }: any) => {
  const { orderId, isCashCod, amountPaise, displayId } = route.params;
  const insets = useSafeAreaInsets();
  const [otp, setOtp] = useState('');
  const [focused, setFocused] = useState(false);
  const [delivered, setDelivered] = useState(false);
  const [podPhotoUri, setPodPhotoUri] = useState<string | null>(null);
  const [podPhotoUrl, setPodPhotoUrl] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const queryClient = useQueryClient();

  const handleDone = () => {
    queryClient.invalidateQueries({ queryKey: ['rider-active-order'] });
    queryClient.invalidateQueries({ queryKey: ['rider-earnings'] });
    if (isCashCod) {
      navigation.replace('CashSubmit', { orderId, amountPaise, displayId });
    } else {
      navigation.navigate('RiderTabs');
    }
  };

  const captureProofPhoto = async () => {
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
      Alert.alert('Upload Failed', 'Could not upload the photo. You can still confirm delivery without it.');
      setPodPhotoUri(null);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const verifyMutation = useMutation({
    mutationFn: () => api.post('/riders/verify-otp', { orderId, otp, podPhotoUrl }),
    onSuccess: () => setDelivered(true),
    onError: () => {
      Alert.alert('Wrong Code', 'Ask the customer to check their OTP again.');
      setOtp('');
    },
  });

  if (delivered) return <SuccessScreen onDone={handleDone} />;

  const isBlocked = otp.length < 6 || verifyMutation.isPending || isUploadingPhoto;

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={R.white} />

      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity style={st.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <ArrowLeft size={20} color={R.ink} />
        </TouchableOpacity>
        {displayId && <Text style={st.orderId}>{displayId}</Text>}
        <View style={{ width: 40 }} />
      </View>

      {/* Hero */}
      <View style={st.hero}>
        <View style={st.iconWrap}>
          <ShieldCheck size={40} color={R.orange} />
        </View>
        <Text style={st.title}>Enter Delivery OTP</Text>
        <Text style={st.subtitle}>Ask the customer for their 6-digit code to confirm delivery.</Text>
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
                  <Text style={st.podUploadedText}>Photo uploaded</Text>
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

      {/* OTP boxes */}
      <Pressable style={st.otpWrapper} onPress={() => inputRef.current?.focus()}>
        <View style={st.boxRow}>
          {Array.from({ length: 6 }).map((_, i) => {
            const char = otp[i] || '';
            const isCurrent = i === otp.length && focused;
            const filled = char.length > 0;
            return (
              <View key={i} style={[st.otpBox, filled && st.otpBoxFilled, isCurrent && st.otpBoxActive]}>
                {isCurrent ? <View style={st.cursor} /> : <Text style={st.otpChar}>{char}</Text>}
              </View>
            );
          })}
        </View>
        <TextInput
          ref={inputRef}
          style={st.hiddenInput}
          keyboardType="numeric"
          maxLength={6}
          value={otp}
          onChangeText={(t: string) => setOtp(t.replace(/\D/g, ''))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoFocus
        />
      </Pressable>

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
    </View>
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

  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  iconWrap: {
    width: 90, height: 90, borderRadius: 28, backgroundColor: R.orangeLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
    shadowColor: R.orange, shadowOpacity: 0.15, shadowRadius: 16, elevation: 4,
  },
  title: { color: R.ink, fontSize: 26, fontWeight: '900', textAlign: 'center', marginBottom: 10 },
  subtitle: { color: R.muted, fontSize: 14, textAlign: 'center', lineHeight: 22 },

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

  otpWrapper: { paddingHorizontal: 20, marginBottom: 28 },
  boxRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  otpBox: {
    flex: 1, height: 64, borderRadius: 16,
    backgroundColor: R.bg, borderWidth: 1.5, borderColor: R.border,
    alignItems: 'center', justifyContent: 'center',
  },
  otpBoxActive: {
    borderColor: R.orange,
    shadowColor: R.orange, shadowOpacity: 0.2, shadowRadius: 8, elevation: 3,
    backgroundColor: R.orangeLight,
  },
  otpBoxFilled: { borderColor: R.orange, backgroundColor: R.orangeLight },
  otpChar: { color: R.ink, fontSize: 24, fontWeight: '900' },
  cursor: { width: 2, height: 28, backgroundColor: R.orange },
  hiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1 },

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
  confirmBtnDisabled: { backgroundColor: R.border, shadowOpacity: 0 },
  confirmBtnText: { color: R.white, fontSize: 15, fontWeight: '800' },
});

export default DeliveryOTPScreen;
