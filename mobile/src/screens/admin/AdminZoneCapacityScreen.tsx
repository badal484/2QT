import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  StatusBar, StyleSheet, Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { ArrowLeft, Package, Users, ChevronDown, ChevronUp, Info } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFeedback } from '../../context/FeedbackContext';
import { tokens } from '../../theme/tokens';

const R = {
  orange: '#FC4603', orangeLight: '#FFF0E8',
  green: '#1BA672', greenLight: '#E8F8F1',
  amber: '#F59E0B', amberLight: '#FFFBEB',
  ink: '#111827', gray: '#6B7280', muted: '#9CA3AF',
  border: tokens.colors.border, bg: tokens.colors.background, white: tokens.colors.surface,
};

const CAP_OPTIONS = [
  {
    value: 1,
    label: '1 Order',
    sublabel: 'Phase 1 — Recommended',
    desc: 'Rider takes one order at a time. Food arrives hot, no routing confusion.',
    color: R.green,
    bg: R.greenLight,
  },
  {
    value: 2,
    label: '2 Orders (Smart Stack)',
    sublabel: 'Phase 2 — Same kitchen only',
    desc: 'System offers a 2nd order only if it\'s from the same kitchen and rider hasn\'t left yet.',
    color: R.amber,
    bg: R.amberLight,
  },
];

const ZoneCard = ({ zone, onSave }: { zone: any; onSave: (id: string, cap: number) => void }) => {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<number>(zone.max_concurrent_orders ?? 1);
  const [saving, setSaving] = useState(false);
  const changed = selected !== (zone.max_concurrent_orders ?? 1);

  const handleSave = async () => {
    setSaving(true);
    await onSave(zone.id, selected);
    setSaving(false);
  };

  const currentOpt = CAP_OPTIONS.find(o => o.value === (zone.max_concurrent_orders ?? 1));

  return (
    <View style={zc.card}>
      {/* Header row */}
      <TouchableOpacity style={zc.header} onPress={() => setExpanded(e => !e)} activeOpacity={0.8}>
        <View style={[zc.zoneDot, { backgroundColor: zone.is_active ? R.green : R.muted }]} />
        <View style={{ flex: 1 }}>
          <Text style={zc.zoneName}>{zone.name}</Text>
          <View style={zc.currentRow}>
            <View style={[zc.currentBadge, { backgroundColor: currentOpt?.bg }]}>
              <Text style={[zc.currentBadgeText, { color: currentOpt?.color }]}>
                {currentOpt?.label}
              </Text>
            </View>
          </View>
        </View>
        {expanded ? <ChevronUp size={18} color={R.muted} /> : <ChevronDown size={18} color={R.muted} />}
      </TouchableOpacity>

      {/* Expanded picker */}
      {expanded && (
        <View style={zc.picker}>
          {CAP_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[zc.optRow, selected === opt.value && { borderColor: opt.color, backgroundColor: opt.bg + '80' }]}
              onPress={() => setSelected(opt.value)}
              activeOpacity={0.85}
            >
              <View style={[zc.radio, selected === opt.value && { borderColor: opt.color }]}>
                {selected === opt.value && <View style={[zc.radioDot, { backgroundColor: opt.color }]} />}
              </View>
              <View style={{ flex: 1 }}>
                <View style={zc.optLabelRow}>
                  <Text style={zc.optLabel}>{opt.label}</Text>
                  <View style={[zc.optTag, { backgroundColor: opt.bg }]}>
                    <Text style={[zc.optTagText, { color: opt.color }]}>{opt.sublabel}</Text>
                  </View>
                </View>
                <Text style={zc.optDesc}>{opt.desc}</Text>
              </View>
            </TouchableOpacity>
          ))}

          {changed && (
            <TouchableOpacity
              style={[zc.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.88}
            >
              {saving
                ? <ActivityIndicator size="small" color={R.white} />
                : <Text style={zc.saveBtnText}>Save for {zone.name}</Text>
              }
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const zc = StyleSheet.create({
  card:   { backgroundColor: R.white, borderRadius: 18, borderWidth: 1, borderColor: R.border, overflow: 'hidden', marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  zoneDot:{ width: 8, height: 8, borderRadius: 4 },
  zoneName:{ fontSize: 15, fontWeight: '800', color: R.ink },
  currentRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  currentBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  currentBadgeText: { fontSize: 10, fontWeight: '700' },
  picker: { borderTopWidth: 1, borderTopColor: R.border, padding: 14, gap: 10 },
  optRow: {
    flexDirection: 'row', gap: 12, padding: 14, borderRadius: 14,
    borderWidth: 1.5, borderColor: R.border, alignItems: 'flex-start',
  },
  radio:    { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: R.border, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  optLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  optLabel: { fontSize: 14, fontWeight: '800', color: R.ink },
  optTag:   { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  optTagText:{ fontSize: 9, fontWeight: '800' },
  optDesc:  { fontSize: 12, color: R.gray, lineHeight: 17 },
  saveBtn:  { backgroundColor: R.orange, borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginTop: 6 },
  saveBtnText: { color: R.white, fontWeight: '900', fontSize: 14 },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
const AdminZoneCapacityScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { showDialog } = useFeedback();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-zones'],
    queryFn: () => api.get('/admin/zones'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, cap }: { id: string; cap: number }) =>
      api.patch(`/admin/zones/${id}`, { max_concurrent_orders: cap }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-zones'] });
    },
    onError: (e: any) => showDialog({ title: 'Error', message: e.response?.data?.error || e.message, confirmText: 'Okay', type: 'error' }),
  });

  const handleSave = async (id: string, cap: number) => {
    await updateMutation.mutateAsync({ id, cap });
  };

  const zones = data?.zones || [];

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={R.white} />

      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <ArrowLeft size={20} color={R.ink} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Order Capacity</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={s.loader}><ActivityIndicator size="large" color={R.orange} /></View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {/* Info card */}
          <View style={s.infoCard}>
            <Info size={16} color={R.orange} />
            <View style={{ flex: 1 }}>
              <Text style={s.infoTitle}>Phase 1 → Phase 2 in one tap</Text>
              <Text style={s.infoText}>
                Set each zone independently. Phase 1 (1 order) is always safe.
                Phase 2 (2 orders) only stacks when the 2nd order is from the
                exact same kitchen and the rider hasn't left for delivery yet.
              </Text>
            </View>
          </View>

          {/* Summary strip */}
          <View style={s.summaryRow}>
            <View style={s.summaryBox}>
              <Package size={14} color={R.green} />
              <Text style={s.summaryVal}>{zones.filter((z: any) => (z.max_concurrent_orders ?? 1) === 1).length}</Text>
              <Text style={s.summaryLbl}>Phase 1 zones</Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryBox}>
              <Users size={14} color={R.amber} />
              <Text style={s.summaryVal}>{zones.filter((z: any) => (z.max_concurrent_orders ?? 1) === 2).length}</Text>
              <Text style={s.summaryLbl}>Phase 2 zones</Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryBox}>
              <Text style={s.summaryVal}>{zones.length}</Text>
              <Text style={s.summaryLbl}>Total zones</Text>
            </View>
          </View>

          {/* Zone cards */}
          {zones.map((zone: any) => (
            <ZoneCard key={zone.id} zone={zone} onSave={handleSave} />
          ))}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: R.bg },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: R.white, borderBottomWidth: 1, borderBottomColor: R.border,
  },
  backBtn:     { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: R.bg },
  headerTitle: { fontSize: 17, fontWeight: '900', color: R.ink },
  scroll:      { padding: 16 },
  infoCard:    { flexDirection: 'row', gap: 12, backgroundColor: R.orangeLight, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#FFD5B8', marginBottom: 14 },
  infoTitle:   { fontSize: 13, fontWeight: '800', color: R.orange, marginBottom: 4 },
  infoText:    { fontSize: 12, color: R.gray, lineHeight: 18 },
  summaryRow:  { flexDirection: 'row', backgroundColor: R.white, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: R.border },
  summaryBox:  { flex: 1, alignItems: 'center', gap: 4 },
  summaryDivider: { width: 1, backgroundColor: R.border },
  summaryVal:  { fontSize: 18, fontWeight: '900', color: R.ink },
  summaryLbl:  { fontSize: 10, color: R.muted, fontWeight: '600' },
});

export default AdminZoneCapacityScreen;
