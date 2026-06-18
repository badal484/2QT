import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useDispatch } from 'react-redux';
import { setAuth } from '../store/slices/authSlice';
import { api } from '../api/client';
import { Lock, Delete } from 'lucide-react-native';

const KitchenLoginScreen = () => {
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const dispatch = useDispatch();

  const handleKeyPress = (key: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + key);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleSubmit = async () => {
    if (pin.length !== 4) return;
    
    setIsLoading(true);
    try {
      const response = await api.post('/auth/kitchen-pin', { pin });
      
      dispatch(setAuth({
        user: {
          id: response.kitchen.id,
          name: response.kitchen.name,
          phone: '',
          role: 'chef',
          termsAcceptedAt: new Date().toISOString(),
          kitchenId: response.kitchen.id,
          zoneId: null
        },
        accessToken: response.accessToken,
        refreshToken: response.refreshToken
      }));
    } catch (err: any) {
      Alert.alert('Access Denied', err?.response?.data?.error || 'Invalid PIN code');
      setPin('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.lockIconWrapper}>
        <Lock size={32} color="#FF6B35" />
      </View>
      
      <Text style={styles.title}>Kitchen Access</Text>
      <Text style={styles.subTitle}>Enter 4-Digit Security PIN</Text>

      {/* PIN Dots */}
      <View style={styles.pinContainer}>
        {[0, 1, 2, 3].map((index) => (
          <View 
            key={index}
            style={[styles.pinDot, index < pin.length ? styles.pinDotActive : styles.pinDotInactive]}
          />
        ))}
      </View>

      {/* Numeric Pad */}
      <View style={styles.keypad}>
        {[[1, 2, 3], [4, 5, 6], [7, 8, 9]].map((row, rowIndex) => (
          <View key={rowIndex} style={styles.keypadRow}>
            {row.map((num) => (
              <TouchableOpacity 
                key={num}
                activeOpacity={0.7}
                onPress={() => handleKeyPress(num.toString())}
                style={styles.keyBtn}
              >
                <Text style={styles.keyText}>{num}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
        
        <View style={styles.keypadRow}>
          <View style={styles.emptyKey} />
          <TouchableOpacity 
            activeOpacity={0.7}
            onPress={() => handleKeyPress('0')}
            style={styles.keyBtn}
          >
            <Text style={styles.keyText}>0</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            activeOpacity={0.7}
            onPress={handleDelete}
            style={styles.deleteBtn}
          >
            <Delete size={28} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity 
        activeOpacity={0.9}
        onPress={handleSubmit}
        disabled={pin.length !== 4 || isLoading}
        style={[styles.authBtn, pin.length === 4 ? styles.authBtnActive : styles.authBtnInactive]}
      >
        {isLoading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={[styles.authBtnText, pin.length === 4 ? styles.authBtnTextActive : styles.authBtnTextInactive]}>
            Authenticate
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  lockIconWrapper: {
    width: 80,
    height: 80,
    backgroundColor: '#1A1A2E',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 20,
  },
  title: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  subTitle: {
    color: '#9ca3af',
    fontWeight: '700',
    fontSize: 10,
    marginBottom: 48,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  pinContainer: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 64,
  },
  pinDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  pinDotActive: {
    backgroundColor: '#FF6B35',
  },
  pinDotInactive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  keypad: {
    width: '100%',
    maxWidth: 280,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  keyBtn: {
    width: 80,
    height: 80,
    backgroundColor: '#1A1A2E',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '900',
  },
  deleteBtn: {
    width: 80,
    height: 80,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyKey: {
    width: 80,
    height: 80,
  },
  authBtn: {
    marginTop: 64,
    width: '100%',
    height: 64,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authBtnActive: {
    backgroundColor: '#FF6B35',
  },
  authBtnInactive: {
    backgroundColor: '#1A1A2E',
  },
  authBtnText: {
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 3,
  },
  authBtnTextActive: {
    color: '#fff',
  },
  authBtnTextInactive: {
    color: '#4b5563',
  },
});

export default KitchenLoginScreen;
