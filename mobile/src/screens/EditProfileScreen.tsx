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
import { ArrowLeft, Camera, User, Mail, ShieldCheck } from 'lucide-react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { uploadToImageKit } from '../utils/imageKit';
import { SafeAreaView } from 'react-native-safe-area-context';

const R = {
  orange: '#FC8019', orangeLight: '#FFF3E8',
  green: '#1BA672', greenLight: '#E8F8F1',
  ink: '#282C3F', gray: '#686B78', muted: '#93959F',
  border: '#E9E9EB', bg: '#F8F8F8', white: '#FFFFFF',
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

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.patch('/customers/profile', data),
    onSuccess: (data) => {
      dispatch(setAuth({
        user: { ...user, name: data.user.name, email: data.user.email, photo_url: data.user.photo_url },
        accessToken,
        refreshToken,
      }));
      queryClient.invalidateQueries({ queryKey: ['me'] });
      Alert.alert('Saved!', 'Your profile has been updated.');
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
        Alert.alert('Photo ready', 'Tap Save Changes to apply.');
      } catch (err: any) {
        Alert.alert('Upload Failed', err.message);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const accent = isRider ? R.orange : R.green;
  const accentLight = isRider ? R.orangeLight : R.greenLight;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={R.white} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={20} color={R.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >

            {/* Avatar */}
            <View style={styles.avatarSection}>
              <View style={styles.avatarWrap}>
                <View style={[styles.avatarCircle, { borderColor: accentLight }]}>
                  {isUploading ? (
                    <ActivityIndicator color={accent} />
                  ) : photoUrl ? (
                    <Image source={{ uri: photoUrl }} style={styles.avatarImage} />
                  ) : (
                    <User size={48} color={R.muted} />
                  )}
                </View>
                <TouchableOpacity
                  style={[styles.cameraBtn, { backgroundColor: accent }]}
                  onPress={handlePickImage}
                  disabled={isUploading}
                  activeOpacity={0.85}
                >
                  <Camera size={16} color={R.white} />
                </TouchableOpacity>
              </View>
              <Text style={styles.avatarHint}>Tap to change photo</Text>
            </View>

            {/* Form */}
            <View style={styles.form}>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Full Name</Text>
                <View style={styles.inputWrap}>
                  <User size={18} color={R.muted} />
                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="Your full name"
                    placeholderTextColor={R.muted}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Email Address</Text>
                <View style={styles.inputWrap}>
                  <Mail size={18} color={R.muted} />
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="email@example.com"
                    placeholderTextColor={R.muted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Mobile Number</Text>
                <View style={[styles.inputWrap, styles.inputDisabled]}>
                  <ShieldCheck size={18} color={R.green} />
                  <Text style={styles.phoneText}>+{user?.phone}</Text>
                  <View style={styles.verifiedBadge}>
                    <Text style={styles.verifiedText}>Verified</Text>
                  </View>
                </View>
              </View>

            </View>

            {/* Save */}
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: accent }, updateMutation.isPending && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={updateMutation.isPending}
              activeOpacity={0.88}
            >
              {updateMutation.isPending
                ? <ActivityIndicator color={R.white} />
                : <Text style={styles.saveBtnText}>Save Changes</Text>
              }
            </TouchableOpacity>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: R.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: R.white, borderBottomWidth: 1, borderBottomColor: R.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: R.bg, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: R.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: R.ink },

  scrollContent: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 48, gap: 24 },

  avatarSection: { alignItems: 'center', marginBottom: 8 },
  avatarWrap: { position: 'relative' },
  avatarCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: R.white, borderWidth: 3,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  avatarImage: { width: '100%', height: '100%' },
  cameraBtn: {
    position: 'absolute', right: -4, bottom: -4,
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: R.white,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, elevation: 3,
  },
  avatarHint: { marginTop: 12, color: R.muted, fontSize: 12, fontWeight: '600' },

  form: { gap: 16 },
  fieldGroup: { gap: 6 },
  fieldLabel: { color: R.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase', marginLeft: 4 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: R.white, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: R.border,
  },
  inputDisabled: { backgroundColor: R.bg, opacity: 0.75 },
  input: { flex: 1, fontSize: 16, fontWeight: '600', color: R.ink },
  phoneText: { flex: 1, fontSize: 16, fontWeight: '600', color: R.gray },
  verifiedBadge: {
    backgroundColor: R.greenLight, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8,
  },
  verifiedText: { color: R.green, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },

  saveBtn: {
    borderRadius: 16, paddingVertical: 17, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, elevation: 6,
  },
  saveBtnText: { color: R.white, fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },
});

export default EditProfileScreen;
