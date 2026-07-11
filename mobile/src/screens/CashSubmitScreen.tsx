import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
  ScrollView, Alert, ActivityIndicator, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Banknote, CheckCircle, ArrowLeft, Smartphone, Building2,
  Info, Clock, ExternalLink, CheckCircle2,
} from 'lucide-react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

const R = {
  orange: '#FC4603', orangeLight: '#FFF0E8',
  green: '#1BA672', greenLight: '#E8F8F1',
  amber: '#F59E0B', amberLight: 'rgba(245,158,11,0.08)',
  blue: '#3B82F6', blueLight: '#EFF6FF',
  ink: '#282C3F', gray: '#686B78', muted: '#93959F',
  border: '#E9E9EB', bg: '#F8F8F8', white: '#FFFFFF',
  red: '#EF4444', redLight: '#FEF2F2',
};

type Method = 'physical' | 'upi_transfer';

// ── Pending overlay (shown after submit, before finance confirms) ─────────────
const PendingOverlay = ({
  total, method, onDone,
}: { total: string; method: Method; onDone: () => void }) => {
  const isUpi = method === 'upi_transfer';
  return (
    <View style={s.overlayRoot}>
      <View style={[s.overlayCard, isUpi ? s.overlayCardBlue : s.overlayCardAmber]}>
        <View style={[s.overlayIconWrap, isUpi ? s.overlayIconBlue : s.overlayIconAmber]}>
          <Clock size={48} color={isUpi ? R.blue : R.amber} strokeWidth={1.8} />
        </View>
        <Text style={s.overlayTitle}>
          {isUpi ? 'UTR Submitted' : 'Finance Notified'}
        </Text>
        <Text style={[s.overlayAmount, { color: isUpi ? R.blue : R.amber }]}>
          ₹{total}
        </Text>
        <Text style={s.overlaySub}>
          {isUpi
            ? 'Finance is verifying your UTR number. You\'ll be notified once the transfer is confirmed.'
            : 'Please hand over the cash at the finance desk. Your badge will clear once finance confirms receipt.'}
        </Text>
        <View style={s.overlayBadge}>
          <Text style={[s.overlayBadgeText, { color: isUpi ? R.blue : R.amber }]}>
            {isUpi ? 'Pending UTR Verification' : 'Pending Finance Confirmation'}
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
  const [upiLaunched, setUpiLaunched] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['cash-in-hand'],
    queryFn: () => api.get('/riders/cash-in-hand'),
  });

  const orders: any[] = data?.orders || [];
  const totalPaise: number = data?.totalPaise || 0;
  const overLimit: boolean = data?.overLimit || false;
  const upiId: string = data?.upiId || 'badal90603@okaxis';
  const totalRupees = (totalPaise / 100).toFixed(0);
  const totalDecimal = (totalPaise / 100).toFixed(2);

  const submitMutation = useMutation({
    mutationFn: () => api.post('/riders/submit-all-cash', {
      orderIds: orders.map(o => o.id),
      method,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-in-hand'] });
      queryClient.invalidateQueries({ queryKey: ['rider-active-order'] });
      queryClient.invalidateQueries({ queryKey: ['rider-earnings'] });
      setSubmitted(true);
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.error || e.message || 'Could not submit. Try again.'),
  });

  const handleSubmit = () => {
    if (!orders.length) return;
    if (method === 'upi_transfer' && !upiLaunched) {
      Alert.alert('Pay First', 'Please tap "Pay via UPI" to complete the transfer before submitting.');
      return;
    }
    submitMutation.mutate();
  };

  // Open the native UPI app chooser with amount + payee pre-filled
  const openUpiApp = async (appScheme?: string) => {
    const note = encodeURIComponent('Cash submission - 2QT');
    const name = encodeURIComponent('2QT Food Palace');
    const baseParams = `pa=${upiId}&pn=${name}&am=${totalDecimal}&cu=INR&tn=${note}`;

    let url: string;
    if (appScheme === 'gpay') {
      url = `tez://upi/pay?${baseParams}`;
    } else if (appScheme === 'phonepe') {
      url = `phonepe://pay?${baseParams}`;
    } else if (appScheme === 'paytm') {
      url = `paytmmp://pay?${baseParams}`;
    } else {
      // Generic UPI intent — opens native chooser with ALL installed UPI apps
      url = `upi://pay?${baseParams}`;
    }

    const canOpen = await Linking.canOpenURL(url).catch(() => false);
    if (canOpen) {
      await Linking.openURL(url);
      setUpiLaunched(true);
    } else if (appScheme) {
      // Specific app not installed — fall back to generic chooser
      openUpiApp();
    } else {
      Alert.alert('No UPI App Found', 'Please install GPay, PhonePe, or Paytm to make UPI payments.');
    }
  };


  const handleDone = () => navigation.navigate('RiderTabs');

  if (submitted) {
    return <PendingOverlay total={totalRupees} method={method} onDone={handleDone} />;
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

          <View style={s.amountCard}>
            <View style={s.amountIconWrap}>
              <Banknote size={28} color={R.amber} />
            </View>
            <Text style={s.amountLabel}>Total Cash in Hand</Text>
            <Text style={s.amountValue}>₹{totalRupees}</Text>
            <Text style={s.amountSub}>{orders.length} COD order{orders.length > 1 ? 's' : ''}</Text>
          </View>

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
              style={[s.methodBtn, method === 'upi_transfer' && s.methodBtnActive]}
              onPress={() => setMethod('upi_transfer')}
              activeOpacity={0.8}
            >
              <Smartphone size={20} color={method === 'upi_transfer' ? R.orange : R.muted} />
              <Text style={[s.methodBtnText, method === 'upi_transfer' && s.methodBtnTextActive]}>UPI Transfer</Text>
              <Text style={s.methodBtnSub}>Send via UPI app</Text>
            </TouchableOpacity>
          </View>

          {/* ── UPI Transfer Section ── */}
          {method === 'upi_transfer' && (
            <View style={s.upiCard}>
              {/* Amount + UPI ID */}
              <View style={s.upiHeader}>
                <Text style={s.upiHeaderLabel}>Send exactly</Text>
                <Text style={s.upiHeaderAmount}>₹{totalRupees}</Text>
                <Text style={s.upiId}>{upiId}</Text>
              </View>

              {!upiLaunched ? (
                <>
                  {/* Quick-launch buttons */}
                  <Text style={s.upiAppLabel}>Open in your UPI app</Text>
                  <TouchableOpacity style={s.payNowBtn} onPress={() => openUpiApp()} activeOpacity={0.85}>
                    <ExternalLink size={18} color={R.white} />
                    <Text style={s.payNowBtnText}>Pay ₹{totalRupees} via UPI</Text>
                  </TouchableOpacity>
                  <View style={s.appShortcuts}>
                    {[
                      { label: 'GPay', scheme: 'gpay' },
                      { label: 'PhonePe', scheme: 'phonepe' },
                      { label: 'Paytm', scheme: 'paytm' },
                    ].map(app => (
                      <TouchableOpacity
                        key={app.scheme}
                        style={s.appBtn}
                        onPress={() => openUpiApp(app.scheme)}
                        activeOpacity={0.8}
                      >
                        <Text style={s.appBtnText}>{app.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              ) : (
                /* After pay — just a confirmation tick, no UTR needed */
                <View style={s.paidConfirm}>
                  <CheckCircle2 size={28} color={R.green} strokeWidth={2} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.paidConfirmTitle}>Payment Initiated</Text>
                    <Text style={s.paidConfirmSub}>Finance will verify the transfer in your UPI app.</Text>
                  </View>
                </View>
              )}

              {upiLaunched && (
                <TouchableOpacity onPress={() => setUpiLaunched(false)} activeOpacity={0.7} style={s.repayLink}>
                  <Text style={s.repayLinkText}>Pay again / use a different app</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ── Physical Cash Steps ── */}
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

          <TouchableOpacity
            style={[s.submitBtn, submitMutation.isPending && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitMutation.isPending}
            activeOpacity={0.88}
          >
            {submitMutation.isPending
              ? <ActivityIndicator color={R.white} />
              : <Text style={s.submitBtnText}>
                  {method === 'upi_transfer' ? "Done — I've Paid" : "I've Handed Over the Cash"}
                </Text>
            }
          </TouchableOpacity>

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

  // UPI card
  upiCard: {
    backgroundColor: R.blueLight, borderRadius: 20, padding: 18, marginBottom: 20,
    borderWidth: 1, borderColor: '#BFDBFE', gap: 16,
  },
  upiHeader: { alignItems: 'center', gap: 4 },
  upiHeaderLabel: { fontSize: 12, fontWeight: '700', color: R.blue, textTransform: 'uppercase', letterSpacing: 0.8 },
  upiHeaderAmount: { fontSize: 40, fontWeight: '900', color: R.ink, letterSpacing: -1.5 },
  upiId: { fontSize: 16, fontWeight: '700', color: R.blue },
  upiAppLabel: { fontSize: 12, fontWeight: '700', color: R.gray, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.6 },
  payNowBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: R.blue, borderRadius: 14, paddingVertical: 16,
  },
  payNowBtnText: { color: R.white, fontSize: 16, fontWeight: '900' },
  appShortcuts: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  appBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 12,
    backgroundColor: R.white, borderWidth: 1.5, borderColor: '#93C5FD',
    alignItems: 'center',
  },
  appBtnText: { fontSize: 13, fontWeight: '800', color: R.blue },

  paidConfirm: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: R.greenLight, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#B7E8D7',
  },
  paidConfirmTitle: { fontSize: 14, fontWeight: '800', color: R.green },
  paidConfirmSub: { fontSize: 12, color: R.gray, lineHeight: 17, marginTop: 2 },
  repayLink: { alignItems: 'center', paddingTop: 4 },
  repayLinkText: { fontSize: 12, color: R.blue, fontWeight: '600', textDecorationLine: 'underline' },

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
  overlayCardBlue: { borderWidth: 1, borderColor: '#BFDBFE', shadowColor: R.blue },
  overlayIconWrap: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  overlayIconAmber: { backgroundColor: R.amberLight, borderWidth: 1.5, borderColor: '#FDE68A' },
  overlayIconBlue: { backgroundColor: R.blueLight, borderWidth: 1.5, borderColor: '#BFDBFE' },
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
