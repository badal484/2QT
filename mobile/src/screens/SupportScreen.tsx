import { ArrowLeft } from 'lucide-react-native';
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client';

const SupportScreen = ({ navigation }: any) => {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/customers/support/tickets', data),
    onSuccess: () => {
      Alert.alert('Ticket Raised', 'We will get back to you within 24 hours.');
      navigation.goBack();
    },
  });

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <ArrowLeft size={24} color="#1A1A2E" />
      </TouchableOpacity>

      <Text style={styles.title}>Raise a Ticket</Text>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView}>
        <Text style={styles.sectionLabel}>Subject</Text>
        <TextInput
          style={styles.subjectInput}
          placeholder="What's the issue?"
          placeholderTextColor="#9ca3af"
          value={subject}
          onChangeText={setSubject}
        />

        <Text style={styles.sectionLabel}>Description</Text>
        <TextInput
          style={styles.descInput}
          placeholder="Tell us more..."
          placeholderTextColor="#9ca3af"
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          value={message}
          onChangeText={setMessage}
        />

        <TouchableOpacity 
          onPress={() => mutation.mutate({ subject, message })}
          disabled={!subject || !message || mutation.isPending}
          style={[styles.submitBtn, (!subject || !message) ? styles.submitBtnDisabled : styles.submitBtnEnabled]}
        >
          {mutation.isPending ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.submitBtnText}>SUBMIT TICKET</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
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
  subjectInput: {
    backgroundColor: '#f9fafb',
    padding: 24,
    borderRadius: 24,
    fontSize: 18,
    color: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    marginBottom: 32,
  },
  descInput: {
    backgroundColor: '#f9fafb',
    padding: 24,
    borderRadius: 24,
    fontSize: 18,
    color: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    marginBottom: 48,
    minHeight: 160,
  },
  submitBtn: {
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  submitBtnEnabled: {
    backgroundColor: '#FF6B35',
  },
  submitBtnDisabled: {
    backgroundColor: '#e5e7eb',
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: 2,
  },
});

export default SupportScreen;
