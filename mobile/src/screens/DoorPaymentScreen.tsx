import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, StatusBar, Animated, Clipboard, Alert,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleCheck, Copy, Banknote, RefreshCw } from 'lucide-react-native';
import { getSocket } from '../socket/client';

const G = {
  bg: '#070F0C', surface: '#0F1F18', card: '#152318',
  accent: '#10B981', accentDim: 'rgba(16,185,129,0.12)',
  amber: '#F59E0B', amberDim: 'rgba(245,158,11,0.12)',
  white: '#FFFFFF', muted: '#6B9E85', border: 'rgba(16,185,129,0.15)',
};

const UpiSuccessOverlay = ({ amount, onContinue }: { amount: string; onContinue: () => void }) => {
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[suc.root, { opacity }]}>
      <Animated.View style={[suc.card, { transform: [{ scale }] }]}>
        <View style={suc.iconWrap}>
          <CircleCheck size={44} color={G.accent} strokeWidth={1.8} />
        </View>
        <Text style={suc.title}>Payment Confirmed!</Text>
        <Text style={suc.amount}>₹{amount}</Text>
        <Text style={suc.sub}>Razorpay verified the payment. Ask the customer for the OTP now.</Text>
        <TouchableOpacity style={suc.btn} onPress={onContinue} activeOpacity={0.9}>
          <Text style={suc.btnText}>Enter Delivery OTP →</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
};

const suc = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(7,15,12,0.95)',
    alignItems: 'center', justifyContent: 'center', zIndex: 99, paddingHorizontal: 28,
  },
  card: {
    width: '100%', backgroundColor: G.surface,
    borderRadius: 28, padding: 28, alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)',
  },
  iconWrap: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: G.accentDim, borderWidth: 1.5,
    borderColor: 'rgba(16,185,129,0.25)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  title: { color: G.white, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  amount: { color: G.accent, fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  sub: { color: G.muted, fontSize: 13, textAlign: 'center', lineHeight: 20, marginTop: 4 },
  btn: {
    width: '100%', backgroundColor: G.accent, borderRadius: 16,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  btnText: { color: G.white, fontSize: 15, fontWeight: '800' },
});

const DoorPaymentScreen = ({ route, navigation }: any) => {
  const { orderId, totalAmountPaise, displayId } = route.params as {
    orderId: string; totalAmountPaise: number; displayId: string;
  };
  const insets = useSafeAreaInsets();
  const [upiConfirmed, setUpiConfirmed] = useState(false);
  const amountRupees = (totalAmountPaise / 100).toFixed(0);

  // Step 1: Get Razorpay payment link from backend
  const { data: linkData, isLoading: linkLoading, error: linkError, refetch: refetchLink } = useQuery({
    queryKey: ['cod-payment-link', orderId],
    queryFn: () => api.post(`/riders/orders/${orderId}/upi-payment-link`, {}),
    retry: 2,
    staleTime: Infinity,   // payment link doesn't expire within the session
  });

  // Step 2: Poll order payment_status every 3s until paid
  const { data: orderData } = useQuery({
    queryKey: ['order-payment-status', orderId],
    queryFn: () => api.get(`/orders/${orderId}`),
    refetchInterval: upiConfirmed ? false : 3000,
    enabled: !upiConfirmed,
  });

  // Step 3: Auto-confirm when polling finds payment
  useEffect(() => {
    if (orderData?.order?.payment_status === 'paid' && !upiConfirmed) {
      setUpiConfirmed(true);
    }
    if (linkData?.alreadyPaid && !upiConfirmed) {
      setUpiConfirmed(true);
    }
  }, [orderData, linkData]);

  // Step 4: Real-time socket confirmation (webhook fires → socket event arrives)
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = (data: any) => {
      if (data.orderId === orderId) setUpiConfirmed(true);
    };
    socket.on('cod_payment_confirmed', handler);
    return () => socket.off('cod_payment_confirmed', handler);
  }, [orderId]);

  const handleCash = () => {
    navigation.replace('DeliveryOTP', { orderId, isCashCod: true, amountPaise: totalAmountPaise, displayId });
  };

  const proceedToOTP = () => navigation.replace('DeliveryOTP', { orderId, displayId });

  const copyUpiLink = () => {
    if (linkData?.short_url) {
      Clipboard.setString(linkData.short_url);
      Alert.alert('Copied', 'Payment link copied to clipboard');
    }
  };

  const shortUrl = linkData?.short_url;

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 16 }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Collect Payment</Text>
        <Text style={styles.headerSub}>Order #{displayId}</Text>
      </View>

      <View style={styles.amountBadge}>
        <Text style={styles.amountLabel}>Amount to Collect</Text>
        <Text style={styles.amountValue}>₹{amountRupees}</Text>
      </View>

      <View style={styles.qrSection}>
        {linkLoading ? (
          <View style={styles.qrLoader}>
            <ActivityIndicator color={G.accent} size="large" />
            <Text style={styles.qrLoaderText}>Generating secure payment QR…</Text>
          </View>
        ) : linkError || !shortUrl ? (
          <View style={styles.qrLoader}>
            <Text style={styles.qrErrorText}>Could not generate QR</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => refetchLink()}>
              <RefreshCw size={16} color={G.accent} />
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.qrHint}>Show this QR to the customer</Text>
            <View style={styles.qrWrap}>
              <QRCode value={shortUrl} size={200} backgroundColor="white" color="#000000" quietZone={16} />
            </View>
            <TouchableOpacity style={styles.upiRow} onPress={copyUpiLink} activeOpacity={0.7}>
              <Text style={styles.upiId} numberOfLines={1}>{shortUrl}</Text>
              <Copy size={14} color={G.accent} />
            </TouchableOpacity>
            <Text style={styles.upiNote}>Customer scans → pays → confirmed automatically</Text>

            {/* Waiting indicator */}
            <View style={styles.waitingRow}>
              <ActivityIndicator size="small" color={G.accent} />
              <Text style={styles.waitingText}>Waiting for payment…</Text>
            </View>
          </>
        )}
      </View>

      {/* Only cash option remains — UPI is auto-confirmed via Razorpay */}
      <View style={styles.btnGroup}>
        <TouchableOpacity style={styles.btnCash} onPress={handleCash} activeOpacity={0.88}>
          <Banknote size={20} color={G.amber} />
          <Text style={styles.btnCashText}>Customer Paid Cash</Text>
        </TouchableOpacity>
      </View>

      {upiConfirmed && <UpiSuccessOverlay amount={amountRupees} onContinue={proceedToOTP} />}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: G.bg, paddingHorizontal: 24 },
  header: { paddingTop: 8, paddingBottom: 20, alignItems: 'center' },
  headerTitle: { color: G.white, fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  headerSub: { color: G.muted, fontSize: 13, marginTop: 4, fontFamily: 'monospace' },
  amountBadge: {
    backgroundColor: G.accentDim, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)',
    borderRadius: 20, paddingVertical: 18, paddingHorizontal: 24,
    alignItems: 'center', marginBottom: 28,
  },
  amountLabel: { color: G.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2 },
  amountValue: { color: G.accent, fontSize: 48, fontWeight: '900', letterSpacing: -2, marginTop: 4 },
  qrSection: { flex: 1, alignItems: 'center' },
  qrHint: { color: G.muted, fontSize: 13, marginBottom: 16, fontWeight: '600' },
  qrWrap: {
    padding: 12, backgroundColor: G.white, borderRadius: 20,
    shadowColor: G.accent, shadowOpacity: 0.2, shadowRadius: 20, elevation: 8,
  },
  qrLoader: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  qrLoaderText: { color: G.muted, fontSize: 13 },
  qrErrorText: { color: '#EF4444', fontSize: 14, fontWeight: '700' },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  retryText: { color: G.accent, fontWeight: '700' },
  upiRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16,
    backgroundColor: G.surface, borderWidth: 1, borderColor: G.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, maxWidth: '90%',
  },
  upiId: { color: G.white, fontSize: 11, fontWeight: '600', flex: 1 },
  upiNote: { color: G.muted, fontSize: 11, marginTop: 8, textAlign: 'center' },
  waitingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20 },
  waitingText: { color: G.muted, fontSize: 13 },
  btnGroup: { gap: 12, paddingTop: 12 },
  btnCash: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: G.amberDim, borderWidth: 1.5,
    borderColor: 'rgba(245,158,11,0.3)', borderRadius: 18, paddingVertical: 18,
  },
  btnCashText: { color: G.amber, fontSize: 16, fontWeight: '800' },
});

export default DoorPaymentScreen;
