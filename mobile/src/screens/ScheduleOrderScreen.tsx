import { ArrowLeft } from 'lucide-react-native';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useDispatch } from 'react-redux';
import { setScheduledAt } from '../store/slices/cartSlice';

const ScheduleOrderScreen = ({ navigation }: any) => {
  const dispatch = useDispatch();
  const [selectedDay, setSelectedDay] = useState('Tomorrow');
  const [selectedTime, setSelectedTime] = useState('12:30 PM');

  const days = ['Tomorrow', 'Wednesday', 'Thursday', 'Friday'];
  const times = ['12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM', '7:00 PM', '7:30 PM', '8:00 PM'];

  const handleSave = () => {
    // Basic date parsing logic for simulation
    const date = new Date();
    if (selectedDay === 'Tomorrow') {
        date.setDate(date.getDate() + 1);
    } else {
        // Just arbitrarily add a few days for other selections to simulate picking
        date.setDate(date.getDate() + 2);
    }
    
    // Parse Time: "12:30 PM"
    const [timeStr, period] = selectedTime.split(' ');
    const [h, m] = timeStr.split(':');
    let hour = parseInt(h);
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    date.setHours(hour, parseInt(m), 0, 0);

    dispatch(setScheduledAt(date.toISOString()));
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <ArrowLeft size={24} color="#1A1A2E" />
      </TouchableOpacity>

      <Text style={styles.title}>Schedule Order</Text>
      <Text style={styles.subTitle}>Pick a time that works for you.</Text>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView}>
        <Text style={styles.sectionLabel}>Select Day</Text>
        <View style={styles.optionsRow}>
          {days.map((day) => (
            <TouchableOpacity 
              key={day}
              onPress={() => setSelectedDay(day)}
              style={[styles.optionBtn, selectedDay === day ? styles.optionBtnActive : styles.optionBtnInactive]}
            >
              <Text style={[styles.optionText, selectedDay === day ? styles.optionTextActive : styles.optionTextInactive]}>{day}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Select Slot</Text>
        <View style={styles.optionsRow}>
          {times.map((time) => (
            <TouchableOpacity 
              key={time}
              onPress={() => setSelectedTime(time)}
              style={[styles.optionBtn, selectedTime === time ? styles.optionBtnActive : styles.optionBtnInactive]}
            >
              <Text style={[styles.optionText, selectedTime === time ? styles.optionTextActive : styles.optionTextInactive]}>{time}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <TouchableOpacity 
        onPress={handleSave}
        style={styles.setBtn}
      >
        <Text style={styles.setBtnText}>SET SCHEDULE</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 32,
    paddingTop: 64,
  },
  backButton: {
    marginBottom: 24,
  },
  title: {
    color: '#1A1A2E',
    fontSize: 40,
    fontWeight: '900',
    marginBottom: 16,
  },
  subTitle: {
    color: '#9ca3af',
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 40,
  },
  scrollView: {
    flex: 1,
  },
  sectionLabel: {
    color: '#1A1A2E',
    fontWeight: '900',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 12,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 40,
  },
  optionBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 100,
    marginRight: 12,
    marginBottom: 12,
  },
  optionBtnActive: {
    backgroundColor: '#FF6B35',
  },
  optionBtnInactive: {
    backgroundColor: '#f3f4f6',
  },
  optionText: {
    fontWeight: '700',
  },
  optionTextActive: {
    color: '#fff',
  },
  optionTextInactive: {
    color: '#6b7280',
  },
  setBtn: {
    backgroundColor: '#1A1A2E',
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  setBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: 2,
  },
});

export default ScheduleOrderScreen;
