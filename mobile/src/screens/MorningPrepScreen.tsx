import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet } from 'react-native';
import { Check, Plus } from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

const MorningPrepScreen = () => {
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['kitchen-prep'],
    queryFn: () => api.get('/kitchen/prep-list'),
  });

  const toggleMutation = useMutation({
    mutationFn: (taskId: string) => api.post(`/kitchen/prep-list/${taskId}/toggle`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kitchen-prep'] }),
  });

  const addMutation = useMutation({
    mutationFn: (title: string) => api.post('/kitchen/prep-list', { title, category: 'General' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kitchen-prep'] });
      setNewTitle('');
    },
  });

  const handleAdd = () => {
    const title = newTitle.trim();
    if (!title) return;
    addMutation.mutate(title);
  };

  if (isLoading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FF6B35" />
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Morning Prep</Text>
        <Text style={styles.headerSub}>Daily Checklist</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            placeholder="Add a prep task..."
            placeholderTextColor="#6b7280"
            value={newTitle}
            onChangeText={setNewTitle}
            onSubmitEditing={handleAdd}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={styles.addBtn}
            onPress={handleAdd}
            disabled={addMutation.isPending || !newTitle.trim()}
          >
            {addMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Plus size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>

        {data?.tasks?.map((task: any) => (
          <TouchableOpacity 
            key={task.id}
            activeOpacity={0.8}
            style={[styles.taskCard, task.completed ? styles.taskCardCompleted : styles.taskCardPending]}
            onPress={() => toggleMutation.mutate(task.id)}
          >
            <View style={styles.taskContent}>
              <Text style={[styles.taskTitle, task.completed ? styles.taskTitleCompleted : styles.taskTitlePending]}>{task.title}</Text>
              <Text style={styles.taskCategory}>{task.category}</Text>
            </View>
            <View style={[styles.checkbox, task.completed ? styles.checkboxChecked : styles.checkboxUnchecked]}>
              {task.completed && <Check size={16} color="#22C55E" style={{ marginLeft: 8 }} />}
            </View>
          </TouchableOpacity>
        ))}

        {data?.tasks?.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No tasks assigned for today.</Text>
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
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  addInput: {
    flex: 1,
    backgroundColor: '#1f2937',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#374151',
    paddingHorizontal: 20,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  addBtn: {
    width: 48,
    height: 48,
    backgroundColor: '#FF6B35',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
  },
  headerSub: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  taskCard: {
    padding: 24,
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  taskCardPending: {
    backgroundColor: '#1f2937',
    borderColor: '#374151',
  },
  taskCardCompleted: {
    backgroundColor: '#111827',
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  taskContent: {
    flex: 1,
    marginRight: 16,
  },
  taskTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  taskTitlePending: {
    color: '#fff',
  },
  taskTitleCompleted: {
    color: '#6b7280',
    textDecorationLine: 'line-through',
  },
  taskCategory: {
    color: '#6b7280',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginTop: 4,
    letterSpacing: 1,
  },
  checkbox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxUnchecked: {
    borderColor: '#4b5563',
  },
  checkboxChecked: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  checkMark: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyText: {
    color: '#6b7280',
    fontWeight: '700',
  },
});

export default MorningPrepScreen;
