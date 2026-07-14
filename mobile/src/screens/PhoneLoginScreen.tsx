// src/screens/PhoneLoginScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';

interface Props {
  /** Callback when authentication succeeds – receives Firebase ID token */
  onSuccess: (idToken: string) => void;
  /** Optional callback to close the screen */
  onClose?: () => void;
}

export const PhoneLoginScreen: React.FC<Props> = ({ onSuccess, onClose }) => {
  const [phone, setPhone] = useState('+91');
  const [confirmResult, setConfirmResult] = useState<FirebaseAuthTypes.ConfirmationResult | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendOtp = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await auth().signInWithPhoneNumber(phone);
      setConfirmResult(result);
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const confirmCode = async () => {
    if (!confirmResult) return;
    setLoading(true);
    try {
      const credential = await confirmResult.confirm(code);
      const idToken = await credential.user.getIdToken();
      onSuccess(idToken);
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Phone Sign‑In</Text>
      {!confirmResult ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="Phone number"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
          <TouchableOpacity style={styles.button} onPress={sendOtp} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Send OTP</Text>}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TextInput
            style={styles.input}
            placeholder="Enter OTP"
            keyboardType="number-pad"
            value={code}
            onChangeText={setCode}
          />
          <TouchableOpacity style={styles.button} onPress={confirmCode} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Verify OTP</Text>}
          </TouchableOpacity>
        </>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
      {onClose && (
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeText}>Cancel</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 24, marginBottom: 20, fontWeight: '600' },
  input: { width: '100%', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 },
  button: { backgroundColor: '#0066ff', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  btnText: { color: '#fff', fontWeight: '600' },
  error: { color: 'red', marginTop: 10 },
  closeBtn: { marginTop: 20 },
  closeText: { color: '#555' },
});

export default PhoneLoginScreen;
