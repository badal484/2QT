import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Switch, StyleSheet } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ArrowLeft, 
  Save, 
  UtensilsCrossed, 
  Tag, 
  Info,
  IndianRupee,
  Image as ImageIcon
} from 'lucide-react-native';

const AddEditMenuItemScreen = ({ route, navigation }: any) => {
  const { item } = route.params || {};
  const isEditing = !!item;
  const queryClient = useQueryClient();

  const [name, setName] = useState(item?.name || '');
  const [description, setDescription] = useState(item?.description || '');
  const [price, setPrice] = useState(item ? (item.price_paise / 100).toString() : '');
  const [category, setCategory] = useState(item?.category || 'Main Course');
  const [imageUrl, setImageUrl] = useState(item?.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c');
  const [available, setAvailable] = useState(item ? item.available : true);

  const mutation = useMutation({
    mutationFn: (data: any) => {
      if (isEditing) {
        return api.put(`/admin/menu/${item.id}`, data);
      }
      return api.post('/admin/menu', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-menu'] });
      Alert.alert('Success', `Menu item ${isEditing ? 'updated' : 'created'} successfully.`);
      navigation.goBack();
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Something went wrong');
    }
  });

  const handleSave = () => {
    if (!name || !price || !category) {
      Alert.alert('Missing Fields', 'Please fill in all required fields.');
      return;
    }

    mutation.mutate({
      name,
      description,
      price_paise: Math.round(parseFloat(price) * 100),
      category,
      image_url: imageUrl,
      available
    });
  };

  const categories = ['Main Course', 'Fast Food', 'Beverages', 'Desserts', 'Salads'];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          activeOpacity={0.7}
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <ArrowLeft size={20} color="#1A1A2E" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
           <Text style={styles.headerSub}>{isEditing ? 'Modification' : 'Creation'}</Text>
           <Text style={styles.headerTitle}>{isEditing ? 'Edit Item' : 'New Item'}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Basic Info */}
        <View style={styles.inputGroup}>
          <View style={styles.inputLabelRow}>
             <Info size={14} color="#FF6B35" />
             <Text style={styles.inputLabelText}>Vital Stats</Text>
          </View>
          
          <View style={styles.inputCard}>
            <TextInput
              style={styles.nameInput}
              placeholder="Item Name (e.g. Truffle Pasta)"
              placeholderTextColor="#C1C1C1"
              value={name}
              onChangeText={setName}
            />
            <View style={styles.divider} />
            <TextInput
              style={styles.descInput}
              placeholder="Description & Ingredients..."
              placeholderTextColor="#C1C1C1"
              multiline
              textAlignVertical="top"
              value={description}
              onChangeText={setDescription}
            />
          </View>
        </View>

        {/* Pricing & Category */}
        <View style={styles.row}>
           <View style={styles.columnHalf}>
              <View style={styles.inputLabelRow}>
                 <IndianRupee size={14} color="#FF6B35" />
                 <Text style={styles.inputLabelText}>Price</Text>
              </View>
              <TextInput
                style={styles.priceInput}
                placeholder="0.00"
                keyboardType="numeric"
                value={price}
                onChangeText={setPrice}
              />
           </View>
           <View style={styles.columnHalf}>
              <View style={styles.inputLabelRow}>
                 <Tag size={14} color="#FF6B35" />
                 <Text style={styles.inputLabelText}>Status</Text>
              </View>
              <View style={styles.statusBox}>
                 <Text style={styles.statusBoxText}>{available ? 'Live' : 'Hidden'}</Text>
                 <Switch 
                   value={available}
                   onValueChange={setAvailable}
                   trackColor={{ false: '#fee2e2', true: '#dcfce7' }}
                   thumbColor={available ? '#00D084' : '#FF4B4B'}
                 />
              </View>
           </View>
        </View>

        {/* Category Picker */}
        <View style={styles.categorySection}>
          <Text style={styles.categoryLabel}>Classification</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
            {categories.map((cat) => (
              <TouchableOpacity 
                key={cat}
                onPress={() => setCategory(cat)}
                style={[styles.catButton, { backgroundColor: category === cat ? '#1A1A2E' : '#f9fafb', borderColor: category === cat ? '#1A1A2E' : '#f3f4f6' }]}
              >
                <Text style={[styles.catButtonText, { color: category === cat ? '#fff' : '#9ca3af' }]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Image URL */}
        <View style={styles.imageSection}>
           <View style={styles.inputLabelRow}>
              <ImageIcon size={14} color="#FF6B35" />
              <Text style={styles.inputLabelText}>Visual Asset URL</Text>
           </View>
           <TextInput
             style={styles.urlInput}
             placeholder="https://..."
             value={imageUrl}
             onChangeText={setImageUrl}
             placeholderTextColor="#9ca3af"
           />
        </View>

        <TouchableOpacity 
          activeOpacity={0.9}
          onPress={handleSave}
          disabled={mutation.isPending}
          style={styles.saveButton}
        >
          {mutation.isPending ? (
            <ActivityIndicator color="white" />
          ) : (
            <View style={styles.saveButtonInner}>
              <Save size={20} color="white" />
              <Text style={styles.saveButtonText}>Commit Changes</Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
    paddingHorizontal: 32,
    paddingTop: 32,
    paddingBottom: 100,
  },
  inputGroup: {
    marginBottom: 32,
  },
  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  inputLabelText: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginLeft: 8,
  },
  inputCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    padding: 8,
  },
  nameInput: {
    padding: 24,
    fontSize: 18,
    fontWeight: '900',
    color: '#1A1A2E',
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginHorizontal: 24,
  },
  descInput: {
    padding: 24,
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    minHeight: 120,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  columnHalf: {
    width: '48%',
  },
  priceInput: {
    backgroundColor: '#f9fafb',
    padding: 24,
    borderRadius: 28,
    fontSize: 20,
    fontWeight: '900',
    color: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  statusBox: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 76,
  },
  statusBoxText: {
    color: '#1A1A2E',
    fontWeight: '900',
    fontSize: 12,
    textTransform: 'uppercase',
    marginLeft: 8,
  },
  categorySection: {
    marginBottom: 32,
  },
  categoryLabel: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 16,
    marginLeft: 8,
  },
  categoryScroll: {
    flexDirection: 'row',
  },
  catButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 12,
  },
  catButtonText: {
    fontWeight: '900',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  imageSection: {
    marginBottom: 48,
  },
  urlInput: {
    backgroundColor: '#f9fafb',
    padding: 24,
    borderRadius: 28,
    fontSize: 12,
    fontWeight: '700',
    color: '#9ca3af',
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  saveButton: {
    backgroundColor: '#FF6B35',
    height: 80,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 5,
    marginBottom: 40,
  },
  saveButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 3,
    marginLeft: 16,
  },
});

export default AddEditMenuItemScreen;
