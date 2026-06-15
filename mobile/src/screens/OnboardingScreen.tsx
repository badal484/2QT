import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useDispatch } from 'react-redux';
import { updateUser } from '../store/slices/authSlice';
import { api } from '../api/client';
import { useMutation } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';

const OnboardingScreen = ({ navigation }: any) => {
  const [name, setName] = useState('');
  const dispatch = useDispatch();

  const updateMutation = useMutation({
    mutationFn: (newName: string) => api.put('/customers/profile', { name: newName }),
    onSuccess: (data) => {
      dispatch(updateUser(data.customer));
      // Replace removes Onboarding from the stack so they can't go back
      navigation.replace('Home');
    },
    onError: (err: any) => {
      Alert.alert('Setup Failed', err.message || 'Could not update profile.');
    }
  });

  const handleSave = () => {
    if (!name.trim()) return;
    updateMutation.mutate(name.trim());
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Animated.View entering={FadeInDown.duration(600)} style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.logo}>2QT</Text>
        </View>
        <Text style={styles.title}>Welcome aboard</Text>
        <Text style={styles.subText}>Let's get your profile set up so we know who we're delivering to.</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>FULL NAME</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. John Doe"
            placeholderTextColor="#9CA3AF"
            value={name}
            onChangeText={setName}
            autoFocus
            autoCapitalize="words"
          />
        </View>

        <TouchableOpacity 
          style={[styles.saveButton, !name.trim() && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!name.trim() || updateMutation.isPending}
        >
          {updateMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Complete Setup</Text>
          )}
        </TouchableOpacity>
      </Animated.View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 32,
    justifyContent: 'center',
  },
  header: {
    width: 64,
    height: 64,
    backgroundColor: '#FF6B35',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    transform: [{ rotate: '3deg' }],
  },
  logo: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -1,
  },
  title: {
    color: '#1A1A2E',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
  },
  subText: {
    color: '#9ca3af',
    marginTop: 8,
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 48,
  },
  inputContainer: {
    marginBottom: 32,
  },
  label: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 20,
    fontSize: 18,
    color: '#1A1A2E',
    fontWeight: '700',
  },
  saveButton: {
    backgroundColor: '#1A1A2E',
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#E5E7EB',
    shadowOpacity: 0,
    elevation: 0,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

export default OnboardingScreen;
