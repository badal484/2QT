import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
  ScrollView, Alert, ActivityIndicator, BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Banknote, CheckCircle, ArrowLeft, Smartphone, Building2,
  Info, Clock, CheckCircle2, ShieldCheck,
} from 'lucide-react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import RazorpayCheckout from 'react-native-razorpay';
import { api } from '../api/client';

const R = {
  orange: '#FC4603', orangeLight: '#FFF0E8',
  green: '#1BA672', greenLight: '#E8F8F1',
  amber: '#F59E0B', amberLight: 'rgba(245,158,11,0.08)',
  blue: '#3B82F6', blueLight: '#EFF6FF',
  ink: '#282C3F', gray: '#686B78', muted: '#93959F',
  border: '#E9E9EB', bg: '#F8F8F8', white: '#FFFFFF',
  red: '#EF4444', redLight: '#FEF2F2',
  rzp: '#072654', rzpLight: '#EEF2FB',
};

type Method = 'physical' | 'razorpay';

// ── Result overlay shown after submission ─────────────────────────────────────
const ResultOverlay = ({
  total, method, onDone,
}: { total: string; method: Method; onDone: () => void }) => {
  const isRzp = method === 'razorpay';
  return (
    <View style={s.overlayRoot}>
      <View style={[s.overlayCard, isRzp ? s.overlayCardGreen : s.overlayCardAmber]}>
        <View style={[s.overlayIconWrap, isRzp ? s.overlayIconGreen : s.overlayIconAmber]}>
          {isRzp
            ? <ShieldCheck size={48} color={R.green} strokeWidth={1.8} />
            : <Clock size={48} color={R.amber} strokeWidth={1.8} />
          }
        </View>
        <Text style={s.overlayTitle}>
          {isRzp ? 'Payment Confirmed!' : 'Finance Notified'}
        </Text>
        <Text style={[s.overlayAmount, { color: isRzp ? R.green : R.amber }]}>₹{total}</Text>
        <Text style={s.overlaySub}>
          {isRzp
            ? 'Your payment has been verified. Your cash badge has been cleared automatically.'
            : 'Please hand over the cash at the finance desk. Your badge will clear once finance confirms receipt.'}
        </Text>
        <View style={s.overlayBadge}>
          <Text style={[s.overlayBadgeText, { color: isRzp ? R.green : R.amber }]}>
            {isRzp ? 'Verified via Razorpay' : 'Pending Finance Confirmation'}
          </Text>
        </View>
        <TouchableOpacity style={s.overlayBtn} onPress={onDone} activeOpacity={0.9}>
          <Text style={s.overlayBtnText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const CashSubmitScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [method, setMethod] = useState<Method>('physical');
  const [submitted, setSubmitted] = useState(false);
  const [rzpLoading, setRzpLoading] = useState(false);
  const [confirmedTotal, setConfirmedTotal] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['cash-in-hand'],
    queryFn: () => api.get('/riders/cash-in-hand'),
  });

  const orders: any[] = data?.orders || [];
  const totalPaise: number = data?.totalPaise || 0;
  const overLimit: boolean = data?.overLimit || false;
  const totalRupees = (totalPaise / 100).toFixed(0);

  // Physical cash submission
  const submitMutation = useMutation({
    mutationFn: () => api.post('/riders/submit-all-cash', {
      orderIds: orders.map(o => o.id),
      method: 'physical',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-in-hand'] });
      queryClient.invalidateQueries({ queryKey: ['rider-earnings'] });
      setSubmitted(true);
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.error || e.message || 'Could not submit. Try again.'),
  });

  // Razorpay native in-app checkout — no browser redirect
  const handleRazorpayPay = async () => {
    if (!orders.length) return;
    setRzpLoading(true);
    try {
      // Step 1: create order on backend
      const orderRes: any = await api.post('/riders/create-cash-order', {});

      // Step 2: open native Razorpay checkout (bottom sheet, stays in-app)
      const paymentData: any = await RazorpayCheckout.open({
        key: orderRes.key,
        amount: orderRes.amount,
        currency: 'INR',
        order_id: orderRes.rzpOrderId,
        name: '2QT Food',
        description: `Cash handover — ${orderRes.orderCount} order${orderRes.orderCount > 1 ? 's' : ''}`,
        prefill: {
          name: orderRes.riderName,
          contact: orderRes.riderPhone,
        },
        theme: { color: '#FC4603' },
      });

      // Step 3: verify signature + confirm on backend
      await api.post('/riders/confirm-cash-payment', {
        submissionId: orderRes.submissionId,
        razorpayPaymentId: paymentData.razorpay_payment_id,
        razorpayOrderId: paymentData.razorpay_order_id,
        razorpaySignature: paymentData.razorpay_signature,
      });

      queryClient.invalidateQueries({ queryKey: ['cash-in-hand'] });
      queryClient.invalidateQueries({ queryKey: ['rider-earnings'] });
      setConfirmedTotal((orderRes.amount / 100).toFixed(0));
      setMethod('razorpay');
      setSubmitted(true);
    } catch (e: any) {
      // error.code === 0 means user cancelled — don't show error for that
      if (e?.code !== 0) {
        Alert.alert('Payment Failed', e?.response?.data?.error || e?.description || 'Payment could not be completed. Try again.');
      }
    } finally {
      setRzpLoading(false);
    }
  };

  const handlePhysicalSubmit = () => {
    if (!orders.length) return;
    submitMutation.mutate();
  };

  const handleDone = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'RiderTabs' }],
    });
  };

  useEffect(() => {
    if (submitted) {
      const onBackPress = () => {
        handleDone();
        return true;
      };
      BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
    }
  }, [submitted]);

  if (submitted) {
    return <ResultOverlay total={confirmedTotal || totalRupees} method={method} onDone={handleDone} />;
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={R.white} />

      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <ArrowLeft size={20} color={R.ink} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Submit Cash</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={s.center}><ActivityIndicator size="large" color={R.orange} /></View>
      ) : isError ? (
        <View style={s.center}>
          <Text style={s.errorText}>Couldn't load cash details</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => refetch()} activeOpacity={0.85}>
            <Text style={s.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : orders.length === 0 ? (
        <View style={s.center}>
          <CheckCircle size={48} color={R.green} strokeWidth={1.8} />
          <Text style={[s.errorText, { color: R.green, marginTop: 16 }]}>No cash to submit</Text>
          <Text style={s.mutedText}>All your COD orders have been settled.</Text>
          <TouchableOpacity style={[s.retryBtn, { backgroundColor: R.ink }]} onPress={handleDone} activeOpacity={0.85}>
            <Text style={s.retryBtnText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 32 }}
        >
          {overLimit && (
            <View style={s.limitWarn}>
              <Info size={16} color={R.red} />
              <Text style={s.limitWarnText}>You've hit the cash limit. Submit now to resume COD orders.</Text>
            </View>
          )}

          {/* Total amount card */}
          <View style={s.amountCard}>
            <View style={s.amountIconWrap}>
              <Banknote size={28} color={R.amber} />
            </View>
            <Text style={s.amountLabel}>Total Cash in Hand</Text>
            <Text style={s.amountValue}>₹{totalRupees}</Text>
            <Text style={s.amountSub}>{orders.length} COD order{orders.length > 1 ? 's' : ''}</Text>
          </View>

          {/* Orders list */}
          <Text style={s.sectionTitle}>Pending Orders</Text>
          <View style={s.ordersList}>
            {orders.map((order: any) => (
              <View key={order.id} style={s.orderRow}>
                <View style={s.orderDot} />
                <Text style={s.orderDisplayId}>{order.display_id}</Text>
                <Text style={s.orderAmount}>₹{(parseInt(order.total_amount_paise, 10) / 100).toFixed(0)}</Text>
              </View>
            ))}
          </View>

          {/* Method selector */}
          <Text style={s.sectionTitle}>Submission Method</Text>
          <View style={s.methodRow}>
            <TouchableOpacity
              style={[s.methodBtn, method === 'physical' && s.methodBtnActive]}
              onPress={() => setMethod('physical')}
              activeOpacity={0.8}
            >
              <Building2 size={20} color={method === 'physical' ? R.orange : R.muted} />
              <Text style={[s.methodBtnText, method === 'physical' && s.methodBtnTextActive]}>Finance Desk</Text>
              <Text style={s.methodBtnSub}>Hand cash in person</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.methodBtn, method === 'razorpay' && s.methodBtnActive]}
              onPress={() => setMethod('razorpay')}
              activeOpacity={0.8}
            >
              <Smartphone size={20} color={method === 'razorpay' ? R.orange : R.muted} />
              <Text style={[s.methodBtnText, method === 'razorpay' && s.methodBtnTextActive]}>Pay Online</Text>
              <Text style={s.methodBtnSub}>GPay / PhonePe / Card</Text>
            </TouchableOpacity>
          </View>

          {/* ── Razorpay section ── */}
          {method === 'razorpay' && (
            <View style={s.rzpCard}>
              <View style={s.rzpHeader}>
                <ShieldCheck size={22} color={R.rzp} />
                <Text style={s.rzpTitle}>Secure Payment via Razorpay</Text>
              </View>
              <Text style={s.rzpSub}>
                Pay ₹{totalRupees} instantly using GPay, PhonePe, Paytm, UPI, Debit / Credit card or Net Banking.
                Your badge clears automatically once the payment is confirmed — no manual steps.
              </Text>
              <View style={s.rzpFeatures}>
                {['GPay & PhonePe', 'UPI / Cards / Netbanking', 'Auto-verified instantly'].map(f => (
                  <View key={f} style={s.rzpFeatureRow}>
                    <CheckCircle2 size={14} color={R.green} />
                    <Text style={s.rzpFeatureText}>{f}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={[s.rzpBtn, rzpLoading && { opacity: 0.6 }]}
                onPress={handleRazorpayPay}
                disabled={rzpLoading}
                activeOpacity={0.88}
              >
                {rzpLoading
                  ? <ActivityIndicator color={R.white} />
                  : <>
                      <ShieldCheck size={18} color={R.white} />
                      <Text style={s.rzpBtnText}>Pay ₹{totalRupees} via Razorpay</Text>
                    </>
                }
              </TouchableOpacity>
            </View>
          )}

          {/* ── Physical cash steps ── */}
          {method === 'physical' && (
            <View style={s.stepsCard}>
              {[
                'Walk to the finance desk at your kitchen',
                `Hand over ₹${totalRupees} cash`,
                'Tap below to notify finance — they will confirm receipt',
              ].map((step, i) => (
                <View key={i} style={s.stepRow}>
                  <View style={s.stepNum}><Text style={s.stepNumText}>{i + 1}</Text></View>
                  <Text style={s.stepText}>{step}</Text>
                </View>
              ))}
              <View style={s.physicalNote}>
                <Clock size={14} color={R.amber} />
                <Text style={s.physicalNoteText}>
                  Your badge will clear once finance confirms. Do not leave until they've acknowledged.
                </Text>
              </View>
            </View>
          )}

          {/* Physical submit button */}
          {method === 'physical' && (
            <TouchableOpacity
              style={[s.submitBtn, submitMutation.isPending && { opacity: 0.6 }]}
              onPress={handlePhysicalSubmit}
              disabled={submitMutation.isPending}
              activeOpacity={0.88}
            >
              {submitMutation.isPending
                ? <ActivityIndicator color={R.white} />
                : <Text style={s.submitBtnText}>I've Handed Over the Cash</Text>
              }
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() =>
              Alert.alert(
                'Submit Later?',
                'Finance will not be notified until you submit. You may not receive new COD orders while cash is over the limit.',
                [{ text: 'Cancel', style: 'cancel' }, { text: 'Skip for Now', style: 'destructive', onPress: handleDone }],
              )
            }
            style={s.skipLink}
            activeOpacity={0.7}
          >
            <Text style={s.skipText}>Submit later (not recommended)</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: R.white },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8,
    borderBottomWidth: 1, borderBottomColor: R.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: R.ink },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  errorText: { fontSize: 16, fontWeight: '700', color: R.ink, textAlign: 'center' },
  mutedText: { fontSize: 13, color: R.muted, textAlign: 'center' },
  retryBtn: { backgroundColor: R.orange, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  retryBtnText: { color: R.white, fontWeight: '700', fontSize: 14 },

  limitWarn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: R.redLight, borderRadius: 12, padding: 14, marginTop: 16,
    borderWidth: 1, borderColor: '#FECACA',
  },
  limitWarnText: { flex: 1, color: R.red, fontSize: 13, fontWeight: '600', lineHeight: 18 },

  amountCard: {
    backgroundColor: R.amberLight, borderWidth: 1.5, borderColor: '#FDE68A',
    borderRadius: 24, padding: 24, alignItems: 'center', marginTop: 16, marginBottom: 24,
  },
  amountIconWrap: {
    width: 52, height: 52, borderRadius: 14, backgroundColor: R.white,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  amountLabel: { color: R.gray, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2 },
  amountValue: { color: R.amber, fontSize: 52, fontWeight: '900', letterSpacing: -2, marginTop: 4 },
  amountSub: { color: R.gray, fontSize: 13, marginTop: 4 },

  sectionTitle: { fontSize: 13, fontWeight: '700', color: R.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },

  ordersList: {
    backgroundColor: R.bg, borderRadius: 16, padding: 16, gap: 12, marginBottom: 24,
    borderWidth: 1, borderColor: R.border,
  },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  orderDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: R.amber },
  orderDisplayId: { flex: 1, fontSize: 14, fontWeight: '600', color: R.ink },
  orderAmount: { fontSize: 15, fontWeight: '800', color: R.ink },

  methodRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  methodBtn: {
    flex: 1, borderRadius: 16, padding: 16, alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: R.border, backgroundColor: R.white,
  },
  methodBtnActive: { borderColor: R.orange, backgroundColor: R.orangeLight },
  methodBtnText: { fontSize: 13, fontWeight: '800', color: R.muted },
  methodBtnTextActive: { color: R.orange },
  methodBtnSub: { fontSize: 11, color: R.muted, textAlign: 'center' },

  // Razorpay card
  rzpCard: {
    backgroundColor: R.rzpLight, borderRadius: 20, padding: 18, marginBottom: 20,
    borderWidth: 1, borderColor: '#C7D7F5', gap: 12,
  },
  rzpHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rzpTitle: { fontSize: 15, fontWeight: '900', color: R.rzp },
  rzpSub: { fontSize: 13, color: R.gray, lineHeight: 19 },
  rzpFeatures: { gap: 8 },
  rzpFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rzpFeatureText: { fontSize: 13, fontWeight: '600', color: R.ink },
  rzpBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: R.rzp, borderRadius: 14, paddingVertical: 16, marginTop: 4,
  },
  rzpBtnText: { color: R.white, fontSize: 16, fontWeight: '900' },

  // Physical steps
  stepsCard: {
    backgroundColor: R.bg, borderRadius: 16, padding: 16, gap: 14, marginBottom: 20,
    borderWidth: 1, borderColor: R.border,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepNum: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: R.orangeLight, borderWidth: 1.5, borderColor: '#FDDBB4',
    alignItems: 'center', justifyContent: 'center',
  },
  stepNumText: { color: R.orange, fontWeight: '900', fontSize: 12 },
  stepText: { flex: 1, color: R.ink, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  physicalNote: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: R.amberLight, borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: '#FDE68A', marginTop: 4,
  },
  physicalNoteText: { flex: 1, fontSize: 12, color: R.gray, lineHeight: 17 },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: R.orange, borderRadius: 18, paddingVertical: 18, marginBottom: 12,
    shadowColor: R.orange, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
  },
  submitBtnText: { color: R.white, fontSize: 16, fontWeight: '900' },

  skipLink: { alignItems: 'center', paddingVertical: 8 },
  skipText: { color: R.muted, fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' },

  // Pending overlay
  overlayRoot: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,255,255,0.97)',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 28, zIndex: 99,
  },
  overlayCard: {
    width: '100%', backgroundColor: R.white, borderRadius: 28,
    padding: 28, alignItems: 'center', gap: 12,
    shadowOpacity: 0.1, shadowRadius: 24, elevation: 8,
  },
  overlayCardAmber: { borderWidth: 1, borderColor: '#FDE68A', shadowColor: R.amber },
  overlayCardGreen: { borderWidth: 1, borderColor: '#A7F3D0', shadowColor: R.green },
  overlayIconWrap: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  overlayIconAmber: { backgroundColor: R.amberLight, borderWidth: 1.5, borderColor: '#FDE68A' },
  overlayIconGreen: { backgroundColor: R.greenLight, borderWidth: 1.5, borderColor: '#A7F3D0' },
  overlayTitle: { color: R.ink, fontSize: 22, fontWeight: '900', textAlign: 'center' },
  overlayAmount: { fontSize: 40, fontWeight: '900', letterSpacing: -1 },
  overlaySub: { color: R.gray, fontSize: 13, textAlign: 'center', lineHeight: 20, marginTop: 4 },
  overlayBadge: {
    backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6,
  },
  overlayBadgeText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.4 },
  overlayBtn: {
    width: '100%', backgroundColor: R.orange, borderRadius: 16,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  overlayBtnText: { color: R.white, fontSize: 15, fontWeight: '800' },
});

export default CashSubmitScreen;
