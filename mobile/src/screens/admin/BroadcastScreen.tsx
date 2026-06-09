import { ArrowLeft, Rocket } from 'lucide-react-native';
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../api/client';
import { SafeAreaView } from 'react-native-safe-area-context';

const BroadcastScreen = ({ navigation }: any) => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState('all');

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/admin/broadcast', data),
    onSuccess: () => {
      Alert.alert('Broadcast Queued', 'Your mission broadcast has been added to the notification queue.');
      navigation.goBack();
    },
  });

  const TargetButton = ({ id, label }: { id: string, label: string }) => (
    <TouchableOpacity 
      activeOpacity={0.7}
      onPress={() => setTarget(id)}
      style={[styles.targetBtn, target === id ? styles.targetBtnActive : styles.targetBtnInactive]}
    >
      <Text style={[styles.targetBtnText, target === id ? styles.targetBtnTextActive : styles.targetBtnTextInactive]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          activeOpacity={0.7}
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
        >
          <ArrowLeft size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={styles.headerSub}>System Wide</Text>
        <Text style={styles.headerTitle}>Broadcast</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Target Audience</Text>
          <View style={styles.targetBtnRow}>
            <TargetButton id="all" label="Everyone" />
            <TargetButton id="customers" label="Buyers" />
            <TargetButton id="riders" label="Riders" />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Notification Title</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Free Delivery Weekend!"
            placeholderTextColor="#C1C1C1"
            value={title}
            onChangeText={setTitle}
          />
        </View>

        <View style={styles.sectionLarge}>
          <Text style={styles.sectionLabel}>Message Content</Text>
          <TextInput
            style={styles.largeInput}
            placeholder="Tell your users something exciting..."
            placeholderTextColor="#C1C1C1"
            multiline
            textAlignVertical="top"
            value={message}
            onChangeText={setMessage}
          />
        </View>

        <TouchableOpacity 
          activeOpacity={0.9}
          onPress={() => mutation.mutate({ title, message, target })}
          disabled={!title || !message || mutation.isPending}
          style={[styles.launchBtn, (!title || !message) ? styles.launchBtnDisabled : styles.launchBtnEnabled]}
        >
          {mutation.isPending ? (
            <ActivityIndicator color="white" />
          ) : (
            <View style={styles.launchBtnContent}>
              <Text style={styles.launchBtnText}>Launch Broadcast</Text>
              <View style={styles.rocketIconWrapper}>
                <Rocket size={24} color="#FF6B35" />
              </View>
            </View>
          )}
        </TouchableOpacity>
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 32,
    paddingTop: 16,
    paddingBottom: 40,
  },
  backButton: {
    width: 48,
    height: 48,
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    marginBottom: 32,
  },
  headerSub: {
    color: '#FF6B35',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 4,
  },
  headerTitle: {
    color: '#1A1A2E',
    fontSize: 40,
    fontWeight: '900',
    marginTop: 8,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 32,
  },
  section: {
    marginBottom: 40,
  },
  sectionLarge: {
    marginBottom: 48,
  },
  sectionLabel: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 16,
  },
  targetBtnRow: {
    flexDirection: 'row',
  },
  targetBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 12,
  },
  targetBtnActive: {
    backgroundColor: '#1A1A2E',
    borderColor: '#1A1A2E',
  },
  targetBtnInactive: {
    backgroundColor: '#f9fafb',
    borderColor: '#f3f4f6',
  },
  targetBtnText: {
    fontWeight: '900',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  targetBtnTextActive: {
    color: '#fff',
  },
  targetBtnTextInactive: {
    color: '#9ca3af',
  },
  textInput: {
    backgroundColor: '#f9fafb',
    padding: 24,
    borderRadius: 24,
    fontSize: 18,
    fontWeight: '900',
    color: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  largeInput: {
    backgroundColor: '#f9fafb',
    padding: 24,
    borderRadius: 32,
    fontSize: 18,
    fontWeight: '500',
    color: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    minHeight: 160,
  },
  launchBtn: {
    height: 80,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  launchBtnEnabled: {
    backgroundColor: '#FF6B35',
  },
  launchBtnDisabled: {
    backgroundColor: '#e5e7eb',
  },
  launchBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  launchBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 3,
    marginRight: 16,
  },
  rocketIconWrapper: {
    width: 32,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default BroadcastScreen;
