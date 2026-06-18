import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Save, Plus, Minus } from 'lucide-react-native';

const CreateBatchScreen = ({ navigation }: any) => {
  const [itemName, setItemName] = useState('');
  const [targetQuantity, setTargetQuantity] = useState('10');
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/kitchen/batches', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kitchen-batches'] });
      navigation.goBack();
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to create batch');
    }
  });

  const handleCreate = () => {
    if (!itemName) {
      Alert.alert('Validation', 'Please enter an item name');
      return;
    }
    const qty = parseInt(targetQuantity, 10);
    if (!Number.isInteger(qty) || qty <= 0) {
      Alert.alert('Validation', 'Please enter a valid target quantity');
      return;
    }
    createMutation.mutate({
      item_name: itemName,
      target_quantity: qty,
    });
  };

  const adjustQty = (amount: number) => {
    const current = parseInt(targetQuantity, 10) || 0;
    setTargetQuantity(Math.max(1, current + amount).toString());
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <ArrowLeft size={24} color="white" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerLabel}>Production</Text>
            <Text style={styles.headerTitle}>New Batch</Text>
          </View>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.formSection}>
            {/* Item Name */}
            <View>
              <Text style={styles.sectionLabel}>What are we preparing?</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.nameInput}
                  placeholder="e.g. Burger Patties"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  value={itemName}
                  onChangeText={setItemName}
                  autoFocus
                />
              </View>
            </View>

            {/* Target Quantity */}
            <View>
              <Text style={styles.sectionLabel}>Target Quantity</Text>
              <View style={styles.qtyControl}>
                <TouchableOpacity 
                  onPress={() => adjustQty(-5)}
                  style={styles.qtyBtn}
                >
                  <Minus size={24} color="white" />
                </TouchableOpacity>
                
                <TextInput
                  style={styles.qtyInput}
                  keyboardType="numeric"
                  value={targetQuantity}
                  onChangeText={setTargetQuantity}
                />

                <TouchableOpacity 
                  onPress={() => adjustQty(5)}
                  style={styles.qtyBtnPrimary}
                >
                  <Plus size={24} color="white" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Note */}
            <View style={styles.noteBox}>
              <Text style={styles.noteText}>
                Starting a new batch will notify the floor manager. Ensure all ingredients are available before confirming.
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Footer Action */}
        <View style={styles.footer}>
          <TouchableOpacity 
            activeOpacity={0.9}
            disabled={createMutation.isPending}
            onPress={handleCreate}
            style={styles.submitBtn}
          >
            {createMutation.isPending ? (
              <ActivityIndicator color="black" />
            ) : (
              <View style={styles.submitBtnContent}>
                <Save size={20} color="black" style={{ marginRight: 12 }} />
                <Text style={styles.submitBtnText}>Initialize Batch</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  headerLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 3,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  formSection: {
    gap: 32,
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 16,
  },
  inputWrapper: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 24,
  },
  nameInput: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 16,
  },
  qtyBtn: {
    width: 64,
    height: 64,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  qtyBtnPrimary: {
    width: 64,
    height: 64,
    backgroundColor: '#FF6B35',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  qtyInput: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '900',
    textAlign: 'center',
    flex: 1,
  },
  noteBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  noteText: {
    color: 'rgba(245, 158, 11, 0.8)',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 20,
  },
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    backgroundColor: '#000',
  },
  submitBtn: {
    backgroundColor: '#00D084',
    height: 80,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00D084',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  submitBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 3,
  },
});

export default CreateBatchScreen;
