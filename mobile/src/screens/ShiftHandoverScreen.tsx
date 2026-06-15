import { ArrowLeft, Check } from 'lucide-react-native';
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client';

const Checkbox = ({ value, label, onToggle }: any) => (
  <TouchableOpacity 
    onPress={onToggle}
    activeOpacity={0.8}
    style={styles.checkboxRow}
  >
    <View style={[styles.checkbox, value ? styles.checkboxActive : styles.checkboxInactive]}>
      {value && <Check size={16} color="#22C55E" />}
    </View>
    <Text style={styles.checkboxLabel}>{label}</Text>
  </TouchableOpacity>
);

const ShiftHandoverScreen = ({ navigation }: any) => {
  const [notes, setNotes] = useState('');
  const [cleaningStatus, setCleaningStatus] = useState(false);
  const [gasStatus, setGasStatus] = useState(false);

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/kitchen/shift-handover', data),
    onSuccess: () => {
      Alert.alert('Shift Ended', 'Handover notes submitted successfully.');
      navigation.goBack();
    },
  });

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <ArrowLeft size={24} color="#fff" />
      </TouchableOpacity>

      <Text style={styles.title}>Shift Handover</Text>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView}>
        <Checkbox 
          label="Kitchen cleaning completed" 
          value={cleaningStatus} 
          onToggle={() => setCleaningStatus(!cleaningStatus)} 
        />
        <Checkbox 
          label="Gas & equipment turned off" 
          value={gasStatus} 
          onToggle={() => setGasStatus(!gasStatus)} 
        />

        <Text style={styles.sectionLabel}>Handover Notes</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="Any special instructions for the next shift?"
          placeholderTextColor="#4b5563"
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          value={notes}
          onChangeText={setNotes}
        />

        <TouchableOpacity 
          onPress={() => mutation.mutate({ notes, cleaningStatus, gasStatus })}
          disabled={mutation.isPending}
          style={styles.submitBtn}
        >
          {mutation.isPending ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.submitBtnText}>SUBMIT & END SHIFT</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
    padding: 32,
    paddingTop: 64,
  },
  backButton: {
    marginBottom: 24,
  },
  title: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '900',
    marginBottom: 40,
  },
  scrollView: {
    flex: 1,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  checkbox: {
    width: 32,
    height: 32,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  checkboxActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  checkboxInactive: {
    borderColor: '#374151',
  },
  checkMark: {
    color: '#fff',
    fontWeight: '900',
  },
  checkboxLabel: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  sectionLabel: {
    color: '#6b7280',
    fontWeight: '900',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 12,
    marginTop: 16,
  },
  notesInput: {
    backgroundColor: '#1f2937',
    padding: 24,
    borderRadius: 32,
    fontSize: 18,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 48,
    minHeight: 160,
  },
  submitBtn: {
    backgroundColor: '#FF6B35',
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: 2,
  },
});

export default ShiftHandoverScreen;
