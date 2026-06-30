import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, Image, StyleSheet, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RootState } from '../store';
import { api } from '../api/client';
import { setAuth } from '../store/slices/authSlice';
import { ArrowLeft, Camera, User, Mail, ShieldCheck } from 'lucide-react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { uploadToImageKit } from '../utils/imageKit';

const EditProfileScreen = ({ navigation }: any) => {
  const { user, accessToken, refreshToken } = useSelector((state: RootState) => state.auth);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [photoUrl, setPhotoUrl] = useState(user?.photo_url || '');
  const [isUploading, setIsUploading] = useState(false);
  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.patch('/customers/profile', data),
    onSuccess: (data) => {
      dispatch(setAuth({
        user: { ...user, name: data.user.name, email: data.user.email, photo_url: data.user.photo_url },
        accessToken,
        refreshToken
      }));
      queryClient.invalidateQueries({ queryKey: ['me'] });
      Alert.alert('Success', 'Profile updated successfully');
      navigation.goBack();
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to update profile');
    }
  });

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Name is required');
      return;
    }
    if (!email.trim() || !/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
      Alert.alert('Validation', 'Please enter a valid email address');
      return;
    }
    updateMutation.mutate({ name, email, photo_url: photoUrl });
  };

  const handlePickImage = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
    });

    if (result.assets && result.assets[0]) {
      setIsUploading(true);
      try {
        const uploadResult = await uploadToImageKit(result.assets[0]);
        setPhotoUrl(uploadResult.url);
        Alert.alert('Success', 'Photo uploaded! Don\'t forget to save changes.');
      } catch (err: any) {
        Alert.alert('Upload Failed', err.message);
      } finally {
        setIsUploading(false);
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Persona</Text>
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView 
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatarWrapper}>
                {isUploading ? (
                  <ActivityIndicator color="#FF6B35" />
                ) : photoUrl ? (
                  <Image source={{ uri: photoUrl }} style={styles.avatarImage} />
                ) : (
                  <User size={48} color="#D1D5DB" />
                )}
              </View>
              <TouchableOpacity 
                style={styles.cameraButton}
                onPress={handlePickImage}
                disabled={isUploading}
              >
                <Camera size={18} color="white" />
              </TouchableOpacity>
            </View>
            <Text style={styles.avatarHint}>Tap to change avatar</Text>
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <View style={styles.inputWrapper}>
                <User size={20} color="#9CA3AF" style={{ marginRight: 16 }} />
                <TextInput 
                  style={styles.textInput}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter your name"
                  placeholderTextColor="#A0A0A0"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <View style={styles.inputWrapper}>
                <Mail size={20} color="#9CA3AF" style={{ marginRight: 16 }} />
                <TextInput 
                  style={styles.textInput}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="email@example.com"
                  placeholderTextColor="#A0A0A0"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Mobile Number</Text>
              <View style={[styles.inputWrapper, styles.inputDisabled]}>
                <ShieldCheck size={20} color="#9CA3AF" style={{ marginRight: 16 }} />
                <Text style={styles.phoneText}>+{user?.phone}</Text>
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              </View>
            </View>
          </View>

          <TouchableOpacity 
            activeOpacity={0.9}
            onPress={handleSave}
            disabled={updateMutation.isPending}
            style={styles.saveBtn}
          >
            {updateMutation.isPending ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.saveBtnText}>Update Persona</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingTop: 64,
    paddingHorizontal: 32,
    paddingBottom: 32,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 48,
    height: 48,
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 24,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  headerTitle: {
    color: '#1A1A2E',
    fontSize: 24,
    fontWeight: '900',
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 24,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarWrapper: {
    width: 128,
    height: 128,
    backgroundColor: '#f9fafb',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  cameraButton: {
    position: 'absolute',
    right: -8,
    bottom: -8,
    width: 40,
    height: 40,
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarHint: {
    marginTop: 16,
    color: '#9ca3af',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 10,
  },
  formContainer: {
    gap: 24,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    color: '#9ca3af',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 9,
    marginLeft: 4,
  },
  inputWrapper: {
    backgroundColor: '#f9fafb',
    height: 64,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  inputDisabled: {
    backgroundColor: '#f3f4f6',
    opacity: 0.6,
  },
  textInput: {
    flex: 1,
    fontWeight: '700',
    color: '#1A1A2E',
    fontSize: 18,
  },
  phoneText: {
    fontWeight: '700',
    color: '#4B5563',
    fontSize: 18,
  },
  verifiedBadge: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  verifiedText: {
    color: '#166534',
    fontWeight: '900',
    fontSize: 8,
    textTransform: 'uppercase',
  },
  saveBtn: {
    marginTop: 64,
    backgroundColor: '#1A1A2E',
    height: 64,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 3,
    fontSize: 12,
  },
});

export default EditProfileScreen;
