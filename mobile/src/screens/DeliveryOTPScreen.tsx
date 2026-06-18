import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StatusBar, StyleSheet, Pressable } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { Flag, ShieldCheck, ArrowLeft, ChevronRight, Lock } from 'lucide-react-native';

const DeliveryOTPScreen = ({ route, navigation }: any) => {
  const { orderId } = route.params;
  const [otp, setOtp] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
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

  const handleBoxPress = () => {
    inputRef.current?.focus();
  };

  const renderOtpBoxes = () => {
    const boxes = [];
    for (let i = 0; i < 6; i++) {
      const char = otp[i] || '';
      const isCurrent = i === otp.length;
      const isFilled = char.length > 0;
      
      boxes.push(
        <View 
          key={i} 
          style={[
            styles.otpBox,
            isCurrent && focused && styles.otpBoxCurrent,
            isFilled && styles.otpBoxFilled
          ]}
        >
          {isCurrent && focused ? (
            <View style={styles.cursor} />
          ) : (
            <Text style={styles.otpBoxText}>{char}</Text>
          )}
        </View>
      );
    }
    return boxes;
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" />
      <View style={styles.content}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.heroSection}>
          <View style={styles.iconWrapper}>
            <Lock size={48} color="#FF6B35" strokeWidth={2} />
          </View>
          <Text style={styles.title}>Secure Verification</Text>
          <Text style={styles.subTitle}>
            Ask the customer for their 6-digit security key. Handover only after successful authorization.
          </Text>
        </View>

        {/* Hidden TextInput projecting to 6 boxes */}
        <Pressable onPress={handleBoxPress} style={styles.otpWrapper}>
          <View style={styles.boxesContainer}>
            {renderOtpBoxes()}
          </View>
          <TextInput
            ref={inputRef}
            style={styles.hiddenInput}
            keyboardType="numeric"
            maxLength={6}
            value={otp}
            onChangeText={(text) => setOtp(text.replace(/\D/g, ''))}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoFocus
          />
        </Pressable>

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
                <Text style={[styles.actionBtnText, otp.length === 6 ? styles.actionBtnTextActive : styles.actionBtnTextInactive]}>Authorize Handover</Text>
                {otp.length === 6 && <ChevronRight size={20} color="white" strokeWidth={3} style={{ marginLeft: 8 }} />}
            </View>
          )}
        </TouchableOpacity>
        
        <View style={styles.footerRow}>
            <ShieldCheck size={14} color="#FF6B35" style={{ marginRight: 8 }} />
            <Text style={styles.footerText}>Authorized Protocol Sequence</Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0C10',
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
    backgroundColor: '#161726',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 48,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 64,
  },
  iconWrapper: {
    width: 96,
    height: 96,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.15)',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -1,
  },
  subTitle: {
    color: '#94A3B8',
    marginTop: 16,
    textAlign: 'center',
    paddingHorizontal: 16,
    fontWeight: '700',
    lineHeight: 22,
    fontSize: 14,
  },
  otpWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 24,
  },
  boxesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 10,
  },
  otpBox: {
    flex: 1,
    height: 64,
    backgroundColor: '#161726',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxCurrent: {
    borderColor: '#FF6B35',
    backgroundColor: '#1E2035',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  otpBoxFilled: {
    borderColor: 'rgba(34, 197, 94, 0.4)',
    backgroundColor: '#122520',
  },
  otpBoxText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  cursor: {
    width: 2,
    height: 24,
    backgroundColor: '#FF6B35',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  actionBtn: {
    height: 80,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  actionBtnActive: {
    backgroundColor: '#FF6B35',
  },
  actionBtnInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  actionBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  actionBtnTextActive: {
    color: '#FFFFFF',
  },
  actionBtnTextInactive: {
    color: '#64748B',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
  },
  footerText: {
    color: '#64748B',
    fontWeight: '900',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
});

export default DeliveryOTPScreen;

