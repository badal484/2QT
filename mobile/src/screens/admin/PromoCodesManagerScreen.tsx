import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet, Alert, Switch } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Ticket, Plus, Trash2 } from 'lucide-react-native';
import { api } from '../../api/client';

const PromoCodesManagerScreen = ({ navigation }: any) => {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCode, setNewCode] = useState({
    code: '',
    discount_percent: '10',
    min_order_paise: '0',
    max_discount_paise: '10000',
  });

  const { data: promoData, isLoading } = useQuery({
    queryKey: ['admin-promocodes'],
    queryFn: () => api.get('/promocodes/admin'),
  });

  const addMutation = useMutation({
    mutationFn: (data: any) => api.post('/promocodes/admin', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-promocodes'] });
      setShowAddForm(false);
      setNewCode({ code: '', discount_percent: '10', min_order_paise: '0', max_discount_paise: '10000' });
      Alert.alert('Success', 'Promo code created');
    },
    onError: (err: any) => Alert.alert('Error', err.message || 'Could not create promo code')
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/promocodes/admin/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-promocodes'] }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string, is_active: boolean }) => api.patch(`/promocodes/admin/${id}`, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-promocodes'] }),
  });

  if (isLoading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FF6B35" />
    </View>
  );

  const promos = promoData?.promoCodes || [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Promo Codes</Text>
        <TouchableOpacity onPress={() => setShowAddForm(!showAddForm)} style={styles.addButton}>
          <Plus size={24} color="#1A1A2E" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {showAddForm && (
          <View style={styles.addCard}>
            <Text style={styles.addTitle}>New Promo Code</Text>
            <TextInput 
              style={styles.input}
              placeholder="Code (e.g. SUMMER20)"
              placeholderTextColor="#9ca3af"
              value={newCode.code}
              onChangeText={(t) => setNewCode({ ...newCode, code: t.toUpperCase() })}
              autoCapitalize="characters"
            />
            <TextInput 
              style={styles.input}
              placeholder="Discount % (e.g. 15)"
              placeholderTextColor="#9ca3af"
              value={newCode.discount_percent}
              onChangeText={(t) => setNewCode({ ...newCode, discount_percent: t })}
              keyboardType="numeric"
            />
            <TextInput 
              style={styles.input}
              placeholder="Min Order ₹"
              placeholderTextColor="#9ca3af"
              value={newCode.min_order_paise}
              onChangeText={(t) => setNewCode({ ...newCode, min_order_paise: t })}
              keyboardType="numeric"
            />
            <TextInput 
              style={styles.input}
              placeholder="Max Discount ₹"
              placeholderTextColor="#9ca3af"
              value={newCode.max_discount_paise}
              onChangeText={(t) => setNewCode({ ...newCode, max_discount_paise: t })}
              keyboardType="numeric"
            />
            
            <TouchableOpacity 
              style={styles.saveBtn}
              onPress={() => {
                if (!newCode.code) return Alert.alert('Error', 'Code is required');
                addMutation.mutate({
                  code: newCode.code,
                  discount_percent: parseInt(newCode.discount_percent) || 0,
                  min_order_paise: (parseInt(newCode.min_order_paise) || 0) * 100,
                  max_discount_paise: (parseInt(newCode.max_discount_paise) || 0) * 100,
                  is_active: true
                });
              }}
            >
              {addMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Create Code</Text>}
            </TouchableOpacity>
          </View>
        )}

        {promos.map((p: any) => (
          <View key={p.id} style={styles.promoCard}>
            <View style={styles.promoHeader}>
              <View style={styles.codeBadge}>
                <Ticket size={16} color="#FF6B35" />
                <Text style={styles.codeText}>{p.code}</Text>
              </View>
              <Switch 
                value={p.is_active}
                onValueChange={(val) => toggleMutation.mutate({ id: p.id, is_active: val })}
                trackColor={{ false: '#e5e7eb', true: '#FF6B35' }}
              />
            </View>
            <Text style={styles.promoDetails}>
              {p.discount_percent}% OFF (Max ₹{p.max_discount_paise / 100})
            </Text>
            <Text style={styles.promoSub}>
              Min Order: ₹{p.min_order_paise / 100} • Created: {new Date(p.created_at).toLocaleDateString()}
            </Text>
            <TouchableOpacity 
              style={styles.deleteBtn}
              onPress={() => {
                Alert.alert('Delete', 'Are you sure?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(p.id) }
                ]);
              }}
            >
              <Trash2 size={16} color="#EF4444" />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 16, backgroundColor: '#fff' },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#1A1A2E' },
  addButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 100 },
  addCard: { backgroundColor: '#fff', padding: 24, borderRadius: 24, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  addTitle: { fontSize: 16, fontWeight: '900', marginBottom: 16, color: '#1A1A2E' },
  input: { backgroundColor: '#f3f4f6', padding: 16, borderRadius: 12, marginBottom: 12, color: '#1A1A2E', fontWeight: 'bold' },
  saveBtn: { backgroundColor: '#FF6B35', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontWeight: '900' },
  promoCard: { backgroundColor: '#fff', padding: 24, borderRadius: 24, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  promoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  codeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 107, 53, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  codeText: { color: '#FF6B35', fontWeight: '900', marginLeft: 8 },
  promoDetails: { fontSize: 16, fontWeight: 'bold', color: '#1A1A2E' },
  promoSub: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  deleteBtn: { position: 'absolute', bottom: 24, right: 24, padding: 8, backgroundColor: '#FEF2F2', borderRadius: 8 }
});

export default PromoCodesManagerScreen;
