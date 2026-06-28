import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, StatusBar, Animated, Alert,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleCheck, Banknote, Smartphone } from 'lucide-react-native';
import { ENV } from '../config/env';

const G = {
  bg: '#070F0C', surface: '#0F1F18',
  accent: '#10B981', accentDim: 'rgba(16,185,129,0.12)',
  amber: G.primary, amberDim: 'rgba(245,158,11,0.12)',
  white: '#FFFFFF', muted: '#6B9E85', border: 'rgba(16,185,129,0.15)',
};

const SuccessOverlay = ({ label, amount, onContinue }: { label: string; amount: string; onContinue: () => void }) => {
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
        <Text style={suc.title}>Payment Received!</Text>
        <Text style={suc.amount}>₹{amount}</Text>
        <Text style={suc.sub}>{label}</Text>
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
    width: '100%', backgroundColor: G.surface, borderRadius: 28,
    padding: 28, alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)',
  },
  iconWrap: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: G.accentDim,
    borderWidth: 1.5, borderColor: 'rgba(16,185,129,0.25)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  title: { color: G.white, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  amount: { color: G.accent, fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  sub: { color: G.muted, fontSize: 13, textAlign: 'center', lineHeight: 20, marginTop: 4 },
  btn: { width: '100%', backgroundColor: G.accent, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnText: { color: G.white, fontSize: 15, fontWeight: '800' },
});

const DoorPaymentScreen = ({ route, navigation }: any) => {
  const { orderId, totalAmountPaise, displayId } = route.params as {
    orderId: string; totalAmountPaise: number; displayId: string;
  };
  const insets = useSafeAreaInsets();
  const [done, setDone] = useState<null | 'upi' | 'cash'>(null);

  const amountRupees = (totalAmountPaise / 100).toFixed(2);
  const amountDisplay = (totalAmountPaise / 100).toFixed(0);

  // UPI intent URI — amount pre-filled, customer cannot change it, works with all UPI apps
  const upiUri = `upi://pay?pa=${ENV.BUSINESS_UPI_ID}&pn=2QT+Food+Palace&am=${amountRupees}&cu=INR&tn=Order+${displayId}`;

  const confirmMutation = useMutation({
    mutationFn: (method: 'upi' | 'cash') =>
      api.post('/riders/confirm-door-payment', { orderId, method }),
    onSuccess: (_data, method) => setDone(method),
    onError: () => Alert.alert('Error', 'Could not record payment. Try again.'),
  });

  const handleUpi = () => {
    Alert.alert(
      'Confirm UPI Payment',
      `Has the customer scanned the QR and paid ₹${amountDisplay}?`,
      [
        { text: 'Not Yet', style: 'cancel' },
        { text: 'Yes, Paid', onPress: () => confirmMutation.mutate('upi') },
      ]
    );
  };

  const handleCash = () => {
    Alert.alert(
      'Confirm Cash Payment',
      `Have you collected ₹${amountDisplay} in cash from the customer?`,
      [
        { text: 'Not Yet', style: 'cancel' },
        { text: 'Yes, Collected', onPress: () => confirmMutation.mutate('cash') },
      ]
    );
  };

  const proceedToOTP = () => navigation.replace('DeliveryOTP', { orderId, displayId });

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 16 }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Collect Payment</Text>
        <Text style={styles.headerSub}>Order #{displayId}</Text>
      </View>

      <View style={styles.amountBadge}>
        <Text style={styles.amountLabel}>Amount to Collect</Text>
        <Text style={styles.amountValue}>₹{amountDisplay}</Text>
      </View>

      {/* UPI QR — generated locally, instant, no API call */}
      <View style={styles.qrSection}>
        <Text style={styles.qrHint}>Show QR to customer · Pre-filled amount</Text>
        <View style={styles.qrWrap}>
          <QRCode
            value={upiUri}
            size={200}
            backgroundColor="white"
            color="#000000"
            quietZone={16}
          />
        </View>
        <View style={styles.upiIdRow}>
          <Smartphone size={13} color={G.muted} />
          <Text style={styles.upiIdText}>{ENV.BUSINESS_UPI_ID}</Text>
        </View>
        <Text style={styles.upiNote}>GPay · PhonePe · Paytm · BHIM · any UPI app</Text>
      </View>

      <View style={styles.btnGroup}>
        <TouchableOpacity
          style={styles.btnUpi}
          onPress={handleUpi}
          activeOpacity={0.88}
          disabled={confirmMutation.isPending}
        >
          {confirmMutation.isPending && confirmMutation.variables === 'upi'
            ? <ActivityIndicator color={G.accent} size="small" />
            : <Text style={styles.btnUpiText}>Customer Paid via UPI</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnCash}
          onPress={handleCash}
          activeOpacity={0.88}
          disabled={confirmMutation.isPending}
        >
          {confirmMutation.isPending && confirmMutation.variables === 'cash'
            ? <ActivityIndicator color={G.amber} size="small" />
            : <>
                <Banknote size={20} color={G.amber} />
                <Text style={styles.btnCashText}>Customer Paid Cash</Text>
              </>
          }
        </TouchableOpacity>
      </View>

      {done && (
        <SuccessOverlay
          amount={amountDisplay}
          label={done === 'upi' ? 'UPI payment recorded.' : 'Cash payment recorded.'}
          onContinue={proceedToOTP}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: G.bg, paddingHorizontal: 24 },
  header: { paddingTop: 8, paddingBottom: 16, alignItems: 'center' },
  headerTitle: { color: G.white, fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  headerSub: { color: G.muted, fontSize: 13, marginTop: 4, fontFamily: 'monospace' },
  amountBadge: {
    backgroundColor: G.accentDim, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)',
    borderRadius: 20, paddingVertical: 16, paddingHorizontal: 24,
    alignItems: 'center', marginBottom: 24,
  },
  amountLabel: { color: G.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2 },
  amountValue: { color: G.accent, fontSize: 48, fontWeight: '900', letterSpacing: -2, marginTop: 4 },
  qrSection: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  qrHint: { color: G.muted, fontSize: 12, marginBottom: 14, fontWeight: '600' },
  qrWrap: {
    padding: 12, backgroundColor: G.white, borderRadius: 20,
    shadowColor: G.accent, shadowOpacity: 0.2, shadowRadius: 20, elevation: 8,
  },
  upiIdRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  upiIdText: { color: G.muted, fontSize: 12, fontWeight: '700' },
  upiNote: { color: '#3a6050', fontSize: 11, marginTop: 6, textAlign: 'center' },
  btnGroup: { gap: 12, paddingTop: 12 },
  btnUpi: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: G.accentDim, borderWidth: 1.5,
    borderColor: 'rgba(16,185,129,0.3)', borderRadius: 18, paddingVertical: 18,
  },
  btnUpiText: { color: G.accent, fontSize: 16, fontWeight: '800' },
  btnCash: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: G.amberDim, borderWidth: 1.5,
    borderColor: 'rgba(245,158,11,0.3)', borderRadius: 18, paddingVertical: 18,
  },
  btnCashText: { color: G.amber, fontSize: 16, fontWeight: '800' },
});

export default DoorPaymentScreen;
