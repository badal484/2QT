import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  Alert, Image, StyleSheet, KeyboardAvoidingView, ScrollView,
  Platform, StatusBar,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RootState } from '../store';
import { api } from '../api/client';
import { setAuth } from '../store/slices/authSlice';
import { ArrowLeft, User, ShieldCheck, ChevronRight } from 'lucide-react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { uploadToImageKit } from '../utils/imageKit';
import { SafeAreaView } from 'react-native-safe-area-context';

const R = {
  orange: '#FC4603', orangeLight: '#FFF0E8',
  green: '#1BA672', greenLight: '#E8F8F1',
  ink: '#1C1C1E', gray: '#8E8E93', muted: '#C7C7CC',
  border: '#E5E5EA', bg: '#F2F2F7', white: '#FFFFFF',
};

const EditProfileScreen = ({ navigation }: any) => {
  const { user, accessToken, refreshToken } = useSelector((state: RootState) => state.auth);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [photoUrl, setPhotoUrl] = useState(user?.photo_url || '');
  const [isUploading, setIsUploading] = useState(false);
  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  const isRider = user?.role === 'rider' || user?.role === 'rider_captain';
  const accent = isRider ? R.orange : R.green;

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.patch('/customers/profile', data),
    onSuccess: (data) => {
      dispatch(setAuth({
        user: { ...user, name: data.user.name, email: data.user.email, photo_url: data.user.photo_url },
        accessToken,
        refreshToken,
      }));
      queryClient.invalidateQueries({ queryKey: ['me'] });
      Alert.alert('Saved', 'Your profile has been updated successfully.');
      navigation.goBack();
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to update profile');
    },
  });

  const handleSave = () => {
    if (!name.trim()) return Alert.alert('Required', 'Name cannot be empty');
    if (!email.trim() || !/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
      return Alert.alert('Invalid Email', 'Please enter a valid email address');
    }
    updateMutation.mutate({ name, email, photo_url: photoUrl });
  };

  const handlePickImage = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
    if (result.assets && result.assets[0]) {
      setIsUploading(true);
      try {
        const uploadResult = await uploadToImageKit(result.assets[0]);
        setPhotoUrl(uploadResult.url);
      } catch (err: any) {
        Alert.alert('Upload Failed', err.message);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const hasChanges = name !== user?.name || email !== user?.email || photoUrl !== user?.photo_url;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={R.bg} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* Premium Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn} activeOpacity={0.7}>
            <ArrowLeft size={22} color={R.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerBtn} />
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >

            {/* Avatar Section */}
            <View style={styles.avatarSection}>
              <TouchableOpacity onPress={handlePickImage} activeOpacity={0.8} style={styles.avatarWrap}>
                <View style={styles.avatarCircle}>
                  {photoUrl ? (
                    <Image source={{ uri: photoUrl }} style={styles.avatarImage} />
                  ) : (
                    <User size={40} color={R.muted} />
                  )}
                  {isUploading && (
                    <View style={styles.uploadOverlay}>
                      <ActivityIndicator color={R.white} />
                    </View>
                  )}
                </View>
                <Text style={[styles.editPhotoText, { color: accent }]}>Edit Photo</Text>
              </TouchableOpacity>
            </View>

            {/* Grouped Form Fields */}
            <View style={styles.formGroup}>
              {/* Name Field */}
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Name</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Your full name"
                  placeholderTextColor={R.muted}
                />
              </View>
              <View style={styles.divider} />

              {/* Email Field */}
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email address"
                  placeholderTextColor={R.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* Read-only / Verified Section */}
            <View style={styles.formGroup}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Phone</Text>
                <Text style={styles.readOnlyText}>+{user?.phone}</Text>
                <View style={styles.verifiedBadge}>
                  <ShieldCheck size={14} color={R.green} />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              </View>
            </View>
            <Text style={styles.footerNote}>
              Phone numbers cannot be changed directly. Please contact support if you need to update your verified number.
            </Text>

          </ScrollView>

          {/* Sticky Save Button (only visible if changes made) */}
          {hasChanges && (
            <View style={styles.stickyFooter}>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: accent }, updateMutation.isPending && { opacity: 0.7 }]}
                onPress={handleSave}
                disabled={updateMutation.isPending}
                activeOpacity={0.9}
              >
                {updateMutation.isPending
                  ? <ActivityIndicator color={R.white} />
                  : <Text style={styles.saveBtnText}>Save Changes</Text>
                }
              </TouchableOpacity>
            </View>
          )}

        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: R.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: R.bg,
  },
  headerBtn: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: R.ink, letterSpacing: -0.4 },

  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 },

  avatarSection: { alignItems: 'center', marginBottom: 32 },
  avatarWrap: { alignItems: 'center' },
  avatarCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: R.white,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3,
    marginBottom: 12,
  },
  avatarImage: { width: '100%', height: '100%' },
  uploadOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  editPhotoText: { fontSize: 15, fontWeight: '500' },

  formGroup: {
    backgroundColor: R.white,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
  },
  fieldRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, minHeight: 52,
  },
  fieldLabel: {
    width: 80, fontSize: 15, fontWeight: '400', color: R.ink,
  },
  input: {
    flex: 1, fontSize: 15, fontWeight: '400', color: R.ink,
    paddingVertical: 14,
  },
  readOnlyText: {
    flex: 1, fontSize: 15, fontWeight: '400', color: R.gray,
  },
  divider: {
    height: StyleSheet.hairlineWidth, backgroundColor: R.border,
    marginLeft: 16,
  },
  verifiedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: R.greenLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  verifiedText: { color: R.green, fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },

  footerNote: {
    fontSize: 13, color: R.gray, lineHeight: 18,
    paddingHorizontal: 8, marginTop: -8, textAlign: 'center',
  },

  stickyFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingBottom: 32, paddingTop: 16,
    backgroundColor: 'rgba(242, 242, 247, 0.9)', // Match R.bg with opacity
  },
  saveBtn: {
    borderRadius: 14, paddingVertical: 16, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  saveBtnText: { color: R.white, fontSize: 16, fontWeight: '600' },
});

export default EditProfileScreen;

