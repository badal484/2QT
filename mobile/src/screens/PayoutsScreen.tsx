import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, ActivityIndicator,
  Alert, StatusBar, StyleSheet, TextInput,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import {
  ArrowLeft, CheckCircle, AlertCircle,
  Pencil, Building2, Smartphone, Banknote, Shield, IndianRupee
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const R = {
  orange: '#FC4603', orangeLight: '#FFF0E8',
  green: '#1BA672', greenLight: '#E8F8F1',
  amber: '#F59E0B', amberLight: 'rgba(245,158,11,0.1)',
  purple: '#8B5CF6', purpleLight: 'rgba(139,92,246,0.1)',
  ink: '#1A1F1C', gray: '#6B7570', muted: '#9CA3A0',
  border: '#E5E7EB', bg: '#F8F9FA', white: '#FFFFFF',
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
    mutationFn: (data: { accountNumber: string; ifsc: string; accountName: string }) =>
      api.patch('/riders/bank-account', data),
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['rider-payouts-history'] });
      Alert.alert('Bank Account Saved', 'Earnings will be transferred to your bank every Monday at 10 AM.');
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.error || err.message || 'Could not save bank account'),
  });

  const saveUpiMutation = useMutation({
    mutationFn: (data: { upiId: string }) => api.patch('/riders/upi', data),
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
      saveBankMutation.mutate({ accountNumber: accountNumber.trim(), ifsc: ifsc.trim(), accountName: accountName.trim() });
    } else {
      if (!upiInput.trim()) return Alert.alert('Required', 'Enter your UPI ID');
      saveUpiMutation.mutate({ upiId: upiInput.trim() });
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
          <Text style={styles.headerTitle}>Payouts</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 12 }}>

          {/* Top Quick Stats */}
          <View style={styles.topStatsRow}>
            <View style={styles.miniStatCard}>
              <View style={styles.miniStatIcon}>
                <IndianRupee size={16} color={R.orange} />
              </View>
              <View>
                <Text style={styles.miniStatLbl}>Today's Earnings</Text>
                <Text style={styles.miniStatVal}>₹{(todayPaise / 100).toFixed(0)}</Text>
              </View>
            </View>
            
            <View style={styles.miniStatCard}>
              <View style={[styles.miniStatIcon, { backgroundColor: R.greenLight }]}>
                <CheckCircle size={16} color={R.green} />
              </View>
              <View>
                <Text style={styles.miniStatLbl}>Deliveries</Text>
                <Text style={styles.miniStatVal}>{todayOrders}</Text>
              </View>
            </View>
          </View>

          {/* Pending balance */}
          <View style={[styles.card, { paddingVertical: 24 }]}>
            <Text style={styles.balLabel}>Total Pending Balance</Text>
            <Text style={styles.balAmount}>₹{(pendingPaise / 100).toFixed(0)}</Text>

            <View style={styles.scheduleRow}>
              {autoPayActive ? (
                <View style={styles.statusBadge}>
                  <CheckCircle size={14} color={R.green} />
                  <Text style={[styles.statusText, { color: R.green }]}>AUTO-PAY ACTIVE</Text>
                </View>
              ) : (
                <View style={[styles.statusBadge, { backgroundColor: R.bg }]}>
                  <AlertCircle size={14} color={R.muted} />
                  <Text style={[styles.statusText, { color: R.muted }]}>AUTO-PAY DISABLED</Text>
                </View>
              )}
              <Text style={styles.scheduleText}>
                {autoPayActive ? 'Next payout Monday, 10 AM' : 'Set a payout method below'}
              </Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Payout Method</Text>

          {/* Payout method card */}
          <View style={styles.card}>
            {/* Tab switcher */}
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'bank' && styles.tabActive]}
                onPress={() => { setActiveTab('bank'); setEditing(false); }}
                activeOpacity={0.8}
              >
                <Building2 size={14} color={activeTab === 'bank' ? R.ink : R.muted} />
                <Text style={[styles.tabText, activeTab === 'bank' && styles.tabTextActive]}>Bank Account</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'upi' && styles.tabActive]}
                onPress={() => { setActiveTab('upi'); setEditing(false); }}
                activeOpacity={0.8}
              >
                <Smartphone size={14} color={activeTab === 'upi' ? R.ink : R.muted} />
                <Text style={[styles.tabText, activeTab === 'upi' && styles.tabTextActive]}>UPI</Text>
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: 16 }}>
              {activeTab === 'bank' ? (
                /* Bank tab */
                currentSaved && !editing ? (
                  <>
                    <View style={styles.savedRow}>
                      <View style={[styles.miniStatIcon, { backgroundColor: R.greenLight }]}>
                        <CheckCircle size={16} color={R.green} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.savedName}>{storedName}</Text>
                        <Text style={styles.savedDetail}>{'•'.repeat(8) + (storedBank?.slice(-4) || '')}  •  {storedIfsc}</Text>
                      </View>
                      <TouchableOpacity onPress={startEditing} activeOpacity={0.7} style={styles.editBtn}>
                        <Pencil size={14} color={R.ink} />
                      </TouchableOpacity>
                    </View>
                    {payoutMethod !== 'bank' && (
                      <TouchableOpacity
                        onPress={() => saveBankMutation.mutate({ accountNumber: storedBank!, ifsc: storedIfsc!, accountName: storedName! })}
                        style={[styles.saveBtn, { backgroundColor: R.ink, marginTop: 12, opacity: isSaving ? 0.6 : 1 }]}
                        disabled={isSaving}
                        activeOpacity={0.88}
                      >
                        {isSaving ? <ActivityIndicator size="small" color={R.white} /> : <Text style={styles.saveBtnText}>Set as Active Method</Text>}
                      </TouchableOpacity>
                    )}
                  </>
                ) : (
                  <>
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
                          style={[styles.saveBtn, { flex: 1, backgroundColor: R.bg }]}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.saveBtnText, { color: R.ink }]}>Cancel</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        onPress={handleSave}
                        style={[styles.saveBtn, { flex: 2, backgroundColor: R.ink, opacity: isSaving ? 0.6 : 1 }]}
                        disabled={isSaving}
                        activeOpacity={0.88}
                      >
                        {isSaving
                          ? <ActivityIndicator size="small" color={R.white} />
                          : <Text style={styles.saveBtnText}>Save Details</Text>
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
                      <View style={[styles.miniStatIcon, { backgroundColor: R.greenLight }]}>
                        <CheckCircle size={16} color={R.green} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.savedName, { fontFamily: 'monospace', letterSpacing: -0.5 }]}>{storedUpi}</Text>
                        <Text style={styles.savedDetail}>Verified UPI ID</Text>
                      </View>
                      <TouchableOpacity onPress={startEditing} activeOpacity={0.7} style={styles.editBtn}>
                        <Pencil size={14} color={R.ink} />
                      </TouchableOpacity>
                    </View>
                    {payoutMethod !== 'upi' && (
                      <TouchableOpacity
                        onPress={() => saveUpiMutation.mutate({ upiId: storedUpi! })}
                        style={[styles.saveBtn, { backgroundColor: R.ink, marginTop: 12, opacity: isSaving ? 0.6 : 1 }]}
                        disabled={isSaving}
                        activeOpacity={0.88}
                      >
                        {isSaving ? <ActivityIndicator size="small" color={R.white} /> : <Text style={styles.saveBtnText}>Set as Active Method</Text>}
                      </TouchableOpacity>
                    )}
                  </>
                ) : (
                  <>
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
                          style={[styles.saveBtn, { flex: 1, backgroundColor: R.bg }]}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.saveBtnText, { color: R.ink }]}>Cancel</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        onPress={handleSave}
                        style={[styles.saveBtn, { flex: 2, backgroundColor: R.ink, opacity: isSaving ? 0.6 : 1 }]}
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
          <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Payout History</Text>

          {(!data?.payouts || data.payouts.length === 0) ? (
            <View style={styles.emptyCard}>
              <Banknote size={32} color={R.border} />
              <Text style={styles.emptyText}>No payouts yet</Text>
              <Text style={styles.emptyHint}>First payout runs Monday 10 AM</Text>
            </View>
          ) : (
            <View style={styles.historyList}>
              {data.payouts.map((p: any) => {
                const isPaid = p.status === 'paid';
                const isAuto = p.payout_mode === 'auto';
                const method = p.payout_method || 'upi';
                return (
                  <View key={p.id} style={styles.payoutRow}>
                    <View style={[styles.payoutIcon, { backgroundColor: isPaid ? R.greenLight : R.orangeLight }]}>
                      <Shield size={16} color={isPaid ? R.green : R.orange} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.payoutDate}>
                        {new Date(p.week_start || p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                        <View style={[styles.badge, isPaid ? styles.badgePaid : styles.badgePending]}>
                          <Text style={[styles.badgeText, { color: isPaid ? R.green : R.orange }]}>
                            {p.status.toUpperCase()}
                          </Text>
                        </View>
                        {isAuto && (
                          <View style={[styles.badge, { backgroundColor: R.bg }]}>
                            <Text style={styles.badgeTextMuted}>AUTO</Text>
                          </View>
                        )}
                        <View style={[styles.badge, { backgroundColor: R.bg }]}>
                          <Text style={styles.badgeTextMuted}>
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
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16,
    backgroundColor: R.white,
    borderBottomWidth: 1, borderBottomColor: R.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: R.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: R.ink, fontSize: 18, fontWeight: '800' },

  topStatsRow: { flexDirection: 'row', gap: 12 },
  miniStatCard: {
    flex: 1, backgroundColor: R.white, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: R.border, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  miniStatIcon: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: R.orangeLight,
    alignItems: 'center', justifyContent: 'center'
  },
  miniStatLbl: { color: R.gray, fontSize: 11, fontWeight: '600', marginBottom: 2 },
  miniStatVal: { color: R.ink, fontSize: 18, fontWeight: '800' },

  card: {
    backgroundColor: R.white, borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: R.border,
    shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 6, elevation: 1,
  },
  
  balLabel: { color: R.gray, fontSize: 13, fontWeight: '600' },
  balAmount: { color: R.ink, fontSize: 44, fontWeight: '900', letterSpacing: -1.5, marginTop: 4, marginBottom: 20 },
  scheduleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingTop: 16, borderTopWidth: 1, borderTopColor: R.border,
  },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: R.greenLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  statusText: { fontSize: 10, fontWeight: '800' },
  scheduleText: { color: R.ink, fontSize: 12, fontWeight: '600', flex: 1 },

  sectionTitle: { color: R.ink, fontSize: 16, fontWeight: '800', marginLeft: 4, marginTop: 4 },

  tabRow: {
    flexDirection: 'row', gap: 8,
    backgroundColor: R.bg, borderRadius: 12, padding: 4,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 10,
  },
  tabActive: { backgroundColor: R.white, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  tabText: { fontSize: 13, fontWeight: '600', color: R.muted },
  tabTextActive: { color: R.ink, fontWeight: '700' },

  savedRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: R.bg, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: R.border,
  },
  savedName: { color: R.ink, fontWeight: '700', fontSize: 15, marginBottom: 2 },
  savedDetail: { color: R.gray, fontSize: 12, fontWeight: '500' },
  editBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: R.white,
    borderWidth: 1, borderColor: R.border,
    alignItems: 'center', justifyContent: 'center',
  },

  input: {
    backgroundColor: R.bg, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    color: R.ink, fontSize: 15, fontWeight: '600',
    borderWidth: 1, borderColor: R.border, marginBottom: 12,
  },
  saveBtn: {
    borderRadius: 12, paddingVertical: 15, alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { color: R.white, fontWeight: '700', fontSize: 14 },

  historyList: { gap: 10 },
  payoutRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: R.white, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: R.border,
  },
  payoutIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  payoutDate: { color: R.ink, fontWeight: '800', fontSize: 15 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  badgePaid: { backgroundColor: R.greenLight },
  badgePending: { backgroundColor: R.orangeLight },
  badgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  badgeTextMuted: { fontSize: 9, fontWeight: '700', color: R.gray, letterSpacing: 0.5 },
  utrText: { color: R.muted, fontSize: 10, fontWeight: '600', fontFamily: 'monospace', alignSelf: 'center' },
  payoutAmt: { color: R.ink, fontWeight: '900', fontSize: 18, letterSpacing: -0.5 },

  emptyCard: {
    backgroundColor: R.bg, borderRadius: 20, paddingVertical: 48,
    alignItems: 'center', gap: 8, borderWidth: 1, borderColor: R.border,
  },
  emptyText: { color: R.ink, fontWeight: '700', fontSize: 15 },
  emptyHint: { color: R.gray, fontSize: 12 },
});

export default PayoutsScreen;
