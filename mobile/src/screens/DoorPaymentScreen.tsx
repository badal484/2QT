import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, StatusBar, Animated, Clipboard, Alert,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleCheck, Copy, Wallet, Banknote } from 'lucide-react-native';
import { ENV } from '../config/env';

const G = {
  bg: '#070F0C', surface: '#0F1F18', card: '#152318',
  accent: '#10B981', accentDim: 'rgba(16,185,129,0.12)',
  amber: '#F59E0B', amberDim: 'rgba(245,158,11,0.12)',
  white: '#FFFFFF', muted: '#6B9E85', border: 'rgba(16,185,129,0.15)',
};

// ── Success overlay (UPI confirmed) ──────────────────────────────────────────
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
        <Text style={suc.title}>UPI Payment Confirmed</Text>
        <Text style={suc.amount}>₹{amount}</Text>
        <Text style={suc.sub}>Payment recorded. Now ask for the OTP to complete delivery.</Text>
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
    alignItems: 'center', justifyContent: 'center',
    zIndex: 99, paddingHorizontal: 28,
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

// ── Main Screen ───────────────────────────────────────────────────────────────
const DoorPaymentScreen = ({ route, navigation }: any) => {
  const { orderId, totalAmountPaise, displayId } = route.params as {
    orderId: string;
    totalAmountPaise: number;
    displayId: string;
  };

  const insets = useSafeAreaInsets();
  const [upiConfirmed, setUpiConfirmed] = useState(false);
  const amountRupees = (totalAmountPaise / 100).toFixed(0);

  const businessUpiId = ENV.BUSINESS_UPI_ID;
  const upiDeepLink = `upi://pay?pa=${encodeURIComponent(businessUpiId)}&pn=${encodeURIComponent('2QT Food')}&am=${amountRupees}&cu=INR&tn=${encodeURIComponent(`Order #${displayId}`)}`;

  const confirmMutation = useMutation({
    mutationFn: (method: 'upi' | 'cash') =>
      api.post('/riders/confirm-door-payment', { orderId, method }),
    onError: () => Alert.alert('Error', 'Could not record payment. Try again.'),
  });

  const handleUPI = async () => {
    await confirmMutation.mutateAsync('upi');
    setUpiConfirmed(true);
  };

  const handleCash = () => {
    // Cash — no API call needed (already cod_pending). Go straight to OTP.
    navigation.replace('DeliveryOTP', { orderId });
  };

  const proceedToOTP = () => navigation.replace('DeliveryOTP', { orderId });

  const copyUpiId = () => {
    Clipboard.setString(businessUpiId);
    Alert.alert('Copied', `UPI ID copied: ${businessUpiId}`);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 16 }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Collect Payment</Text>
        <Text style={styles.headerSub}>Order #{displayId}</Text>
      </View>

      {/* Amount */}
      <View style={styles.amountBadge}>
        <Text style={styles.amountLabel}>Amount to Collect</Text>
        <Text style={styles.amountValue}>₹{amountRupees}</Text>
      </View>

      {/* QR + UPI ID */}
      <View style={styles.qrSection}>
        <Text style={styles.qrHint}>Show this QR to the customer</Text>

        <View style={styles.qrWrap}>
          <QRCode
            value={upiDeepLink}
            size={200}
            backgroundColor="white"
            color="#000000"
            quietZone={16}
          />
        </View>

        <View style={styles.upiRow}>
          <Text style={styles.upiId}>{businessUpiId}</Text>
          <TouchableOpacity onPress={copyUpiId} style={styles.copyBtn}>
            <Copy size={14} color={G.accent} />
          </TouchableOpacity>
        </View>
        <Text style={styles.upiNote}>Customer can scan or type the UPI ID manually</Text>
      </View>

      {/* Payment buttons */}
      <View style={styles.btnGroup}>
        {/* UPI confirmed */}
        <TouchableOpacity
          style={[styles.btnUPI, confirmMutation.isPending && styles.btnDisabled]}
          onPress={handleUPI}
          disabled={confirmMutation.isPending}
          activeOpacity={0.88}
        >
          {confirmMutation.isPending ? (
            <ActivityIndicator color={G.white} />
          ) : (
            <>
              <Wallet size={20} color={G.white} />
              <Text style={styles.btnUPIText}>Customer Paid via UPI</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Cash */}
        <TouchableOpacity
          style={styles.btnCash}
          onPress={handleCash}
          activeOpacity={0.88}
        >
          <Banknote size={20} color={G.amber} />
          <Text style={styles.btnCashText}>Customer Paid Cash</Text>
        </TouchableOpacity>
      </View>

      {/* UPI success overlay */}
      {upiConfirmed && (
        <UpiSuccessOverlay amount={amountRupees} onContinue={proceedToOTP} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1, backgroundColor: G.bg,
    paddingHorizontal: 24,
  },

  header: {
    paddingTop: 8, paddingBottom: 20, alignItems: 'center',
  },
  headerTitle: {
    color: G.white, fontSize: 22, fontWeight: '900', letterSpacing: -0.3,
  },
  headerSub: {
    color: G.muted, fontSize: 13, marginTop: 4, fontFamily: 'monospace',
  },

  amountBadge: {
    backgroundColor: G.accentDim,
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)',
    borderRadius: 20, paddingVertical: 18, paddingHorizontal: 24,
    alignItems: 'center', marginBottom: 28,
  },
  amountLabel: {
    color: G.muted, fontSize: 12, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1.2,
  },
  amountValue: {
    color: G.accent, fontSize: 48, fontWeight: '900',
    letterSpacing: -2, marginTop: 4,
  },

  qrSection: {
    flex: 1, alignItems: 'center',
  },
  qrHint: {
    color: G.muted, fontSize: 13, marginBottom: 16, fontWeight: '600',
  },
  qrWrap: {
    padding: 12, backgroundColor: G.white, borderRadius: 20,
    shadowColor: G.accent, shadowOpacity: 0.2, shadowRadius: 20, elevation: 8,
  },
  upiRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16,
    backgroundColor: G.surface, borderWidth: 1, borderColor: G.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  upiId: {
    color: G.white, fontSize: 13, fontWeight: '700', fontFamily: 'monospace',
  },
  copyBtn: {
    padding: 4,
  },
  upiNote: {
    color: G.muted, fontSize: 11, marginTop: 8, textAlign: 'center',
  },

  btnGroup: {
    gap: 12, paddingTop: 12,
  },
  btnUPI: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: G.accent, borderRadius: 18,
    paddingVertical: 18,
    shadowColor: G.accent, shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
  },
  btnUPIText: {
    color: G.white, fontSize: 16, fontWeight: '800',
  },
  btnCash: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: G.amberDim,
    borderWidth: 1.5, borderColor: 'rgba(245,158,11,0.3)',
    borderRadius: 18, paddingVertical: 18,
  },
  btnCashText: {
    color: G.amber, fontSize: 16, fontWeight: '800',
  },
  btnDisabled: {
    opacity: 0.5,
  },
});

export default DoorPaymentScreen;
