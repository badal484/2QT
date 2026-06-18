import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet, Alert, Switch, Image } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Plus, Trash2, Image as ImageIcon } from 'lucide-react-native';
import { api } from '../../api/client';
import { ENV } from '../../config/env';
import { launchImageLibrary } from 'react-native-image-picker';
import { store } from '../../store';

const BannersManagerScreen = ({ navigation }: any) => {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newBanner, setNewBanner] = useState({
    title: '',
    subtitle: '',
    tag_text: 'PROMO',
    image_url: '',
    action_type: 'NONE',
    action_payload: ''
  });
  const [isUploading, setIsUploading] = useState(false);

  const { data: bannersData, isLoading } = useQuery({
    queryKey: ['admin-banners'],
    queryFn: () => api.get('/banners/admin'),
  });

  const addMutation = useMutation({
    mutationFn: (data: any) => api.post('/banners/admin', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-banners'] });
      setShowAddForm(false);
      setNewBanner({ title: '', subtitle: '', tag_text: 'PROMO', image_url: '', action_type: 'NONE', action_payload: '' });
      Alert.alert('Success', 'Banner created');
    },
    onError: (err: any) => Alert.alert('Error', err.message || 'Could not create banner')
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/banners/admin/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-banners'] }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string, is_active: boolean }) => api.patch(`/banners/admin/${id}`, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-banners'] }),
  });

  const pickAndUploadImage = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
    });

    if (result.didCancel || !result.assets || result.assets.length === 0) return;

    setIsUploading(true);
    const asset = result.assets[0];
    const uri = asset.uri!;
    const fileType = asset.type || 'image/jpeg';
    const formData = new FormData();
    formData.append('image', {
      uri: uri,
      name: asset.fileName || `banner_${Date.now()}.jpg`,
      type: fileType
    } as any);

    try {
      const token = store.getState().auth.accessToken;
      const response = await fetch(`${ENV.API_URL}/upload/image`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData,
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || json.error || 'Upload failed');
      setNewBanner({ ...newBanner, image_url: json.url });
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message);
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FF6B35" />
    </View>
  );

  const banners = bannersData?.banners || [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Marketing Banners</Text>
        <TouchableOpacity onPress={() => setShowAddForm(!showAddForm)} style={styles.addButton}>
          <Plus size={24} color="#1A1A2E" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {showAddForm && (
          <View style={styles.addCard}>
            <Text style={styles.addTitle}>New Promotional Banner</Text>
            
            <TouchableOpacity style={styles.imagePicker} onPress={pickAndUploadImage}>
              {isUploading ? (
                <ActivityIndicator color="#FF6B35" />
              ) : newBanner.image_url ? (
                <Image source={{ uri: newBanner.image_url }} style={styles.previewImage} />
              ) : (
                <>
                  <ImageIcon size={32} color="#9ca3af" />
                  <Text style={styles.pickerText}>Upload Banner Image (16:9)</Text>
                </>
              )}
            </TouchableOpacity>

            <TextInput 
              style={styles.input}
              placeholder="Main Title (e.g. Weekend Special)"
              placeholderTextColor="#9ca3af"
              value={newBanner.title}
              onChangeText={(t) => setNewBanner({ ...newBanner, title: t })}
            />
            <TextInput 
              style={styles.input}
              placeholder="Subtitle (e.g. 20% OFF all items)"
              placeholderTextColor="#9ca3af"
              value={newBanner.subtitle}
              onChangeText={(t) => setNewBanner({ ...newBanner, subtitle: t })}
            />
            <TextInput 
              style={styles.input}
              placeholder="Tag (e.g. OFFER, PROMO)"
              placeholderTextColor="#9ca3af"
              value={newBanner.tag_text}
              onChangeText={(t) => setNewBanner({ ...newBanner, tag_text: t.toUpperCase() })}
              autoCapitalize="characters"
            />
            
            <TouchableOpacity 
              style={styles.saveBtn}
              onPress={() => {
                if (!newBanner.title) return Alert.alert('Error', 'Title is required');
                addMutation.mutate({
                  ...newBanner,
                  is_active: true,
                  display_order: banners.length
                });
              }}
            >
              {addMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Publish Banner</Text>}
            </TouchableOpacity>
          </View>
        )}

        {banners.map((b: any) => (
          <View key={b.id} style={styles.bannerCard}>
            {b.image_url ? (
              <Image source={{ uri: b.image_url }} style={styles.bannerImage} />
            ) : (
              <View style={styles.bannerMock}>
                <Text style={styles.mockTitle}>{b.title}</Text>
                <Text style={styles.mockSub}>{b.subtitle}</Text>
              </View>
            )}
            
            <View style={styles.bannerControls}>
              <View style={styles.bannerInfo}>
                <Text style={styles.bannerTitle}>{b.title}</Text>
                <Text style={styles.bannerTag}>{b.tag_text}</Text>
              </View>
              
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Switch 
                  value={b.is_active}
                  onValueChange={(val) => toggleMutation.mutate({ id: b.id, is_active: val })}
                  trackColor={{ false: '#e5e7eb', true: '#FF6B35' }}
                />
                <TouchableOpacity 
                  style={styles.deleteBtn}
                  onPress={() => {
                    Alert.alert('Delete', 'Are you sure?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(b.id) }
                    ]);
                  }}
                >
                  <Trash2 size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
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
  imagePicker: { height: 160, backgroundColor: '#f3f4f6', borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 16, overflow: 'hidden' },
  previewImage: { width: '100%', height: '100%' },
  pickerText: { marginTop: 8, color: '#9ca3af', fontWeight: 'bold' },
  input: { backgroundColor: '#f3f4f6', padding: 16, borderRadius: 12, marginBottom: 12, color: '#1A1A2E', fontWeight: 'bold' },
  saveBtn: { backgroundColor: '#FF6B35', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontWeight: '900' },
  bannerCard: { backgroundColor: '#fff', borderRadius: 24, marginBottom: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  bannerImage: { width: '100%', height: 160 },
  bannerMock: { width: '100%', height: 160, backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center', padding: 20 },
  mockTitle: { color: '#fff', fontSize: 24, fontWeight: '900' },
  mockSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4 },
  bannerControls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  bannerInfo: { flex: 1 },
  bannerTitle: { fontSize: 16, fontWeight: 'bold', color: '#1A1A2E' },
  bannerTag: { fontSize: 10, color: '#FF6B35', fontWeight: '900', marginTop: 4 },
  deleteBtn: { padding: 8, backgroundColor: '#FEF2F2', borderRadius: 8, marginLeft: 12 }
});

export default BannersManagerScreen;
