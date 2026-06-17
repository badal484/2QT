import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Alert, StyleSheet,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { api } from '../api/client';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle, CheckCircle2, Package } from 'lucide-react-native';

const G = {
  bg: '#070707',
  card: '#111111',
  border: 'rgba(255,255,255,0.07)',
  faint: 'rgba(255,255,255,0.05)',
  green: '#00D084',
  greenBg: 'rgba(0,208,132,0.08)',
  greenBorder: 'rgba(0,208,132,0.18)',
  red: '#EF4444',
  redBg: 'rgba(239,68,68,0.08)',
  redBorder: 'rgba(239,68,68,0.18)',
  white: '#FFFFFF',
  dim: 'rgba(255,255,255,0.55)',
  muted: 'rgba(255,255,255,0.2)',
};

const StockScreen = () => {
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
      const ep = isAdmin ? `/admin/inventory/${id}` : `/kitchen/inventory/${id}`;
      return api.patch(ep, { current_stock: stock });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', isAdmin] });
      setUpdatingId(null);
      setNewStock('');
      Alert.alert('Updated', 'Stock levels saved.');
    },
  });

  const ingredients = data?.ingredients || data?.inventory || [];
  const lowStock = ingredients.filter((i: any) => Number(i.current_stock) <= Number(i.reorder_threshold));
  const okStock = ingredients.filter((i: any) => Number(i.current_stock) > Number(i.reorder_threshold));

  const IngredientCard = ({ ing }: { ing: any }) => {
    const low = Number(ing.current_stock) <= Number(ing.reorder_threshold);
    const pct = Math.min(1, Number(ing.current_stock) / (Number(ing.reorder_threshold) * 3 || 1));
    const isEditing = updatingId === ing.id;

    return (
      <View style={[styles.card, low && styles.cardLow]}>
        <View style={styles.cardTop}>
          <View style={styles.cardLeft}>
            <Text style={styles.ingName}>{ing.name}</Text>
            <Text style={styles.ingUnit}>{ing.unit || 'units'}</Text>
          </View>
          <View style={styles.cardRight}>
            <Text style={[styles.stockNum, { color: low ? G.red : G.white }]}>
              {ing.current_stock}
            </Text>
            {low && (
              <View style={styles.lowBadge}>
                <AlertTriangle size={9} color={G.red} />
                <Text style={styles.lowBadgeText}>LOW</Text>
              </View>
            )}
          </View>
        </View>

        {/* Level bar */}
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${pct * 100}%` as any, backgroundColor: low ? G.red : G.green }]} />
        </View>
        <View style={styles.barLabels}>
          <Text style={styles.barLabel}>0</Text>
          <Text style={styles.barLabel}>Threshold: {ing.reorder_threshold}</Text>
        </View>

        {isEditing ? (
          <View style={styles.editRow}>
            <TextInput
              style={styles.editInput}
              keyboardType="numeric"
              value={newStock}
              onChangeText={setNewStock}
              autoFocus
              placeholderTextColor={G.muted}
              placeholder="New qty"
              selectionColor={G.green}
            />
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={() => updateMutation.mutate({ id: ing.id, stock: parseInt(newStock) || 0 })}
            >
              <Text style={styles.saveBtnText}>SAVE</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setUpdatingId(null)}>
              <Text style={styles.cancelBtnText}>×</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.adjustBtn}
            onPress={() => { setUpdatingId(ing.id); setNewStock(String(ing.current_stock)); }}
            activeOpacity={0.7}
          >
            <Text style={styles.adjustBtnText}>ADJUST STOCK</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <Text style={styles.headerSub}>SUPPLIES</Text>
          <Text style={styles.headerTitle}>Stock Control</Text>
        </View>
      </SafeAreaView>

      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={G.green} size="large" />
        </View>
      ) : ingredients.length === 0 ? (
        <View style={styles.loader}>
          <CheckCircle2 size={48} color={G.muted} strokeWidth={1} />
          <Text style={styles.emptyText}>Inventory is prime</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {lowStock.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <AlertTriangle size={12} color={G.red} />
                <Text style={[styles.sectionLabel, { color: G.red }]}>LOW STOCK</Text>
              </View>
              {lowStock.map((ing: any) => <IngredientCard key={ing.id} ing={ing} />)}
            </View>
          )}

          {okStock.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Package size={12} color={G.muted} />
                <Text style={styles.sectionLabel}>IN STOCK</Text>
              </View>
              {okStock.map((ing: any) => <IngredientCard key={ing.id} ing={ing} />)}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: G.bg },
  safeTop: { backgroundColor: G.bg },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  emptyText: { color: G.muted, fontSize: 14, fontWeight: '700' },

  header: {
    paddingHorizontal: 24, paddingTop: 16, paddingBottom: 20,
    borderBottomWidth: 1, borderBottomColor: G.faint,
  },
  headerSub: { color: G.muted, fontSize: 9, fontWeight: '900', letterSpacing: 4, marginBottom: 4 },
  headerTitle: { color: G.white, fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: 24 },

  section: { paddingHorizontal: 20, marginBottom: 8 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionLabel: { color: G.muted, fontSize: 9, fontWeight: '900', letterSpacing: 4 },

  card: {
    backgroundColor: G.card, borderRadius: 20, padding: 20,
    marginBottom: 14, borderWidth: 1, borderColor: G.border,
  },
  cardLow: { borderColor: G.redBorder, backgroundColor: '#120909' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  cardLeft: { flex: 1 },
  ingName: { color: G.white, fontSize: 18, fontWeight: '900', letterSpacing: -0.3, marginBottom: 3 },
  ingUnit: { color: G.muted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2 },
  cardRight: { alignItems: 'flex-end' },
  stockNum: { fontSize: 36, fontWeight: '900', letterSpacing: -1, lineHeight: 40 },
  lowBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4,
    backgroundColor: G.redBg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 1, borderColor: G.redBorder,
  },
  lowBadgeText: { color: G.red, fontSize: 8, fontWeight: '900', letterSpacing: 2 },

  barTrack: { height: 4, backgroundColor: G.faint, borderRadius: 2, marginBottom: 6 },
  barFill: { height: 4, borderRadius: 2 },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  barLabel: { color: G.muted, fontSize: 9, fontWeight: '700' },

  editRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  editInput: {
    flex: 1, height: 48, backgroundColor: G.faint, borderRadius: 12,
    paddingHorizontal: 16, color: G.white, fontSize: 18, fontWeight: '900',
    borderWidth: 1, borderColor: G.border,
  },
  saveBtn: {
    backgroundColor: G.green, height: 48, paddingHorizontal: 20,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { color: '#000', fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  cancelBtn: {
    width: 48, height: 48, backgroundColor: G.faint, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: G.border,
  },
  cancelBtnText: { color: G.dim, fontSize: 22, fontWeight: '300' },

  adjustBtn: {
    height: 48, borderRadius: 12, borderWidth: 1, borderColor: G.border,
    alignItems: 'center', justifyContent: 'center',
  },
  adjustBtnText: { color: G.muted, fontSize: 10, fontWeight: '900', letterSpacing: 2 },
});

export default StockScreen;
