import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, ActivityIndicator,
  Alert, StatusBar, StyleSheet, TextInput,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import {
  ArrowLeft, Zap, CheckCircle, Clock, ArrowUpRight,
  ShieldCheck, AlertCircle, Pencil,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const R = {
  orange: '#FC8019', orangeLight: '#FFF3E8',
  green: '#1BA672', greenLight: '#E8F8F1',
  amber: '#F59E0B', amberLight: 'rgba(245,158,11,0.1)',
  purple: '#8B5CF6', purpleLight: 'rgba(139,92,246,0.1)',
  ink: '#282C3F', gray: '#686B78', muted: '#93959F',
  border: '#E9E9EB', bg: '#F8F8F8', white: '#FFFFFF',
};

const PayoutsScreen = ({ navigation }: any) => {
  const queryClient = useQueryClient();
  const [upiInput, setUpiInput] = useState('');
  const [editingUpi, setEditingUpi] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['rider-payouts-history'],
    queryFn: () => api.get('/riders/payouts'),
  });

  const saveUpiMutation = useMutation({
    mutationFn: () => api.patch('/riders/upi', { upiId: upiInput.trim() }),
    onSuccess: () => {
      setEditingUpi(false);
      setUpiInput('');
      queryClient.invalidateQueries({ queryKey: ['rider-payouts-history'] });
      Alert.alert('UPI Saved!', 'Your earnings will be automatically transferred to this UPI every night at 11:45 PM.');
    },
    onError: (err: any) => Alert.alert('Error', err.message || 'Could not save UPI'),
  });

  const requestMutation = useMutation({
    mutationFn: () => api.post('/riders/payouts/request', {
      amountPaise: data?.pendingAmountPaise,
      upiId: data?.storedUpiId || upiInput.trim(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rider-payouts-history'] });
      Alert.alert('Request Sent', 'Finance will process your settlement.');
    },
    onError: (err: any) => Alert.alert('Failed', err.response?.data?.message || err.message || 'Try again'),
  });

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: R.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={R.orange} />
      </View>
    );
  }

  const pendingPaise  = data?.pendingAmountPaise || 0;
  const storedUpi     = data?.storedUpiId as string | null;
  const todayPaise    = data?.todayEarningsPaise || 0;
  const todayOrders   = data?.todayDeliveries || 0;
  const canRequest    = pendingPaise >= 10000;
  const autoPayActive = !!storedUpi;

  return (
    <View style={{ flex: 1, backgroundColor: R.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={R.white} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={20} color={R.ink} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.headerSup}>EARNINGS</Text>
            <Text style={styles.headerTitle}>Payouts</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 16 }}>

          {/* Today snapshot */}
          <View style={[styles.card, { flexDirection: 'row', gap: 12 }]}>
            <View style={[styles.stat, { flex: 1 }]}>
              <Text style={styles.statLabel}>TODAY'S EARNINGS</Text>
              <Text style={[styles.statValue, { color: R.orange }]}>₹{(todayPaise / 100).toFixed(0)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={[styles.stat, { flex: 1 }]}>
              <Text style={styles.statLabel}>DELIVERIES</Text>
              <Text style={[styles.statValue, { color: R.ink }]}>{todayOrders}</Text>
            </View>
          </View>

          {/* Pending balance */}
          <View style={[styles.card, { borderColor: autoPayActive ? '#B7E8D7' : R.border }]}>
            <Text style={styles.balLabel}>TOTAL PENDING</Text>
            <Text style={styles.balAmount}>₹{(pendingPaise / 100).toFixed(0)}</Text>

            <View style={[styles.scheduleRow, autoPayActive && { borderColor: '#B7E8D7', backgroundColor: R.greenLight }]}>
              {autoPayActive
                ? <CheckCircle size={14} color={R.green} />
                : <Clock size={14} color={R.muted} />
              }
              <Text style={[styles.scheduleText, autoPayActive && { color: R.green }]}>
                {autoPayActive ? 'AUTO-PAY ACTIVE · Every night 11:45 PM' : 'Set UPI below to enable daily auto-pay'}
              </Text>
            </View>
          </View>

          {/* Auto-pay UPI setup */}
          <View style={[styles.card, { borderColor: autoPayActive ? '#B7E8D7' : '#FDE68A' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.iconWrap, { backgroundColor: autoPayActive ? R.greenLight : R.amberLight }]}>
                  <Zap size={16} color={autoPayActive ? R.green : R.amber} />
                </View>
                <Text style={styles.sectionTitle}>
                  {autoPayActive ? 'Daily Auto-Pay' : 'Enable Daily Auto-Pay'}
                </Text>
              </View>
              {autoPayActive && !editingUpi && (
                <TouchableOpacity onPress={() => { setEditingUpi(true); setUpiInput(storedUpi || ''); }} activeOpacity={0.7}>
                  <Pencil size={16} color={R.muted} />
                </TouchableOpacity>
              )}
            </View>

            {autoPayActive && !editingUpi ? (
              <>
                <View style={styles.upiDisplay}>
                  <CheckCircle size={16} color={R.green} />
                  <Text style={styles.upiDisplayText}>{storedUpi}</Text>
                </View>
                <Text style={styles.upiHint}>Your today's earnings will be transferred here at 11:45 PM every night</Text>
              </>
            ) : (
              <>
                <Text style={styles.upiHint}>
                  {editingUpi ? 'Enter new UPI ID to update:' : 'Enter your UPI ID once — we transfer earnings automatically every night:'}
                </Text>
                <TextInput
                  style={styles.upiInput}
                  placeholder="yourname@upi"
                  placeholderTextColor={R.muted}
                  value={upiInput}
                  onChangeText={setUpiInput}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {editingUpi && (
                    <TouchableOpacity
                      onPress={() => setEditingUpi(false)}
                      style={[styles.saveBtn, { flex: 1, backgroundColor: R.bg, borderWidth: 1, borderColor: R.border }]}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.saveBtnText, { color: R.muted }]}>Cancel</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => {
                      if (!upiInput.trim()) return Alert.alert('Required', 'Enter your UPI ID');
                      saveUpiMutation.mutate();
                    }}
                    style={[styles.saveBtn, { flex: 2, backgroundColor: R.orange, opacity: saveUpiMutation.isPending ? 0.6 : 1 }]}
                    disabled={saveUpiMutation.isPending}
                    activeOpacity={0.88}
                  >
                    {saveUpiMutation.isPending
                      ? <ActivityIndicator size="small" color={R.white} />
                      : <Text style={styles.saveBtnText}>Save & Activate Auto-Pay</Text>
                    }
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>

          {/* Manual request */}
          {canRequest && (
            <TouchableOpacity
              onPress={() => {
                const upi = storedUpi || upiInput.trim();
                if (!upi) return Alert.alert('UPI Required', 'Set your UPI above first');
                Alert.alert(
                  'Request Manual Payout',
                  `Request ₹${(pendingPaise / 100).toFixed(0)} to ${upi}?`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Request', onPress: () => requestMutation.mutate() },
                  ]
                );
              }}
              style={[styles.manualBtn, requestMutation.isPending && { opacity: 0.6 }]}
              disabled={requestMutation.isPending}
              activeOpacity={0.85}
            >
              <ArrowUpRight size={16} color={R.orange} />
              <Text style={styles.manualBtnText}>Request Manual Payout</Text>
            </TouchableOpacity>
          )}

          {/* History header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <ShieldCheck size={14} color={R.orange} />
            <Text style={[styles.sectionTitle, { color: R.orange }]}>PAYOUT HISTORY</Text>
          </View>

          {(!data?.payouts || data.payouts.length === 0) ? (
            <View style={styles.emptyCard}>
              <AlertCircle size={32} color={R.muted} />
              <Text style={styles.emptyText}>No payouts recorded yet</Text>
            </View>
          ) : (
            data.payouts.map((p: any) => {
              const isPaid = p.status === 'paid';
              const isAuto = p.payout_mode === 'auto';
              return (
                <View key={p.id} style={styles.payoutRow}>
                  <View style={[styles.payoutIcon, { backgroundColor: isPaid ? R.greenLight : R.orangeLight }]}>
                    <ShieldCheck size={16} color={isPaid ? R.green : R.orange} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.payoutDate}>
                      {new Date(p.week_start || p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                      <View style={[styles.badge, isPaid ? styles.badgePaid : styles.badgePending]}>
                        <Text style={[styles.badgeText, { color: isPaid ? R.green : R.orange }]}>
                          {p.status.toUpperCase()}
                        </Text>
                      </View>
                      {isAuto && (
                        <View style={[styles.badge, { backgroundColor: R.purpleLight }]}>
                          <Text style={[styles.badgeText, { color: R.purple }]}>AUTO</Text>
                        </View>
                      )}
                      {p.utr_number && (
                        <Text style={styles.utrText}>UTR: {p.utr_number}</Text>
                      )}
                    </View>
                  </View>
                  <Text style={styles.payoutAmt}>₹{(p.net_amount_paise / 100).toFixed(0)}</Text>
                </View>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16,
    backgroundColor: R.white,
    borderBottomWidth: 1, borderBottomColor: R.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: R.bg,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: R.border,
  },
  headerSup: { color: R.orange, fontSize: 8, fontWeight: '900', letterSpacing: 2 },
  headerTitle: { color: R.ink, fontSize: 18, fontWeight: '900', marginTop: 1 },

  card: {
    backgroundColor: R.white, borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: R.border,
  },
  stat: { alignItems: 'center' },
  statLabel: { color: R.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  statValue: { fontSize: 28, fontWeight: '900', marginTop: 6, letterSpacing: -1 },
  divider: { width: 1, backgroundColor: R.border },

  balLabel: { color: R.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  balAmount: { color: R.ink, fontSize: 44, fontWeight: '900', letterSpacing: -2, marginTop: 6, marginBottom: 16 },
  scheduleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: R.bg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: R.border,
  },
  scheduleText: { color: R.muted, fontSize: 10, fontWeight: '700', flex: 1 },

  iconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { color: R.ink, fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  upiDisplay: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: R.greenLight, borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#B7E8D7',
  },
  upiDisplayText: { color: R.green, fontWeight: '800', fontSize: 14, fontFamily: 'monospace' },
  upiHint: { color: R.gray, fontSize: 12, lineHeight: 18, marginBottom: 14 },
  upiInput: {
    backgroundColor: R.bg, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    color: R.ink, fontSize: 15, fontWeight: '700',
    borderWidth: 1, borderColor: R.border, marginBottom: 14,
  },
  saveBtn: {
    borderRadius: 14, paddingVertical: 15, alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { color: R.white, fontWeight: '900', fontSize: 13 },

  manualBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: R.orangeLight, borderRadius: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: '#FDDBB4',
  },
  manualBtnText: { color: R.orange, fontWeight: '700', fontSize: 13 },

  emptyCard: {
    backgroundColor: R.white, borderRadius: 20, paddingVertical: 48,
    alignItems: 'center', gap: 10, borderWidth: 1, borderColor: R.border,
  },
  emptyText: { color: R.muted, fontWeight: '700', fontSize: 13 },

  payoutRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: R.white, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: R.border,
  },
  payoutIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  payoutDate: { color: R.ink, fontWeight: '800', fontSize: 14 },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  badgePaid: { backgroundColor: R.greenLight },
  badgePending: { backgroundColor: R.orangeLight },
  badgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  utrText: { color: R.muted, fontSize: 9, fontWeight: '700', fontFamily: 'monospace', alignSelf: 'center' },
  payoutAmt: { color: R.ink, fontWeight: '900', fontSize: 18, letterSpacing: -0.5 },
});

export default PayoutsScreen;
