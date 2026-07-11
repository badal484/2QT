import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
  ScrollView, TextInput, Animated, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Banknote, CheckCircle, ArrowLeft, Smartphone, Building2, Info } from 'lucide-react-native';
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

const COMPANY_UPI = 'velto@upi'; // replace with actual UPI ID

type Method = 'physical' | 'upi_transfer';

const ConfirmedOverlay = ({ total, method, onDone }: { total: string; method: Method; onDone: () => void }) => {
  return (
    <View style={s.overlayRoot}>
      <View style={s.overlayCard}>
        <View style={s.overlayIconWrap}>
          <CheckCircle size={48} color={R.green} strokeWidth={1.8} />
        </View>
        <Text style={s.overlayTitle}>{method === 'upi_transfer' ? 'Transfer Recorded!' : 'Cash Submitted!'}</Text>
        <Text style={s.overlayAmount}>₹{total}</Text>
        <Text style={s.overlaySub}>
          {method === 'upi_transfer'
            ? 'Finance will verify your UTR and confirm the transfer shortly.'
            : 'Finance has been notified. Hand over the cash and wait for confirmation.'}
        </Text>
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
  const [utrNumber, setUtrNumber] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['cash-in-hand'],
    queryFn: () => api.get('/riders/cash-in-hand'),
  });

  const orders: any[] = data?.orders || [];
  const totalPaise: number = data?.totalPaise || 0;
  const overLimit: boolean = data?.overLimit || false;
  const totalRupees = (totalPaise / 100).toFixed(0);

  const submitMutation = useMutation({
    mutationFn: () => api.post('/riders/submit-all-cash', {
      orderIds: orders.map(o => o.id),
      method,
      utrNumber: method === 'upi_transfer' ? utrNumber.trim() : undefined,
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
    if (method === 'upi_transfer' && utrNumber.trim().length < 4) {
      Alert.alert('Invalid UTR', 'Please enter a valid UTR / transaction reference number.');
      return;
    }
    submitMutation.mutate();
  };

  const handleDone = () => navigation.navigate('RiderTabs');

  if (submitted) {
    return (
      <ConfirmedOverlay
        total={totalRupees}
        method={method}
        onDone={handleDone}
      />
    );
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={R.white} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <ArrowLeft size={20} color={R.ink} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Submit Cash</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={R.orange} />
        </View>
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
          {/* Over-limit warning */}
          {overLimit && (
            <View style={s.limitWarn}>
              <Info size={16} color={R.red} />
              <Text style={s.limitWarnText}>You've hit the ₹2,000 cash limit. Submit now to resume COD orders.</Text>
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
              style={[s.methodBtn, method === 'upi_transfer' && s.methodBtnActive]}
              onPress={() => setMethod('upi_transfer')}
              activeOpacity={0.8}
            >
              <Smartphone size={20} color={method === 'upi_transfer' ? R.orange : R.muted} />
              <Text style={[s.methodBtnText, method === 'upi_transfer' && s.methodBtnTextActive]}>UPI Transfer</Text>
              <Text style={s.methodBtnSub}>Send via UPI app</Text>
            </TouchableOpacity>
          </View>

          {/* UPI instructions + UTR input */}
          {method === 'upi_transfer' && (
            <View style={s.upiCard}>
              <View style={s.upiRow}>
                <Text style={s.upiLabel}>Transfer ₹{totalRupees} to:</Text>
                <Text style={s.upiId}>{COMPANY_UPI}</Text>
              </View>
              <Text style={s.upiNote}>Open any UPI app, transfer the exact amount, then enter the UTR number below.</Text>
              <TextInput
                style={s.utrInput}
                placeholder="Enter UTR / Transaction Reference"
                placeholderTextColor={R.muted}
                value={utrNumber}
                onChangeText={setUtrNumber}
                autoCapitalize="characters"
                returnKeyType="done"
              />
            </View>
          )}

          {/* Physical steps */}
          {method === 'physical' && (
            <View style={s.stepsCard}>
              {[
                'Walk to the finance desk at your kitchen',
                `Hand over ₹${totalRupees} cash`,
                'Tap the button below to notify finance',
              ].map((step, i) => (
                <View key={i} style={s.stepRow}>
                  <View style={s.stepNum}><Text style={s.stepNumText}>{i + 1}</Text></View>
                  <Text style={s.stepText}>{step}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={[s.submitBtn, submitMutation.isPending && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitMutation.isPending}
            activeOpacity={0.88}
          >
            {submitMutation.isPending
              ? <ActivityIndicator color={R.white} />
              : <Text style={s.submitBtnText}>
                  {method === 'upi_transfer' ? 'Confirm UPI Transfer' : "I've Handed Over the Cash"}
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

  upiCard: {
    backgroundColor: R.blueLight, borderRadius: 16, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: '#BFDBFE', gap: 10,
  },
  upiRow: { alignItems: 'center', gap: 4 },
  upiLabel: { fontSize: 12, fontWeight: '600', color: R.blue },
  upiId: { fontSize: 20, fontWeight: '900', color: R.ink, letterSpacing: 0.5 },
  upiNote: { fontSize: 12, color: R.gray, lineHeight: 18, textAlign: 'center' },
  utrInput: {
    backgroundColor: R.white, borderRadius: 12, padding: 14,
    borderWidth: 1.5, borderColor: '#93C5FD',
    fontSize: 15, fontWeight: '700', color: R.ink,
    textAlign: 'center', letterSpacing: 1,
  },

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

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: R.orange, borderRadius: 18, paddingVertical: 18, marginBottom: 12,
    shadowColor: R.orange, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
  },
  submitBtnText: { color: R.white, fontSize: 16, fontWeight: '900' },

  skipLink: { alignItems: 'center', paddingVertical: 8 },
  skipText: { color: R.muted, fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' },

  overlayRoot: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,255,255,0.97)',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 28, zIndex: 99,
  },
  overlayCard: {
    width: '100%', backgroundColor: R.white, borderRadius: 28,
    padding: 28, alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: '#B7E8D7',
    shadowColor: R.green, shadowOpacity: 0.12, shadowRadius: 24, elevation: 8,
  },
  overlayIconWrap: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: R.greenLight,
    borderWidth: 1.5, borderColor: '#B7E8D7',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  overlayTitle: { color: R.ink, fontSize: 22, fontWeight: '900', textAlign: 'center' },
  overlayAmount: { color: R.green, fontSize: 40, fontWeight: '900', letterSpacing: -1 },
  overlaySub: { color: R.gray, fontSize: 13, textAlign: 'center', lineHeight: 20, marginTop: 4 },
  overlayBtn: {
    width: '100%', backgroundColor: R.orange, borderRadius: 16,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  overlayBtnText: { color: R.white, fontSize: 15, fontWeight: '800' },
});

export default CashSubmitScreen;
