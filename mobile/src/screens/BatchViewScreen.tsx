import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

const BatchViewScreen = ({ navigation }: any) => {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['kitchen-batches'],
    queryFn: () => api.get('/kitchen/batches'),
  });

  const completeBatchMutation = useMutation({
    mutationFn: (batchId: string) => api.post(`/kitchen/batches/${batchId}/complete`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kitchen-batches'] }),
  });

  if (isLoading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FF6B35" />
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Production Batches</Text>
        <TouchableOpacity 
          style={styles.newBatchBtn}
          onPress={() => navigation.navigate('CreateBatch')}
        >
          <Text style={styles.newBatchText}>NEW BATCH</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {data?.batches?.map((batch: any) => (
          <View key={batch.id} style={styles.batchCard}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.itemName}>{batch.item_name}</Text>
                <Text style={styles.targetText}>Target: {batch.target_quantity} units</Text>
              </View>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{batch.status}</Text>
              </View>
            </View>

            <View style={styles.progressBg}>
              <View 
                style={[styles.progressFill, { width: `${(batch.current_quantity / batch.target_quantity) * 100}%` }]} 
              />
            </View>

            <TouchableOpacity 
              style={styles.completeBtn}
              onPress={() => completeBatchMutation.mutate(batch.id)}
            >
              <Text style={styles.completeBtnText}>MARK AS COMPLETED</Text>
            </TouchableOpacity>
          </View>
        ))}

        {data?.batches?.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No active batches right now.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingTop: 48,
    paddingHorizontal: 32,
    paddingBottom: 24,
    backgroundColor: '#1f2937',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
  },
  newBatchBtn: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 12,
  },
  newBatchText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  batchCard: {
    backgroundColor: '#1f2937',
    padding: 24,
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  itemName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
  },
  targetText: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 4,
  },
  statusBadge: {
    backgroundColor: 'rgba(255, 107, 53, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 100,
  },
  statusText: {
    color: '#FF6B35',
    fontWeight: '900',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  progressBg: {
    height: 12,
    backgroundColor: '#374151',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 24,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF6B35',
  },
  completeBtn: {
    backgroundColor: '#374151',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  completeBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyText: {
    color: '#9ca3af',
    fontWeight: '700',
  },
});

export default BatchViewScreen;
