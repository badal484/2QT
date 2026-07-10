import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  StatusBar, StyleSheet, TextInput, Alert, Switch, Modal,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import {
  ArrowLeft, Plus, Pencil, Trash2, ToggleLeft, ToggleRight,
  Zap, Target, TrendingUp, Trophy, Star, Flame, ChevronRight,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const R = {
  orange: '#FC4603', orangeLight: '#FFF0E8',
  green: '#1BA672', greenLight: '#E8F8F1',
  amber: '#F59E0B', amberLight: '#FFFBEB',
  red: '#EF4444', redLight: '#FEF2F2',
  ink: '#111827', gray: '#6B7280', muted: '#9CA3AF',
  border: '#E5E7EB', bg: '#F9FAFB', white: '#FFFFFF',
};

const ICONS_LIST = ['zap', 'target', 'trending-up', 'trophy', 'star', 'flame'] as const;
const ICON_COMPS: Record<string, any> = { zap: Zap, target: Target, 'trending-up': TrendingUp, trophy: Trophy, star: Star, flame: Flame };
const COLORS_LIST = ['#FC4603', '#1BA672', '#F59E0B', '#7C3AED', '#3B82F6', '#EC4899'];
const TYPES = [
  { value: 'delivery_count',  label: 'Delivery Count' },
  { value: 'earnings_amount', label: 'Earnings Amount' },
  { value: 'zone_deliveries', label: 'Zone Deliveries' },
];

// ─── Tier editor row ──────────────────────────────────────────────────────────
const TierRow = ({ tier, index, onChange, onRemove, isEarnings }: {
  tier: { target: number; reward_paise: number; label: string };
  index: number; onChange: (t: any) => void; onRemove: () => void;
  isEarnings: boolean;
}) => (
  <View style={t.row}>
    <Text style={t.num}>{index + 1}</Text>
    <TextInput
      style={[t.input, { flex: 1.5 }]}
      placeholder={isEarnings ? 'Target ₹' : 'Target trips'}
      placeholderTextColor={R.muted}
      keyboardType="numeric"
      value={tier.target > 0 ? String(isEarnings ? tier.target / 100 : tier.target) : ''}
      onChangeText={v => onChange({ ...tier, target: isEarnings ? Math.round(parseFloat(v || '0') * 100) : parseInt(v || '0') })}
    />
    <TextInput
      style={[t.input, { flex: 1 }]}
      placeholder="₹ Bonus"
      placeholderTextColor={R.muted}
      keyboardType="numeric"
      value={tier.reward_paise > 0 ? String(tier.reward_paise / 100) : ''}
      onChangeText={v => onChange({ ...tier, reward_paise: Math.round(parseFloat(v || '0') * 100) })}
    />
    <TextInput
      style={[t.input, { flex: 1.5 }]}
      placeholder="Label"
      placeholderTextColor={R.muted}
      value={tier.label}
      onChangeText={v => onChange({ ...tier, label: v })}
    />
    <TouchableOpacity onPress={onRemove} activeOpacity={0.7} style={t.del}>
      <Trash2 size={14} color={R.red} />
    </TouchableOpacity>
  </View>
);

const t = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 8 },
  num: { width: 18, fontSize: 11, fontWeight: '800', color: R.muted, textAlign: 'center' },
  input: {
    backgroundColor: R.bg, borderWidth: 1, borderColor: R.border, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 9, fontSize: 13, color: R.ink,
  },
  del: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
});

// ─── Template form modal ──────────────────────────────────────────────────────
type Tier = { target: number; reward_paise: number; label: string };
type FormState = {
  title: string; description: string; icon: string; color: string;
  type: string; tiers: Tier[]; windowType: string;
};
const EMPTY_FORM: FormState = {
  title: '', description: '', icon: 'zap', color: '#FC4603',
  type: 'delivery_count', tiers: [{ target: 0, reward_paise: 0, label: '' }],
  windowType: 'daily',
};

const TemplateModal = ({ visible, initial, onClose, onSave, isSaving }: {
  visible: boolean; initial: FormState | null; onClose: () => void;
  onSave: (f: FormState) => void; isSaving: boolean;
}) => {
  const [form, setForm] = useState<FormState>(initial || EMPTY_FORM);

  React.useEffect(() => { if (visible) setForm(initial || EMPTY_FORM); }, [visible, initial]);

  const set = (key: keyof FormState, val: any) => setForm(f => ({ ...f, [key]: val }));
  const isEarnings = form.type === 'earnings_amount';

  const updateTier = (i: number, tier: Tier) => {
    const next = [...form.tiers]; next[i] = tier; set('tiers', next);
  };
  const removeTier = (i: number) => {
    if (form.tiers.length === 1) return;
    set('tiers', form.tiers.filter((_, idx) => idx !== i));
  };
  const addTier = () => set('tiers', [...form.tiers, { target: 0, reward_paise: 0, label: '' }]);

  const submit = () => {
    if (!form.title.trim()) return Alert.alert('Required', 'Enter a mission title');
    if (form.tiers.some(t => t.target <= 0 || t.reward_paise <= 0 || !t.label.trim()))
      return Alert.alert('Required', 'Fill all tier fields');
    onSave(form);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={fm.root}>
        <View style={fm.header}>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7}><Text style={fm.cancel}>Cancel</Text></TouchableOpacity>
          <Text style={fm.title}>{initial?.title ? 'Edit Mission' : 'New Mission'}</Text>
          <TouchableOpacity onPress={submit} disabled={isSaving} activeOpacity={0.8}>
            {isSaving ? <ActivityIndicator size="small" color={R.orange} /> : <Text style={fm.save}>Save</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={fm.scroll} showsVerticalScrollIndicator={false}>

          {/* Title */}
          <Text style={fm.label}>Title</Text>
          <TextInput style={fm.input} placeholder="Mission title" placeholderTextColor={R.muted} value={form.title} onChangeText={v => set('title', v)} />

          {/* Description */}
          <Text style={fm.label}>Description</Text>
          <TextInput style={fm.input} placeholder="Short description" placeholderTextColor={R.muted} value={form.description} onChangeText={v => set('description', v)} />

          {/* Type */}
          <Text style={fm.label}>Type</Text>
          <View style={fm.chipRow}>
            {TYPES.map(tp => (
              <TouchableOpacity key={tp.value} style={[fm.chip, form.type === tp.value && fm.chipActive]} onPress={() => set('type', tp.value)} activeOpacity={0.8}>
                <Text style={[fm.chipText, form.type === tp.value && fm.chipTextActive]}>{tp.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Window */}
          <Text style={fm.label}>Window</Text>
          <View style={fm.chipRow}>
            {(['daily', 'weekly'] as const).map(w => (
              <TouchableOpacity key={w} style={[fm.chip, form.windowType === w && fm.chipActive]} onPress={() => set('windowType', w)} activeOpacity={0.8}>
                <Text style={[fm.chipText, form.windowType === w && fm.chipTextActive]}>{w === 'daily' ? 'Daily' : 'Weekly'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Icon */}
          <Text style={fm.label}>Icon</Text>
          <View style={fm.chipRow}>
            {ICONS_LIST.map(ic => {
              const Ic = ICON_COMPS[ic];
              return (
                <TouchableOpacity key={ic} style={[fm.iconChip, form.icon === ic && { borderColor: form.color, backgroundColor: form.color + '18' }]} onPress={() => set('icon', ic)} activeOpacity={0.8}>
                  <Ic size={18} color={form.icon === ic ? form.color : R.muted} />
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Color */}
          <Text style={fm.label}>Color</Text>
          <View style={fm.chipRow}>
            {COLORS_LIST.map(c => (
              <TouchableOpacity key={c} style={[fm.colorDot, { backgroundColor: c }, form.color === c && fm.colorDotActive]} onPress={() => set('color', c)} activeOpacity={0.8} />
            ))}
          </View>

          {/* Tiers */}
          <View style={fm.tierHeader}>
            <Text style={fm.label}>Tiers</Text>
            <TouchableOpacity onPress={addTier} style={fm.addTierBtn} activeOpacity={0.8}>
              <Plus size={13} color={R.orange} />
              <Text style={fm.addTierText}>Add Tier</Text>
            </TouchableOpacity>
          </View>
          <Text style={fm.tierHint}>{isEarnings ? 'Target in ₹' : 'Target in trip count'} · Bonus in ₹ · Label shown on card</Text>
          {form.tiers.map((tier, i) => (
            <TierRow key={i} tier={tier} index={i} onChange={v => updateTier(i, v)} onRemove={() => removeTier(i)} isEarnings={isEarnings} />
          ))}

        </ScrollView>
      </View>
    </Modal>
  );
};

const fm = StyleSheet.create({
  root: { flex: 1, backgroundColor: R.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: R.border, backgroundColor: R.white },
  cancel: { fontSize: 15, color: R.gray },
  title:  { fontSize: 16, fontWeight: '800', color: R.ink },
  save:   { fontSize: 15, color: R.orange, fontWeight: '800' },
  scroll: { padding: 20, paddingBottom: 60 },
  label:  { fontSize: 11, fontWeight: '800', color: R.muted, letterSpacing: 0.8, marginBottom: 8, marginTop: 16 },
  input:  { backgroundColor: R.white, borderWidth: 1, borderColor: R.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, fontSize: 14, color: R.ink, marginBottom: 4 },
  chipRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:      { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: R.border, backgroundColor: R.white },
  chipActive:{ backgroundColor: R.orange, borderColor: R.orange },
  chipText:  { fontSize: 12, fontWeight: '700', color: R.gray },
  chipTextActive: { color: R.white },
  iconChip:  { width: 44, height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: R.border, alignItems: 'center', justifyContent: 'center', backgroundColor: R.white },
  colorDot:  { width: 32, height: 32, borderRadius: 16 },
  colorDotActive: { borderWidth: 3, borderColor: R.ink },
  tierHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 4 },
  addTierBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: R.orangeLight, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  addTierText:{ fontSize: 12, color: R.orange, fontWeight: '700' },
  tierHint:   { fontSize: 11, color: R.muted, marginBottom: 10 },
});

// ─── Template card ────────────────────────────────────────────────────────────
const TemplateCard = ({ tpl, onEdit, onToggle, onDelete }: {
  tpl: any; onEdit: () => void; onToggle: () => void; onDelete: () => void;
}) => {
  const Ic = ICON_COMPS[tpl.icon] || Zap;
  const tiers = tpl.tiers || [];
  const totalBonus = tiers.reduce((s: number, t: any) => s + t.reward_paise, 0);
  return (
    <View style={[tc.card, !tpl.is_active && tc.inactive]}>
      <View style={tc.top}>
        <View style={[tc.iconCircle, { backgroundColor: tpl.color + '18' }]}>
          <Ic size={18} color={tpl.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={tc.title}>{tpl.title}</Text>
          <Text style={tc.meta}>
            {tpl.window_type === 'daily' ? 'Daily' : 'Weekly'} · {TYPES.find(t => t.value === tpl.type)?.label} · {tiers.length} tiers · +₹{(totalBonus / 100).toFixed(0)} max
          </Text>
        </View>
        <Switch
          value={tpl.is_active}
          onValueChange={onToggle}
          trackColor={{ false: R.border, true: R.orange + '60' }}
          thumbColor={tpl.is_active ? R.orange : R.muted}
        />
      </View>
      <View style={tc.stats}>
        <Text style={tc.statText}>🏃 {tpl.today_riders ?? 0} active today</Text>
        <Text style={tc.statText}>✓ {tpl.today_completed ?? 0} completed</Text>
      </View>
      <View style={tc.actions}>
        <TouchableOpacity style={tc.editBtn} onPress={onEdit} activeOpacity={0.8}>
          <Pencil size={13} color={R.orange} />
          <Text style={tc.editText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={tc.deleteBtn} onPress={onDelete} activeOpacity={0.8}>
          <Trash2 size={13} color={R.red} />
          <Text style={tc.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const tc = StyleSheet.create({
  card:     { backgroundColor: R.white, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: R.border, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  inactive: { opacity: 0.55 },
  top:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconCircle: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  title:    { fontSize: 14, fontWeight: '800', color: R.ink },
  meta:     { fontSize: 11, color: R.muted, marginTop: 2 },
  stats:    { flexDirection: 'row', gap: 16, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: R.border },
  statText: { fontSize: 12, color: R.gray },
  actions:  { flexDirection: 'row', gap: 10, marginTop: 12 },
  editBtn:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: R.orangeLight, paddingVertical: 9, borderRadius: 12 },
  editText: { fontSize: 12, color: R.orange, fontWeight: '700' },
  deleteBtn:{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: R.redLight, paddingVertical: 9, borderRadius: 12 },
  deleteText:{ fontSize: 12, color: R.red, fontWeight: '700' },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
const AdminMissionsScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-mission-templates'],
    queryFn: () => api.get('/missions/templates'),
    refetchInterval: 30_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-mission-templates'] });

  const createMutation = useMutation({
    mutationFn: (f: FormState) => api.post('/missions/templates', {
      title: f.title, description: f.description, icon: f.icon, color: f.color,
      type: f.type, tiers: f.tiers, windowType: f.windowType,
    }),
    onSuccess: () => { setModalVisible(false); invalidate(); },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.error || e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, f }: { id: string; f: FormState }) => api.patch(`/missions/templates/${id}`, {
      title: f.title, description: f.description, icon: f.icon, color: f.color,
      type: f.type, tiers: f.tiers, windowType: f.windowType,
    }),
    onSuccess: () => { setModalVisible(false); invalidate(); },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.error || e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/missions/templates/${id}/toggle`, {}),
    onSuccess: () => invalidate(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/missions/templates/${id}`),
    onSuccess: () => invalidate(),
  });

  const openEdit = (tpl: any) => {
    setEditTarget({
      id: tpl.id,
      form: {
        title: tpl.title, description: tpl.description, icon: tpl.icon,
        color: tpl.color, type: tpl.type, tiers: tpl.tiers, windowType: tpl.window_type,
      },
    });
    setModalVisible(true);
  };

  const confirmDelete = (tpl: any) => {
    Alert.alert('Delete Mission', `Delete "${tpl.title}"? Rider progress for this mission will also be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(tpl.id) },
    ]);
  };

  const handleSave = (f: FormState) => {
    if (editTarget) updateMutation.mutate({ id: editTarget.id, f });
    else createMutation.mutate(f);
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const templates = data?.templates || [];

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={R.white} />

      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <ArrowLeft size={20} color={R.ink} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Mission Builder</Text>
        <TouchableOpacity
          style={s.addBtn}
          onPress={() => { setEditTarget(null); setModalVisible(true); }}
          activeOpacity={0.8}
        >
          <Plus size={18} color={R.white} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={s.loader}><ActivityIndicator size="large" color={R.orange} /></View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <Text style={s.hint}>
            {templates.length} mission{templates.length !== 1 ? 's' : ''} configured · Auto-assigned to all riders every midnight
          </Text>

          {templates.length === 0 ? (
            <TouchableOpacity
              style={s.emptyCard}
              onPress={() => { setEditTarget(null); setModalVisible(true); }}
              activeOpacity={0.85}
            >
              <Plus size={32} color={R.orange} />
              <Text style={s.emptyTitle}>Create your first mission</Text>
              <Text style={s.emptyText}>Tap to set up delivery count, earnings, or zone-based missions with tiered rewards.</Text>
              <View style={s.emptyArrow}><ChevronRight size={16} color={R.orange} /></View>
            </TouchableOpacity>
          ) : (
            <View style={s.list}>
              {templates.map((tpl: any) => (
                <TemplateCard
                  key={tpl.id}
                  tpl={tpl}
                  onEdit={() => openEdit(tpl)}
                  onToggle={() => toggleMutation.mutate(tpl.id)}
                  onDelete={() => confirmDelete(tpl)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}

      <TemplateModal
        visible={modalVisible}
        initial={editTarget?.form ?? null}
        onClose={() => setModalVisible(false)}
        onSave={handleSave}
        isSaving={isSaving}
      />
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
  addBtn:      { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: R.orange },
  scroll:      { padding: 16, paddingBottom: 48 },
  hint:        { fontSize: 12, color: R.muted, marginBottom: 14 },
  list:        { gap: 12 },
  emptyCard:   { backgroundColor: R.white, borderRadius: 20, padding: 32, alignItems: 'center', gap: 10, borderWidth: 1.5, borderStyle: 'dashed', borderColor: R.orange + '60' },
  emptyTitle:  { fontSize: 16, fontWeight: '800', color: R.ink },
  emptyText:   { fontSize: 13, color: R.muted, textAlign: 'center', lineHeight: 20 },
  emptyArrow:  { width: 36, height: 36, borderRadius: 18, backgroundColor: R.orangeLight, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
});

export default AdminMissionsScreen;
