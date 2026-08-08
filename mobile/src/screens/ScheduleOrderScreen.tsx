import { tokens } from '../theme/tokens';
import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
} from 'react-native';
import { Calendar, Clock } from 'lucide-react-native';
import { useDispatch } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { setScheduledAt } from '../store/slices/cartSlice';
import { haptics } from '../utils/haptics';
import { PressableScale } from '../components/ui/internal/PressableScale';
import { ScreenHeader } from '../components/ui/ScreenHeader';

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
    haptics.success();
    navigation.goBack();
  };

  const selectedDay = days[selectedDayIdx];

  return (
    <View style={styles.root}>
      <ScreenHeader title="Schedule Order" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
      >
        {/* Summary card */}
        {selectedHour !== null && (
          <Animated.View entering={FadeInDown.duration(250)} style={styles.summaryCard}>
            <Calendar size={16} color={tokens.colors.primary} />
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
            <PressableScale
              key={i}
              style={[styles.dayCard, selectedDayIdx === i && styles.dayCardActive]}
              onPress={() => { haptics.selection(); setSelectedDayIdx(i); setSelectedHour(null); }}
            >
              <Text style={[styles.dayShort, selectedDayIdx === i && styles.dayShortActive]}>
                {day.shortLabel}
              </Text>
              <Text style={[styles.dayDate, selectedDayIdx === i && styles.dayDateActive]}>
                {day.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </Text>
            </PressableScale>
          ))}
        </ScrollView>

        {/* Lunch slots */}
        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Lunch Slots</Text>
        <View style={styles.slotsGrid}>
          {slots.filter(s => s.hour < 16).map(slot => (
            <PressableScale
              key={slot.hour}
              style={[
                styles.slotChip,
                selectedHour === slot.hour && styles.slotChipActive,
                !slot.available && styles.slotChipDisabled,
              ]}
              onPress={() => {
                if (!slot.available) return;
                haptics.selection();
                setSelectedHour(slot.hour);
              }}
            >
              <Clock size={11} color={
                !slot.available ? tokens.colors.textTertiary :
                selectedHour === slot.hour ? tokens.colors.textInverse : tokens.colors.textSecondary
              } />
              <Text style={[
                styles.slotText,
                selectedHour === slot.hour && styles.slotTextActive,
                !slot.available && styles.slotTextDisabled,
              ]}>
                {slot.label}
              </Text>
            </PressableScale>
          ))}
        </View>

        {/* Dinner slots */}
        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Dinner Slots</Text>
        <View style={styles.slotsGrid}>
          {slots.filter(s => s.hour >= 16).map(slot => (
            <PressableScale
              key={slot.hour}
              style={[
                styles.slotChip,
                selectedHour === slot.hour && styles.slotChipActive,
                !slot.available && styles.slotChipDisabled,
              ]}
              onPress={() => {
                if (!slot.available) return;
                haptics.selection();
                setSelectedHour(slot.hour);
              }}
            >
              <Clock size={11} color={
                !slot.available ? tokens.colors.textTertiary :
                selectedHour === slot.hour ? tokens.colors.textInverse : tokens.colors.textSecondary
              } />
              <Text style={[
                styles.slotText,
                selectedHour === slot.hour && styles.slotTextActive,
                !slot.available && styles.slotTextDisabled,
              ]}>
                {slot.label}
              </Text>
            </PressableScale>
          ))}
        </View>

        <Text style={styles.notice}>
          Kitchen hours: 11:00 AM – 10:00 PM. Orders are prepared fresh and dispatched at the selected slot.
        </Text>
      </ScrollView>

      {/* Save button */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) + 4 }]}>
        <PressableScale
          style={[styles.saveBtn, selectedHour === null && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={selectedHour === null}
        >
          <Calendar size={18} color={tokens.colors.textInverse} />
          <Text style={styles.saveBtnText}>
            {selectedHour !== null
              ? `Schedule for ${formatHour(selectedHour)}`
              : 'Pick a time slot above'
            }
          </Text>
        </PressableScale>
      </View>
    </View>
  );
};

export default ScheduleOrderScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.colors.background },


  summaryCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: tokens.colors.primaryTint, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, marginVertical: 16,
    borderWidth: 1, borderColor: tokens.colors.primary + '30',
  },
  summaryText: { fontSize: 13, fontFamily: tokens.typography.family.semibold, color: tokens.colors.primary },

  sectionLabel: {
    fontSize: 11, fontFamily: tokens.typography.family.extrabold, color: tokens.colors.textSecondary,
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12, marginTop: 16,
  },

  daysRow: { marginHorizontal: -16, paddingHorizontal: 16 },
  dayCard: {
    width: 72, alignItems: 'center', paddingVertical: 12, marginRight: 10,
    backgroundColor: tokens.colors.textInverse, borderRadius: 14,
    borderWidth: 1.5, borderColor: tokens.colors.border,
  },
  dayCardActive: { backgroundColor: tokens.colors.primary, borderColor: tokens.colors.primary },
  dayShort: { fontSize: 11, fontFamily: tokens.typography.family.bold, color: tokens.colors.textSecondary, marginBottom: 4 },
  dayShortActive: { color: 'rgba(255,255,255,0.85)' },
  dayDate: { fontSize: 13, fontFamily: tokens.typography.family.extrabold, color: tokens.colors.textPrimary },
  dayDateActive: { color: tokens.colors.textInverse },

  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    backgroundColor: tokens.colors.textInverse,
    borderWidth: 1.5, borderColor: tokens.colors.border,
  },
  slotChipActive: { backgroundColor: tokens.colors.primary, borderColor: tokens.colors.primary },
  slotChipDisabled: { backgroundColor: tokens.colors.surfaceMuted, borderColor: tokens.colors.border, opacity: 0.5 },
  slotText: { fontSize: 13, fontFamily: tokens.typography.family.semibold, color: tokens.colors.textPrimary },
  slotTextActive: { color: tokens.colors.textInverse },
  slotTextDisabled: { color: tokens.colors.textTertiary },

  notice: {
    fontSize: 12, fontFamily: tokens.typography.family.regular, color: tokens.colors.textSecondary,
    marginTop: 24, lineHeight: 18, textAlign: 'center',
  },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: tokens.colors.textInverse, paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: tokens.colors.border,
  },
  saveBtn: {
    backgroundColor: tokens.colors.primary, borderRadius: 16,
    paddingVertical: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: tokens.colors.primary, shadowOpacity: 0.25,
    shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  saveBtnDisabled: { backgroundColor: tokens.colors.border, shadowOpacity: 0 },
  saveBtnText: { fontSize: 15, fontFamily: tokens.typography.family.bold, color: tokens.colors.textInverse },
});
