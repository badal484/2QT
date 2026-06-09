import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { Flag, ShieldCheck, ArrowLeft, ChevronRight } from 'lucide-react-native';

const DeliveryOTPScreen = ({ route, navigation }: any) => {
  const { orderId } = route.params;
  const [otp, setOtp] = useState('');
  const queryClient = useQueryClient();

  const verifyMutation = useMutation({
    mutationFn: () => api.post('/riders/verify-otp', { orderId, otp }),
    onSuccess: () => {
      Alert.alert('Mission Accomplished!', 'Delivery successfully verified and completed.', [
        { text: 'Finish', onPress: () => {
          queryClient.invalidateQueries({ queryKey: ['rider-active-order'] });
          queryClient.invalidateQueries({ queryKey: ['rider-earnings'] });
          navigation.navigate('RiderHome');
        }}
      ]);
    },
    onError: (_err: any) => {
      Alert.alert('Verification Failed', 'The code entered is invalid. Please confirm the 6-digit code with the customer.');
      setOtp('');
    }
  });

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color="#1A1A2E" />
        </TouchableOpacity>

        <View style={styles.heroSection}>
          <View style={styles.iconWrapper}>
            <ShieldCheck size={48} color="#22C55E" />
          </View>
          <Text style={styles.title}>Handover Verification</Text>
          <Text style={styles.subTitle}>
            Enter the 6-digit secure delivery code provided by the customer to finalize the order.
          </Text>
        </View>

        <View style={styles.inputContainer}>
            <TextInput
              style={styles.otpInput}
              placeholder="000000"
              placeholderTextColor="#E5E7EB"
              keyboardType="numeric"
              maxLength={6}
              value={otp}
              onChangeText={setOtp}
              autoFocus
            />
        </View>

        <View style={{ flex: 1 }} />

        <TouchableOpacity 
          activeOpacity={0.9}
          style={[styles.actionBtn, otp.length === 6 ? styles.actionBtnActive : styles.actionBtnInactive]}
          onPress={() => verifyMutation.mutate()}
          disabled={otp.length < 6 || verifyMutation.isPending}
        >
          {verifyMutation.isPending ? (
            <ActivityIndicator color="white" />
          ) : (
            <View style={styles.actionBtnContent}>
                <Text style={[styles.actionBtnText, otp.length === 6 ? styles.actionBtnTextActive : styles.actionBtnTextInactive]}>Complete Mission</Text>
                {otp.length === 6 && <ChevronRight size={20} color="white" strokeWidth={3} style={{ marginLeft: 8 }} />}
            </View>
          )}
        </TouchableOpacity>
        
        <View style={styles.footerRow}>
            <Flag size={14} color="#D1D5DB" style={{ marginRight: 8 }} />
            <Text style={styles.footerText}>End of Delivery Sequence</Text>
        </View>
      </View>
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
    paddingHorizontal: 32,
    paddingTop: 64,
    paddingBottom: 48,
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
    marginBottom: 48,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 64,
  },
  iconWrapper: {
    width: 96,
    height: 96,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  title: {
    color: '#1A1A2E',
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -1,
  },
  subTitle: {
    color: '#9ca3af',
    marginTop: 16,
    textAlign: 'center',
    paddingHorizontal: 32,
    fontWeight: '500',
    lineHeight: 20,
  },
  inputContainer: {
    backgroundColor: 'rgba(249, 250, 251, 0.5)',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    borderRadius: 40,
    padding: 32,
    marginBottom: 48,
  },
  otpInput: {
    width: '100%',
    height: 80,
    textAlign: 'center',
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: 16,
    color: '#1A1A2E',
  },
  actionBtn: {
    height: 80,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  actionBtnActive: {
    backgroundColor: '#1A1A2E',
  },
  actionBtnInactive: {
    backgroundColor: '#f3f4f6',
  },
  actionBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 3,
  },
  actionBtnTextActive: {
    color: '#fff',
  },
  actionBtnTextInactive: {
    color: '#9ca3af',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
  },
  footerText: {
    color: '#d1d5db',
    fontWeight: '900',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
});

export default DeliveryOTPScreen;
