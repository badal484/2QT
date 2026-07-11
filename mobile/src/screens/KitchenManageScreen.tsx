import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Alert, StyleSheet, Switch
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Power, Package, Timer, RefreshCw } from 'lucide-react-native';

const G = {
  bg: '#070707', card: '#111111', border: 'rgba(255,255,255,0.07)', faint: 'rgba(255,255,255,0.05)',
  green: '#00D084', greenBg: 'rgba(0,208,132,0.08)',
  red: '#EF4444', redBg: 'rgba(239,68,68,0.08)',
  orange: '#FC4603', orangeBg: 'rgba(252,128,25,0.08)',
  white: '#FFFFFF', dim: 'rgba(255,255,255,0.55)', muted: 'rgba(255,255,255,0.2)',
};

const KitchenManageScreen = () => {
  const queryClient = useQueryClient();
  const [selectedDuration, setSelectedDuration] = useState<number | null>(30);
  const [pauseReason, setPauseReason] = useState('');
  const [countdownStr, setCountdownStr] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['kitchen-manage'],
    queryFn: () => api.get('/kitchen/menu'),
  });

  const menuItems = data?.menu || [];
  const kitchenPaused = data?.kitchenPaused || false;
  const pauseUntil = data?.pauseUntil || null;
  const currentReason = data?.pauseReason || '';

  useEffect(() => {
    if (!kitchenPaused || !pauseUntil) return;
    const updateCountdown = () => {
      const secs = Math.max(0, Math.floor((new Date(pauseUntil).getTime() - Date.now()) / 1000));
      if (secs === 0) setCountdownStr('');
      else setCountdownStr(`${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, '0')}`);
    };
    updateCountdown();
    const id = setInterval(updateCountdown, 1000);
    return () => clearInterval(id);
  }, [kitchenPaused, pauseUntil]);

  const statusMutation = useMutation({
    mutationFn: (payload: any) => api.patch('/kitchen/status', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kitchen-manage'] });
      if (!kitchenPaused) {
        Alert.alert('Kitchen Paused', 'New orders will not be accepted.');
      } else {
        Alert.alert('Kitchen Opened', 'You are now accepting orders!');
        setPauseReason('');
      }
    },
    onError: () => Alert.alert('Error', 'Could not update kitchen status.'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, available }: { id: string; available: boolean }) =>
      api.patch(`/kitchen/menu/${id}/availability`, { available }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kitchen-manage'] });
    },
  });

  const handlePauseToggle = () => {
    if (kitchenPaused) {
      statusMutation.mutate({ paused: false });
    } else {
      statusMutation.mutate({
        paused: true,
        reason: pauseReason || null,
        duration_minutes: selectedDuration,
      });
    }
  };

  const groupedMenu = menuItems.reduce((acc: any, item: any) => {
    const cat = item.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSub}>MANAGEMENT</Text>
            <Text style={styles.headerTitle}>Operations</Text>
          </View>
          <TouchableOpacity onPress={() => refetch()} style={styles.refreshBtn}>
            <RefreshCw size={20} color={G.white} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={G.white} size="large" />
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* ── KITCHEN STATUS ── */}
          <View style={[styles.card, kitchenPaused && styles.cardPaused]}>
            <View style={styles.cardHeader}>
              <Power size={20} color={kitchenPaused ? G.red : G.green} />
              <Text style={styles.cardTitle}>Kitchen Status</Text>
              <View style={[styles.badge, { backgroundColor: kitchenPaused ? G.redBg : G.greenBg }]}>
                <Text style={[styles.badgeText, { color: kitchenPaused ? G.red : G.green }]}>
                  {kitchenPaused ? 'PAUSED' : 'OPEN'}
                </Text>
              </View>
            </View>

            {kitchenPaused ? (
              <View style={styles.pausedContent}>
                {!!currentReason && <Text style={styles.reasonText}>"{currentReason}"</Text>}
                {countdownStr ? (
                  <View style={styles.timerRow}>
                    <Timer size={16} color={G.orange} />
                    <Text style={styles.timerText}>{countdownStr} until auto-resume</Text>
                  </View>
                ) : (
                  <Text style={styles.indefiniteText}>Paused indefinitely.</Text>
                )}
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: G.green, marginTop: 16 }]}
                  onPress={handlePauseToggle}
                  disabled={statusMutation.isPending}
                >
                  {statusMutation.isPending ? <ActivityIndicator color="#000" /> : <Text style={styles.btnTextBlack}>OPEN KITCHEN</Text>}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.openContent}>
                <Text style={styles.label}>PAUSE DURATION</Text>
                <View style={styles.durationRow}>
                  {[15, 30, 60, null].map(d => {
                    const isSel = selectedDuration === d;
                    return (
                      <TouchableOpacity
                        key={String(d)}
                        style={[styles.durationBtn, isSel && styles.durationBtnActive]}
                        onPress={() => setSelectedDuration(d)}
                      >
                        <Text style={[styles.durationText, isSel && styles.durationTextActive]}>
                          {d ? `${d}m` : '∞'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TextInput
                  style={styles.input}
                  placeholder="Reason (optional)..."
                  placeholderTextColor={G.muted}
                  value={pauseReason}
                  onChangeText={setPauseReason}
                />

                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: G.red, marginTop: 12 }]}
                  onPress={handlePauseToggle}
                  disabled={statusMutation.isPending}
                >
                  {statusMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTextWhite}>PAUSE NOW</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* ── MENU AVAILABILITY ── */}
          <View style={styles.menuSection}>
            <View style={styles.sectionHead}>
              <Package size={18} color={G.white} />
              <Text style={styles.sectionTitle}>Menu Availability</Text>
            </View>

            {Object.keys(groupedMenu).map(cat => (
              <View key={cat} style={styles.categoryBlock}>
                <Text style={styles.catLabel}>{cat}</Text>
                {groupedMenu[cat].map((item: any) => (
                  <View key={item.id} style={[styles.menuItem, !item.available && styles.menuItemOff]}>
                    <View style={styles.menuItemLeft}>
                      <View style={[styles.vegIndicator, { borderColor: item.is_veg ? G.green : item.is_egg ? '#FACC15' : G.red }]} />
                      <View>
                        <Text style={[styles.menuItemName, !item.available && styles.dimText]}>{item.name}</Text>
                        <Text style={styles.menuItemSub}>₹{(item.price_paise / 100).toFixed(0)}</Text>
                      </View>
                    </View>
                    <Switch
                      value={item.available}
                      onValueChange={(val) => toggleMutation.mutate({ id: item.id, available: val })}
                      trackColor={{ false: G.faint, true: G.green }}
                      thumbColor={G.white}
                      disabled={toggleMutation.isPending && toggleMutation.variables?.id === item.id}
                    />
                  </View>
                ))}
              </View>
            ))}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: G.bg },
  safeTop: { backgroundColor: G.bg },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    paddingHorizontal: 24, paddingTop: 16, paddingBottom: 20,
    borderBottomWidth: 1, borderBottomColor: G.faint,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'
  },
  headerSub: { color: G.muted, fontSize: 10, fontWeight: '900', letterSpacing: 4, marginBottom: 4 },
  headerTitle: { color: G.white, fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  refreshBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: G.faint, alignItems: 'center', justifyContent: 'center' },

  scroll: { flex: 1 },
  scrollContent: { padding: 20 },

  card: {
    backgroundColor: G.card, borderRadius: 24, padding: 20,
    borderWidth: 1, borderColor: G.border, marginBottom: 24,
  },
  cardPaused: { borderColor: G.red, backgroundColor: '#140a0a' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  cardTitle: { color: G.white, fontSize: 18, fontWeight: '900', flex: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },

  pausedContent: { paddingTop: 8 },
  reasonText: { color: G.dim, fontStyle: 'italic', marginBottom: 12 },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timerText: { color: G.orange, fontWeight: '800', fontSize: 14 },
  indefiniteText: { color: G.dim, fontSize: 13 },

  openContent: { paddingTop: 8 },
  label: { color: G.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 8 },
  durationRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  durationBtn: {
    flex: 1, height: 40, borderRadius: 12, backgroundColor: G.faint,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent'
  },
  durationBtnActive: { backgroundColor: 'rgba(239,68,68,0.15)', borderColor: G.red },
  durationText: { color: G.dim, fontSize: 14, fontWeight: '700' },
  durationTextActive: { color: G.red },

  input: {
    height: 48, backgroundColor: G.faint, borderRadius: 12,
    paddingHorizontal: 16, color: G.white, marginBottom: 8,
  },

  btn: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnTextBlack: { color: '#000', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  btnTextWhite: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 1 },

  menuSection: { backgroundColor: G.card, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: G.border },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  sectionTitle: { color: G.white, fontSize: 18, fontWeight: '900' },

  categoryBlock: { marginBottom: 20 },
  catLabel: { color: G.muted, fontSize: 11, fontWeight: '900', letterSpacing: 2, marginBottom: 12, marginLeft: 4 },
  
  menuItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 12,
    backgroundColor: G.faint, borderRadius: 16, marginBottom: 8,
  },
  menuItemOff: { opacity: 0.6 },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  vegIndicator: { width: 12, height: 12, borderRadius: 4, borderWidth: 2 },
  menuItemName: { color: G.white, fontSize: 15, fontWeight: '700', marginBottom: 2 },
  menuItemSub: { color: G.dim, fontSize: 12, fontWeight: '600' },
  dimText: { color: G.dim },
});

export default KitchenManageScreen;
