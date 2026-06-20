import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
} from 'react-native';
import { ArrowLeft, Calendar, Clock } from 'lucide-react-native';
import { useDispatch } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { setScheduledAt } from '../store/slices/cartSlice';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const haptic = () => ReactNativeHapticFeedback.trigger('impactLight', { enableVibrateFallback: true });

// Kitchen is open 11 AM – 10 PM; slots every 30 min
const SLOT_HOURS = [11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15, 19, 19.5, 20, 20.5, 21, 21.5];

function formatHour(h: number): string {
  const hr = Math.floor(h);
  const min = h % 1 === 0.5 ? '30' : '00';
  const period = hr < 12 ? 'AM' : 'PM';
  const display = hr > 12 ? hr - 12 : hr === 0 ? 12 : hr;
  return `${display}:${min} ${period}`;
}

function buildDays(): { label: string; shortLabel: string; date: Date }[] {
  const days: { label: string; shortLabel: string; date: Date }[] = [];
  const now = new Date();

  for (let i = 1; i <= 6; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);

    const weekday = d.toLocaleDateString('en-IN', { weekday: 'long' });
    const dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const isNextDay = i === 1;

    days.push({
      label: isNextDay ? 'Tomorrow' : weekday,
      shortLabel: isNextDay ? 'Tmrw' : d.toLocaleDateString('en-IN', { weekday: 'short' }),
      date: d,
    });
  }
  return days;
}

function buildSlots(selectedDate: Date): { label: string; hour: number; available: boolean }[] {
  const now = new Date();
  const isToday = selectedDate.toDateString() === now.toDateString();
  const currentHour = now.getHours() + now.getMinutes() / 60;

  return SLOT_HOURS.map(h => ({
    label: formatHour(h),
    hour: h,
    // For today (shouldn't happen since we start from tomorrow), block past slots
    available: !isToday || h > currentHour + 1,
  }));
}

const ScheduleOrderScreen = ({ navigation }: any) => {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const days = useMemo(() => buildDays(), []);

  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);

  const slots = useMemo(() => buildSlots(days[selectedDayIdx].date), [selectedDayIdx, days]);

  const handleSave = () => {
    if (selectedHour === null) return;
    const date = new Date(days[selectedDayIdx].date);
    const hr = Math.floor(selectedHour);
    const min = selectedHour % 1 === 0.5 ? 30 : 0;
    date.setHours(hr, min, 0, 0);
    dispatch(setScheduledAt(date.toISOString()));
    haptic();
    navigation.goBack();
  };

  const selectedDay = days[selectedDayIdx];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <ArrowLeft size={20} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Schedule Order</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
      >
        {/* Summary card */}
        {selectedHour !== null && (
          <Animated.View entering={FadeInDown.duration(250)} style={styles.summaryCard}>
            <Calendar size={16} color={colors.primary} />
            <Text style={styles.summaryText}>
              {selectedDay.label}, {selectedDay.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              {'  ·  '}
              {formatHour(selectedHour)}
            </Text>
          </Animated.View>
        )}

        {/* Day selector */}
        <Text style={styles.sectionLabel}>Delivery Day</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.daysRow}>
          {days.map((day, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.dayCard, selectedDayIdx === i && styles.dayCardActive]}
              onPress={() => { haptic(); setSelectedDayIdx(i); setSelectedHour(null); }}
              activeOpacity={0.8}
            >
              <Text style={[styles.dayShort, selectedDayIdx === i && styles.dayShortActive]}>
                {day.shortLabel}
              </Text>
              <Text style={[styles.dayDate, selectedDayIdx === i && styles.dayDateActive]}>
                {day.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Lunch slots */}
        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Lunch Slots</Text>
        <View style={styles.slotsGrid}>
          {slots.filter(s => s.hour < 16).map(slot => (
            <TouchableOpacity
              key={slot.hour}
              style={[
                styles.slotChip,
                selectedHour === slot.hour && styles.slotChipActive,
                !slot.available && styles.slotChipDisabled,
              ]}
              onPress={() => {
                if (!slot.available) return;
                haptic();
                setSelectedHour(slot.hour);
              }}
              activeOpacity={slot.available ? 0.8 : 1}
            >
              <Clock size={11} color={
                !slot.available ? colors.inkFaint :
                selectedHour === slot.hour ? colors.white : colors.inkMuted
              } />
              <Text style={[
                styles.slotText,
                selectedHour === slot.hour && styles.slotTextActive,
                !slot.available && styles.slotTextDisabled,
              ]}>
                {slot.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Dinner slots */}
        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Dinner Slots</Text>
        <View style={styles.slotsGrid}>
          {slots.filter(s => s.hour >= 16).map(slot => (
            <TouchableOpacity
              key={slot.hour}
              style={[
                styles.slotChip,
                selectedHour === slot.hour && styles.slotChipActive,
                !slot.available && styles.slotChipDisabled,
              ]}
              onPress={() => {
                if (!slot.available) return;
                haptic();
                setSelectedHour(slot.hour);
              }}
              activeOpacity={slot.available ? 0.8 : 1}
            >
              <Clock size={11} color={
                !slot.available ? colors.inkFaint :
                selectedHour === slot.hour ? colors.white : colors.inkMuted
              } />
              <Text style={[
                styles.slotText,
                selectedHour === slot.hour && styles.slotTextActive,
                !slot.available && styles.slotTextDisabled,
              ]}>
                {slot.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.notice}>
          Kitchen hours: 11:00 AM – 10:00 PM. Orders are prepared fresh and dispatched at the selected slot.
        </Text>
      </ScrollView>

      {/* Save button */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) + 4 }]}>
        <TouchableOpacity
          style={[styles.saveBtn, selectedHour === null && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={selectedHour === null}
          activeOpacity={0.9}
        >
          <Calendar size={18} color={colors.white} />
          <Text style={styles.saveBtnText}>
            {selectedHour !== null
              ? `Schedule for ${formatHour(selectedHour)}`
              : 'Pick a time slot above'
            }
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ScheduleOrderScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontFamily: fontFamily.extrabold, color: colors.ink },

  summaryCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.primaryTint, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, marginVertical: 16,
    borderWidth: 1, borderColor: colors.primary + '30',
  },
  summaryText: { fontSize: 13, fontFamily: fontFamily.semibold, color: colors.primary },

  sectionLabel: {
    fontSize: 11, fontFamily: fontFamily.extrabold, color: colors.inkMuted,
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12, marginTop: 16,
  },

  daysRow: { marginHorizontal: -16, paddingHorizontal: 16 },
  dayCard: {
    width: 72, alignItems: 'center', paddingVertical: 12, marginRight: 10,
    backgroundColor: colors.white, borderRadius: 14,
    borderWidth: 1.5, borderColor: colors.border,
  },
  dayCardActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayShort: { fontSize: 11, fontFamily: fontFamily.bold, color: colors.inkMuted, marginBottom: 4 },
  dayShortActive: { color: 'rgba(255,255,255,0.85)' },
  dayDate: { fontSize: 13, fontFamily: fontFamily.extrabold, color: colors.ink },
  dayDateActive: { color: colors.white },

  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1.5, borderColor: colors.border,
  },
  slotChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  slotChipDisabled: { backgroundColor: colors.surfaceMuted, borderColor: colors.border, opacity: 0.5 },
  slotText: { fontSize: 13, fontFamily: fontFamily.semibold, color: colors.ink },
  slotTextActive: { color: colors.white },
  slotTextDisabled: { color: colors.inkFaint },

  notice: {
    fontSize: 12, fontFamily: fontFamily.regular, color: colors.inkMuted,
    marginTop: 24, lineHeight: 18, textAlign: 'center',
  },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.white, paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  saveBtn: {
    backgroundColor: colors.primary, borderRadius: 16,
    paddingVertical: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: colors.primary, shadowOpacity: 0.25,
    shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  saveBtnDisabled: { backgroundColor: colors.border, shadowOpacity: 0 },
  saveBtnText: { fontSize: 15, fontFamily: fontFamily.bold, color: colors.white },
});
