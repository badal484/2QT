import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Check } from 'lucide-react-native';
import { api } from '../api/client';

const G = {
  bg: '#070707',
  card: '#111111',
  border: 'rgba(255,255,255,0.07)',
  faint: 'rgba(255,255,255,0.05)',
  green: '#00D084',
  greenBg: 'rgba(0,208,132,0.1)',
  greenBorder: 'rgba(0,208,132,0.2)',
  white: '#FFFFFF',
  dim: 'rgba(255,255,255,0.55)',
  muted: 'rgba(255,255,255,0.2)',
};

const CHECKLIST = [
  { id: 'cleaning', label: 'Kitchen cleaning completed' },
  { id: 'gas', label: 'Gas & equipment turned off' },
  { id: 'fridge', label: 'Refrigerator temperatures checked' },
  { id: 'waste', label: 'Waste disposed properly' },
];

const ShiftHandoverScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const [notes, setNotes] = useState('');
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => setChecked(prev => ({ ...prev, [id]: !prev[id] }));

  const allChecked = CHECKLIST.every(c => checked[c.id]);

  const mutation = useMutation({
    mutationFn: () => api.post('/kitchen/shift-handover', {
      notes,
      cleaningStatus: checked.cleaning || false,
      gasStatus: checked.gas || false,
    }),
    onSuccess: () => {
      Alert.alert('Shift Ended', 'Handover notes submitted.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    },
    onError: () => Alert.alert('Error', 'Could not submit handover. Try again.'),
  });

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color={G.dim} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerSub}>END OF SHIFT</Text>
          <Text style={styles.headerTitle}>Handover</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Checklist */}
        <Text style={styles.sectionLabel}>CHECKLIST</Text>
        <View style={styles.card}>
          {CHECKLIST.map((item, i) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.checkRow, i < CHECKLIST.length - 1 && styles.checkRowBorder]}
              onPress={() => toggle(item.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, checked[item.id] && styles.checkboxOn]}>
                {checked[item.id] && <Check size={14} color="#000" strokeWidth={3} />}
              </View>
              <Text style={[styles.checkLabel, checked[item.id] && styles.checkLabelOn]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Progress */}
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(Object.values(checked).filter(Boolean).length / CHECKLIST.length) * 100}%` as any }]} />
          </View>
          <Text style={styles.progressText}>
            {Object.values(checked).filter(Boolean).length}/{CHECKLIST.length}
          </Text>
        </View>

        {/* Notes */}
        <Text style={[styles.sectionLabel, { marginTop: 28 }]}>HANDOVER NOTES</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="Any instructions for the next shift? Remaining prep, issues, special notes..."
          placeholderTextColor={G.muted}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          value={notes}
          onChangeText={setNotes}
          selectionColor={G.green}
        />

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, !allChecked && styles.submitBtnDim]}
          onPress={() => mutation.mutate()}
          disabled={mutation.isPending}
          activeOpacity={0.8}
        >
          {mutation.isPending ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.submitBtnText}>
              {allChecked ? 'SUBMIT & END SHIFT' : `COMPLETE ALL ${CHECKLIST.length} CHECKS TO SUBMIT`}
            </Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: G.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20,
    borderBottomWidth: 1, borderBottomColor: G.faint,
  },
  backBtn: {
    width: 44, height: 44, backgroundColor: G.faint, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: G.border,
  },
  headerSub: { color: G.muted, fontSize: 9, fontWeight: '900', letterSpacing: 4, marginBottom: 2 },
  headerTitle: { color: G.white, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },

  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingTop: 24 },

  sectionLabel: { color: G.muted, fontSize: 9, fontWeight: '900', letterSpacing: 4, marginBottom: 14 },

  card: {
    backgroundColor: G.card, borderRadius: 20,
    borderWidth: 1, borderColor: G.border, overflow: 'hidden',
  },
  checkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingHorizontal: 20, paddingVertical: 18,
  },
  checkRowBorder: { borderBottomWidth: 1, borderBottomColor: G.faint },
  checkbox: {
    width: 28, height: 28, borderRadius: 9, borderWidth: 1.5,
    borderColor: G.border, alignItems: 'center', justifyContent: 'center',
    backgroundColor: G.faint,
  },
  checkboxOn: { backgroundColor: G.green, borderColor: G.green },
  checkLabel: { color: G.dim, fontSize: 15, fontWeight: '600', flex: 1 },
  checkLabelOn: { color: G.white },

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  progressTrack: { flex: 1, height: 3, backgroundColor: G.faint, borderRadius: 2 },
  progressFill: { height: 3, backgroundColor: G.green, borderRadius: 2 },
  progressText: { color: G.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1 },

  notesInput: {
    backgroundColor: G.card, borderRadius: 16, borderWidth: 1, borderColor: G.border,
    padding: 18, color: G.white, fontSize: 15, fontWeight: '500',
    lineHeight: 22, minHeight: 130, marginBottom: 24,
  },

  submitBtn: {
    backgroundColor: G.green, borderRadius: 16, height: 60,
    alignItems: 'center', justifyContent: 'center',
  },
  submitBtnDim: { opacity: 0.35 },
  submitBtnText: { color: '#000', fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
});

export default ShiftHandoverScreen;
