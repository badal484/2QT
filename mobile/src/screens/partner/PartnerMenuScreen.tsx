import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Modal,
  TextInput, Switch, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Plus, X, Edit2, Trash2, UtensilsCrossed, ChevronDown, ChevronUp } from 'lucide-react-native';
import { api } from '../../api/client';
import { colors } from '../../theme/colors';
import { fontFamily } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { BouncingButton } from '../../components/ui/BouncingButton';
import { useFeedback } from '../../context/FeedbackContext';
import { tokens } from '../../theme/tokens';

const CATEGORIES = ['Starters', 'Mains', 'Breads', 'Rice & Biryani', 'Desserts', 'Beverages', 'Salads', 'Soups', 'Specials'];

const emptyForm = () => ({
  name: '',
  description: '',
  price_paise: '',
  category: 'Mains',
  is_veg: true,
  is_available: true,
  image_url: '',
});

const PartnerMenuScreen = () => {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { showDialog } = useFeedback();
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState(emptyForm());
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [showCatPicker, setShowCatPicker] = useState(false);

  const { data: menuData, isLoading } = useQuery({
    queryKey: ['partner-menu'],
    queryFn: () => api.get('/partner/restaurant/menu').then((r: any) => r.items as any[]),
  });

  const menuByCategory: Record<string, any[]> = {};
  (menuData || []).forEach((item: any) => {
    const cat = item.category || 'Uncategorized';
    if (!menuByCategory[cat]) menuByCategory[cat] = [];
    menuByCategory[cat].push(item);
  });
  const categories = Object.keys(menuByCategory);

  const openAdd = () => {
    setEditItem(null);
    setForm(emptyForm());
    setShowForm(true);
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    setForm({
      name: item.name,
      description: item.description || '',
      price_paise: String(item.price_paise / 100),
      category: item.category || 'Mains',
      is_veg: item.is_veg,
      is_available: item.is_available,
      image_url: item.image_url || '',
    });
    setShowForm(true);
  };

  const saveMutation = useMutation({
    mutationFn: (payload: any) =>
      editItem
        ? api.put(`/partner/restaurant/menu/${editItem.id}`, payload)
        : api.post('/partner/restaurant/menu', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-menu'] });
      setShowForm(false);
    },
    onError: (err: any) => showDialog({ title: 'Error', message: err?.response?.data?.error || 'Failed to save item.', confirmText: 'Okay', type: 'error' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => api.delete(`/partner/restaurant/menu/${itemId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['partner-menu'] }),
    onError: (err: any) => showDialog({ title: 'Error', message: err?.response?.data?.error || 'Failed to delete.', confirmText: 'Okay', type: 'error' }),
  });

  const handleSave = () => {
    if (!form.name.trim()) { showDialog({ title: 'Validation', message: 'Item name is required.', confirmText: 'Okay', type: 'warning' }); return; }
    const price = parseFloat(form.price_paise);
    if (isNaN(price) || price <= 0) { showDialog({ title: 'Validation', message: 'Enter a valid price.', confirmText: 'Okay', type: 'warning' }); return; }
    saveMutation.mutate({
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      pricePaise: Math.round(price * 100),
      category: form.category,
      isVeg: form.is_veg,
      isAvailable: form.is_available,
      imageUrl: form.image_url.trim() || undefined,
    });
  };

  const handleDelete = (item: any) => {
    showDialog({
      title: 'Delete Item',
      message: `Are you sure you want to delete "${item.name}"?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'warning',
      onConfirm: () => deleteMutation.mutate(item.id)
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Menu</Text>
        <BouncingButton style={styles.addBtn} onPress={openAdd}>
          <Plus size={18} color="#fff" strokeWidth={2.5} />
          <Text style={styles.addBtnText}>Add Item</Text>
        </BouncingButton>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />
      ) : categories.length === 0 ? (
        <View style={styles.emptyWrap}>
          <UtensilsCrossed size={48} color={colors.inkFaint} strokeWidth={1} />
          <Text style={styles.emptyTitle}>No menu items yet</Text>
          <Text style={styles.emptySubtitle}>Add your first item so customers can pre-order when booking a table.</Text>
          <BouncingButton style={styles.emptyAddBtn} onPress={openAdd}>
            <Text style={styles.emptyAddBtnText}>Add Menu Item</Text>
          </BouncingButton>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {categories.map(cat => (
            <View key={cat} style={styles.catSection}>
              <TouchableOpacity
                style={styles.catHeader}
                onPress={() => setExpandedCat(expandedCat === cat ? null : cat)}
              >
                <Text style={styles.catName}>{cat}</Text>
                <View style={styles.catRight}>
                  <Text style={styles.catCount}>{menuByCategory[cat].length}</Text>
                  {expandedCat === cat
                    ? <ChevronUp size={18} color={colors.inkMuted} />
                    : <ChevronDown size={18} color={colors.inkMuted} />
                  }
                </View>
              </TouchableOpacity>

              {(expandedCat === cat || expandedCat === null) && menuByCategory[cat].map((item: any, i: number) => (
                <Animated.View key={item.id} entering={FadeInDown.delay(i * 30).duration(240)}>
                  <View style={styles.menuItemRow}>
                    <View style={styles.vegDotWrap}>
                      <View style={[styles.vegDot, { backgroundColor: item.is_veg ? tokens.colors.success : tokens.colors.danger }]} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.itemNameRow}>
                        <Text style={[styles.itemName, !item.is_available && styles.itemNameMuted]}>{item.name}</Text>
                        {!item.is_available && (
                          <View style={styles.unavailBadge}>
                            <Text style={styles.unavailText}>Unavailable</Text>
                          </View>
                        )}
                      </View>
                      {item.description ? <Text style={styles.itemDesc} numberOfLines={1}>{item.description}</Text> : null}
                      <Text style={styles.itemPrice}>₹{(item.price_paise / 100).toFixed(0)}</Text>
                    </View>
                    <View style={styles.itemActions}>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(item)}>
                        <Edit2 size={16} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(item)} disabled={deleteMutation.isPending}>
                        <Trash2 size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </Animated.View>
              ))}
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Add/Edit Modal */}
      <Modal visible={showForm} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.formOverlay}>
            <View style={[styles.formSheet, { paddingBottom: insets.bottom + 16 }]}>
              <View style={styles.formHeader}>
                <Text style={styles.formTitle}>{editItem ? 'Edit Item' : 'Add Item'}</Text>
                <TouchableOpacity onPress={() => setShowForm(false)}>
                  <X size={22} color={colors.ink} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <FieldLabel>Item Name *</FieldLabel>
                <TextInput
                  style={styles.input}
                  value={form.name}
                  onChangeText={v => setForm(f => ({ ...f, name: v }))}
                  placeholder="e.g. Paneer Tikka"
                  placeholderTextColor={colors.inkFaint}
                />

                <FieldLabel>Description</FieldLabel>
                <TextInput
                  style={[styles.input, { height: 72, textAlignVertical: 'top' }]}
                  value={form.description}
                  onChangeText={v => setForm(f => ({ ...f, description: v }))}
                  placeholder="Short description"
                  placeholderTextColor={colors.inkFaint}
                  multiline
                />

                <FieldLabel>Price (₹) *</FieldLabel>
                <TextInput
                  style={styles.input}
                  value={form.price_paise}
                  onChangeText={v => setForm(f => ({ ...f, price_paise: v }))}
                  placeholder="e.g. 250"
                  placeholderTextColor={colors.inkFaint}
                  keyboardType="decimal-pad"
                />

                <FieldLabel>Category</FieldLabel>
                <TouchableOpacity style={styles.catPicker} onPress={() => setShowCatPicker(true)}>
                  <Text style={styles.catPickerText}>{form.category}</Text>
                  <ChevronDown size={18} color={colors.inkMuted} />
                </TouchableOpacity>

                <FieldLabel>Image URL</FieldLabel>
                <TextInput
                  style={styles.input}
                  value={form.image_url}
                  onChangeText={v => setForm(f => ({ ...f, image_url: v }))}
                  placeholder="https://..."
                  placeholderTextColor={colors.inkFaint}
                  autoCapitalize="none"
                />

                <View style={styles.switchRow}>
                  <View>
                    <Text style={styles.switchLabel}>Vegetarian</Text>
                    <Text style={styles.switchSub}>Show green/red veg indicator</Text>
                  </View>
                  <Switch
                    value={form.is_veg}
                    onValueChange={v => setForm(f => ({ ...f, is_veg: v }))}
                    trackColor={{ true: tokens.colors.success, false: tokens.colors.danger }}
                  />
                </View>

                <View style={styles.switchRow}>
                  <View>
                    <Text style={styles.switchLabel}>Available</Text>
                    <Text style={styles.switchSub}>Customers can pre-order this item</Text>
                  </View>
                  <Switch
                    value={form.is_available}
                    onValueChange={v => setForm(f => ({ ...f, is_available: v }))}
                    trackColor={{ true: colors.primary, false: '#9CA3AF' }}
                  />
                </View>

                <BouncingButton
                  style={styles.saveBtn}
                  onPress={handleSave}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.saveBtnText}>{editItem ? 'Save Changes' : 'Add Item'}</Text>
                  }
                </BouncingButton>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Category picker modal */}
      <Modal visible={showCatPicker} animationType="slide" transparent>
        <View style={styles.catPickerOverlay}>
          <View style={[styles.catPickerSheet, { paddingBottom: insets.bottom + 8 }]}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setShowCatPicker(false)}>
                <X size={22} color={colors.ink} />
              </TouchableOpacity>
            </View>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.catPickerRow, form.category === cat && styles.catPickerRowActive]}
                onPress={() => { setForm(f => ({ ...f, category: cat })); setShowCatPicker(false); }}
              >
                <Text style={[styles.catPickerRowText, form.category === cat && styles.catPickerRowTextActive]}>{cat}</Text>
                {form.category === cat && <CheckCircleIcon />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const FieldLabel = ({ children }: { children: string }) => (
  <Text style={styles.fieldLabel}>{children}</Text>
);

const CheckCircleIcon = () => (
  <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' }}>
    <Text style={{ color: tokens.colors.surface, fontSize: 12 }}>✓</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 14 },
  headerTitle: { fontSize: 22, fontFamily: fontFamily.bold, color: colors.ink },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
  addBtnText: { fontSize: 14, fontFamily: fontFamily.semibold, color: tokens.colors.surface },
  scrollContent: { padding: spacing.lg },
  catSection: { marginBottom: 8 },
  catHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tokens.colors.border },
  catName: { fontSize: 15, fontFamily: fontFamily.semibold, color: colors.ink },
  catRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catCount: { fontSize: 12, color: colors.inkMuted, fontFamily: fontFamily.regular },
  menuItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingLeft: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F3F4F6' },
  vegDotWrap: { width: 20, alignItems: 'center', marginRight: 8 },
  vegDot: { width: 8, height: 8, borderRadius: 4 },
  itemNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  itemName: { fontSize: 14, fontFamily: fontFamily.medium, color: colors.ink },
  itemNameMuted: { opacity: 0.5 },
  unavailBadge: { backgroundColor: '#F3F4F6', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  unavailText: { fontSize: 10, color: '#9CA3AF', fontFamily: fontFamily.medium },
  itemDesc: { fontSize: 12, color: colors.inkMuted, fontFamily: fontFamily.regular, marginBottom: 2 },
  itemPrice: { fontSize: 13, fontFamily: fontFamily.semibold, color: colors.ink },
  itemActions: { flexDirection: 'row', gap: 4 },
  actionBtn: { width: 34, height: 34, borderRadius: 8, backgroundColor: tokens.colors.background, justifyContent: 'center', alignItems: 'center' },
  emptyWrap: { flex: 1, alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontFamily: fontFamily.semibold, color: colors.ink, marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 13, color: colors.inkMuted, textAlign: 'center', fontFamily: fontFamily.regular, lineHeight: 20, marginBottom: 24 },
  emptyAddBtn: { backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  emptyAddBtnText: { color: tokens.colors.surface, fontSize: 14, fontFamily: fontFamily.semibold },
  // Form modal
  formOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  formSheet: { backgroundColor: tokens.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '92%' },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  formTitle: { fontSize: 18, fontFamily: fontFamily.bold, color: colors.ink },
  fieldLabel: { fontSize: 12, fontFamily: fontFamily.medium, color: colors.inkMuted, marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 1.5, borderColor: tokens.colors.border, borderRadius: 12, padding: 13, fontSize: 14, fontFamily: fontFamily.regular, color: colors.ink, backgroundColor: '#FAFAFA' },
  catPicker: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1.5, borderColor: tokens.colors.border, borderRadius: 12, padding: 13, backgroundColor: '#FAFAFA' },
  catPickerText: { fontSize: 14, fontFamily: fontFamily.regular, color: colors.ink },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F3F4F6' },
  switchLabel: { fontSize: 14, fontFamily: fontFamily.medium, color: colors.ink },
  switchSub: { fontSize: 12, color: colors.inkMuted, fontFamily: fontFamily.regular, marginTop: 2 },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: tokens.colors.surface, fontSize: 15, fontFamily: fontFamily.semibold },
  // Category picker
  catPickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  catPickerSheet: { backgroundColor: tokens.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  catPickerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F3F4F6' },
  catPickerRowActive: { backgroundColor: colors.primary + '08' },
  catPickerRowText: { fontSize: 15, fontFamily: fontFamily.medium, color: colors.ink },
  catPickerRowTextActive: { color: colors.primary, fontFamily: fontFamily.semibold },
});

export default PartnerMenuScreen;
