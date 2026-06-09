import React from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { PowerOff, CheckCircle2 } from 'lucide-react-native';

const KitchenClosedScreen = ({ navigation }: any) => {
  return (
    <View style={styles.container}>
      <View style={styles.iconOuter}>
        <PowerOff size={48} color="#EF4444" />
      </View>
      
      <Text style={styles.title}>Kitchen Offline</Text>
      <Text style={styles.description}>
        The kitchen is currently disconnected from the Velto network. You are not receiving new orders.
      </Text>

      <View style={styles.checklistCard}>
        <Text style={styles.checklistLabel}>Pre-flight Checklist</Text>
        
        <View style={styles.stepsContainer}>
          <View style={styles.stepRow}>
            <CheckCircle2 size={16} color="#10B981" />
            <Text style={styles.stepText}>Inventory synced</Text>
          </View>
          <View style={styles.stepRow}>
            <CheckCircle2 size={16} color="#10B981" />
            <Text style={styles.stepText}>Prep stations ready</Text>
          </View>
          <View style={styles.stepRow}>
            <CheckCircle2 size={16} color="#10B981" />
            <Text style={styles.stepText}>Safety checks completed</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity 
        activeOpacity={0.9}
        onPress={() => {
          Alert.alert(
            'Go Online',
            'Are you sure you want to open the kitchen and start accepting live orders?',
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Go Online', 
                style: 'default',
                onPress: () => {
                  navigation.replace('MainKitchen');
                }
              }
            ]
          );
        }}
        style={styles.onlineBtn}
      >
        <Text style={styles.onlineBtnText}>Clock In & Go Online</Text>
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
  iconOuter: {
    width: 128,
    height: 128,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  title: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
    textTransform: 'uppercase',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    color: '#9ca3af',
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 48,
  },
  checklistCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 24,
    borderRadius: 32,
    width: '100%',
    marginBottom: 48,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  checklistLabel: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 16,
  },
  stepsContainer: {
    gap: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepText: {
    color: '#d1d5db',
    fontWeight: '700',
    fontSize: 12,
    marginLeft: 12,
  },
  onlineBtn: {
    width: '100%',
    backgroundColor: '#00D084',
    height: 64,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00D084',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  onlineBtnText: {
    color: '#000',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 3,
    fontSize: 12,
  },
});

export default KitchenClosedScreen;
