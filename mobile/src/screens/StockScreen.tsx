import { ArrowLeft, Box, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react-native';
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert, StyleSheet } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { api } from '../api/client';
import { SafeAreaView } from 'react-native-safe-area-context';

const StockScreen = ({ navigation }: any) => {
  const queryClient = useQueryClient();
  const { user } = useSelector((state: RootState) => state.auth);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [newStock, setNewStock] = useState('');

  const isAdmin = user?.role === 'super_admin';
  const endpoint = isAdmin ? '/admin/inventory' : '/kitchen/inventory';

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', isAdmin],
    queryFn: () => api.get(endpoint),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, stock }: { id: string; stock: number }) => {
      const updateEndpoint = isAdmin ? `/admin/inventory/${id}` : `/kitchen/inventory/${id}`;
      return api.patch(updateEndpoint, { current_stock: stock });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', isAdmin] });
      setUpdatingId(null);
      setNewStock('');
      Alert.alert('Updated', 'Inventory levels synchronized.');
    },
  });

  if (isLoading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FF6B35" />
    </View>
  );

  const ingredients = data?.ingredients || data?.inventory || [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <ArrowLeft size={20} color="#1A1A2E" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
           <Text style={styles.headerSub}>Supplies</Text>
           <Text style={styles.headerTitle}>Stock Control</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {ingredients.map((ing: any) => (
          <View key={ing.id} style={styles.stockCard}>
            <View style={styles.cardInfo}>
              <View style={styles.cardLeft}>
                <View style={styles.nameRow}>
                   <Box size={14} color="#FF6B35" style={{ marginRight: 8 }} />
                   <Text style={styles.ingredientName}>{ing.name}</Text>
                </View>
                <View style={styles.thresholdRow}>
                   <AlertTriangle size={10} color={ing.current_stock <= ing.reorder_threshold ? "#FF4B4B" : "#9CA3AF"} />
                   <Text style={[styles.thresholdText, { color: ing.current_stock <= ing.reorder_threshold ? '#FF4B4B' : '#9CA3AF' }]}>
                      Threshold: {ing.reorder_threshold} units
                   </Text>
                </View>
              </View>
              <View style={styles.cardRight}>
                <Text style={[styles.stockValue, { color: ing.current_stock <= ing.reorder_threshold ? '#FF4B4B' : '#1A1A2E' }]}>
                  {ing.current_stock}
                </Text>
                <Text style={styles.stockLabel}>In Stock</Text>
              </View>
            </View>

            {updatingId === ing.id ? (
              <View style={styles.updateContainer}>
                <TextInput 
                  style={styles.stockInput}
                  placeholder="New qty"
                  keyboardType="numeric"
                  value={newStock}
                  onChangeText={setNewStock}
                  autoFocus
                  placeholderTextColor="#9ca3af"
                />
                <TouchableOpacity 
                  onPress={() => updateMutation.mutate({ id: ing.id, stock: parseInt(newStock) })}
                  style={styles.confirmButton}
                >
                  <Text style={styles.confirmButtonText}>Update</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => setUpdatingId(null)}
                  style={styles.cancelButton}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity 
                activeOpacity={0.7}
                onPress={() => {
                  setUpdatingId(ing.id);
                  setNewStock(ing.current_stock.toString());
                }}
                style={styles.adjustButton}
              >
                <RefreshCw size={14} color="#1A1A2E" />
                <Text style={styles.adjustButtonText}>Adjust Inventory</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        {(!ingredients || ingredients.length === 0) && (
          <View style={styles.emptyContainer}>
            <CheckCircle2 size={60} color="#D1D5DB" strokeWidth={1} />
            <Text style={styles.emptyText}>Inventory Prime</Text>
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: 32,
    paddingTop: 16,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerSub: {
    color: '#9ca3af',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 3,
  },
  headerTitle: {
    color: '#1A1A2E',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  stockCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    borderRadius: 32,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  cardInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  cardLeft: {
    flex: 1,
    marginRight: 16,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  ingredientName: {
    color: '#1A1A2E',
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: -0.5,
  },
  thresholdRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thresholdText: {
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginLeft: 8,
  },
  cardRight: {
    alignItems: 'flex-end',
  },
  stockValue: {
    fontSize: 24,
    fontWeight: '900',
  },
  stockLabel: {
    color: '#9ca3af',
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  updateContainer: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  stockInput: {
    flex: 1,
    backgroundColor: '#fff',
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 12,
    fontWeight: '900',
    color: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  confirmButton: {
    backgroundColor: '#1A1A2E',
    paddingHorizontal: 24,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  cancelButton: {
    paddingHorizontal: 16,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#9ca3af',
    fontWeight: '900',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  adjustButton: {
    backgroundColor: '#f9fafb',
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  adjustButtonText: {
    color: '#1A1A2E',
    fontWeight: '900',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginLeft: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    opacity: 0.3,
  },
  emptyText: {
    color: '#9ca3af',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 4,
    fontSize: 10,
    marginTop: 24,
  },
});

export default StockScreen;
