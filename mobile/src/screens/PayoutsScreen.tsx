import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, ActivityIndicator,
  Alert, StatusBar, StyleSheet, TextInput,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import {
  ArrowLeft, CheckCircle, Clock, ShieldCheck, AlertCircle,
  Pencil, Building2, Smartphone,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const R = {
  orange: '#FC4603', orangeLight: '#FFF0E8',
  green: '#1BA672', greenLight: '#E8F8F1',
  amber: '#F59E0B', amberLight: 'rgba(245,158,11,0.1)',
  purple: '#8B5CF6', purpleLight: 'rgba(139,92,246,0.1)',
  ink: '#282C3F', gray: '#686B78', muted: '#93959F',
  border: '#E9E9EB', bg: '#F8F8F8', white: '#FFFFFF',
};

type PayoutTab = 'bank' | 'upi';

const PayoutsScreen = ({ navigation }: any) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<PayoutTab>('bank');
  const [editing, setEditing] = useState(false);

  // Bank fields
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [accountName, setAccountName] = useState('');

  // UPI field
  const [upiInput, setUpiInput] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['rider-payouts-history'],
    queryFn: () => api.get('/riders/payouts'),
  });

  // Sync tab to stored payout method once loaded
  useEffect(() => {
    if (data?.payoutMethod) {
      setActiveTab(data.payoutMethod === 'bank' ? 'bank' : 'upi');
    }
  }, [data?.payoutMethod]);

  const saveBankMutation = useMutation({
    mutationFn: () => api.patch('/riders/bank-account', { accountNumber, ifsc, accountName }),
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['rider-payouts-history'] });
      Alert.alert('Bank Account Saved', 'Earnings will be transferred to your bank every Monday at 10 AM.');
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.error || err.message || 'Could not save bank account'),
  });

  const saveUpiMutation = useMutation({
    mutationFn: () => api.patch('/riders/upi', { upiId: upiInput.trim() }),
    onSuccess: () => {
      setEditing(false);
      setUpiInput('');
      queryClient.invalidateQueries({ queryKey: ['rider-payouts-history'] });
      Alert.alert('UPI Saved', 'Earnings will be transferred to your UPI every Monday at 10 AM.');
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.error || err.message || 'Could not save UPI'),
  });

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: R.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={R.orange} />
      </View>
    );
  }

  const pendingPaise = data?.pendingAmountPaise || 0;
  const todayPaise   = data?.todayEarningsPaise || 0;
  const todayOrders  = data?.todayDeliveries || 0;
  const payoutMethod = data?.payoutMethod || 'upi';

  const storedUpi    = data?.storedUpiId as string | null;
  const storedBank   = data?.bankAccountNumber as string | null;
  const storedIfsc   = data?.bankIfsc as string | null;
  const storedName   = data?.bankAccountName as string | null;

  const hasBank = !!(storedBank && storedIfsc);
  const hasUpi  = !!storedUpi;
  const autoPayActive = payoutMethod === 'bank' ? hasBank : hasUpi;

  const isSaving = saveBankMutation.isPending || saveUpiMutation.isPending;

  const handleSave = () => {
    if (activeTab === 'bank') {
      if (!accountNumber.trim()) return Alert.alert('Required', 'Enter account number');
      if (!ifsc.trim()) return Alert.alert('Required', 'Enter IFSC code');
      if (!accountName.trim()) return Alert.alert('Required', 'Enter account holder name');
      saveBankMutation.mutate();
    } else {
      if (!upiInput.trim()) return Alert.alert('Required', 'Enter your UPI ID');
      saveUpiMutation.mutate();
    }
  };

  const startEditing = () => {
    if (activeTab === 'bank') {
      setAccountNumber(storedBank || '');
      setIfsc(storedIfsc || '');
      setAccountName(storedName || '');
    } else {
      setUpiInput(storedUpi || '');
    }
    setEditing(true);
  };

  const currentSaved = activeTab === 'bank' ? hasBank : hasUpi;

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
                {autoPayActive
                  ? `AUTO-PAY ACTIVE · Every Monday 10 AM`
                  : 'Set payout method below to enable weekly auto-pay'}
              </Text>
            </View>
          </View>

          {/* Payout method card */}
          <View style={[styles.card, { borderColor: autoPayActive ? '#B7E8D7' : '#FDE68A' }]}>

            {/* Tab switcher */}
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'bank' && styles.tabActive]}
                onPress={() => { setActiveTab('bank'); setEditing(false); }}
                activeOpacity={0.8}
              >
                <Building2 size={14} color={activeTab === 'bank' ? R.white : R.muted} />
                <Text style={[styles.tabText, activeTab === 'bank' && styles.tabTextActive]}>Bank Account</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'upi' && styles.tabActive]}
                onPress={() => { setActiveTab('upi'); setEditing(false); }}
                activeOpacity={0.8}
              >
                <Smartphone size={14} color={activeTab === 'upi' ? R.white : R.muted} />
                <Text style={[styles.tabText, activeTab === 'upi' && styles.tabTextActive]}>UPI</Text>
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: 16 }}>
              {activeTab === 'bank' ? (
                /* Bank tab */
                currentSaved && !editing ? (
                  <>
                    <View style={styles.savedRow}>
                      <CheckCircle size={16} color={R.green} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.savedName}>{storedName}</Text>
                        <Text style={styles.savedDetail}>{'•'.repeat(8) + (storedBank?.slice(-4) || '')}</Text>
                        <Text style={styles.savedDetail}>{storedIfsc}</Text>
                      </View>
                      <TouchableOpacity onPress={startEditing} activeOpacity={0.7}>
                        <Pencil size={16} color={R.muted} />
                      </TouchableOpacity>
                    </View>
                    {payoutMethod !== 'bank' && (
                      <TouchableOpacity
                        onPress={() => saveBankMutation.mutate()}
                        style={[styles.saveBtn, { backgroundColor: R.green, marginTop: 12 }]}
                        activeOpacity={0.88}
                      >
                        <Text style={styles.saveBtnText}>Use Bank for Payouts</Text>
                      </TouchableOpacity>
                    )}
                    <Text style={styles.hint}>Weekly transfer every Monday 10 AM</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.hint}>
                      {editing ? 'Update bank account details:' : 'Enter your bank details for weekly salary-style payouts:'}
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Account Holder Name"
                      placeholderTextColor={R.muted}
                      value={accountName}
                      onChangeText={setAccountName}
                      autoCapitalize="words"
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Account Number"
                      placeholderTextColor={R.muted}
                      value={accountNumber}
                      onChangeText={setAccountNumber}
                      keyboardType="numeric"
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="IFSC Code (e.g. SBIN0001234)"
                      placeholderTextColor={R.muted}
                      value={ifsc}
                      onChangeText={(t) => setIfsc(t.toUpperCase())}
                      autoCapitalize="characters"
                    />
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      {editing && (
                        <TouchableOpacity
                          onPress={() => setEditing(false)}
                          style={[styles.saveBtn, { flex: 1, backgroundColor: R.bg, borderWidth: 1, borderColor: R.border }]}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.saveBtnText, { color: R.muted }]}>Cancel</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        onPress={handleSave}
                        style={[styles.saveBtn, { flex: 2, backgroundColor: R.orange, opacity: isSaving ? 0.6 : 1 }]}
                        disabled={isSaving}
                        activeOpacity={0.88}
                      >
                        {isSaving
                          ? <ActivityIndicator size="small" color={R.white} />
                          : <Text style={styles.saveBtnText}>Save Bank Account</Text>
                        }
                      </TouchableOpacity>
                    </View>
                  </>
                )
              ) : (
                /* UPI tab */
                currentSaved && !editing ? (
                  <>
                    <View style={styles.savedRow}>
                      <CheckCircle size={16} color={R.green} />
                      <Text style={[styles.savedName, { flex: 1, fontFamily: 'monospace' }]}>{storedUpi}</Text>
                      <TouchableOpacity onPress={startEditing} activeOpacity={0.7}>
                        <Pencil size={16} color={R.muted} />
                      </TouchableOpacity>
                    </View>
                    {payoutMethod !== 'upi' && (
                      <TouchableOpacity
                        onPress={() => saveUpiMutation.mutate()}
                        style={[styles.saveBtn, { backgroundColor: R.green, marginTop: 12 }]}
                        activeOpacity={0.88}
                      >
                        <Text style={styles.saveBtnText}>Use UPI for Payouts</Text>
                      </TouchableOpacity>
                    )}
                    <Text style={styles.hint}>Weekly transfer every Monday 10 AM</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.hint}>
                      {editing ? 'Enter new UPI ID:' : 'Enter your UPI ID for weekly auto-payouts:'}
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder="yourname@upi"
                      placeholderTextColor={R.muted}
                      value={upiInput}
                      onChangeText={setUpiInput}
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      {editing && (
                        <TouchableOpacity
                          onPress={() => setEditing(false)}
                          style={[styles.saveBtn, { flex: 1, backgroundColor: R.bg, borderWidth: 1, borderColor: R.border }]}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.saveBtnText, { color: R.muted }]}>Cancel</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        onPress={handleSave}
                        style={[styles.saveBtn, { flex: 2, backgroundColor: R.orange, opacity: isSaving ? 0.6 : 1 }]}
                        disabled={isSaving}
                        activeOpacity={0.88}
                      >
                        {isSaving
                          ? <ActivityIndicator size="small" color={R.white} />
                          : <Text style={styles.saveBtnText}>Save UPI</Text>
                        }
                      </TouchableOpacity>
                    </View>
                  </>
                )
              )}
            </View>
          </View>

          {/* Payout history header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <ShieldCheck size={14} color={R.orange} />
            <Text style={[styles.sectionTitle, { color: R.orange }]}>PAYOUT HISTORY</Text>
          </View>

          {(!data?.payouts || data.payouts.length === 0) ? (
            <View style={styles.emptyCard}>
              <AlertCircle size={32} color={R.muted} />
              <Text style={styles.emptyText}>No payouts yet</Text>
              <Text style={styles.emptyHint}>First payout runs Monday 10 AM</Text>
            </View>
          ) : (
            data.payouts.map((p: any) => {
              const isPaid = p.status === 'paid';
              const isAuto = p.payout_mode === 'auto';
              const method = p.payout_method || 'upi';
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
                      <View style={[styles.badge, { backgroundColor: R.bg }]}>
                        <Text style={[styles.badgeText, { color: R.muted }]}>
                          {method === 'bank' ? 'BANK' : 'UPI'}
                        </Text>
                      </View>
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

  tabRow: {
    flexDirection: 'row', gap: 8,
    backgroundColor: R.bg, borderRadius: 14, padding: 4,
    borderWidth: 1, borderColor: R.border,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 10,
  },
  tabActive: { backgroundColor: R.orange },
  tabText: { fontSize: 12, fontWeight: '800', color: R.muted },
  tabTextActive: { color: R.white },

  savedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: R.greenLight, borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#B7E8D7',
  },
  savedName: { color: R.green, fontWeight: '800', fontSize: 14 },
  savedDetail: { color: R.green, fontSize: 12, fontWeight: '600', opacity: 0.8, marginTop: 2 },

  sectionTitle: { color: R.ink, fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  hint: { color: R.gray, fontSize: 12, lineHeight: 18, marginBottom: 14 },
  input: {
    backgroundColor: R.bg, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    color: R.ink, fontSize: 15, fontWeight: '700',
    borderWidth: 1, borderColor: R.border, marginBottom: 12,
  },
  saveBtn: {
    borderRadius: 14, paddingVertical: 15, alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { color: R.white, fontWeight: '900', fontSize: 13 },

  emptyCard: {
    backgroundColor: R.white, borderRadius: 20, paddingVertical: 48,
    alignItems: 'center', gap: 8, borderWidth: 1, borderColor: R.border,
  },
  emptyText: { color: R.muted, fontWeight: '700', fontSize: 13 },
  emptyHint: { color: R.muted, fontSize: 11 },

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
