import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, Animated, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Banknote, CheckCircle, ArrowRight } from 'lucide-react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

const G = {
  bg: '#07080A', surface: '#10141A', card: '#161C25',
  amber: G.primary, amberDim: 'rgba(245,158,11,0.12)',
  green: '#10B981', greenDim: 'rgba(16,185,129,0.12)',
  white: '#FFFFFF', muted: '#6B7A8D', border: 'rgba(245,158,11,0.2)',
};

const ConfirmedOverlay = ({ amount, onDone }: { amount: string; onDone: () => void }) => {
  const scale = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.overlayRoot, { opacity }]}>
      <Animated.View style={[styles.overlayCard, { transform: [{ scale }] }]}>
        <View style={styles.overlayIcon}>
          <CheckCircle size={48} color={G.green} strokeWidth={1.8} />
        </View>
        <Text style={styles.overlayTitle}>Cash Submitted!</Text>
        <Text style={styles.overlayAmount}>₹{amount}</Text>
        <Text style={styles.overlaySub}>Finance has been notified. You're cleared for your next order.</Text>
        <TouchableOpacity style={styles.overlayBtn} onPress={onDone} activeOpacity={0.9}>
          <Text style={styles.overlayBtnText}>Go to Home</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
};

const CashSubmitScreen = ({ route, navigation }: any) => {
  const { orderId, amountPaise, displayId } = route.params as {
    orderId: string;
    amountPaise: number;
    displayId: string;
  };

  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [submitted, setSubmitted] = useState(false);
  const amountRupees = (amountPaise / 100).toFixed(0);

  const handleDone = () => {
    queryClient.invalidateQueries({ queryKey: ['rider-active-order'] });
    queryClient.invalidateQueries({ queryKey: ['rider-earnings'] });
    navigation.navigate('RiderHome');
  };

  const submitMutation = useMutation({
    mutationFn: () => api.post('/riders/submit-cash-to-finance', { orderId }),
    onSuccess: () => setSubmitted(true),
    onError: (e: any) => Alert.alert('Error', e.message || 'Could not submit. Try again.'),
  });

  if (submitted) return <ConfirmedOverlay amount={amountRupees} onDone={handleDone} />;

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Submit Cash</Text>
        <Text style={styles.headerSub}>Order #{displayId}</Text>
      </View>

      {/* Amount card */}
      <View style={styles.amountCard}>
        <Banknote size={28} color={G.amber} style={{ marginBottom: 12 }} />
        <Text style={styles.amountLabel}>Hand over this amount</Text>
        <Text style={styles.amountValue}>₹{amountRupees}</Text>
        <Text style={styles.amountSub}>Give this cash to the Finance team at the kitchen</Text>
      </View>

      {/* Steps */}
      <View style={styles.stepsCard}>
        {[
          'Walk to the finance desk at kitchen',
          `Hand over ₹${amountRupees} cash`,
          'Tap the button below to confirm',
        ].map((step, i) => (
          <View key={i} style={styles.stepRow}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>{i + 1}</Text>
            </View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>

      <View style={{ flex: 1 }} />

      {/* Submit button */}
      <TouchableOpacity
        style={[styles.submitBtn, submitMutation.isPending && { opacity: 0.6 }]}
        onPress={() => submitMutation.mutate()}
        disabled={submitMutation.isPending}
        activeOpacity={0.88}
      >
        {submitMutation.isPending
          ? <ActivityIndicator color={G.bg} />
          : <>
              <Text style={styles.submitBtnText}>I've Handed Over the Cash</Text>
              <ArrowRight size={18} color={G.bg} />
            </>
        }
      </TouchableOpacity>

      <TouchableOpacity onPress={handleDone} style={styles.skipLink} activeOpacity={0.7}>
        <Text style={styles.skipText}>Submit later (not recommended)</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: G.bg, paddingHorizontal: 24 },
  header: { paddingTop: 8, paddingBottom: 24, alignItems: 'center' },
  headerTitle: { color: G.white, fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  headerSub: { color: G.muted, fontSize: 13, marginTop: 4, fontFamily: 'monospace' },

  amountCard: {
    backgroundColor: G.amberDim, borderWidth: 1.5, borderColor: G.border,
    borderRadius: 24, padding: 28, alignItems: 'center', marginBottom: 20,
  },
  amountLabel: { color: G.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2 },
  amountValue: { color: G.amber, fontSize: 52, fontWeight: '900', letterSpacing: -2, marginTop: 4 },
  amountSub: { color: G.muted, fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 20 },

  stepsCard: {
    backgroundColor: G.surface, borderRadius: 20, padding: 20, gap: 16,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepNum: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: G.amberDim, borderWidth: 1.5, borderColor: G.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepNumText: { color: G.amber, fontWeight: '900', fontSize: 12 },
  stepText: { flex: 1, color: G.white, fontSize: 14, fontWeight: '600', lineHeight: 20 },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: G.amber, borderRadius: 18, paddingVertical: 18, marginTop: 24,
    shadowColor: G.amber, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
  },
  submitBtnText: { color: G.bg, fontSize: 16, fontWeight: '900' },

  skipLink: { alignItems: 'center', marginTop: 16 },
  skipText: { color: G.muted, fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' },

  overlayRoot: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(7,8,10,0.96)',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 28, zIndex: 99,
  },
  overlayCard: {
    width: '100%', backgroundColor: G.surface, borderRadius: 28,
    padding: 28, alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)',
  },
  overlayIcon: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: G.greenDim, borderWidth: 1.5,
    borderColor: 'rgba(16,185,129,0.25)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  overlayTitle: { color: G.white, fontSize: 22, fontWeight: '900', textAlign: 'center' },
  overlayAmount: { color: G.green, fontSize: 40, fontWeight: '900', letterSpacing: -1 },
  overlaySub: { color: G.muted, fontSize: 13, textAlign: 'center', lineHeight: 20, marginTop: 4 },
  overlayBtn: {
    width: '100%', backgroundColor: G.green, borderRadius: 16,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  overlayBtnText: { color: G.white, fontSize: 15, fontWeight: '800' },
});

export default CashSubmitScreen;
