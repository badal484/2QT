import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Switch, Image, StyleSheet } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ArrowLeft, 
  Plus, 
  UtensilsCrossed, 
  Tag, 
  Edit3, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react-native';

const MenuManagerScreen = ({ navigation }: any) => {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-menu'],
    queryFn: () => api.get('/admin/menu'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, available }: { id: string; available: boolean }) => 
      api.patch(`/admin/menu/${id}/availability`, { available }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-menu'] }),
  });

  if (isLoading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FF6B35" />
    </View>
  );

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
           <Text style={styles.headerSub}>Catalog</Text>
           <Text style={styles.headerTitle}>Menu Manager</Text>
        </View>
        <TouchableOpacity 
          activeOpacity={0.7}
          onPress={() => navigation.navigate('AddEditMenuItem')}
          style={styles.addButton}
        >
          <Plus size={20} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {data?.items?.map((item: any) => (
          <View key={item.id} style={styles.itemCard}>
            <View style={styles.cardInfo}>
               <View style={styles.imageWrapper}>
                  <Image source={{ uri: item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c' }} style={styles.itemImage} />
               </View>
               <View style={styles.detailsColumn}>
                  <View style={styles.nameRow}>
                     <UtensilsCrossed size={12} color="#FF6B35" style={{ marginRight: 8 }} />
                     <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                  </View>
                  <Text style={styles.categoryLabel}>{item.category}</Text>
                  <View style={styles.priceRow}>
                     <Text style={styles.priceText}>₹{item.price_paise / 100}</Text>
                     <View style={styles.statusRow}>
                        {item.available ? <CheckCircle2 size={10} color="#00D084" /> : <AlertCircle size={10} color="#FF4B4B" />}
                        <Text style={[styles.statusText, { color: item.available ? '#00D084' : '#FF4B4B' }]}>
                          {item.available ? 'Live' : 'Hidden'}
                        </Text>
                     </View>
                  </View>
               </View>
            </View>

            <View style={styles.actionRow}>
               <View style={styles.availabilityToggle}>
                  <Text style={styles.toggleLabel}>Availability</Text>
                  <Switch 
                    value={item.available}
                    onValueChange={(val) => toggleMutation.mutate({ id: item.id, available: val })}
                    trackColor={{ false: '#fee2e2', true: '#dcfce7' }}
                    thumbColor={item.available ? '#00D084' : '#FF4B4B'}
                    ios_backgroundColor="#fee2e2"
                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                  />
               </View>
               <TouchableOpacity 
                  onPress={() => navigation.navigate('AddEditMenuItem', { item })}
                  style={styles.editButton}
               >
                  <Edit3 size={18} color="white" />
               </TouchableOpacity>
            </View>
          </View>
        ))}

        {(!data?.items || data.items.length === 0) && (
           <View style={styles.emptyContainer}>
              <Plus size={60} color="#D1D5DB" strokeWidth={1} />
              <Text style={styles.emptyText}>No Items Found</Text>
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
  addButton: {
    width: 40,
    height: 40,
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  itemCard: {
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
    overflow: 'hidden',
  },
  cardInfo: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  imageWrapper: {
    width: 96,
    height: 96,
    backgroundColor: '#f9fafb',
    borderRadius: 24,
    overflow: 'hidden',
    marginRight: 20,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  detailsColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemName: {
    color: '#1A1A2E',
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: -0.5,
  },
  categoryLabel: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceText: {
    color: '#1A1A2E',
    fontSize: 20,
    fontWeight: '900',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: 6,
  },
  actionRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f9fafb',
    paddingTop: 16,
  },
  availabilityToggle: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 56,
    marginRight: 12,
  },
  toggleLabel: {
    color: '#9ca3af',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  editButton: {
    width: 56,
    height: 56,
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
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
    textAlign: 'center',
  },
});

export default MenuManagerScreen;
