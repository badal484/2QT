import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, NativeModules, StyleSheet } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client';

const { RoleModule } = NativeModules;
const BUILD_ROLE = RoleModule?.BUILD_ROLE || 'customer';

const LoginScreen = ({ navigation }: any) => {
  const [phone, setPhone] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [devRole, setDevRole] = useState(RoleModule?.BUILD_ROLE || 'customer');

  const mutation = useMutation({
    mutationFn: (phoneNumber: string) => api.post('/auth/send-otp', { phone: phoneNumber }),
    onSuccess: (data) => {
      navigation.navigate('OTP', { 
        phone: data.phone, 
        referralCode: referralCode.trim().toUpperCase(),
        devOtp: data.devOtp,
        devRole: devRole
      });
    },
    onError: (error: any) => {
      Alert.alert('Error', 'Could not send OTP. Check your connection.');
    }
  });

  const handleSendOTP = () => {
    if (phone.length === 10) {
      mutation.mutate('91' + phone);
    }
  };

  const getAppBranding = () => {
    switch (devRole) {
      case 'rider': return { name: '2QT CAPTAIN', color: '#1A1A2E', sub: 'Rider Portal' };
      case 'kitchen': return { name: '2QT PARTNER', color: '#10B981', sub: 'Kitchen Command' };
      case 'admin': return { name: '2QT ADMIN', color: '#EF4444', sub: 'Operations Deck' };
      default: return { name: '2QT', color: '#FF6B35', sub: 'Gourmet Delivery' };
    }
  };

  const branding = getAppBranding();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={[styles.logoCard, { backgroundColor: branding.color }]}>
          <Text style={styles.logoText}>V</Text>
        </View>
        <Text style={styles.brandingSubText}>{branding.sub}</Text>
        <Text style={styles.brandingNameText}>{branding.name}</Text>
        <Text style={styles.heroText}>Experience the future of gourmet delivery in Bengaluru</Text>

        <View style={styles.inputRow}>
          <Text style={styles.countryCodeText}>+91</Text>
          <TextInput
            style={styles.phoneInput}
            placeholder="00000 00000"
            placeholderTextColor="#C1C1C1"
            keyboardType="numeric"
            maxLength={10}
            value={phone}
            onChangeText={setPhone}
            autoFocus
          />
        </View>

        <View style={[styles.inputRow, { marginTop: 16, height: 64 }]}>
          <TextInput
            style={[styles.phoneInput, { paddingLeft: 0, fontSize: 16 }]}
            placeholder="REFERRAL CODE (OPTIONAL)"
            placeholderTextColor="#C1C1C1"
            autoCapitalize="characters"
            value={referralCode}
            onChangeText={setReferralCode}
          />
        </View>

        {phone.length === 10 && (
          <TouchableOpacity 
            activeOpacity={0.9}
            disabled={mutation.isPending}
            style={[styles.actionBtn, { backgroundColor: branding.color }]}
            onPress={handleSendOTP}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.actionBtnText}>Send Verification Code</Text>
            )}
          </TouchableOpacity>
        )}
        
        {phone.length < 10 && (
          <View style={styles.hintContainer}>
            <Text style={styles.hintText}>Enter 10 digits to proceed</Text>
          </View>
        )}
        
        <Text style={styles.secureText}>Secured by 2QT Shield</Text>

        {__DEV__ && !RoleModule?.BUILD_ROLE && (
          <View style={styles.devRoleContainer}>
            <Text style={styles.devRoleLabel}>DEV ROLE SWITCHER</Text>
            <View style={styles.devRoleRow}>
              {['customer', 'rider', 'kitchen', 'admin'].map(r => (
                <TouchableOpacity key={r} onPress={() => setDevRole(r)} style={[styles.devRoleBtn, devRole === r && styles.devRoleBtnActive]}>
                  <Text style={[styles.devRoleBtnText, devRole === r && styles.devRoleBtnTextActive]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 32,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoCard: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 10,
  },
  logoText: {
    color: '#fff',
    fontSize: 64,
    fontWeight: '900',
  },
  brandingSubText: {
    color: '#1A1A2E',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 4,
    marginBottom: 8,
  },
  brandingNameText: {
    color: '#1A1A2E',
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -1,
  },
  heroText: {
    color: '#9ca3af',
    marginTop: 16,
    textAlign: 'center',
    fontWeight: '500',
    paddingHorizontal: 16,
    lineHeight: 20,
  },
  inputRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 48,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    borderRadius: 24,
    paddingHorizontal: 24,
    height: 80,
  },
  countryCodeText: {
    color: '#1A1A2E',
    fontSize: 20,
    fontWeight: '900',
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
    paddingRight: 24,
  },
  phoneInput: {
    flex: 1,
    color: '#1A1A2E',
    fontSize: 20,
    fontWeight: '900',
    paddingLeft: 24,
  },
  actionBtn: {
    width: '100%',
    height: 80,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 10,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  hintContainer: {
    marginTop: 40,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.2,
  },
  hintText: {
    color: '#1A1A2E',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  secureText: {
    marginTop: 40,
    color: '#9ca3af',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  devRoleContainer: {
    marginTop: 40,
    width: '100%',
    alignItems: 'center',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  devRoleLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#9CA3AF',
    marginBottom: 12,
  },
  devRoleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  devRoleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  devRoleBtnActive: {
    backgroundColor: '#1A1A2E',
  },
  devRoleBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#9CA3AF',
  },
  devRoleBtnTextActive: {
    color: '#fff',
  },
});

export default LoginScreen;
